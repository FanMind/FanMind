export type StripeBillingLedgerStatus =
  | "applied"
  | "ignored"
  | "reconciliation_needed"
  | "unresolved";

export type StripeBillingLedgerCommandResult = Readonly<{
  status: "record" | "retry";
  reason: string | null;
  command: Readonly<Record<string, unknown>> | null;
}>;

export function isStripeBillingEventLedgerEnabled(
  environment?: Record<string, string | undefined>,
): boolean;
export function isStripeBillingEventLedgerCaptureEnabled(
  environment?: Record<string, string | undefined>,
): boolean;
export function buildStripeBillingLedgerCommand(input?: {
  event?: unknown;
  projection?: Record<string, unknown>;
  referralBillingStatus?: string | null;
  signedEventVerified?: boolean;
}): StripeBillingLedgerCommandResult;
export function buildStripeBillingLedgerRpcBody(
  command: Record<string, unknown>,
  options?: { projectionEnabled?: boolean },
): Record<string, unknown>;
export function normalizeStripeBillingLedgerRpcResult(payload: unknown):
  | Readonly<{
      status: StripeBillingLedgerStatus;
      reason: string | null;
      workspaceId: string | null;
      revision: number;
    }>
  | null;
export const STRIPE_BILLING_LEDGER_EVENT_TYPES: readonly string[];
export const STRIPE_BILLING_LEDGER_PROJECTION_FIELDS: readonly string[];
export function normalizeStripeBillingProjection(fields: unknown): Readonly<Record<string, unknown>> | null;
