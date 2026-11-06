import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const stripeClientSource = readFileSync("src/lib/stripeClient.ts", "utf8");
const stripeBillingSource = readFileSync("src/lib/stripeBilling.ts", "utf8");
const identifierPolicySource = readFileSync(
  "src/lib/stripeIntegrationIdentifierPolicy.mjs",
  "utf8",
);
const stagingWebhookSource = readFileSync(
  "src/lib/stagingStripeWebhookPolicy.mjs",
  "utf8",
);
const { createStripeIntegrationIdentifier } = await import(
  "../src/lib/stripeIntegrationIdentifierPolicy.mjs"
);

test("Stripe runtime uses the reviewed SDK and outbound API version", () => {
  assert.equal(packageJson.dependencies.stripe, "22.4.0");
  assert.match(
    stripeClientSource,
    /STRIPE_OUTBOUND_API_VERSION = "2026-07-29\.dahlia"/u,
  );
  assert.match(stripeClientSource, /STRIPE_SDK_VERSION = "22\.4\.0"/u);
  assert.match(stripeClientSource, /new Stripe\(secretKey/u);
  assert.match(stripeClientSource, /apiVersion: STRIPE_OUTBOUND_API_VERSION/u);
  assert.match(stripeClientSource, /maxNetworkRetries: 2/u);
  assert.match(stripeClientSource, /timeout: 12_000/u);
});

test("Checkout uses dynamic methods and a random eight-letter identifier suffix", () => {
  assert.doesNotMatch(stripeBillingSource, /payment_method_types/u);
  assert.match(
    stripeBillingSource,
    /stripe\.checkout\.sessions\.create\(params\)/u,
  );
  assert.match(
    stripeBillingSource,
    /integration_identifier: createStripeIntegrationIdentifier\(\)/u,
  );
  assert.match(identifierPolicySource, /fanmind_checkout_/u);
  assert.match(identifierPolicySource, /\{ length: 8 \}/u);
  assert.match(
    identifierPolicySource,
    /randomInt\(STRIPE_INTEGRATION_IDENTIFIER_ALPHABET\.length\)/u,
  );
  assert.match(
    identifierPolicySource,
    /ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz/u,
  );
});

test("integration identifiers satisfy the runtime format and vary per Session", () => {
  const identifiers = Array.from(
    { length: 64 },
    createStripeIntegrationIdentifier,
  );
  assert.ok(
    identifiers.every((identifier) =>
      /^fanmind_checkout_[A-Za-z]{8}$/u.test(identifier),
    ),
  );
  assert.equal(new Set(identifiers).size, identifiers.length);
});

test("production server modules do not bypass the shared Stripe client", () => {
  const forbiddenStripeRestRoutes = [
    "/v1/checkout/sessions",
    "/v1/coupons",
    "/v1/customers",
    "/v1/invoices",
    "/v1/prices",
    "/v1/products",
    "/v1/subscriptions",
  ];
  for (const path of [
    "src/lib/adminBilling.ts",
    "src/lib/customerBilling.ts",
    "src/lib/referralAutomation.ts",
    "src/lib/stripeBilling.ts",
  ]) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /getStripeClient/u, `${path} must use getStripeClient`);
    for (const route of forbiddenStripeRestRoutes) {
      assert.equal(
        source.includes(route),
        false,
        `${path} must not call raw Stripe REST route ${route}`,
      );
    }
    assert.doesNotMatch(source, /Authorization: `Bearer \$\{secret/u);
  }
});

test("verified inbound Staging webhook pin remains an explicit external migration gate", () => {
  assert.match(
    stagingWebhookSource,
    /STRIPE_API_VERSION = "2026-06-24\.dahlia"/u,
  );
  assert.notEqual("2026-06-24.dahlia", "2026-07-29.dahlia");
  const runbook = readFileSync(
    "docs/operations/STRIPE_RUNTIME_CONFORMANCE.md",
    "utf8",
  );
  assert.match(runbook, /2026-07-29\.dahlia/u);
  assert.match(runbook, /2026-06-24\.dahlia/u);
  assert.match(runbook, /provider-side migration/iu);
  assert.match(runbook, /no provider mutation/iu);
  assert.match(runbook, /internal_daily_test[\s\S]*no[\s\S]*card-only exception/iu);
});
