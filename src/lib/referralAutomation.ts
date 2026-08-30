import {
  getSupabaseHeaders,
  getSupabaseRestUrl,
} from "@/lib/supabase/config";
import { referralCouponMatchesContract } from "@/lib/referralStripeCouponPolicy.mjs";
import { getStripeClient, getStripeErrorDetails } from "@/lib/stripeClient";

export type ReferralAutomationResult = {
  handled: boolean;
  snapshotId?: string;
  referrerWorkspaceId?: string;
  discountPercent?: number;
  stripeStatus?: string;
  error?: string;
};

type ReferralSyncRow = {
  referral_id: string;
  referrer_workspace_id: string;
  snapshot_id: string;
  active_referral_count: number;
  discount_percent: number;
  monthly_fee_cents_before_discount: number;
  monthly_discount_cents: number;
  monthly_fee_cents_after_discount: number;
  stripe_subscription_id: string | null;
  previous_discount_percent: number | null;
  previous_stripe_sync_status: string | null;
  program_status: string;
  duplicate_event: boolean;
};

type ReferralReconcileRow = {
  referred_workspace_id: string;
  billing_status_snapshot: string | null;
};

type WorkspaceBillingRow = {
  id: string;
  billing_status: string | null;
};

const REFERRAL_BILLING_FLAG = "FANMIND_ENABLE_REFERRAL_BILLING";

function serviceRoleKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
}

function referralBillingEnabled(): boolean {
  return process.env[REFERRAL_BILLING_FLAG] === "true";
}

async function callRpc<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<{ rows: T[]; error: string | null }> {
  const key = serviceRoleKey();
  if (!key) {
    return {
      rows: [],
      error: "SUPABASE_SERVICE_ROLE_KEY ist nicht konfiguriert.",
    };
  }

  try {
    const response = await fetch(getSupabaseRestUrl(`rpc/${name}`), {
      method: "POST",
      headers: getSupabaseHeaders(key),
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!response.ok) {
      const message = await response.text().catch(() => "");
      return {
        rows: [],
        error: `${name} fehlgeschlagen (${response.status})${message ? `: ${message.slice(0, 300)}` : ""}`,
      };
    }
    const payload = (await response.json().catch(() => [])) as T[] | T | null;
    return {
      rows: Array.isArray(payload) ? payload : payload ? [payload] : [],
      error: null,
    };
  } catch (error) {
    return {
      rows: [],
      error: error instanceof Error ? error.message : `${name} fehlgeschlagen.`,
    };
  }
}

async function updateSnapshot(
  snapshotId: string,
  values: Record<string, unknown>,
): Promise<string | null> {
  const key = serviceRoleKey();
  if (!key) return "SUPABASE_SERVICE_ROLE_KEY ist nicht konfiguriert.";

  try {
    const url = new URL(getSupabaseRestUrl("referral_discount_snapshots"));
    url.searchParams.set("id", `eq.${snapshotId}`);
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        ...getSupabaseHeaders(key),
        Prefer: "return=minimal",
      },
      body: JSON.stringify(values),
      cache: "no-store",
    });
    return response.ok
      ? null
      : `Referral-Snapshot konnte nicht aktualisiert werden (${response.status}).`;
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Referral-Snapshot konnte nicht aktualisiert werden.";
  }
}

function couponId(percent: number): string {
  return `fanmind-referral-${Math.max(0, Math.min(percent, 100))}`;
}

function stripeResourceId(value: unknown, prefix: string): string | null {
  if (typeof value === "string" && value.startsWith(prefix)) return value;
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as { id?: unknown }).id === "string" &&
    (value as { id: string }).id.startsWith(prefix)
  ) {
    return (value as { id: string }).id;
  }
  return null;
}

