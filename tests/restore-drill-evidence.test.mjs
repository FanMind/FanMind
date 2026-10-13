import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  chmod,
  mkdtemp,
  open,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const execFileWithInput = (file, args, options, input) =>
  new Promise((resolve, reject) => {
    const child = execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
    child.stdin.end(input);
  });
const verifierPath = "scripts/operations/verify-restore-drill-evidence.mjs";
const receiptVerifierPath =
  "scripts/operations/verify-full-backup-restore-receipt.mjs";
const receiptWriterPath =
  "scripts/operations/restore-runner-receipt.mjs";
const databasePostcheckWriterPath =
  "scripts/operations/restore-database-postcheck-receipt.mjs";
const runbookPath = "docs/operations/RESTORE_DRILL.md";

const sha = (value) =>
  createHash("sha256").update(value).digest("hex");
const AUTHORIZATION_FINGERPRINT = "e".repeat(64);
const AUTHORIZATION_RECORD_COUNT = 256;
const AUTHORIZATION_GRANT_TUPLE_COUNT = 512;
const AUTHORIZATION_REQUIRED_ROLES = [
  "anon",
  "authenticated",
  "postgres",
  "service_role",
];
const AUTHORIZATION_REQUIRED_ROLES_SHA256 = sha(
  JSON.stringify(AUTHORIZATION_REQUIRED_ROLES),
);
const AUTHORIZATION_ROLE_FINGERPRINT = "c".repeat(64);
const AUTHORIZATION_ROLE_RECORD_COUNT = 5;
const AUTHORIZATION_CONTAINER_FINGERPRINT = "7".repeat(64);
const AUTHORIZATION_CONTAINER_RECORD_COUNT = 11;
const AUTHORIZATION_REQUIRED_EXTENSIONS = [
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
const AUTHORIZATION_REQUIRED_EXTENSIONS_SHA256 = sha(
  JSON.stringify(AUTHORIZATION_REQUIRED_EXTENSIONS),
);
const AUTHORIZATION_EXTENSION_FINGERPRINT = "8".repeat(64);
const AUTHORIZATION_EXTENSION_RECORD_COUNT = 84;
const CORE_TABLE_APP_GRANT_TUPLE_COUNT = 120;
const RESTRICTED_SECURITY_DEFINER_FUNCTION_COUNT = 12;

function fullReceipt(overrides = {}) {
  return {
    schemaVersion: 2,
    createdAt: "2026-07-30T07:55:00Z",
    sourceArtifactBasename: "fanmind-full-1785398400000.tar.gz.age",
    outerSha256: "a".repeat(64),
    productionCommit: "b".repeat(40),
    databasePartEncryptedSha256: "d".repeat(64),
    databaseDumpSha256: sha("synthetic-database-dump"),
    databaseAuthorizationContractVersion: 2,
    databaseAuthorizationFingerprintSha256: AUTHORIZATION_FINGERPRINT,
    databaseAuthorizationRecordCount: AUTHORIZATION_RECORD_COUNT,
    databaseAuthorizationGrantTupleCount:
      AUTHORIZATION_GRANT_TUPLE_COUNT,
    databaseAuthorizationRequiredRoles: AUTHORIZATION_REQUIRED_ROLES,
    databaseAuthorizationRequiredRolesSha256:
      AUTHORIZATION_REQUIRED_ROLES_SHA256,
    databaseAuthorizationRoleFingerprintSha256:
      AUTHORIZATION_ROLE_FINGERPRINT,
    databaseAuthorizationRoleRecordCount:
      AUTHORIZATION_ROLE_RECORD_COUNT,
    databaseAuthorizationContainerFingerprintSha256:
      AUTHORIZATION_CONTAINER_FINGERPRINT,
    databaseAuthorizationContainerRecordCount:
      AUTHORIZATION_CONTAINER_RECORD_COUNT,
    databaseAuthorizationRequiredExtensions:
      AUTHORIZATION_REQUIRED_EXTENSIONS,
    databaseAuthorizationRequiredExtensionsSha256:
      AUTHORIZATION_REQUIRED_EXTENSIONS_SHA256,
    databaseAuthorizationExtensionFingerprintSha256:
      AUTHORIZATION_EXTENSION_FINGERPRINT,
    databaseAuthorizationExtensionRecordCount:
      AUTHORIZATION_EXTENSION_RECORD_COUNT,
    databaseCoreTableAppGrantTupleCount:
      CORE_TABLE_APP_GRANT_TUPLE_COUNT,
    databaseRestrictedSecurityDefinerFunctionCount:
      RESTRICTED_SECURITY_DEFINER_FUNCTION_COUNT,
    databaseAclTocEntryCount: 31,
    databaseDefaultAclTocEntryCount: 6,
    databaseAclTocSha256: "f".repeat(64),
    databasePrivilegesArchived: true,
    databaseOwnershipArchived: true,
    verifier: "passed",
    ...overrides,
  };
}

function runnerReceipt(fullBytes, targetId, overrides = {}) {
  const full = JSON.parse(fullBytes);
  return {
    schemaVersion: 2,
    drillId: "2026-07-30-restore-001",
    startedAt: "2026-07-30T08:00:00Z",
    completedAt: "2026-07-30T08:20:00Z",
    sourceArtifactBasename: full.sourceArtifactBasename,
    outerSha256: full.outerSha256,
    productionCommit: full.productionCommit,
    fullBackupReceiptSha256: sha(fullBytes),
    databasePartEncryptedSha256:
      full.databasePartEncryptedSha256,
    databaseDumpSha256: full.databaseDumpSha256,
    databaseAuthorizationContractVersion:
      full.databaseAuthorizationContractVersion,
    databaseAuthorizationFingerprintSha256:
      full.databaseAuthorizationFingerprintSha256,
    databaseAuthorizationRecordCount:
      full.databaseAuthorizationRecordCount,
    databaseAuthorizationGrantTupleCount:
      full.databaseAuthorizationGrantTupleCount,
    databaseAuthorizationRequiredRolesSha256:
      full.databaseAuthorizationRequiredRolesSha256,
    databaseAuthorizationRoleFingerprintSha256:
      full.databaseAuthorizationRoleFingerprintSha256,
    databaseAuthorizationRoleRecordCount:
      full.databaseAuthorizationRoleRecordCount,
    databaseAuthorizationContainerFingerprintSha256:
      full.databaseAuthorizationContainerFingerprintSha256,
    databaseAuthorizationContainerRecordCount:
      full.databaseAuthorizationContainerRecordCount,
    databaseAuthorizationRequiredExtensionsSha256:
      full.databaseAuthorizationRequiredExtensionsSha256,
    databaseAuthorizationRequiredExtensionCount:
      full.databaseAuthorizationRequiredExtensions.length,
    databaseAuthorizationExtensionFingerprintSha256:
      full.databaseAuthorizationExtensionFingerprintSha256,
    databaseAuthorizationExtensionRecordCount:
      full.databaseAuthorizationExtensionRecordCount,
    databaseCoreTableAppGrantTupleCount:
      full.databaseCoreTableAppGrantTupleCount,
    databaseRestrictedSecurityDefinerFunctionCount:
      full.databaseRestrictedSecurityDefinerFunctionCount,
    disposableTargetId: targetId,
    emptyTargetObservedAt: "2026-07-30T08:02:00Z",
    emptyTargetObjectCount: 0,
    databaseRestore: "passed",
    singleTransaction: true,
    databasePrivilegesRestore: "passed",
    databaseOwnershipRestore: "passed",
    ...overrides,
  };
}

function databasePostcheckReceipt(runnerBytes, targetId, overrides = {}) {
  const runner = JSON.parse(runnerBytes);
  return {
    schemaVersion: 2,
    drillId: runner.drillId,
    checkedAt: "2026-07-30T08:25:00Z",
    productionCommit: runner.productionCommit,
    disposableTargetId: targetId,
    restoreRunnerReceiptSha256: sha(runnerBytes),
    requiredTableCount: 5,
    existingTableCount: 5,
    rlsEnabledTableCount: 5,
    policyCoveredTableCount: 5,
    databasePostcheck: "passed",
    databaseAuthorizationFingerprintSha256:
      runner.databaseAuthorizationFingerprintSha256,
    databaseAuthorizationRecordCount:
      runner.databaseAuthorizationRecordCount,
    databaseAuthorizationGrantTupleCount:
      runner.databaseAuthorizationGrantTupleCount,
    databaseAuthorizationRoleFingerprintSha256:
      runner.databaseAuthorizationRoleFingerprintSha256,
    databaseAuthorizationRoleRecordCount:
      runner.databaseAuthorizationRoleRecordCount,
    databaseAuthorizationContainerFingerprintSha256:
      runner.databaseAuthorizationContainerFingerprintSha256,
    databaseAuthorizationContainerRecordCount:
      runner.databaseAuthorizationContainerRecordCount,
    databaseAuthorizationRequiredExtensionsSha256:
      runner.databaseAuthorizationRequiredExtensionsSha256,
    databaseAuthorizationRequiredExtensionCount:
      runner.databaseAuthorizationRequiredExtensionCount,
    databaseAuthorizationExtensionFingerprintSha256:
      runner.databaseAuthorizationExtensionFingerprintSha256,
    databaseAuthorizationExtensionRecordCount:
      runner.databaseAuthorizationExtensionRecordCount,
    databaseCoreTableAppGrantTupleCount:
      runner.databaseCoreTableAppGrantTupleCount,
    databaseRestrictedSecurityDefinerFunctionCount:
      runner.databaseRestrictedSecurityDefinerFunctionCount,
    databaseAuthorizationPostcheck: "passed",
    coreTableAppPrivileges: "passed",
    securityDefinerExecutionBoundary: "passed",
    ...overrides,
  };
}

function evidence(
  fullBytes,
  runnerBytes,
  postcheckBytes,
  targetId,
  overrides = {},
) {
  const full = JSON.parse(fullBytes);
  return {
    schemaVersion: 6,
    drillId: "2026-07-30-restore-001",
    startedAt: "2026-07-30T08:00:00Z",
    completedAt: "2026-07-30T08:30:00Z",
    environment: "staging",
    sourceArtifactBasename: full.sourceArtifactBasename,
    outerSha256: full.outerSha256,
    productionCommit: full.productionCommit,
    fullBackupReceiptSha256: sha(fullBytes),
    restoreRunnerReceiptSha256: sha(runnerBytes),
    databasePostcheckReceiptSha256: sha(postcheckBytes),
    databasePartEncryptedSha256:
      full.databasePartEncryptedSha256,
    databaseDumpSha256: full.databaseDumpSha256,
    databaseAuthorizationFingerprintSha256:
      full.databaseAuthorizationFingerprintSha256,
    databaseAuthorizationRecordCount:
      full.databaseAuthorizationRecordCount,
    databaseAuthorizationGrantTupleCount:
      full.databaseAuthorizationGrantTupleCount,
    databaseAuthorizationRequiredRolesSha256:
      full.databaseAuthorizationRequiredRolesSha256,
    databaseAuthorizationRoleFingerprintSha256:
      full.databaseAuthorizationRoleFingerprintSha256,
    databaseAuthorizationRoleRecordCount:
      full.databaseAuthorizationRoleRecordCount,
    databaseAuthorizationContainerFingerprintSha256:
      full.databaseAuthorizationContainerFingerprintSha256,
    databaseAuthorizationContainerRecordCount:
      full.databaseAuthorizationContainerRecordCount,
    databaseAuthorizationRequiredExtensionsSha256:
      full.databaseAuthorizationRequiredExtensionsSha256,
    databaseAuthorizationRequiredExtensionCount:
      full.databaseAuthorizationRequiredExtensions.length,
    databaseAuthorizationExtensionFingerprintSha256:
      full.databaseAuthorizationExtensionFingerprintSha256,
    databaseAuthorizationExtensionRecordCount:
      full.databaseAuthorizationExtensionRecordCount,
    databaseCoreTableAppGrantTupleCount:
      full.databaseCoreTableAppGrantTupleCount,
    databaseRestrictedSecurityDefinerFunctionCount:
      full.databaseRestrictedSecurityDefinerFunctionCount,
    disposableTargetId: targetId,
    verifier: "passed",
    storageSample: "passed",
    serverConfigInspection: "passed",
    cleanup: "passed",
    databasePrivilegesRestore: "passed",
    databaseOwnershipRestore: "passed",
    databaseAuthorizationPostcheck: "passed",
    coreTableAppPrivileges: "passed",
    securityDefinerExecutionBoundary: "passed",
    productionModified: false,
    customerDataRecordedInEvidence: false,
    secretsRecorded: false,
    issues: [],
    ...overrides,
  };
}

async function privateFile(path, content) {
  await writeFile(path, content, { mode: 0o600 });
  await chmod(path, 0o600);
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

async function withReceiptSet(callback, restrictedCount = 12) {
  const root = await mkdtemp(join(tmpdir(), "fanmind-restore-evidence-"));
  try {
    await chmod(root, 0o700);
    const targetId = randomUUID();
    const fullBytes = `${JSON.stringify(fullReceipt({databaseRestrictedSecurityDefinerFunctionCount:restrictedCount}))}\n`;
    const runnerBytes = `${JSON.stringify(
      runnerReceipt(fullBytes, targetId),
    )}\n`;
    const postcheckBytes = `${JSON.stringify(
      databasePostcheckReceipt(runnerBytes, targetId),
    )}\n`;
    const evidenceBytes = `${JSON.stringify(
      evidence(fullBytes, runnerBytes, postcheckBytes, targetId),
    )}\n`;
    const paths = {
      root,
      full: join(root, "full-receipt.json"),
      runner: join(root, "runner-receipt.json"),
      postcheck: join(root, "database-postcheck-receipt.json"),
      evidence: join(root, "evidence.json"),
      dump: join(root, "database.dump"),
    };
    await Promise.all([
      privateFile(paths.full, fullBytes),
      privateFile(paths.runner, runnerBytes),
      privateFile(paths.postcheck, postcheckBytes),
      privateFile(paths.evidence, evidenceBytes),
      privateFile(paths.dump, "synthetic-database-dump"),
    ]);
    return await callback({
      paths,
      targetId,
      fullBytes,
      runnerBytes,
      postcheckBytes,
      evidenceBytes,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function verifierArguments(paths) {
  return [
    verifierPath,
    "--input",
    paths.evidence,
    "--full-receipt",
    paths.full,
    "--runner-receipt",
    paths.runner,
    "--database-postcheck-receipt",
    paths.postcheck,
  ];
}

test("full-backup receipt binds the exact private database dump", async () => {
  await withReceiptSet(async ({ paths }) => {
    const { stdout, stderr } = await execFileAsync(process.execPath, [
      receiptVerifierPath,
      "--receipt",
      paths.full,
      "--dump",
      paths.dump,
    ]);
    const output = `${stdout}\n${stderr}`;
    assert.match(output, /FULL_BACKUP_RESTORE_RECEIPT=PASS/u);
    assert.doesNotMatch(output, /fanmind-full|a{20}|b{20}|d{20}/u);

    await privateFile(paths.dump, "different-database-dump");
    await assert.rejects(
      execFileAsync(process.execPath, [
        receiptVerifierPath,
        "--receipt",
        paths.full,
        "--dump",
        paths.dump,
      ]),
      (error) => {
        const failed = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
        assert.match(failed, /database_dump_sha_mismatch/u);
        assert.doesNotMatch(failed, /different-database-dump/u);
        return true;
      },
    );
  });
});

test("full-backup receipt requires the exact authorization contract", async () => {
  const cases = [
    [
      { schemaVersion: 1 },
      "receipt_schema_invalid",
    ],
    [
      { databaseAuthorizationContractVersion: 1 },
      "receipt_authorization_contract_invalid",
    ],
    [
      {
        databaseAuthorizationRequiredRoles: [
          "authenticated",
          "anon",
          "postgres",
          "service_role",
        ],
      },
      "receipt_authorization_roles_invalid",
    ],
    [
      { databaseAuthorizationRequiredRolesSha256: "0".repeat(64) },
      "receipt_authorization_roles_sha_invalid",
    ],
    [
      { databaseAuthorizationRoleFingerprintSha256: "not-a-sha256" },
      "receipt_authorization_role_fingerprint_invalid",
    ],
    [
      { databaseAuthorizationRoleRecordCount: 0 },
      "receipt_authorization_role_count_invalid",
    ],
    [
      { databaseAuthorizationContainerFingerprintSha256: "not-a-sha256" },
      "receipt_authorization_container_fingerprint_invalid",
    ],
    [
      { databaseAuthorizationContainerRecordCount: 0 },
      "receipt_authorization_container_count_invalid",
    ],
    [
      {
        databaseAuthorizationRequiredExtensions:
          AUTHORIZATION_REQUIRED_EXTENSIONS.map((extension, index) =>
            index === 0 ? { ...extension, owner: "attacker" } : extension,
          ),
      },
      "receipt_authorization_extension_contract_invalid",
    ],
    [
      { databaseAuthorizationExtensionFingerprintSha256: "not-a-sha256" },
      "receipt_authorization_extension_contract_invalid",
    ],
    [
      { databaseAuthorizationExtensionRecordCount: 0 },
      "receipt_authorization_extension_contract_invalid",
    ],
    [
      { databaseDefaultAclTocEntryCount: 0 },
      "receipt_acl_toc_counts_invalid",
    ],
    [
      { databasePrivilegesArchived: false },
      "receipt_database_authorization_archive_invalid",
    ],
  ];
  for (const [overrides, code] of cases) {
    await withReceiptSet(async ({ paths }) => {
      await privateFile(
        paths.full,
        `${JSON.stringify(fullReceipt(overrides))}\n`,
      );
      await assert.rejects(
        execFileAsync(process.execPath, [
          receiptVerifierPath,
          "--receipt",
          paths.full,
          "--dump",
          paths.dump,
        ]),
        new RegExp(code, "u"),
      );
    });
  }
});

test("atomic writer creates one exact private runner receipt", async () => {
  await withReceiptSet(async ({ paths, targetId, fullBytes }) => {
    const outputPath = join(paths.root, "new-runner-receipt.json");
    const environment = {
      ...process.env,
      FANMIND_RESTORE_DRILL_ID: "2026-07-30-restore-001",
      FANMIND_RESTORE_DISPOSABLE_TARGET_ID: targetId,
      FANMIND_RESTORE_PRODUCTION_COMMIT: "b".repeat(40),
      FANMIND_RESTORE_STARTED_AT: "2026-07-30T08:00:00Z",
      FANMIND_RESTORE_EMPTY_TARGET_OBSERVED_AT:
        "2026-07-30T08:02:00Z",
      FANMIND_RESTORE_COMPLETED_AT: "2026-07-30T08:20:00Z",
      FANMIND_RESTORE_EMPTY_TARGET_OBJECT_COUNT: "0",
    };
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        receiptWriterPath,
        "--full-receipt",
        paths.full,
        "--dump",
        paths.dump,
        "--output",
        outputPath,
      ],
      { env: environment },
    );
    assert.match(stdout, /RESTORE_RUNNER_RECEIPT=PASS/u);
    const output = await readPrivateRegularFile(outputPath, "utf8");
    const record = JSON.parse(output.content);
    assert.equal(record.fullBackupReceiptSha256, sha(fullBytes));
    assert.equal(record.emptyTargetObjectCount, 0);
    assert.equal(record.singleTransaction, true);
    assert.equal(record.schemaVersion, 2);
    assert.equal(
      record.databaseAuthorizationFingerprintSha256,
      AUTHORIZATION_FINGERPRINT,
    );
    assert.equal(
      record.databaseAuthorizationRequiredRolesSha256,
      AUTHORIZATION_REQUIRED_ROLES_SHA256,
    );
    assert.equal(
      record.databaseAuthorizationRoleFingerprintSha256,
      AUTHORIZATION_ROLE_FINGERPRINT,
    );
    assert.equal(
      record.databaseAuthorizationRoleRecordCount,
      AUTHORIZATION_ROLE_RECORD_COUNT,
    );
    assert.equal(
      record.databaseAuthorizationContainerFingerprintSha256,
      AUTHORIZATION_CONTAINER_FINGERPRINT,
    );
    assert.equal(
      record.databaseAuthorizationContainerRecordCount,
      AUTHORIZATION_CONTAINER_RECORD_COUNT,
    );
    assert.equal(record.databasePrivilegesRestore, "passed");
    assert.equal(record.databaseOwnershipRestore, "passed");

    await assert.rejects(
      execFileAsync(
        process.execPath,
        [
          receiptWriterPath,
          "--full-receipt",
          paths.full,
          "--dump",
          paths.dump,
          "--output",
          outputPath,
        ],
        { env: environment },
      ),
      /output_already_exists/u,
    );
  });
});

test("database postcheck writer requires five tables with RLS and policies", async () => {
  await withReceiptSet(async ({ paths, targetId, runnerBytes }) => {
    const outputPath = join(paths.root, "new-database-postcheck-receipt.json");
    const validPostcheck = [
      "contacts|1|1|4",
      "followups|1|1|3",
      "memories|1|1|3",
      "workspace_members|1|1|2",
      "workspaces|1|1|2",
      `authorization|${AUTHORIZATION_FINGERPRINT}|${AUTHORIZATION_RECORD_COUNT}|${AUTHORIZATION_GRANT_TUPLE_COUNT}|${CORE_TABLE_APP_GRANT_TUPLE_COUNT}|${RESTRICTED_SECURITY_DEFINER_FUNCTION_COUNT}|${AUTHORIZATION_REQUIRED_EXTENSIONS_SHA256}|${AUTHORIZATION_REQUIRED_EXTENSIONS.length}|${AUTHORIZATION_EXTENSION_FINGERPRINT}|${AUTHORIZATION_EXTENSION_RECORD_COUNT}`,
      "",
    ].join("\n");
    const environment = {
      ...process.env,
      FANMIND_RESTORE_DRILL_ID: "2026-07-30-restore-001",
      FANMIND_RESTORE_DISPOSABLE_TARGET_ID: targetId,
      FANMIND_RESTORE_PRODUCTION_COMMIT: "b".repeat(40),
      FANMIND_RESTORE_POSTCHECKED_AT: "2026-07-30T08:25:00Z",
    };
    const { stdout } = await execFileWithInput(
      process.execPath,
      [
        databasePostcheckWriterPath,
        "--runner-receipt",
        paths.runner,
        "--output",
        outputPath,
      ],
      { env: environment },
      validPostcheck,
    );
    assert.match(stdout, /RESTORE_DATABASE_POSTCHECK_RECEIPT=PASS/u);
    const output = await readPrivateRegularFile(outputPath, "utf8");
    const record = JSON.parse(output.content);
    assert.equal(record.restoreRunnerReceiptSha256, sha(runnerBytes));
    assert.equal(record.existingTableCount, 5);
    assert.equal(record.rlsEnabledTableCount, 5);
    assert.equal(record.policyCoveredTableCount, 5);
    assert.equal(
      record.databaseAuthorizationFingerprintSha256,
      AUTHORIZATION_FINGERPRINT,
    );
    assert.equal(
      record.databaseAuthorizationRoleFingerprintSha256,
      AUTHORIZATION_ROLE_FINGERPRINT,
    );
    assert.equal(
      record.databaseAuthorizationRoleRecordCount,
      AUTHORIZATION_ROLE_RECORD_COUNT,
    );
    assert.equal(
      record.databaseAuthorizationContainerFingerprintSha256,
      AUTHORIZATION_CONTAINER_FINGERPRINT,
    );
    assert.equal(
      record.databaseAuthorizationContainerRecordCount,
      AUTHORIZATION_CONTAINER_RECORD_COUNT,
    );
    assert.equal(record.databaseAuthorizationPostcheck, "passed");
    assert.equal(record.coreTableAppPrivileges, "passed");
    assert.equal(record.securityDefinerExecutionBoundary, "passed");

    for (const [line, code] of [
      ["contacts|0|0|0", "postcheck_table_missing"],
      ["contacts|1|0|4", "postcheck_rls_disabled"],
      ["contacts|1|1|0", "postcheck_policy_missing"],
    ]) {
      const invalidOutput = join(paths.root, `${code}.json`);
      await assert.rejects(
        execFileWithInput(
          process.execPath,
          [
            databasePostcheckWriterPath,
            "--runner-receipt",
            paths.runner,
            "--output",
            invalidOutput,
          ],
          { env: environment },
          validPostcheck.replace("contacts|1|1|4", line),
        ),
        new RegExp(code, "u"),
      );
    }

    const authorizationMismatchOutput = join(
      paths.root,
      "authorization-mismatch.json",
    );
    await assert.rejects(
      execFileWithInput(
        process.execPath,
        [
          databasePostcheckWriterPath,
          "--runner-receipt",
          paths.runner,
          "--output",
          authorizationMismatchOutput,
        ],
        { env: environment },
        validPostcheck.replace(
          AUTHORIZATION_FINGERPRINT,
          "0".repeat(64),
        ),
      ),
      /postcheck_authorization_mismatch/u,
    );
  });
});

test("valid schema v6 binds all receipts without echoing identifiers", async () => {
  await withReceiptSet(async ({ paths, evidenceBytes }) => {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      verifierArguments(paths),
    );
    const output = `${stdout}\n${stderr}`;
    assert.match(output, /RESTORE_EVIDENCE_SCHEMA=valid/u);
    assert.match(output, /RESTORE_EVIDENCE_SECRETS_RECORDED=false/u);
    assert.match(output, /RESTORE_EVIDENCE_PRODUCTION_MODIFIED=false/u);
    assert.match(output, /RESTORE_DRILL_EVIDENCE=PASS/u);
    assert.match(
      output,
      new RegExp(`RESTORE_EVIDENCE_SHA256=${sha(evidenceBytes)}`, "u"),
    );
    assert.doesNotMatch(
      output,
      /fanmind-full|restore-001|a{20}|b{20}|d{20}/u,
    );
  });
});

test("runner and database postcheck receipts are mandatory at the evidence CLI boundary", async () => {
  await withReceiptSet(async ({ paths }) => {
    await assert.rejects(
      execFileAsync(process.execPath, [
        verifierPath,
        "--input",
        paths.evidence,
        "--full-receipt",
        paths.full,
      ]),
      (error) => {
        assert.match(
          `${error.stdout ?? ""}\n${error.stderr ?? ""}`,
          /RESTORE_EVIDENCE_ERROR=usage_invalid/u,
        );
        return true;
      },
    );
  });
});

test("schema v5 and manual database assertions fail closed", async () => {
  await withReceiptSet(
    async ({ paths, fullBytes, runnerBytes, postcheckBytes, targetId }) => {
      await privateFile(
        paths.evidence,
        `${JSON.stringify(
          evidence(fullBytes, runnerBytes, postcheckBytes, targetId, {
            schemaVersion: 5,
          }),
        )}\n`,
      );
      await assert.rejects(
        execFileAsync(process.execPath, verifierArguments(paths)),
        /evidence_schema_invalid/u,
      );

      const manual = evidence(
        fullBytes,
        runnerBytes,
        postcheckBytes,
        targetId,
      );
      manual.databaseRestore = "passed";
      manual.coreSchemaChecks = "passed";
      manual.rlsVerification = "passed";
      await privateFile(paths.evidence, `${JSON.stringify(manual)}\n`);
      await assert.rejects(
        execFileAsync(process.execPath, verifierArguments(paths)),
        /evidence_keys_invalid/u,
      );
    },
  );
});

test("runner receipt SHA, IDs, backup hashes and timestamp envelope are bound", async () => {
  const cases = [
    ["restoreRunnerReceiptSha256", "0".repeat(64), "runner_receipt_sha_mismatch"],
    ["drillId", "2026-07-30-other-001", "runner_identity_binding_mismatch"],
    ["databaseDumpSha256", "0".repeat(64), "receipt_binding_database_dump_sha256_mismatch"],
    [
      "databaseAuthorizationFingerprintSha256",
      "0".repeat(64),
      "receipt_binding_database_authorization_fingerprint_sha256_mismatch",
    ],
    [
      "databaseAuthorizationRequiredRolesSha256",
      "0".repeat(64),
      "receipt_binding_database_authorization_required_roles_sha256_mismatch",
    ],
    [
      "databaseAuthorizationRoleFingerprintSha256",
      "0".repeat(64),
      "receipt_binding_database_authorization_role_fingerprint_sha256_mismatch",
    ],
    [
      "databaseAuthorizationRoleRecordCount",
      AUTHORIZATION_ROLE_RECORD_COUNT + 1,
      "receipt_binding_database_authorization_role_record_count_mismatch",
    ],
    [
      "databaseAuthorizationContainerFingerprintSha256",
      "0".repeat(64),
      "receipt_binding_database_authorization_container_fingerprint_sha256_mismatch",
    ],
    [
      "databaseAuthorizationContainerRecordCount",
      AUTHORIZATION_CONTAINER_RECORD_COUNT + 1,
      "receipt_binding_database_authorization_container_record_count_mismatch",
    ],
    [
      "databaseAuthorizationGrantTupleCount",
      AUTHORIZATION_GRANT_TUPLE_COUNT + 1,
      "receipt_binding_database_authorization_grant_tuple_count_mismatch",
    ],
    ["startedAt", "2026-07-30T08:05:00Z", "runner_timestamp_envelope_mismatch"],
  ];
  for (const [field, value, code] of cases) {
    await withReceiptSet(
      async ({ paths, fullBytes, runnerBytes, postcheckBytes, targetId }) => {
        await privateFile(
          paths.evidence,
          `${JSON.stringify(
            evidence(fullBytes, runnerBytes, postcheckBytes, targetId, {
              [field]: value,
            }),
          )}\n`,
        );
        await assert.rejects(
          execFileAsync(process.execPath, verifierArguments(paths)),
          new RegExp(code, "u"),
        );
      },
    );
  }
});

test("database postcheck hash, identity, counts and timestamps are bound", async () => {
  const cases = [
    [
      "restoreRunnerReceiptSha256",
      "0".repeat(64),
      "database_postcheck_runner_sha_mismatch",
    ],
    [
      "disposableTargetId",
      "223e4567-e89b-42d3-a456-426614174000",
      "database_postcheck_identity_binding_mismatch",
    ],
    [
      "policyCoveredTableCount",
      4,
      "database_postcheck_receipt_policy_covered_table_count_invalid",
    ],
    [
      "checkedAt",
      "2026-07-30T08:19:00Z",
      "database_postcheck_timestamp_envelope_mismatch",
    ],
    [
      "databaseAuthorizationFingerprintSha256",
      "0".repeat(64),
      "database_postcheck_authorization_database_authorization_fingerprint_sha256_mismatch",
    ],
    [
      "databaseAuthorizationRecordCount",
      AUTHORIZATION_RECORD_COUNT + 1,
      "database_postcheck_authorization_database_authorization_record_count_mismatch",
    ],
    [
      "databaseAuthorizationRoleFingerprintSha256",
      "0".repeat(64),
      "database_postcheck_authorization_database_authorization_role_fingerprint_sha256_mismatch",
    ],
    [
      "databaseAuthorizationRoleRecordCount",
      AUTHORIZATION_ROLE_RECORD_COUNT + 1,
      "database_postcheck_authorization_database_authorization_role_record_count_mismatch",
    ],
    [
      "databaseAuthorizationContainerFingerprintSha256",
      "0".repeat(64),
      "database_postcheck_authorization_database_authorization_container_fingerprint_sha256_mismatch",
    ],
    [
      "databaseAuthorizationContainerRecordCount",
      AUTHORIZATION_CONTAINER_RECORD_COUNT + 1,
      "database_postcheck_authorization_database_authorization_container_record_count_mismatch",
    ],
    [
      "databaseAuthorizationPostcheck",
      "failed",
      "database_postcheck_receipt_database_authorization_postcheck_not_passed",
    ],
  ];
  for (const [field, value, code] of cases) {
    await withReceiptSet(
      async ({ paths, fullBytes, runnerBytes, targetId }) => {
        const badPostcheckBytes = `${JSON.stringify(
          databasePostcheckReceipt(runnerBytes, targetId, {
            [field]: value,
          }),
        )}\n`;
        await privateFile(paths.postcheck, badPostcheckBytes);
        await privateFile(
          paths.evidence,
          `${JSON.stringify(
            evidence(fullBytes, runnerBytes, badPostcheckBytes, targetId),
          )}\n`,
        );
        await assert.rejects(
          execFileAsync(process.execPath, verifierArguments(paths)),
          new RegExp(code, "u"),
        );
      },
    );
  }

  await withReceiptSet(
    async ({ paths, fullBytes, runnerBytes, postcheckBytes, targetId }) => {
      await privateFile(
        paths.evidence,
        `${JSON.stringify(
          evidence(fullBytes, runnerBytes, postcheckBytes, targetId, {
            databasePostcheckReceiptSha256: "0".repeat(64),
          }),
        )}\n`,
      );
      await assert.rejects(
        execFileAsync(process.execPath, verifierArguments(paths)),
        /database_postcheck_receipt_sha_mismatch/u,
      );
    },
  );
});

test("nonzero empty target and non-transactional restore receipts fail", async () => {
  for (const [field, value, code] of [
    ["emptyTargetObjectCount", 1, "runner_receipt_target_not_empty"],
    ["singleTransaction", false, "runner_receipt_transaction_invalid"],
    ["databaseRestore", "failed", "runner_receipt_restore_not_passed"],
    [
      "databasePrivilegesRestore",
      "failed",
      "runner_receipt_privileges_restore_not_passed",
    ],
    [
      "databaseOwnershipRestore",
      "failed",
      "runner_receipt_ownership_restore_not_passed",
    ],
  ]) {
    await withReceiptSet(
      async ({ paths, fullBytes, targetId, runnerBytes, postcheckBytes }) => {
        const badRunnerBytes = `${JSON.stringify(
          runnerReceipt(fullBytes, targetId, { [field]: value }),
        )}\n`;
        await privateFile(paths.runner, badRunnerBytes);
        await privateFile(
          paths.evidence,
          `${JSON.stringify(
            evidence(fullBytes, badRunnerBytes, postcheckBytes, targetId, {
              restoreRunnerReceiptSha256: sha(badRunnerBytes),
            }),
          )}\n`,
        );
        await assert.rejects(
          execFileAsync(process.execPath, verifierArguments(paths)),
          new RegExp(code, "u"),
        );
        assert.notEqual(sha(runnerBytes), sha(badRunnerBytes));
      },
    );
  }
});

test("duplicate and unexpected receipt or evidence members stay redacted", async () => {
  await withReceiptSet(
    async ({ paths, fullBytes, runnerBytes, postcheckBytes, targetId }) => {
      const secret = "never-print-this-secret-value";
      await privateFile(
        paths.evidence,
        `{"schemaVersion":6,"schemaVersion":6,"secret":"${secret}"}\n`,
      );
      await assert.rejects(
        execFileAsync(process.execPath, verifierArguments(paths)),
        (error) => {
          const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
          assert.match(output, /evidence_duplicate_member/u);
          assert.doesNotMatch(output, new RegExp(secret, "u"));
          return true;
        },
      );

      await privateFile(
        paths.evidence,
        `${JSON.stringify({
          ...evidence(
            fullBytes,
            runnerBytes,
            postcheckBytes,
            targetId,
          ),
          databasePassword: secret,
        })}\n`,
      );
      await assert.rejects(
        execFileAsync(process.execPath, verifierArguments(paths)),
        (error) => {
          const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
          assert.match(output, /evidence_keys_invalid/u);
          assert.doesNotMatch(output, new RegExp(secret, "u"));
          return true;
        },
      );
    },
  );
});

test("evidence and all three receipts require private regular files", async () => {
  await withReceiptSet(async ({ paths }) => {
    await chmod(paths.evidence, 0o644);
    await assert.rejects(
      execFileAsync(process.execPath, verifierArguments(paths)),
      /evidence_permissions_invalid/u,
    );
    await chmod(paths.evidence, 0o600);

    await chmod(paths.postcheck, 0o644);
    await assert.rejects(
      execFileAsync(process.execPath, verifierArguments(paths)),
      /database_postcheck_receipt_permissions_invalid/u,
    );
    await chmod(paths.postcheck, 0o600);

    const target = join(paths.root, "full-target.json");
    await privateFile(target, await readFile(paths.full));
    await rm(paths.full);
    await symlink(target, paths.full);
    await assert.rejects(
      execFileAsync(process.execPath, verifierArguments(paths)),
      /full_backup_receipt_not_regular/u,
    );
  });
});

test("restore runbook requires receipt-bound schema v6 evidence", async () => {
  const source = await readFile(runbookPath, "utf8");
  assert.match(source, /schemaVersion.*6/su);
  assert.match(source, /restoreRunnerReceiptSha256/u);
  assert.match(source, /databasePostcheckReceiptSha256/u);
  assert.match(source, /database-postcheck-receipt/u);
  assert.match(source, /fullBackupReceiptSha256/u);
  assert.match(source, /RESTORE_EVIDENCE_SHA256/u);
  assert.match(source, /coreSchemaChecks.*(?:manuell|manually)/su);
  assert.match(source, /rlsVerification.*(?:manuell|manually)/su);
});

for(const count of [12,13])test(`reviewed ${count} contract survives the full private receipt chain`,async()=>{
 await withReceiptSet(async({paths})=>{
  const full=await execFileAsync(process.execPath,[receiptVerifierPath,'--receipt',paths.full,'--dump',paths.dump]);assert.match(full.stdout,/FULL_BACKUP_RESTORE_RECEIPT=PASS/u);
  const aggregate=await execFileAsync(process.execPath,verifierArguments(paths));assert.match(aggregate.stdout,/RESTORE_DRILL_EVIDENCE=PASS/u);
 },count);
});
test('reviewed counts must match across full, runner, postcheck and aggregate receipts',async()=>{
 for(const other of [12,14,0,null,'13'])await withReceiptSet(async({paths,fullBytes,runnerBytes,targetId})=>{
  const changed=JSON.parse(runnerBytes);changed.databaseRestrictedSecurityDefinerFunctionCount=other;const rb=`${JSON.stringify(changed)}\n`;
  await privateFile(paths.runner,rb);await privateFile(paths.postcheck,`${JSON.stringify(databasePostcheckReceipt(rb,targetId))}\n`);
  const pb=await readFile(paths.postcheck,'utf8');await privateFile(paths.evidence,`${JSON.stringify(evidence(fullBytes,rb,pb,targetId))}\n`);
  await assert.rejects(execFileAsync(process.execPath,verifierArguments(paths)));
 },13);
 for(const target of ['postcheck','evidence'])await withReceiptSet(async({paths})=>{
  const value=JSON.parse(await readFile(paths[target],'utf8'));value.databaseRestrictedSecurityDefinerFunctionCount=12;await privateFile(paths[target],`${JSON.stringify(value)}\n`);
  await assert.rejects(execFileAsync(process.execPath,verifierArguments(paths)));
 },13);
});
