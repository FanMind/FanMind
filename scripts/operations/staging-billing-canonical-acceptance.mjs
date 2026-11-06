#!/usr/bin/env node
import { runStagingBillingCanonicalAcceptance } from "./stripe-billing-event-ledger-runner.mjs";
try { await runStagingBillingCanonicalAcceptance(); }
catch (error) {
  console.error(/^STRIPE_BILLING_EVENT_LEDGER_ERROR=[a-z0-9_]+$/u.test(error?.message ?? "") ? error.message : "STAGING_CANONICAL_BILLING_ERROR=failed");
  process.exitCode = 1;
}
