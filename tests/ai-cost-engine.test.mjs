import assert from "node:assert/strict";
import test from "node:test";
import { calculateProviderCostMicros, evaluateMonthlyAiBudget, resolveVersionedProviderPrice } from "../src/lib/aiCostEngine.mjs";

const price = { inputPerMillionMicros: 10_000_000, cachedInputPerMillionMicros: 2_000_000, cacheWritePerMillionMicros: 12_000_000, outputPerMillionMicros: 30_000_000 };

test("calculates exact configured cost categories and keeps cached input separate", () => {
  assert.equal(calculateProviderCostMicros({ usage: { inputTokens: 1_000, cachedInputTokens: 400, cacheWriteTokens: 100, outputTokens: 200 }, price }), 14_000);
  assert.equal(calculateProviderCostMicros({ usage: { inputTokens: 1_000, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 200 }, price }), 16_000);
});

test("resolves model, service tier and price version fail closed", () => {
  const catalog = [
    { ...price, model: "model-a", serviceTier: "default", effectiveFrom: "2026-01-01T00:00:00Z", effectiveUntil: "2026-07-01T00:00:00Z" },
    { ...price, outputPerMillionMicros: 40_000_000, model: "model-a", serviceTier: "default", effectiveFrom: "2026-07-01T00:00:00Z" },
  ];
  assert.equal(resolveVersionedProviderPrice({ catalog, model: "model-a", serviceTier: "default", occurredAt: "2026-06-30T23:59:59Z" })?.outputPerMillionMicros, 30_000_000);
  assert.equal(resolveVersionedProviderPrice({ catalog, model: "model-a", serviceTier: "default", occurredAt: "2026-07-01T00:00:00Z" })?.outputPerMillionMicros, 40_000_000);
  assert.equal(resolveVersionedProviderPrice({ catalog, model: "model-b", serviceTier: "default", occurredAt: "2026-07-01T00:00:00Z" }), null);
  for (const serviceTier of [undefined, null, "", "   ", 1]) {
    assert.equal(resolveVersionedProviderPrice({ catalog, model: "model-a", serviceTier, occurredAt: "2026-07-01T00:00:00Z" }), null);
  }
  for (const serviceTier of [undefined, null, "", "   ", 1]) {
    assert.equal(resolveVersionedProviderPrice({
      catalog: [{ ...price, model: "model-a", serviceTier, effectiveFrom: "2026-01-01T00:00:00Z" }],
      model: "model-a",
      serviceTier: "default",
      occurredAt: "2026-07-01T00:00:00Z",
    }), null);
  }
});

test("pre-call budget decisions cover 79, 80, 99 and 100 percent", () => {
  const limits = { monthlyTokenLimit: 100, monthlyProviderCostLimitMicros: null, monthlyRequestLimit: null };
  for (const [tokens, level, allowed] of [[79,"normal",true],[80,"warning",true],[99,"warning",true],[100,"hard_limit",false]]) {
    assert.deepEqual(evaluateMonthlyAiBudget({ usage: { totalTokens: tokens, providerCostMicros: 0, requests: 0 }, reservation: { totalTokens: 0, providerCostMicros: 0, requests: 0 }, limits }).level, level);
    assert.equal(evaluateMonthlyAiBudget({ usage: { totalTokens: tokens, providerCostMicros: 0, requests: 0 }, reservation: { totalTokens: 0, providerCostMicros: 0, requests: 0 }, limits }).allowed, allowed);
  }
});

test("unconfigured owner limits do not invent a quota", () => {
  assert.deepEqual(evaluateMonthlyAiBudget({ usage: { totalTokens: 1, providerCostMicros: 1, requests: 1 }, reservation: { totalTokens: 1, providerCostMicros: 1, requests: 1 }, limits: {} }), { configured: false, allowed: true, level: "unconfigured", usageRatio: null });
});

test("malformed configured limits fail closed", () => {
  const base = {
    usage: { totalTokens: 1, providerCostMicros: 1, requests: 1 },
    reservation: { totalTokens: 1, providerCostMicros: 1, requests: 1 },
  };
  for (const field of ["monthlyTokenLimit", "monthlyProviderCostLimitMicros", "monthlyRequestLimit"]) {
    for (const value of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(
        () => evaluateMonthlyAiBudget({ ...base, limits: { [field]: value } }),
        { name: "TypeError", message: "invalid_budget_limits" },
      );
    }
  }
});

test("worst-case reservation blocks before an exhausted budget", () => {
  const result = evaluateMonthlyAiBudget({ usage: { totalTokens: 90, providerCostMicros: 20, requests: 2 }, reservation: { totalTokens: 11, providerCostMicros: 1, requests: 1 }, limits: { monthlyTokenLimit: 100, monthlyProviderCostLimitMicros: 100, monthlyRequestLimit: 10 } });
  assert.equal(result.allowed, false);
  assert.equal(result.level, "hard_limit");
});
