import { createHash, randomInt } from "node:crypto";

export const STRIPE_INTEGRATION_IDENTIFIER_PREFIX = "fanmind_checkout_";
export const STRIPE_INTEGRATION_IDENTIFIER_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function createStripeIntegrationIdentifier() {
  const suffix = Array.from(
    { length: 8 },
    () =>
      STRIPE_INTEGRATION_IDENTIFIER_ALPHABET[
        randomInt(STRIPE_INTEGRATION_IDENTIFIER_ALPHABET.length)
      ],
  ).join("");
  return `${STRIPE_INTEGRATION_IDENTIFIER_PREFIX}${suffix}`;
}

// Stripe requires identical parameters when retrying the same initial Checkout.
export function createStripeRetryableIntegrationIdentifier(idempotencyKey) {
  const hash = createHash("sha256").update(idempotencyKey).digest();
  const suffix = Array.from(hash.subarray(0, 8), byte =>
    STRIPE_INTEGRATION_IDENTIFIER_ALPHABET[byte % STRIPE_INTEGRATION_IDENTIFIER_ALPHABET.length],
  ).join("");
  return `${STRIPE_INTEGRATION_IDENTIFIER_PREFIX}${suffix}`;
}
