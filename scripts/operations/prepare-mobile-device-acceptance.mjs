#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, open, realpath, unlink } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  readStablePrivateFile,
  sha256Bytes,
} from "./verify-full-backup-restore-receipt.mjs";

const MAX_SIGNED_BUILD_RECEIPT_BYTES = 8 * 1024;
const ACCEPTANCE_ID =
  /^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]{0,47}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const PLATFORMS = new Set(["android", "ios"]);
const REQUIRED_CHECK_FIELDS = [
  "signedBuildInstalled",
  "login",
  "recoveryValidLink",
  "recoveryInvalidLinkRejected",
  "recoveryExpiredLinkRejected",
  "recoveryUsedLinkRejected",
  "passwordChanged",
  "restartLogin",
  "offlineTransportFallback",
  "offlineReadOnly",
  "offlineAuthFailureClosed",
  "offlineRlsFailureClosed",
  "offlineServerFailureClosed",
  "offlineExpiredCacheRejected",
  "logoutPurge",
  "appIconBranding",
  "splashBranding",
  "accountDeletionRequest",
  "accountDeletionCancel",
];
const PUSH_CHECK_FIELDS = [
  "pushPermissionOptIn",
  "pushPermissionDenial",
  "pushRegistration",
  "pushOptOut",
];
const SAFETY_CONFIRMATION_FIELDS = [
  "automaticSendingObserved",
  "customerDataUsed",
  "secretsRecorded",
  "pushDeliveryObserved",
];
const SIGNED_BUILD_RECEIPT_KEYS = [
  "schemaVersion",
  "completedAt",
  "releaseCommit",
  "platform",
  "buildProfile",
  "distribution",
  "artifact",
  "queueSha256",
  "completionSha256",
  "submit",
  "update",
].sort();

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function isIsoUtc(value) {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/u.exec(
    value,
  );
  if (!match) return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  const date = new Date(parsed);
  const milliseconds = Number((match[7] ?? "0").padEnd(3, "0"));
  return (
    date.getUTCFullYear() === Number(match[1])
    && date.getUTCMonth() + 1 === Number(match[2])
    && date.getUTCDate() === Number(match[3])
    && date.getUTCHours() === Number(match[4])
    && date.getUTCMinutes() === Number(match[5])
    && date.getUTCSeconds() === Number(match[6])
    && date.getUTCMilliseconds() === milliseconds
  );
}

function assertNoDuplicateMembers(text) {
  const seen = new Set();
  const member = /"((?:\\.|[^"\\])*)"\s*:/gu;
  for (const match of text.matchAll(member)) {
    let key;
    try {
      key = JSON.parse(`"${match[1]}"`);
    } catch {
      fail("signed_build_receipt_json_invalid");
    }
    if (seen.has(key)) fail("signed_build_receipt_duplicate_member");
    seen.add(key);
  }
}

function parseSignedBuildReceipt(bytes) {
  let text;
  let receipt;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    assertNoDuplicateMembers(text);
    receipt = JSON.parse(text);
  } catch (error) {
    if (error?.code) throw error;
    fail("signed_build_receipt_json_invalid");
  }
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    fail("signed_build_receipt_record_invalid");
  }
  const keys = Object.keys(receipt).sort();
  if (
    keys.length !== SIGNED_BUILD_RECEIPT_KEYS.length
    || keys.some((key, index) => key !== SIGNED_BUILD_RECEIPT_KEYS[index])
  ) {
    fail("signed_build_receipt_keys_invalid");
  }
  if (
    receipt.schemaVersion !== 1
    || !isIsoUtc(receipt.completedAt)
    || !COMMIT.test(receipt.releaseCommit)
    || !PLATFORMS.has(receipt.platform)
    || !SHA256.test(receipt.queueSha256)
    || !SHA256.test(receipt.completionSha256)
  ) {
    fail("signed_build_receipt_identity_invalid");
  }
  if (
    receipt.artifact !== "available"
    || receipt.submit !== "disabled"
    || receipt.update !== "disabled"
  ) {
    fail("signed_build_receipt_boundaries_invalid");
  }
  if (
    receipt.buildProfile === "preview"
    && receipt.distribution === "internal"
  ) {
    return { receipt, environment: "staging" };
  }
  if (
    receipt.platform === "android"
    && receipt.buildProfile === "production"
    && receipt.distribution === "store"
  ) {
    return { receipt, environment: "production" };
  }
  fail("signed_build_receipt_boundaries_invalid");
}

