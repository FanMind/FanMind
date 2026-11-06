import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  chmod,
  mkdtemp,
  mkdir,
  open,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";

import {
  assertSafeArchiveEntry,
  detectBackupType,
  parseChecksumLine,
  sha256File,
  verifyBackupArtifact,
  verifyChecksumPair,
  verifyFullManifest,
  verifyStorageManifest,
} from "../scripts/operations/verify-backup-artifact.mjs";
import {
  verifyFullBackupRestoreReceipt,
} from "../scripts/operations/verify-full-backup-restore-receipt.mjs";
import {
  analyzeAuthorizationToc,
} from "../scripts/operations/database-authorization-contract.mjs";

const execFileAsync = promisify(execFile);

const AUTHORIZATION_TOC = `${[
  "; Archive created by PostgreSQL 17",
  "10; 0 0 ACL public TABLE contacts postgres",
  "11; 826 20000 DEFAULT ACL public DEFAULT PRIVILEGES FOR TABLES postgres",
].join("\n")}\n`;
const REQUIRED_EXTENSIONS = [
  {
    name: "pgcrypto",
    version: "1.3",
    schema: "extensions",
    owner: "postgres",
    relocatable: true,
    schemaOwner: "postgres",
    schemaDefinitionArchived: true,
  },
  {
    name: "plpgsql",
    version: "1.0",
    schema: "pg_catalog",
    owner: "postgres",
    relocatable: false,
    schemaOwner: "postgres",
    schemaDefinitionArchived: false,
  },
];
const REQUIRED_EXTENSIONS_SHA256 = createHash("sha256")
  .update(JSON.stringify(REQUIRED_EXTENSIONS), "utf8")
  .digest("hex");

function authorizationContractManifest() {
  const toc = analyzeAuthorizationToc(AUTHORIZATION_TOC);
  return {
    schema_version: 2,
    canonicalization: "postgresql-17-acl-json-array-hex-v2",
    fingerprint_sha256: "1".repeat(64),
    record_count: 500,
    grant_tuple_count: 420,
    required_roles: ["anon", "authenticated", "postgres", "service_role"],
    required_roles_sha256:
      "e98e2327a4ff9c027369a56bd63609b349edd5628d2a21d5cad9eecbcc7d0226",
    role_fingerprint_sha256: "c".repeat(64),
    role_record_count: 5,
    database_container_fingerprint_sha256: "d".repeat(64),
    database_container_record_count: 11,
    required_extensions: REQUIRED_EXTENSIONS,
    required_extensions_sha256: REQUIRED_EXTENSIONS_SHA256,
    extension_fingerprint_sha256: "e".repeat(64),
    extension_record_count: 84,
    core_table_app_grant_tuple_count: 120,
    restricted_security_definer_function_count: 12,
    archive_acl_toc_entry_count: toc.aclEntryCount,
    archive_default_acl_toc_entry_count: toc.defaultAclEntryCount,
    archive_acl_toc_sha256: toc.sha256,
  };
}

function hash(content) {
  return createHash("sha256").update(content).digest("hex");
}

async function writeExecutable(path, lines) {
  await writeFile(path, `${lines.join("\n")}\n`);
  await chmod(path, 0o755);
}

async function readPrivateRegularFile(path, encoding) {
  const handle = await open(
    path,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
  );
  try {
    const metadata = await handle.stat();
    assert.equal(metadata.isFile(), true);
    assert.equal(metadata.mode & 0o777, 0o600);
    assert.equal(metadata.nlink, 1);
    return {
      content: await handle.readFile({ encoding }),
      metadata,
    };
  } finally {
    await handle.close();
  }
}

test("checksum parser accepts standard sha256sum format", () => {
  const parsed = parseChecksumLine(
    "a".repeat(64) + "  fanmind-database-1.dump.age\n",
  );
  assert.equal(parsed.sha256, "a".repeat(64));
  assert.equal(parsed.fileName, "fanmind-database-1.dump.age");
});

