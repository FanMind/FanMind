import { AI_TIER_CONTEXT_MESSAGE_LIMITS } from "./aiTiers.mjs";

const TOKENS_PER_MILLION = 1_000_000;
const INPUT_SHARE_BASIS_POINTS = 7_500;
const BASIS_POINTS = 10_000;

function freezeRecommendation(tier) {
  return Object.freeze({
    ...tier,
    usagePolicy: Object.freeze({ ...tier.usagePolicy }),
    pricingSnapshot: Object.freeze({ ...tier.pricingSnapshot }),
  });
}

function requireNonNegativeInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`${field} must be a non-negative integer`);
  }
}

export const AI_TIER_RECOMMENDATION_STATUS = "advisory";
export const AI_TIER_RECOMMENDATION_AS_OF = "2026-07-30";
export const AI_TIER_RECOMMENDATION_SOURCE =
  "https://developers.openai.com/api/docs/models";

export const AI_TIER_RECOMMENDATION = Object.freeze({
  standard: freezeRecommendation({
    tierId: "standard",
    modelClass: "efficient_high_volume",
    providerModelRecommendation: "gpt-5.6-luna",
    monthlyRequestLimit: 750,
    monthlyTokenLimit: 3_000_000,
    contextMessageLimit: AI_TIER_CONTEXT_MESSAGE_LIMITS.standard,
    usagePolicy: {
      warningPercent: 80,
      hardStopPercent: 100,
      automaticOverageEnabled: false,
    },
    pricingSnapshot: {
      currency: "USD",
      inputPerMillionCents: 20,
      outputPerMillionCents: 120,
    },
  }),
  plus: freezeRecommendation({
    tierId: "plus",
    modelClass: "balanced",
    providerModelRecommendation: "gpt-5.6-terra",
    monthlyRequestLimit: 1_500,
    monthlyTokenLimit: 6_000_000,
    contextMessageLimit: AI_TIER_CONTEXT_MESSAGE_LIMITS.plus,
    usagePolicy: {
      warningPercent: 80,
      hardStopPercent: 100,
      automaticOverageEnabled: false,
    },
    pricingSnapshot: {
      currency: "USD",
      inputPerMillionCents: 200,
      outputPerMillionCents: 1_200,
    },
  }),
  ultra: freezeRecommendation({
    tierId: "ultra",
    modelClass: "frontier",
    providerModelRecommendation: "gpt-5.6-sol",
    monthlyRequestLimit: 2_000,
    monthlyTokenLimit: 8_000_000,
    contextMessageLimit: AI_TIER_CONTEXT_MESSAGE_LIMITS.ultra,
    usagePolicy: {
      warningPercent: 80,
      hardStopPercent: 100,
      automaticOverageEnabled: false,
    },
    pricingSnapshot: {
      currency: "USD",
      inputPerMillionCents: 500,
      outputPerMillionCents: 3_000,
    },
  }),
});

export function estimateProviderCostCents({
  inputTokens,
  outputTokens,
  inputPerMillionCents,
  outputPerMillionCents,
}) {
  requireNonNegativeInteger(inputTokens, "inputTokens");
  requireNonNegativeInteger(outputTokens, "outputTokens");
  requireNonNegativeInteger(inputPerMillionCents, "inputPerMillionCents");
  requireNonNegativeInteger(outputPerMillionCents, "outputPerMillionCents");

  return Math.ceil(
    (inputTokens * inputPerMillionCents +
      outputTokens * outputPerMillionCents) /
      TOKENS_PER_MILLION,
  );
}

export function getAiTierRecommendation(tierId) {
  const recommendation = AI_TIER_RECOMMENDATION[tierId];
  if (!recommendation) {
    throw new Error(`Unknown AI tier recommendation: ${String(tierId)}`);
  }
  return recommendation;
}

export function getRecommendedProviderCostScenario(tierId) {
  const recommendation = getAiTierRecommendation(tierId);
  const inputTokens = Math.floor(
    (recommendation.monthlyTokenLimit * INPUT_SHARE_BASIS_POINTS) /
      BASIS_POINTS,
  );
  const outputTokens = recommendation.monthlyTokenLimit - inputTokens;
  const estimatedProviderCostCents = estimateProviderCostCents({
    inputTokens,
    outputTokens,
    ...recommendation.pricingSnapshot,
  });

  return Object.freeze({
    tierId,
    inputTokens,
    outputTokens,
    estimatedProviderCostCents,
    currency: recommendation.pricingSnapshot.currency,
  });
}

export function assertAiTierRecommendationPolicy() {
  const standard = getAiTierRecommendation("standard");
  const plus = getAiTierRecommendation("plus");
  const ultra = getAiTierRecommendation("ultra");
  const ordered = [standard, plus, ultra];

  for (const field of [
    "monthlyRequestLimit",
    "monthlyTokenLimit",
    "contextMessageLimit",
  ]) {
    if (!(ordered[0][field] < ordered[1][field] && ordered[1][field] < ordered[2][field])) {
      throw new Error(`${field} must increase from Standard through Ultra`);
    }
  }

  for (const tier of ordered) {
    if (
      tier.usagePolicy.warningPercent !== 80 ||
      tier.usagePolicy.hardStopPercent !== 100 ||
      tier.usagePolicy.automaticOverageEnabled
    ) {
      throw new Error(`${tier.tierId} must keep the advisory fail-closed usage policy`);
    }
  }

  if (new Set(ordered.map((tier) => tier.providerModelRecommendation)).size !== 3) {
    throw new Error("Provider model recommendations must remain distinct");
  }

  return true;
}

assertAiTierRecommendationPolicy();
