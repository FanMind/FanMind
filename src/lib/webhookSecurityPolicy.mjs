import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_SECRET_LENGTH = 4096;
const MIN_PRODUCTION_SECRET_LENGTH = 24;
const MAX_DIAGNOSTIC_DEPTH = 5;
const MAX_DIAGNOSTIC_KEYS = 32;
const MAX_DIAGNOSTIC_ARRAY_ITEMS = 16;
const MAX_SAFE_CODE_LENGTH = 64;

const SENSITIVE_KEY_PATTERN =
  /(?:access[_-]?token|refresh[_-]?token|authorization|cookie|password|passwd|secret|signature|api[_-]?key|private[_-]?key|client[_-]?secret|verification[_-]?code|auth[_-]?code|session)/iu;
const IDENTIFIER_KEY_PATTERN =
  /(?:^|[_-])(?:id|mid|psid|sender|recipient|page|chat|thread|comment|post|message|user|account)(?:$|[_-])/iu;
const TEXT_KEY_PATTERN =
  /(?:text|message|caption|content|body|name|username|email|phone|title|description|excerpt)/iu;

const WEBHOOK_ERROR_CODES = Object.freeze([
  "secret_not_configured",
  "verify_token_not_configured",
  "invalid_verify_token",
  "invalid_signature",
  "invalid_json",
  "invalid_payload",
  "unsupported_event",
  "empty_content",
  "content_missing",
  "unmapped_page",
  "page_identifier_missing",
  "workspace_not_configured",
  "workspace_lookup_failed",
  "connection_lookup_failed",
  "connection_unavailable",
  "connection_ambiguous",
  "unmapped_phone_number",
  "schema_not_ready",
  "processing_blocked",
  "idempotency_claim_failed",
  "idempotency_conflict",
  "idempotency_in_progress",
  "idempotency_exhausted",
  "stale_lease",
  "catchup_enqueue_failed",
  "fallback_workspace_failed",
  "message_persist_failed",
  "conversation_sync_failed",
  "diagnostic_persist_failed",
  "processing_failed",
]);
const WEBHOOK_ERROR_CODE_SET = new Set(WEBHOOK_ERROR_CODES);

function isProductionRuntime(environment = process.env) {
  const explicit = String(
    environment.FANMIND_RUNTIME_ENVIRONMENT ?? environment.NODE_ENV ?? "",
  )
    .trim()
    .toLowerCase();
  return explicit === "production";
}

function normalizeConfiguredSecret(value) {
  const secret = typeof value === "string" ? value.trim() : "";
  if (!secret || secret.length > MAX_SECRET_LENGTH) return null;
  return secret;
}

function evaluateWebhookSecret({
  secret,
  environment = process.env,
  minimumLength = MIN_PRODUCTION_SECRET_LENGTH,
}) {
  const normalized = normalizeConfiguredSecret(secret);
  if (!normalized) {
    return {
      configured: false,
      acceptable: !isProductionRuntime(environment),
      secret: null,
      errorCode: isProductionRuntime(environment)
        ? "secret_not_configured"
        : null,
    };
  }

  if (isProductionRuntime(environment) && normalized.length < minimumLength) {
    return {
      configured: true,
      acceptable: false,
      secret: null,
      errorCode: "secret_not_configured",
    };
  }

  return {
    configured: true,
    acceptable: true,
    secret: normalized,
    errorCode: null,
  };
}

function timingSafeTextEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  if (
    !left ||
    !right ||
    left.length > MAX_SECRET_LENGTH ||
    right.length > MAX_SECRET_LENGTH
  ) {
    return false;
  }
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function validateStaticWebhookSecret({
  configuredSecret,
  receivedSecret,
  environment = process.env,
}) {
  const evaluation = evaluateWebhookSecret({
    secret: configuredSecret,
    environment,
  });
  if (!evaluation.acceptable) {
    return { ok: false, errorCode: evaluation.errorCode };
  }
  if (!evaluation.configured && !isProductionRuntime(environment)) {
    return { ok: true, errorCode: null };
  }
  if (
    !evaluation.secret ||
    !timingSafeTextEqual(evaluation.secret, receivedSecret)
  ) {
    return { ok: false, errorCode: "invalid_signature" };
  }
  return { ok: true, errorCode: null };
}

