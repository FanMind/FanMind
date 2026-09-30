import { calculateOpenAiProviderCostMicros } from "./aiCostEngine.mjs";
import { normalizeOpenAiResponseUsage } from "./aiUsageProviderMetrics.mjs";

const FX_SCALE = 1_000_000_000n;
const USD_MICROS_TO_EUR_MICROCENTS_SCALE = 100n;

function exactNonNegativeSafeInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

function exactPositiveSafeInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}

function ceilDiv(numerator, denominator) {
  return (numerator + denominator - 1n) / denominator;
}

export function convertUsdMicrosToEurMicrocents({
  usdMicros,
  eurPerUsdNanos,
}) {
  const usd = exactNonNegativeSafeInteger(usdMicros);
  const fx = exactPositiveSafeInteger(eurPerUsdNanos);
  if (usd === null || fx === null) {
    throw new TypeError("invalid_capacity_fx_input");
  }
  const value = ceilDiv(
    BigInt(usd) * BigInt(fx) * USD_MICROS_TO_EUR_MICROCENTS_SCALE,
    FX_SCALE,
  );
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError("capacity_fx_result_out_of_range");
  }
  return Number(value);
}

export function estimateOpenAiReservationCost({
  model,
  serviceTier = "standard",
  occurredAt,
  estimatedInputTokens,
  maxOutputTokens,
  eurPerUsdNanos,
  fxVersion,
}) {
  if (typeof fxVersion !== "string" || fxVersion.trim() === "") {
    throw new TypeError("capacity_fx_version_required");
  }
  const inputTokens = exactNonNegativeSafeInteger(estimatedInputTokens);
  const outputTokens = exactNonNegativeSafeInteger(maxOutputTokens);
  if (inputTokens === null || outputTokens === null) {
    throw new TypeError("invalid_capacity_reservation_usage");
  }

  const provider = calculateOpenAiProviderCostMicros({
    model,
    serviceTier,
    occurredAt,
    usage: {
      inputTokens,
      cachedInputTokens: 0,
      cacheWriteTokens: 0,
      outputTokens,
    },
  });

  return Object.freeze({
    providerUsdMicros: provider.costMicros,
    reservedEurMicrocents: convertUsdMicrosToEurMicrocents({
      usdMicros: provider.costMicros,
      eurPerUsdNanos,
    }),
    pricingVersion: provider.price.catalogVersion,
    fxVersion: fxVersion.trim(),
    price: provider.price,
  });
}

export function calculateOpenAiSettlementCost({
  model,
  serviceTier = "standard",
  occurredAt,
  providerUsage,
  eurPerUsdNanos,
  fxVersion,
}) {
  if (typeof fxVersion !== "string" || fxVersion.trim() === "") {
    throw new TypeError("capacity_fx_version_required");
  }
  const usage = normalizeOpenAiResponseUsage(providerUsage);
  if (!usage) {
    throw new TypeError("capacity_provider_usage_unavailable");
  }

  const provider = calculateOpenAiProviderCostMicros({
    model,
    serviceTier,
    occurredAt,
    usage: {
      inputTokens: usage.inputTokens,
      cachedInputTokens: usage.cachedInputTokens,
      cacheWriteTokens: usage.cacheWriteTokens,
      outputTokens: usage.outputTokens,
    },
  });

  return Object.freeze({
    providerUsdMicros: provider.costMicros,
    actualEurMicrocents: convertUsdMicrosToEurMicrocents({
      usdMicros: provider.costMicros,
      eurPerUsdNanos,
    }),
    pricingVersion: provider.price.catalogVersion,
    fxVersion: fxVersion.trim(),
    price: provider.price,
    usage,
  });
}
