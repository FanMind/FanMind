import "server-only";

import { resolveFanMindAiQualityProfile } from "@/config/openAiPriceCatalog.mjs";
import { getAiCapacityAdminState } from "@/lib/aiCapacityAdmin";
import {
  calculateOpenAiSettlementCost,
  estimateOpenAiReservationCost,
} from "@/lib/aiCapacityAccounting.mjs";
import {
  markAiCapacityIndeterminate,
  releaseAiCapacity,
  reserveAiCapacity,
  settleAiCapacity,
} from "@/lib/aiCapacityLedger";
import { resolveAiCapacityUsageAdmission } from "@/lib/aiCapacityPolicy.mjs";

export type AiCapacityFxSnapshot = {
  eurPerUsdNanos: number;
  version: string;
};

export type PreparedAiCapacityReservation = {
  reservationId: string;
  reservedEurMicrocents: number;
  qualityMode: "fast" | "balanced" | "premium";
  model: string;
  serviceTier: string;
  reasoningEffort: string;
  pricingVersion: string;
  fxVersion: string;
  eurPerUsdNanos: number;
};

export async function prepareAiCapacityReservation(input: {
  workspaceId: string;
  generationKey: string;
  billingPeriodKey: string;
  packageId: "capacity_99" | "capacity_199" | "capacity_312";
  qualityMode: "fast" | "balanced" | "premium";
  estimatedInputTokens: number;
  maxOutputTokens: number;
  occurredAt: string;
  fx: AiCapacityFxSnapshot;
}): Promise<PreparedAiCapacityReservation> {
  const quality = resolveFanMindAiQualityProfile(input.qualityMode);
  if (!quality) throw new Error("ai_capacity_quality_mode_unavailable");

  const admin = await getAiCapacityAdminState();
  if (!admin.installed || !Number.isSafeInteger(admin.revision) || Number(admin.revision) < 1) {
    throw new Error("ai_capacity_schema_not_ready");
  }

  const admission = resolveAiCapacityUsageAdmission({
    billingContractVersion: "capacity_v2",
    packageId: input.packageId,
    qualityMode: input.qualityMode,
    adminPolicy: admin.policy,
  });
  if (!admission.allowed) {
    throw new Error(`ai_capacity_admission_blocked:${String(admission.reason)}`);
  }

  const estimate = estimateOpenAiReservationCost({
    model: quality.model,
    serviceTier: quality.serviceTier,
    occurredAt: input.occurredAt,
    estimatedInputTokens: input.estimatedInputTokens,
    maxOutputTokens: input.maxOutputTokens,
    eurPerUsdNanos: input.fx.eurPerUsdNanos,
    fxVersion: input.fx.version,
  });

  const reservation = await reserveAiCapacity({
    workspaceId: input.workspaceId,
    generationKey: input.generationKey,
    billingPeriodKey: input.billingPeriodKey,
    packageId: input.packageId,
    qualityMode: input.qualityMode,
    reservedEurMicrocents: estimate.reservedEurMicrocents,
    expectedPolicyRevision: Number(admin.revision),
    provider: "openai",
    model: quality.model,
    pricingVersion: estimate.pricingVersion,
    fxVersion: estimate.fxVersion,
    metadata: {
      serviceTier: quality.serviceTier,
      reasoningEffort: quality.reasoningEffort,
      occurredAt: input.occurredAt,
      eurPerUsdNanos: input.fx.eurPerUsdNanos,
      estimatedInputTokens: input.estimatedInputTokens,
      maxOutputTokens: input.maxOutputTokens,
    },
  });

  if (!reservation.created) {
    throw new Error("ai_capacity_generation_already_reserved");
  }

  return {
    reservationId: reservation.reservationId,
    reservedEurMicrocents: reservation.reservedEurMicrocents,
    qualityMode: input.qualityMode,
    model: quality.model,
    serviceTier: quality.serviceTier,
    reasoningEffort: quality.reasoningEffort,
    pricingVersion: estimate.pricingVersion,
    fxVersion: estimate.fxVersion,
    eurPerUsdNanos: input.fx.eurPerUsdNanos,
  };
}

export async function settlePreparedAiCapacityReservation(input: {
  prepared: PreparedAiCapacityReservation;
  providerUsage: unknown;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}) {
  let settlement;
  try {
    settlement = calculateOpenAiSettlementCost({
      model: input.prepared.model,
      serviceTier: input.prepared.serviceTier,
      occurredAt: input.occurredAt,
      providerUsage: input.providerUsage,
      eurPerUsdNanos: input.prepared.eurPerUsdNanos,
      fxVersion: input.prepared.fxVersion,
    });
  } catch (error) {
    await markAiCapacityIndeterminate(
      input.prepared.reservationId,
      "provider_usage_or_pricing_unavailable_after_generation",
    );
    throw error;
  }

  if (settlement.pricingVersion !== input.prepared.pricingVersion) {
    await markAiCapacityIndeterminate(
      input.prepared.reservationId,
      "pricing_version_changed_during_generation",
    );
    throw new Error("ai_capacity_pricing_version_changed");
  }

  return await settleAiCapacity({
    reservationId: input.prepared.reservationId,
    actualEurMicrocents: settlement.actualEurMicrocents,
    provider: "openai",
    model: input.prepared.model,
    inputTokens: settlement.usage.inputTokens,
    cachedInputTokens: settlement.usage.cachedInputTokens,
    cacheWriteTokens: settlement.usage.cacheWriteTokens,
    outputTokens: settlement.usage.outputTokens,
    reasoningTokens: settlement.usage.reasoningOutputTokens,
    pricingVersion: settlement.pricingVersion,
    fxVersion: settlement.fxVersion,
    metadata: input.metadata,
  });
}

export async function releasePreparedAiCapacityReservation(
  prepared: PreparedAiCapacityReservation,
  reason: string,
): Promise<void> {
  await releaseAiCapacity(prepared.reservationId, reason);
}

export async function markPreparedAiCapacityIndeterminate(
  prepared: PreparedAiCapacityReservation,
  reason: string,
): Promise<void> {
  await markAiCapacityIndeterminate(prepared.reservationId, reason);
}
