import Stripe from "stripe";
export { createStripeIntegrationIdentifier } from "@/lib/stripeIntegrationIdentifierPolicy.mjs";

export const STRIPE_OUTBOUND_API_VERSION = "2026-07-29.dahlia" as const;
export const STRIPE_SDK_VERSION = "22.4.0" as const;

let cachedClient: Stripe | null = null;
let cachedSecretKey: string | null = null;

export function getStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() || null;
  if (!secretKey) return null;
  if (cachedClient && cachedSecretKey === secretKey) return cachedClient;

  cachedClient = new Stripe(secretKey, {
    apiVersion: STRIPE_OUTBOUND_API_VERSION,
    maxNetworkRetries: 2,
    timeout: 12_000,
    appInfo: {
      name: "FanMind",
      version: process.env.npm_package_version,
    },
  });
  cachedSecretKey = secretKey;
  return cachedClient;
}

export function getStripeErrorDetails(error: unknown): {
  status: number;
  code: string | null;
  message: string | null;
} {
  if (!error || typeof error !== "object") {
    return {
      status: 0,
      code: null,
      message: error instanceof Error ? error.message : null,
    };
  }
  const candidate = error as {
    statusCode?: unknown;
    code?: unknown;
    message?: unknown;
    raw?: { code?: unknown; message?: unknown };
  };
  return {
    status:
      typeof candidate.statusCode === "number" ? candidate.statusCode : 0,
    code:
      typeof candidate.code === "string"
        ? candidate.code
        : typeof candidate.raw?.code === "string"
          ? candidate.raw.code
          : null,
    message:
      typeof candidate.message === "string"
        ? candidate.message
        : typeof candidate.raw?.message === "string"
          ? candidate.raw.message
          : null,
  };
}
