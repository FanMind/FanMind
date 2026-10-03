import "server-only";

import { getSupabaseApiKeyHeaders, getSupabaseRestUrl } from "@/lib/supabase/config";

export type AiCapacityPackageId = "capacity_99" | "capacity_199" | "capacity_312";
export type AiCapacityQualityMode = "fast" | "balanced" | "premium";

export type AiCapacityReserveResult = {
  reservationId: string;
  reservedEurMicrocents: number;
  state: "reserved";
  created: boolean;
};

export type AiCapacitySettleResult = {
  reservationId: string;
  state: "settled";
  settledEurMicrocents: number;
  releasedEurMicrocents: number;
};

export type AiCapacityBalanceSnapshot = {
  totalGrantedEurMicrocents: number;
  consumedEurMicrocents: number;
  heldEurMicrocents: number;
  availableEurMicrocents: number;
  remainingPercent: number | null;
  hasCapacityHistory: boolean;
};

function serviceKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
}

function headers(key: string): HeadersInit {
  return {
    ...getSupabaseApiKeyHeaders(key, key),
    "content-type": "application/json",
  };
}

function positiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function nonNegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

async function postRpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const key = serviceKey();
  if (!key) throw new Error("ai_capacity_service_role_missing");

  const response = await fetch(getSupabaseRestUrl(`rpc/${name}`), {
    method: "POST",
    headers: headers(key),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    const known = [
      "ai_capacity_service_role_required",
      "ai_capacity_grant_invalid",
      "ai_capacity_included_grant_invalid",
      "ai_capacity_grant_idempotency_conflict",
      "ai_capacity_included_period_idempotency_conflict",
      "ai_capacity_reservation_invalid",
      "ai_capacity_reservation_idempotency_conflict",
      "ai_capacity_generation_not_replayable",
      "ai_capacity_policy_missing",
      "ai_capacity_policy_revision_conflict",
      "ai_capacity_admission_closed",
      "ai_capacity_quality_mode_disabled",
      "ai_capacity_insufficient_balance",
      "ai_capacity_settlement_invalid",
      "ai_capacity_reservation_missing",
      "ai_capacity_settlement_idempotency_conflict",
      "ai_capacity_reconciliation_idempotency_conflict",
      "ai_capacity_reconciliation_evidence_missing",
      "ai_capacity_settlement_state_invalid",
      "ai_capacity_actual_exceeds_reservation",
      "ai_capacity_allocation_incomplete",
      "ai_capacity_release_invalid",
      "ai_capacity_release_state_invalid",
      "ai_capacity_indeterminate_invalid",
      "ai_capacity_indeterminate_state_invalid",
      "ai_capacity_reversal_invalid",
      "ai_capacity_purchase_grant_missing",
    ].find((code) => text.includes(code));
    throw new Error(known ?? (response.status === 404 ? "ai_capacity_schema_not_installed" : "ai_capacity_rpc_failed"));
  }

  return await response.json() as T;
}

