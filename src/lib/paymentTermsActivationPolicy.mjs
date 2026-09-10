export const CURRENT_PAYMENT_TERMS_VERSION = "2026-06-v1";
export const PAYMENT_TERMS_ACCEPTED_NOT_BEFORE_ISO =
  "2026-06-01T00:00:00.000Z";
export const PAYMENT_TERMS_ACCEPTED_NOT_BEFORE_MS = Date.parse(
  PAYMENT_TERMS_ACCEPTED_NOT_BEFORE_ISO,
);

// Fail closed until Legal confirms whether the materially changed July 2026
// public payment terms may still be represented by 2026-06-v1 or publishes a
// new version. Do not flip this flag as part of a normal deploy.
export const PAYMENT_TERMS_ACTIVATION_ENABLED = false;
export const PAYMENT_TERMS_ACTIVATION_BLOCK_CODE =
  "payment_terms_version_unresolved";

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedTimestamp(value) {
  const cleaned = clean(value);
  if (!cleaned) return null;
  const timestamp = Date.parse(cleaned);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function isPaymentTermsActivationEnabled() {
  return PAYMENT_TERMS_ACTIVATION_ENABLED === true;
}

export function evaluatePaymentTermsSubmission(
  submission,
  { activationEnabled = PAYMENT_TERMS_ACTIVATION_ENABLED } = {},
) {
  if (activationEnabled !== true) {
    return Object.freeze({ ready: false, code: "version_unresolved" });
  }
  if (submission?.paymentTermsAccepted !== true) {
    return Object.freeze({ ready: false, code: "not_accepted" });
  }
  // Compare exactly: the client identifies the revision it displayed. It may
  // never choose the server's active revision or turn an old consent into a
  // current one. Missing versions require a fresh confirmation too.
  if (submission?.paymentTermsVersion !== CURRENT_PAYMENT_TERMS_VERSION) {
    return Object.freeze({ ready: false, code: "version_mismatch" });
  }
  return Object.freeze({ ready: true, code: "ready" });
}

export function evaluateCurrentPaymentTermsUserEvidence(
  metadata,
  {
    now = Date.now(),
    activationEnabled = PAYMENT_TERMS_ACTIVATION_ENABLED,
  } = {},
) {
  const blockers = [];

  if (activationEnabled !== true) blockers.push("version_unresolved");
  if (metadata?.payment_terms_accepted !== true) blockers.push("not_accepted");
  if (clean(metadata?.payment_terms_version) !== CURRENT_PAYMENT_TERMS_VERSION) {
    blockers.push("version_mismatch");
  }

  const acceptedAt = normalizedTimestamp(metadata?.payment_terms_accepted_at);
  const nowTimestamp =
    now instanceof Date ? now.getTime() : Number(now);
  if (acceptedAt == null) {
    blockers.push("accepted_at_invalid");
  } else if (!Number.isFinite(nowTimestamp)) {
    blockers.push("now_invalid");
  } else if (acceptedAt < PAYMENT_TERMS_ACCEPTED_NOT_BEFORE_MS) {
    blockers.push("accepted_at_before_window");
  } else if (acceptedAt > nowTimestamp + 5 * 60 * 1000) {
    blockers.push("accepted_at_future");
  }

  return Object.freeze({
    ready: blockers.length === 0,
    blockers: Object.freeze(blockers),
  });
}

export function hasCurrentPaymentTermsUserEvidence(metadata, options) {
  return evaluateCurrentPaymentTermsUserEvidence(metadata, options).ready;
}
