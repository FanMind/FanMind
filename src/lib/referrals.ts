import {
  getSupabaseHeaders,
  getSupabaseRestUrl,
} from "@/lib/supabase/config";
import type {
  ReferralProgramStatus,
  ReferralStatus,
} from "@/lib/adminReferrals";
import {
  REFERRAL_DISCOUNT_STEP_PERCENT,
  REFERRAL_GROWTH_WINDOW_CAP,
  REFERRAL_MAX_ACTIVE_COUNT,
  calculateReferralPercent,
  evaluateReferralWorkspaceEligibility,
  isReferralGrowthWindowOpen,
} from "@/lib/referralPolicy.mjs";

export {
  REFERRAL_DISCOUNT_STEP_PERCENT,
  REFERRAL_GROWTH_WINDOW_CAP,
  REFERRAL_MAX_ACTIVE_COUNT,
  calculateReferralPercent,
};

export type WorkspaceReferralMember = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  referral_code: string;
  eligible: boolean;
  status: ReferralStatus;
  override_active_referral_count: number | null;
  override_discount_percent: number | null;
  override_reason: string | null;
  joined_at: string | null;
  admin_note: string | null;
};

export type WorkspaceReferral = {
  id: string;
  referrer_workspace_id: string;
  referred_workspace_id: string | null;
  referral_code: string;
  status: ReferralStatus;
  created_during_program_status: ReferralProgramStatus;
  first_seen_at: string | null;
  qualified_at: string | null;
  activated_at: string | null;
  deactivated_at: string | null;
  deactivation_reason: string | null;
  billing_status_snapshot: string | null;
  locked_reason: string | null;
  created_at: string | null;
};

export type WorkspaceReferralState = {
  status: ReferralProgramStatus;
  active_paid_workspace_cap: number;
  active_paid_workspace_count: number;
};

export type WorkspaceReferralSummary = {
  member: WorkspaceReferralMember | null;
  referrals: WorkspaceReferral[];
  state: WorkspaceReferralState | null;
  eligible: boolean;
  eligibilityReason: string | null;
  activeReferralCount: number;
  billableActiveReferralCount: number;
  discountPercent: number;
  referralUrl: string | null;
  error: string | null;
};

type WorkspaceEligibilityRow = {
  id: string;
  plan_id: string | null;
  commercial_option: string | null;
  billing_status: string | null;
  setup_fee_cents: number | null;
  monthly_fee_cents: number | null;
  name: string | null;
};

type ReferralEligibility = {
  eligible: boolean;
  reason: string | null;
  workspace: WorkspaceEligibilityRow | null;
};

function serviceKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function publicBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    "https://fanmind.ch"
  ).replace(/\/$/, "");
}

function normalizeCode(code: string) {
  return code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 40);
}

async function fetchRows<T>(
  table: string,
  select: string,
  params: Record<string, string> = {},
) {
  const key = serviceKey();
  if (!key) {
    return {
      rows: [] as T[],
      error: "Supabase Service Role ist nicht konfiguriert.",
    };
  }
  try {
    const url = new URL(getSupabaseRestUrl(table));
    url.searchParams.set("select", select);
    for (const [name, value] of Object.entries(params)) {
      url.searchParams.set(name, value);
    }
    const response = await fetch(url, {
      headers: getSupabaseHeaders(key),
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        rows: [] as T[],
        error: `${table} konnte nicht geladen werden (${response.status}).`,
      };
    }
    return { rows: (await response.json()) as T[], error: null };
  } catch {
    return {
      rows: [] as T[],
      error: "Referral-Daten konnten nicht geladen werden.",
    };
  }
}

async function postRow<T>(
  table: string,
  values: Record<string, unknown>,
  select: string,
  upsert = false,
  onConflict = "workspace_id",
) {
  const key = serviceKey();
  if (!key) {
    return {
      row: null as T | null,
      error: "Supabase Service Role ist nicht konfiguriert.",
    };
  }
  const url = new URL(getSupabaseRestUrl(table));
  url.searchParams.set("select", select);
  if (upsert) url.searchParams.set("on_conflict", onConflict);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...getSupabaseHeaders(key),
      Prefer: `${upsert ? "resolution=merge-duplicates," : ""}return=representation`,
    },
    body: JSON.stringify(values),
    cache: "no-store",
  });
  if (!response.ok) {
    return {
      row: null,
      error: `${table} konnte nicht gespeichert werden (${response.status}).`,
    };
  }
  const rows = (await response.json()) as T[];
  return { row: rows[0] ?? null, error: null };
}

async function patchRows<T>(
  table: string,
  values: Record<string, unknown>,
  params: Record<string, string>,
  select: string,
) {
  const key = serviceKey();
  if (!key) {
    return {
      rows: [] as T[],
      error: "Supabase Service Role ist nicht konfiguriert.",
    };
  }
  const url = new URL(getSupabaseRestUrl(table));
  url.searchParams.set("select", select);
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value);
  }
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      ...getSupabaseHeaders(key),
      Prefer: "return=representation",
    },
    body: JSON.stringify(values),
    cache: "no-store",
  });
  if (!response.ok) {
    return {
      rows: [] as T[],
      error: `${table} konnte nicht aktualisiert werden (${response.status}).`,
    };
  }
  return { rows: (await response.json()) as T[], error: null };
}

