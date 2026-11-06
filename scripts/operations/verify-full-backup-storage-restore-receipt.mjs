#!/usr/bin/env node

import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const MAX_RECEIPT_BYTES = 8 * 1024;
const MAX_STORAGE_ARCHIVE_BYTES = 256n * 1024n * 1024n * 1024n;
const SHA256 = /^[0-9a-f]{64}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const FULL_BACKUP_BASENAME = /^fanmind-full-\d{13}\.tar\.gz\.age$/u;
const REQUIRED_KEYS = [
  "schemaVersion",
  "createdAt",
  "sourceArtifactBasename",
  "outerSha256",
  "productionCommit",
  "storagePartEncryptedSha256",
  "storageArchiveSha256",
  "storageManifestSha256",
  "storageBucket",
  "storageObjectCount",
  "storageTotalSizeBytes",
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
      if (escaped) escaped = false;
      else if (text[index] === "\\") escaped = true;
      else if (text[index] === '"') break;
    }
    let lookahead = index + 1;
    while (/\s/u.test(text[lookahead] ?? "")) lookahead += 1;
    const frame = stack.at(-1);
    if (text[lookahead] !== ":" || frame?.type !== "object") continue;
    let key;
    try {
      key = JSON.parse(text.slice(start, index + 1));
    } catch {
      throw fixedError("storage_receipt_json_invalid");
    }
    if (frame.keys.has(key)) {
      throw fixedError("storage_receipt_duplicate_member");
    }
    frame.keys.add(key);
  }
}

function isIsoUtc(value) {
  return (
    typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(value)
    && Number.isFinite(Date.parse(value))
  );
}

async function readStablePrivateFile(path, label, maxBytes) {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    if (error?.code === "ELOOP") throw fixedError(`${label}_not_regular`);
    throw fixedError(`${label}_read_failed`);
  }
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || before.nlink !== 1n) {
      throw fixedError(`${label}_not_regular`);
    }
    if (before.uid !== BigInt(process.getuid())) {
      throw fixedError(`${label}_owner_mismatch`);
    }
    if ((before.mode & 0o777n) !== 0o600n) {
      throw fixedError(`${label}_permissions_invalid`);
    }
    if (before.size <= 0n || before.size > maxBytes) {
      throw fixedError(`${label}_size_invalid`);
    }
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (
      after.dev !== before.dev
      || after.ino !== before.ino
      || after.size !== before.size
      || after.mtimeNs !== before.mtimeNs
      || after.ctimeNs !== before.ctimeNs
      || BigInt(bytes.length) !== before.size
    ) {
      throw fixedError(`${label}_changed_during_read`);
    }
    return bytes;
  } finally {
    await handle.close();
  }
}

async function sha256StablePrivateFile(path, label, maxBytes) {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    if (error?.code === "ELOOP") throw fixedError(`${label}_not_regular`);
    throw fixedError(`${label}_read_failed`);
  }
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || before.nlink !== 1n) {
      throw fixedError(`${label}_not_regular`);
    }
    if (before.uid !== BigInt(process.getuid())) {
      throw fixedError(`${label}_owner_mismatch`);
    }
    if ((before.mode & 0o777n) !== 0o600n) {
      throw fixedError(`${label}_permissions_invalid`);
    }
    if (before.size <= 0n || before.size > maxBytes) {
      throw fixedError(`${label}_size_invalid`);
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
      if (bytesRead <= 0) throw fixedError(`${label}_read_failed`);
      hash.update(buffer.subarray(0, bytesRead));
      offset += BigInt(bytesRead);
    }
    const after = await handle.stat({ bigint: true });
    if (
      after.dev !== before.dev
      || after.ino !== before.ino
      || after.size !== before.size
      || after.mtimeNs !== before.mtimeNs
      || after.ctimeNs !== before.ctimeNs
      || offset !== before.size
    ) {
      throw fixedError(`${label}_changed_during_read`);
    }
    return hash.digest("hex");
  } finally {
    buffer.fill(0);
    await handle.close();
  }
}

export function parseStorageRestoreReceipt(bytes) {
  let text;
  let receipt;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    assertNoDuplicateMembers(text);
    receipt = JSON.parse(text);
  } catch (error) {
    if (error?.code === "storage_receipt_duplicate_member") throw error;
    throw fixedError("storage_receipt_json_invalid");
  }
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    throw fixedError("storage_receipt_record_invalid");
  }
  const keys = Object.keys(receipt).sort();
  if (
    keys.length !== REQUIRED_KEYS.length
    || keys.some((key, index) => key !== REQUIRED_KEYS[index])
  ) {
    throw fixedError("storage_receipt_keys_invalid");
  }
  if (receipt.schemaVersion !== 1) {
    throw fixedError("storage_receipt_schema_invalid");
  }
  if (!isIsoUtc(receipt.createdAt)) {
    throw fixedError("storage_receipt_timestamp_invalid");
  }
  if (!FULL_BACKUP_BASENAME.test(receipt.sourceArtifactBasename)) {
    throw fixedError("storage_receipt_artifact_invalid");
  }
  for (const key of [
    "outerSha256",
    "storagePartEncryptedSha256",
    "storageArchiveSha256",
    "storageManifestSha256",
  ]) {
    if (!SHA256.test(receipt[key])) {
      throw fixedError(`storage_receipt_${key}_invalid`);
    }
  }
  if (!COMMIT.test(receipt.productionCommit)) {
    throw fixedError("storage_receipt_commit_invalid");
  }
  if (receipt.storageBucket !== "fanmind-assets") {
    throw fixedError("storage_receipt_bucket_invalid");
  }
  if (
    !Number.isSafeInteger(receipt.storageObjectCount)
    || receipt.storageObjectCount < 0
    || !Number.isSafeInteger(receipt.storageTotalSizeBytes)
    || receipt.storageTotalSizeBytes < 0
  ) {
    throw fixedError("storage_receipt_counts_invalid");
  }
  if (receipt.verifier !== "passed") {
    throw fixedError("storage_receipt_verifier_not_passed");
  }
  return receipt;
}

