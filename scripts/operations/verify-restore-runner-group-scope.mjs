#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, open, realpath, unlink } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const FANMIND_REPOSITORY_ID = 1_259_448_985;
export const RESTORE_RUNNER_GROUP = "fanmind-restore-drill";
export const POLICY_MAX_AGE_MS = 60 * 60 * 1_000;
export const REQUIRED_RESTORE_WORKFLOW_PATHS = Object.freeze([
  ".github/workflows/restore-drill-database.yml",
  ".github/workflows/restore-drill-host-readiness.yml",
  ".github/workflows/restore-drill-resource-readiness.yml",
]);

const MAX_CAPTURE_BYTES = 32 * 1024;
const LOGIN = /^[A-Za-z\d](?:[A-Za-z\d-]{0,37}[A-Za-z\d])?$/u;
const TOP_LEVEL_KEYS = [
  "capture",
  "capturedAt",
  "organization",
  "repository",
  "runnerGroup",
  "schemaVersion",
].sort();
const CAPTURE_KEYS = ["containsSecrets", "method", "performedByRole"].sort();
const ORGANIZATION_KEYS = ["login"].sort();
const REPOSITORY_KEYS = [
  "fullName",
  "id",
  "name",
  "ownerLogin",
  "ownerType",
  "private",
].sort();
const RUNNER_GROUP_KEYS = [
  "allowsPublicRepositories",
  "name",
  "restrictedToWorkflows",
  "selectedRepositoryIds",
  "selectedWorkflows",
  "visibility",
].sort();

function fixedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function assertExactKeys(value, expected, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw fixedError(code);
  }
  const keys = Object.keys(value).sort();
  if (
    keys.length !== expected.length ||
    keys.some((key, index) => key !== expected[index])
  ) {
    throw fixedError(code);
  }
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
      throw fixedError("scope_capture_json_invalid");
    }
    if (frame.keys.has(key)) throw fixedError("scope_capture_duplicate_member");
    frame.keys.add(key);
  }
}

function parseTimestamp(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(value)
  ) {
    throw fixedError("scope_capture_timestamp_invalid");
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    throw fixedError("scope_capture_timestamp_invalid");
  }
  const fraction = value.match(/\.(\d{1,3})Z$/u)?.[1] ?? "";
  const canonical = fraction
    ? value.replace(`.${fraction}Z`, `.${fraction.padEnd(3, "0")}Z`)
    : value.replace(/Z$/u, ".000Z");
  if (new Date(milliseconds).toISOString() !== canonical) {
    throw fixedError("scope_capture_timestamp_invalid");
  }
  return milliseconds;
}

function bytewiseSort(values) {
  return [...values].sort((left, right) =>
    Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8")),
  );
}

export function parseRunnerGroupScopeCapture(bytes) {
  let text;
  let capture;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    assertNoDuplicateMembers(text);
    capture = JSON.parse(text);
  } catch (error) {
    if (error?.code === "scope_capture_duplicate_member") throw error;
    throw fixedError("scope_capture_json_invalid");
  }
  assertExactKeys(capture, TOP_LEVEL_KEYS, "scope_capture_keys_invalid");
  assertExactKeys(capture.capture, CAPTURE_KEYS, "scope_capture_metadata_keys_invalid");
  assertExactKeys(capture.organization, ORGANIZATION_KEYS, "scope_organization_keys_invalid");
  assertExactKeys(capture.repository, REPOSITORY_KEYS, "scope_repository_keys_invalid");
  assertExactKeys(capture.runnerGroup, RUNNER_GROUP_KEYS, "scope_runner_group_keys_invalid");
  return capture;
}

