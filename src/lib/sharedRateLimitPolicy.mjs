import crypto from "node:crypto";

const SCOPE_PATTERN = /^[a-z][a-z0-9_.:-]{0,63}$/;
const SUBJECT_HASH_PATTERN = /^[0-9a-f]{64}$/;
const MIN_SECRET_LENGTH = 32;
const MAX_SUBJECT_LENGTH = 4096;
const MIN_WINDOW_MS = 1000;
const MAX_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_REQUESTS = 10000;

class SharedRateLimitPolicyError extends Error {
  constructor(code) {
    super(code);
    this.name = "SharedRateLimitPolicyError";
    this.code = code;
  }
}

function requireScope(scope) {
  const normalized = typeof scope === "string" ? scope.trim() : "";
  if (!SCOPE_PATTERN.test(normalized)) {
    throw new SharedRateLimitPolicyError("invalid_scope");
  }
  return normalized;
}

function requireSubject(subject) {
  const normalized = typeof subject === "string" ? subject.trim() : "";
  if (!normalized || normalized.length > MAX_SUBJECT_LENGTH) {
    throw new SharedRateLimitPolicyError("invalid_subject");
  }
  return normalized;
}

function requireSecret(secret) {
  const normalized = typeof secret === "string" ? secret.trim() : "";
  if (normalized.length < MIN_SECRET_LENGTH) {
    throw new SharedRateLimitPolicyError("secret_unavailable");
  }
  return normalized;
}

function normalizePositiveInteger(value, maximum, code) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new SharedRateLimitPolicyError(code);
  }
  return parsed;
}

function hashSharedRateLimitSubject({ scope, subject, secret }) {
  const normalizedScope = requireScope(scope);
  const normalizedSubject = requireSubject(subject);
  const normalizedSecret = requireSecret(secret);

  return crypto
    .createHmac("sha256", normalizedSecret)
    .update(`fanmind-shared-rate-limit:v1:${normalizedScope}:${normalizedSubject}`)
    .digest("hex");
}

function buildSharedRateLimitRequest({
  scope,
  subject,
  secret,
  maxRequests,
  windowMs,
}) {
  const normalizedScope = requireScope(scope);
  const normalizedWindowMs = normalizePositiveInteger(
    windowMs,
    MAX_WINDOW_MS,
    "invalid_window",
  );
  if (normalizedWindowMs < MIN_WINDOW_MS) {
    throw new SharedRateLimitPolicyError("invalid_window");
  }
  const normalizedMaxRequests = normalizePositiveInteger(
    maxRequests,
    MAX_REQUESTS,
    "invalid_maximum",
  );
  const windowSeconds = Math.ceil(normalizedWindowMs / 1000);

  return {
    p_scope: normalizedScope,
    p_subject_hash: hashSharedRateLimitSubject({
      scope: normalizedScope,
      subject,
      secret,
    }),
    p_window_seconds: windowSeconds,
    p_max_requests: normalizedMaxRequests,
  };
}

function parseSharedRateLimitResponse(payload) {
  const row = Array.isArray(payload) ? payload[0] : payload;
  if (!row || typeof row !== "object") {
    throw new SharedRateLimitPolicyError("invalid_response");
  }

  const allowed = row.allowed;
  const remaining = Number(row.remaining);
  const currentCount = Number(row.current_count);
  const resetAt = Date.parse(String(row.reset_at ?? ""));

  if (
    typeof allowed !== "boolean"
    || !Number.isInteger(remaining)
    || remaining < 0
    || !Number.isInteger(currentCount)
    || currentCount < 1
    || !Number.isFinite(resetAt)
  ) {
    throw new SharedRateLimitPolicyError("invalid_response");
  }

  return {
    allowed,
    remaining,
    resetAt,
    currentCount,
  };
}

export {
  MAX_REQUESTS,
  MAX_SUBJECT_LENGTH,
  MAX_WINDOW_MS,
  MIN_SECRET_LENGTH,
  MIN_WINDOW_MS,
  SCOPE_PATTERN,
  SUBJECT_HASH_PATTERN,
  SharedRateLimitPolicyError,
  buildSharedRateLimitRequest,
  hashSharedRateLimitSubject,
  parseSharedRateLimitResponse,
};
