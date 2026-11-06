const MOBILE_PASSWORD_RECOVERY_REDIRECT = "fanmind://reset-password";
const MOBILE_PASSWORD_RECOVERY_ROUTE = "reset-password";
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;

class MobileAuthRecoveryPolicyError extends Error {
  constructor(code) {
    super(code);
    this.name = "MobileAuthRecoveryPolicyError";
    this.code = code;
  }
}

function normalizeRoute(url) {
  const host = String(url.hostname || "").replace(/^\/+|\/+$/g, "");
  const path = String(url.pathname || "").replace(/^\/+|\/+$/g, "");
  return path || host;
}

function mergedParameters(url) {
  const params = new URLSearchParams(url.search);
  const hash = String(url.hash || "").replace(/^#/, "");
  if (hash) {
    const hashParams = new URLSearchParams(hash);
    for (const [key, value] of hashParams.entries()) {
      if (!params.has(key)) params.set(key, value);
    }
  }
  return params;
}

function parseMobileAuthRecoveryUrl(rawUrl) {
  if (typeof rawUrl !== "string" || rawUrl.length < 1 || rawUrl.length > 8192) {
    throw new MobileAuthRecoveryPolicyError("invalid_url");
  }

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new MobileAuthRecoveryPolicyError("invalid_url");
  }

  if (url.protocol.toLowerCase() !== "fanmind:") {
    throw new MobileAuthRecoveryPolicyError("invalid_scheme");
  }
  if (normalizeRoute(url) !== MOBILE_PASSWORD_RECOVERY_ROUTE) {
    throw new MobileAuthRecoveryPolicyError("invalid_route");
  }

  const params = mergedParameters(url);
  if (params.has("error") || params.has("error_code")) {
    throw new MobileAuthRecoveryPolicyError("provider_error");
  }

  const code = String(params.get("code") || "").trim();
  const accessToken = String(params.get("access_token") || "").trim();
  const refreshToken = String(params.get("refresh_token") || "").trim();
  const type = String(params.get("type") || "").trim().toLowerCase();

  if (code && (accessToken || refreshToken)) {
    throw new MobileAuthRecoveryPolicyError("ambiguous_credentials");
  }
  if (code) {
    if (code.length > 2048) {
      throw new MobileAuthRecoveryPolicyError("invalid_code");
    }
    return {
      mode: "pkce",
      recovery: true,
      code,
      accessToken: null,
      refreshToken: null,
    };
  }
  if (accessToken || refreshToken) {
    if (!accessToken || !refreshToken) {
      throw new MobileAuthRecoveryPolicyError("partial_tokens");
    }
    if (accessToken.length > 8192 || refreshToken.length > 8192) {
      throw new MobileAuthRecoveryPolicyError("invalid_tokens");
    }
    if (type !== "recovery") {
      throw new MobileAuthRecoveryPolicyError("invalid_type");
    }
    return {
      mode: "tokens",
      recovery: true,
      code: null,
      accessToken,
      refreshToken,
    };
  }

  throw new MobileAuthRecoveryPolicyError("credentials_missing");
}

function normalizeRecoveryEmail(value) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (
    !email ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new MobileAuthRecoveryPolicyError("invalid_email");
  }
  return email;
}

function validateNewPassword(password, confirmation) {
  const value = typeof password === "string" ? password : "";
  const repeated = typeof confirmation === "string" ? confirmation : "";
  const errors = [];

  if (value.length < MIN_PASSWORD_LENGTH || value.length > MAX_PASSWORD_LENGTH) {
    errors.push("password_length");
  }
  if (!/[A-Za-zÄÖÜäöüß]/u.test(value) || !/\d/u.test(value)) {
    errors.push("password_complexity");
  }
  if (value !== repeated) {
    errors.push("password_mismatch");
  }

  return {
    ok: errors.length === 0,
    password: errors.length === 0 ? value : null,
    errors,
  };
}

function isPasswordRecoverySegments(segments) {
  return Array.isArray(segments) && segments.some((segment) => segment === "reset-password");
}

export {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  MOBILE_PASSWORD_RECOVERY_REDIRECT,
  MOBILE_PASSWORD_RECOVERY_ROUTE,
  MobileAuthRecoveryPolicyError,
  isPasswordRecoverySegments,
  normalizeRecoveryEmail,
  parseMobileAuthRecoveryUrl,
  validateNewPassword,
};
