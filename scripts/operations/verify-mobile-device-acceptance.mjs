#!/usr/bin/env node

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  readStablePrivateFile,
  sha256Bytes,
} from "./verify-full-backup-restore-receipt.mjs";

const MAX_EVIDENCE_BYTES = 24 * 1024;
const MAX_SIGNED_BUILD_RECEIPT_BYTES = 8 * 1024;
const MAX_PUSH_GATE_BYTES = 8 * 1024;
const COMMIT = /^[0-9a-f]{40}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const ACCEPTANCE_ID =
  /^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]{0,47}$/u;
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
const FALSE_FIELDS = [
  "automaticSendingObserved",
  "customerDataUsed",
  "secretsRecorded",
  "pushDeliveryObserved",
];
const EVIDENCE_KEYS = [
  "schemaVersion",
  "acceptanceId",
  "startedAt",
  "completedAt",
  "environment",
  "platform",
  "releaseCommit",
  "buildProfile",
  "signedBuildCompletedAt",
  "signedBuildReceiptSha256",
  ...REQUIRED_CHECK_FIELDS,
  "pushTested",
  "pushStagingGateSha256",
  ...PUSH_CHECK_FIELDS,
  ...FALSE_FIELDS,
  "issues",
].sort();
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
const PUSH_GATE_KEYS = [
  "schemaVersion",
  "completedAt",
  "environment",
  "releaseCommit",
  "resourceReadiness",
  "migrationApply",
  "rollbackAcceptance",
  "productionTargetUsed",
  "realPushTokenUsed",
  "deliveryEnabled",
  "issues",
].sort();

function fixedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function fieldCode(field) {
  return field.replace(/[A-Z]/gu, (letter) => `_${letter.toLowerCase()}`);
}

function exactKeys(record, expected, label) {
  const keys = Object.keys(record).sort();
  if (
    keys.length !== expected.length ||
    keys.some((key, index) => key !== expected[index])
  ) {
    throw fixedError(`${label}_keys_invalid`);
  }
}

function assertNoDuplicateMembers(text, label) {
  const seen = new Set();
  const member = /"((?:\\.|[^"\\])*)"\s*:/gu;
  for (const match of text.matchAll(member)) {
    let key;
    try {
      key = JSON.parse(`"${match[1]}"`);
    } catch {
      throw fixedError(`${label}_json_invalid`);
    }
    if (seen.has(key)) throw fixedError(`${label}_duplicate_member`);
    seen.add(key);
  }
}

function decodeJson(bytes, label, { flat = false } = {}) {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (flat) assertNoDuplicateMembers(text, label);
    return JSON.parse(text);
  } catch (error) {
    if (error?.code) throw error;
    throw fixedError(`${label}_json_invalid`);
  }
}

function parseFlatRecord(bytes, label) {
  const value = decodeJson(bytes, label, { flat: true });
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw fixedError(`${label}_record_invalid`);
  }
  return value;
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

function validateEvidence(evidence, expectedMainCommit) {
  exactKeys(evidence, EVIDENCE_KEYS, "evidence");
  if (evidence.schemaVersion !== 1) {
    throw fixedError("evidence_schema_invalid");
  }
  if (!ACCEPTANCE_ID.test(evidence.acceptanceId)) {
    throw fixedError("evidence_acceptance_id_invalid");
  }
  if (
    !isIsoUtc(evidence.signedBuildCompletedAt) ||
    !isIsoUtc(evidence.startedAt) ||
    !isIsoUtc(evidence.completedAt) ||
    Date.parse(evidence.startedAt) < Date.parse(evidence.signedBuildCompletedAt) ||
    Date.parse(evidence.completedAt) < Date.parse(evidence.startedAt)
  ) {
    throw fixedError("evidence_timestamp_order_invalid");
  }
  if (evidence.environment !== "staging") {
    throw fixedError("evidence_environment_invalid");
  }
  if (!PLATFORMS.has(evidence.platform)) {
    throw fixedError("evidence_platform_invalid");
  }
  if (evidence.buildProfile !== "preview") {
    throw fixedError("evidence_build_profile_invalid");
  }
  if (!COMMIT.test(evidence.releaseCommit)) {
    throw fixedError("evidence_release_commit_invalid");
  }
  if (evidence.releaseCommit !== expectedMainCommit) {
    throw fixedError("evidence_main_commit_mismatch");
  }
  if (!SHA256.test(evidence.signedBuildReceiptSha256)) {
    throw fixedError("evidence_signed_build_receipt_sha_invalid");
  }
  for (const field of REQUIRED_CHECK_FIELDS) {
    if (evidence[field] !== "passed") {
      throw fixedError(`evidence_${fieldCode(field)}_not_passed`);
    }
  }
  for (const field of FALSE_FIELDS) {
    if (evidence[field] !== false) {
      throw fixedError(`evidence_${fieldCode(field)}_must_be_false`);
    }
  }
  if (!Array.isArray(evidence.issues) || evidence.issues.length !== 0) {
    throw fixedError("evidence_issues_invalid");
  }

  if (evidence.pushTested === false) {
    if (evidence.pushStagingGateSha256 !== null) {
      throw fixedError("evidence_push_gate_must_be_null");
    }
    for (const field of PUSH_CHECK_FIELDS) {
      if (evidence[field] !== "not_tested") {
        throw fixedError(`evidence_${fieldCode(field)}_must_be_not_tested`);
      }
    }
  } else if (evidence.pushTested === true) {
    if (!SHA256.test(evidence.pushStagingGateSha256)) {
      throw fixedError("evidence_push_gate_sha_invalid");
    }
    for (const field of PUSH_CHECK_FIELDS) {
      if (evidence[field] !== "passed") {
        throw fixedError(`evidence_${fieldCode(field)}_not_passed`);
      }
    }
  } else {
    throw fixedError("evidence_push_tested_invalid");
  }
}

