import "server-only";

import {
  DEFAULT_AI_CAPACITY_ADMIN_POLICY,
  normalizeAiCapacityAdminPolicy,
} from "@/lib/aiCapacityPolicy.mjs";
import { getSupabaseApiKeyHeaders, getSupabaseRestUrl } from "@/lib/supabase/config";
import type { SupabaseServerUser } from "@/lib/supabase/server";

export type AiCapacityAdminState = {
  installed: boolean;
  policy: typeof DEFAULT_AI_CAPACITY_ADMIN_POLICY;
  revision: number | null;
  updatedAt: string | null;
  error: string | null;
};

type PolicyRow = {
  global_capacity_enabled?: unknown;
  emergency_spend_freeze?: unknown;
  top_up_sales_enabled?: unknown;
  package_99_sales_enabled?: unknown;
  package_199_sales_enabled?: unknown;
  package_312_sales_enabled?: unknown;
  fast_enabled?: unknown;
  balanced_enabled?: unknown;
  premium_enabled?: unknown;
  package_99_budget_eur_microcents?: unknown;
  package_199_budget_eur_microcents?: unknown;
  package_312_budget_eur_microcents?: unknown;
  revision?: unknown;
  updated_at?: unknown;
};

function serviceKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
}

function asNullablePositiveSafeInteger(value: unknown): number | null | undefined {
  if (value === null) return null;
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : undefined;
}

function rowToState(row: PolicyRow): AiCapacityAdminState {
  const budgets = {
    capacity_99: asNullablePositiveSafeInteger(row.package_99_budget_eur_microcents),
    capacity_199: asNullablePositiveSafeInteger(row.package_199_budget_eur_microcents),
    capacity_312: asNullablePositiveSafeInteger(row.package_312_budget_eur_microcents),
  };
  if (
    typeof row.global_capacity_enabled !== "boolean" ||
    typeof row.emergency_spend_freeze !== "boolean" ||
    typeof row.top_up_sales_enabled !== "boolean" ||
    typeof row.package_99_sales_enabled !== "boolean" ||
    typeof row.package_199_sales_enabled !== "boolean" ||
    typeof row.package_312_sales_enabled !== "boolean" ||
    typeof row.fast_enabled !== "boolean" ||
    typeof row.balanced_enabled !== "boolean" ||
    typeof row.premium_enabled !== "boolean" ||
    Object.values(budgets).includes(undefined) ||
    typeof row.revision !== "number" ||
    !Number.isSafeInteger(row.revision) ||
    row.revision < 1
  ) {
    return {
      installed: false,
      policy: DEFAULT_AI_CAPACITY_ADMIN_POLICY,
      revision: null,
      updatedAt: null,
      error: "ai_capacity_policy_invalid",
    };
  }
  try {
    const policy = normalizeAiCapacityAdminPolicy({
      globalCapacityEnabled: row.global_capacity_enabled,
      emergencySpendFreeze: row.emergency_spend_freeze,
      topUpSalesEnabled: row.top_up_sales_enabled,
      packageSalesEnabled: {
        capacity_99: row.package_99_sales_enabled,
        capacity_199: row.package_199_sales_enabled,
        capacity_312: row.package_312_sales_enabled,
      },
      qualityModeEnabled: {
        fast: row.fast_enabled,
        balanced: row.balanced_enabled,
        premium: row.premium_enabled,
      },
      includedBudgetEurMicrocents: budgets,
    });
    return {
      installed: true,
      policy,
      revision: row.revision,
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
      error: null,
    };
  } catch {
    return {
      installed: false,
      policy: DEFAULT_AI_CAPACITY_ADMIN_POLICY,
      revision: null,
      updatedAt: null,
      error: "ai_capacity_policy_invalid",
    };
  }
}

function rpcHeaders(key: string): HeadersInit {
  return {
    ...getSupabaseApiKeyHeaders(key, key),
    "content-type": "application/json",
  };
}