async function ensureStripeCoupon(percent: number): Promise<{
  couponId?: string;
  error?: string;
}> {
  const stripe = getStripeClient();
  if (!stripe) {
    return { error: "STRIPE_SECRET_KEY ist nicht konfiguriert." };
  }
  const starterMonthlyPrice = process.env.STRIPE_PRICE_STARTER_MONTHLY;
  if (!starterMonthlyPrice) {
    return { error: "STRIPE_PRICE_STARTER_MONTHLY ist nicht konfiguriert." };
  }
  let price: Record<string, unknown>;
  try {
    price = (await stripe.prices.retrieve(
      starterMonthlyPrice,
    )) as unknown as Record<string, unknown>;
  } catch (error) {
    const details = getStripeErrorDetails(error);
    return {
      error:
        details.message ??
        `Stripe Core-Preis konnte nicht geprüft werden (${details.status}).`,
    };
  }
  const coreProductId = stripeResourceId(price.product, "prod_");
  if (!coreProductId) {
    return { error: "Stripe Core-Produkt konnte nicht eindeutig bestimmt werden." };
  }

  const id = couponId(percent);
  try {
    const existing = (await stripe.coupons.retrieve(
      id,
    )) as unknown as Record<string, unknown>;
    return referralCouponMatchesContract(existing, percent, coreProductId)
      ? { couponId: id }
      : {
          error:
            "Vorhandener Referral-Coupon ist nicht ausschließlich auf das Starter-Core-Produkt begrenzt.",
        };
  } catch (error) {
    const details = getStripeErrorDetails(error);
    if (details.status !== 404) {
      return {
        error:
          details.message ??
          `Stripe Coupon-Prüfung fehlgeschlagen (${details.status}).`,
      };
    }
  }

  try {
    await stripe.coupons.create({
      id,
      duration: "forever",
      percent_off: percent,
      name: `FanMind Empfehlung ${percent} %`,
      applies_to: { products: [coreProductId] },
      metadata: {
        fanmind_feature: "referral_growth_window",
        discount_percent: String(percent),
      },
    });
    return { couponId: id };
  } catch (error) {
    const details = getStripeErrorDetails(error);
    if (details.code === "resource_already_exists") {
      try {
        const raced = (await stripe.coupons.retrieve(
          id,
        )) as unknown as Record<string, unknown>;
        return referralCouponMatchesContract(raced, percent, coreProductId)
          ? { couponId: id }
          : {
              error:
                "Zeitgleich erstellter Referral-Coupon verletzt den Starter-Core-Vertrag.",
            };
      } catch {
        return {
          error:
            "Zeitgleich erstellter Referral-Coupon konnte nicht verifiziert werden.",
        };
      }
    }
    return {
      error:
        details.message ??
        `Stripe Coupon konnte nicht erstellt werden (${details.status}).`,
    };
  }
}

async function applyStripeDiscount(input: {
  subscriptionId: string;
  discountPercent: number;
  referrerWorkspaceId: string;
  snapshotId: string;
}): Promise<{ status: "applied" | "cleared"; couponId: string | null; error?: string }> {
  const stripe = getStripeClient();
  if (!stripe) {
    return {
      status: input.discountPercent > 0 ? "applied" : "cleared",
      couponId: null,
      error: "STRIPE_SECRET_KEY ist nicht konfiguriert.",
    };
  }

  let coupon: string | null = null;
  if (input.discountPercent > 0) {
    const ensured = await ensureStripeCoupon(input.discountPercent);
    if (!ensured.couponId) {
      return {
        status: "applied",
        couponId: null,
        error: ensured.error ?? "Referral-Coupon konnte nicht vorbereitet werden.",
      };
    }
    coupon = ensured.couponId;
  }

  try {
    await stripe.subscriptions.update(input.subscriptionId, {
      proration_behavior: "none",
      metadata: {
        fanmind_referral_discount_percent: String(input.discountPercent),
        fanmind_referrer_workspace_id: input.referrerWorkspaceId,
        fanmind_referral_snapshot_id: input.snapshotId,
      },
      discounts: coupon ? [{ coupon }] : "",
    });
  } catch (error) {
    const details = getStripeErrorDetails(error);
    return {
      status: input.discountPercent > 0 ? "applied" : "cleared",
      couponId: coupon,
      error:
        details.message ??
        `Stripe-Subscription konnte nicht aktualisiert werden (${details.status}).`,
    };
  }

  return {
    status: input.discountPercent > 0 ? "applied" : "cleared",
    couponId: coupon,
  };
}

