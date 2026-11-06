#!/usr/bin/env node

import { hostname } from "node:os";
import { pathToFileURL } from "node:url";

const VERSION = "meta-catchup-worker-1";
const DEFAULT_POLL_MS = 5_000;
const DEFAULT_LEASE_SECONDS = 120;
const MAX_RESPONSE_BYTES = 2_048;
const META_CATCHUP_WORKER_SECRET_MIN_LENGTH = 32;
const META_CATCHUP_MAX_ATTEMPTS = 5;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const WORKER_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,95}$/u;
const META_CATCHUP_OUTCOMES = new Set([
  "success",
  "retry",
  "terminal",
  "cancelled",
]);
const META_CATCHUP_ERROR_CODES = new Set([
  "catchup_request_failed",
  "connection_unavailable",
  "entitlement_unavailable",
  "internal_route_unavailable",
  "meta_sync_failed",
  "worker_response_invalid",
]);

let stopping = false;

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isMetaCatchupQueueEnabled(environment = process.env) {
  return clean(environment.FANMIND_META_CATCHUP_QUEUE_ENABLED) === "true";
}

function normalizeMetaCatchupWorkerResponse(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const disposition = clean(value.disposition);
  const errorCode = value.errorCode === null ? null : clean(value.errorCode);
  if (!META_CATCHUP_OUTCOMES.has(disposition)) return null;
  if (disposition === "success") {
    return errorCode === null ? { disposition, errorCode: null } : null;
  }
  if (!META_CATCHUP_ERROR_CODES.has(errorCode)) return null;
  return { disposition, errorCode };
}

function retrySecondsForMetaCatchupAttempt(value) {
  const attempt = Number.isInteger(value) ? value : 1;
  return [30, 120, 600, 1800, 3600][
    Math.min(Math.max(attempt, 1), META_CATCHUP_MAX_ATTEMPTS) - 1
  ];
}

function required(name, environment = process.env) {
  const value = clean(environment[name]);
  if (!value) throw new Error("worker_configuration_missing");
  return value;
}

export function normalizeMetaCatchupWorkerId(value, host = hostname(), pid = process.pid) {
  const configured = clean(value).toLowerCase();
  if (WORKER_ID_PATTERN.test(configured)) return configured;
  const safeHost = clean(host)
    .toLowerCase()
    .replace(/[^a-z0-9-]/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 48) || "worker";
  return `fanmind-${safeHost}-${pid}-meta-catchup`.slice(0, 96);
}

export function normalizeClaimedMetaCatchupJob(response, expectedWorkerId) {
  const job = Array.isArray(response) ? response[0] : response;
  if (!job || typeof job !== "object" || Array.isArray(job)) return null;
  if (
    !UUID_PATTERN.test(clean(job.id)) ||
    !UUID_PATTERN.test(clean(job.lease_token)) ||
    clean(job.worker_id) !== expectedWorkerId ||
    clean(job.status) !== "claimed" ||
    !Number.isInteger(job.attempt_count) ||
    job.attempt_count < 1 ||
    job.attempt_count > META_CATCHUP_MAX_ATTEMPTS
  ) {
    return null;
  }
  return {
    id: clean(job.id).toLowerCase(),
    leaseToken: clean(job.lease_token).toLowerCase(),
    attemptCount: job.attempt_count,
  };
}

export function metaCatchupPollMs(environment = process.env) {
  const value = Number(environment.FANMIND_META_CATCHUP_POLL_MS);
  return Number.isInteger(value) && value >= 1_000 && value <= 60_000
    ? value
    : DEFAULT_POLL_MS;
}

export function normalizeMetaCatchupWorkerError(error) {
  const code = error instanceof Error ? error.message : "";
  return new Set([
    "catchup_request_failed",
    "internal_route_unavailable",
    "supabase_request_failed",
    "worker_configuration_missing",
    "worker_response_invalid",
  ]).has(code)
    ? code
    : "catchup_request_failed";
}

function strictOrigin(value) {
  let url;
  try {
    url = new URL(clean(value));
  } catch {
    throw new Error("worker_configuration_missing");
  }
  const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (
    (!local && url.protocol !== "https:") ||
    (local && !new Set(["http:", "https:"]).has(url.protocol)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "")
  ) {
    throw new Error("worker_configuration_missing");
  }
  return url.origin;
}

function runtimeConfiguration(environment = process.env) {
  if (!isMetaCatchupQueueEnabled(environment)) {
    throw new Error("worker_configuration_missing");
  }
  const supabaseOrigin = strictOrigin(required("NEXT_PUBLIC_SUPABASE_URL", environment));
  const internalOrigin = strictOrigin(
    required("FANMIND_META_CATCHUP_INTERNAL_ORIGIN", environment),
  );
  const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY", environment);
  const workerSecret = required("FANMIND_META_CATCHUP_WORKER_SECRET", environment);
  if (serviceKey.length < 32 || workerSecret.length < META_CATCHUP_WORKER_SECRET_MIN_LENGTH) {
    throw new Error("worker_configuration_missing");
  }
  return { supabaseOrigin, internalOrigin, serviceKey, workerSecret };
}

