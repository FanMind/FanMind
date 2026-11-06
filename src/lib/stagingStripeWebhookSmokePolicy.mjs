import { createHmac } from "node:crypto";

import {
  STAGING_STRIPE_WEBHOOK_EVENTS,
  STAGING_STRIPE_WEBHOOK_URL,
  STRIPE_API_VERSION,
} from "./stagingStripeWebhookPolicy.mjs";

export const STAGING_STRIPE_WEBHOOK_SMOKE_CONFIRMATION =
  "run-signed-staging-stripe-webhook-smoke";
export const STAGING_STRIPE_WEBHOOK_SMOKE_EVENT_TYPE =
  "fanmind.staging.webhook.binding_probe";

const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const WEBHOOK_SECRET_PATTERN = /^whsec_[A-Za-z0-9_]+$/u;

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function failure(error) {
  return Object.freeze({
    ok: false,
    error,
    httpStatus: null,
  });
}

export function evaluateStagingStripeWebhookSmokeEnvironment(
  environment = {},
) {
  const errors = [];
  const expectedCommit = clean(environment.FANMIND_EXPECTED_RELEASE_COMMIT);
  const workflowCommit = clean(environment.FANMIND_WORKFLOW_COMMIT);
  const webhookSecret =
    typeof environment.STRIPE_WEBHOOK_SECRET === "string"
      ? environment.STRIPE_WEBHOOK_SECRET
      : "";

  if (clean(environment.FANMIND_RUNTIME_ENVIRONMENT) !== "staging") {
    errors.push("runtime_environment");
  }
  if (
    clean(environment.FANMIND_STAGING_STRIPE_WEBHOOK_SMOKE_CONFIRM) !==
    STAGING_STRIPE_WEBHOOK_SMOKE_CONFIRMATION
  ) {
    errors.push("confirmation");
  }
  if (!COMMIT_PATTERN.test(expectedCommit)) {
    errors.push("expected_commit");
  }
  if (!COMMIT_PATTERN.test(workflowCommit) || workflowCommit !== expectedCommit) {
    errors.push("workflow_commit");
  }
  if (!WEBHOOK_SECRET_PATTERN.test(webhookSecret)) {
    errors.push("webhook_secret");
  }
  if (clean(environment.FANMIND_ENABLE_NON_PRODUCTION_WRITES) !== "false") {
    errors.push("write_boundary");
  }

  return Object.freeze({
    ok: errors.length === 0,
    errors: Object.freeze(errors),
    expectedCommit,
  });
}

function validateVersionPayload(payload, expectedCommit) {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      payload.application === "fanmind" &&
      payload.releaseCommit === expectedCommit &&
      payload.environment === "production" &&
      payload.runtimeEnvironment === "staging",
  );
}

function buildProbe(timestamp) {
  return JSON.stringify({
    id: "evt_FanMindStagingWebhookBindingProbe",
    object: "event",
    api_version: STRIPE_API_VERSION,
    created: timestamp,
    data: {
      object: {
        object: "fanmind_webhook_binding_probe",
      },
    },
    livemode: false,
    pending_webhooks: 1,
    type: STAGING_STRIPE_WEBHOOK_SMOKE_EVENT_TYPE,
  });
}

async function json(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function runStagingStripeWebhookSmoke(
  environment = {},
  {
    fetchImplementation = globalThis.fetch,
    nowSeconds = Math.floor(Date.now() / 1_000),
  } = {},
) {
  const evaluation = evaluateStagingStripeWebhookSmokeEnvironment(environment);
  if (!evaluation.ok) return failure("environment_invalid");
  if (
    typeof fetchImplementation !== "function" ||
    !Number.isSafeInteger(nowSeconds) ||
    nowSeconds < 0
  ) {
    return failure("smoke_unavailable");
  }

  let versionResponse;
  try {
    versionResponse = await fetchImplementation(
      "https://staging.fanmind.ch/api/version",
      {
        method: "GET",
        cache: "no-store",
        redirect: "manual",
        headers: {
          Accept: "application/json",
          "User-Agent": "FanMind-Staging-Stripe-Webhook-Smoke/1.0",
        },
        signal: AbortSignal.timeout(12_000),
      },
    );
  } catch {
    return failure("version_unavailable");
  }
  if (versionResponse?.status !== 200) {
    return failure("version_rejected");
  }
  if (
    !validateVersionPayload(
      await json(versionResponse),
      evaluation.expectedCommit,
    )
  ) {
    return failure("version_mismatch");
  }

  const rawBody = buildProbe(nowSeconds);
  const secret = environment.STRIPE_WEBHOOK_SECRET;
  const signature = createHmac("sha256", secret)
    .update(`${nowSeconds}.${rawBody}`)
    .digest("hex");

  let webhookResponse;
  try {
    webhookResponse = await fetchImplementation(STAGING_STRIPE_WEBHOOK_URL, {
      method: "POST",
      cache: "no-store",
      redirect: "manual",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Stripe-Signature": `t=${nowSeconds},v1=${signature}`,
        "User-Agent": "FanMind-Staging-Stripe-Webhook-Smoke/1.0",
      },
      body: rawBody,
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    return failure("webhook_unavailable");
  }
  if (webhookResponse?.status !== 200) {
    return failure("webhook_rejected");
  }
  const receipt = await json(webhookResponse);
  if (
    !receipt ||
    typeof receipt !== "object" ||
    Array.isArray(receipt) ||
    receipt.received !== true ||
    Object.keys(receipt).length !== 1
  ) {
    return failure("webhook_invalid");
  }

  return Object.freeze({
    ok: true,
    error: null,
    httpStatus: 200,
  });
}

export function isStagingStripeWebhookSmokeContractSafe() {
  return Boolean(
    STAGING_STRIPE_WEBHOOK_URL ===
      "https://staging.fanmind.ch/api/stripe/webhook" &&
      !STAGING_STRIPE_WEBHOOK_EVENTS.includes(
        STAGING_STRIPE_WEBHOOK_SMOKE_EVENT_TYPE,
      ),
  );
}