export function buildReferralCode(workspaceId: string) {
  return normalizeCode(`FM-${workspaceId.replace(/-/g, "").slice(0, 10)}`);
}

function evaluateEligibility(
  workspace: WorkspaceEligibilityRow | null,
): ReferralEligibility {
  const policy = evaluateReferralWorkspaceEligibility(workspace);
  return { ...policy, workspace };
}

export async function getWorkspaceReferralEligibility(
  workspaceId: string,
): Promise<ReferralEligibility> {
  const result = await fetchRows<WorkspaceEligibilityRow>(
    "workspaces",
    "id,plan_id,commercial_option,billing_status,setup_fee_cents,monthly_fee_cents,name",
    { id: `eq.${workspaceId}`, limit: "1" },
  );
  if (result.error) {
    return { eligible: false, reason: result.error, workspace: null };
  }
  return evaluateEligibility(result.rows[0] ?? null);
}

export async function ensureWorkspaceReferralMember(
  workspaceId: string,
  userId: string | null,
) {
  const [existing, eligibility, stateResult] = await Promise.all([
    fetchRows<WorkspaceReferralMember>(
      "referral_program_members",
      "id,workspace_id,user_id,referral_code,eligible,status,override_active_referral_count,override_discount_percent,override_reason,joined_at,admin_note",
      { workspace_id: `eq.${workspaceId}`, limit: "1" },
    ),
    getWorkspaceReferralEligibility(workspaceId),
    fetchRows<WorkspaceReferralState>(
      "referral_program_state",
      "status,active_paid_workspace_cap,active_paid_workspace_count",
      { limit: "1" },
    ),
  ]);

  if (existing.error) {
    return {
      member: null,
      eligibility,
      error: existing.error,
    };
  }

  const existingMember = existing.rows[0] ?? null;
  const state = stateResult.rows[0] ?? {
    status: "open" as ReferralProgramStatus,
    active_paid_workspace_cap: REFERRAL_GROWTH_WINDOW_CAP,
    active_paid_workspace_count: 0,
  };
  const windowOpen = isReferralGrowthWindowOpen(
    state.status,
    state.active_paid_workspace_count,
    state.active_paid_workspace_cap,
  );

  if (!eligibility.eligible) {
    if (existingMember && existingMember.eligible) {
      const updated = await patchRows<WorkspaceReferralMember>(
        "referral_program_members",
        {
          eligible: false,
          status: "inactive",
          admin_note: eligibility.reason,
        },
        { id: `eq.${existingMember.id}` },
        "id,workspace_id,user_id,referral_code,eligible,status,override_active_referral_count,override_discount_percent,override_reason,joined_at,admin_note",
      );
      return {
        member: updated.rows[0] ?? existingMember,
        eligibility,
        error: updated.error,
      };
    }
    return { member: existingMember, eligibility, error: null };
  }

  const desiredStatus: ReferralStatus = windowOpen
    ? "active"
    : "locked_after_window_closed";
  if (existingMember) {
    if (
      existingMember.eligible !== true ||
      existingMember.status !== desiredStatus
    ) {
      const updated = await patchRows<WorkspaceReferralMember>(
        "referral_program_members",
        {
          user_id: userId,
          eligible: true,
          status: desiredStatus,
          joined_at: existingMember.joined_at ?? new Date().toISOString(),
          admin_note: windowOpen
            ? "Zahlender Workspace ist für das Empfehlungsprogramm freigeschaltet."
            : "Growth Window ist geschlossen; neue Rabattsteigerungen sind gesperrt.",
        },
        { id: `eq.${existingMember.id}` },
        "id,workspace_id,user_id,referral_code,eligible,status,override_active_referral_count,override_discount_percent,override_reason,joined_at,admin_note",
      );
      return {
        member: updated.rows[0] ?? existingMember,
        eligibility,
        error: updated.error,
      };
    }
    return { member: existingMember, eligibility, error: null };
  }

  const created = await postRow<WorkspaceReferralMember>(
    "referral_program_members",
    {
      workspace_id: workspaceId,
      user_id: userId,
      referral_code: buildReferralCode(workspaceId),
      eligible: true,
      status: desiredStatus,
      joined_at: new Date().toISOString(),
      admin_note: windowOpen
        ? "Zahlender Workspace automatisch für das Empfehlungsprogramm freigeschaltet."
        : "Growth Window geschlossen; Code bleibt dokumentiert, neue Rabatte sind gesperrt.",
    },
    "id,workspace_id,user_id,referral_code,eligible,status,override_active_referral_count,override_discount_percent,override_reason,joined_at,admin_note",
    true,
  );
  return {
    member: created.row,
    eligibility,
    error: created.error ?? stateResult.error,
  };
}