export function createMobileDeviceAcceptanceTemplate({
  signedBuildReceiptBytes,
  acceptanceId,
  startedAt,
}) {
  if (!ACCEPTANCE_ID.test(acceptanceId)) fail("acceptance_id_invalid");
  if (!isIsoUtc(startedAt)) fail("started_at_invalid");

  const { receipt, environment } = parseSignedBuildReceipt(
    signedBuildReceiptBytes,
  );
  if (Date.parse(startedAt) < Date.parse(receipt.completedAt)) {
    fail("started_at_before_build");
  }

  const template = {
    schemaVersion: 2,
    acceptanceId,
    startedAt,
    completedAt: "replace-with-completion-utc",
    environment,
    platform: receipt.platform,
    releaseCommit: receipt.releaseCommit,
    buildProfile: receipt.buildProfile,
    distribution: receipt.distribution,
    signedBuildCompletedAt: receipt.completedAt,
    signedBuildReceiptSha256: sha256Bytes(signedBuildReceiptBytes),
  };
  for (const field of REQUIRED_CHECK_FIELDS) template[field] = "pending";
  template.pushTested = false;
  template.pushStagingGateSha256 = null;
  for (const field of PUSH_CHECK_FIELDS) template[field] = "not_tested";
  for (const field of SAFETY_CONFIRMATION_FIELDS) template[field] = "pending";
  template.issues = [];
  return Object.freeze(template);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (
      value === "--signed-build-receipt"
      && args.signedBuildReceipt === undefined
    ) {
      args.signedBuildReceipt = argv[++index];
    } else if (value === "--output" && args.output === undefined) {
      args.output = argv[++index];
    } else if (
      value === "--acceptance-id"
      && args.acceptanceId === undefined
    ) {
      args.acceptanceId = argv[++index];
    } else if (value === "--started-at" && args.startedAt === undefined) {
      args.startedAt = argv[++index];
    } else {
      fail("usage_invalid");
    }
  }
  for (const field of ["signedBuildReceipt", "output", "acceptanceId"]) {
    if (
      typeof args[field] !== "string"
      || !args[field]
      || args[field].startsWith("-")
    ) {
      fail("usage_invalid");
    }
  }
  if (
    args.startedAt !== undefined
    && (
      typeof args.startedAt !== "string"
      || !args.startedAt
      || args.startedAt.startsWith("-")
    )
  ) {
    fail("usage_invalid");
  }
  return args;
}

async function assertPrivateOutput(outputPath) {
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
  if ((metadata.mode & 0o077) !== 0) {
    fail("output_directory_permissions_invalid");
  }
  try {
    await lstat(outputPath);
    fail("output_already_exists");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return parent;
}

async function writePrivateAtomic(outputPath, bytes) {
  const parent = await assertPrivateOutput(outputPath);
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
  const signedBuildReceiptBytes = await readStablePrivateFile(
    args.signedBuildReceipt,
    "mobile_signed_build_receipt",
    MAX_SIGNED_BUILD_RECEIPT_BYTES,
  );
  try {
    const template = createMobileDeviceAcceptanceTemplate({
      signedBuildReceiptBytes,
      acceptanceId: args.acceptanceId,
      startedAt: args.startedAt ?? new Date().toISOString(),
    });
    await writePrivateAtomic(
      args.output,
      Buffer.from(`${JSON.stringify(template, null, 2)}\n`, "utf8"),
    );
    console.log(
      `MOBILE_DEVICE_ACCEPTANCE_TEMPLATE_CHECKS=${REQUIRED_CHECK_FIELDS.length}`,
    );
    console.log(
      `MOBILE_DEVICE_ACCEPTANCE_TEMPLATE_SAFETY_CONFIRMATIONS=${SAFETY_CONFIRMATION_FIELDS.length}`,
    );
    console.log("MOBILE_DEVICE_ACCEPTANCE_TEMPLATE_STATE=pending");
    console.log("MOBILE_DEVICE_ACCEPTANCE_PRIVATE_VALUES_OUTPUT=false");
    console.log("MOBILE_DEVICE_ACCEPTANCE_TEMPLATE=PASS");
  } finally {
    signedBuildReceiptBytes.fill(0);
  }
}

const isDirectRun = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;

if (isDirectRun) {
  main().catch((error) => {
    const code =
      typeof error?.code === "string" && /^[a-z0-9_]+$/u.test(error.code)
        ? error.code
        : "mobile_device_acceptance_prepare_failed";
    console.error(`MOBILE_DEVICE_ACCEPTANCE_PREPARE_ERROR=${code}`);
    console.error("MOBILE_DEVICE_ACCEPTANCE_PRIVATE_VALUES_OUTPUT=false");
    console.error("MOBILE_DEVICE_ACCEPTANCE_TEMPLATE=FAIL");
    process.exitCode = 1;
  });
}