function validateMetaHmacSignature({
  rawBody,
  signatureHeader,
  configuredSecret,
  environment = process.env,
}) {
  const evaluation = evaluateWebhookSecret({
    secret: configuredSecret,
    environment,
  });
  if (!evaluation.acceptable) {
    return { ok: false, errorCode: evaluation.errorCode };
  }
  if (!evaluation.configured && !isProductionRuntime(environment)) {
    return { ok: true, errorCode: null };
  }
  if (
    !evaluation.secret ||
    typeof signatureHeader !== "string" ||
    !/^sha256=[0-9a-f]{64}$/u.test(signatureHeader)
  ) {
    return { ok: false, errorCode: "invalid_signature" };
  }

  const expected = createHmac("sha256", evaluation.secret)
    .update(typeof rawBody === "string" ? rawBody : "")
    .digest("hex");
  const received = signatureHeader.slice("sha256=".length);
  const ok = timingSafeTextEqual(expected, received);
  return { ok, errorCode: ok ? null : "invalid_signature" };
}

function validateMetaVerifyToken({
  configuredToken,
  receivedToken,
  environment = process.env,
}) {
  const normalized = normalizeConfiguredSecret(configuredToken);
  if (!normalized) {
    return {
      ok: false,
      errorCode: isProductionRuntime(environment)
        ? "verify_token_not_configured"
        : "invalid_verify_token",
    };
  }
  const ok = timingSafeTextEqual(normalized, receivedToken);
  return { ok, errorCode: ok ? null : "invalid_verify_token" };
}

function normalizeWebhookErrorCode(value, fallback = "processing_failed") {
  const candidate =
    typeof value === "string" ? value.trim().toLowerCase() : "";
  if (
    candidate.length <= MAX_SAFE_CODE_LENGTH &&
    /^[a-z][a-z0-9_]*$/u.test(candidate) &&
    WEBHOOK_ERROR_CODE_SET.has(candidate)
  ) {
    return candidate;
  }
  return WEBHOOK_ERROR_CODE_SET.has(fallback)
    ? fallback
    : "processing_failed";
}

function classifyDiagnosticString(key) {
  if (SENSITIVE_KEY_PATTERN.test(key)) return "[redacted]";
  if (IDENTIFIER_KEY_PATTERN.test(key)) return "[identifier_present]";
  if (TEXT_KEY_PATTERN.test(key)) return "[text_present]";
  if (/(?:url|uri|link|permalink)/iu.test(key)) return "[url_present]";
  return "[string_present]";
}

function minimizeWebhookDiagnosticPayload(value, options = {}, state = {}) {
  const depth = Number(state.depth ?? 0);
  const key = String(state.key ?? "");
  const maxDepth = Number(options.maxDepth ?? MAX_DIAGNOSTIC_DEPTH);
  const maxKeys = Number(options.maxKeys ?? MAX_DIAGNOSTIC_KEYS);
  const maxArrayItems = Number(
    options.maxArrayItems ?? MAX_DIAGNOSTIC_ARRAY_ITEMS,
  );

  if (SENSITIVE_KEY_PATTERN.test(key)) return "[redacted]";
  if (value === null || value === undefined) return null;
  if (depth >= maxDepth) return "[truncated]";
  if (typeof value === "string") return classifyDiagnosticString(key);
  if (typeof value === "number") {
    return Number.isFinite(value) ? "[number]" : null;
  }
  if (typeof value === "boolean") return value;
  if (typeof value === "bigint") return "[number]";
  if (Array.isArray(value)) {
    const items = value
      .slice(0, maxArrayItems)
      .map((item) =>
        minimizeWebhookDiagnosticPayload(item, options, {
          depth: depth + 1,
          key,
        }),
      );
    if (value.length > maxArrayItems) items.push("[truncated_items]");
    return items;
  }
  if (typeof value !== "object") return "[unsupported]";

  const result = {};
  const entries = Object.entries(value).slice(0, maxKeys);
  for (const [childKey, childValue] of entries) {
    result[childKey] = minimizeWebhookDiagnosticPayload(childValue, options, {
      depth: depth + 1,
      key: childKey,
    });
  }
  if (Object.keys(value).length > maxKeys) result.__truncated_keys = true;
  return result;
}

