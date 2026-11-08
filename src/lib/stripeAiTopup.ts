import "server-only";
import { getStripeClient, createStripeIntegrationIdentifier } from "@/lib/stripeClient";
import { getStripeConfigStatus, findWorkspaceIdByStripeReferences } from "@/lib/stripeBilling";
import { getAiCapacityAdminState } from "@/lib/aiCapacityAdmin";
import { AI_CAPACITY_PACKAGE_IDS } from "@/lib/aiCapacityPolicy.mjs";
import { grantAiCapacityCredit, reversePurchasedAiCapacity } from "@/lib/aiCapacityLedger";
import { createStripeTopupCheckout, handleStripeTopupEvent, stripeTopupSandboxReady } from "@/lib/stripeAiTopupLifecycle.mjs";
import { getSupabaseApiKeyHeaders, getSupabaseRestUrl } from "@/lib/supabase/config";
import type { WorkspaceDashboardRow } from "@/lib/supabase/server";
import { isStripeBillingWriteFrozen } from "@/lib/stripeBillingWriteFreeze.mjs";

export async function isWorkspaceTopupAdmitted(workspace: WorkspaceDashboardRow): Promise<boolean> {
  if (!stripeTopupSandboxReady() || isStripeBillingWriteFrozen() || workspace.billing_status !== "active" ||
      workspace.workspace_access_mode !== "active" || workspace.billing_suspended_at ||
      !workspace.stripe_customer_id || !workspace.stripe_subscription_id) return false;
  const admin = await getAiCapacityAdminState();
  if (!admin.installed || !admin.policy.globalCapacityEnabled || admin.policy.emergencySpendFreeze ||
      !admin.policy.topUpSalesEnabled) return false;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) return false;
  try {
    const query = new URLSearchParams({ select: "billing_contract_version,package_id,active,period_start,period_end",
      workspace_id: `eq.${workspace.id}`, limit: "2" });
    const response = await fetch(getSupabaseRestUrl(`ai_capacity_workspace_entitlements?${query}`), {
      headers: getSupabaseApiKeyHeaders(key, key), cache: "no-store", signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const rows = await response.json() as Array<{ billing_contract_version?: unknown; package_id?: unknown;
      active?: unknown; period_start?: string; period_end?: string }>;
    const row = rows[0];
    return rows.length === 1 && row?.active === true && row.billing_contract_version === "capacity_v2" &&
      typeof row.package_id === "string" && AI_CAPACITY_PACKAGE_IDS.some(id => id === row.package_id) &&
      Date.parse(row.period_start ?? "") <= Date.now() && Date.parse(row.period_end ?? "") > Date.now();
  } catch { return false; }
}

export async function startWorkspaceTopup(input: { workspace: WorkspaceDashboardRow; topupKey: string; requestId: string }) {
  const stripe = getStripeClient();
  if (!stripe) throw new Error("stripe_topup_unavailable");
  return createStripeTopupCheckout({ workspaceId: input.workspace.id, customerId: input.workspace.stripe_customer_id,
    topupKey: input.topupKey, requestId: input.requestId, admitted: await isWorkspaceTopupAdmitted(input.workspace),
    taxReady: getStripeConfigStatus().readyForTax }, { stripe, integrationIdentifier: createStripeIntegrationIdentifier });
}

export async function processStripeTopupEvent(event: object): Promise<boolean> {
  const stripe = getStripeClient();
  return handleStripeTopupEvent(event, { stripe, findWorkspace: findWorkspaceIdByStripeReferences,
    grant: async (input: Parameters<typeof grantAiCapacityCredit>[0]) => {
      if (isStripeBillingWriteFrozen()) throw new Error("stripe_topup_frozen");
      return grantAiCapacityCredit(input);
    },
    reverse: async (input: Parameters<typeof reversePurchasedAiCapacity>[0]) => {
      if (isStripeBillingWriteFrozen()) throw new Error("stripe_topup_frozen");
      return reversePurchasedAiCapacity(input);
    } });
}
