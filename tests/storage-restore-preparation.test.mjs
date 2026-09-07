import assert from "node:assert/strict";
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
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  verifyBackupArtifact,
  verifyStorageManifest,
} from "../scripts/operations/verify-backup-artifact.mjs";
import {
  parseStorageRestoreReceipt,
  verifyStorageRestoreReceipt,
} from "../scripts/operations/verify-full-backup-storage-restore-receipt.mjs";

const execFileAsync = promisify(execFile);

function hash(content) {
  return createHash("sha256").update(content).digest("hex");
}

async function writeExecutable(path, lines) {
  await writeFile(path, `${lines.join("\n")}\n`, { mode: 0o700 });
}

async function assertPrivateFile(path) {
  const handle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  try {
    const metadata = await handle.stat();
    assert.equal(metadata.isFile(), true);
    assert.equal(metadata.nlink, 1);
    assert.equal(metadata.mode & 0o777, 0o600);
  } finally {
    await handle.close();
  }
}

async function storageFixture(root, { unexpectedFile = false } = {}) {
  const storageRoot = join(root, "storage-clear");
  await mkdir(join(storageRoot, "avatars"), { recursive: true, mode: 0o700 });
  const objectBytes = Buffer.from("verified-avatar-bytes");
  await writeFile(join(storageRoot, "avatars", "one.png"), objectBytes, {
    mode: 0o600,
  });
  if (unexpectedFile) {
    await writeFile(join(storageRoot, "unlisted.txt"), "must-fail", {
      mode: 0o600,
    });
  }
  const storageManifest = {
    bucket: "fanmind-assets",
    listed_object_count: 1,
    downloaded_object_count: 1,
    object_count: 1,
    total_size_bytes: objectBytes.length,
    files: [
      {
        path: "avatars/one.png",
        size: objectBytes.length,
        sha256: hash(objectBytes),
      },
    ],
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(storageManifest)}\n`);
  await writeFile(join(storageRoot, "manifest.json"), manifestBytes, {
    mode: 0o600,
  });
  const clearStorageArchive = join(root, "storage-clear.tar.gz");
  await execFileAsync("tar", ["-czf", clearStorageArchive, "-C", storageRoot, "."]);

  const fullRoot = join(root, "full-clear");
  await mkdir(fullRoot, { mode: 0o700 });
  const definitions = [
    ["database", "fanmind-database-1785398301000.dump.age", "encrypted-db"],
    ["storage", "fanmind-storage-1785398302000.tar.gz.age", "encrypted-storage"],
    ["server_config", "fanmind-server-config-1785398303000.tar.gz.age", "encrypted-config"],
  ];
  const parts = [];
  for (const [backupType, file, content] of definitions) {
    const bytes = Buffer.from(content);
    await writeFile(join(fullRoot, file), bytes, { mode: 0o600 });
    await writeFile(
      join(fullRoot, `${file}.sha256`),
      `${hash(bytes)}  ${file}\n`,
      { mode: 0o600 },
    );
    parts.push({
      file,
      checksum_file: `${file}.sha256`,
      sha256: hash(bytes),
      size_bytes: bytes.length,
      manifest: { backup_type: backupType },
    });
  }
  const productionCommit = "b".repeat(40);
  await writeFile(
    join(fullRoot, "manifest.json"),
    `${JSON.stringify({ production_commit: productionCommit, parts })}\n`,
    { mode: 0o600 },
  );
  const clearFullArchive = join(root, "full-clear.tar.gz");
  await execFileAsync("tar", ["-czf", clearFullArchive, "-C", fullRoot, "."]);

  const artifact = join(root, "fanmind-full-1785398400000.tar.gz.age");
  const encryptedOuter = Buffer.from("encrypted-full");
  await writeFile(artifact, encryptedOuter, { mode: 0o600 });
  await writeFile(
    `${artifact}.sha256`,
    `${hash(encryptedOuter)}  ${basename(artifact)}\n`,
    { mode: 0o600 },
  );
  const identityPath = join(root, "identity.agekey");
  await writeFile(identityPath, "synthetic-identity", { mode: 0o600 });
  const fakeAgePath = join(root, "fake-age.sh");
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
    `  fanmind-full-*) cp -- '${clearFullArchive}' "$output" ;;`,
    `  fanmind-storage-*) cp -- '${clearStorageArchive}' "$output" ;;`,
    "  *) exit 9 ;;",
    "esac",
    "chmod 0600 \"$output\"",
  ]);
  return {
    artifact,
    encryptedOuter,
    identityPath,
    fakeAgePath,
    clearStorageArchive,
    manifestBytes,
    parts,
    productionCommit,
  };
}

test("storage manifest rejects files that are absent from the manifest", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-path-set-test-"));
  try {
    const objectBytes = Buffer.from("listed");
    await writeFile(join(root, "listed.txt"), objectBytes);
    await writeFile(join(root, "unlisted.txt"), "unexpected");
    await assert.rejects(
      verifyStorageManifest(root, {
        bucket: "fanmind-assets",
        listed_object_count: 1,
        downloaded_object_count: 1,
        object_count: 1,
        total_size_bytes: objectBytes.length,
        files: [{
          path: "listed.txt",
          size: objectBytes.length,
          sha256: hash(objectBytes),
        }],
      }),
      /storage_archive_path_set_mismatch/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("full verification prepares a private exact Storage archive and receipt", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-prepare-test-"));
  try {
    await chmod(root, 0o700);
    const fixture = await storageFixture(root);
    const archiveOutputPath = join(root, "verified-storage.tar.gz");
    const receiptOutputPath = join(root, "verified-storage-receipt.json");
    const result = await verifyBackupArtifact({
      artifactPath: fixture.artifact,
      identityPath: fixture.identityPath,
      ageBin: fixture.fakeAgePath,
      restoreStorageArchiveOutputPath: archiveOutputPath,
      restoreStorageReceiptOutputPath: receiptOutputPath,
    });
    assert.equal(result.contentValidation.storageRestoreArchive, "created");
    assert.equal(result.contentValidation.storageRestoreReceipt, "created");
    await Promise.all([
      assertPrivateFile(archiveOutputPath),
      assertPrivateFile(receiptOutputPath),
    ]);
    assert.deepEqual(
      await readFile(archiveOutputPath),
      await readFile(fixture.clearStorageArchive),
    );
    const receiptBytes = await readFile(receiptOutputPath);
    const receipt = parseStorageRestoreReceipt(receiptBytes);
    const storagePart = fixture.parts.find(
      (part) => part.manifest.backup_type === "storage",
    );
    assert.equal(receipt.sourceArtifactBasename, basename(fixture.artifact));
    assert.equal(receipt.outerSha256, hash(fixture.encryptedOuter));
    assert.equal(receipt.productionCommit, fixture.productionCommit);
    assert.equal(receipt.storagePartEncryptedSha256, storagePart.sha256);
    assert.equal(receipt.storageArchiveSha256, hash(await readFile(archiveOutputPath)));
    assert.equal(receipt.storageManifestSha256, hash(fixture.manifestBytes));
    assert.equal(receipt.storageBucket, "fanmind-assets");
    assert.equal(receipt.storageObjectCount, 1);
    assert.equal(receipt.storageTotalSizeBytes, "verified-avatar-bytes".length);
    assert.equal(receipt.verifier, "passed");

    const verified = await verifyStorageRestoreReceipt({
      receiptPath: receiptOutputPath,
      archivePath: archiveOutputPath,
      expectedSourceArtifactBasename: basename(fixture.artifact),
      expectedOuterSha256: hash(fixture.encryptedOuter),
      expectedProductionCommit: fixture.productionCommit,
      expectedStoragePartEncryptedSha256: storagePart.sha256,
    });
    assert.equal(verified.storageArchiveSha256, receipt.storageArchiveSha256);

    await assert.rejects(
      verifyStorageRestoreReceipt({
        receiptPath: receiptOutputPath,
        archivePath: archiveOutputPath,
        expectedSourceArtifactBasename: basename(fixture.artifact),
        expectedOuterSha256: "0".repeat(64),
        expectedProductionCommit: fixture.productionCommit,
        expectedStoragePartEncryptedSha256: storagePart.sha256,
      }),
      /storage_receipt_expected_binding_mismatch/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Storage preparation fails closed on an unlisted archive object", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-extra-test-"));
  try {
    await chmod(root, 0o700);
    const fixture = await storageFixture(root, { unexpectedFile: true });
    const archiveOutputPath = join(root, "must-not-exist.tar.gz");
    const receiptOutputPath = join(root, "must-not-exist.json");
    await assert.rejects(
      verifyBackupArtifact({
        artifactPath: fixture.artifact,
        identityPath: fixture.identityPath,
        ageBin: fixture.fakeAgePath,
        restoreStorageArchiveOutputPath: archiveOutputPath,
        restoreStorageReceiptOutputPath: receiptOutputPath,
      }),
      /storage_archive_path_set_mismatch/u,
    );
    await assert.rejects(readFile(archiveOutputPath), /ENOENT/u);
    await assert.rejects(readFile(receiptOutputPath), /ENOENT/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Storage outputs must be paired and cannot mix with database outputs", async () => {
  await assert.rejects(
    verifyBackupArtifact({
      artifactPath: "/does/not/exist/fanmind-full-1785398400000.tar.gz.age",
      restoreStorageArchiveOutputPath: "/tmp/storage.tar.gz",
    }),
    /restore_storage_outputs_must_be_paired/u,
  );
  await assert.rejects(
    verifyBackupArtifact({
      artifactPath: "/does/not/exist/fanmind-full-1785398400000.tar.gz.age",
      restoreDumpOutputPath: "/tmp/database.dump",
      restoreReceiptOutputPath: "/tmp/database.json",
      restoreStorageArchiveOutputPath: "/tmp/storage.tar.gz",
      restoreStorageReceiptOutputPath: "/tmp/storage.json",
    }),
    /restore_output_modes_must_not_mix/u,
  );
});

test("content verification rejects duplicate tar members", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-duplicate-tar-test-"));
  try {
    const archiveRoot = join(root, "archive");
    await mkdir(archiveRoot, { mode: 0o700 });
    await writeFile(join(archiveRoot, "config.txt"), "fixed", { mode: 0o600 });
    const plainTar = join(root, "duplicate.tar");
    await execFileAsync("tar", ["-cf", plainTar, "-C", archiveRoot, "config.txt"]);
    await execFileAsync("tar", ["-rf", plainTar, "-C", archiveRoot, "config.txt"]);
    await execFileAsync("gzip", [plainTar]);
    const clearArchive = `${plainTar}.gz`;
    const artifact = join(
      root,
      "fanmind-server-config-1785398400000.tar.gz.age",
    );
    const encrypted = Buffer.from("encrypted-config");
    await writeFile(artifact, encrypted, { mode: 0o600 });
    await writeFile(
      `${artifact}.sha256`,
      `${hash(encrypted)}  ${basename(artifact)}\n`,
      { mode: 0o600 },
    );
    const identityPath = join(root, "identity.agekey");
    await writeFile(identityPath, "synthetic-identity", { mode: 0o600 });
    const fakeAgePath = join(root, "fake-age.sh");
    await writeExecutable(fakeAgePath, [
      "#!/usr/bin/env bash",
      "set -Eeuo pipefail",
      "output=''",
      "while [[ \"$#\" -gt 0 ]]; do",
      "  case \"$1\" in",
      "    --decrypt) shift ;;",
      "    --identity) shift 2 ;;",
      "    --output) output=\"$2\"; shift 2 ;;",
      "    *) shift ;;",
      "  esac",
      "done",
      `cp -- '${clearArchive}' "$output"`,
      "chmod 0600 \"$output\"",
    ]);
    await assert.rejects(
      verifyBackupArtifact({
        artifactPath: artifact,
        identityPath,
        ageBin: fakeAgePath,
      }),
      /duplicate_archive_entry/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
