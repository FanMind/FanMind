import type { AiTierStripeLifecycleReason } from "./aiTierStripeLifecycle.mjs";

export type AiTierStripeEntitlementSyncReason =
  | AiTierStripeLifecycleReason
  | "signature_verification"
  | "tenant_binding"
  | "event_payload"
  | "storage_configuration"
  | "storage_state"
  | "storage_write"
  | "storage_unavailable"
  | "reconciliation_pending";

export type AiTierStripeEntitlementSyncResult = Readonly<{
  status:
    | "disabled"
    | "ignored"
    | "applied"
    | "reconciliation_needed"
    | "retry";
  reason: AiTierStripeEntitlementSyncReason | null;
}>;

export function syncWorkspaceAiTierStripeEntitlement(input?: Readonly<{
  workspaceId?: unknown;
  event?: unknown;
  signedEventVerified?: boolean;
  environment?: Readonly<Record<string, string | undefined>>;
  fetchImplementation?: typeof fetch;
}>): Promise<AiTierStripeEntitlementSyncResult>;
