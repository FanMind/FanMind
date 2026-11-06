export type StripeBillingEventSyncResult = Readonly<{
  status:
    | "disabled"
    | "retry"
    | "applied"
    | "ignored"
    | "reconciliation_needed"
    | "unresolved";
  reason: string | null;
  workspaceId: string | null;
  revision: number | null;
}>;

export function syncStripeBillingEvent(input?: {
  event?: unknown;
  projection?: Record<string, unknown>;
  referralBillingStatus?: string | null;
  signedEventVerified?: boolean;
  environment?: Record<string, string | undefined>;
  fetchImplementation?: typeof fetch;
}): Promise<StripeBillingEventSyncResult>;
