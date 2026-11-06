export const META_GRAPH_API_VERSION = "v25.0";

export const META_CONNECTION_MANAGER_ROLES = Object.freeze([
  "owner",
  "admin",
]);

export const META_CONNECTION_CAPABILITIES = Object.freeze({
  facebook: Object.freeze({
    messages: Object.freeze([
      "pages_show_list",
      "pages_manage_metadata",
      "pages_messaging",
    ]),
    comments: Object.freeze([
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_metadata",
      "pages_read_user_content",
    ]),
    insights: Object.freeze([
      "pages_show_list",
      "pages_read_engagement",
      "read_insights",
    ]),
  }),
  instagram: Object.freeze({
    messages: Object.freeze([
      "instagram_business_basic",
      "instagram_business_manage_messages",
    ]),
    comments: Object.freeze([
      "instagram_business_basic",
      "instagram_business_manage_comments",
    ]),
    insights: Object.freeze([
      "instagram_business_basic",
      "instagram_business_manage_insights",
    ]),
  }),
});

export const FAN_COMMUNICATION_ANALYSIS_FIELDS = Object.freeze([
  "language",
  "communication_tone",
  "sentiment_within_conversation",
  "explicit_topics",
  "explicit_questions",
  "intent",
  "objections",
  "preferred_reply_style",
  "response_timing",
  "open_commitments",
  "next_best_action",
]);

export const PROHIBITED_SENSITIVE_INFERENCES = Object.freeze([
  "racial_or_ethnic_origin",
  "political_opinions",
  "religious_or_philosophical_beliefs",
  "trade_union_membership",
  "genetic_data",
  "biometric_identification",
  "health_data",
  "sex_life",
  "sexual_orientation",
  "psychological_diagnosis",
]);

export function canManageMetaConnections(role) {
  const normalizedRole = String(role ?? "").trim().toLowerCase();
  return META_CONNECTION_MANAGER_ROLES.includes(normalizedRole);
}

export function getMetaCapabilityScopes(platform, capability) {
  const platformPolicy = META_CONNECTION_CAPABILITIES[platform];
  const scopes = platformPolicy?.[capability];
  return scopes ? [...scopes] : [];
}

export function buildExternalResourceKey(platform, externalAccountId) {
  const normalizedPlatform = String(platform ?? "").trim().toLowerCase();
  const normalizedAccountId = String(externalAccountId ?? "").trim();
  if (!normalizedPlatform || !normalizedAccountId) return null;
  if (!/^[a-z][a-z0-9_-]{1,31}$/u.test(normalizedPlatform)) return null;
  if (!/^[A-Za-z0-9._:-]{1,255}$/u.test(normalizedAccountId)) return null;
  return `${normalizedPlatform}:${normalizedAccountId}`;
}

export function evaluateExternalAccountBinding(input) {
  const resourceKey = buildExternalResourceKey(
    input?.platform,
    input?.externalAccountId,
  );
  if (!input?.workspaceId || !input?.userId || !resourceKey) {
    return { allowed: false, reason: "invalid_binding", resourceKey: null };
  }
  if (!canManageMetaConnections(input?.role)) {
    return { allowed: false, reason: "role_forbidden", resourceKey };
  }
  if (
    input?.existingActiveWorkspaceId &&
    input.existingActiveWorkspaceId !== input.workspaceId
  ) {
    return { allowed: false, reason: "resource_already_bound", resourceKey };
  }
  return { allowed: true, reason: "allowed", resourceKey };
}

export function evaluateAnalysisActivation(input) {
  if (!canManageMetaConnections(input?.role)) {
    return { allowed: false, blockers: ["role_forbidden"] };
  }

  const blockers = [];
  if (input?.legalBasisStatus !== "confirmed") {
    blockers.push("legal_basis_unconfirmed");
  }
  if (input?.transparencyStatus !== "confirmed") {
    blockers.push("transparency_unconfirmed");
  }
  if (input?.dataProcessingAgreementStatus !== "confirmed") {
    blockers.push("data_processing_agreement_unconfirmed");
  }
  if (input?.retentionStatus !== "confirmed") {
    blockers.push("retention_unconfirmed");
  }
  if (input?.dataSubjectRightsStatus !== "confirmed") {
    blockers.push("data_subject_rights_unconfirmed");
  }

  return { allowed: blockers.length === 0, blockers };
}
