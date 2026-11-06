#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, open, realpath, unlink } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import {
  readStablePrivateFile,
  sha256Bytes,
} from "./verify-full-backup-restore-receipt.mjs";

const MAX_POSTCHECK_BYTES = 4 * 1024;
const DRILL_ID = /^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]{0,47}$/u;
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const CORE_TABLE_APP_GRANT_TUPLE_COUNT = 120;
const RESTRICTED_SECURITY_DEFINER_FUNCTION_COUNTS = new Set([12, 13]);
const REQUIRED_TABLES = [
  "contacts",
  "followups",
  "memories",
  "workspace_members",
  "workspaces",
];
const RUNNER_KEYS = [
  "schemaVersion",
  "drillId",
  "startedAt",
  "completedAt",
  "sourceArtifactBasename",
  "outerSha256",
  "productionCommit",
  "fullBackupReceiptSha256",
  "databasePartEncryptedSha256",
  "databaseDumpSha256",
  "databaseAuthorizationContractVersion",
  "databaseAuthorizationFingerprintSha256",
  "databaseAuthorizationRecordCount",
  "databaseAuthorizationGrantTupleCount",
  "databaseAuthorizationRequiredRolesSha256",
  "databaseAuthorizationRoleFingerprintSha256",
  "databaseAuthorizationRoleRecordCount",
  "databaseAuthorizationContainerFingerprintSha256",
  "databaseAuthorizationContainerRecordCount",
  "databaseAuthorizationRequiredExtensionsSha256",
  "databaseAuthorizationRequiredExtensionCount",
  "databaseAuthorizationExtensionFingerprintSha256",
  "databaseAuthorizationExtensionRecordCount",
  "databaseCoreTableAppGrantTupleCount",
  "databaseRestrictedSecurityDefinerFunctionCount",
  "disposableTargetId",
  "emptyTargetObservedAt",
  "emptyTargetObjectCount",
  "databaseRestore",
  "singleTransaction",
  "databasePrivilegesRestore",
  "databaseOwnershipRestore",
].sort();

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function exactKeys(record, expected, label) {
  const keys = Object.keys(record).sort();
  if (
    keys.length !== expected.length ||
    keys.some((key, index) => key !== expected[index])
  ) {
    fail(`${label}_keys_invalid`);
  }
}

function assertNoDuplicateMembers(text) {
  const seen = new Set();
  const member = /"((?:\\.|[^"\\])*)"\s*:/gu;
  for (const match of text.matchAll(member)) {
    let key;
    try {
      key = JSON.parse(`"${match[1]}"`);
    } catch {
      fail("runner_receipt_json_invalid");
    }
    if (seen.has(key)) fail("runner_receipt_duplicate_member");
    seen.add(key);
  }
}

function isIsoUtc(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(value)
  ) {
    return false;
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return false;
  const normalized = value.includes(".")
    ? value.replace(/\.(\d{1,3})Z$/u, (_, digits) =>
        `.${digits.padEnd(3, "0")}Z`,
      )
    : value.replace(/Z$/u, ".000Z");
  return new Date(timestamp).toISOString() === normalized;
}

