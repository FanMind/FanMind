export const FANMIND_BASE_PACKAGE_IDS = Object.freeze(["base_99", "base_199", "base_312"]);

export const FANMIND_BASE_PACKAGES = Object.freeze({
  base_99: Object.freeze({
    id: "base_99",
    monthlyPriceCents: 9900,
    monthlyAiBudgetMicros: null,
  }),
  base_199: Object.freeze({
    id: "base_199",
    monthlyPriceCents: 19900,
    monthlyAiBudgetMicros: null,
  }),
  base_312: Object.freeze({
    id: "base_312",
    monthlyPriceCents: 31200,
    monthlyAiBudgetMicros: null,
  }),
});

export const FANMIND_AI_QUALITY_MODES = Object.freeze({
  fast: Object.freeze({ id: "fast", label: "Schnell" }),
  balanced: Object.freeze({ id: "balanced", label: "Ausgewogen" }),
  premium: Object.freeze({ id: "premium", label: "Premium" }),
});

export const FANMIND_AI_CAPACITY_POLICY = Object.freeze({
  accountingBasis: "actual_provider_model_token_cost",
  includedBudgetResets: "monthly",
  includedBudgetCarryOver: false,
  consumptionOrder: Object.freeze(["included_monthly_budget", "purchased_topup"]),
  purchasedTopupValidityDays: null,
  topupTargetGrossMarginRatio: 0.33,
  customerDisplayUnit: "ai_capacity",
  internalAccountingFields: Object.freeze([
    "provider",
    "model",
    "input_tokens",
    "output_tokens",
    "provider_cost_micros",
    "money_value_micros",
  ]),
  legacyPlusUltraProductModelActive: false,
  productionActivationAllowed: false,
});

export function getFanMindBasePackage(packageId) {
  const value = FANMIND_BASE_PACKAGES[packageId];
  if (!value) throw new Error(`Unknown FanMind base package: ${String(packageId)}`);
  return value;
}

export function assertFanMindAiCapacityCommercialModel() {
  const prices = FANMIND_BASE_PACKAGE_IDS.map((id) => FANMIND_BASE_PACKAGES[id].monthlyPriceCents);
  if (prices.join(",") !== "9900,19900,31200") {
    throw new Error("FanMind base package prices must remain 99/199/312 EUR");
  }
  if (FANMIND_BASE_PACKAGE_IDS.some((id) => FANMIND_BASE_PACKAGES[id].monthlyAiBudgetMicros !== null)) {
    throw new Error("Exact included AI budgets must remain unset until usage evidence approves them");
  }
  if (FANMIND_AI_CAPACITY_POLICY.legacyPlusUltraProductModelActive !== false) {
    throw new Error("Legacy KI Plus/Ultra product model must stay disabled");
  }
  if (FANMIND_AI_CAPACITY_POLICY.productionActivationAllowed !== false) {
    throw new Error("AI capacity billing must stay non-activating until controlled acceptance");
  }
  return true;
}

assertFanMindAiCapacityCommercialModel();