test("archive entry guard rejects absolute paths and traversal", () => {
  assert.equal(assertSafeArchiveEntry("./manifest.json"), true);
  assert.equal(assertSafeArchiveEntry("storage/avatar.png"), true);
  assert.throws(() => assertSafeArchiveEntry("../../etc/passwd"), /unsafe_archive_entry/);
  assert.throws(() => assertSafeArchiveEntry("/etc/passwd"), /unsafe_archive_entry/);
  assert.throws(() => assertSafeArchiveEntry("folder\\evil"), /unsafe_archive_entry/);
});

test("backup type detection recognizes all supported artifacts", () => {
  assert.equal(detectBackupType("fanmind-database-1.dump.age"), "database");
  assert.equal(detectBackupType("fanmind-storage-1.tar.gz.age"), "storage");
  assert.equal(
    detectBackupType("fanmind-server-config-1.tar.gz.age"),
    "server_config",
  );
  assert.equal(detectBackupType("fanmind-full-1.tar.gz.age"), "full");
  assert.throws(() => detectBackupType("random.age"), /unknown_backup_type/);
});

test("checksum verification is read-only and catches mismatches", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-verifier-test-"));
  try {
    const artifact = join(root, "fanmind-database-1.dump.age");
    const content = Buffer.from("encrypted-test-artifact");
    await writeFile(artifact, content);
    await writeFile(
      `${artifact}.sha256`,
      `${hash(content)}  ${basename(artifact)}\n`,
    );
    const before = await readFile(artifact);
    const result = await verifyChecksumPair(artifact);
    const after = await readFile(artifact);
    assert.equal(result.checksum, hash(content));
    assert.deepEqual(after, before);

    await writeFile(`${artifact}.sha256`, `${"0".repeat(64)}  ${basename(artifact)}\n`);
    await assert.rejects(() => verifyChecksumPair(artifact), /checksum_mismatch/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("storage manifest validates object count, size and hashes", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-manifest-test-"));
  try {
    await mkdir(join(root, "avatars"), { recursive: true });
    const content = Buffer.from("avatar-content");
    await writeFile(join(root, "avatars", "one.png"), content);
    const manifest = {
      bucket: "fanmind-assets",
      listed_object_count: 1,
      downloaded_object_count: 1,
      object_count: 1,
      total_size_bytes: content.length,
      files: [
        {
          path: "avatars/one.png",
          size: content.length,
          sha256: hash(content),
        },
      ],
    };
    const result = await verifyStorageManifest(root, manifest);
    assert.deepEqual(result, {
      objectCount: 1,
      totalSizeBytes: content.length,
    });

    manifest.files[0].sha256 = "0".repeat(64);
    await assert.rejects(
      () => verifyStorageManifest(root, manifest),
      /storage_file_checksum_mismatch/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("full manifest requires exactly one valid encrypted part of each backup type", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-full-manifest-test-"));
  try {
    const definitions = [
      ["server_config", "fanmind-server-config-1.tar.gz.age"],
      ["database", "fanmind-database-1.dump.age"],
      ["storage", "fanmind-storage-1.tar.gz.age"],
    ];
    const parts = [];
    for (const [backupType, file] of definitions) {
      const artifact = join(root, file);
      const content = Buffer.from(`encrypted-${backupType}`);
      const digest = hash(content);
      await writeFile(artifact, content);
      await writeFile(`${artifact}.sha256`, `${digest}  ${file}\n`);
      parts.push({
        file,
        checksum_file: `${file}.sha256`,
        sha256: digest,
        size_bytes: content.length,
        manifest: { backup_type: backupType },
      });
    }
    const result = await verifyFullManifest(root, {
      production_commit: "a".repeat(40),
      parts,
    });
    assert.equal(result.partCount, 3);
    assert.deepEqual(result.partTypes, ["database", "server_config", "storage"]);

    parts.push({ ...parts[0] });
    await assert.rejects(
      () =>
        verifyFullManifest(root, {
          production_commit: "a".repeat(40),
          parts,
        }),
      /full_manifest_part_count_mismatch/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("sha256 helper returns the exact file digest", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-sha-test-"));
  try {
    const file = join(root, "value.bin");
    const content = Buffer.from("known-value");
    await writeFile(file, content);
    assert.equal(await sha256File(file), hash(content));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("content verification snapshots only a private regular age identity", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-identity-test-"));
  try {
    const artifact = join(
      root,
      "fanmind-database-1785398400000.dump.age",
    );
    const encrypted = Buffer.from("synthetic-encrypted-database");
    await writeFile(artifact, encrypted);
    await writeFile(
      `${artifact}.sha256`,
      `${hash(encrypted)}  ${basename(artifact)}\n`,
    );

    const permissiveIdentity = join(root, "permissive.agekey");
    await writeFile(permissiveIdentity, "synthetic-identity", { mode: 0o644 });
    await assert.rejects(
      verifyBackupArtifact({
        artifactPath: artifact,
        identityPath: permissiveIdentity,
      }),
      /identity_file_permissions_invalid/u,
    );

    const privateIdentity = join(root, "private.agekey");
    const linkedIdentity = join(root, "linked.agekey");
    await writeFile(privateIdentity, "synthetic-identity", { mode: 0o600 });
    await symlink(privateIdentity, linkedIdentity);
    await assert.rejects(
      verifyBackupArtifact({
        artifactPath: artifact,
        identityPath: linkedIdentity,
      }),
      /identity_file_not_private_regular/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("full verification creates an exact private dump and cryptographic receipt", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-full-receipt-test-"));
  try {
    const fullRoot = join(root, "full");
    await mkdir(fullRoot, { mode: 0o700 });
    const databaseClear = "synthetic-database-dump";
    const definitions = [
      ["server_config", "fanmind-server-config-1785398300000.tar.gz.age", "server"],
      ["database", "fanmind-database-1785398301000.dump.age", "database-encrypted"],
      ["storage", "fanmind-storage-1785398302000.tar.gz.age", "storage"],
    ];
    const parts = [];
    for (const [backupType, file, content] of definitions) {
      const encrypted = Buffer.from(content);
      const digest = hash(encrypted);
      await writeFile(join(fullRoot, file), encrypted);
      await writeFile(
        join(fullRoot, `${file}.sha256`),
        `${digest}  ${file}\n`,
      );
      parts.push({
        file,
        checksum_file: `${file}.sha256`,
        sha256: digest,
        size_bytes: encrypted.length,
        manifest:
          backupType === "database"
            ? {
                backup_type: backupType,
                format_version: 2,
                privileges_archived: true,
                ownership_archived: true,
                authorization_contract: authorizationContractManifest(),
              }
            : { backup_type: backupType },
      });
    }
    await writeFile(
      join(fullRoot, "manifest.json"),
      `${JSON.stringify({
        production_commit: "b".repeat(40),
        parts,
      })}\n`,
    );

    const artifact = join(
      root,
      "fanmind-full-1785398400000.tar.gz.age",
    );
    const clearFullArchive = `${artifact}.clear`;
    await execFileAsync("tar", [
      "-czf",
      clearFullArchive,
      "-C",
      fullRoot,
      ".",
    ]);
    const outerEncrypted = Buffer.from("synthetic-outer-encrypted-backup");
    await writeFile(artifact, outerEncrypted);
    await writeFile(
      `${artifact}.sha256`,
      `${hash(outerEncrypted)}  ${basename(artifact)}\n`,
    );

    const identityPath = join(root, "identity.agekey");
    const fakeAgePath = join(root, "fake-age.sh");
    const fakePgRestorePath = join(root, "fake-pg-restore.sh");
    const outerInputCapturePath = join(root, "outer-input.txt");
    const dumpOutputPath = join(root, "verified-database.dump");
    const receiptOutputPath = join(root, "full-backup-receipt.json");
    await writeFile(identityPath, "synthetic-test-identity", { mode: 0o600 });
    await writeExecutable(fakeAgePath, [
      "#!/usr/bin/env bash",
      "set -Eeuo pipefail",
      "output=''",
      "input=''",
      "while [[ \"$#\" -gt 0 ]]; do",
      "  case \"$1\" in",
      "    --decrypt) shift ;;",
      "    --identity) shift 2 ;;",
      "    --output) output=\"$2\"; shift 2 ;;",
      "    *) input=\"$1\"; shift ;;",
      "  esac",
      "done",
      "case \"$(basename -- \"$input\")\" in",
      `  fanmind-full-*) printf '%s' "$input" > '${outerInputCapturePath}'; cp -- '${clearFullArchive}' "$output" ;;`,
      `  fanmind-database-*) printf '%s' '${databaseClear}' > "$output" ;;`,
      "  *) exit 9 ;;",
      "esac",
      "chmod 0600 \"$output\"",
    ]);
    await writeExecutable(fakePgRestorePath, [
      "#!/usr/bin/env bash",
      "set -Eeuo pipefail",
      "[[ \"${1:-}\" == \"--list\" ]]",
      "[[ -s \"${2:-}\" ]]",
      "cat <<'FANMIND_AUTHORIZATION_TOC'",
      ...AUTHORIZATION_TOC.trimEnd().split("\n"),
      "FANMIND_AUTHORIZATION_TOC",
    ]);

    const result = await verifyBackupArtifact({
      artifactPath: artifact,
      identityPath,
      ageBin: fakeAgePath,
      pgRestoreBin: fakePgRestorePath,
      restoreDumpOutputPath: dumpOutputPath,
      restoreReceiptOutputPath: receiptOutputPath,
    });
    assert.equal(result.contentValidation.restoreDump, "created");
    assert.equal(result.contentValidation.restoreReceipt, "created");
    const snapshottedOuterInput = await readFile(outerInputCapturePath, "utf8");
    assert.notEqual(snapshottedOuterInput, artifact);
    assert.match(
      snapshottedOuterInput,
      /fanmind-backup-verify-[^/]+\/fanmind-full-1785398400000\.tar\.gz\.age$/u,
    );
    const [dumpFile, receiptFile] = await Promise.all([
      readPrivateRegularFile(dumpOutputPath, "utf8"),
      readPrivateRegularFile(receiptOutputPath, "utf8"),
    ]);
    assert.equal(dumpFile.content, databaseClear);

    const receipt = JSON.parse(receiptFile.content);
    assert.deepEqual(Object.keys(receipt), [
      "schemaVersion",
      "createdAt",
      "sourceArtifactBasename",
      "outerSha256",
      "productionCommit",
      "databasePartEncryptedSha256",
      "databaseDumpSha256",
      "databaseAuthorizationContractVersion",
      "databaseAuthorizationFingerprintSha256",
      "databaseAuthorizationRecordCount",
      "databaseAuthorizationGrantTupleCount",
      "databaseAuthorizationRequiredRoles",
      "databaseAuthorizationRequiredRolesSha256",
      "databaseAuthorizationRoleFingerprintSha256",
      "databaseAuthorizationRoleRecordCount",
      "databaseAuthorizationContainerFingerprintSha256",
      "databaseAuthorizationContainerRecordCount",
      "databaseAuthorizationRequiredExtensions",
      "databaseAuthorizationRequiredExtensionsSha256",
      "databaseAuthorizationExtensionFingerprintSha256",
      "databaseAuthorizationExtensionRecordCount",
      "databaseCoreTableAppGrantTupleCount",
      "databaseRestrictedSecurityDefinerFunctionCount",
      "databaseAclTocEntryCount",
      "databaseDefaultAclTocEntryCount",
      "databaseAclTocSha256",
      "databasePrivilegesArchived",
      "databaseOwnershipArchived",
      "verifier",
    ]);
    assert.equal(receipt.schemaVersion, 2);
    assert.equal(receipt.sourceArtifactBasename, basename(artifact));
    assert.equal(receipt.outerSha256, hash(outerEncrypted));
    assert.equal(receipt.productionCommit, "b".repeat(40));
    assert.equal(
      receipt.databasePartEncryptedSha256,
      parts.find((part) => part.manifest.backup_type === "database").sha256,
    );
    assert.equal(receipt.databaseDumpSha256, hash(databaseClear));
    assert.equal(receipt.databaseAuthorizationContractVersion, 2);
    assert.equal(
      receipt.databaseAuthorizationFingerprintSha256,
      "1".repeat(64),
    );
    assert.equal(receipt.databaseAuthorizationRecordCount, 500);
    assert.equal(receipt.databaseAuthorizationGrantTupleCount, 420);
    assert.deepEqual(receipt.databaseAuthorizationRequiredRoles, [
      "anon",
      "authenticated",
      "postgres",
      "service_role",
    ]);
    assert.equal(
      receipt.databaseAuthorizationRequiredRolesSha256,
      "e98e2327a4ff9c027369a56bd63609b349edd5628d2a21d5cad9eecbcc7d0226",
    );
    assert.equal(
      receipt.databaseAuthorizationRoleFingerprintSha256,
      "c".repeat(64),
    );
    assert.equal(receipt.databaseAuthorizationRoleRecordCount, 5);
    assert.equal(
      receipt.databaseAuthorizationContainerFingerprintSha256,
      "d".repeat(64),
    );
    assert.equal(receipt.databaseAuthorizationContainerRecordCount, 11);
    assert.deepEqual(
      receipt.databaseAuthorizationRequiredExtensions,
      REQUIRED_EXTENSIONS,
    );
    assert.equal(
      receipt.databaseAuthorizationRequiredExtensionsSha256,
      REQUIRED_EXTENSIONS_SHA256,
    );
    assert.equal(
      receipt.databaseAuthorizationExtensionFingerprintSha256,
      "e".repeat(64),
    );
    assert.equal(receipt.databaseAuthorizationExtensionRecordCount, 84);
    assert.equal(receipt.databaseCoreTableAppGrantTupleCount, 120);
    assert.equal(receipt.databaseRestrictedSecurityDefinerFunctionCount, 12);
    assert.equal(receipt.databaseAclTocEntryCount, 1);
    assert.equal(receipt.databaseDefaultAclTocEntryCount, 1);
    assert.equal(
      receipt.databaseAclTocSha256,
      analyzeAuthorizationToc(AUTHORIZATION_TOC).sha256,
    );
    assert.equal(receipt.databasePrivilegesArchived, true);
    assert.equal(receipt.databaseOwnershipArchived, true);
    await verifyFullBackupRestoreReceipt({
      receiptPath: receiptOutputPath,
      dumpPath: dumpOutputPath,
      expectedProductionCommit: "b".repeat(40),
    });

    await assert.rejects(
      verifyBackupArtifact({
        artifactPath: artifact,
        identityPath,
        ageBin: fakeAgePath,
        pgRestoreBin: fakePgRestorePath,
        restoreDumpOutputPath: dumpOutputPath,
        restoreReceiptOutputPath: receiptOutputPath,
      }),
      /restore_output_already_exists/u,
    );

    const databasePart = parts.find(
      (part) => part.manifest.backup_type === "database",
    );
    databasePart.manifest.authorization_contract.unexpected = true;
    await writeFile(
      join(fullRoot, "manifest.json"),
      `${JSON.stringify({
        production_commit: "b".repeat(40),
        parts,
      })}\n`,
    );
    await execFileAsync("tar", [
      "-czf",
      clearFullArchive,
      "-C",
      fullRoot,
      ".",
    ]);
    const unexpectedDumpOutputPath = join(root, "unexpected-database.dump");
    const unexpectedReceiptOutputPath = join(root, "unexpected-receipt.json");
    await assert.rejects(
      verifyBackupArtifact({
        artifactPath: artifact,
        identityPath,
        ageBin: fakeAgePath,
        pgRestoreBin: fakePgRestorePath,
        restoreDumpOutputPath: unexpectedDumpOutputPath,
        restoreReceiptOutputPath: unexpectedReceiptOutputPath,
      }),
      /restore_database_authorization_contract_invalid/u,
    );
    await assert.rejects(readFile(unexpectedDumpOutputPath), /ENOENT/u);
    await assert.rejects(readFile(unexpectedReceiptOutputPath), /ENOENT/u);

    delete databasePart.manifest.authorization_contract.unexpected;
    const roleFingerprint =
      databasePart.manifest.authorization_contract.role_fingerprint_sha256;
    delete databasePart.manifest.authorization_contract.role_fingerprint_sha256;
    await writeFile(
      join(fullRoot, "manifest.json"),
      `${JSON.stringify({
        production_commit: "b".repeat(40),
        parts,
      })}\n`,
    );
    await execFileAsync("tar", [
      "-czf",
      clearFullArchive,
      "-C",
      fullRoot,
      ".",
    ]);
    const missingRoleDumpOutputPath = join(
      root,
      "missing-role-database.dump",
    );
    const missingRoleReceiptOutputPath = join(
      root,
      "missing-role-receipt.json",
    );
    await assert.rejects(
      verifyBackupArtifact({
        artifactPath: artifact,
        identityPath,
        ageBin: fakeAgePath,
        pgRestoreBin: fakePgRestorePath,
        restoreDumpOutputPath: missingRoleDumpOutputPath,
        restoreReceiptOutputPath: missingRoleReceiptOutputPath,
      }),
      /restore_database_authorization_contract_invalid/u,
    );
    await assert.rejects(readFile(missingRoleDumpOutputPath), /ENOENT/u);
    await assert.rejects(readFile(missingRoleReceiptOutputPath), /ENOENT/u);

    databasePart.manifest.authorization_contract.role_fingerprint_sha256 =
      roleFingerprint;
    databasePart.manifest.authorization_contract.role_record_count = 0;
    await writeFile(
      join(fullRoot, "manifest.json"),
      `${JSON.stringify({
        production_commit: "b".repeat(40),
        parts,
      })}\n`,
    );
    await execFileAsync("tar", [
      "-czf",
      clearFullArchive,
      "-C",
      fullRoot,
      ".",
    ]);
    const invalidRoleCountDumpOutputPath = join(
      root,
      "invalid-role-count-database.dump",
    );
    const invalidRoleCountReceiptOutputPath = join(
      root,
      "invalid-role-count-receipt.json",
    );
    await assert.rejects(
      verifyBackupArtifact({
        artifactPath: artifact,
        identityPath,
        ageBin: fakeAgePath,
        pgRestoreBin: fakePgRestorePath,
        restoreDumpOutputPath: invalidRoleCountDumpOutputPath,
        restoreReceiptOutputPath: invalidRoleCountReceiptOutputPath,
      }),
      /restore_database_authorization_contract_invalid/u,
    );
    await assert.rejects(readFile(invalidRoleCountDumpOutputPath), /ENOENT/u);
    await assert.rejects(
      readFile(invalidRoleCountReceiptOutputPath),
      /ENOENT/u,
    );

    databasePart.manifest.authorization_contract.role_record_count = 5;
    databasePart.manifest.authorization_contract.archive_acl_toc_entry_count = 2;
    await writeFile(
      join(fullRoot, "manifest.json"),
      `${JSON.stringify({
        production_commit: "b".repeat(40),
        parts,
      })}\n`,
    );
    await execFileAsync("tar", [
      "-czf",
      clearFullArchive,
      "-C",
      fullRoot,
      ".",
    ]);
    const mismatchDumpOutputPath = join(root, "mismatch-database.dump");
    const mismatchReceiptOutputPath = join(root, "mismatch-receipt.json");
    await assert.rejects(
      verifyBackupArtifact({
        artifactPath: artifact,
        identityPath,
        ageBin: fakeAgePath,
        pgRestoreBin: fakePgRestorePath,
        restoreDumpOutputPath: mismatchDumpOutputPath,
        restoreReceiptOutputPath: mismatchReceiptOutputPath,
      }),
      /restore_database_authorization_toc_mismatch/u,
    );
    await assert.rejects(readFile(mismatchDumpOutputPath), /ENOENT/u);
    await assert.rejects(readFile(mismatchReceiptOutputPath), /ENOENT/u);

    databasePart.manifest = { backup_type: "database", format_version: 1 };
    await writeFile(
      join(fullRoot, "manifest.json"),
      `${JSON.stringify({
        production_commit: "b".repeat(40),
        parts,
      })}\n`,
    );
    await execFileAsync("tar", [
      "-czf",
      clearFullArchive,
      "-C",
      fullRoot,
      ".",
    ]);
    const legacyDumpOutputPath = join(root, "legacy-database.dump");
    const legacyReceiptOutputPath = join(root, "legacy-receipt.json");
    await assert.rejects(
      verifyBackupArtifact({
        artifactPath: artifact,
        identityPath,
        ageBin: fakeAgePath,
        pgRestoreBin: fakePgRestorePath,
        restoreDumpOutputPath: legacyDumpOutputPath,
        restoreReceiptOutputPath: legacyReceiptOutputPath,
      }),
      /restore_database_manifest_version_invalid/u,
    );
    await assert.rejects(readFile(legacyDumpOutputPath), /ENOENT/u);
    await assert.rejects(readFile(legacyReceiptOutputPath), /ENOENT/u);
    const legacyChecksumOnly = await verifyBackupArtifact({ artifactPath: artifact });
    assert.equal(legacyChecksumOnly.ok, true);
    assert.equal(legacyChecksumOnly.mode, "checksum_only");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("content verification rejects symbolic-link archive members before extraction", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-archive-type-test-"));
  try {
    const archiveRoot = join(root, "archive");
    await mkdir(archiveRoot, { mode: 0o700 });
    await writeFile(join(archiveRoot, "regular.txt"), "safe");
    await symlink("regular.txt", join(archiveRoot, "linked.txt"));
    const artifact = join(
      root,
      "fanmind-server-config-1785398400000.tar.gz.age",
    );
    await execFileAsync("tar", [
      "-czf",
      `${artifact}.clear`,
      "-C",
      archiveRoot,
      ".",
    ]);
    const encrypted = Buffer.from("synthetic-encrypted-config");
    await writeFile(artifact, encrypted);
    await writeFile(
      `${artifact}.sha256`,
      `${hash(encrypted)}  ${basename(artifact)}\n`,
    );
    const identityPath = join(root, "identity.agekey");
    const fakeAgePath = join(root, "fake-age.sh");
    await writeFile(identityPath, "synthetic-test-identity", { mode: 0o600 });
    await writeExecutable(fakeAgePath, [
      "#!/usr/bin/env bash",
      "set -Eeuo pipefail",
      "output=''",
      "input=''",
      "while [[ \"$#\" -gt 0 ]]; do",
      "  case \"$1\" in",
      "    --decrypt) shift ;;",
      "    --identity) shift 2 ;;",
      "    --output) output=\"$2\"; shift 2 ;;",
      "    *) input=\"$1\"; shift ;;",
      "  esac",
      "done",
      `cp -- '${artifact}.clear' "$output"`,
    ]);

    await assert.rejects(
      verifyBackupArtifact({
        artifactPath: artifact,
        identityPath,
        ageBin: fakeAgePath,
      }),
      /unsafe_archive_entry_type/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
