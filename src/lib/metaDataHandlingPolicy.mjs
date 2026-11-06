export const META_SYNC_MODE = "incremental_cache";
export const META_INITIAL_CHAT_BACKFILL_LIMIT = 150;
export const META_INCREMENTAL_CHAT_FETCH_LIMIT = 50;
export const META_PERSONAL_CONTENT_RETENTION_DAYS = 0;

export const CACHED_META_DATA_CLASSES = Object.freeze([
  "owned_account_post",
  "owned_account_post_metrics",
  "authorized_chat_message",
  "authorized_comment",
]);

export const TRANSIENT_META_DATA_CLASSES = Object.freeze([
  "third_party_personal_post",
  "third_party_profile_data",
  "media_binary",
]);

export const PERSISTED_META_DATA_CLASSES = Object.freeze([
  "encrypted_connection_token",
  "external_account_reference",
  "granted_scope_reference",
  "analysis_control",
  "minimal_fan_profile",
  "minimal_workspace_voice_profile",
]);

export function evaluateMetaDataUse(input) {
  const dataClass = String(input?.dataClass ?? "").trim();
  const userRequested = input?.userRequested === true;
  const persist = input?.persist === true;

  if (CACHED_META_DATA_CLASSES.includes(dataClass)) {
    if (
      input?.workspaceBound !== true ||
      input?.authorizedConnection !== true
    ) {
      return {
        allowed: false,
        reason: "authorized_workspace_connection_required",
      };
    }
    return {
      allowed: true,
      reason: persist ? "incremental_cache_allowed" : "authorized_use_allowed",
    };
  }

  if (TRANSIENT_META_DATA_CLASSES.includes(dataClass)) {
    if (!userRequested) {
      return { allowed: false, reason: "explicit_request_required" };
    }
    if (persist) {
      return { allowed: false, reason: "personal_meta_persistence_forbidden" };
    }
    return { allowed: true, reason: "transient_use_only" };
  }

  if (PERSISTED_META_DATA_CLASSES.includes(dataClass)) {
    return { allowed: true, reason: "minimal_persistence_allowed" };
  }

  return { allowed: false, reason: "data_class_not_allowed" };
}

export function buildMinimalFanProfile(input) {
  const profile = {};
  copyText(profile, "language", input?.language, 32);
  copyText(profile, "communication_tone", input?.communicationTone, 240);
  copyText(profile, "preferred_reply_style", input?.preferredReplyStyle, 360);
  copyText(profile, "current_intent", input?.currentIntent, 360);
  copyText(profile, "open_question", input?.openQuestion, 500);
  copyText(profile, "next_best_action", input?.nextBestAction, 500);
  copyTextArray(profile, "explicit_topics", input?.explicitTopics, 12, 120);
  copyTextArray(profile, "confirmed_preferences", input?.confirmedPreferences, 12, 180);
  copyTextArray(profile, "response_boundaries", input?.responseBoundaries, 12, 180);

  const sourceMessageCount = boundedInteger(input?.sourceMessageCount, 0, 150);
  const confidenceScore = boundedInteger(input?.confidenceScore, 0, 100);
  profile.source_message_count = sourceMessageCount;
  profile.confidence_score = confidenceScore;
  profile.source_from_at = normalizeIsoTimestamp(input?.sourceFromAt);
  profile.source_to_at = normalizeIsoTimestamp(input?.sourceToAt);
  profile.raw_source_retained = false;
  return profile;
}

function copyText(target, key, value, maxLength) {
  const normalized = normalizeText(value, maxLength);
  if (normalized) target[key] = normalized;
}

function copyTextArray(target, key, value, maxItems, maxLength) {
  if (!Array.isArray(value)) return;
  const normalized = [
    ...new Set(
      value
        .map((entry) => normalizeText(entry, maxLength))
        .filter(Boolean),
    ),
  ].slice(0, maxItems);
  if (normalized.length) target[key] = normalized;
}

function normalizeText(value, maxLength) {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/gu, " ").trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function boundedInteger(value, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return minimum;
  return Math.max(minimum, Math.min(maximum, Math.trunc(number)));
}

function normalizeIsoTimestamp(value) {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}
