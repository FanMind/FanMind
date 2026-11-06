import { getSupabaseHeaders, getSupabaseRestUrl } from "@/lib/supabase/config";

export type ReferralProgramStatus = "open" | "closing" | "closed" | "reopened";
export type ReferralStatus = "pending" | "qualified" | "active" | "inactive" | "rejected" | "locked_after_window_closed";

export type ReferralProgramState = {
  id: string;
  status: ReferralProgramStatus;
  active_paid_workspace_cap: number;
  active_paid_workspace_count: number;
  active_paid_workspace_count_snapshot: number;
  closed_at: string | null;
  reopened_at: string | null;
  updated_at: string | null;
  updated_by_user_id: string | null;
  admin_note: string | null;
};

export type ReferralProgramMember = {
  id: string; workspace_id: string; user_id: string | null; referral_code: string; eligible: boolean; status: ReferralStatus;
  override_active_referral_count: number | null; override_discount_percent: number | null; override_reason: string | null;
  joined_at: string | null; created_at: string | null; updated_at: string | null; admin_note: string | null;
};

export type Referral = {
  id: string; referrer_workspace_id: string; referrer_user_id: string | null; referred_workspace_id: string | null; referred_user_id: string | null;
  referral_code: string; status: ReferralStatus; created_during_program_status: ReferralProgramStatus; first_seen_at: string | null;
  qualified_at: string | null; activated_at: string | null; deactivated_at: string | null; deactivation_reason: string | null;
  billing_status_snapshot: string | null; locked_reason: string | null; admin_override: boolean | null; admin_note: string | null;
};

export type ReferralDiscountSnapshot = {
  id: string; workspace_id: string; active_referral_count: number; discount_percent: number;
  monthly_fee_cents_before_discount: number | null; monthly_discount_cents: number | null; monthly_fee_cents_after_discount: number | null;
  program_status_snapshot: ReferralProgramStatus; calculated_at: string | null; admin_note: string | null;
};

export type AdminReferralWorkspace = { id: string; name: string | null; monthly_fee_cents: number | null; billing_status: string | null; plan_id: string | null };

function serviceKey() { return process.env.SUPABASE_SERVICE_ROLE_KEY; }

async function fetchRows<T>(table: string, select: string, params: Record<string, string> = {}) {
  const key = serviceKey();
  if (!key) return { rows: [] as T[], error: "Supabase Service Role ist nicht konfiguriert." };
  try {
    const url = new URL(getSupabaseRestUrl(table));
    url.searchParams.set("select", select);
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
    const response = await fetch(url, { headers: getSupabaseHeaders(key), cache: "no-store" });
    if (!response.ok) return { rows: [] as T[], error: `${table} konnte nicht geladen werden (${response.status}). Migration evtl. noch nicht live.` };
    return { rows: await response.json() as T[], error: null };
  } catch {
    return { rows: [] as T[], error: "Referral-Daten konnten nicht geladen werden." };
  }
}

export function calculateReferralDiscount(activeReferralCount: number, overrideDiscountPercent?: number | null) {
  const effectiveActiveReferrals = Math.max(0, Math.min(activeReferralCount, 20));
  const calculatedDiscountPercent = Math.min(effectiveActiveReferrals * 5, 100);
  return overrideDiscountPercent ?? calculatedDiscountPercent;
}

export async function getAdminReferralOverview() {
  const [stateResult, membersResult, referralsResult, snapshotsResult, workspacesResult] = await Promise.all([
    fetchRows<ReferralProgramState>("referral_program_state", "id,status,active_paid_workspace_cap,active_paid_workspace_count,active_paid_workspace_count_snapshot,closed_at,reopened_at,updated_at,updated_by_user_id,admin_note", { order: "updated_at.desc", limit: "1" }),
    fetchRows<ReferralProgramMember>("referral_program_members", "id,workspace_id,user_id,referral_code,eligible,status,override_active_referral_count,override_discount_percent,override_reason,joined_at,created_at,updated_at,admin_note", { order: "updated_at.desc.nullslast,created_at.desc", limit: "200" }),
    fetchRows<Referral>("referrals", "id,referrer_workspace_id,referrer_user_id,referred_workspace_id,referred_user_id,referral_code,status,created_during_program_status,first_seen_at,qualified_at,activated_at,deactivated_at,deactivation_reason,billing_status_snapshot,locked_reason,admin_override,admin_note", { order: "created_at.desc", limit: "300" }),
    fetchRows<ReferralDiscountSnapshot>("referral_discount_snapshots", "id,workspace_id,active_referral_count,discount_percent,monthly_fee_cents_before_discount,monthly_discount_cents,monthly_fee_cents_after_discount,program_status_snapshot,calculated_at,admin_note", { order: "calculated_at.desc", limit: "200" }),
    fetchRows<AdminReferralWorkspace>("workspaces", "id,name,monthly_fee_cents,billing_status,plan_id", { limit: "500" }),
  ]);

  const errors = [stateResult.error, membersResult.error, referralsResult.error, snapshotsResult.error, workspacesResult.error].filter(Boolean) as string[];
  const workspaces = new Map(workspacesResult.rows.map((workspace) => [workspace.id, workspace]));
  const activeReferralCounts = new Map<string, number>();
  for (const referral of referralsResult.rows) {
    if (referral.status === "active") activeReferralCounts.set(referral.referrer_workspace_id, (activeReferralCounts.get(referral.referrer_workspace_id) ?? 0) + 1);
  }

  return {
    state: stateResult.rows[0] ?? null,
    members: membersResult.rows,
    referrals: referralsResult.rows,
    snapshots: snapshotsResult.rows,
    workspaces,
    activeReferralCounts,
    error: errors[0] ?? null,
  };
}
