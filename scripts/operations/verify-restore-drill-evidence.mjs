#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  parseFullBackupRestoreReceipt,
  readStablePrivateFile,
  sha256Bytes,
} from "./verify-full-backup-restore-receipt.mjs";

const MAX_EVIDENCE_BYTES = 16 * 1024;
const SHA256 = /^[0-9a-f]{64}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const FULL_BACKUP_BASENAME = /^fanmind-full-\d{13}\.tar\.gz\.age$/u;
const PASS_FIELDS = [
  "verifier",
  "storageSample",
  "serverConfigInspection",
  "cleanup",
  "databasePrivilegesRestore",
  "databaseOwnershipRestore",
  "databaseAuthorizationPostcheck",
  "coreTableAppPrivileges",
  "securityDefinerExecutionBoundary",
];
const BOOLEAN_FALSE_FIELDS = [
  "productionModified",
  "customerDataRecordedInEvidence",
  "secretsRecorded",
];
const EVIDENCE_KEYS = [
  "schemaVersion",
  "drillId",
  "startedAt",
  "completedAt",
  "environment",
  "sourceArtifactBasename",
  "outerSha256",
  "productionCommit",
  "fullBackupReceiptSha256",
  "restoreRunnerReceiptSha256",
  "databasePostcheckReceiptSha256",
  "databasePartEncryptedSha256",
  "databaseDumpSha256",
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
  ...PASS_FIELDS,
  ...BOOLEAN_FALSE_FIELDS,
  "issues",
].sort();
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
const DATABASE_POSTCHECK_KEYS = [
  "schemaVersion",
  "drillId",
  "checkedAt",
  "productionCommit",
  "disposableTargetId",
  "restoreRunnerReceiptSha256",
  "requiredTableCount",
  "existingTableCount",
  "rlsEnabledTableCount",
  "policyCoveredTableCount",
  "databasePostcheck",
  "databaseAuthorizationFingerprintSha256",
  "databaseAuthorizationRecordCount",
  "databaseAuthorizationGrantTupleCount",
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
  "databaseAuthorizationPostcheck",
  "coreTableAppPrivileges",
  "securityDefinerExecutionBoundary",
].sort();

function fixedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function fieldCode(field) {
  return field.replace(/[A-Z]/gu, (letter) => `_${letter.toLowerCase()}`);
}

function fail(code) {
  console.error(`RESTORE_EVIDENCE_ERROR=${code}`);
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

function parseFlatRecord(bytes, label) {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    assertNoDuplicateMembers(text, label);
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw fixedError(`${label}_record_invalid`);
    }
    return value;
  } catch (error) {
    if (error?.code) throw error;
    throw fixedError(`${label}_json_invalid`);
  }
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