export async function getAiCapacityAdminState(): Promise<AiCapacityAdminState> {
  const key = serviceKey();
  if (!key) {
    return {
      installed: false,
      policy: DEFAULT_AI_CAPACITY_ADMIN_POLICY,
      revision: null,
      updatedAt: null,
      error: "service_role_missing",
    };
  }
  try {
    const response = await fetch(getSupabaseRestUrl("rpc/admin_get_ai_capacity_policy"), {
      method: "POST",
      headers: rpcHeaders(key),
      body: "{}",
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        installed: false,
        policy: DEFAULT_AI_CAPACITY_ADMIN_POLICY,
        revision: null,
        updatedAt: null,
        error: response.status === 404 ? "schema_not_installed" : "policy_read_failed",
      };
    }
    const payload = await response.json() as PolicyRow[] | PolicyRow;
    const row = Array.isArray(payload) ? payload[0] : payload;
    return row ? rowToState(row) : {
      installed: false,
      policy: DEFAULT_AI_CAPACITY_ADMIN_POLICY,
      revision: null,
      updatedAt: null,
      error: "policy_row_missing",
    };
  } catch {
    return {
      installed: false,
      policy: DEFAULT_AI_CAPACITY_ADMIN_POLICY,
      revision: null,
      updatedAt: null,
      error: "policy_read_failed",
    };
  }
}

export function parseEurBudgetToMicrocents(value: unknown): number | null | undefined {
  if (value == null) return null;
  const normalized = String(value).trim().replace(",", ".");
  if (normalized === "") return null;
  const match = /^(\d{1,7})(?:\.(\d{1,8}))?$/u.exec(normalized);
  if (!match) return undefined;
  const whole = Number(match[1]);
  const fractional = Number((match[2] ?? "").padEnd(8, "0"));
  const result = whole * 100_000_000 + fractional;
  return Number.isSafeInteger(result) && result > 0 ? result : undefined;
}

export function formatMicrocentsAsEur(value: number | null): string {
  if (value == null) return "";
  const whole = Math.floor(value / 100_000_000);
  const fraction = String(value % 100_000_000).padStart(8, "0").replace(/0+$/u, "");
  return fraction ? `${whole},${fraction}` : String(whole);
}

export async function updateAiCapacityAdminPolicy(
  admin: SupabaseServerUser,
  expectedRevision: number,
  input: {
    globalCapacityEnabled: boolean;
    emergencySpendFreeze: boolean;
    topUpSalesEnabled: boolean;
    packageSalesEnabled: Record<"capacity_99" | "capacity_199" | "capacity_312", boolean>;
    qualityModeEnabled: Record<"fast" | "balanced" | "premium", boolean>;
    includedBudgetEurMicrocents: Record<"capacity_99" | "capacity_199" | "capacity_312", number | null>;
  },
): Promise<{ ok: boolean; error: string | null; revision?: number }> {
  const key = serviceKey();
  if (!key) return { ok: false, error: "service_role_missing" };
  let policy;
  try {
    policy = normalizeAiCapacityAdminPolicy(input);
  } catch {
    return { ok: false, error: "invalid_policy" };
  }
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
    return { ok: false, error: "invalid_revision" };
  }

  try {
    const response = await fetch(getSupabaseRestUrl("rpc/admin_update_ai_capacity_policy"), {
      method: "POST",
      headers: rpcHeaders(key),
      body: JSON.stringify({
        p_admin_user_id: admin.id,
        p_admin_email: admin.email ?? null,
        p_expected_revision: expectedRevision,
        p_global_capacity_enabled: policy.globalCapacityEnabled,
        p_emergency_spend_freeze: policy.emergencySpendFreeze,
        p_top_up_sales_enabled: policy.topUpSalesEnabled,
        p_package_99_sales_enabled: policy.packageSalesEnabled.capacity_99,
        p_package_199_sales_enabled: policy.packageSalesEnabled.capacity_199,
        p_package_312_sales_enabled: policy.packageSalesEnabled.capacity_312,
        p_fast_enabled: policy.qualityModeEnabled.fast,
        p_balanced_enabled: policy.qualityModeEnabled.balanced,
        p_premium_enabled: policy.qualityModeEnabled.premium,
        p_package_99_budget_eur_microcents: policy.includedBudgetEurMicrocents.capacity_99,
        p_package_199_budget_eur_microcents: policy.includedBudgetEurMicrocents.capacity_199,
        p_package_312_budget_eur_microcents: policy.includedBudgetEurMicrocents.capacity_312,
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      const body = await response.text();
      if (body.includes("ai_capacity_admin_revision_conflict")) {
        return { ok: false, error: "revision_conflict" };
      }
      return { ok: false, error: response.status === 404 ? "schema_not_installed" : "policy_update_failed" };
    }
    const value = await response.json() as number | number[];
    const revision = Array.isArray(value) ? value[0] : value;
    return Number.isSafeInteger(revision) && Number(revision) > 0
      ? { ok: true, error: null, revision: Number(revision) }
      : { ok: false, error: "policy_update_failed" };
  } catch {
    return { ok: false, error: "policy_update_failed" };
  }
}
