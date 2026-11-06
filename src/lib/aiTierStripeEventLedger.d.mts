import type {
  AiTierStripeLifecycleReason,
  AiTierStripeLifecycleMutation,
} from "./aiTierStripeLifecycle.mjs";

export type AiTierStripeLedgerCommandReason =
  | AiTierStripeLifecycleReason
  | "signature_verification"
  | "tenant_binding";

export type AiTierStripeLedgerCommand = Readonly<{
  workspaceId: unknown;
  eventId: string;
  eventCreatedAt: number;
  eventType: string;
  customerId: string;
  subscriptionId: string;
  payloadFingerprint: string;
  paidItem: Readonly<{
    tierId: AiTierStripeLifecycleMutation["tierId"];
    lifecycleStatus: AiTierStripeLifecycleMutation["status"];
    subscriptionItemId: string;
    priceId: string;
    effectiveAt: string;
    expiresAt: string | null;
  }> | null;
}>;

export function buildAiTierStripeLedgerCommand(input?: Readonly<{
  workspaceId?: unknown;
  event?: unknown;
  signedEventVerified?: boolean;
  environment?: Readonly<Record<string, string | undefined>>;
}>): Readonly<{
  status: "record" | "ignored" | "retry";
  reason: AiTierStripeLedgerCommandReason | null;
  command: AiTierStripeLedgerCommand | null;
}>;

export function buildAiTierStripeLedgerRpcBody(
  command: AiTierStripeLedgerCommand,
): Readonly<Record<string, unknown>>;

export function normalizeAiTierStripeLedgerRpcResult(
  payload: unknown,
): Readonly<{
  status: "applied" | "ignored" | "reconciliation_needed";
  reason:
    | "duplicate_event"
    | "stale_event"
    | "unrelated_price"
    | "event_identity"
    | "event_order_conflict"
    | "reconciliation_pending"
    | "subscription_mismatch"
    | null;
  revision: number;
}> | null;
