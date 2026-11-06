export const AI_TIER_IDS = Object.freeze(["standard", "plus", "ultra"]);
export const AI_TIER_CONTEXT_MESSAGE_LIMITS = Object.freeze({
  standard: 50,
  plus: 100,
  ultra: 150,
});
export const AI_MAX_CONTEXT_MESSAGE_LIMIT =
  AI_TIER_CONTEXT_MESSAGE_LIMITS.ultra;
export const AI_TIER_ENTITLEMENT_STATUSES = Object.freeze([
  "active",
  "pending",
  "paused",
  "canceled",
  "expired",
]);

const AI_TIER_STRIPE_PRICE_ENV = Object.freeze({
  plus: "STRIPE_PRICE_AI_PLUS",
  ultra: "STRIPE_PRICE_AI_ULTRA",
});

function paidTierEnvironmentPrefix(tierId) {
  return AI_TIER_STRIPE_PRICE_ENV[tierId]
    ? `FANMIND_AI_TIER_${tierId.toUpperCase()}`
    : null;
}

function freezeTier(tier) {
  return Object.freeze({
    ...tier,
    features: Object.freeze([...tier.features]),
  });
}

export const AI_TIER_CONFIG = Object.freeze({
  standard: freezeTier({
    id: "standard",
    name: "KI Standard",
    monthlyAddOnCents: 0,
    includedInBase: true,
    publicStatus: "Aktiv",
    billingStatus: "included",
    automaticallyBookable: false,
    addOnReferralDiscountEligible: false,
    automaticSendingEnabled: false,
    modelClass: null,
    monthlyRequestLimit: null,
    monthlyTokenLimit: null,
    contextMessageLimit: AI_TIER_CONTEXT_MESSAGE_LIMITS.standard,
    description:
      "Im Starter-Basispaket enthaltene KI für Antwortvorschläge, Kontaktwissen und Follow-ups.",
    features: [
      "im Basispaket enthalten",
      "Antwortvorschläge",
      "Kontaktwissen & Follow-ups",
      "manuelle Prüfung vor dem Versand",
    ],
  }),
  plus: freezeTier({
    id: "plus",
    name: "KI Plus",
    monthlyAddOnCents: 10000,
    includedInBase: false,
    publicStatus: "Coming Soon",
    billingStatus: "not_configured",
    automaticallyBookable: false,
    addOnReferralDiscountEligible: false,
    automaticSendingEnabled: false,
    modelClass: null,
    monthlyRequestLimit: null,
    monthlyTokenLimit: null,
    contextMessageLimit: AI_TIER_CONTEXT_MESSAGE_LIMITS.plus,
    description:
      "Kostenpflichtige Erweiterung mit leistungsstärkerer KI, mehr Nutzung und größerem Gesprächskontext.",
    features: [
      "leistungsstärkere Modellklasse nach Freigabe",
      "höheres KI-Kontingent nach Freigabe",
      "größerer Gesprächskontext nach Freigabe",
      "weiterhin manuelle Prüfung",
    ],
  }),
  ultra: freezeTier({
    id: "ultra",
    name: "KI Ultra",
    monthlyAddOnCents: 20000,
    includedInBase: false,
    publicStatus: "Coming Soon",
    billingStatus: "not_configured",
    automaticallyBookable: false,
    addOnReferralDiscountEligible: false,
    automaticSendingEnabled: false,
    modelClass: null,
    monthlyRequestLimit: null,
    monthlyTokenLimit: null,
    contextMessageLimit: AI_TIER_CONTEXT_MESSAGE_LIMITS.ultra,
    description:
      "Premium-Erweiterung mit der stärksten freigegebenen KI, den höchsten Kontingenten und erweitertem Funktionsumfang.",
    features: [
      "stärkste freigegebene Modellklasse nach Freigabe",
      "höchstes KI-Kontingent nach Freigabe",
      "größter Gesprächskontext nach Freigabe",
      "keine automatische Sendung",
    ],
  }),
});

export function getAiTierConfig(tierId) {
  const tier = AI_TIER_CONFIG[tierId];
  if (!tier) throw new Error(`Unknown AI tier: ${String(tierId)}`);
  return tier;
}

