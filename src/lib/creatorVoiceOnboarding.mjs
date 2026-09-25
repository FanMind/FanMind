// Pure repository-side validation for Creator voice-onboarding datasets.
// No persistence, provider call, model invocation, profile mutation, or message send.
import { creatorUuid, CreatorPolicyError } from "./creatorIntelligencePolicy.mjs";

export const CREATOR_VOICE_ONBOARDING_MIN_MESSAGES = 30;
export const CREATOR_VOICE_ONBOARDING_MAX_MESSAGES = 100;
export const CREATOR_VOICE_ONBOARDING_MAX_TEXT_LENGTH = 4000;
export const CREATOR_VOICE_ONBOARDING_CLOCK_SKEW_MS = 30_000;

function requireCondition(condition, code) {
  if (!condition) throw new CreatorPolicyError(code);
}

function boundedText(value, maximum, code) {
  requireCondition(typeof value === "string" && value.length <= maximum, code);
  const normalized = value.normalize("NFC").trim();
  requireCondition(normalized.length > 0, code);
  return normalized;
}

function timestamp(value, now, clockSkewMs) {
  const normalized = boundedText(value, 40, "invalid_voice_onboarding_confirmed_at");
  const parsed = Date.parse(normalized);
  requireCondition(
    Number.isFinite(parsed) && parsed <= now + clockSkewMs,
    "invalid_voice_onboarding_confirmed_at",
  );
  return normalized;
}

export function normalizeCreatorVoiceOnboardingDataset(records, expected, options = {}) {
  requireCondition(Array.isArray(records), "voice_onboarding_records_required");
  requireCondition(
    records.length >= CREATOR_VOICE_ONBOARDING_MIN_MESSAGES &&
      records.length <= CREATOR_VOICE_ONBOARDING_MAX_MESSAGES,
    "voice_onboarding_sample_size",
  );

  const expectedWorkspaceId = creatorUuid(expected?.expectedWorkspaceId);
  const expectedCreatorId = creatorUuid(expected?.expectedCreatorId);
  const now = options.now ?? Date.now();
  const clockSkewMs = options.clockSkewMs ?? CREATOR_VOICE_ONBOARDING_CLOCK_SKEW_MS;
  requireCondition(Number.isFinite(now) && now >= 0, "invalid_voice_onboarding_time");
  requireCondition(
    Number.isSafeInteger(clockSkewMs) &&
      clockSkewMs >= 0 &&
      clockSkewMs <= CREATOR_VOICE_ONBOARDING_CLOCK_SKEW_MS,
    "invalid_voice_onboarding_clock_skew",
  );

  const normalized = records.map((raw) => {
    requireCondition(raw && typeof raw === "object" && !Array.isArray(raw), "voice_onboarding_record_required");

    const workspaceId = creatorUuid(raw.workspaceId);
    const creatorId = creatorUuid(raw.creatorId);
    requireCondition(
      workspaceId === expectedWorkspaceId && creatorId === expectedCreatorId,
      "voice_onboarding_scope_mismatch",
    );

    requireCondition(raw.direction === "outbound", "voice_onboarding_outbound_only");
    requireCondition(raw.confirmed === true, "voice_onboarding_confirmation_required");
    requireCondition(raw.source === "manual_outbound", "voice_onboarding_manual_source_required");
    requireCondition(raw.aiGenerated === false, "voice_onboarding_ai_draft_forbidden");

    return {
      workspaceId,
      creatorId,
      messageId: creatorUuid(raw.messageId),
      text: boundedText(raw.text, CREATOR_VOICE_ONBOARDING_MAX_TEXT_LENGTH, "invalid_voice_onboarding_text"),
      confirmedAt: timestamp(raw.confirmedAt, now, clockSkewMs),
      confirmedBy: raw.confirmedBy == null ? null : creatorUuid(raw.confirmedBy),
      direction: "outbound",
      confirmed: true,
      source: "manual_outbound",
      aiGenerated: false,
    };
  });

  requireCondition(
    new Set(normalized.map((record) => record.messageId)).size === normalized.length,
    "duplicate_voice_onboarding_message_id",
  );

  return {
    workspaceId: expectedWorkspaceId,
    creatorId: expectedCreatorId,
    sampleSize: normalized.length,
    messages: normalized,
  };
}
