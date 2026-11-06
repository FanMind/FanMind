#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ALLOWED_ENVIRONMENTS = new Set(["development", "preview"]);
const ALLOWED_PLATFORMS = new Set(["android", "ios"]);
const ALLOWED_BUILD_CLASSES = new Set(["internal", "store"]);
const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function required(environment, key, code = "configuration_missing") {
  const value = String(environment[key] ?? "").trim();
  if (!value) fail(code);
  return value;
}

function requireSwitch(environment, key, expected) {
  if (String(environment[key] ?? "").trim() !== expected) {
    fail("release_write_gate_invalid");
  }
}

export function evaluateMobileSignedBuildGate(environment = process.env) {
  if (required(environment, "GITHUB_REF") !== "refs/heads/main") {
    fail("main_ref_required");
  }

  const releaseCommit = required(environment, "GITHUB_SHA");
  const expectedReleaseCommit = required(
    environment,
    "FANMIND_MOBILE_EXPECTED_RELEASE_COMMIT",
  );
  if (
    !COMMIT_PATTERN.test(releaseCommit)
    || releaseCommit !== expectedReleaseCommit
  ) {
    fail("release_commit_mismatch");
  }

  const releaseEnvironment = required(
    environment,
    "FANMIND_MOBILE_RELEASE_ENVIRONMENT",
  );
  const buildProfile = required(
    environment,
    "FANMIND_MOBILE_BUILD_PROFILE",
  );
  const platform = required(environment, "FANMIND_MOBILE_BUILD_PLATFORM");
  const buildClass = required(environment, "FANMIND_MOBILE_BUILD_CLASS");
  if (!ALLOWED_BUILD_CLASSES.has(buildClass)) fail("build_class_invalid");

  const internalTarget =
    buildClass === "internal"
    && ALLOWED_ENVIRONMENTS.has(releaseEnvironment)
    && buildProfile === releaseEnvironment
    && ALLOWED_PLATFORMS.has(platform)
    && required(environment, "FANMIND_MOBILE_SIGNED_BUILD_CONFIRM")
      === "queue-one-signed-mobile-build";
  const storeTarget =
    buildClass === "store"
    && releaseEnvironment === "production"
    && buildProfile === "production"
    && platform === "android"
    && required(environment, "FANMIND_MOBILE_SIGNED_BUILD_CONFIRM")
      === "queue-one-android-store-build";
  if (!internalTarget && !storeTarget) {
    fail("confirmation_invalid");
  }

  requireSwitch(environment, "FANMIND_ENABLE_MOBILE_EAS_BUILD", "true");
  requireSwitch(environment, "FANMIND_ENABLE_MOBILE_EAS_SUBMIT", "false");
  requireSwitch(environment, "FANMIND_ENABLE_MOBILE_EAS_UPDATE", "false");

  return Object.freeze({
    releaseEnvironment,
    buildProfile,
    platform,
    buildClass,
    distribution: buildClass === "store" ? "store" : "internal",
    releaseCommit: "verified",
    submit: "disabled",
    update: "disabled",
  });
}

function normalizeBuildOutput(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") return [parsed];
  fail("build_queue_output_invalid");
}

export function evaluateQueuedMobileBuild({
  buildOutput,
  environment = process.env,
}) {
  const gate = evaluateMobileSignedBuildGate(environment);
  const builds = normalizeBuildOutput(buildOutput);
  if (builds.length !== 1) fail("build_queue_count_invalid");

  const [build] = builds;
  if (!UUID_PATTERN.test(String(build?.id ?? ""))) {
    fail("build_queue_id_invalid");
  }
  if (
    String(build?.platform ?? "").toLowerCase() !== gate.platform
    || String(build?.buildProfile ?? "") !== gate.buildProfile
  ) {
    fail("build_queue_target_mismatch");
  }
  if (String(build?.gitCommitHash ?? "") !== environment.GITHUB_SHA) {
    fail("build_queue_commit_mismatch");
  }

  return Object.freeze({
    releaseEnvironment: gate.releaseEnvironment,
    buildProfile: gate.buildProfile,
    platform: gate.platform,
    buildClass: gate.buildClass,
    distribution: gate.distribution,
    releaseCommit: "verified",
    queue: "accepted",
    submit: "disabled",
    update: "disabled",
  });
}

export async function verifyQueuedMobileBuild(
  reportPath,
  environment = process.env,
) {
  let buildOutput;
  try {
    buildOutput = JSON.parse(await readFile(reportPath, "utf8"));
  } catch {
    fail("build_queue_output_invalid");
  }
  return evaluateQueuedMobileBuild({ buildOutput, environment });
}

async function main() {
  const reportPath = process.argv[2];
  const result = reportPath
    ? await verifyQueuedMobileBuild(reportPath, process.env)
    : evaluateMobileSignedBuildGate(process.env);

  console.log(
    `MOBILE_SIGNED_BUILD_ENVIRONMENT=${result.releaseEnvironment}`,
  );
  console.log(`MOBILE_SIGNED_BUILD_PROFILE=${result.buildProfile}`);
  console.log(`MOBILE_SIGNED_BUILD_PLATFORM=${result.platform}`);
  console.log(`MOBILE_SIGNED_BUILD_CLASS=${result.buildClass}`);
  console.log("MOBILE_SIGNED_BUILD_RELEASE_COMMIT=verified");
  console.log(`MOBILE_SIGNED_BUILD_QUEUE=${result.queue ?? "authorized"}`);
  console.log("MOBILE_SIGNED_BUILD_SUBMIT=disabled");
  console.log("MOBILE_SIGNED_BUILD_UPDATE=disabled");
  console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
  console.log("MOBILE_SIGNED_BUILD_PREFLIGHT=PASS");
}

if (
  process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(
      `MOBILE_SIGNED_BUILD_ERROR=${error?.code ?? "preflight_failed"}`,
    );
    console.error("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
    console.error("MOBILE_SIGNED_BUILD_PREFLIGHT=FAIL");
    process.exitCode = 1;
  });
}