function parseRunnerReceipt(bytes) {
  let receipt;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    assertNoDuplicateMembers(text);
    receipt = JSON.parse(text);
  } catch (error) {
    if (error?.code) throw error;
    fail("runner_receipt_json_invalid");
  }
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    fail("runner_receipt_record_invalid");
  }
  exactKeys(receipt, RUNNER_KEYS, "runner_receipt");
  if (receipt.schemaVersion !== 2) fail("runner_receipt_schema_invalid");
  if (!DRILL_ID.test(receipt.drillId)) fail("runner_receipt_drill_id_invalid");
  if (!UUID_V4.test(receipt.disposableTargetId)) {
    fail("runner_receipt_target_id_invalid");
  }
  if (!COMMIT.test(receipt.productionCommit)) {
    fail("runner_receipt_commit_invalid");
  }
  if (
    !isIsoUtc(receipt.startedAt) ||
    !isIsoUtc(receipt.completedAt) ||
    !isIsoUtc(receipt.emptyTargetObservedAt)
  ) {
    fail("runner_receipt_timestamp_invalid");
  }
  if (
    Date.parse(receipt.emptyTargetObservedAt) < Date.parse(receipt.startedAt) ||
    Date.parse(receipt.completedAt) < Date.parse(receipt.emptyTargetObservedAt)
  ) {
    fail("runner_receipt_timestamp_order_invalid");
  }
  for (const field of [
    "outerSha256",
    "fullBackupReceiptSha256",
    "databasePartEncryptedSha256",
    "databaseDumpSha256",
    "databaseAuthorizationFingerprintSha256",
    "databaseAuthorizationRequiredRolesSha256",
    "databaseAuthorizationRoleFingerprintSha256",
    "databaseAuthorizationContainerFingerprintSha256",
    "databaseAuthorizationRequiredExtensionsSha256",
    "databaseAuthorizationExtensionFingerprintSha256",
  ]) {
    if (!SHA256.test(receipt[field])) fail("runner_receipt_hash_invalid");
  }
  if (receipt.databaseAuthorizationContractVersion !== 2) {
    fail("runner_receipt_authorization_contract_invalid");
  }
  if (
    !Number.isSafeInteger(receipt.databaseAuthorizationRecordCount) ||
    receipt.databaseAuthorizationRecordCount <= 0 ||
    !Number.isSafeInteger(receipt.databaseAuthorizationGrantTupleCount) ||
    receipt.databaseAuthorizationGrantTupleCount <= 0 ||
    !Number.isSafeInteger(receipt.databaseAuthorizationRoleRecordCount) ||
    receipt.databaseAuthorizationRoleRecordCount <= 0 ||
    !Number.isSafeInteger(receipt.databaseAuthorizationContainerRecordCount) ||
    receipt.databaseAuthorizationContainerRecordCount <= 0 ||
    !Number.isSafeInteger(receipt.databaseAuthorizationRequiredExtensionCount) ||
    receipt.databaseAuthorizationRequiredExtensionCount <= 0 ||
    !Number.isSafeInteger(receipt.databaseAuthorizationExtensionRecordCount) ||
    receipt.databaseAuthorizationExtensionRecordCount <= 0 ||
    receipt.databaseCoreTableAppGrantTupleCount !==
      CORE_TABLE_APP_GRANT_TUPLE_COUNT ||
    !RESTRICTED_SECURITY_DEFINER_FUNCTION_COUNTS.has(
      receipt.databaseRestrictedSecurityDefinerFunctionCount,
    )
  ) {
    fail("runner_receipt_authorization_counts_invalid");
  }
  if (
    receipt.emptyTargetObjectCount !== 0 ||
    receipt.databaseRestore !== "passed" ||
    receipt.singleTransaction !== true ||
    receipt.databasePrivilegesRestore !== "passed" ||
    receipt.databaseOwnershipRestore !== "passed"
  ) {
    fail("runner_receipt_restore_invalid");
  }
  return receipt;
}

function requiredEnvironment(name, pattern) {
  const value = process.env[name]?.trim() || "";
  if (!pattern.test(value)) fail(`${name.toLowerCase()}_invalid`);
  return value;
}

function requiredTimestamp(name) {
  const value = process.env[name]?.trim() || "";
  if (!isIsoUtc(value)) fail(`${name.toLowerCase()}_invalid`);
  return value;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--runner-receipt") args.runnerReceiptPath = argv[++index];
    else if (value === "--output") args.outputPath = argv[++index];
    else fail("usage_invalid");
  }
  if (
    !args.runnerReceiptPath ||
    !args.outputPath ||
    Object.values(args).some(
      (value) => typeof value !== "string" || value.startsWith("-"),
    )
  ) {
    fail("usage_invalid");
  }
  return args;
}

async function readBoundedStdin() {
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size <= 0 || size > MAX_POSTCHECK_BYTES) fail("postcheck_size_invalid");
    chunks.push(bytes);
  }
  if (size === 0) fail("postcheck_empty");
  return Buffer.concat(chunks, size);
}

