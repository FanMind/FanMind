#!/usr/bin/env node

import {
  STAGING_STRIPE_PRICE_CONTRACTS,
  verifyStagingStripeCatalog,
} from "../../src/lib/stagingStripeCatalogPolicy.mjs";

function fail(code) {
  console.error(`STAGING_STRIPE_CATALOG_ERROR=${code}`);
  process.exitCode = 1;
}

async function main() {
  const mode = process.argv[2] ?? "";
  if (mode === "--check") {
    if (
      STAGING_STRIPE_PRICE_CONTRACTS.length !== 5 ||
      new Set(
        STAGING_STRIPE_PRICE_CONTRACTS.map(
          (contract) => contract.environmentName,
        ),
      ).size !== 5
    ) {
      fail("contract_invalid");
      return;
    }
    console.log("STAGING_STRIPE_CATALOG_CONTRACT=PASS");
    console.log("STAGING_STRIPE_CATALOG_NETWORK_CALLS=0");
    return;
  }

  if (mode !== "--verify") {
    fail("mode_invalid");
    return;
  }

  const result = await verifyStagingStripeCatalog(process.env);
  if (!result.ok) {
    if (
      typeof result.slot === "string" &&
      /^(?:starter_setup|starter_monthly|internal_daily_test|ai_plus|ai_ultra)$/u.test(
        result.slot,
      )
    ) {
      console.error(`STAGING_STRIPE_CATALOG_SLOT=${result.slot}`);
    }
    fail(result.error ?? "unexpected_failure");
    return;
  }

  console.log("STAGING_STRIPE_MODE=test");
  console.log("STAGING_STRIPE_WEBHOOK_SECRET=configured");
  console.log(`STAGING_STRIPE_CATALOG_PRICES=${result.priceCount}`);
  console.log("STAGING_STRIPE_CATALOG=PASS");
  console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
}

main().catch(() => fail("unexpected_failure"));
