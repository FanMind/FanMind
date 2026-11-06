import type { WorkspaceDashboardRow } from "./supabase/server";
export function addMonthsIso(startIso?: string | null, months?: number): string;
export function resolveSubscriptionCancellation(workspace: Partial<WorkspaceDashboardRow> | null | undefined, stripeSubscription?: Record<string, unknown>): {
  canSelfService: boolean;
  currentPackage: string;
  minimumTermEndsAt: string | null;
  nextBillingAt: string | null;
  possibleCancellationAt: string;
  effectiveEndAt: string;
  stripeCancelAtPeriodEnd: boolean;
  requiresCancelAtTimestamp: boolean;
};
export function isWorkspaceArchivedAfterSubscriptionEnd(workspace: Partial<WorkspaceDashboardRow> | null | undefined, now?: Date): boolean;
