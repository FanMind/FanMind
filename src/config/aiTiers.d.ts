export type AiTierId = "standard" | "plus" | "ultra";
export type AiTierPublicStatus = "Aktiv" | "Coming Soon";
export type AiTierBillingStatus = "included" | "not_configured" | "enabled";
export type AiTierEntitlementStatus =
  | "active"
  | "pending"
  | "paused"
  | "canceled"
  | "expired";

export type AiTierConfig = Readonly<{
  id: AiTierId;
  name: string;
  monthlyAddOnCents: number;
  includedInBase: boolean;
  publicStatus: AiTierPublicStatus;
  billingStatus: AiTierBillingStatus;
  automaticallyBookable: boolean;
  addOnReferralDiscountEligible: boolean;
  automaticSendingEnabled: boolean;
  modelClass: string | null;
  monthlyRequestLimit: number | null;
  monthlyTokenLimit: number | null;
  contextMessageLimit: number | null;
  description: string;
  features: readonly string[];
}>;

export type AiTierReadinessBlocker =
  | "automatic_sending"
  | "referral_discount"
  | "base_price"
  | "public_status"
  | "billing_status"
  | "booking_flag"
  | "model_class"
  | "monthly_request_limit"
  | "monthly_token_limit"
  | "context_message_limit"
  | "stripe_price"
  | "workspace_contract"
  | "provider_model"
  | "fallback_model"
  | "provider_fallback_distinct"
  | "usage_enforcement"
  | "stripe_lifecycle"
  | "quality_cost_evaluation"
  | "staging_acceptance"
  | "legal_tax_approval"
  | "runtime_integration"
  | "production_activation";

export type AiTierReadiness = Readonly<{
  tierId: AiTierId;
  publicStatus: AiTierPublicStatus;
  ready: boolean;
  automaticallyBookable: boolean;
  blockers: readonly AiTierReadinessBlocker[];
}>;

export type WorkspaceAiTierEntitlementInput = Readonly<{
  tierId?: unknown;
  status?: unknown;
  source?: unknown;
  effectiveAt?: unknown;
  expiresAt?: unknown;
  stripeSubscriptionItemLinked?: unknown;
  serverOwned?: unknown;
}>;

export type AiTierEntitlementFallbackReason =
  | "unknown_tier"
  | "server_owned"
  | "lifecycle_status"
  | "source"
  | "stripe_item"
  | "effective_at"
  | "not_started"
  | "expires_at"
  | "expired"
  | "tier_readiness";

export type WorkspaceAiTierEntitlement = Readonly<{
  requestedTierId: AiTierId | null;
  effectiveTierId: AiTierId;
  entitlementStatus: "included" | "active";
  fellBackToStandard: boolean;
  fallbackReasons: readonly AiTierEntitlementFallbackReason[];
  readinessBlockers: readonly AiTierReadinessBlocker[];
}>;

export const AI_TIER_IDS: readonly AiTierId[];
export const AI_TIER_CONTEXT_MESSAGE_LIMITS: Readonly<
  Record<AiTierId, 50 | 100 | 150>
>;
export const AI_MAX_CONTEXT_MESSAGE_LIMIT: 150;
export const AI_TIER_ENTITLEMENT_STATUSES: readonly AiTierEntitlementStatus[];
export const AI_TIER_CONFIG: Readonly<Record<AiTierId, AiTierConfig>>;
export function getAiTierConfig(tierId: AiTierId): AiTierConfig;
export function formatAiTierPrice(tierOrId: AiTierConfig | AiTierId): string;
export function getAiTierTotalMonthlyCents(tierId: AiTierId, baseMonthlyFeeCents: number): number;
export type AiTierRuntimeReadiness = Readonly<{
  stripePriceConfigured?: boolean;
  workspaceContractConfirmed?: boolean;
  providerModelConfigured?: boolean;
  fallbackModelConfigured?: boolean;
  providerFallbackDistinct?: boolean;
  usageEnforcementConfirmed?: boolean;
  stripeLifecycleConfirmed?: boolean;
  qualityCostEvaluationConfirmed?: boolean;
  stagingAcceptanceConfirmed?: boolean;
  legalTaxApprovalConfirmed?: boolean;
  runtimeIntegrationConfirmed?: boolean;
  productionActivationConfirmed?: boolean;
}>;
export function isAiTierAutomaticallyBookable(
  tierId: AiTierId,
  runtime?: AiTierRuntimeReadiness,
): boolean;
export function evaluateAiTierReadiness(
  tierId: AiTierId,
  runtime?: AiTierRuntimeReadiness,
): AiTierReadiness;
export function getAiTierRuntimeReadinessFromEnvironment(
  tierId: AiTierId,
  environment?: Readonly<Record<string, string | undefined>>,
): AiTierRuntimeReadiness;
export function resolveWorkspaceAiTierEntitlement(
  entitlement?: WorkspaceAiTierEntitlementInput,
  runtime?: AiTierRuntimeReadiness,
  now?: Date | string | number,
): WorkspaceAiTierEntitlement;
export function assertAiTierPolicy(): true;