function validateSignedBuildReceipt(receipt, evidence, receiptBytes) {
  exactKeys(receipt, SIGNED_BUILD_RECEIPT_KEYS, "signed_build_receipt");
  if (receipt.schemaVersion !== 1) {
    throw fixedError("signed_build_receipt_schema_invalid");
  }
  if (evidence.signedBuildReceiptSha256 !== sha256Bytes(receiptBytes)) {
    throw fixedError("signed_build_receipt_sha_mismatch");
  }
  if (
    !isIsoUtc(receipt.completedAt) ||
    receipt.completedAt !== evidence.signedBuildCompletedAt
  ) {
    throw fixedError("signed_build_receipt_timestamp_mismatch");
  }
  if (receipt.releaseCommit !== evidence.releaseCommit) {
    throw fixedError("signed_build_receipt_commit_mismatch");
  }
  if (receipt.platform !== evidence.platform) {
    throw fixedError("signed_build_receipt_platform_mismatch");
  }
  if (
    receipt.buildProfile !== "preview" ||
    receipt.distribution !== "internal" ||
    receipt.artifact !== "available" ||
    receipt.submit !== "disabled" ||
    receipt.update !== "disabled"
  ) {
    throw fixedError("signed_build_receipt_boundaries_invalid");
  }
  if (
    !SHA256.test(receipt.queueSha256) ||
    !SHA256.test(receipt.completionSha256)
  ) {
    throw fixedError("signed_build_receipt_source_sha_invalid");
  }
}

function validatePushGate(gate, evidence, gateBytes) {
  exactKeys(gate, PUSH_GATE_KEYS, "push_gate");
  if (gate.schemaVersion !== 1) {
    throw fixedError("push_gate_schema_invalid");
  }
  if (
    !isIsoUtc(gate.completedAt) ||
    Date.parse(gate.completedAt) > Date.parse(evidence.startedAt)
  ) {
    throw fixedError("push_gate_timestamp_invalid");
  }
  if (gate.environment !== "staging") {
    throw fixedError("push_gate_environment_invalid");
  }
  if (gate.releaseCommit !== evidence.releaseCommit) {
    throw fixedError("push_gate_commit_mismatch");
  }
  for (const field of [
    "resourceReadiness",
    "migrationApply",
    "rollbackAcceptance",
  ]) {
    if (gate[field] !== "passed") {
      throw fixedError(`push_gate_${fieldCode(field)}_not_passed`);
    }
  }
  for (const field of [
    "productionTargetUsed",
    "realPushTokenUsed",
    "deliveryEnabled",
  ]) {
    if (gate[field] !== false) {
      throw fixedError(`push_gate_${fieldCode(field)}_must_be_false`);
    }
  }
  if (!Array.isArray(gate.issues) || gate.issues.length !== 0) {
    throw fixedError("push_gate_issues_invalid");
  }
  if (evidence.pushStagingGateSha256 !== sha256Bytes(gateBytes)) {
    throw fixedError("push_gate_sha_mismatch");
  }
}