export async function syncReferralAutomationForWorkspace(input: {
  workspaceId: string;
  billingStatus: string | null | undefined;
  eventId?: string | null;
  eventType?: string | null;
}): Promise<ReferralAutomationResult> {
  if (!input.workspaceId) {
    return { handled: false, error: "workspaceId fehlt." };
  }

  const rpc = await callRpc<ReferralSyncRow>("sync_referral_for_workspace", {
    p_workspace_id: input.workspaceId,
    p_billing_status: input.billingStatus ?? "unknown",
    p_event_id: input.eventId ?? null,
    p_event_type: input.eventType ?? "billing_update",
  });
  if (rpc.error) return { handled: false, error: rpc.error };

  const row = rpc.rows[0];
  if (!row) return { handled: false };
  if (row.duplicate_event) {
    return {
      handled: true,
      snapshotId: row.snapshot_id,
      referrerWorkspaceId: row.referrer_workspace_id,
      discountPercent: row.discount_percent,
      stripeStatus: "duplicate",
    };
  }

  const baseResult: ReferralAutomationResult = {
    handled: true,
    snapshotId: row.snapshot_id,
    referrerWorkspaceId: row.referrer_workspace_id,
    discountPercent: row.discount_percent,
  };

  if (!row.stripe_subscription_id || row.monthly_fee_cents_before_discount <= 0) {
    await updateSnapshot(row.snapshot_id, {
      stripe_sync_status: "not_applicable",
      stripe_sync_error: null,
      stripe_synced_at: new Date().toISOString(),
    });
    return { ...baseResult, stripeStatus: "not_applicable" };
  }

  if (!referralBillingEnabled()) {
    await updateSnapshot(row.snapshot_id, {
      stripe_sync_status: "disabled",
      stripe_sync_error: `${REFERRAL_BILLING_FLAG} ist nicht aktiviert.`,
    });
    return { ...baseResult, stripeStatus: "disabled" };
  }

  if (
    row.previous_discount_percent === row.discount_percent &&
    ["applied", "cleared", "unchanged"].includes(
      row.previous_stripe_sync_status ?? "",
    )
  ) {
    await updateSnapshot(row.snapshot_id, {
      stripe_sync_status: "unchanged",
      stripe_sync_error: null,
      stripe_synced_at: new Date().toISOString(),
      stripe_coupon_id:
        row.discount_percent > 0 ? couponId(row.discount_percent) : null,
    });
    return { ...baseResult, stripeStatus: "unchanged" };
  }

  const stripeResult = await applyStripeDiscount({
    subscriptionId: row.stripe_subscription_id,
    discountPercent: row.discount_percent,
    referrerWorkspaceId: row.referrer_workspace_id,
    snapshotId: row.snapshot_id,
  });

  if (stripeResult.error) {
    await updateSnapshot(row.snapshot_id, {
      stripe_sync_status: "error",
      stripe_sync_error: stripeResult.error.slice(0, 1000),
      stripe_coupon_id: stripeResult.couponId,
    });
    return {
      ...baseResult,
      stripeStatus: "error",
      error: stripeResult.error,
    };
  }

  await updateSnapshot(row.snapshot_id, {
    stripe_sync_status: stripeResult.status,
    stripe_sync_error: null,
    stripe_synced_at: new Date().toISOString(),
    stripe_coupon_id: stripeResult.couponId,
  });
  return { ...baseResult, stripeStatus: stripeResult.status };
}

async function fetchReconcileCandidates(): Promise<{
  rows: ReferralReconcileRow[];
  error: string | null;
}> {
  const key = serviceRoleKey();
  if (!key) {
    return {
      rows: [],
      error: "SUPABASE_SERVICE_ROLE_KEY ist nicht konfiguriert.",
    };
  }
  const url = new URL(getSupabaseRestUrl("referrals"));
  url.searchParams.set("select", "referred_workspace_id,billing_status_snapshot");
  url.searchParams.set("referred_workspace_id", "not.is.null");
  url.searchParams.set("limit", "5000");
  try {
    const response = await fetch(url, {
      headers: getSupabaseHeaders(key),
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        rows: [],
        error: `Referral-Kandidaten konnten nicht geladen werden (${response.status}).`,
      };
    }
    return {
      rows: (await response.json()) as ReferralReconcileRow[],
      error: null,
    };
  } catch (error) {
    return {
      rows: [],
      error: error instanceof Error ? error.message : "Reconciliation fehlgeschlagen.",
    };
  }
}

async function fetchWorkspaceBillingStatus(
  workspaceId: string,
): Promise<string | null> {
  const key = serviceRoleKey();
  if (!key) return null;
  const url = new URL(getSupabaseRestUrl("workspaces"));
  url.searchParams.set("select", "id,billing_status");
  url.searchParams.set("id", `eq.${workspaceId}`);
  url.searchParams.set("limit", "1");
  const response = await fetch(url, {
    headers: getSupabaseHeaders(key),
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) return null;
  const rows = (await response.json().catch(() => [])) as WorkspaceBillingRow[];
  return rows[0]?.billing_status ?? null;
}

export async function reconcileReferralAutomation(): Promise<{
  checked: number;
  handled: number;
  errors: string[];
}> {
  const stateResult = await callRpc("refresh_referral_program_state", {
    p_event_type: "scheduled_reconcile",
  });
  const candidates = await fetchReconcileCandidates();
  const errors: string[] = [];
  if (stateResult.error) errors.push(stateResult.error);
  if (candidates.error) errors.push(candidates.error);

  let handled = 0;
  for (const candidate of candidates.rows) {
    if (!candidate.referred_workspace_id) continue;
    const billingStatus =
      (await fetchWorkspaceBillingStatus(candidate.referred_workspace_id)) ??
      candidate.billing_status_snapshot ??
      "unknown";
    const result = await syncReferralAutomationForWorkspace({
      workspaceId: candidate.referred_workspace_id,
      billingStatus,
      eventId: `reconcile:${candidate.referred_workspace_id}:${new Date()
        .toISOString()
        .slice(0, 10)}`,
      eventType: "scheduled_reconcile",
    });
    if (result.handled) handled += 1;
    if (result.error) errors.push(result.error);
  }

  return {
    checked: candidates.rows.length,
    handled,
    errors: [...new Set(errors)].slice(0, 50),
  };
}
