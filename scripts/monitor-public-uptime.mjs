#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const COMMIT_PATTERN = /^[a-f0-9]{40}$/;

export const DEFAULT_PUBLIC_CHECKS = Object.freeze([
  { name: "landing", path: "/", expectedStatus: 200, kind: "page" },
  { name: "login", path: "/login", expectedStatus: 200, kind: "page" },
  { name: "register", path: "/register", expectedStatus: 200, kind: "page" },
  { name: "referral_terms", path: "/referral-bedingungen", expectedStatus: 200, kind: "page" },
  { name: "health", path: "/api/health", expectedStatus: 200, kind: "health" },
  { name: "version", path: "/api/version", expectedStatus: 200, kind: "version" },
]);

function monitorError(code, details = {}) {
  const error = new Error(code);
  error.code = code;
  error.details = details;
  return error;
}

function normalizeBaseUrl(value) {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" && parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
    throw monitorError("base_url_must_use_https");
  }
  parsed.pathname = parsed.pathname.replace(/\/$/, "");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

async function parseJsonSafely(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw monitorError("invalid_json_response", {
      status: response.status,
      bodyPreview: text.slice(0, 160),
    });
  }
}

export function validateHealthPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw monitorError("invalid_health_payload");
  }
  if (payload.status !== "healthy") {
    throw monitorError("health_not_healthy", { status: payload.status ?? null });
  }
  if (payload.scope !== "public") {
    throw monitorError("health_scope_not_public", { scope: payload.scope ?? null });
  }
  return {
    status: payload.status,
    scope: payload.scope,
  };
}

export function validateVersionPayload(payload, expectations = {}) {
  if (!payload || typeof payload !== "object") {
    throw monitorError("invalid_version_payload");
  }
  if (payload.application !== "fanmind") {
    throw monitorError("version_application_mismatch");
  }
  if (!COMMIT_PATTERN.test(String(payload.releaseCommit ?? ""))) {
    throw monitorError("invalid_release_commit");
  }
  const expectedCommit = String(expectations.expectedCommit ?? "")
    .trim()
    .toLowerCase();
  if (expectedCommit && !COMMIT_PATTERN.test(expectedCommit)) {
    throw monitorError("invalid_expected_release_commit");
  }
  if (expectedCommit && payload.releaseCommit !== expectedCommit) {
    throw monitorError("version_release_mismatch");
  }
  if (payload.environment !== "production") {
    throw monitorError("version_environment_mismatch", {
      environment: payload.environment ?? null,
    });
  }
  const expectedRuntimeEnvironment = String(
    expectations.expectedRuntimeEnvironment ?? "",
  )
    .trim()
    .toLowerCase();
  if (
    expectedRuntimeEnvironment
    && !["production", "staging", "test", "development"].includes(
      expectedRuntimeEnvironment,
    )
  ) {
    throw monitorError("invalid_expected_runtime_environment");
  }
  if (
    expectedRuntimeEnvironment
    && payload.runtimeEnvironment !== expectedRuntimeEnvironment
  ) {
    throw monitorError("version_runtime_environment_mismatch", {
      runtimeEnvironment: payload.runtimeEnvironment ?? null,
    });
  }
  return {
    application: payload.application,
    releaseCommit: payload.releaseCommit,
    environment: payload.environment,
  };
}

async function fetchWithRetry(url, options) {
  let lastError;
  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    const startedAt = Date.now();
    try {
      const response = await fetch(url, {
        redirect: "follow",
        cache: "no-store",
        headers: {
          "User-Agent": "FanMind-Uptime-Monitor/1.0",
          Accept: "application/json,text/html;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(options.timeoutMs),
      });
      return {
        response,
        attempt,
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      lastError = error;
      if (attempt < options.attempts) {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, options.retryDelayMs));
      }
    }
  }
  throw monitorError("network_request_failed", {
    message: lastError instanceof Error ? lastError.message : "unknown",
  });
}

