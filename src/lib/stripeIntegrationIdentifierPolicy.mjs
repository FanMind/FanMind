import { randomInt } from "node:crypto";

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