function parsePostcheck(bytes, runner) {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("postcheck_encoding_invalid");
  }
  const lines = text.trimEnd().split("\n");
  if (lines.length !== REQUIRED_TABLES.length + 1) {
    fail("postcheck_rows_invalid");
  }

  for (let index = 0; index < REQUIRED_TABLES.length; index += 1) {
    const fields = lines[index].split("|");
    if (fields.length !== 4 || fields[0] !== REQUIRED_TABLES[index]) {
      fail("postcheck_rows_invalid");
    }
    if (fields[1] !== "1") fail("postcheck_table_missing");
    if (fields[2] !== "1") fail("postcheck_rls_disabled");
    if (!/^[1-9]\d{0,3}$/u.test(fields[3])) fail("postcheck_policy_missing");
  }

  const authorization = lines[REQUIRED_TABLES.length].split("|");
  if (
    authorization.length !== 10 ||
    authorization[0] !== "authorization" ||
    !SHA256.test(authorization[1]) ||
    !/^[1-9]\d{0,15}$/u.test(authorization[2]) ||
    !/^[1-9]\d{0,15}$/u.test(authorization[3]) ||
    !/^[1-9]\d{0,15}$/u.test(authorization[4]) ||
    !/^[1-9]\d{0,15}$/u.test(authorization[5])
    || !SHA256.test(authorization[6])
    || !/^[1-9]\d{0,15}$/u.test(authorization[7])
    || !SHA256.test(authorization[8])
    || !/^[1-9]\d{0,15}$/u.test(authorization[9])
  ) {
    fail("postcheck_authorization_invalid");
  }
  const recordCount = Number(authorization[2]);
  const grantTupleCount = Number(authorization[3]);
  const coreTableAppGrantTupleCount = Number(authorization[4]);
  const restrictedSecurityDefinerFunctionCount = Number(authorization[5]);
  const requiredExtensionCount = Number(authorization[7]);
  const extensionRecordCount = Number(authorization[9]);
  if (
    !Number.isSafeInteger(recordCount) ||
    !Number.isSafeInteger(grantTupleCount) ||
    !Number.isSafeInteger(coreTableAppGrantTupleCount) ||
    !Number.isSafeInteger(restrictedSecurityDefinerFunctionCount) ||
    !Number.isSafeInteger(requiredExtensionCount) ||
    !Number.isSafeInteger(extensionRecordCount) ||
    authorization[1] !== runner.databaseAuthorizationFingerprintSha256 ||
    recordCount !== runner.databaseAuthorizationRecordCount ||
    grantTupleCount !== runner.databaseAuthorizationGrantTupleCount ||
    coreTableAppGrantTupleCount !==
      runner.databaseCoreTableAppGrantTupleCount ||
    restrictedSecurityDefinerFunctionCount !==
      runner.databaseRestrictedSecurityDefinerFunctionCount ||
    authorization[6] !==
      runner.databaseAuthorizationRequiredExtensionsSha256 ||
    requiredExtensionCount !==
      runner.databaseAuthorizationRequiredExtensionCount ||
    authorization[8] !==
      runner.databaseAuthorizationExtensionFingerprintSha256 ||
    extensionRecordCount !==
      runner.databaseAuthorizationExtensionRecordCount
  ) {
    fail("postcheck_authorization_mismatch");
  }
  return {
    fingerprintSha256: authorization[1],
    recordCount,
    grantTupleCount,
    coreTableAppGrantTupleCount,
    restrictedSecurityDefinerFunctionCount,
    requiredExtensionsSha256: authorization[6],
    requiredExtensionCount,
    extensionFingerprintSha256: authorization[8],
    extensionRecordCount,
  };
}

