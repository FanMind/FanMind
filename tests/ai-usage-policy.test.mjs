import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { normalizeOpenAiResponseUsage } from "../src/lib/aiUsageProviderMetrics.mjs";
import {
  calculateAiUsageIndicator,
  normalizeAiUsageThreshold,
} from "../src/lib/aiUsagePolicy.mjs";

test("usage thresholds are optional positive integers", () => {
  assert.equal(normalizeAiUsageThreshold(undefined), null);
  assert.equal(normalizeAiUsageThreshold(null), null);
  assert.equal(normalizeAiUsageThreshold(0), null);
  assert.equal(normalizeAiUsageThreshold(-1), null);
  assert.equal(normalizeAiUsageThreshold("not-a-number"), null);
  assert.equal(normalizeAiUsageThreshold(125.6), 126);
});

test("unconfigured thresholds never imply a quota or automatic block", () => {
  assert.deepEqual(
    calculateAiUsageIndicator({ requests: 500, tokens: 1_000_000 }),
    {
      configured: false,
      level: "unconfigured",
      usageRatio: null,
      usagePercent: null,
      requestWarning: null,
      tokenWarning: null,
    },
  );
});

test("usage indicator uses the highest configured soft-threshold ratio", () => {
  const normal = calculateAiUsageIndicator({
    requests: 40,
    tokens: 20_000,
    requestWarning: 100,
    tokenWarning: 100_000,
  });
  assert.equal(normal.configured, true);
  assert.equal(normal.level, "normal");
  assert.equal(normal.usagePercent, 40);

  const warning = calculateAiUsageIndicator({
    requests: 85,
    tokens: 20_000,
    requestWarning: 100,
    tokenWarning: 100_000,
  });
  assert.equal(warning.level, "warning");
  assert.equal(warning.usagePercent, 85);

  const attention = calculateAiUsageIndicator({
    requests: 101,
    tokens: 20_000,
    requestWarning: 100,
    tokenWarning: 100_000,
  });
  assert.equal(attention.level, "attention");
  assert.equal(attention.usagePercent, 100);
  assert.equal(attention.usageRatio, 1.01);
});

test("one configured threshold is sufficient and negative usage is normalized", () => {
  const tokenOnly = calculateAiUsageIndicator({
    requests: -10,
    tokens: 80_000,
    tokenWarning: 100_000,
  });
  assert.equal(tokenOnly.level, "warning");
  assert.equal(tokenOnly.usagePercent, 80);
  assert.equal(tokenOnly.requestWarning, null);
  assert.equal(tokenOnly.tokenWarning, 100_000);
});

test("normalizes complete OpenAI Responses token usage", () => {
  assert.deepEqual(
    normalizeOpenAiResponseUsage({
      input_tokens: 123,
      output_tokens: 45,
      total_tokens: 168,
      input_tokens_details: { cached_tokens: 20 },
    }),
    {
      inputTokens: 123,
      cachedInputTokens: 20,
      cacheWriteTokens: 0,
      outputTokens: 45,
      reasoningOutputTokens: 0,
      totalTokens: 168,
    },
  );

  assert.deepEqual(
    normalizeOpenAiResponseUsage({
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
    }),
    {
      inputTokens: 0,
      cachedInputTokens: 0,
      cacheWriteTokens: 0,
      outputTokens: 0,
      reasoningOutputTokens: 0,
      totalTokens: 0,
    },
  );
});

test("rejects missing, malformed or inconsistent provider usage", () => {
  const invalidValues = [
    null,
    [],
    {},
    { input_tokens: 10, output_tokens: 2 },
    { input_tokens: -1, output_tokens: 2, total_tokens: 1 },
    { input_tokens: 1.5, output_tokens: 2, total_tokens: 3.5 },
    { input_tokens: "1", output_tokens: 2, total_tokens: 3 },
    { input_tokens: 1, output_tokens: 2, total_tokens: 4 },
    {
      input_tokens: Number.MAX_SAFE_INTEGER + 1,
      output_tokens: 0,
      total_tokens: Number.MAX_SAFE_INTEGER + 1,
    },
  ];

  for (const value of invalidValues) {
    assert.equal(normalizeOpenAiResponseUsage(value), null);
  }
});

test("productive Responses paths forward provider usage and retain the estimate fallback", async () => {
  const [usageRecorder, replyRoute, analysisAction] = await Promise.all([
    readFile("src/lib/aiUsage.ts", "utf8"),
    readFile("src/app/api/ai/reply-suggestions/route.ts", "utf8"),
    readFile("src/app/fans/[id]/analysisActions.ts", "utf8"),
  ]);

  assert.match(usageRecorder, /normalizeOpenAiResponseUsage\(input\.providerUsage\)/u);
  assert.match(
    usageRecorder,
    /providerUsage\?\.inputTokens \?\? estimateTokensFromChars\(inputChars\)/u,
  );
  assert.match(
    usageRecorder,
    /providerUsage\?\.outputTokens \?\? estimateTokensFromChars\(outputChars\)/u,
  );
  assert.ok(
    (replyRoute.match(/providerUsage: responseBody\?\.usage/gu) ?? []).length >= 3,
  );
  assert.ok(
    (analysisAction.match(/providerUsage: responseBody\?\.usage/gu) ?? [])
      .length >= 2,
  );
});
