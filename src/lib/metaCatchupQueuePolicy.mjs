export const META_CATCHUP_WORKER_SECRET_MIN_LENGTH = 32;
export const META_CATCHUP_MAX_ATTEMPTS = 5;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const WORKER_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,95}$/u;
const OUTCOMES = new Set(["success", "retry", "terminal", "cancelled"]);
const ERROR_CODES = new Set([
  "catchup_request_failed",
  "connection_unavailable",
  "entitlement_unavailable",
  "internal_route_unavailable",
  "meta_sync_failed",
  "worker_response_invalid",
]);

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function isMetaCatchupQueueEnabled(environment = process.env) {
  return clean(environment.FANMIND_META_CATCHUP_QUEUE_ENABLED) === "true";
}

export function validateMetaCatchupWorkerRequestBody(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return Object.freeze({ ok: false, value: null });
  }
  const jobId = clean(value.jobId).toLowerCase();
  const workerId = clean(value.workerId).toLowerCase();
  const leaseToken = clean(value.leaseToken).toLowerCase();
  if (
    !UUID_PATTERN.test(jobId) ||
    !WORKER_ID_PATTERN.test(workerId) ||
    !UUID_PATTERN.test(leaseToken)
  ) {
    return Object.freeze({ ok: false, value: null });
  }
  return Object.freeze({
    ok: true,
    value: Object.freeze({ jobId, workerId, leaseToken }),
  });
}

export function normalizeMetaCatchupWorkerResponse(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const disposition = clean(value.disposition);
  const errorCode = value.errorCode === null ? null : clean(value.errorCode);
  if (!OUTCOMES.has(disposition)) return null;
  if (disposition === "success") {
    return errorCode === null ? { disposition, errorCode: null } : null;
  }
  if (!ERROR_CODES.has(errorCode)) return null;
  return { disposition, errorCode };
}

export function retrySecondsForMetaCatchupAttempt(value) {
  const attempt = Number.isInteger(value) ? value : 1;
  return [30, 120, 600, 1800, 3600][
    Math.min(Math.max(attempt, 1), META_CATCHUP_MAX_ATTEMPTS) - 1
  ];
}

export { ERROR_CODES as META_CATCHUP_ERROR_CODES, UUID_PATTERN, WORKER_ID_PATTERN };
