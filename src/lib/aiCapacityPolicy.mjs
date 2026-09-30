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
  packageSalesEnabled: Object.freeze({
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
  if (value === null) return null;
  if (value === undefined) return undefined;
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
  const packageSalesEnabled = booleanRecord(input.packageSalesEnabled, AI_CAPACITY_PACKAGE_IDS);
  const qualityModeEnabled = booleanRecord(input.qualityModeEnabled, AI_CAPACITY_QUALITY_MODES);
  if (!packageSalesEnabled || !qualityModeEnabled) {
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
    if (!Object.prototype.hasOwnProperty.call(input.includedBudgetEurMicrocents, packageId)) {
      throw new TypeError("invalid_ai_capacity_admin_policy");
    }
    const normalized = exactPositiveIntegerOrNull(input.includedBudgetEurMicrocents[packageId]);
    if (normalized === undefined) {
      throw new TypeError("invalid_ai_capacity_admin_policy");
    }
    budgets[packageId] = normalized;
  }
  if (input.globalCapacityEnabled && !Object.values(qualityModeEnabled).some(Boolean)) {
    throw new TypeError("invalid_ai_capacity_admin_policy");
  }
  return Object.freeze({
    globalCapacityEnabled: input.globalCapacityEnabled,
    emergencySpendFreeze: input.emergencySpendFreeze,
    topUpSalesEnabled: input.topUpSalesEnabled,
    packageSalesEnabled,
    qualityModeEnabled,
    includedBudgetEurMicrocents: Object.freeze(budgets),
  });
}

function resolveCommonCapacityPolicy({
  billingContractVersion,
  packageId,
  adminPolicy,
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
  let policy;
  try {
    policy = normalizeAiCapacityAdminPolicy(adminPolicy);
  } catch {
    return Object.freeze({ allowed: false, reason: "admin_policy_invalid" });
  }

  const includedBudgetEurMicrocents = policy.includedBudgetEurMicrocents[packageId];
  if (includedBudgetEurMicrocents == null) {
    return Object.freeze({ allowed: false, reason: "included_budget_unset" });
  }

  return Object.freeze({
    allowed: true,
    reason: "allowed",
    packageId,
    monthlyPriceCents: AI_CAPACITY_PACKAGES[packageId].monthlyPriceCents,
    includedBudgetEurMicrocents,
    topUpSalesEnabled: policy.topUpSalesEnabled,
    packageSalesEnabled: policy.packageSalesEnabled[packageId],
    policy,
  });
}

export function resolveAiCapacityUsageAdmission({
  billingContractVersion,
  packageId,
  qualityMode,
  adminPolicy = DEFAULT_AI_CAPACITY_ADMIN_POLICY,
} = {}) {
  if (!AI_CAPACITY_QUALITY_MODES.includes(qualityMode)) {
    return Object.freeze({ allowed: false, reason: "quality_mode_unknown" });
  }
  const common = resolveCommonCapacityPolicy({ billingContractVersion, packageId, adminPolicy });
  if (!common.allowed) return common;
  if (!common.policy.globalCapacityEnabled) {
    return Object.freeze({ allowed: false, reason: "capacity_disabled" });
  }
  if (common.policy.emergencySpendFreeze) {
    return Object.freeze({ allowed: false, reason: "emergency_spend_freeze" });
  }
  if (!common.policy.qualityModeEnabled[qualityMode]) {
    return Object.freeze({ allowed: false, reason: "quality_mode_disabled" });
  }
  return Object.freeze({
    allowed: true,
    reason: "allowed",
    packageId,
    qualityMode,
    monthlyPriceCents: common.monthlyPriceCents,
    includedBudgetEurMicrocents: common.includedBudgetEurMicrocents,
    topUpSalesEnabled: common.topUpSalesEnabled,
  });
}

export function resolveAiCapacitySalesAdmission({
  billingContractVersion,
  packageId,
  adminPolicy = DEFAULT_AI_CAPACITY_ADMIN_POLICY,
} = {}) {
  const common = resolveCommonCapacityPolicy({ billingContractVersion, packageId, adminPolicy });
  if (!common.allowed) return common;
  if (!common.packageSalesEnabled) {
    return Object.freeze({ allowed: false, reason: "package_sales_disabled" });
  }
  return Object.freeze({
    allowed: true,
    reason: "allowed",
    packageId,
    monthlyPriceCents: common.monthlyPriceCents,
    includedBudgetEurMicrocents: common.includedBudgetEurMicrocents,
  });
}

export const resolveAiCapacityAdmission = resolveAiCapacityUsageAdmission;