export function validateRunnerGroupScopeCapture(capture, { now = Date.now() } = {}) {
  assertExactKeys(capture, TOP_LEVEL_KEYS, "scope_capture_keys_invalid");
  assertExactKeys(capture.capture, CAPTURE_KEYS, "scope_capture_metadata_keys_invalid");
  assertExactKeys(capture.organization, ORGANIZATION_KEYS, "scope_organization_keys_invalid");
  assertExactKeys(capture.repository, REPOSITORY_KEYS, "scope_repository_keys_invalid");
  assertExactKeys(capture.runnerGroup, RUNNER_GROUP_KEYS, "scope_runner_group_keys_invalid");
  if (!Number.isFinite(now) || !Number.isFinite(new Date(now).getTime())) {
    throw fixedError("scope_validation_time_invalid");
  }
  if (capture.schemaVersion !== 1) throw fixedError("scope_capture_schema_invalid");

  const capturedAtMs = parseTimestamp(capture.capturedAt);
  if (capturedAtMs > now) {
    throw fixedError("scope_capture_from_future");
  }
  if (now - capturedAtMs > POLICY_MAX_AGE_MS) {
    throw fixedError("scope_capture_stale");
  }

  if (
    capture.capture.method !== "github-organization-admin-policy-capture" ||
    capture.capture.performedByRole !== "organization-runner-group-administrator" ||
    capture.capture.containsSecrets !== false
  ) {
    throw fixedError("scope_capture_metadata_invalid");
  }

  const organizationLogin = capture.organization.login;
  if (typeof organizationLogin !== "string" || !LOGIN.test(organizationLogin)) {
    throw fixedError("scope_organization_invalid");
  }

  const repository = capture.repository;
  if (
    repository.id !== FANMIND_REPOSITORY_ID ||
    repository.name !== "FanMind" ||
    repository.ownerType !== "Organization" ||
    repository.ownerLogin !== organizationLogin ||
    repository.fullName !== `${organizationLogin}/FanMind` ||
    typeof repository.private !== "boolean"
  ) {
    throw fixedError("scope_repository_context_invalid");
  }

  const runnerGroup = capture.runnerGroup;
  if (
    runnerGroup.name !== RESTORE_RUNNER_GROUP ||
    runnerGroup.visibility !== "selected" ||
    runnerGroup.restrictedToWorkflows !== true ||
    typeof runnerGroup.allowsPublicRepositories !== "boolean"
  ) {
    throw fixedError("scope_runner_group_policy_invalid");
  }
  if (!repository.private && runnerGroup.allowsPublicRepositories !== true) {
    throw fixedError("scope_public_repository_policy_invalid");
  }
  if (
    !Array.isArray(runnerGroup.selectedRepositoryIds) ||
    runnerGroup.selectedRepositoryIds.length !== 1 ||
    runnerGroup.selectedRepositoryIds[0] !== FANMIND_REPOSITORY_ID
  ) {
    throw fixedError("scope_selected_repositories_invalid");
  }

  const requiredWorkflows = REQUIRED_RESTORE_WORKFLOW_PATHS.map(
    (path) => `${repository.fullName}/${path}@refs/heads/main`,
  );
  const selectedWorkflows = runnerGroup.selectedWorkflows;
  if (
    !Array.isArray(selectedWorkflows) ||
    selectedWorkflows.length !== requiredWorkflows.length ||
    selectedWorkflows.some((value) => typeof value !== "string") ||
    new Set(selectedWorkflows).size !== selectedWorkflows.length
  ) {
    throw fixedError("scope_selected_workflows_invalid");
  }
  const actual = bytewiseSort(selectedWorkflows);
  const expected = bytewiseSort(requiredWorkflows);
  if (actual.some((value, index) => value !== expected[index])) {
    throw fixedError("scope_selected_workflows_invalid");
  }

  return {
    capturedAtMs,
    validUntil: new Date(capturedAtMs + POLICY_MAX_AGE_MS).toISOString(),
    repositoryVisibility: repository.private ? "private" : "public",
    publicRepositoryPolicy: repository.private
      ? "not_required_for_private_repository"
      : "explicitly_allowed_for_selected_public_repository",
  };
}

