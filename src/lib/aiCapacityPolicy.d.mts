export type AiCapacityPackageId = "capacity_99" | "capacity_199" | "capacity_312";
export type AiCapacityQualityMode = "fast" | "balanced" | "premium";
export type AiCapacityPolicy = Readonly<{
  globalCapacityEnabled: boolean;
  emergencySpendFreeze: boolean;
  topUpSalesEnabled: boolean;
  packageSalesEnabled: Readonly<Record<AiCapacityPackageId, boolean>>;
  qualityModeEnabled: Readonly<Record<AiCapacityQualityMode, boolean>>;
  includedBudgetEurMicrocents: Readonly<Record<AiCapacityPackageId, number | null>>;
}>;
export const AI_BILLING_CONTRACT_VERSIONS: readonly ["legacy_v1", "capacity_v2"];
export const AI_CAPACITY_PACKAGE_IDS: readonly AiCapacityPackageId[];
export const AI_CAPACITY_QUALITY_MODES: readonly AiCapacityQualityMode[];
export const AI_CAPACITY_PACKAGES: Readonly<Record<AiCapacityPackageId, Readonly<{ id: AiCapacityPackageId; monthlyPriceCents: number; includedBudgetEurMicrocents: null }>>>;
export const DEFAULT_AI_CAPACITY_ADMIN_POLICY: AiCapacityPolicy;
export function normalizeAiCapacityAdminPolicy(input?: unknown): AiCapacityPolicy;
export function resolveAiCapacityUsageAdmission(input?: unknown): Readonly<Record<string, unknown>>;
export function resolveAiCapacitySalesAdmission(input?: unknown): Readonly<Record<string, unknown>>;
export const resolveAiCapacityAdmission: typeof resolveAiCapacityUsageAdmission;
