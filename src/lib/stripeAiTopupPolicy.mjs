export const STRIPE_AI_TOPUP_OPTIONS = Object.freeze({
  // Ledger unit: 1 EUR = 100,000,000 EUR microcents (not one million).
  topup_10: Object.freeze({ saleAmountCents: 1499, creditEurMicrocents: 1_000_000_000 }),
  topup_25: Object.freeze({ saleAmountCents: 3749, creditEurMicrocents: 2_500_000_000 }),
  topup_50: Object.freeze({ saleAmountCents: 7499, creditEurMicrocents: 5_000_000_000 }),
  topup_100: Object.freeze({ saleAmountCents: 14900, creditEurMicrocents: 10_000_000_000 }),
});

export function resolveStripeAiTopup(input = {}) {
  const key = typeof input.topupKey === "string" ? input.topupKey.trim() : "";
  const option = Object.hasOwn(STRIPE_AI_TOPUP_OPTIONS, key) ? STRIPE_AI_TOPUP_OPTIONS[key] : null;
  if (!option) return null;
  if (input.currency !== "eur") return null;
  if (!Number.isSafeInteger(input.amountTotalCents) || input.amountTotalCents !== option.saleAmountCents) return null;
  return { key, ...option };
}

export function stripeAiTopupGrantKey(paymentIntentId) {
  if (typeof paymentIntentId !== "string" || !paymentIntentId.startsWith("pi_")) return null;
  return `stripe:payment_intent:${paymentIntentId}`;
}