function fixedLog(level, event, metadata = {}) {
  const safe = {};
  if (Number.isInteger(metadata.attemptCount)) safe.attempt_count = metadata.attemptCount;
  if (typeof metadata.disposition === "string") safe.disposition = metadata.disposition;
  if (typeof metadata.errorCode === "string") safe.error_code = metadata.errorCode;
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level,
      event,
      ...safe,
    }),
  );
}

async function readBoundedResponseJson(response) {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error("worker_response_invalid");
  }
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) {
    throw new Error("worker_response_invalid");
  }
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error("worker_response_invalid");
  }
}

async function rpc(configuration, name, body) {
  const response = await fetch(
    `${configuration.supabaseOrigin}/rest/v1/rpc/${name}`,
    {
      method: "POST",
      headers: {
        apikey: configuration.serviceKey,
        Authorization: `Bearer ${configuration.serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    },
  ).catch(() => {
    throw new Error("supabase_request_failed");
  });
  if (!response.ok) throw new Error("supabase_request_failed");
  return readBoundedResponseJson(response);
}

async function callInternalRoute(configuration, job, workerId) {
  const response = await fetch(
    `${configuration.internalOrigin}/api/internal/meta-catchup`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${configuration.workerSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jobId: job.id,
        workerId,
        leaseToken: job.leaseToken,
      }),
      signal: AbortSignal.timeout(60_000),
    },
  ).catch(() => {
    throw new Error("internal_route_unavailable");
  });
  if (!response.ok) throw new Error("internal_route_unavailable");
  const normalized = normalizeMetaCatchupWorkerResponse(
    await readBoundedResponseJson(response),
  );
  if (!normalized) throw new Error("worker_response_invalid");
  return normalized;
}

async function claim(configuration, workerId) {
  const response = await rpc(
    configuration,
    "claim_meta_conversation_catchup_job",
    { p_worker_id: workerId, p_lease_seconds: DEFAULT_LEASE_SECONDS },
  );
  return normalizeClaimedMetaCatchupJob(response, workerId);
}

async function finish(configuration, workerId, job, result) {
  const response = await rpc(
    configuration,
    "finish_meta_conversation_catchup_job",
    {
      p_job_id: job.id,
      p_worker_id: workerId,
      p_lease_token: job.leaseToken,
      p_outcome: result.disposition,
      p_error_code: result.errorCode,
      p_retry_seconds: retrySecondsForMetaCatchupAttempt(job.attemptCount),
    },
  );
  return Array.isArray(response) && response.length === 1;
}

export async function processOneMetaCatchupJob(configuration, workerId) {
  const job = await claim(configuration, workerId);
  if (!job) return false;
  fixedLog("info", "catchup_claimed", { attemptCount: job.attemptCount });

  let result;
  try {
    result = await callInternalRoute(configuration, job, workerId);
  } catch (error) {
    const normalized = normalizeMetaCatchupWorkerError(error);
    result = {
      disposition: "retry",
      errorCode:
        normalized === "worker_response_invalid"
          ? "worker_response_invalid"
          : normalized === "internal_route_unavailable"
            ? "internal_route_unavailable"
            : "catchup_request_failed",
    };
  }

  const settled = await finish(configuration, workerId, job, result);
  fixedLog(settled ? "info" : "warn", settled ? "catchup_finished" : "catchup_claim_lost", {
    attemptCount: job.attemptCount,
    disposition: result.disposition,
    errorCode: result.errorCode ?? undefined,
  });
  return true;
}

async function sleep(milliseconds) {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function loop() {
  const configuration = runtimeConfiguration();
  const workerId = normalizeMetaCatchupWorkerId(
    process.env.FANMIND_META_CATCHUP_WORKER_ID,
  );
  fixedLog("info", "worker_started");
  while (!stopping) {
    try {
      const processed = await processOneMetaCatchupJob(configuration, workerId);
      if (!processed) await sleep(metaCatchupPollMs());
    } catch (error) {
      fixedLog("warn", "worker_iteration_failed", {
        errorCode: normalizeMetaCatchupWorkerError(error),
      });
      await sleep(metaCatchupPollMs());
    }
  }
  fixedLog("info", "worker_stopped");
}

process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  loop().catch((error) => {
    fixedLog("error", "worker_fatal", {
      errorCode: normalizeMetaCatchupWorkerError(error),
    });
    process.exitCode = 2;
  });
}

export { DEFAULT_LEASE_SECONDS, DEFAULT_POLL_MS, VERSION, runtimeConfiguration };