function normalizeWhatsAppCloudDiagnosticPayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const expectedKeys = [
    "connector_whatsapp_cloud",
    "duplicate_count",
    "event_count",
    "processing_blocked",
    "saved_count",
    "schema_ready",
    "schema_version",
    "unsupported_count",
  ];
  if (
    Object.keys(value).sort().join("|") !== expectedKeys.join("|") ||
    value.schema_version !== 1 ||
    value.connector_whatsapp_cloud !== true ||
    typeof value.processing_blocked !== "boolean" ||
    typeof value.schema_ready !== "boolean"
  ) {
    return null;
  }
  for (const key of [
    "event_count",
    "saved_count",
    "duplicate_count",
    "unsupported_count",
  ]) {
    if (!Number.isInteger(value[key]) || value[key] < 0 || value[key] > 25) {
      return null;
    }
  }
  return Object.freeze({
    schema_version: 1,
    connector_whatsapp_cloud: true,
    event_count: value.event_count,
    saved_count: value.saved_count,
    duplicate_count: value.duplicate_count,
    unsupported_count: value.unsupported_count,
    processing_blocked: value.processing_blocked,
    schema_ready: value.schema_ready,
  });
}

function buildMetaWebhookDiagnosticPayload(event) {
  const attachments = Array.isArray(event?.attachments)
    ? event.attachments
    : [];
  return {
    schema_version: 1,
    platform:
      event?.sourcePlatform === "instagram" ? "instagram" : "facebook",
    event_type:
      typeof event?.eventType === "string" ? event.eventType : "unknown",
    message_type:
      typeof event?.messageType === "string" ? event.messageType : "unknown",
    direction:
      event?.direction === "outbound" ? "outbound" : "inbound",
    message_kind:
      typeof event?.messageKind === "string"
        ? event.messageKind
        : "unknown",
    has_text: Boolean(
      typeof event?.content === "string" && event.content.trim().length,
    ),
    attachment_count: Math.min(attachments.length, 100),
    attachment_types: [
      ...new Set(
        attachments
          .map((attachment) => String(attachment?.type ?? "unknown"))
          .filter((type) => /^[a-z][a-z0-9_-]{0,31}$/u.test(type)),
      ),
    ].slice(0, 16),
    has_source_url: Boolean(event?.sourceUrl),
    has_reply_target_url: Boolean(event?.replyTargetUrl),
    identifiers_present: {
      page: Boolean(event?.pageId),
      sender: Boolean(event?.senderId),
      recipient: Boolean(event?.recipientId),
      message: Boolean(event?.externalMessageId),
      thread: Boolean(event?.externalThreadId),
      post: Boolean(event?.externalPostId),
      comment: Boolean(event?.externalCommentId),
    },
    provider_shape: minimizeWebhookDiagnosticPayload(event?.rawEvent),
  };
}

export {
  MAX_DIAGNOSTIC_ARRAY_ITEMS,
  MAX_DIAGNOSTIC_DEPTH,
  MAX_DIAGNOSTIC_KEYS,
  MIN_PRODUCTION_SECRET_LENGTH,
  WEBHOOK_ERROR_CODES,
  buildMetaWebhookDiagnosticPayload,
  evaluateWebhookSecret,
  isProductionRuntime,
  minimizeWebhookDiagnosticPayload,
  normalizeWhatsAppCloudDiagnosticPayload,
  normalizeWebhookErrorCode,
  timingSafeTextEqual,
  validateMetaHmacSignature,
  validateMetaVerifyToken,
  validateStaticWebhookSecret,
};