function isIsoUtc(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function parseRunnerReceipt(bytes) {
  const receipt = parseFlatRecord(bytes, "runner_receipt");
  exactKeys(receipt, RUNNER_KEYS, "runner_receipt");
  if (receipt.schemaVersion !== 2) {
    throw fixedError("runner_receipt_schema_invalid");
  }
  if (
    typeof receipt.drillId !== "string" ||
    !/^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]{0,47}$/u.test(receipt.drillId)
  ) {
    throw fixedError("runner_receipt_drill_id_invalid");
  }
  for (const field of ["startedAt", "completedAt", "emptyTargetObservedAt"]) {
    if (!isIsoUtc(receipt[field])) {
      throw fixedError(`runner_receipt_${fieldCode(field)}_invalid`);
    }
  }
  if (
    Date.parse(receipt.emptyTargetObservedAt) < Date.parse(receipt.startedAt) ||
    Date.parse(receipt.completedAt) < Date.parse(receipt.emptyTargetObservedAt)
  ) {
    throw fixedError("runner_receipt_timestamp_order_invalid");
  }
  if (!FULL_BACKUP_BASENAME.test(receipt.sourceArtifactBasename)) {
    throw fixedError("runner_receipt_artifact_invalid");
  }
  if (!COMMIT.test(receipt.productionCommit)) {
    throw fixedError("runner_receipt_commit_invalid");
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
    if (!SHA256.test(receipt[field])) {
      throw fixedError(`runner_receipt_${fieldCode(field)}_invalid`);
    }
  }
  if (!UUID_V4.test(receipt.disposableTargetId)) {
    throw fixedError("runner_receipt_target_id_invalid");
  }
  if (receipt.databaseAuthorizationContractVersion !== 2) {
    throw fixedError("runner_receipt_authorization_contract_invalid");
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
    receipt.databaseCoreTableAppGrantTupleCount !== 120 ||
    ![12, 13].includes(receipt.databaseRestrictedSecurityDefinerFunctionCount)
  ) {
    throw fixedError("runner_receipt_authorization_counts_invalid");
  }
  if (receipt.emptyTargetObjectCount !== 0) {
    throw fixedError("runner_receipt_target_not_empty");
  }
  if (receipt.databaseRestore !== "passed") {
    throw fixedError("runner_receipt_restore_not_passed");
  }
  if (receipt.singleTransaction !== true) {
    throw fixedError("runner_receipt_transaction_invalid");
  }
  if (receipt.databasePrivilegesRestore !== "passed") {
    throw fixedError("runner_receipt_privileges_restore_not_passed");
  }
  if (receipt.databaseOwnershipRestore !== "passed") {
    throw fixedError("runner_receipt_ownership_restore_not_passed");
  }
  return receipt;
}

function parseDatabasePostcheckReceipt(bytes) {
  const receipt = parseFlatRecord(bytes, "database_postcheck_receipt");
  exactKeys(receipt, DATABASE_POSTCHECK_KEYS, "database_postcheck_receipt");
  if (receipt.schemaVersion !== 2) {
    throw fixedError("database_postcheck_receipt_schema_invalid");
  }
  if (
    typeof receipt.drillId !== "string" ||
    !/^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]{0,47}$/u.test(receipt.drillId)
  ) {
    throw fixedError("database_postcheck_receipt_drill_id_invalid");
  }
  if (!isIsoUtc(receipt.checkedAt)) {
    throw fixedError("database_postcheck_receipt_timestamp_invalid");
  }
  if (!COMMIT.test(receipt.productionCommit)) {
    throw fixedError("database_postcheck_receipt_commit_invalid");
  }
  if (!UUID_V4.test(receipt.disposableTargetId)) {
    throw fixedError("database_postcheck_receipt_target_id_invalid");
  }
  if (!SHA256.test(receipt.restoreRunnerReceiptSha256)) {
    throw fixedError("database_postcheck_receipt_runner_sha_invalid");
  }
  if (!SHA256.test(receipt.databaseAuthorizationFingerprintSha256)) {
    throw fixedError(
      "database_postcheck_receipt_authorization_fingerprint_invalid",
    );
  }
  if (!SHA256.test(receipt.databaseAuthorizationRoleFingerprintSha256)) {
    throw fixedError(
      "database_postcheck_receipt_authorization_role_fingerprint_invalid",
    );
  }
  if (!SHA256.test(receipt.databaseAuthorizationContainerFingerprintSha256)) {
    throw fixedError(
      "database_postcheck_receipt_authorization_container_fingerprint_invalid",
    );
  }
  if (
    !SHA256.test(receipt.databaseAuthorizationRequiredExtensionsSha256) ||
    !SHA256.test(receipt.databaseAuthorizationExtensionFingerprintSha256)
  ) {
    throw fixedError(
      "database_postcheck_receipt_authorization_extension_fingerprint_invalid",
    );
  }
  for (const field of [
    "requiredTableCount",
    "existingTableCount",
    "rlsEnabledTableCount",
    "policyCoveredTableCount",
  ]) {
    if (receipt[field] !== 5) {
      throw fixedError(
        `database_postcheck_receipt_${fieldCode(field)}_invalid`,
      );
    }
  }
  if (receipt.databasePostcheck !== "passed") {
    throw fixedError("database_postcheck_receipt_not_passed");
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
    receipt.databaseCoreTableAppGrantTupleCount !== 120 ||
    ![12, 13].includes(receipt.databaseRestrictedSecurityDefinerFunctionCount)
  ) {
    throw fixedError(
      "database_postcheck_receipt_authorization_counts_invalid",
    );
  }
  for (const field of [
    "databaseAuthorizationPostcheck",
    "coreTableAppPrivileges",
    "securityDefinerExecutionBoundary",
  ]) {
    if (receipt[field] !== "passed") {
      throw fixedError(
        `database_postcheck_receipt_${fieldCode(field)}_not_passed`,
      );
    }
  }
  return receipt;
}

