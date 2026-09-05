import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  isStripeBillingWriteFrozen,
  STRIPE_BILLING_WRITE_FREEZE_CODE,
} from "../src/lib/stripeBillingWriteFreeze.mjs";

test("billing write freeze is explicit and fail-closed only on exact true", () => {
  assert.equal(isStripeBillingWriteFrozen({}), false);
  assert.equal(
    isStripeBillingWriteFrozen({ FANMIND_STRIPE_BILLING_WRITE_FREEZE: "false" }),
    false,
  );
  assert.equal(
    isStripeBillingWriteFrozen({ FANMIND_STRIPE_BILLING_WRITE_FREEZE: "TRUE" }),
    false,
  );
  assert.equal(
    isStripeBillingWriteFrozen({ FANMIND_STRIPE_BILLING_WRITE_FREEZE: "true" }),
    true,
  );
  assert.equal(
    STRIPE_BILLING_WRITE_FREEZE_CODE,
    "stripe_billing_write_frozen",
  );
});

test("controlled freeze blocks Checkout and makes legacy webhook projection retryable", () => {
  const checkoutSource = fs.readFileSync(
    "src/app/api/billing/checkout/route.ts",
    "utf8",
  );
  const stripeBillingSource = fs.readFileSync(
    "src/lib/stripeBilling.ts",
    "utf8",
  );
  const webhookSource = fs.readFileSync(
    "src/app/api/stripe/webhook/route.ts",
    "utf8",
  );

  assert.match(
    checkoutSource,
    /isStripeBillingWriteFrozen\(\)[\s\S]*STRIPE_BILLING_WRITE_FREEZE_CODE[\s\S]*status: 503[\s\S]*"Retry-After": "60"/u,
  );
  assert.match(
    stripeBillingSource,
    /updateWorkspaceBillingDefensively[\s\S]*isStripeBillingWriteFrozen\(\)[\s\S]*STRIPE_BILLING_RETRYABLE_ERROR/u,
  );
  assert.match(
    webhookSource,
    /billingUpdateDecision === STRIPE_BILLING_RETRYABLE_ERROR[\s\S]*throw new StripeWebhookRetryableError\(\)/u,
  );
});
