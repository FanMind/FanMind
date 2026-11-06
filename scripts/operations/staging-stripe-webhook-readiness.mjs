#!/usr/bin/env node

import {
  STAGING_STRIPE_WEBHOOK_EVENTS,
  STAGING_STRIPE_WEBHOOK_URL,
  STRIPE_API_VERSION,
  verifyStagingStripeWebhookEndpoint,
} from "../../src/lib/stagingStripeWebhookPolicy.mjs";

function fail(code) {
  console.error(`STAGING_STRIPE_WEBHOOK_ERROR=${code}`);
  process.exitCode = 1;
}

async function main() {
  const mode = process.argv[2] ?? "";
  if (mode === "--check") {
    if (
      STAGING_STRIPE_WEBHOOK_EVENTS.length !== 22 ||
      new Set(STAGING_STRIPE_WEBHOOK_EVENTS).size !== 22 ||
      !STAGING_STRIPE_WEBHOOK_URL.startsWith("https://staging.fanmind.ch/")
    ) {
      fail("contract_invalid");
      return;
    }
    console.log("STAGING_STRIPE_WEBHOOK_CONTRACT=PASS");
    console.log("STAGING_STRIPE_WEBHOOK_NETWORK_CALLS=0");
    return;
  }

  if (mode !== "--verify") {
    fail("mode_invalid");
    return;
  }

  const result = await verifyStagingStripeWebhookEndpoint(process.env);
  if (!result.ok) {
    if (
      typeof result.missingEvent === "string" &&
      STAGING_STRIPE_WEBHOOK_EVENTS.includes(result.missingEvent)
    ) {
      console.error(`STAGING_STRIPE_WEBHOOK_EVENT=${result.missingEvent}`);
    }
    fail(result.error ?? "unexpected_failure");
    return;
  }

  console.log("STAGING_STRIPE_WEBHOOK_MODE=test");
  console.log("STAGING_STRIPE_WEBHOOK_URL=verified");
  console.log(`STAGING_STRIPE_WEBHOOK_API_VERSION=${STRIPE_API_VERSION}`);
  console.log(`STAGING_STRIPE_WEBHOOK_EVENTS=${result.eventCount}`);
  console.log("STAGING_STRIPE_WEBHOOK_SECRET=configured");
  console.log("STAGING_STRIPE_WEBHOOK_ENDPOINT=PASS");
  console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
}

main().catch(() => fail("unexpected_failure"));
