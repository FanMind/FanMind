export const AI_BILLING_CONTRACT_VERSIONS = Object.freeze(["legacy_v1", "capacity_v2"]);
export const AI_CAPACITY_PACKAGE_IDS = Object.freeze(["capacity_99", "capacity_199", "capacity_312"]);
export const AI_CAPACITY_QUALITY_MODES = Object.freeze(["fast", "balanced", "premium"]);

export const AI_CAPACITY_PACKAGES = Object.freeze({
  capacity_99: Object.freeze({
    id: "capacity_99",
    monthlyPriceCents: 9_900,
    includedBudgetEurMicrocents: null,
  }),
  capacity_199: Object.freeze({
    id: "capacity_199",
    monthlyPriceCents: 19_900,
    includedBudgetEurMicrocents: null,
  }),
  capacity_312: Object.freeze({
    id: "capacity_312",
    monthlyPriceCents: 31_200,
    includedBudgetEurMicrocents: null,
  }),
});

export const DEFAULT_AI_CAPACITY_ADMIN_POLICY = Object.freeze({
  globalCapacityEnabled: false,
  emergencySpendFreeze: true,
  topUpSalesEnabled: false,
  packageEnabled: Object.freeze({
    capacity_99: false,
    capacity_199: false,
    capacity_312: false,
  }),
  qualityModeEnabled: Object.freeze({
    fast: false,
    balanced: false,
    premium: false,
  }),
  includedBudgetEurMicrocents: Object.freeze({
    capacity_99: null,
    capacity_199: null,
    capacity_312: null,
  }),
});

function exactPositiveIntegerOrNull(value) {
  if (value == null) return null;
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function booleanRecord(record, keys) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  const result = {};
  for (const key of keys) {
    if (typeof record[key] !== "boolean") return null;
    result[key] = record[key];
  }
  return Object.freeze(result);
}

export function normalizeAiCapacityAdminPolicy(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("invalid_ai_capacity_admin_policy");
  }
  const packageEnabled = booleanRecord(input.packageEnabled, AI_CAPACITY_PACKAGE_IDS);
  const qualityModeEnabled = booleanRecord(input.qualityModeEnabled, AI_CAPACITY_QUALITY_MODES);
  if (!packageEnabled || !qualityModeEnabled) {
    throw new TypeError("invalid_ai_capacity_admin_policy");
  }
  for (const field of ["globalCapacityEnabled", "emergencySpendFreeze", "topUpSalesEnabled"]) {
    if (typeof input[field] !== "boolean") {
      throw new TypeError("invalid_ai_capacity_admin_policy");
    }
  }
  if (!input.includedBudgetEurMicrocents || typeof input.includedBudgetEurMicrocents !== "object" || Array.isArray(input.includedBudgetEurMicrocents)) {
    throw new TypeError("invalid_ai_capacity_admin_policy");
  }
  const budgets = {};
  for (const packageId of AI_CAPACITY_PACKAGE_IDS) {
    const normalized = exactPositiveIntegerOrNull(input.includedBudgetEurMicrocents[packageId]);
    if (normalized === undefined) {
      throw new TypeError("invalid_ai_capacity_admin_policy");
    }
    budgets[packageId] = normalized;
  }
  return Object.freeze({
    globalCapacityEnabled: input.globalCapacityEnabled,
    emergencySpendFreeze: input.emergencySpendFreeze,
    topUpSalesEnabled: input.topUpSalesEnabled,
    packageEnabled,
    qualityModeEnabled,
    includedBudgetEurMicrocents: Object.freeze(budgets),
  });
}

export function resolveAiCapacityAdmission({
  billingContractVersion,
  packageId,
  qualityMode,
  adminPolicy = DEFAULT_AI_CAPACITY_ADMIN_POLICY,
} = {}) {
  if (!AI_BILLING_CONTRACT_VERSIONS.includes(billingContractVersion)) {
    return Object.freeze({ allowed: false, reason: "billing_contract_unknown" });
  }
  if (billingContractVersion !== "capacity_v2") {
    return Object.freeze({ allowed: false, reason: "legacy_contract" });
  }
  if (!AI_CAPACITY_PACKAGE_IDS.includes(packageId)) {
    return Object.freeze({ allowed: false, reason: "package_unknown" });
  }
  if (!AI_CAPACITY_QUALITY_MODES.includes(qualityMode)) {
    return Object.freeze({ allowed: false, reason: "quality_mode_unknown" });
  }

  let policy;
  try {
    policy = normalizeAiCapacityAdminPolicy(adminPolicy);
  } catch {
    return Object.freeze({ allowed: false, reason: "admin_policy_invalid" });
  }

  if (!policy.globalCapacityEnabled) {
    return Object.freeze({ allowed: false, reason: "capacity_disabled" });
  }
  if (policy.emergencySpendFreeze) {
    return Object.freeze({ allowed: false, reason: "emergency_spend_freeze" });
  }
  if (!policy.packageEnabled[packageId]) {
    return Object.freeze({ allowed: false, reason: "package_disabled" });
  }
  if (!policy.qualityModeEnabled[qualityMode]) {
    return Object.freeze({ allowed: false, reason: "quality_mode_disabled" });
  }
  const includedBudgetEurMicrocents = policy.includedBudgetEurMicrocents[packageId];
  if (includedBudgetEurMicrocents == null) {
    return Object.freeze({ allowed: false, reason: "included_budget_unset" });
  }

  return Object.freeze({
    allowed: true,
    reason: "allowed",
    packageId,
    qualityMode,
    monthlyPriceCents: AI_CAPACITY_PACKAGES[packageId].monthlyPriceCents,
    includedBudgetEurMicrocents,
    topUpSalesEnabled: policy.topUpSalesEnabled,
  });
}
