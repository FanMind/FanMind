#!/usr/bin/env node

import {
  AI_TIER_RECOMMENDATION,
  AI_TIER_RECOMMENDATION_AS_OF,
  AI_TIER_RECOMMENDATION_STATUS,
  assertAiTierRecommendationPolicy,
  getRecommendedProviderCostScenario,
} from "../../src/config/aiTierRecommendation.mjs";

assertAiTierRecommendationPolicy();

console.log(`AI_TIER_RECOMMENDATION_STATUS=${AI_TIER_RECOMMENDATION_STATUS.toUpperCase()}`);
console.log(`AI_TIER_RECOMMENDATION_AS_OF=${AI_TIER_RECOMMENDATION_AS_OF}`);

for (const [tierId, recommendation] of Object.entries(AI_TIER_RECOMMENDATION)) {
  const scenario = getRecommendedProviderCostScenario(tierId);
  console.log(
    [
      `AI_TIER_${tierId.toUpperCase()}_RECOMMENDATION`,
      `class=${recommendation.modelClass}`,
      `requests=${recommendation.monthlyRequestLimit}`,
      `tokens=${recommendation.monthlyTokenLimit}`,
      `context=${recommendation.contextMessageLimit}`,
      `provider_cost_${scenario.currency.toLowerCase()}_cents=${scenario.estimatedProviderCostCents}`,
    ].join(" "),
  );
}

console.log("AI_TIER_RECOMMENDATION=PASS activation=none");
