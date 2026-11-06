import crypto from "node:crypto";

const PUBLIC_INSTALLATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SUBJECT_HASH_PATTERN = /^[0-9a-f]{64}$/;
const CLIENT_MESSAGE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WEBSITE_CHAT_EMAIL_PATTERN =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_EMAIL_LENGTH = 254;
const MAX_BODY_BYTES = 12_000;
const MIN_SESSION_TTL_MINUTES = 5;
const MAX_SESSION_TTL_MINUTES = 1440;
const WEBSITE_CHAT_INSTALLATION_HEADER = "x-fanmind-installation";
const WEBSITE_CHAT_INSTALLATION_QUERY = "installation";

export class WebsiteChatPolicyError extends Error {
  constructor(code) {
    super(code);
    this.name = "WebsiteChatPolicyError";
    this.code = code;
  }
}

export function normalizeWebsiteChatOrigin(value) {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate || candidate.length > 253) {
    throw new WebsiteChatPolicyError("origin_required");
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new WebsiteChatPolicyError("origin_invalid");
  }

  if (
    parsed.protocol !== "https:"
    || parsed.username
    || parsed.password
    || parsed.pathname !== "/"
    || parsed.search
    || parsed.hash
    || !parsed.hostname
  ) {
    throw new WebsiteChatPolicyError("origin_invalid");
  }

  return parsed.origin.toLowerCase();
}

export function requireAllowedWebsiteChatOrigin(value, allowedOrigins) {
  const origin = normalizeWebsiteChatOrigin(value);
  if (!Array.isArray(allowedOrigins) || allowedOrigins.length === 0) {
    throw new WebsiteChatPolicyError("installation_unavailable");
  }
  const normalized = new Set(
    allowedOrigins.map((allowed) => normalizeWebsiteChatOrigin(allowed)),
  );
  if (!normalized.has(origin)) {
    throw new WebsiteChatPolicyError("origin_forbidden");
  }
  return origin;
}

export function requirePublicInstallationId(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!PUBLIC_INSTALLATION_ID_PATTERN.test(normalized)) {
    throw new WebsiteChatPolicyError("installation_invalid");
  }
  return normalized.toLowerCase();
}

export function createWebsiteChatSessionToken(randomBytes = crypto.randomBytes) {
  const token = randomBytes(32).toString("base64url");
  if (!SESSION_TOKEN_PATTERN.test(token)) {
    throw new WebsiteChatPolicyError("session_generation_failed");
  }
  return token;
}

export function hashWebsiteChatSessionToken({ token, secret }) {
  const normalizedToken = typeof token === "string" ? token.trim() : "";
  const normalizedSecret = typeof secret === "string" ? secret.trim() : "";
  if (!SESSION_TOKEN_PATTERN.test(normalizedToken)) {
    throw new WebsiteChatPolicyError("session_invalid");
  }
  if (normalizedSecret.length < 32) {
    throw new WebsiteChatPolicyError("session_secret_unavailable");
  }
  return crypto
    .createHmac("sha256", normalizedSecret)
    .update(`fanmind-website-chat-session:v1:${normalizedToken}`)
    .digest("hex");
}

export function normalizeWebsiteChatMessage(value) {
  if (typeof value !== "string") {
    throw new WebsiteChatPolicyError("message_invalid");
  }
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  if (!normalized || normalized.length > MAX_MESSAGE_LENGTH) {
    throw new WebsiteChatPolicyError("message_invalid");
  }
  return normalized;
}

export function requireWebsiteChatClientMessageId(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!CLIENT_MESSAGE_ID_PATTERN.test(normalized)) {
    throw new WebsiteChatPolicyError("client_message_id_invalid");
  }
  return normalized.toLowerCase();
}

export function normalizeWebsiteChatEmail(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (
    !normalized
    || normalized.length > MAX_EMAIL_LENGTH
    || /\s/u.test(normalized)
    || !WEBSITE_CHAT_EMAIL_PATTERN.test(normalized)
  ) {
    throw new WebsiteChatPolicyError("email_invalid");
  }
  return normalized;
}

export function requireWebsiteChatHandoffConsent(input, expectedVersion) {
  let version;
  try {
    version = requireConsent(input, expectedVersion);
  } catch {
    throw new WebsiteChatPolicyError("handoff_consent_required");
  }
  if (input?.purpose !== "human_reply_by_email") {
    throw new WebsiteChatPolicyError("handoff_consent_required");
  }
  return version;
}

export function requireConsent(input, expectedVersion) {
  const version = typeof input?.version === "string" ? input.version.trim() : "";
  if (input?.granted !== true || !version || version !== expectedVersion) {
    throw new WebsiteChatPolicyError("consent_required");
  }
  return version;
}

export function normalizeSessionTtlMinutes(value) {
  const parsed = Number(value);
  if (
    !Number.isInteger(parsed)
    || parsed < MIN_SESSION_TTL_MINUTES
    || parsed > MAX_SESSION_TTL_MINUTES
  ) {
    throw new WebsiteChatPolicyError("session_ttl_invalid");
  }
  return parsed;
}

export function requireWebsiteChatPreflight(input, allowedHeaders) {
  const method = typeof input?.method === "string" ? input.method.trim().toUpperCase() : "";
  if (method !== "POST") {
    throw new WebsiteChatPolicyError("preflight_method_forbidden");
  }
  const allowed = new Set(
    Array.isArray(allowedHeaders)
      ? allowedHeaders.map((header) => String(header).trim().toLowerCase()).filter(Boolean)
      : [],
  );
  const requested = typeof input?.requestedHeaders === "string"
    ? input.requestedHeaders.split(",").map((header) => header.trim().toLowerCase()).filter(Boolean)
    : [];
  if (!requested.length || requested.some((header) => !allowed.has(header))) {
    throw new WebsiteChatPolicyError("preflight_headers_forbidden");
  }
  return requested;
}

export {
  CLIENT_MESSAGE_ID_PATTERN,
  MAX_EMAIL_LENGTH,
  MAX_BODY_BYTES,
  MAX_MESSAGE_LENGTH,
  MAX_SESSION_TTL_MINUTES,
  MIN_SESSION_TTL_MINUTES,
  PUBLIC_INSTALLATION_ID_PATTERN,
  SESSION_TOKEN_PATTERN,
  SUBJECT_HASH_PATTERN,
  WEBSITE_CHAT_EMAIL_PATTERN,
  WEBSITE_CHAT_INSTALLATION_HEADER,
  WEBSITE_CHAT_INSTALLATION_QUERY,
};
