import { isStripeTestSecretKey } from "./stripeKeyPolicy.mjs";
import { STRIPE_WEBHOOK_HANDLED_EVENTS } from "./stripeWebhookEventPolicy.mjs";

export const STRIPE_API_VERSION = "2026-06-24.dahlia";
export const STAGING_STRIPE_WEBHOOK_CONFIRMATION =
  "verify-staging-stripe-webhook";
export const STAGING_STRIPE_WEBHOOK_URL =
  "https://staging.fanmind.ch/api/stripe/webhook";

export const STAGING_STRIPE_WEBHOOK_EVENTS = STRIPE_WEBHOOK_HANDLED_EVENTS;

const WEBHOOK_ID_PATTERN = /^we_[A-Za-z0-9_]+$/u;
const WEBHOOK_SECRET_PATTERN = /^whsec_[A-Za-z0-9_]+$/u;
const MAX_LIST_PAGES = 20;

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function evaluateStagingStripeWebhookEnvironment(environment = {}) {
  const errors = [];

  if (clean(environment.FANMIND_RUNTIME_ENVIRONMENT) !== "staging") {
    errors.push("runtime_environment");
  }
  if (
    clean(environment.FANMIND_STAGING_STRIPE_WEBHOOK_CONFIRM) !==
    STAGING_STRIPE_WEBHOOK_CONFIRMATION
  ) {
    errors.push("confirmation");
  }
  if (!isStripeTestSecretKey(environment.STRIPE_SECRET_KEY)) {
    errors.push("stripe_test_mode");
  }
  if (!WEBHOOK_SECRET_PATTERN.test(clean(environment.STRIPE_WEBHOOK_SECRET))) {
    errors.push("webhook_secret");
  }

  return Object.freeze({
    ok: errors.length === 0,
    errors: Object.freeze(errors),
  });
}

export function validateStripeTestWebhookEndpoint(payload) {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    payload.object !== "webhook_endpoint" ||
    payload.url !== STAGING_STRIPE_WEBHOOK_URL
  ) {
    return Object.freeze({ ok: false, error: "stripe_webhook_invalid" });
  }
  if (payload.livemode !== false) {
    return Object.freeze({ ok: false, error: "stripe_webhook_live_mode" });
  }
  if (payload.status !== "enabled") {
    return Object.freeze({ ok: false, error: "stripe_webhook_disabled" });
  }
  if (payload.api_version !== STRIPE_API_VERSION) {
    return Object.freeze({
      ok: false,
      error: "stripe_webhook_api_version",
    });
  }
  if (
    !Array.isArray(payload.enabled_events) ||
    payload.enabled_events.some((event) => typeof event !== "string")
  ) {
    return Object.freeze({ ok: false, error: "stripe_webhook_invalid" });
  }

  const enabledEvents = new Set(payload.enabled_events);
  const missingEvent = STAGING_STRIPE_WEBHOOK_EVENTS.find(
    (event) => !enabledEvents.has(event),
  );
  if (
    missingEvent ||
    enabledEvents.size !== STAGING_STRIPE_WEBHOOK_EVENTS.length ||
    payload.enabled_events.length !== STAGING_STRIPE_WEBHOOK_EVENTS.length
  ) {
    return Object.freeze({
      ok: false,
      error: "stripe_webhook_events",
      missingEvent: missingEvent ?? null,
    });
  }

  return Object.freeze({ ok: true, error: null, missingEvent: null });
}

export function classifyStripeWebhookResponseStatus(status) {
  if (status === 401 || status === 403) {
    return "stripe_webhook_auth_or_permission";
  }
  if (status === 429 || (status >= 500 && status <= 599)) {
    return "stripe_webhook_unavailable";
  }
  return "stripe_webhook_rejected";
}

function invalidResult() {
  return Object.freeze({
    ok: false,
    error: "stripe_webhook_invalid",
    eventCount: 0,
    missingEvent: null,
  });
}

export async function verifyStagingStripeWebhookEndpoint(
  environment = {},
  { fetchImplementation = globalThis.fetch } = {},
) {
  const evaluation = evaluateStagingStripeWebhookEnvironment(environment);
  if (!evaluation.ok) {
    return Object.freeze({
      ok: false,
      error: "environment_invalid",
      eventCount: 0,
      missingEvent: null,
    });
  }
  if (typeof fetchImplementation !== "function") {
    return Object.freeze({
      ok: false,
      error: "stripe_webhook_unavailable",
      eventCount: 0,
      missingEvent: null,
    });
  }

  const matchingEndpoints = [];
  let startingAfter = null;

  for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
    const url = new URL("https://api.stripe.com/v1/webhook_endpoints");
    url.searchParams.set("limit", "100");
    if (startingAfter) url.searchParams.set("starting_after", startingAfter);

    let response;
    try {
      response = await fetchImplementation(url, {
        headers: {
          Authorization: `Bearer ${clean(environment.STRIPE_SECRET_KEY)}`,
          "Stripe-Version": STRIPE_API_VERSION,
        },
        signal: AbortSignal.timeout(12_000),
      });
    } catch {
      return Object.freeze({
        ok: false,
        error: "stripe_webhook_unavailable",
        eventCount: 0,
        missingEvent: null,
      });
    }

    if (!response?.ok) {
      return Object.freeze({
        ok: false,
        error: classifyStripeWebhookResponseStatus(response?.status),
        eventCount: 0,
        missingEvent: null,
      });
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      return invalidResult();
    }
    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload) ||
      payload.object !== "list" ||
      !Array.isArray(payload.data) ||
      typeof payload.has_more !== "boolean"
    ) {
      return invalidResult();
    }
    if (
      payload.data.some(
        (endpoint) =>
          !endpoint ||
          typeof endpoint !== "object" ||
          Array.isArray(endpoint) ||
          endpoint.object !== "webhook_endpoint" ||
          !WEBHOOK_ID_PATTERN.test(clean(endpoint.id)) ||
          typeof endpoint.url !== "string",
      )
    ) {
      return invalidResult();
    }

    for (const endpoint of payload.data) {
      if (endpoint.url === STAGING_STRIPE_WEBHOOK_URL) {
        matchingEndpoints.push(endpoint);
      }
    }

    if (!payload.has_more) break;
    const lastEndpoint = payload.data.at(-1);
    if (
      !lastEndpoint ||
      typeof lastEndpoint !== "object" ||
      Array.isArray(lastEndpoint) ||
      !WEBHOOK_ID_PATTERN.test(clean(lastEndpoint.id))
    ) {
      return invalidResult();
    }
    startingAfter = lastEndpoint.id;

    if (page === MAX_LIST_PAGES - 1) return invalidResult();
  }

  if (matchingEndpoints.length === 0) {
    return Object.freeze({
      ok: false,
      error: "stripe_webhook_missing",
      eventCount: 0,
      missingEvent: null,
    });
  }
  if (matchingEndpoints.length !== 1) {
    return Object.freeze({
      ok: false,
      error: "stripe_webhook_duplicate",
      eventCount: 0,
      missingEvent: null,
    });
  }

  const validation = validateStripeTestWebhookEndpoint(matchingEndpoints[0]);
  return Object.freeze({
    ok: validation.ok,
    error: validation.error,
    eventCount: validation.ok ? STAGING_STRIPE_WEBHOOK_EVENTS.length : 0,
    missingEvent: validation.missingEvent ?? null,
  });
}
