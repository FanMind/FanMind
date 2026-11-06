export type AiTierStripeLifecycleReason =
  | "workspace_target"
  | "price_configuration"
  | "event_identity"
  | "event_type"
  | "subscription"
  | "current_state"
  | "duplicate_event"
  | "stale_event"
  | "event_order_conflict"
  | "subscription_mismatch"
  | "items"
  | "unrelated_price"
  | "ambiguous_price_items"
  | "item_period"
  | "subscription_status";

export type AiTierStripeLifecycleMutation = Readonly<{
  tierId: "plus" | "ultra";
  status: "active" | "pending" | "paused" | "canceled" | "expired";
  source: "stripe";
  stripeSubscriptionId: string;
  stripeSubscriptionItemId: string;
  stripePriceId: string;
  effectiveAt: string;
  expiresAt: string | null;
  lastStripeEventId: string;
  lastStripeEventCreatedAt: number;
}>;

export type AiTierStripeLifecycleDecision =
  | Readonly<{
      decision: "apply";
      reason: null;
      mutation: AiTierStripeLifecycleMutation;
    }>
  | Readonly<{
      decision: "ignore" | "retry";
      reason: AiTierStripeLifecycleReason;
      mutation: null;
    }>;

export const AI_TIER_STRIPE_EVENT_TYPES: readonly string[];
export function getAiTierStripePriceAllowlistStatus(
  environment?: Readonly<Record<string, string | undefined>>,
): Readonly<{
  ready: boolean;
  blockers: readonly ("plus_price" | "ultra_price" | "duplicate_price")[];
}>;
export function decideAiTierStripeLifecycleEvent(input?: Readonly<{
  event?: unknown;
  current?: unknown;
  workspaceTargetVerified?: boolean;
  environment?: Readonly<Record<string, string | undefined>>;
}>): AiTierStripeLifecycleDecision;
export function redactAiTierStripeLifecycleDecision(
  result: AiTierStripeLifecycleDecision | unknown,
): Readonly<{
  decision: "apply" | "ignore" | "retry";
  reason: AiTierStripeLifecycleReason | "invalid_result" | null;
  tierId: "plus" | "ultra" | null;
}>;