async function readStablePrivateCapture(path) {
  if (path !== resolve(path)) throw fixedError("scope_capture_path_not_absolute");
  const parent = dirname(path);
  const [parentMetadata, canonicalParent] = await Promise.all([
    lstat(parent).catch(() => { throw fixedError("scope_capture_directory_unavailable"); }),
    realpath(parent).catch(() => { throw fixedError("scope_capture_directory_unavailable"); }),
  ]);
  if (!parentMetadata.isDirectory() || canonicalParent !== parent) {
    throw fixedError("scope_capture_directory_unsafe");
  }
  if (parentMetadata.uid !== process.getuid()) {
    throw fixedError("scope_capture_directory_owner_mismatch");
  }
  if ((parentMetadata.mode & 0o077) !== 0) {
    throw fixedError("scope_capture_directory_permissions_invalid");
  }
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    if (error?.code === "ELOOP") throw fixedError("scope_capture_not_regular");
    throw fixedError("scope_capture_read_failed");
  }
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || before.nlink !== 1n) {
      throw fixedError("scope_capture_not_regular");
    }
    if (before.uid !== BigInt(process.getuid())) {
      throw fixedError("scope_capture_owner_mismatch");
    }
    if ((before.mode & 0o777n) !== 0o600n) {
      throw fixedError("scope_capture_permissions_invalid");
    }
    if (before.size <= 0n || before.size > BigInt(MAX_CAPTURE_BYTES)) {
      throw fixedError("scope_capture_size_invalid");
    }
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (
      before.dev !== after.dev || before.ino !== after.ino ||
      before.size !== after.size || before.mtimeNs !== after.mtimeNs ||
      before.ctimeNs !== after.ctimeNs || BigInt(bytes.length) !== before.size
    ) {
      throw fixedError("scope_capture_changed_during_read");
    }
    return bytes;
  } finally {
    await handle.close();
  }
}