function validateEvidence(evidence) {
  exactKeys(evidence, EVIDENCE_KEYS, "evidence");
  if (evidence.schemaVersion !== 6) {
    throw fixedError("evidence_schema_invalid");
  }
  if (
    typeof evidence.drillId !== "string" ||
    !/^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]{0,47}$/u.test(evidence.drillId)
  ) {
    throw fixedError("evidence_drill_id_invalid");
  }
  if (!isIsoUtc(evidence.startedAt) || !isIsoUtc(evidence.completedAt)) {
    throw fixedError("evidence_timestamps_invalid");
  }
  if (Date.parse(evidence.completedAt) < Date.parse(evidence.startedAt)) {
    throw fixedError("evidence_timestamp_order_invalid");
  }
  if (!["staging", "test"].includes(evidence.environment)) {
    throw fixedError("evidence_environment_invalid");
  }
  if (!FULL_BACKUP_BASENAME.test(evidence.sourceArtifactBasename)) {
    throw fixedError("evidence_artifact_invalid");
  }
  if (!COMMIT.test(evidence.productionCommit)) {
    throw fixedError("evidence_commit_invalid");
  }
  for (const field of [
    "outerSha256",
    "fullBackupReceiptSha256",
    "restoreRunnerReceiptSha256",
    "databasePostcheckReceiptSha256",
    "databasePartEncryptedSha256",
    "databaseDumpSha256",
    "databaseAuthorizationFingerprintSha256",
    "databaseAuthorizationRequiredRolesSha256",
    "databaseAuthorizationRoleFingerprintSha256",
    "databaseAuthorizationContainerFingerprintSha256",
    "databaseAuthorizationRequiredExtensionsSha256",
    "databaseAuthorizationExtensionFingerprintSha256",
  ]) {
    if (!SHA256.test(evidence[field])) {
      throw fixedError(`evidence_${fieldCode(field)}_invalid`);
    }
  }
  if (!UUID_V4.test(evidence.disposableTargetId)) {
    throw fixedError("evidence_target_id_invalid");
  }
  if (
    !Number.isSafeInteger(evidence.databaseAuthorizationRecordCount) ||
    evidence.databaseAuthorizationRecordCount <= 0 ||
    !Number.isSafeInteger(evidence.databaseAuthorizationGrantTupleCount) ||
    evidence.databaseAuthorizationGrantTupleCount <= 0 ||
    !Number.isSafeInteger(evidence.databaseAuthorizationRoleRecordCount) ||
    evidence.databaseAuthorizationRoleRecordCount <= 0 ||
    !Number.isSafeInteger(evidence.databaseAuthorizationContainerRecordCount) ||
    evidence.databaseAuthorizationContainerRecordCount <= 0 ||
    !Number.isSafeInteger(evidence.databaseAuthorizationRequiredExtensionCount) ||
    evidence.databaseAuthorizationRequiredExtensionCount <= 0 ||
    !Number.isSafeInteger(evidence.databaseAuthorizationExtensionRecordCount) ||
    evidence.databaseAuthorizationExtensionRecordCount <= 0 ||
    evidence.databaseCoreTableAppGrantTupleCount !== 120 ||
    ![12, 13].includes(evidence.databaseRestrictedSecurityDefinerFunctionCount)
  ) {
    throw fixedError("evidence_authorization_counts_invalid");
  }
  for (const field of PASS_FIELDS) {
    if (evidence[field] !== "passed") {
      throw fixedError(`evidence_${fieldCode(field)}_not_passed`);
    }
  }
  for (const field of BOOLEAN_FALSE_FIELDS) {
    if (evidence[field] !== false) {
      throw fixedError(`evidence_${fieldCode(field)}_must_be_false`);
    }
  }
  if (!Array.isArray(evidence.issues) || evidence.issues.length !== 0) {
    throw fixedError("evidence_issues_invalid");
  }
}

