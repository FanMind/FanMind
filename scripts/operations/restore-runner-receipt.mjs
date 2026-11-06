#!/usr/bin/env node

import { constants } from "node:fs";
import { link, lstat, open, realpath, unlink } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

import {
  verifyFullBackupRestoreReceipt,
} from "./verify-full-backup-restore-receipt.mjs";

const DRILL_ID = /^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]{0,47}$/u;
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function requiredEnvironment(name, pattern) {
  const value = process.env[name]?.trim() || "";
  if (!pattern.test(value)) fail(`${name.toLowerCase()}_invalid`);
  return value;
}

function requiredTimestamp(name) {
  const value = process.env[name]?.trim() || "";
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    fail(`${name.toLowerCase()}_invalid`);
  }
  return value;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--full-receipt") args.fullReceiptPath = argv[++index];
    else if (value === "--dump") args.dumpPath = argv[++index];
    else if (value === "--output") args.outputPath = argv[++index];
    else fail("usage_invalid");
  }
  if (
    !args.fullReceiptPath ||
    !args.dumpPath ||
    !args.outputPath ||
    Object.values(args).some(
      (value) => typeof value !== "string" || value.startsWith("-"),
    )
  ) {
    fail("usage_invalid");
  }
  return args;
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
  const drillId = requiredEnvironment("FANMIND_RESTORE_DRILL_ID", DRILL_ID);
  const disposableTargetId = requiredEnvironment(
    "FANMIND_RESTORE_DISPOSABLE_TARGET_ID",
    UUID_V4,
  );
  const productionCommit = requiredEnvironment(
    "FANMIND_RESTORE_PRODUCTION_COMMIT",
    /^[0-9a-f]{40}$/u,
  );
  const startedAt = requiredTimestamp("FANMIND_RESTORE_STARTED_AT");
  const emptyTargetObservedAt = requiredTimestamp(
    "FANMIND_RESTORE_EMPTY_TARGET_OBSERVED_AT",
  );
  const completedAt = requiredTimestamp("FANMIND_RESTORE_COMPLETED_AT");
  if (
    Date.parse(emptyTargetObservedAt) < Date.parse(startedAt) ||
    Date.parse(completedAt) < Date.parse(emptyTargetObservedAt)
  ) {
    fail("runner_timestamp_order_invalid");
  }
  if (process.env.FANMIND_RESTORE_EMPTY_TARGET_OBJECT_COUNT !== "0") {
    fail("empty_target_not_proven");
  }

  const { receipt, receiptSha256 } =
    await verifyFullBackupRestoreReceipt({
      receiptPath: args.fullReceiptPath,
      dumpPath: args.dumpPath,
      expectedProductionCommit: productionCommit,
    });

  const record = {
    schemaVersion: 2,
    drillId,
    startedAt,
    completedAt,
    sourceArtifactBasename: receipt.sourceArtifactBasename,
    outerSha256: receipt.outerSha256,
    productionCommit,
    fullBackupReceiptSha256: receiptSha256,
    databasePartEncryptedSha256:
      receipt.databasePartEncryptedSha256,
    databaseDumpSha256: receipt.databaseDumpSha256,
    databaseAuthorizationContractVersion:
      receipt.databaseAuthorizationContractVersion,
    databaseAuthorizationFingerprintSha256:
      receipt.databaseAuthorizationFingerprintSha256,
    databaseAuthorizationRecordCount:
      receipt.databaseAuthorizationRecordCount,
    databaseAuthorizationGrantTupleCount:
      receipt.databaseAuthorizationGrantTupleCount,
    databaseAuthorizationRequiredRolesSha256:
      receipt.databaseAuthorizationRequiredRolesSha256,
    databaseAuthorizationRoleFingerprintSha256:
      receipt.databaseAuthorizationRoleFingerprintSha256,
    databaseAuthorizationRoleRecordCount:
      receipt.databaseAuthorizationRoleRecordCount,
    databaseAuthorizationContainerFingerprintSha256:
      receipt.databaseAuthorizationContainerFingerprintSha256,
    databaseAuthorizationContainerRecordCount:
      receipt.databaseAuthorizationContainerRecordCount,
    databaseAuthorizationRequiredExtensionsSha256:
      receipt.databaseAuthorizationRequiredExtensionsSha256,
    databaseAuthorizationRequiredExtensionCount:
      receipt.databaseAuthorizationRequiredExtensions.length,
    databaseAuthorizationExtensionFingerprintSha256:
      receipt.databaseAuthorizationExtensionFingerprintSha256,
    databaseAuthorizationExtensionRecordCount:
      receipt.databaseAuthorizationExtensionRecordCount,
    databaseCoreTableAppGrantTupleCount:
      receipt.databaseCoreTableAppGrantTupleCount,
    databaseRestrictedSecurityDefinerFunctionCount:
      receipt.databaseRestrictedSecurityDefinerFunctionCount,
    disposableTargetId,
    emptyTargetObservedAt,
    emptyTargetObjectCount: 0,
    databaseRestore: "passed",
    singleTransaction: true,
    databasePrivilegesRestore: "passed",
    databaseOwnershipRestore: "passed",
  };
  await writePrivateAtomic(
    args.outputPath,
    Buffer.from(`${JSON.stringify(record)}\n`, "utf8"),
  );
  console.log("RESTORE_RUNNER_RECEIPT=PASS");
}

main().catch((error) => {
  const code =
    typeof error?.code === "string" && /^[a-z0-9_]+$/u.test(error.code)
      ? error.code
      : typeof error?.message === "string" &&
          /^[a-z0-9_]+$/u.test(error.message)
        ? error.message
        : "runner_receipt_failed";
  console.error(`RESTORE_RUNNER_RECEIPT_ERROR=${code}`);
  process.exitCode = 1;
});
