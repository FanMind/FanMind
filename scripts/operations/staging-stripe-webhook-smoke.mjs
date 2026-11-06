#!/usr/bin/env node

import {
  isStagingStripeWebhookSmokeContractSafe,
  runStagingStripeWebhookSmoke,
} from "../../src/lib/stagingStripeWebhookSmokePolicy.mjs";

function fail(code) {
  console.error(`STAGING_STRIPE_WEBHOOK_SMOKE_ERROR=${code}`);
  process.exitCode = 1;
}

async function main() {
  const mode = process.argv[2] ?? "";
  if (mode === "--check") {
    if (!isStagingStripeWebhookSmokeContractSafe()) {
      fail("contract_invalid");
      return;
    }
    console.log("STAGING_STRIPE_WEBHOOK_SMOKE_CONTRACT=PASS");
    console.log("STAGING_STRIPE_WEBHOOK_SMOKE_NETWORK_CALLS=0");
    console.log("STAGING_STRIPE_WEBHOOK_SMOKE_MUTATIONS=0");
    return;
  }

  if (mode !== "--run") {
    fail("mode_invalid");
    return;
  }

  const result = await runStagingStripeWebhookSmoke(process.env);
  if (!result.ok) {
    fail(result.error ?? "unexpected_failure");
    return;
  }

  console.log("STAGING_STRIPE_WEBHOOK_SMOKE_RELEASE=verified");
  console.log("STAGING_STRIPE_WEBHOOK_SMOKE_SIGNATURE=accepted");
  console.log(`STAGING_STRIPE_WEBHOOK_SMOKE_HTTP_STATUS=${result.httpStatus}`);
  console.log("STAGING_STRIPE_WEBHOOK_SMOKE_MUTATIONS=0");
  console.log("STAGING_STRIPE_WEBHOOK_SMOKE=PASS");
  console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
}

main().catch(() => fail("unexpected_failure"));
