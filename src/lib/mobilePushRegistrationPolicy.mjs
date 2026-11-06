export const MOBILE_PUSH_ACTIONS = Object.freeze({
  status: "status",
  register: "register",
  unregister: "unregister",
});

export const MOBILE_PUSH_REGISTRATION_DAYS = 30;
export const MOBILE_PUSH_CLIENT_HEADER = "mobile";
export const MOBILE_PUSH_MAX_REQUEST_BYTES = 4096;
export const MOBILE_PUSH_EAS_PROJECT_ID_ENV =
  "FANMIND_MOBILE_PUSH_EAS_PROJECT_ID";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EXPO_PUSH_TOKEN_PATTERN =
  /^(?:Exponent|Expo)PushToken\[[A-Za-z0-9_-]{16,220}\]$/u;

export class MobilePushRegistrationPolicyError extends Error {
  constructor(code) {
    super(code);
    this.name = "MobilePushRegistrationPolicyError";
    this.code = code;
  }
}

function configuredProjectId(environment) {
  const value = String(
    environment?.[MOBILE_PUSH_EAS_PROJECT_ID_ENV] ?? "",
  )
    .trim()
    .toLowerCase();
  if (!UUID_PATTERN.test(value)) {
    throw new MobilePushRegistrationPolicyError(
      "push_project_not_configured",
    );
  }
  return value;
}

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  return (
    keys.length === expected.length &&
    keys.every((key, index) => key === [...expected].sort()[index])
  );
}

export function validateExpectedMobilePushProjectId(
  projectId,
  environment = process.env,
) {
  const expectedProjectId = configuredProjectId(environment);
  if (projectId !== expectedProjectId) {
    throw new MobilePushRegistrationPolicyError("push_project_mismatch");
  }
  return expectedProjectId;
}

export async function readBoundedMobilePushJson(request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!/^application\/json(?:\s*;|$)/u.test(contentType)) {
    throw new MobilePushRegistrationPolicyError("invalid_content_type");
  }
  const contentEncoding =
    request.headers.get("content-encoding")?.trim().toLowerCase() ?? "";
  if (contentEncoding && contentEncoding !== "identity") {
    throw new MobilePushRegistrationPolicyError("invalid_content_encoding");
  }

  const rawContentLength = request.headers.get("content-length")?.trim();
  let declaredLength = null;
  if (rawContentLength) {
    if (!/^(?:0|[1-9][0-9]*)$/u.test(rawContentLength)) {
      throw new MobilePushRegistrationPolicyError("invalid_content_length");
    }
    declaredLength = Number(rawContentLength);
    if (
      !Number.isSafeInteger(declaredLength) ||
      declaredLength > MOBILE_PUSH_MAX_REQUEST_BYTES
    ) {
      throw new MobilePushRegistrationPolicyError("request_too_large");
    }
  }

  if (!request.body) {
    throw new MobilePushRegistrationPolicyError("invalid_request");
  }

  const reader = request.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) {
        throw new MobilePushRegistrationPolicyError("invalid_request");
      }
      totalBytes += value.byteLength;
      if (totalBytes > MOBILE_PUSH_MAX_REQUEST_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new MobilePushRegistrationPolicyError("request_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (
    totalBytes === 0 ||
    (declaredLength !== null && totalBytes !== declaredLength)
  ) {
    throw new MobilePushRegistrationPolicyError("invalid_request");
  }

  const payload = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    payload.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let raw;
  try {
    raw = new TextDecoder("utf-8", { fatal: true }).decode(payload);
  } catch {
    throw new MobilePushRegistrationPolicyError("invalid_request");
  }
  return JSON.parse(raw);
}

export function validateMobilePushAction(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new MobilePushRegistrationPolicyError("invalid_request");
  }

  if (
    value.action === MOBILE_PUSH_ACTIONS.status ||
    value.action === MOBILE_PUSH_ACTIONS.unregister
  ) {
    if (!exactKeys(value, ["action"])) {
      throw new MobilePushRegistrationPolicyError("invalid_request");
    }
    return { action: value.action };
  }

  if (value.action !== MOBILE_PUSH_ACTIONS.register) {
    throw new MobilePushRegistrationPolicyError("invalid_action");
  }
  if (!exactKeys(value, ["action", "platform", "projectId", "token"])) {
    throw new MobilePushRegistrationPolicyError("invalid_request");
  }

  const token = typeof value.token === "string" ? value.token.trim() : "";
  const projectId =
    typeof value.projectId === "string" ? value.projectId.trim().toLowerCase() : "";
  const platform =
    value.platform === "android" || value.platform === "ios"
      ? value.platform
      : null;

  if (!EXPO_PUSH_TOKEN_PATTERN.test(token)) {
    throw new MobilePushRegistrationPolicyError("invalid_push_token");
  }
  if (!UUID_PATTERN.test(projectId)) {
    throw new MobilePushRegistrationPolicyError("invalid_project_id");
  }
  if (!platform) {
    throw new MobilePushRegistrationPolicyError("invalid_platform");
  }

  return {
    action: MOBILE_PUSH_ACTIONS.register,
    token,
    projectId,
    platform,
  };
}

export function publicMobilePushStatus(row, now = new Date()) {
  const expiresAt =
    row && typeof row.expires_at === "string" ? new Date(row.expires_at) : null;
  const platform =
    row?.platform === "android" || row?.platform === "ios"
      ? row.platform
      : null;
  const enabled = Boolean(
    row &&
      row.status === "active" &&
      platform &&
      expiresAt &&
      !Number.isNaN(expiresAt.getTime()) &&
      expiresAt.getTime() > now.getTime(),
  );

  return {
    enabled,
    platform: enabled ? platform : null,
    expiresAt: enabled ? expiresAt.toISOString() : null,
    deliveryEnabled: false,
  };
}