export function evaluateMobileDeviceAcceptance({
  evidenceBytes,
  signedBuildReceiptBytes,
  expectedMainCommit,
  pushStagingGateBytes = null,
}) {
  if (!COMMIT.test(expectedMainCommit)) {
    throw fixedError("expected_main_commit_invalid");
  }
  const evidence = parseFlatRecord(evidenceBytes, "evidence");
  validateEvidence(evidence, expectedMainCommit);

  validateSignedBuildReceipt(
    parseFlatRecord(signedBuildReceiptBytes, "signed_build_receipt"),
    evidence,
    signedBuildReceiptBytes,
  );

  if (evidence.pushTested) {
    if (!pushStagingGateBytes) {
      throw fixedError("push_staging_gate_required");
    }
    validatePushGate(
      parseFlatRecord(pushStagingGateBytes, "push_gate"),
      evidence,
      pushStagingGateBytes,
    );
  } else if (pushStagingGateBytes) {
    throw fixedError("push_staging_gate_unexpected");
  }

  return Object.freeze({
    evidenceSha256: sha256Bytes(evidenceBytes),
    requiredChecks: REQUIRED_CHECK_FIELDS.length,
    buildBindings: 5,
    pushChecks: evidence.pushTested ? PUSH_CHECK_FIELDS.length : 0,
  });
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--input" && args.input === undefined) {
      args.input = argv[++index];
    } else if (
      value === "--signed-build-receipt" &&
      args.signedBuildReceipt === undefined
    ) {
      args.signedBuildReceipt = argv[++index];
    } else if (
      value === "--expected-main-commit" &&
      args.expectedMainCommit === undefined
    ) {
      args.expectedMainCommit = argv[++index];
    } else if (
      value === "--push-staging-gate" &&
      args.pushStagingGate === undefined
    ) {
      args.pushStagingGate = argv[++index];
    } else {
      throw fixedError("usage_invalid");
    }
  }
  for (const field of [
    "input",
    "signedBuildReceipt",
    "expectedMainCommit",
  ]) {
    if (
      typeof args[field] !== "string" ||
      !args[field] ||
      args[field].startsWith("-")
    ) {
      throw fixedError("usage_invalid");
    }
  }
  if (
    args.pushStagingGate !== undefined &&
    (typeof args.pushStagingGate !== "string" ||
      !args.pushStagingGate ||
      args.pushStagingGate.startsWith("-"))
  ) {
    throw fixedError("usage_invalid");
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [evidenceBytes, signedBuildReceiptBytes, pushStagingGateBytes] =
    await Promise.all([
      readStablePrivateFile(
        args.input,
        "mobile_device_evidence",
        MAX_EVIDENCE_BYTES,
      ),
      readStablePrivateFile(
        args.signedBuildReceipt,
        "mobile_signed_build_receipt",
        MAX_SIGNED_BUILD_RECEIPT_BYTES,
      ),
      args.pushStagingGate
        ? readStablePrivateFile(
            args.pushStagingGate,
            "mobile_push_staging_gate",
            MAX_PUSH_GATE_BYTES,
          )
        : Promise.resolve(null),
    ]);

  try {
    const result = evaluateMobileDeviceAcceptance({
      evidenceBytes,
      signedBuildReceiptBytes,
      expectedMainCommit: args.expectedMainCommit,
      pushStagingGateBytes,
    });
    console.log(
      `MOBILE_DEVICE_ACCEPTANCE_BUILD_BINDINGS=${result.buildBindings}`,
    );
    console.log(
      `MOBILE_DEVICE_ACCEPTANCE_BUILD_BINDINGS_PASSED=${result.buildBindings}`,
    );
    console.log(
      `MOBILE_DEVICE_ACCEPTANCE_REQUIRED_CHECKS=${result.requiredChecks}`,
    );
    console.log(
      `MOBILE_DEVICE_ACCEPTANCE_REQUIRED_PASSED=${result.requiredChecks}`,
    );
    console.log(
      `MOBILE_DEVICE_ACCEPTANCE_PUSH_CHECKS=${result.pushChecks}`,
    );
    console.log(
      `MOBILE_DEVICE_ACCEPTANCE_PUSH_PASSED=${result.pushChecks}`,
    );
    console.log("MOBILE_DEVICE_ACCEPTANCE_PRIVATE_VALUES_OUTPUT=false");
    console.log("MOBILE_DEVICE_ACCEPTANCE=PASS");
    console.log(
      `MOBILE_DEVICE_ACCEPTANCE_SHA256=${result.evidenceSha256}`,
    );
  } finally {
    evidenceBytes.fill(0);
    signedBuildReceiptBytes.fill(0);
    pushStagingGateBytes?.fill(0);
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
        : "mobile_device_acceptance_failed";
    console.error(`MOBILE_DEVICE_ACCEPTANCE_ERROR=${code}`);
    console.error("MOBILE_DEVICE_ACCEPTANCE_PRIVATE_VALUES_OUTPUT=false");
    console.error("MOBILE_DEVICE_ACCEPTANCE=FAIL");
    process.exitCode = 1;
  });
}
