export const OPENAI_PRICE_CATALOG_VERSION = "openai-2026-09-30-gpt6-standard-v1";
export const OPENAI_PRICE_CATALOG_OBSERVED_AT = "2026-09-30T00:00:00.000Z";
export const OPENAI_LONG_CONTEXT_INPUT_TOKEN_THRESHOLD = 272_000;

export const FANMIND_AI_QUALITY_MODES = Object.freeze(["fast", "balanced", "premium"]);

export const FANMIND_AI_QUALITY_PROFILES = Object.freeze({
  fast: Object.freeze({
    id: "fast",
    label: "Schnell",
    model: "gpt-6-luna",
    serviceTier: "standard",
    reasoningEffort: "low",
    intent: "fastest_cost_efficient",
  }),
  balanced: Object.freeze({
    id: "balanced",
    label: "Ausgewogen",
    model: "gpt-6.1-sol",
    serviceTier: "standard",
    reasoningEffort: "medium",
    intent: "balanced_quality_cost_speed",
  }),
  premium: Object.freeze({
    id: "premium",
    label: "Premium",
    model: "gpt-6-astra",
    serviceTier: "standard",
    reasoningEffort: "max",
    intent: "highest_quality",
  }),
});

function priceEntry({
  model,
  contextClass,
  input,
  cachedInput,
  cacheWrite,
  output,
  sourceUrl,
}) {
  return Object.freeze({
    provider: "openai",
    currency: "USD",
    catalogVersion: OPENAI_PRICE_CATALOG_VERSION,
    model,
    serviceTier: "standard",
    regionalProcessing: false,
    contextClass,
    effectiveFrom: OPENAI_PRICE_CATALOG_OBSERVED_AT,
    effectiveUntil: null,
    inputPerMillionMicros: Math.round(input * 1_000_000),
    cachedInputPerMillionMicros: Math.round(cachedInput * 1_000_000),
    cacheWritePerMillionMicros: Math.round(cacheWrite * 1_000_000),
    outputPerMillionMicros: Math.round(output * 1_000_000),
    sourceUrl,
    sourceObservedAt: OPENAI_PRICE_CATALOG_OBSERVED_AT,
  });
}

export const OPENAI_PRICE_CATALOG = Object.freeze([
  priceEntry({
    model: "gpt-6-luna",
    contextClass: "short",
    input: 0.10,
    cachedInput: 0.01,
    cacheWrite: 0.125,
    output: 0.50,
    sourceUrl: "https://developers.openai.com/api/docs/models/gpt-6-luna",
  }),
  priceEntry({
    model: "gpt-6-luna",
    contextClass: "long",
    input: 0.20,
    cachedInput: 0.02,
    cacheWrite: 0.25,
    output: 0.75,
    sourceUrl: "https://developers.openai.com/api/docs/pricing",
  }),
  priceEntry({
    model: "gpt-6.1-sol",
    contextClass: "short",
    input: 2.00,
    cachedInput: 0.10,
    cacheWrite: 2.50,
    output: 10.00,
    sourceUrl: "https://developers.openai.com/api/docs/models/gpt-6.1-sol",
  }),
  priceEntry({
    model: "gpt-6.1-sol",
    contextClass: "long",
    input: 4.00,
    cachedInput: 0.20,
    cacheWrite: 5.00,
    output: 15.00,
    sourceUrl: "https://developers.openai.com/api/docs/models/gpt-6.1-sol",
  }),
  priceEntry({
    model: "gpt-6-astra",
    contextClass: "short",
    input: 10.00,
    cachedInput: 1.00,
    cacheWrite: 12.50,
    output: 50.00,
    sourceUrl: "https://developers.openai.com/api/docs/models/gpt-6-astra",
  }),
  priceEntry({
    model: "gpt-6-astra",
    contextClass: "long",
    input: 20.00,
    cachedInput: 2.00,
    cacheWrite: 25.00,
    output: 75.00,
    sourceUrl: "https://developers.openai.com/api/docs/models/gpt-6-astra",
  }),
]);

export function resolveFanMindAiQualityProfile(mode) {
  return FANMIND_AI_QUALITY_PROFILES[mode] ?? null;
}

export function resolveOpenAiContextClass(inputTokens) {
  if (!Number.isSafeInteger(inputTokens) || inputTokens < 0) {
    throw new TypeError("invalid_openai_input_tokens");
  }
  return inputTokens > OPENAI_LONG_CONTEXT_INPUT_TOKEN_THRESHOLD ? "long" : "short";
}

export function resolveOpenAiCatalogPrice({
  model,
  serviceTier = "standard",
  occurredAt,
  inputTokens,
  regionalProcessing = false,
}) {
  if (regionalProcessing !== false) return null;
  const contextClass = resolveOpenAiContextClass(inputTokens);
  const timestamp = Date.parse(occurredAt);
  if (!Number.isFinite(timestamp)) return null;
  const matches = OPENAI_PRICE_CATALOG.filter((entry) =>
    entry.model === model &&
    entry.serviceTier === serviceTier &&
    entry.regionalProcessing === regionalProcessing &&
    entry.contextClass === contextClass &&
    Date.parse(entry.effectiveFrom) <= timestamp &&
    (entry.effectiveUntil == null || timestamp < Date.parse(entry.effectiveUntil))
  );
  return matches.length === 1 ? matches[0] : null;
}
