#!/usr/bin/env node

import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { validateAuthorizationContract } from "./database-authorization-contract.mjs";

const MAX_RECEIPT_BYTES = 16 * 1024;
const SHA256 = /^[0-9a-f]{64}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const FULL_BACKUP_BASENAME = /^fanmind-full-\d{13}\.tar\.gz\.age$/u;
const REQUIRED_KEYS = [
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
].sort();

function fixedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function assertNoDuplicateMembers(text) {
  const stack = [];
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === "{") {
      stack.push({ type: "object", keys: new Set() });
      continue;
    }
    if (character === "[") {
      stack.push({ type: "array" });
      continue;
    }
    if (character === "}" || character === "]") {
      stack.pop();
      continue;
    }
    if (character !== '"') continue;
    const start = index;
    let escaped = false;
    for (index += 1; index < text.length; index += 1) {
      if (escaped) {
        escaped = false;
      } else if (text[index] === "\\") {
        escaped = true;
      } else if (text[index] === '"') {
        break;
      }
    }
    let lookahead = index + 1;
    while (/\s/u.test(text[lookahead] ?? "")) lookahead += 1;
    const frame = stack.at(-1);
    if (text[lookahead] !== ":" || frame?.type !== "object") continue;
    let key;
    try {
      key = JSON.parse(text.slice(start, index + 1));
    } catch {
      throw fixedError("receipt_json_invalid");
    }
    if (frame.keys.has(key)) throw fixedError("receipt_duplicate_member");
    frame.keys.add(key);
  }
}

function isIsoUtc(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function isPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function validateRequiredRoles(receipt) {
  const roles = receipt.databaseAuthorizationRequiredRoles;
  if (
    !Array.isArray(roles) ||
    roles.length === 0 ||
    roles.some((role) =>
      typeof role !== "string" ||
      role.length === 0 ||
      Buffer.byteLength(role, "utf8") > 63 ||
      /[\u0000-\u001f\u007f]/u.test(role)
    )
  ) {
    throw fixedError("receipt_authorization_roles_invalid");
  }
  const sortedRoles = [...roles].sort((left, right) =>
    Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8")),
  );
  if (
    roles.some((role, index) => role !== sortedRoles[index]) ||
    new Set(roles).size !== roles.length
  ) {
    throw fixedError("receipt_authorization_roles_invalid");
  }
  const rolesSha256 = sha256Bytes(
    Buffer.from(JSON.stringify(roles), "utf8"),
  );
  if (receipt.databaseAuthorizationRequiredRolesSha256 !== rolesSha256) {
    throw fixedError("receipt_authorization_roles_sha_invalid");
  }
}

export async function readStablePrivateFile(path, label, maxBytes = MAX_RECEIPT_BYTES) {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    if (error?.code === "ELOOP") throw fixedError(`${label}_not_regular`);
    throw fixedError(`${label}_read_failed`);
  }

  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile()) throw fixedError(`${label}_not_regular`);
    if (before.uid !== BigInt(process.getuid())) {
      throw fixedError(`${label}_owner_mismatch`);
    }
    if ((before.mode & 0o777n) !== 0o600n) {
      throw fixedError(`${label}_permissions_invalid`);
    }
    if (before.size <= 0n || before.size > BigInt(maxBytes)) {
      throw fixedError(`${label}_size_invalid`);
    }

    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.size !== before.size ||
      after.mtimeNs !== before.mtimeNs ||
      after.ctimeNs !== before.ctimeNs ||
      BigInt(bytes.length) !== before.size
    ) {
      throw fixedError(`${label}_changed_during_read`);
    }
    return bytes;
  } finally {
    await handle.close();
  }
}