function bindReceipts(evidence, fullReceipt, fullDigest, runner, runnerDigest) {
  const shared = [
    "sourceArtifactBasename",
    "outerSha256",
    "productionCommit",
    "databasePartEncryptedSha256",
    "databaseDumpSha256",
    "databaseAuthorizationFingerprintSha256",
    "databaseAuthorizationRecordCount",
    "databaseAuthorizationGrantTupleCount",
    "databaseAuthorizationRequiredRolesSha256",
    "databaseAuthorizationRoleFingerprintSha256",
    "databaseAuthorizationRoleRecordCount",
    "databaseAuthorizationContainerFingerprintSha256",
    "databaseAuthorizationContainerRecordCount",
    "databaseAuthorizationRequiredExtensionsSha256",
    "databaseAuthorizationExtensionFingerprintSha256",
    "databaseAuthorizationExtensionRecordCount",
    "databaseCoreTableAppGrantTupleCount",
    "databaseRestrictedSecurityDefinerFunctionCount",
  ];
  for (const field of shared) {
    if (
      evidence[field] !== fullReceipt[field] ||
      evidence[field] !== runner[field]
    ) {
      throw fixedError(`receipt_binding_${fieldCode(field)}_mismatch`);
    }
  }
  if (
    evidence.databaseAuthorizationRequiredExtensionCount !==
      runner.databaseAuthorizationRequiredExtensionCount ||
    evidence.databaseAuthorizationRequiredExtensionCount !==
      fullReceipt.databaseAuthorizationRequiredExtensions.length
  ) {
    throw fixedError("receipt_binding_required_extension_count_mismatch");
  }
  if (
    evidence.fullBackupReceiptSha256 !== fullDigest ||
    runner.fullBackupReceiptSha256 !== fullDigest
  ) {
    throw fixedError("full_receipt_sha_mismatch");
  }
  if (evidence.restoreRunnerReceiptSha256 !== runnerDigest) {
    throw fixedError("runner_receipt_sha_mismatch");
  }
  if (
    evidence.drillId !== runner.drillId ||
    evidence.disposableTargetId !== runner.disposableTargetId
  ) {
    throw fixedError("runner_identity_binding_mismatch");
  }
  if (
    Date.parse(evidence.startedAt) > Date.parse(runner.startedAt) ||
    Date.parse(evidence.completedAt) < Date.parse(runner.completedAt)
  ) {
    throw fixedError("runner_timestamp_envelope_mismatch");
  }
  if (
    evidence.databasePrivilegesRestore !==
      runner.databasePrivilegesRestore ||
    evidence.databaseOwnershipRestore !== runner.databaseOwnershipRestore
  ) {
    throw fixedError("runner_authorization_restore_binding_mismatch");
  }
}