export async function verifyStorageRestoreReceipt({
  receiptPath,
  archivePath,
  expectedSourceArtifactBasename,
  expectedOuterSha256,
  expectedProductionCommit,
  expectedStoragePartEncryptedSha256,
}) {
  if (!FULL_BACKUP_BASENAME.test(expectedSourceArtifactBasename ?? "")) {
    throw fixedError("expected_storage_artifact_invalid");
  }
  if (!SHA256.test(expectedOuterSha256 ?? "")) {
    throw fixedError("expected_storage_outer_sha_invalid");
  }
  if (!COMMIT.test(expectedProductionCommit ?? "")) {
    throw fixedError("expected_storage_commit_invalid");
  }
  if (!SHA256.test(expectedStoragePartEncryptedSha256 ?? "")) {
    throw fixedError("expected_storage_part_sha_invalid");
  }
  let receiptBytes;
  try {
    receiptBytes = await readStablePrivateFile(
      resolve(receiptPath),
      "storage_receipt",
      BigInt(MAX_RECEIPT_BYTES),
    );
    const receipt = parseStorageRestoreReceipt(receiptBytes);
    const archiveSha256 = await sha256StablePrivateFile(
      resolve(archivePath),
      "storage_archive",
      MAX_STORAGE_ARCHIVE_BYTES,
    );
    if (archiveSha256 !== receipt.storageArchiveSha256) {
      throw fixedError("storage_archive_sha_mismatch");
    }
    if (
      receipt.sourceArtifactBasename !== expectedSourceArtifactBasename
      || receipt.outerSha256 !== expectedOuterSha256
      || receipt.productionCommit !== expectedProductionCommit
      || receipt.storagePartEncryptedSha256
        !== expectedStoragePartEncryptedSha256
    ) {
      throw fixedError("storage_receipt_expected_binding_mismatch");
    }
    return {
      sourceArtifactBasename: receipt.sourceArtifactBasename,
      outerSha256: receipt.outerSha256,
      productionCommit: receipt.productionCommit,
      storagePartEncryptedSha256: receipt.storagePartEncryptedSha256,
      storageArchiveSha256: receipt.storageArchiveSha256,
      storageManifestSha256: receipt.storageManifestSha256,
      storageBucket: receipt.storageBucket,
      storageObjectCount: receipt.storageObjectCount,
      storageTotalSizeBytes: receipt.storageTotalSizeBytes,
      verifier: receipt.verifier,
    };
  } finally {
    receiptBytes?.fill(0);
  }
}

function parseCli(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--receipt") options.receiptPath = argv[++index];
    else if (value === "--archive") options.archivePath = argv[++index];
    else if (value === "--expected-source-artifact") {
      options.expectedSourceArtifactBasename = argv[++index];
    } else if (value === "--expected-outer-sha256") {
      options.expectedOuterSha256 = argv[++index];
    } else if (value === "--expected-production-commit") {
      options.expectedProductionCommit = argv[++index];
    } else if (value === "--expected-storage-part-sha256") {
      options.expectedStoragePartEncryptedSha256 = argv[++index];
    } else if (value === "--json") options.json = true;
    else throw fixedError("storage_receipt_unknown_argument");
  }
  return options;
}

async function main() {
  const options = parseCli(process.argv.slice(2));
  for (const key of [
    "receiptPath",
    "archivePath",
    "expectedSourceArtifactBasename",
    "expectedOuterSha256",
    "expectedProductionCommit",
    "expectedStoragePartEncryptedSha256",
  ]) {
    if (!options[key]) throw fixedError("storage_receipt_argument_required");
  }
  const result = await verifyStorageRestoreReceipt(options);
  if (options.json) console.log(JSON.stringify(result));
  else console.log("RESTORE_STORAGE_PREPARATION=PASS");
}

const isDirectRun = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;

if (isDirectRun) {
  main().catch((error) => {
    console.error(`RESTORE_STORAGE_PREPARATION=FAILED (${error?.code ?? "unknown"})`);
    process.exitCode = 1;
  });
}
