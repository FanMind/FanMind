import type { WorkspaceDashboardRow } from "@/lib/supabase/server";
import { isWorkspaceBillingSuspended } from "@/lib/billing";
import { isPlatformAdminEmail } from "@/lib/admin";
import { isDemoWorkspace } from "@/lib/demoMode";
import { isAdminCrmAccessWorkspace } from "@/lib/adminCrmAccessPolicy.mjs";
import { evaluateWorkspaceProcessingEntitlement } from "@/lib/workspaceProcessingPolicy.mjs";

const ASYNC_BILLING_STATUSES = new Set(["pending_sepa_mandate"]);
const PRE_ACTIVATION_BILLING_STATUSES = new Set(["pending_payment_setup", "past_due", "payment_failed"]);

type PreActivationWorkspace = Pick<WorkspaceDashboardRow, "billing_status" | "plan_id" | "name"> &
  Partial<Pick<WorkspaceDashboardRow,
    "role" |
    "member_safe_projection" |
    "member_processing_allowed" |
    "workspace_access_mode" |
    "subscription_effective_end_at" |
    "billing_manual_override" |
    "billing_grace_until" |
    "billing_suspended_at" |
    "test_access_flags"
  >>;

export function getPreActivationRedirect(
  workspace: PreActivationWorkspace | null | undefined,
  userEmail?: string | null,
): string | null {
  if (!workspace) return "/workspace/setup";
  if (isPlatformAdminEmail(userEmail)) return null;
  if (workspace.role && workspace.role !== "owner") {
    return workspace.member_safe_projection === true &&
      workspace.member_processing_allowed === true
      ? null
      : "/workspace/access-paused";
  }
  if (isAdminCrmAccessWorkspace(workspace)) {
    return evaluateWorkspaceProcessingEntitlement(workspace).allowed
      ? null
      : "/workspace/access-paused";
  }
  if (isDemoWorkspace(workspace)) return null;
  if (isWorkspaceBillingSuspended(workspace)) return "/billing/suspended";
  if (workspace.billing_status === "active") return null;
  if (ASYNC_BILLING_STATUSES.has(String(workspace.billing_status))) return "/billing/pending";
  if (PRE_ACTIVATION_BILLING_STATUSES.has(String(workspace.billing_status)) || (workspace.plan_id === "pilot" || workspace.plan_id === "starter")) {
    return "/billing/start";
  }
  return null;
}

export function getBillingContinuationHref(
  workspace: PreActivationWorkspace | null | undefined,
  userEmail?: string | null,
): string {
  return getPreActivationRedirect(workspace, userEmail) ?? "/dashboard";
}