export async function runPublicUptimeChecks(input = {}) {
  const baseUrl = normalizeBaseUrl(input.baseUrl ?? "https://fanmind.ch");
  const checks = input.checks ?? DEFAULT_PUBLIC_CHECKS;
  const expectedRuntimeEnvironment = input.expectedRuntimeEnvironment ?? "";
  const timeoutMs = input.timeoutMs ?? 15000;
  const attempts = input.attempts ?? 3;
  const retryDelayMs = input.retryDelayMs ?? 1500;
  const results = [];

  for (const check of checks) {
    const url = new URL(check.path, `${baseUrl}/`).toString();
    const startedAt = new Date().toISOString();
    try {
      const { response, attempt, durationMs } = await fetchWithRetry(url, {
        timeoutMs,
        attempts,
        retryDelayMs,
      });
      if (response.status !== check.expectedStatus) {
        throw monitorError("unexpected_http_status", {
          expected: check.expectedStatus,
          actual: response.status,
        });
      }

      let details = null;
      if (check.kind === "health") {
        details = validateHealthPayload(await parseJsonSafely(response));
      } else if (check.kind === "version") {
        details = validateVersionPayload(await parseJsonSafely(response), {
          expectedRuntimeEnvironment,
        });
      } else {
        await response.arrayBuffer();
      }

      results.push({
        name: check.name,
        path: check.path,
        ok: true,
        status: response.status,
        durationMs,
        attempt,
        startedAt,
        details,
      });
    } catch (error) {
      results.push({
        name: check.name,
        path: check.path,
        ok: false,
        status: null,
        durationMs: null,
        attempt: attempts,
        startedAt,
        error: error?.code ?? error?.message ?? "unknown_check_failure",
        errorDetails: error?.details ?? null,
      });
    }
  }

  const failed = results.filter((result) => !result.ok);
  const versionResult = results.find((result) => result.name === "version" && result.ok);
  return {
    ok: failed.length === 0,
    checkedAt: new Date().toISOString(),
    baseUrl,
    releaseCommit: versionResult?.details?.releaseCommit ?? null,
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    results,
  };
}

function parseCli(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--base-url") options.baseUrl = argv[++index];
    else if (value === "--expected-runtime-environment") {
      const expectedRuntimeEnvironment = argv[index + 1];
      if (
        !expectedRuntimeEnvironment
        || expectedRuntimeEnvironment.startsWith("--")
      ) {
        throw monitorError("missing_argument_value", { argument: value });
      }
      options.expectedRuntimeEnvironment = expectedRuntimeEnvironment;
      index += 1;
    }
    else if (value === "--timeout-ms") options.timeoutMs = Number(argv[++index]);
    else if (value === "--attempts") options.attempts = Number(argv[++index]);
    else if (value === "--json") options.json = true;
    else if (value === "--help") options.help = true;
    else throw monitorError("unknown_argument", { argument: value });
  }
  return options;
}

function usage() {
  return `FanMind public uptime monitor

Usage:
  node scripts/monitor-public-uptime.mjs [--base-url https://fanmind.ch] [--expected-runtime-environment production] [--json]

The monitor performs read-only GET requests against public FanMind routes.`;
}

async function main() {
  const options = parseCli(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  const report = await runPublicUptimeChecks(options);
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`FanMind uptime: ${report.ok ? "OK" : "FAILED"}`);
    console.log(`release_commit=${report.releaseCommit ?? "unknown"}`);
    for (const result of report.results) {
      console.log(
        `${result.name}=${result.ok ? "ok" : `failed:${result.error}`} ` +
          `status=${result.status ?? "none"} duration_ms=${result.durationMs ?? "none"}`,
      );
    }
  }
  if (!report.ok) process.exitCode = 1;
}

const isDirectRun = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;

if (isDirectRun) {
  main().catch((error) => {
    console.error(`FanMind uptime monitor failed: ${error?.code ?? error?.message ?? "unknown"}`);
    process.exitCode = 1;
  });
}
