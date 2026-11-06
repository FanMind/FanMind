export const AI_TIER_STAGING_ACCEPTANCE_CONFIRMATION: string;

export function isAiTierStagingWorkspaceId(value: unknown): boolean;

export function evaluateAiTierStagingAcceptanceEnvironment(
  environment?: Record<string, unknown>,
): Readonly<{
  ok: boolean;
  errors: readonly string[];
}>;

export function validateAiTierStripeTestPrice(
  payload: unknown,
  options: Readonly<{
    expectedId: string;
    expectedUnitAmount: number;
  }>,
): boolean;

export function buildAiTierSyntheticLifecycleProof(
  environment: Record<string, unknown>,
  options?: Readonly<{
    eventCreatedAt?: number;
    nonce?: string;
  }>,
): Readonly<{
  ok: boolean;
  mutation: Readonly<{
    tierId: "plus" | "ultra";
    status: string;
    source: "stripe";
    stripeSubscriptionId: string;
    stripeSubscriptionItemId: string;
    stripePriceId: string;
    effectiveAt: string;
    expiresAt: string | null;
    lastStripeEventId: string;
    lastStripeEventCreatedAt: number;
  }> | null;
}>;
