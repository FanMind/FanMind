import "server-only";

import { AI_CAPACITY_PUBLIC_PACKAGES } from "@/config/aiCapacityPackages.mjs";
import { getAiCapacityAdminState } from "@/lib/aiCapacityAdmin";
import { STAGING_CAPACITY_PRICE_CONTRACTS } from "@/lib/stagingStripeCatalogPolicy.mjs";
import { isStripeBillingEventLedgerEnabled } from "@/lib/stripeBillingEventLedger.mjs";
import { isStripeTestSecretKey } from "@/lib/stripeKeyPolicy.mjs";
import { getSupabaseApiKeyHeaders, getSupabaseRestUrl } from "@/lib/supabase/config";

export type CapacityCheckoutPlan = {
  billingContract: "capacity_v2";
  planId: "capacity_99" | "capacity_199" | "capacity_312";
  commercialOption: "capacity_v2";
  mode: "subscription";
  priceIds: [string];
  setupFeeCents: 0;
  monthlyFeeCents: number;
  commitmentMonths: 0;
  paymentCollectionMethod: "card";
};

function isCapacityPackage(value: unknown): value is CapacityCheckoutPlan["planId"] {
  return typeof value === "string" && Object.hasOwn(AI_CAPACITY_PUBLIC_PACKAGES, value);
}

export function capacityCheckoutSandboxEnabled() {
  return process.env.FANMIND_RUNTIME_ENVIRONMENT === "staging" &&
    process.env.NEXT_PUBLIC_APP_URL === "https://staging.fanmind.ch" &&
    process.env.NEXT_PUBLIC_SUPABASE_URL === "https://vshyhvgcmrlagvfnvomc.supabase.co" &&
    process.env.FANMIND_STAGING_CAPACITY_CHECKOUT_READY === "true" &&
    isStripeTestSecretKey(process.env.STRIPE_SECRET_KEY) &&
    isStripeBillingEventLedgerEnabled();
}

type Decision = { kind: "legacy" | "blocked" } | { kind: "capacity"; plan: CapacityCheckoutPlan };

export async function readCapacityCheckoutPlan(workspaceId: string, userId: string): Promise<Decision> {
  if (!capacityCheckoutSandboxEnabled()) return { kind: "legacy" };
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) return { kind: "blocked" };

  try {
    const response = await fetch(getSupabaseRestUrl("rpc/read_ai_capacity_checkout_contract"), {
      method: "POST",
      headers: { ...getSupabaseApiKeyHeaders(key, key), "content-type": "application/json" },
      body: JSON.stringify({ p_workspace_id: workspaceId, p_owner_user_id: userId }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { kind: "blocked" };
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length > 1) return { kind: "blocked" };
    if (rows.length === 0) return { kind: "legacy" };

    const row = rows[0];
    const packageId: unknown = row?.package_id;
    if (!isCapacityPackage(packageId) || row?.eligible !== true) return { kind: "blocked" };
    const priceId: unknown = row.price_id;
    const slot = STAGING_CAPACITY_PRICE_CONTRACTS.find(contract => contract.slot === packageId);
    if (!slot || typeof priceId !== "string" || !/^price_[A-Za-z0-9]+$/u.test(priceId) ||
      process.env[slot.environmentName] !== priceId ||
      STAGING_CAPACITY_PRICE_CONTRACTS.filter(contract => process.env[contract.environmentName] === priceId).length !== 1 ||
      priceId === process.env.STRIPE_PRICE_STARTER_MONTHLY || priceId === process.env.STRIPE_PRICE_INTERNAL_DAILY_TEST) {
      return { kind: "blocked" };
    }

    const admin = await getAiCapacityAdminState();
    if (!admin.installed || !admin.policy.globalCapacityEnabled || admin.policy.emergencySpendFreeze ||
      !admin.policy.packageSalesEnabled[packageId]) return { kind: "blocked" };

    return { kind: "capacity", plan: {
      billingContract: "capacity_v2",
      planId: packageId,
      commercialOption: "capacity_v2",
      mode: "subscription",
      priceIds: [priceId],
      setupFeeCents: 0,
      monthlyFeeCents: slot.unitAmount,
      commitmentMonths: 0,
      paymentCollectionMethod: "card",
    } };
  } catch {
    return { kind: "blocked" };
  }
}