export function formatAiTierPrice(tierOrId) {
  const tier = typeof tierOrId === "string" ? getAiTierConfig(tierOrId) : tierOrId;
  if (tier.includedInBase) return "im Basispaket enthalten";
  return `+${tier.monthlyAddOnCents / 100} €/Monat`;
}

export function getAiTierTotalMonthlyCents(tierId, baseMonthlyFeeCents) {
  if (!Number.isInteger(baseMonthlyFeeCents) || baseMonthlyFeeCents < 0) {
    throw new Error("baseMonthlyFeeCents must be a non-negative integer");
  }
  return baseMonthlyFeeCents + getAiTierConfig(tierId).monthlyAddOnCents;
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function hasConfiguredStripePrice(value) {
  return typeof value === "string" && /^price_[A-Za-z0-9_]+$/u.test(value);
}

function hasConfiguredProviderModel(value) {
  return (
    typeof value === "string" &&
    /^[a-z0-9][a-z0-9._:-]{2,127}$/u.test(value.trim())
  );
}

function isExplicitlyConfirmed(value) {
  return value === "true";
}

function normalizedInstant(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const normalized = value.trim();
  // Entitlement boundaries are security-relevant instants. Reject date-only and
  // locale-dependent values instead of letting Date.parse apply the host's
  // timezone or implementation-specific parsing rules.
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u.test(
      normalized,
    )
  ) {
    return null;
  }
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function nowTimestamp(value) {
  const timestamp =
    value instanceof Date
      ? value.getTime()
      : typeof value === "number"
        ? value
        : Date.parse(String(value));
  if (!Number.isFinite(timestamp)) {
    throw new TypeError("now must be a valid instant");
  }
  return timestamp;
}

export function getAiTierRuntimeReadinessFromEnvironment(
  tierId,
  environment = process.env,
) {
  const priceEnvironmentName = AI_TIER_STRIPE_PRICE_ENV[tierId];
  const prefix = paidTierEnvironmentPrefix(tierId);
  const providerModel = prefix ? environment?.[`${prefix}_MODEL`]?.trim() : "";
  const fallbackModel = prefix
    ? environment?.[`${prefix}_FALLBACK_MODEL`]?.trim()
    : "";
  const providerModelConfigured = hasConfiguredProviderModel(providerModel);
  const fallbackModelConfigured = hasConfiguredProviderModel(fallbackModel);

  return Object.freeze({
    stripePriceConfigured:
      typeof priceEnvironmentName === "string" &&
      hasConfiguredStripePrice(environment?.[priceEnvironmentName]),
    workspaceContractConfirmed:
      environment?.FANMIND_AI_TIER_WORKSPACE_CONTRACT_CONFIRMED === "true",
    providerModelConfigured,
    fallbackModelConfigured,
    providerFallbackDistinct:
      providerModelConfigured &&
      fallbackModelConfigured &&
      providerModel !== fallbackModel,
    usageEnforcementConfirmed:
      prefix != null &&
      isExplicitlyConfirmed(
        environment?.[`${prefix}_USAGE_ENFORCEMENT_CONFIRMED`],
      ),
    stripeLifecycleConfirmed:
      prefix != null &&
      isExplicitlyConfirmed(
        environment?.[`${prefix}_STRIPE_LIFECYCLE_CONFIRMED`],
      ),
    qualityCostEvaluationConfirmed:
      prefix != null &&
      isExplicitlyConfirmed(
        environment?.[`${prefix}_QUALITY_COST_EVALUATION_CONFIRMED`],
      ),
    stagingAcceptanceConfirmed:
      prefix != null &&
      isExplicitlyConfirmed(
        environment?.[`${prefix}_STAGING_ACCEPTANCE_CONFIRMED`],
      ),
    legalTaxApprovalConfirmed:
      prefix != null &&
      isExplicitlyConfirmed(
        environment?.[`${prefix}_LEGAL_TAX_APPROVAL_CONFIRMED`],
      ),
    runtimeIntegrationConfirmed:
      prefix != null &&
      isExplicitlyConfirmed(
        environment?.[`${prefix}_RUNTIME_INTEGRATION_CONFIRMED`],
      ),
    productionActivationConfirmed:
      prefix != null &&
      isExplicitlyConfirmed(
        environment?.[`${prefix}_PRODUCTION_ACTIVATION_CONFIRMED`],
      ),
  });
}

export function evaluateAiTierReadiness(
  tierId,
  {
    stripePriceConfigured = false,
    workspaceContractConfirmed = false,
    providerModelConfigured = false,
    fallbackModelConfigured = false,
    providerFallbackDistinct = false,
    usageEnforcementConfirmed = false,
    stripeLifecycleConfirmed = false,
    qualityCostEvaluationConfirmed = false,
    stagingAcceptanceConfirmed = false,
    legalTaxApprovalConfirmed = false,
    runtimeIntegrationConfirmed = false,
    productionActivationConfirmed = false,
  } = {},
) {
  const tier = getAiTierConfig(tierId);
  const blockers = [];

  if (tier.automaticSendingEnabled) blockers.push("automatic_sending");
  if (tier.addOnReferralDiscountEligible) blockers.push("referral_discount");

  if (tier.includedInBase) {
    if (tier.monthlyAddOnCents !== 0) blockers.push("base_price");
    if (tier.publicStatus !== "Aktiv") blockers.push("public_status");
    if (tier.billingStatus !== "included") blockers.push("billing_status");
    if (tier.automaticallyBookable) blockers.push("booking_flag");
  } else {
    if (tier.publicStatus !== "Aktiv") blockers.push("public_status");
    if (tier.billingStatus !== "enabled") blockers.push("billing_status");
    if (!tier.automaticallyBookable) blockers.push("booking_flag");
    if (typeof tier.modelClass !== "string" || tier.modelClass.trim() === "") {
      blockers.push("model_class");
    }
    if (!isPositiveInteger(tier.monthlyRequestLimit)) {
      blockers.push("monthly_request_limit");
    }
    if (!isPositiveInteger(tier.monthlyTokenLimit)) {
      blockers.push("monthly_token_limit");
    }
    if (!isPositiveInteger(tier.contextMessageLimit)) {
      blockers.push("context_message_limit");
    }
    if (stripePriceConfigured !== true) blockers.push("stripe_price");
    if (workspaceContractConfirmed !== true) {
      blockers.push("workspace_contract");
    }
    if (providerModelConfigured !== true) blockers.push("provider_model");
    if (fallbackModelConfigured !== true) blockers.push("fallback_model");
    if (
      providerModelConfigured === true &&
      fallbackModelConfigured === true &&
      providerFallbackDistinct !== true
    ) {
      blockers.push("provider_fallback_distinct");
    }
    if (usageEnforcementConfirmed !== true) {
      blockers.push("usage_enforcement");
    }
    if (stripeLifecycleConfirmed !== true) {
      blockers.push("stripe_lifecycle");
    }
    if (qualityCostEvaluationConfirmed !== true) {
      blockers.push("quality_cost_evaluation");
    }
    if (stagingAcceptanceConfirmed !== true) {
      blockers.push("staging_acceptance");
    }
    if (legalTaxApprovalConfirmed !== true) {
      blockers.push("legal_tax_approval");
    }
    if (runtimeIntegrationConfirmed !== true) {
      blockers.push("runtime_integration");
    }
    if (productionActivationConfirmed !== true) {
      blockers.push("production_activation");
    }
  }

  return Object.freeze({
    tierId: tier.id,
    publicStatus: tier.publicStatus,
    ready: blockers.length === 0,
    automaticallyBookable: !tier.includedInBase && blockers.length === 0,
    blockers: Object.freeze(blockers),
  });
}

export function isAiTierAutomaticallyBookable(tierId, runtime = {}) {
  return evaluateAiTierReadiness(tierId, runtime).automaticallyBookable;
}

export function resolveWorkspaceAiTierEntitlement(
  entitlement = {},
  runtime = {},
  now = new Date(),
) {
  const rawTierId =
    typeof entitlement?.tierId === "string"
      ? entitlement.tierId.trim().toLowerCase()
      : "";
  const requestedTierId = AI_TIER_IDS.includes(rawTierId) ? rawTierId : null;
  const fallbackReasons = [];
  const readinessBlockers = [];

  if (!rawTierId) {
    return Object.freeze({
      requestedTierId: null,
      effectiveTierId: "standard",
      entitlementStatus: "included",
      fellBackToStandard: false,
      fallbackReasons: Object.freeze([]),
      readinessBlockers: Object.freeze([]),
    });
  }

  if (!requestedTierId) {
    fallbackReasons.push("unknown_tier");
  } else if (requestedTierId === "standard") {
    return Object.freeze({
      requestedTierId,
      effectiveTierId: "standard",
      entitlementStatus: "included",
      fellBackToStandard: false,
      fallbackReasons: Object.freeze([]),
      readinessBlockers: Object.freeze([]),
    });
  } else {
    const status =
      typeof entitlement.status === "string"
        ? entitlement.status.trim().toLowerCase()
        : "";
    const source =
      typeof entitlement.source === "string"
        ? entitlement.source.trim().toLowerCase()
        : "";

    if (entitlement.serverOwned !== true) {
      fallbackReasons.push("server_owned");
    }
    if (status !== "active") {
      fallbackReasons.push("lifecycle_status");
    }
    if (source !== "stripe") {
      fallbackReasons.push("source");
    }
    if (entitlement.stripeSubscriptionItemLinked !== true) {
      fallbackReasons.push("stripe_item");
    }

    const effectiveAt = normalizedInstant(entitlement.effectiveAt);
    const expiresAt =
      entitlement.expiresAt == null || entitlement.expiresAt === ""
        ? null
        : normalizedInstant(entitlement.expiresAt);
    const currentTimestamp = nowTimestamp(now);

    if (effectiveAt === null) {
      fallbackReasons.push("effective_at");
    } else if (effectiveAt > currentTimestamp) {
      fallbackReasons.push("not_started");
    }
    if (
      entitlement.expiresAt != null &&
      entitlement.expiresAt !== "" &&
      expiresAt === null
    ) {
      fallbackReasons.push("expires_at");
    } else if (expiresAt !== null && expiresAt <= currentTimestamp) {
      fallbackReasons.push("expired");
    }

    const readiness = evaluateAiTierReadiness(requestedTierId, runtime);
    readinessBlockers.push(...readiness.blockers);
    if (!readiness.ready) {
      fallbackReasons.push("tier_readiness");
    }
  }

  const effectiveTierId =
    requestedTierId && fallbackReasons.length === 0
      ? requestedTierId
      : "standard";

  return Object.freeze({
    requestedTierId,
    effectiveTierId,
    entitlementStatus:
      effectiveTierId === "standard" ? "included" : "active",
    fellBackToStandard:
      rawTierId !== "standard" && effectiveTierId === "standard",
    fallbackReasons: Object.freeze(fallbackReasons),
    readinessBlockers: Object.freeze(readinessBlockers),
  });
}

export function assertAiTierPolicy() {
  const standard = getAiTierConfig("standard");
  const plus = getAiTierConfig("plus");
  const ultra = getAiTierConfig("ultra");

  if (!standard.includedInBase || standard.monthlyAddOnCents !== 0) {
    throw new Error("KI Standard must remain included in the base package");
  }
  if (plus.monthlyAddOnCents !== 10000 || ultra.monthlyAddOnCents !== 20000) {
    throw new Error("KI Plus/Ultra prices do not match the approved commercial truth");
  }
  if (
    standard.contextMessageLimit !== 50 ||
    plus.contextMessageLimit !== 100 ||
    ultra.contextMessageLimit !== 150
  ) {
    throw new Error(
      "AI context message limits must remain Standard 50, Plus 100 and Ultra 150",
    );
  }
  for (const tier of Object.values(AI_TIER_CONFIG)) {
    if (tier.automaticSendingEnabled) {
      throw new Error(`${tier.name} must not enable automatic sending`);
    }
    if (tier.addOnReferralDiscountEligible) {
      throw new Error(`${tier.name} add-on must not be referral-discount eligible`);
    }
  }
  return true;
}

assertAiTierPolicy();
