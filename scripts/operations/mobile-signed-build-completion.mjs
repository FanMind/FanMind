#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { evaluateQueuedMobileBuild } from "./mobile-signed-build-preflight.mjs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const ALLOWED_PLATFORMS = new Set(["android", "ios"]);
const ALLOWED_PROFILES = new Set(["development", "preview", "production"]);
const PENDING_STATUSES = new Set([
  "NEW",
  "IN_QUEUE",
  "IN_PROGRESS",
  "PENDING_CANCEL",
]);
const FAILED_STATUSES = new Set(["ERRORED", "CANCELED"]);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function normalizeRecord(parsed, code) {
  if (Array.isArray(parsed)) {
    if (parsed.length !== 1) fail(code);
    return parsed[0];
  }
  if (!parsed || typeof parsed !== "object") fail(code);
  return parsed;
}

function normalizePlatform(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeStatus(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replaceAll("-", "_");
}

function isIsoUtc(value) {
  return (
    typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(value)
    && Number.isFinite(Date.parse(value))
  );
}

function isSafeHttpsArtifact(value) {
  if (typeof value !== "string" || value.length > 4096) return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:"
    && !url.username
    && !url.password
    && !url.hash
  );
}

function queueContract(queueOutput) {
  const queue = normalizeRecord(queueOutput, "build_queue_output_invalid");
  const id = String(queue?.id ?? "").trim();
  const platform = normalizePlatform(queue?.platform);
  const buildProfile = String(queue?.buildProfile ?? "").trim();
  const gitCommitHash = String(queue?.gitCommitHash ?? "").trim();

  if (!UUID_PATTERN.test(id)) fail("build_queue_id_invalid");
  if (!ALLOWED_PLATFORMS.has(platform)) fail("build_queue_platform_invalid");
  if (!ALLOWED_PROFILES.has(buildProfile)) fail("build_queue_profile_invalid");
  if (!COMMIT_PATTERN.test(gitCommitHash)) fail("build_queue_commit_invalid");

  return { id, platform, buildProfile, gitCommitHash };
}

function matchingCompletionContract(
  completionOutput,
  queue,
  expectedDistribution,
) {
  const completion = normalizeRecord(
    completionOutput,
    "build_completion_output_invalid",
  );
  if (String(completion?.id ?? "").trim() !== queue.id) {
    fail("build_completion_id_mismatch");
  }
  if (normalizePlatform(completion?.platform) !== queue.platform) {
    fail("build_completion_platform_mismatch");
  }
  if (String(completion?.buildProfile ?? "").trim() !== queue.buildProfile) {
    fail("build_completion_profile_mismatch");
  }
  if (String(completion?.gitCommitHash ?? "").trim() !== queue.gitCommitHash) {
    fail("build_completion_commit_mismatch");
  }
  if (
    normalizeStatus(completion?.distribution)
    !== expectedDistribution.toUpperCase()
  ) {
    fail("build_completion_distribution_invalid");
  }
  return completion;
}

export function evaluateMobileSignedBuildCompletion({
  queueOutput,
  completionOutput,
  environment = process.env,
}) {
  const gate = evaluateQueuedMobileBuild({
    buildOutput: queueOutput,
    environment,
  });
  const queue = queueContract(queueOutput);
  const completion = matchingCompletionContract(
    completionOutput,
    queue,
    gate.distribution,
  );
  const status = normalizeStatus(completion.status);

  if (PENDING_STATUSES.has(status)) {
    return Object.freeze({
      state: "pending",
      platform: queue.platform,
      buildProfile: queue.buildProfile,
      releaseCommit: "verified",
      distribution: gate.distribution,
      artifact: "not-ready",
    });
  }
  if (FAILED_STATUSES.has(status)) {
    return Object.freeze({
      state: "failed",
      platform: queue.platform,
      buildProfile: queue.buildProfile,
      releaseCommit: "verified",
      distribution: gate.distribution,
      artifact: "unavailable",
    });
  }
  if (status !== "FINISHED") fail("build_completion_status_invalid");
  if (!isIsoUtc(completion.completedAt)) {
    fail("build_completion_timestamp_invalid");
  }

  const artifactUrl =
    completion?.artifacts?.applicationArchiveUrl
    ?? completion?.artifacts?.buildUrl;
  if (!isSafeHttpsArtifact(artifactUrl)) {
    fail("build_completion_artifact_invalid");
  }

  return Object.freeze({
    state: "verified",
    platform: queue.platform,
    buildProfile: queue.buildProfile,
    releaseCommit: "verified",
    distribution: gate.distribution,
    artifact: "available",
  });
}

export async function verifyMobileSignedBuildCompletion(
  queuePath,
  completionPath,
  environment = process.env,
) {
  let queueOutput;
  let completionOutput;
  try {
    [queueOutput, completionOutput] = await Promise.all([
      readFile(queuePath, "utf8").then(JSON.parse),
      readFile(completionPath, "utf8").then(JSON.parse),
    ]);
  } catch {
    fail("build_completion_output_invalid");
  }
  return evaluateMobileSignedBuildCompletion({
    queueOutput,
    completionOutput,
    environment,
  });
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--queue") args.queuePath = argv[++index];
    else if (value === "--completion") args.completionPath = argv[++index];
    else fail("usage_invalid");
  }
  if (
    !args.queuePath
    || !args.completionPath
    || args.queuePath.startsWith("-")
    || args.completionPath.startsWith("-")
  ) {
    fail("usage_invalid");
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await verifyMobileSignedBuildCompletion(
    args.queuePath,
    args.completionPath,
  );

  console.log(`MOBILE_SIGNED_BUILD_PLATFORM=${result.platform}`);
  console.log(`MOBILE_SIGNED_BUILD_PROFILE=${result.buildProfile}`);
  console.log("MOBILE_SIGNED_BUILD_RELEASE_COMMIT=verified");
  console.log(`MOBILE_SIGNED_BUILD_DISTRIBUTION=${result.distribution}`);
  console.log(`MOBILE_SIGNED_BUILD_ARTIFACT=${result.artifact}`);
  console.log(`MOBILE_SIGNED_BUILD_COMPLETION=${result.state}`);
  console.log("MOBILE_SIGNED_BUILD_SUBMIT=disabled");
  console.log("MOBILE_SIGNED_BUILD_UPDATE=disabled");
  console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
  if (result.state === "verified") {
    console.log("MOBILE_SIGNED_BUILD_COMPLETION_VERIFICATION=PASS");
  } else if (result.state === "failed") {
    console.log("MOBILE_SIGNED_BUILD_COMPLETION_VERIFICATION=TERMINAL_FAILURE");
    process.exitCode = 2;
  } else {
    console.log("MOBILE_SIGNED_BUILD_COMPLETION_VERIFICATION=PENDING");
  }
}

if (
  process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    const code =
      typeof error?.code === "string" && /^[a-z0-9_]+$/u.test(error.code)
        ? error.code
        : "build_completion_verification_failed";
    console.error(`MOBILE_SIGNED_BUILD_COMPLETION_ERROR=${code}`);
    console.error("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
    console.error("MOBILE_SIGNED_BUILD_COMPLETION_VERIFICATION=FAIL");
    process.exitCode = 1;
  });
}
