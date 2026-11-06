export const STRIPE_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS: 300;

export function verifyStripeWebhookSignature(input?: Readonly<{
  rawBody?: unknown;
  signatureHeader?: unknown;
  configuredSecret?: unknown;
  nowSeconds?: unknown;
}>): boolean;
