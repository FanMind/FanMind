import assert from "node:assert/strict";
import test from "node:test";

import {
  FANMIND_AI_QUALITY_PROFILES,
  OPENAI_LONG_CONTEXT_INPUT_TOKEN_THRESHOLD,
  OPENAI_PRICE_CATALOG,
  OPENAI_PRICE_CATALOG_VERSION,
  resolveFanMindAiQualityProfile,
  resolveOpenAiCatalogPrice,
  resolveOpenAiContextClass,
} from "../src/config/openAiPriceCatalog.mjs";

test("FanMind quality modes map to speed, balance and highest-quality OpenAI models", () => {
  assert.deepEqual(FANMIND_AI_QUALITY_PROFILES.fast, {
    id: "fast",
    label: "Schnell",
    model: "gpt-6-luna",
    serviceTier: "standard",
    reasoningEffort: "low",
    intent: "fastest_cost_efficient",
  });
  assert.deepEqual(FANMIND_AI_QUALITY_PROFILES.balanced, {
    id: "balanced",
    label: "Ausgewogen",
    model: "gpt-6.1-sol",
    serviceTier: "standard",
    reasoningEffort: "medium",
    intent: "balanced_quality_cost_speed",
  });
  assert.deepEqual(FANMIND_AI_QUALITY_PROFILES.premium, {
    id: "premium",
    label: "Premium",
    model: "gpt-6-astra",
    serviceTier: "standard",
    reasoningEffort: "max",
    intent: "highest_quality",
  });
  assert.equal(resolveFanMindAiQualityProfile("unknown"), null);
});

test("OpenAI price catalog is versioned and complete for every active quality model", () => {
  assert.match(OPENAI_PRICE_CATALOG_VERSION, /^openai-\d{4}-\d{2}-\d{2}-/u);
  for (const profile of Object.values(FANMIND_AI_QUALITY_PROFILES)) {
    const entries = OPENAI_PRICE_CATALOG.filter((entry) => entry.model === profile.model);
    assert.deepEqual(entries.map((entry) => entry.contextClass).sort(), ["long", "short"]);
    assert.ok(entries.every((entry) => entry.currency === "USD"));
    assert.ok(entries.every((entry) => entry.serviceTier === "standard"));
    assert.ok(entries.every((entry) => entry.catalogVersion === OPENAI_PRICE_CATALOG_VERSION));
  }
});

test("catalog stores official per-million prices as integer USD micro-units", () => {
  const at = "2026-09-30T12:00:00.000Z";
  assert.deepEqual(
    resolveOpenAiCatalogPrice({ model: "gpt-6-luna", occurredAt: at, inputTokens: 1_000 }),
    OPENAI_PRICE_CATALOG.find((entry) => entry.model === "gpt-6-luna" && entry.contextClass === "short"),
  );
  const luna = resolveOpenAiCatalogPrice({ model: "gpt-6-luna", occurredAt: at, inputTokens: 1_000 });
  assert.equal(luna?.inputPerMillionMicros, 100_000);
  assert.equal(luna?.cachedInputPerMillionMicros, 10_000);
  assert.equal(luna?.cacheWritePerMillionMicros, 125_000);
  assert.equal(luna?.outputPerMillionMicros, 500_000);

  const sol = resolveOpenAiCatalogPrice({ model: "gpt-6.1-sol", occurredAt: at, inputTokens: 1_000 });
  assert.equal(sol?.inputPerMillionMicros, 2_000_000);
  assert.equal(sol?.cachedInputPerMillionMicros, 100_000);
  assert.equal(sol?.cacheWritePerMillionMicros, 2_500_000);
  assert.equal(sol?.outputPerMillionMicros, 10_000_000);

  const astra = resolveOpenAiCatalogPrice({ model: "gpt-6-astra", occurredAt: at, inputTokens: 1_000 });
  assert.equal(astra?.inputPerMillionMicros, 10_000_000);
  assert.equal(astra?.cachedInputPerMillionMicros, 1_000_000);
  assert.equal(astra?.cacheWritePerMillionMicros, 12_500_000);
  assert.equal(astra?.outputPerMillionMicros, 50_000_000);
});

test("long-context boundary applies only above 272K input tokens", () => {
  assert.equal(resolveOpenAiContextClass(OPENAI_LONG_CONTEXT_INPUT_TOKEN_THRESHOLD), "short");
  assert.equal(resolveOpenAiContextClass(OPENAI_LONG_CONTEXT_INPUT_TOKEN_THRESHOLD + 1), "long");
  const longAstra = resolveOpenAiCatalogPrice({
    model: "gpt-6-astra",
    occurredAt: "2026-09-30T12:00:00.000Z",
    inputTokens: OPENAI_LONG_CONTEXT_INPUT_TOKEN_THRESHOLD + 1,
  });
  assert.equal(longAstra?.inputPerMillionMicros, 20_000_000);
  assert.equal(longAstra?.outputPerMillionMicros, 75_000_000);
});

test("catalog fails closed for unsupported service tiers, regional pricing and invalid dates", () => {
  assert.equal(resolveOpenAiCatalogPrice({
    model: "gpt-6-astra",
    serviceTier: "fast",
    occurredAt: "2026-09-30T12:00:00.000Z",
    inputTokens: 10,
  }), null);
  assert.equal(resolveOpenAiCatalogPrice({
    model: "gpt-6-astra",
    occurredAt: "2026-09-30T12:00:00.000Z",
    inputTokens: 10,
    regionalProcessing: true,
  }), null);
  assert.equal(resolveOpenAiCatalogPrice({
    model: "gpt-6-astra",
    occurredAt: "invalid",
    inputTokens: 10,
  }), null);
  assert.throws(() => resolveOpenAiContextClass(-1), {
    name: "TypeError",
    message: "invalid_openai_input_tokens",
  });
});