async function assertPrivateOutputDirectory(outputPath) {
  if (outputPath !== resolve(outputPath)) throw fixedError("scope_receipt_path_not_absolute");
  const parent = dirname(outputPath);
  const [metadata, canonical] = await Promise.all([
    lstat(parent).catch(() => { throw fixedError("scope_receipt_directory_unavailable"); }),
    realpath(parent).catch(() => { throw fixedError("scope_receipt_directory_unavailable"); }),
  ]);
  if (!metadata.isDirectory() || canonical !== parent) {
    throw fixedError("scope_receipt_directory_unsafe");
  }
  if (metadata.uid !== process.getuid()) throw fixedError("scope_receipt_directory_owner_mismatch");
  if ((metadata.mode & 0o077) !== 0) throw fixedError("scope_receipt_directory_permissions_invalid");
  try {
    await lstat(outputPath);
    throw fixedError("scope_receipt_already_exists");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return parent;
}

async function writePrivateAtomic(outputPath, bytes) {
  const parent = await assertPrivateOutputDirectory(outputPath);
  const temporaryPath = join(parent, `.${basename(outputPath)}.${randomUUID()}.tmp`);
  let handle;
  let temporaryExists = false;
  let outputLinked = false;
  let publishedSafely = false;
  try {
    handle = await open(temporaryPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
    temporaryExists = true;
    await handle.writeFile(bytes);
    await handle.chmod(0o600);
    const metadata = await handle.stat({ bigint: true });
    if (
      !metadata.isFile() || metadata.nlink !== 1n ||
      metadata.uid !== BigInt(process.getuid()) ||
      (metadata.mode & 0o777n) !== 0o600n ||
      metadata.size !== BigInt(bytes.length)
    ) {
      throw fixedError("scope_receipt_temporary_file_unsafe");
    }
    await handle.sync();
    await handle.close();
    handle = undefined;
    await link(temporaryPath, outputPath);
    outputLinked = true;
    const published = await lstat(outputPath, { bigint: true });
    if (
      !published.isFile() || published.nlink !== 2n ||
      published.uid !== BigInt(process.getuid()) ||
      (published.mode & 0o777n) !== 0o600n ||
      published.dev !== metadata.dev || published.ino !== metadata.ino ||
      published.size !== metadata.size
    ) {
      throw fixedError("scope_receipt_publish_failed");
    }
    await unlink(temporaryPath);
    temporaryExists = false;
    const finalMetadata = await lstat(outputPath, { bigint: true });
    if (
      finalMetadata.nlink !== 1n || finalMetadata.dev !== metadata.dev ||
      finalMetadata.ino !== metadata.ino ||
      (finalMetadata.mode & 0o777n) !== 0o600n
    ) {
      throw fixedError("scope_receipt_publish_failed");
    }
    const directoryHandle = await open(
      parent,
      constants.O_RDONLY | constants.O_DIRECTORY,
    );
    try {
      await directoryHandle.sync();
    } finally {
      await directoryHandle.close();
    }
    publishedSafely = true;
  } finally {
    await handle?.close().catch(() => undefined);
    if (temporaryExists) await unlink(temporaryPath).catch(() => undefined);
    if (outputLinked && !publishedSafely) {
      await unlink(outputPath).catch(() => undefined);
    }
  }
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--input") args.inputPath = argv[++index];
    else if (argv[index] === "--output") args.outputPath = argv[++index];
    else throw fixedError("usage_invalid");
  }
  if (
    !args.inputPath || !args.outputPath ||
    Object.values(args).some((value) => typeof value !== "string" || value.startsWith("-"))
  ) {
    throw fixedError("usage_invalid");
  }
  return args;
}

export async function verifyRunnerGroupScope({ inputPath, outputPath, now } = {}) {
  const bytes = await readStablePrivateCapture(inputPath);
  const capture = parseRunnerGroupScopeCapture(bytes);
  const verifiedAtMs = now === undefined ? Date.now() : now;
  const result = validateRunnerGroupScopeCapture(capture, { now: verifiedAtMs });
  const receipt = {
    schemaVersion: 1,
    verifiedAt: new Date(verifiedAtMs).toISOString(),
    capturedAt: capture.capturedAt,
    validUntil: result.validUntil,
    captureSha256: createHash("sha256").update(bytes).digest("hex"),
    repositoryId: FANMIND_REPOSITORY_ID,
    repositoryOwnerType: "Organization",
    repositoryVisibility: result.repositoryVisibility,
    runnerGroupName: RESTORE_RUNNER_GROUP,
    selectedRepositoryCount: 1,
    selectedWorkflowCount: REQUIRED_RESTORE_WORKFLOW_PATHS.length,
    restrictedToWorkflows: true,
    workflowRef: "refs/heads/main",
    allowsPublicRepositories: capture.runnerGroup.allowsPublicRepositories,
    publicRepositoryPolicy: result.publicRepositoryPolicy,
    validatorMode: "offline_read_only",
    remoteAttestation: false,
    validatorGithubApiCalls: 0,
    validatorRunnerRegistrations: 0,
    validatorRestoreAttempts: 0,
  };
  await writePrivateAtomic(outputPath, Buffer.from(`${JSON.stringify(receipt)}\n`, "utf8"));
  return receipt;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await verifyRunnerGroupScope(args);
  console.log("RESTORE_RUNNER_GROUP_SCOPE_MODE=offline_read_only");
  console.log(`RESTORE_RUNNER_GROUP_SCOPE_REPOSITORY_ID=${FANMIND_REPOSITORY_ID}`);
  console.log("RESTORE_RUNNER_GROUP_SCOPE_REMOTE_ATTESTATION=false");
  console.log("RESTORE_RUNNER_GROUP_SCOPE=PASS");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    const code = typeof error?.code === "string" && /^[a-z0-9_]+$/u.test(error.code)
      ? error.code
      : "scope_verification_failed";
    console.error(`RESTORE_RUNNER_GROUP_SCOPE_ERROR=${code}`);
    console.error("RESTORE_RUNNER_GROUP_SCOPE_REMOTE_ATTESTATION=false");
    console.error("RESTORE_RUNNER_GROUP_SCOPE=FAIL");
    process.exitCode = 1;
  });
}
