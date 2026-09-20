const INTEGER_FIELDS = ["inputTokens", "cachedInputTokens", "cacheWriteTokens", "outputTokens"];

function exactNonNegativeInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function positiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function concreteString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function calculateProviderCostMicros({ usage, price }) {
  if (!usage || !price) throw new TypeError("usage_and_price_required");
  const normalized = Object.fromEntries(INTEGER_FIELDS.map((field) => [field, exactNonNegativeInteger(usage[field])]));
  if (Object.values(normalized).includes(null) || normalized.cachedInputTokens > normalized.inputTokens) {
    throw new TypeError("invalid_usage");
  }
  const uncachedInputTokens = normalized.inputTokens - normalized.cachedInputTokens;
  const rates = {
    inputTokens: positiveNumber(price.inputPerMillionMicros),
    cachedInputTokens: positiveNumber(price.cachedInputPerMillionMicros),
    cacheWriteTokens: positiveNumber(price.cacheWritePerMillionMicros),
    outputTokens: positiveNumber(price.outputPerMillionMicros),
  };
  if (Object.values(rates).includes(null)) throw new TypeError("invalid_price");
  const numerator =
    uncachedInputTokens * rates.inputTokens +
    normalized.cachedInputTokens * rates.cachedInputTokens +
    normalized.cacheWriteTokens * rates.cacheWriteTokens +
    normalized.outputTokens * rates.outputTokens;
  return Math.ceil(numerator / 1_000_000);
}

export function resolveVersionedProviderPrice({ catalog, model, serviceTier, occurredAt }) {
  if (
    !Array.isArray(catalog) ||
    typeof model !== "string" ||
    !concreteString(serviceTier) ||
    catalog.some((entry) => !concreteString(entry?.serviceTier))
  ) return null;
  const timestamp = Date.parse(occurredAt);
  if (!Number.isFinite(timestamp)) return null;
  const candidates = catalog.filter((entry) =>
    entry?.model === model &&
    entry?.serviceTier === serviceTier &&
    Date.parse(entry.effectiveFrom) <= timestamp &&
    (entry.effectiveUntil == null || timestamp < Date.parse(entry.effectiveUntil))
  );
  return candidates.length === 1 ? candidates[0] : null;
}

export function evaluateMonthlyAiBudget({ usage, reservation, limits, warningRatio = 0.8 }) {
  if (!usage || !reservation) throw new TypeError("usage_and_reservation_required");
  const configured = {
    tokens: exactNonNegativeInteger(limits?.monthlyTokenLimit),
    providerCostMicros: exactNonNegativeInteger(limits?.monthlyProviderCostLimitMicros),
    requests: exactNonNegativeInteger(limits?.monthlyRequestLimit),
  };
  const suppliedLimits = [
    ["monthlyTokenLimit", configured.tokens],
    ["monthlyProviderCostLimitMicros", configured.providerCostMicros],
    ["monthlyRequestLimit", configured.requests],
  ];
  if (suppliedLimits.some(([field, normalized]) => limits?.[field] != null && normalized === null)) {
    throw new TypeError("invalid_budget_limits");
  }
  const current = {
    tokens: exactNonNegativeInteger(usage.totalTokens),
    providerCostMicros: exactNonNegativeInteger(usage.providerCostMicros),
    requests: exactNonNegativeInteger(usage.requests),
  };
  const expected = {
    tokens: exactNonNegativeInteger(reservation.totalTokens),
    providerCostMicros: exactNonNegativeInteger(reservation.providerCostMicros),
    requests: exactNonNegativeInteger(reservation.requests),
  };
  if (Object.values(current).includes(null) || Object.values(expected).includes(null)) throw new TypeError("invalid_budget_usage");
  const active = Object.entries(configured).filter(([, limit]) => limit !== null && limit > 0);
  if (active.length === 0) return { configured: false, allowed: true, level: "unconfigured", usageRatio: null };
  const ratios = active.map(([field, limit]) => (current[field] + expected[field]) / limit);
  const usageRatio = Math.max(...ratios);
  return {
    configured: true,
    allowed: usageRatio < 1,
    level: usageRatio >= 1 ? "hard_limit" : usageRatio >= warningRatio ? "warning" : "normal",
    usageRatio,
  };
}