export function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function parseFullBackupRestoreReceipt(bytes) {
  let text;
  let receipt;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    assertNoDuplicateMembers(text);
    receipt = JSON.parse(text);
  } catch (error) {
    if (error?.code === "receipt_duplicate_member") throw error;
    throw fixedError("receipt_json_invalid");
  }

  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    throw fixedError("receipt_record_invalid");
  }
  const keys = Object.keys(receipt).sort();
  if (
    keys.length !== REQUIRED_KEYS.length ||
    keys.some((key, index) => key !== REQUIRED_KEYS[index])
  ) {
    throw fixedError("receipt_keys_invalid");
  }
  if (receipt.schemaVersion !== 2) {
    throw fixedError("receipt_schema_invalid");
  }
  if (!isIsoUtc(receipt.createdAt)) {
    throw fixedError("receipt_timestamp_invalid");
  }
  if (!FULL_BACKUP_BASENAME.test(receipt.sourceArtifactBasename)) {
    throw fixedError("receipt_artifact_invalid");
  }
  if (!SHA256.test(receipt.outerSha256)) {
    throw fixedError("receipt_outer_sha_invalid");
  }
  if (!COMMIT.test(receipt.productionCommit)) {
    throw fixedError("receipt_commit_invalid");
  }
  if (!SHA256.test(receipt.databasePartEncryptedSha256)) {
    throw fixedError("receipt_database_part_sha_invalid");
  }
  if (!SHA256.test(receipt.databaseDumpSha256)) {
    throw fixedError("receipt_database_dump_sha_invalid");
  }
  if (receipt.databaseAuthorizationContractVersion !== 2) {
    throw fixedError("receipt_authorization_contract_invalid");
  }
  if (!SHA256.test(receipt.databaseAuthorizationFingerprintSha256)) {
    throw fixedError("receipt_authorization_fingerprint_invalid");
  }
  if (
    !isPositiveInteger(receipt.databaseAuthorizationRecordCount) ||
    !isPositiveInteger(receipt.databaseAuthorizationGrantTupleCount)
  ) {
    throw fixedError("receipt_authorization_counts_invalid");
  }
  if (!SHA256.test(receipt.databaseAuthorizationRequiredRolesSha256)) {
    throw fixedError("receipt_authorization_roles_sha_invalid");
  }
  validateRequiredRoles(receipt);
  if (!SHA256.test(receipt.databaseAuthorizationRoleFingerprintSha256)) {
    throw fixedError("receipt_authorization_role_fingerprint_invalid");
  }
  if (!isPositiveInteger(receipt.databaseAuthorizationRoleRecordCount)) {
    throw fixedError("receipt_authorization_role_count_invalid");
  }
  if (!SHA256.test(receipt.databaseAuthorizationContainerFingerprintSha256)) {
    throw fixedError("receipt_authorization_container_fingerprint_invalid");
  }
  if (!isPositiveInteger(receipt.databaseAuthorizationContainerRecordCount)) {
    throw fixedError("receipt_authorization_container_count_invalid");
  }
  if (receipt.databaseCoreTableAppGrantTupleCount !== 120) {
    throw fixedError("receipt_core_table_grant_count_invalid");
  }
  if (![12, 13].includes(receipt.databaseRestrictedSecurityDefinerFunctionCount)) {
    throw fixedError("receipt_security_definer_count_invalid");
  }
  try {
    validateAuthorizationContract(receipt);
  } catch {
    throw fixedError("receipt_authorization_extension_contract_invalid");
  }
  if (
    !isPositiveInteger(receipt.databaseAclTocEntryCount) ||
    !isPositiveInteger(receipt.databaseDefaultAclTocEntryCount)
  ) {
    throw fixedError("receipt_acl_toc_counts_invalid");
  }
  if (!SHA256.test(receipt.databaseAclTocSha256)) {
    throw fixedError("receipt_acl_toc_sha_invalid");
  }
  if (
    receipt.databasePrivilegesArchived !== true ||
    receipt.databaseOwnershipArchived !== true
  ) {
    throw fixedError("receipt_database_authorization_archive_invalid");
  }
  if (receipt.verifier !== "passed") {
    throw fixedError("receipt_verifier_not_passed");
  }
  return receipt;
}

async function sha256StableDump(path) {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    if (error?.code === "ELOOP") {
      throw fixedError("database_dump_not_regular");
    }
    throw fixedError("database_dump_read_failed");
  }

  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || before.nlink !== 1n) {
      throw fixedError("database_dump_not_regular");
    }
    if (before.uid !== BigInt(process.getuid())) {
      throw fixedError("database_dump_owner_mismatch");
    }
    if ((before.mode & 0o777n) !== 0o600n) {
      throw fixedError("database_dump_permissions_invalid");
    }
    if (before.size <= 0n || before.size > 64n * 1024n * 1024n * 1024n) {
      throw fixedError("database_dump_size_invalid");
    }

    const hash = createHash("sha256");
    let offset = 0n;
    while (offset < before.size) {
      const requested = Number(
        before.size - offset > BigInt(buffer.length)
          ? BigInt(buffer.length)
          : before.size - offset,
      );
      const { bytesRead } = await handle.read(
        buffer,
        0,
        requested,
        Number(offset),
      );
      if (bytesRead <= 0) throw fixedError("database_dump_read_failed");
      hash.update(buffer.subarray(0, bytesRead));
      offset += BigInt(bytesRead);
    }

    const after = await handle.stat({ bigint: true });
    if (
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.size !== before.size ||
      after.mtimeNs !== before.mtimeNs ||
      after.ctimeNs !== before.ctimeNs ||
      offset !== before.size
    ) {
      throw fixedError("database_dump_changed_during_read");
    }
    return hash.digest("hex");
  } finally {
    buffer.fill(0);
    await handle.close();
  }
}

export async function verifyFullBackupRestoreReceipt({
  receiptPath,
  dumpPath,
  expectedProductionCommit,
}) {
  const receiptBytes = await readStablePrivateFile(
    receiptPath,
    "full_backup_receipt",
  );
  try {
    const receipt = parseFullBackupRestoreReceipt(receiptBytes);
    if (
      expectedProductionCommit &&
      receipt.productionCommit !== expectedProductionCommit
    ) {
      throw fixedError("receipt_commit_mismatch");
    }
    const dumpSha256 = await sha256StableDump(dumpPath);
    if (dumpSha256 !== receipt.databaseDumpSha256) {
      throw fixedError("database_dump_sha_mismatch");
    }
    return {
      receipt,
      receiptSha256: sha256Bytes(receiptBytes),
    };
  } finally {
    receiptBytes.fill(0);
  }
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--receipt") args.receiptPath = argv[++index];
    else if (value === "--dump") args.dumpPath = argv[++index];
    else throw fixedError("usage_invalid");
  }
  if (
    !args.receiptPath ||
    !args.dumpPath ||
    args.receiptPath.startsWith("-") ||
    args.dumpPath.startsWith("-")
  ) {
    throw fixedError("usage_invalid");
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await verifyFullBackupRestoreReceipt({
    ...args,
    expectedProductionCommit:
      process.env.FANMIND_RESTORE_PRODUCTION_COMMIT?.trim() || undefined,
  });
  console.log("FULL_BACKUP_RESTORE_RECEIPT=PASS");
}

const isDirectRun = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;

if (isDirectRun) {
  main().catch((error) => {
    const code =
      typeof error?.code === "string" && /^[a-z0-9_]+$/u.test(error.code)
        ? error.code
        : "receipt_verification_failed";
    console.error(`FULL_BACKUP_RESTORE_RECEIPT_ERROR=${code}`);
    process.exitCode = 1;
  });
}