export async function grantAiCapacityCredit(input: {
  workspaceId: string;
  grantKind: "included_period" | "purchased";
  grantKey: string;
  packageId?: AiCapacityPackageId | null;
  billingPeriodKey?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  expiresAt?: string | null;
  grantedEurMicrocents: number;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  if (!positiveSafeInteger(input.grantedEurMicrocents)) {
    throw new TypeError("ai_capacity_grant_amount_invalid");
  }
  const value = await postRpc<string | string[]>("ai_capacity_grant_credit", {
    p_workspace_id: input.workspaceId,
    p_grant_kind: input.grantKind,
    p_grant_key: input.grantKey,
    p_package_id: input.packageId ?? null,
    p_billing_period_key: input.billingPeriodKey ?? null,
    p_period_start: input.periodStart ?? null,
    p_period_end: input.periodEnd ?? null,
    p_expires_at: input.expiresAt ?? null,
    p_granted_eur_microcents: input.grantedEurMicrocents,
    p_metadata: input.metadata ?? {},
  });
  const id = Array.isArray(value) ? value[0] : value;
  if (typeof id !== "string" || !id) throw new Error("ai_capacity_grant_response_invalid");
  return id;
}


export async function reversePurchasedAiCapacity(input: {
  workspaceId: string;
  grantKey: string;
  reversalKey: string;
  reason: "refund" | "dispute";
  metadata?: Record<string, unknown>;
}): Promise<number> {
  if (!input.grantKey || !input.reversalKey) {
    throw new TypeError("ai_capacity_reversal_invalid");
  }
  const value = await postRpc<number | number[]>("ai_capacity_reverse_purchase", {
    p_workspace_id: input.workspaceId,
    p_grant_key: input.grantKey,
    p_reversal_key: input.reversalKey,
    p_reason: input.reason,
    p_metadata: input.metadata ?? {},
  });
  const amount = Number(Array.isArray(value) ? value[0] : value);
  if (!nonNegativeSafeInteger(amount)) {
    throw new Error("ai_capacity_reversal_response_invalid");
  }
  return amount;
}

export async function reserveAiCapacity(input: {
  workspaceId: string;
  generationKey: string;
  billingPeriodKey: string;
  packageId: AiCapacityPackageId;
  qualityMode: AiCapacityQualityMode;
  reservedEurMicrocents: number;
  expectedPolicyRevision: number;
  provider: "openai";
  model: string;
  pricingVersion: string;
  fxVersion: string;
  metadata?: Record<string, unknown>;
}): Promise<AiCapacityReserveResult> {
  if (!positiveSafeInteger(input.reservedEurMicrocents)) {
    throw new TypeError("ai_capacity_reservation_amount_invalid");
  }
  const payload = await postRpc<Array<{
    reservation_id?: unknown;
    reserved_eur_microcents?: unknown;
    state?: unknown;
    created?: unknown;
  }>>("ai_capacity_reserve", {
    p_workspace_id: input.workspaceId,
    p_generation_key: input.generationKey,
    p_billing_period_key: input.billingPeriodKey,
    p_package_id: input.packageId,
    p_quality_mode: input.qualityMode,
    p_reserved_eur_microcents: input.reservedEurMicrocents,
    p_expected_policy_revision: input.expectedPolicyRevision,
    p_provider: input.provider,
    p_model: input.model,
    p_pricing_version: input.pricingVersion,
    p_fx_version: input.fxVersion,
    p_metadata: input.metadata ?? {},
  });
  const row = payload[0];
  if (
    !row ||
    typeof row.reservation_id !== "string" ||
    !positiveSafeInteger(Number(row.reserved_eur_microcents)) ||
    row.state !== "reserved" ||
    typeof row.created !== "boolean"
  ) {
    throw new Error("ai_capacity_reservation_response_invalid");
  }
  return {
    reservationId: row.reservation_id,
    reservedEurMicrocents: Number(row.reserved_eur_microcents),
    state: "reserved",
    created: row.created,
  };
}

export async function settleAiCapacity(input: {
  reservationId: string;
  actualEurMicrocents: number;
  provider: "openai";
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  pricingVersion: string;
  fxVersion: string;
  metadata?: Record<string, unknown>;
}): Promise<AiCapacitySettleResult> {
  for (const value of [
    input.actualEurMicrocents,
    input.inputTokens,
    input.cachedInputTokens,
    input.cacheWriteTokens,
    input.outputTokens,
    input.reasoningTokens,
  ]) {
    if (!nonNegativeSafeInteger(value)) throw new TypeError("ai_capacity_settlement_amount_invalid");
  }

  const payload = await postRpc<Array<{
    reservation_id?: unknown;
    state?: unknown;
    settled_eur_microcents?: unknown;
    released_eur_microcents?: unknown;
  }>>("ai_capacity_settle", {
    p_reservation_id: input.reservationId,
    p_actual_eur_microcents: input.actualEurMicrocents,
    p_provider: input.provider,
    p_model: input.model,
    p_input_tokens: input.inputTokens,
    p_cached_input_tokens: input.cachedInputTokens,
    p_cache_write_tokens: input.cacheWriteTokens,
    p_output_tokens: input.outputTokens,
    p_reasoning_tokens: input.reasoningTokens,
    p_pricing_version: input.pricingVersion,
    p_fx_version: input.fxVersion,
    p_metadata: input.metadata ?? {},
  });

  const row = payload[0];
  if (row?.state === "reconciliation_required") {
    throw new Error("ai_capacity_reconciliation_required");
  }
  if (
    !row ||
    typeof row.reservation_id !== "string" ||
    row.state !== "settled" ||
    !nonNegativeSafeInteger(Number(row.settled_eur_microcents)) ||
    !nonNegativeSafeInteger(Number(row.released_eur_microcents))
  ) {
    throw new Error("ai_capacity_settlement_response_invalid");
  }
  return {
    reservationId: row.reservation_id,
    state: "settled",
    settledEurMicrocents: Number(row.settled_eur_microcents),
    releasedEurMicrocents: Number(row.released_eur_microcents),
  };
}

export async function releaseAiCapacity(
  reservationId: string,
  reason: string,
): Promise<void> {
  await postRpc("ai_capacity_release", {
    p_reservation_id: reservationId,
    p_reason: reason,
  });
}

export async function markAiCapacityIndeterminate(
  reservationId: string,
  reason: string,
): Promise<void> {
  await postRpc("ai_capacity_mark_indeterminate", {
    p_reservation_id: reservationId,
    p_reason: reason,
  });
}


export async function getAiCapacityBalanceSnapshot(
  workspaceId: string,
): Promise<AiCapacityBalanceSnapshot> {
  const payload = await postRpc<Array<{
    total_granted_eur_microcents?: unknown;
    consumed_eur_microcents?: unknown;
    held_eur_microcents?: unknown;
    available_eur_microcents?: unknown;
    remaining_percent?: unknown;
    has_capacity_history?: unknown;
  }>>("ai_capacity_balance_snapshot", {
    p_workspace_id: workspaceId,
  });

  const row = payload[0];
  const values = [
    Number(row?.total_granted_eur_microcents),
    Number(row?.consumed_eur_microcents),
    Number(row?.held_eur_microcents),
    Number(row?.available_eur_microcents),
  ];
  if (
    !row ||
    values.some((value) => !nonNegativeSafeInteger(value)) ||
    typeof row.has_capacity_history !== "boolean" ||
    (row.remaining_percent !== null &&
      (!Number.isInteger(Number(row.remaining_percent)) ||
        Number(row.remaining_percent) < 0 ||
        Number(row.remaining_percent) > 100))
  ) {
    throw new Error("ai_capacity_balance_response_invalid");
  }

  return {
    totalGrantedEurMicrocents: values[0],
    consumedEurMicrocents: values[1],
    heldEurMicrocents: values[2],
    availableEurMicrocents: values[3],
    remainingPercent:
      row.remaining_percent === null ? null : Number(row.remaining_percent),
    hasCapacityHistory: row.has_capacity_history,
  };
}
