function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function resolveDemoTurnstilePolicy({
  required = false,
  siteKey = "",
  secretKey = "",
} = {}) {
  const normalizedRequired = required === true || String(required) === "true";
  const hasSiteKey = Boolean(clean(siteKey));
  const hasSecretKey = Boolean(clean(secretKey));

  if (!hasSiteKey && !hasSecretKey && !normalizedRequired) {
    return {
      mode: "disabled",
      required: false,
      tokenRequired: false,
      configured: false,
      errorCode: null,
    };
  }

  if (!hasSiteKey || !hasSecretKey) {
    return {
      mode: "misconfigured",
      required: normalizedRequired,
      tokenRequired: true,
      configured: false,
      errorCode: "turnstile_configuration_incomplete",
    };
  }

  return {
    mode: "enabled",
    required: normalizedRequired,
    tokenRequired: true,
    configured: true,
    errorCode: null,
  };
}