function bindDatabasePostcheck(
  evidence,
  runner,
  runnerDigest,
  postcheck,
  postcheckDigest,
) {
  if (evidence.databasePostcheckReceiptSha256 !== postcheckDigest) {
    throw fixedError("database_postcheck_receipt_sha_mismatch");
  }
  if (postcheck.restoreRunnerReceiptSha256 !== runnerDigest) {
    throw fixedError("database_postcheck_runner_sha_mismatch");
  }
  if (
    postcheck.drillId !== runner.drillId ||
    postcheck.disposableTargetId !== runner.disposableTargetId ||
    postcheck.productionCommit !== runner.productionCommit
  ) {
    throw fixedError("database_postcheck_identity_binding_mismatch");
  }
  if (
    Date.parse(postcheck.checkedAt) < Date.parse(runner.completedAt) ||
    Date.parse(evidence.completedAt) < Date.parse(postcheck.checkedAt)
  ) {
    throw fixedError("database_postcheck_timestamp_envelope_mismatch");
  }
  for (const field of [
    "databaseAuthorizationFingerprintSha256",
    "databaseAuthorizationRecordCount",
    "databaseAuthorizationGrantTupleCount",
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
  ]) {
    if (postcheck[field] !== runner[field] || postcheck[field] !== evidence[field]) {
      throw fixedError(
        `database_postcheck_authorization_${fieldCode(field)}_mismatch`,
      );
    }
  }
  for (const field of [
    "databaseAuthorizationPostcheck",
    "coreTableAppPrivileges",
    "securityDefinerExecutionBoundary",
  ]) {
    if (postcheck[field] !== evidence[field]) {
      throw fixedError(
        `database_postcheck_authorization_${fieldCode(field)}_mismatch`,
      );
    }
  }
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--input") args.input = argv[++index];
    else if (value === "--full-receipt") args.fullReceipt = argv[++index];
    else if (value === "--runner-receipt") args.runnerReceipt = argv[++index];
    else if (value === "--database-postcheck-receipt") {
      args.databasePostcheckReceipt = argv[++index];
    } else throw fixedError("usage_invalid");
  }
  if (
    !args.input ||
    !args.fullReceipt ||
    !args.runnerReceipt ||
    !args.databasePostcheckReceipt ||
    Object.values(args).some(
      (value) => typeof value !== "string" || value.startsWith("-"),
    )
  ) {
    throw fixedError("usage_invalid");
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [evidenceBytes, fullBytes, runnerBytes, postcheckBytes] =
    await Promise.all([
    readStablePrivateFile(args.input, "evidence", MAX_EVIDENCE_BYTES),
    readStablePrivateFile(args.fullReceipt, "full_backup_receipt"),
    readStablePrivateFile(args.runnerReceipt, "runner_receipt"),
    readStablePrivateFile(
      args.databasePostcheckReceipt,
      "database_postcheck_receipt",
    ),
  ]);
  try {
    const evidence = parseFlatRecord(evidenceBytes, "evidence");
    const fullReceipt = parseFullBackupRestoreReceipt(fullBytes);
    const runner = parseRunnerReceipt(runnerBytes);
    const postcheck = parseDatabasePostcheckReceipt(postcheckBytes);
    validateEvidence(evidence);
    bindReceipts(
      evidence,
      fullReceipt,
      sha256Bytes(fullBytes),
      runner,
      sha256Bytes(runnerBytes),
    );
    bindDatabasePostcheck(
      evidence,
      runner,
      sha256Bytes(runnerBytes),
      postcheck,
      sha256Bytes(postcheckBytes),
    );
    console.log("RESTORE_EVIDENCE_SCHEMA=valid");
    console.log("RESTORE_DATABASE_POSTCHECK_TABLES=5");
    console.log("RESTORE_DATABASE_POSTCHECK_RLS=5");
    console.log("RESTORE_DATABASE_POSTCHECK_POLICIES=5");
    console.log("RESTORE_EVIDENCE_SECRETS_RECORDED=false");
    console.log("RESTORE_EVIDENCE_PRODUCTION_MODIFIED=false");
    console.log("RESTORE_DRILL_EVIDENCE=PASS");
    console.log(
      `RESTORE_EVIDENCE_SHA256=${createHash("sha256")
        .update(evidenceBytes)
        .digest("hex")}`,
    );
  } finally {
    evidenceBytes.fill(0);
    fullBytes.fill(0);
    runnerBytes.fill(0);
    postcheckBytes.fill(0);
  }
}

main().catch((error) => {
  const code =
    typeof error?.code === "string" && /^[a-z0-9_]+$/u.test(error.code)
      ? error.code
      : "evidence_verification_failed";
  fail(code);
  console.error("RESTORE_DRILL_EVIDENCE=FAIL");
  process.exitCode = 1;
});