export async function createReferralAttribution(input: {
  referralCode: string;
  referredWorkspaceId: string;
  referredUserId: string | null;
}) {
  const code = normalizeCode(input.referralCode);
  if (!code) return { error: null };

  const [memberResult, stateResult] = await Promise.all([
    fetchRows<WorkspaceReferralMember>(
      "referral_program_members",
      "workspace_id,user_id,referral_code,status,eligible",
      { referral_code: `ilike.${code}`, limit: "1" },
    ),
    fetchRows<WorkspaceReferralState>(
      "referral_program_state",
      "status,active_paid_workspace_cap,active_paid_workspace_count",
      { limit: "1" },
    ),
  ]);
  const member = memberResult.rows[0];
  const state = stateResult.rows[0] ?? {
    status: "open" as ReferralProgramStatus,
    active_paid_workspace_cap: REFERRAL_GROWTH_WINDOW_CAP,
    active_paid_workspace_count: 0,
  };

  if (
    !member ||
    !member.eligible ||
    member.status !== "active" ||
    member.workspace_id === input.referredWorkspaceId
  ) {
    return { error: null };
  }

  const windowOpen = isReferralGrowthWindowOpen(
    state.status,
    state.active_paid_workspace_count,
    state.active_paid_workspace_cap,
  );
  const status: ReferralStatus = windowOpen
    ? "pending"
    : "locked_after_window_closed";
  const result = await postRow(
    "referrals",
    {
      referrer_workspace_id: member.workspace_id,
      referrer_user_id: member.user_id,
      referred_workspace_id: input.referredWorkspaceId,
      referred_user_id: input.referredUserId,
      referral_code: member.referral_code,
      status,
      created_during_program_status: state.status,
      billing_status_snapshot: "pending_payment_setup",
      locked_reason: windowOpen
        ? null
        : "Growth Window geschlossen oder 2000er-Cap erreicht.",
      admin_note: windowOpen
        ? "Signup-Attribution erfasst; Aktivierung folgt nach erfolgreicher Zahlung."
        : "Signup nach geschlossenem Growth Window erfasst und gesperrt.",
    },
    "id",
    true,
    "referred_workspace_id",
  );
  return { error: result.error };
}

export async function getWorkspaceReferralSummary(
  workspaceId: string,
  userId: string | null,
): Promise<WorkspaceReferralSummary> {
  const memberResult = await ensureWorkspaceReferralMember(workspaceId, userId);
  const member = memberResult.member;
  const stateResult = await fetchRows<WorkspaceReferralState>(
    "referral_program_state",
    "status,active_paid_workspace_cap,active_paid_workspace_count",
    { limit: "1" },
  );
  const state = stateResult.rows[0] ?? null;

  if (!member) {
    return {
      member: null,
      referrals: [],
      state,
      eligible: memberResult.eligibility.eligible,
      eligibilityReason: memberResult.eligibility.reason,
      activeReferralCount: 0,
      billableActiveReferralCount: 0,
      discountPercent: 0,
      referralUrl: null,
      error: memberResult.error ?? stateResult.error,
    };
  }

  const referralsResult = await fetchRows<WorkspaceReferral>(
    "referrals",
    "id,referrer_workspace_id,referred_workspace_id,referral_code,status,created_during_program_status,first_seen_at,qualified_at,activated_at,deactivated_at,deactivation_reason,billing_status_snapshot,locked_reason,created_at",
    {
      referrer_workspace_id: `eq.${workspaceId}`,
      order: "created_at.desc",
      limit: "100",
    },
  );
  const activeReferralCount = referralsResult.rows.filter(
    (referral) => referral.status === "active",
  ).length;
  const calculated = calculateReferralPercent(
    member.override_active_referral_count ?? activeReferralCount,
    member.override_discount_percent,
  );

  return {
    member,
    referrals: referralsResult.rows,
    state,
    eligible: memberResult.eligibility.eligible && member.eligible,
    eligibilityReason: memberResult.eligibility.reason,
    activeReferralCount,
    billableActiveReferralCount: calculated.billableActiveReferralCount,
    discountPercent: calculated.discountPercent,
    referralUrl:
      memberResult.eligibility.eligible && member.eligible
        ? `${publicBaseUrl()}/register?ref=${encodeURIComponent(member.referral_code)}`
        : null,
    error:
      memberResult.error ?? referralsResult.error ?? stateResult.error,
  };
}

export async function updateReferralAdminCorrection(input: {
  id: string;
  status: ReferralStatus;
  adminNote?: string | null;
}) {
  const key = serviceKey();
  if (!key) {
    return { error: "Supabase Service Role ist nicht konfiguriert." };
  }
  const url = new URL(getSupabaseRestUrl("referrals"));
  url.searchParams.set("id", `eq.${input.id}`);
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      ...getSupabaseHeaders(key),
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      status: input.status,
      admin_note: input.adminNote ?? null,
      admin_override: true,
    }),
    cache: "no-store",
  });
  return {
    error: response.ok
      ? null
      : `Referral konnte nicht korrigiert werden (${response.status}).`,
  };
}