async function assertPrivateOutputDirectory(outputPath) {
  if (outputPath !== resolve(outputPath)) fail("output_path_not_absolute");
  const parent = dirname(outputPath);
  const [metadata, canonical] = await Promise.all([
    lstat(parent).catch(() => fail("output_directory_unavailable")),
    realpath(parent).catch(() => fail("output_directory_unavailable")),
  ]);
  if (!metadata.isDirectory() || canonical !== parent) {
    fail("output_directory_unsafe");
  }
  if (metadata.uid !== process.getuid()) fail("output_directory_owner_mismatch");
  if ((metadata.mode & 0o077) !== 0) fail("output_directory_permissions_invalid");
  try {
    await lstat(outputPath);
    fail("output_already_exists");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return parent;
}

async function writePrivateAtomic(outputPath, bytes) {
  const parent = await assertPrivateOutputDirectory(outputPath);
  const temporaryPath = join(
    parent,
    `.${basename(outputPath)}.${randomUUID()}.tmp`,
  );
  let handle;
  try {
    handle = await open(
      temporaryPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL,
      0o600,
    );
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await link(temporaryPath, outputPath);
  } finally {
    await handle?.close().catch(() => undefined);
    await unlink(temporaryPath).catch(() => undefined);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [runnerBytes, postcheckBytes] = await Promise.all([
    readStablePrivateFile(args.runnerReceiptPath, "runner_receipt"),
    readBoundedStdin(),
  ]);
  try {
    const runner = parseRunnerReceipt(runnerBytes);
    const drillId = requiredEnvironment("FANMIND_RESTORE_DRILL_ID", DRILL_ID);
    const disposableTargetId = requiredEnvironment(
      "FANMIND_RESTORE_DISPOSABLE_TARGET_ID",
      UUID_V4,
    );
    const productionCommit = requiredEnvironment(
      "FANMIND_RESTORE_PRODUCTION_COMMIT",
      COMMIT,
    );
    const checkedAt = requiredTimestamp("FANMIND_RESTORE_POSTCHECKED_AT");
    if (
      runner.drillId !== drillId ||
      runner.disposableTargetId !== disposableTargetId ||
      runner.productionCommit !== productionCommit
    ) {
      fail("postcheck_runner_identity_mismatch");
    }
    if (Date.parse(checkedAt) < Date.parse(runner.completedAt)) {
      fail("postcheck_timestamp_order_invalid");
    }
    const authorization = parsePostcheck(postcheckBytes, runner);

    const record = {
      schemaVersion: 2,
      drillId,
      checkedAt,
      productionCommit,
      disposableTargetId,
      restoreRunnerReceiptSha256: sha256Bytes(runnerBytes),
      requiredTableCount: REQUIRED_TABLES.length,
      existingTableCount: REQUIRED_TABLES.length,
      rlsEnabledTableCount: REQUIRED_TABLES.length,
      policyCoveredTableCount: REQUIRED_TABLES.length,
      databasePostcheck: "passed",
      databaseAuthorizationFingerprintSha256:
        authorization.fingerprintSha256,
      databaseAuthorizationRecordCount: authorization.recordCount,
      databaseAuthorizationGrantTupleCount:
        authorization.grantTupleCount,
      databaseAuthorizationRoleFingerprintSha256:
        runner.databaseAuthorizationRoleFingerprintSha256,
      databaseAuthorizationRoleRecordCount:
        runner.databaseAuthorizationRoleRecordCount,
      databaseAuthorizationContainerFingerprintSha256:
        runner.databaseAuthorizationContainerFingerprintSha256,
      databaseAuthorizationContainerRecordCount:
        runner.databaseAuthorizationContainerRecordCount,
      databaseAuthorizationRequiredExtensionsSha256:
        authorization.requiredExtensionsSha256,
      databaseAuthorizationRequiredExtensionCount:
        authorization.requiredExtensionCount,
      databaseAuthorizationExtensionFingerprintSha256:
        authorization.extensionFingerprintSha256,
      databaseAuthorizationExtensionRecordCount:
        authorization.extensionRecordCount,
      databaseCoreTableAppGrantTupleCount:
        authorization.coreTableAppGrantTupleCount,
      databaseRestrictedSecurityDefinerFunctionCount:
        authorization.restrictedSecurityDefinerFunctionCount,
      databaseAuthorizationPostcheck: "passed",
      coreTableAppPrivileges: "passed",
      securityDefinerExecutionBoundary: "passed",
    };
    await writePrivateAtomic(
      args.outputPath,
      Buffer.from(`${JSON.stringify(record)}\n`, "utf8"),
    );
    console.log("RESTORE_DATABASE_POSTCHECK_TABLES=5");
    console.log("RESTORE_DATABASE_POSTCHECK_RLS=5");
    console.log("RESTORE_DATABASE_POSTCHECK_POLICIES=5");
    console.log("RESTORE_DATABASE_POSTCHECK_RECEIPT=PASS");
  } finally {
    runnerBytes.fill(0);
    postcheckBytes.fill(0);
  }
}

main().catch((error) => {
  const code =
    typeof error?.code === "string" && /^[a-z0-9_]+$/u.test(error.code)
      ? error.code
      : typeof error?.message === "string" &&
          /^[a-z0-9_]+$/u.test(error.message)
        ? error.message
        : "database_postcheck_receipt_failed";
  console.error(`RESTORE_DATABASE_POSTCHECK_ERROR=${code}`);
  process.exitCode = 1;
});
