#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const RUNNER_PATH = resolve(
  REPO_ROOT,
  "scripts/operations/creator-confirmed-chat-learning-migration-runner.mjs",
);
const MAX_VERSION_BYTES = 65_536;

function fail(code) {
  throw new Error(`CREATOR_CONFIRMED_CHAT_STAGING_VERIFY_ERROR=${code}`);
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function reviewedCommit(environment) {
  const value = clean(environment.FANMIND_CREATOR_CONFIRMED_CHAT_REVIEWED_COMMIT).toLowerCase();
  if (!/^[0-9a-f]{40}$/u.test(value)) fail("reviewed_commit_invalid");
  return value;
}

function stagingVersionUrl(environment) {
  if (clean(environment.FANMIND_RUNTIME_ENVIRONMENT).toLowerCase() !== "staging") {
    fail("runtime_environment_invalid");
  }
  if (clean(environment.FANMIND_ENABLE_NON_PRODUCTION_WRITES).toLowerCase() !== "false") {
    fail("write_flag_not_disabled");
  }
  if (
    clean(environment.FANMIND_NON_PRODUCTION_WRITE_ACK) ||
    clean(environment.FANMIND_NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT)
  ) {
    fail("write_acknowledgement_present");
  }

  const raw = clean(environment.NEXT_PUBLIC_APP_URL);
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail("staging_app_url_invalid");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    fail("staging_app_url_invalid");
  }
  if (url.hostname.toLowerCase() === "fanmind.ch") fail("production_app_url_forbidden");
  url.pathname = `${url.pathname.replace(/\/$/u, "")}/api/version`;
  return url;
}

export function validateVersionPayload(payload, expectedCommit) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    fail("version_payload_invalid");
  }
  if (payload.releaseCommit !== expectedCommit) fail("deployed_release_mismatch");
  if (payload.runtimeEnvironment !== "staging") fail("deployed_runtime_mismatch");
}

function defaultRunRunner(environment) {
  return spawnSync(process.execPath, [RUNNER_PATH, "--verify"], {
    cwd: REPO_ROOT,
    env: environment,
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function requireExpectedVerifyOutput(output) {
  const lines = new Set(clean(output).split(/\r?\n/u).filter(Boolean));
  for (const marker of [
    "CREATOR_CONFIRMED_CHAT_SCHEMA_STATE=absent",
    "CREATOR_CONFIRMED_CHAT_SOURCE_STATE=installed",
    "CREATOR_CONFIRMED_CHAT_NEXT=apply",
    "CREATOR_CONFIRMED_CHAT_APPLY=not_requested",
  ]) {
    if (!lines.has(marker)) fail("unexpected_verify_result");
  }
}

export async function verifyConfirmedChatStaging({
  environment = process.env,
  fetchImpl = globalThis.fetch,
  runRunner = defaultRunRunner,
} = {}) {
  if (typeof fetchImpl !== "function") fail("fetch_unavailable");
  const expectedCommit = reviewedCommit(environment);
  const url = stagingVersionUrl(environment);

  let response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      headers: { accept: "application/json" },
    });
  } catch {
    fail("version_request_failed");
  }
  if (!response || response.ok !== true) fail("version_request_failed");

  let body;
  try {
    body = await response.text();
  } catch {
    fail("version_response_unreadable");
  }
  if (!body || Buffer.byteLength(body, "utf8") > MAX_VERSION_BYTES) {
    fail("version_response_invalid");
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    fail("version_payload_invalid");
  }
  validateVersionPayload(payload, expectedCommit);

  const result = runRunner(environment);
  if (!result || result.status !== 0) fail("runner_verify_failed");
  requireExpectedVerifyOutput(result.stdout);

  return [
    `CREATOR_CONFIRMED_CHAT_STAGING_RELEASE=${expectedCommit}`,
    "CREATOR_CONFIRMED_CHAT_STAGING_RELEASE_BINDING=PASS",
    "CREATOR_CONFIRMED_CHAT_STAGING_SCHEMA_STATE=ABSENT",
    "CREATOR_CONFIRMED_CHAT_STAGING_VERIFY=PASS",
    "CREATOR_CONFIRMED_CHAT_STAGING_WRITE_PERFORMED=false",
  ];
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    for (const marker of await verifyConfirmedChatStaging()) console.log(marker);
  } catch (error) {
    const message =
      error instanceof Error &&
      /^CREATOR_CONFIRMED_CHAT_STAGING_VERIFY_ERROR=[a-z0-9_]+$/u.test(error.message)
        ? error.message
        : "CREATOR_CONFIRMED_CHAT_STAGING_VERIFY_ERROR=unexpected_failure";
    console.error(message);
    process.exitCode = 1;
  }
}
