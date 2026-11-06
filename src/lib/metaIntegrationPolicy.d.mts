export const META_GRAPH_API_VERSION: "v25.0";
export const META_CONNECTION_MANAGER_ROLES: readonly ["owner", "admin"];
export const META_CONNECTION_CAPABILITIES: Readonly<
  Record<"facebook" | "instagram", Readonly<Record<"messages" | "comments" | "insights", readonly string[]>>>
>;
export const FAN_COMMUNICATION_ANALYSIS_FIELDS: readonly string[];
export const PROHIBITED_SENSITIVE_INFERENCES: readonly string[];

export function canManageMetaConnections(role: unknown): boolean;
export function getMetaCapabilityScopes(
  platform: "facebook" | "instagram",
  capability: "messages" | "comments" | "insights",
): string[];
export function buildExternalResourceKey(
  platform: unknown,
  externalAccountId: unknown,
): string | null;
export function evaluateExternalAccountBinding(input: {
  workspaceId?: string | null;
  userId?: string | null;
  role?: unknown;
  platform?: unknown;
  externalAccountId?: unknown;
  existingActiveWorkspaceId?: string | null;
}): {
  allowed: boolean;
  reason: "allowed" | "invalid_binding" | "role_forbidden" | "resource_already_bound";
  resourceKey: string | null;
};
export function evaluateAnalysisActivation(input: {
  role?: unknown;
  legalBasisStatus?: unknown;
  transparencyStatus?: unknown;
  dataProcessingAgreementStatus?: unknown;
  retentionStatus?: unknown;
  dataSubjectRightsStatus?: unknown;
}): { allowed: boolean; blockers: string[] };
