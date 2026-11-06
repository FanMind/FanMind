#!/usr/bin/env node

import { resolveMx, resolveTxt } from "node:dns/promises";

import {
  STAGING_EMAIL_ACCEPTANCE_DOMAIN,
  STAGING_EMAIL_ACCEPTANCE_FROM,
  STAGING_EMAIL_ACCEPTANCE_TO,
  buildStagingEmailAcceptancePayload,
  runStagingEmailProviderPreflight,
  sendStagingEmailProviderAcceptance,
} from "../../src/lib/stagingEmailProviderAcceptancePolicy.mjs";

function fail(code) {
  console.error(`STAGING_EMAIL_ACCEPTANCE_ERROR=${code}`);
  process.exitCode = 1;
}

async function main() {
  const mode = process.argv[2] ?? "";
  if (mode === "--check") {
    const payload = buildStagingEmailAcceptancePayload("a".repeat(40));
    if (
      STAGING_EMAIL_ACCEPTANCE_DOMAIN !== "mail.staging.fanmind.ch" ||
      STAGING_EMAIL_ACCEPTANCE_FROM !==
        "FanMind Staging <acceptance@mail.staging.fanmind.ch>" ||
      STAGING_EMAIL_ACCEPTANCE_TO !==
        "delivered+fanmind-staging@resend.dev" ||
      Object.keys(payload).sort().join(",") !== "from,subject,text,to"
    ) {
      fail("contract_invalid");
      return;
    }
    console.log("STAGING_EMAIL_ACCEPTANCE_CONTRACT=PASS");
    console.log("STAGING_EMAIL_ACCEPTANCE_NETWORK_CALLS=0");
    console.log("STAGING_APP_EMAIL_RUNTIME=DISABLED");
    return;
  }
  if (mode !== "--preflight" && mode !== "--send") {
    fail("mode_invalid");
    return;
  }

  const runner =
    mode === "--preflight"
      ? runStagingEmailProviderPreflight
      : sendStagingEmailProviderAcceptance;
  const result = await runner(process.env, {
    resolveMxImplementation: resolveMx,
    resolveTxtImplementation: resolveTxt,
  });
  if (!result.ok) {
    if (result.error === "send_indeterminate") {
      console.error("STAGING_EMAIL_SEND_STATE=INDETERMINATE_NO_RETRY");
    }
    fail(result.error ?? "unexpected_failure");
    return;
  }
  if (mode === "--preflight") {
    console.log("STAGING_EMAIL_GITHUB_ENVIRONMENT=PASS");
    console.log("STAGING_EMAIL_CURRENT_MAIN=PASS");
    console.log("STAGING_EMAIL_APP_RUNTIME_DISABLED=PASS");
    console.log("STAGING_EMAIL_PREFLIGHT=PASS");
    return;
  }
  console.log("STAGING_EMAIL_KEY_PERMISSION=PASS");
  console.log("STAGING_EMAIL_DNS=PASS");
  console.log("STAGING_EMAIL_SAFE_TEST_SEND=PASS");
  console.log(`STAGING_EMAIL_PROVIDER_CALLS=${result.providerCalls}`);
  console.log("STAGING_EMAIL_HUMAN_RECIPIENTS=0");
  console.log("STAGING_EMAIL_CUSTOMER_DATA=0");
  console.log("STAGING_EMAIL_ACCEPTANCE=PASS");
}

main().catch(() => fail("unexpected_failure"));
