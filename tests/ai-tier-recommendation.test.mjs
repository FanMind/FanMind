import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { AI_TIER_CONFIG } from "../src/config/aiTiers.mjs";
import {
  AI_TIER_RECOMMENDATION,
  AI_TIER_RECOMMENDATION_STATUS,
  assertAiTierRecommendationPolicy,
  estimateProviderCostCents,
  getRecommendedProviderCostScenario,
} from "../src/config/aiTierRecommendation.mjs";

const recommendationDocumentPath =
  "docs/operations/AI_TIER_COST_AND_QUOTA_RECOMMENDATION.md";

test("AI tier recommendation is advisory and cannot activate paid tiers", () => {
  assert.equal(AI_TIER_RECOMMENDATION_STATUS, "advisory");
  assert.equal(assertAiTierRecommendationPolicy(), true);

  for (const tierId of ["plus", "ultra"]) {
    assert.equal(AI_TIER_CONFIG[tierId].publicStatus, "Coming Soon");
    assert.equal(AI_TIER_CONFIG[tierId].billingStatus, "not_configured");
    assert.equal(AI_TIER_CONFIG[tierId].automaticallyBookable, false);
    assert.equal(AI_TIER_CONFIG[tierId].modelClass, null);
    assert.equal(AI_TIER_CONFIG[tierId].monthlyRequestLimit, null);
    assert.equal(AI_TIER_CONFIG[tierId].monthlyTokenLimit, null);
    assert.equal(
      AI_TIER_CONFIG[tierId].contextMessageLimit,
      tierId === "plus" ? 100 : 150,
    );
  }
});

test("recommended quotas increase while every tier remains fail-closed at 100 percent", () => {
  const standard = AI_TIER_RECOMMENDATION.standard;
  const plus = AI_TIER_RECOMMENDATION.plus;
  const ultra = AI_TIER_RECOMMENDATION.ultra;

  for (const field of [
    "monthlyRequestLimit",
    "monthlyTokenLimit",
    "contextMessageLimit",
  ]) {
    assert.ok(standard[field] < plus[field]);
    assert.ok(plus[field] < ultra[field]);
  }

  for (const tier of Object.values(AI_TIER_RECOMMENDATION)) {
    assert.equal(tier.usagePolicy.warningPercent, 80);
    assert.equal(tier.usagePolicy.hardStopPercent, 100);
    assert.equal(tier.usagePolicy.automaticOverageEnabled, false);
  }
});

test("published context recommendation matches the approved 50/100/150 policy", async () => {
  const document = await readFile(recommendationDocumentPath, "utf8");

  for (const [tierName, expectedContext] of [
    ["KI Standard", AI_TIER_RECOMMENDATION.standard.contextMessageLimit],
    ["KI Plus", AI_TIER_RECOMMENDATION.plus.contextMessageLimit],
    ["KI Ultra", AI_TIER_RECOMMENDATION.ultra.contextMessageLimit],
  ]) {
    assert.match(
      document,
      new RegExp(
        `\\| ${tierName} \\|[^\\n]+\\| ${expectedContext} \\|`,
        "u",
      ),
    );
  }
});

test("dated uncached provider-cost scenarios are deterministic", () => {
  assert.equal(
    estimateProviderCostCents({
      inputTokens: 750_000,
      outputTokens: 250_000,
      inputPerMillionCents: 200,
      outputPerMillionCents: 1_200,
    }),
    450,
  );

  assert.deepEqual(getRecommendedProviderCostScenario("standard"), {
    tierId: "standard",
    inputTokens: 2_250_000,
    outputTokens: 750_000,
    estimatedProviderCostCents: 135,
    currency: "USD",
  });
  assert.equal(
    getRecommendedProviderCostScenario("plus").estimatedProviderCostCents,
    2_700,
  );
  assert.equal(
    getRecommendedProviderCostScenario("ultra").estimatedProviderCostCents,
    9_000,
  );
});

test("recommendation verifier reports stable advisory output without model ids", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/operations/verify-ai-tier-recommendation.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /AI_TIER_RECOMMENDATION_STATUS=ADVISORY/u);
  assert.match(result.stdout, /AI_TIER_STANDARD_RECOMMENDATION/u);
  assert.match(result.stdout, /AI_TIER_PLUS_RECOMMENDATION/u);
  assert.match(result.stdout, /AI_TIER_ULTRA_RECOMMENDATION/u);
  assert.match(result.stdout, /AI_TIER_RECOMMENDATION=PASS activation=none/u);
  assert.doesNotMatch(result.stdout, /gpt-/u);
  assert.equal(result.stderr, "");
});
