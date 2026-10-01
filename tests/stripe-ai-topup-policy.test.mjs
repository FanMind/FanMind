import test from "node:test";
import assert from "node:assert/strict";
import { resolveStripeAiTopup, stripeAiTopupGrantKey } from "../src/lib/stripeAiTopupPolicy.mjs";

for (const [topupKey, amountTotalCents, creditEurMicrocents] of [
  ["topup_10", 1499, 10_000_000],
  ["topup_25", 3749, 25_000_000],
  ["topup_50", 7499, 50_000_000],
  ["topup_100", 14900, 100_000_000],
]) {
  test(`${topupKey} maps exact EUR sale amount to provider-value credit`, () => {
    assert.deepEqual(resolveStripeAiTopup({ topupKey, currency: "eur", amountTotalCents }), {
      key: topupKey, saleAmountCents: amountTotalCents, creditEurMicrocents,
    });
  });
}

test("rejects unknown, wrong-currency and tampered-amount topups", () => {
  assert.equal(resolveStripeAiTopup({ topupKey: "unknown", currency: "eur", amountTotalCents: 1499 }), null);
  assert.equal(resolveStripeAiTopup({ topupKey: "topup_10", currency: "usd", amountTotalCents: 1499 }), null);
  assert.equal(resolveStripeAiTopup({ topupKey: "topup_10", currency: "eur", amountTotalCents: 1500 }), null);
});

test("grant key is stable per Stripe PaymentIntent", () => {
  assert.equal(stripeAiTopupGrantKey("pi_123"), "stripe:payment_intent:pi_123");
  assert.equal(stripeAiTopupGrantKey("bad"), null);
});
