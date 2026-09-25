// Pure repository-side validation for Creator voice-onboarding datasets.
// No persistence, provider call, model invocation, profile mutation, or message send.
import { creatorUuid, CreatorPolicyError } from "./creatorIntelligencePolicy.mjs";

export const CREATOR_VOICE_ONBOARDING_MIN_MESSAGES = 30;
export const CREATOR_VOICE_ONBOARDING_MAX_MESSAGES = 100;
export const CREATOR_VOICE_ONBOARDING_MAX_TEXT_LENGTH = 4000;
export const CREATOR_VOICE_ONBOARDING_CLOCK_SKEW_MS = 30_000;
const graphemeSegmenter = new Intl.Segmenter("und", { granularity: "grapheme" });
const rgiEmojiZwjSequence = /^\p{RGI_Emoji_ZWJ_Sequence}$/v;
const rgiEmojiFlagSequence = /^\p{RGI_Emoji_Flag_Sequence}$/v;
const rgiEmojiModifierSequence = /^\p{RGI_Emoji_Modifier_Sequence}$/v;
const assignedEmojiBase = /^\p{Emoji}$/u;
const emojiModifierBase = /^\p{Emoji_Modifier_Base}$/u;

function requireCondition(condition, code) {
  if (!condition) throw new CreatorPolicyError(code);
}

function boundedText(value, maximum, code) {
  requireCondition(typeof value === "string", code);
  const normalized = value.normalize("NFC").trim();
  requireCondition(normalized.length > 0 && normalized.length <= maximum, code);
  return normalized;
}

function canonicalUuid(value) {
  return creatorUuid(value).toLowerCase();
}

function timestamp(value, now, clockSkewMs) {
  const normalized = boundedText(value, 40, "invalid_voice_onboarding_confirmed_at");
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/u.exec(normalized);
  requireCondition(match !== null, "invalid_voice_onboarding_confirmed_at");
  const parsed = Date.parse(normalized);
  requireCondition(Number.isFinite(parsed), "invalid_voice_onboarding_confirmed_at");
  const date = new Date(parsed);
  const [, year, month, day, hour, minute, second] = match;
  requireCondition(
    date.getUTCFullYear() === Number(year) &&
      date.getUTCMonth() + 1 === Number(month) &&
      date.getUTCDate() === Number(day) &&
      date.getUTCHours() === Number(hour) &&
      date.getUTCMinutes() === Number(minute) &&
      date.getUTCSeconds() === Number(second) &&
      parsed <= now + clockSkewMs,
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

  const expectedWorkspaceId = canonicalUuid(expected?.expectedWorkspaceId);
  const expectedCreatorId = canonicalUuid(expected?.expectedCreatorId);
  const now = options.now ?? Date.now();
  const clockSkewMs = options.clockSkewMs ?? CREATOR_VOICE_ONBOARDING_CLOCK_SKEW_MS;
  requireCondition(Number.isFinite(now) && now >= 0, "invalid_voice_onboarding_time");
  requireCondition(
    Number.isSafeInteger(clockSkewMs) &&
      clockSkewMs >= 0 &&
      clockSkewMs <= CREATOR_VOICE_ONBOARDING_CLOCK_SKEW_MS,
    "invalid_voice_onboarding_clock_skew",
  );

  for (let index = 0; index < records.length; index += 1) {
    requireCondition(Object.hasOwn(records, index), "voice_onboarding_sparse_sample");
  }

  const normalized = records.map((raw) => {
    requireCondition(raw && typeof raw === "object" && !Array.isArray(raw), "voice_onboarding_record_required");

    const workspaceId = canonicalUuid(raw.workspaceId);
    const creatorId = canonicalUuid(raw.creatorId);
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
      messageId: canonicalUuid(raw.messageId),
      text: boundedText(raw.text, CREATOR_VOICE_ONBOARDING_MAX_TEXT_LENGTH, "invalid_voice_onboarding_text"),
      confirmedAt: timestamp(raw.confirmedAt, now, clockSkewMs),
      confirmedBy: raw.confirmedBy == null ? null : canonicalUuid(raw.confirmedBy),
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


function roundRatio(numerator, denominator) {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 1000) / 1000;
}

function graphemes(value) {
  return [...graphemeSegmenter.segment(value.normalize("NFC"))].map(({ segment }) => segment);
}

function canonicalEmojiAtom(segment, { allowMinimallyQualified = false } = {}) {
  const keycap = /^([0-9#*])\uFE0F?\u20E3$/u.exec(segment);
  if (keycap) return `${keycap[1]}\u20E3`;

  if (/^\p{Regional_Indicator}{2}$/u.test(segment)) {
    return rgiEmojiFlagSequence.test(segment) ? segment : null;
  }
  if (/^\p{Regional_Indicator}\uFE0F?$/u.test(segment)) return null;

  const simple = /^(\p{Extended_Pictographic}|\p{Emoji_Presentation})(\uFE0F)?(\p{Emoji_Modifier})?$/u.exec(segment);
  if (!simple) return null;

  const [, base, variationSelector = "", modifier = ""] = simple;
  if (!assignedEmojiBase.test(base)) return null;

  if (modifier) {
    const modifierSequence = `${base}${modifier}`;
    if (
      !emojiModifierBase.test(base) ||
      variationSelector !== "" ||
      !rgiEmojiModifierSequence.test(modifierSequence)
    ) return null;
    return modifierSequence;
  }

  const defaultEmojiPresentation = /\p{Emoji_Presentation}/u.test(base);
  if (!defaultEmojiPresentation && variationSelector !== "\uFE0F" && !allowMinimallyQualified) return null;

  const keepVariationSelector =
    !defaultEmojiPresentation && (variationSelector === "\uFE0F" || allowMinimallyQualified);
  return `${base}${keepVariationSelector ? "\uFE0F" : ""}`;
}

function canonicalEmojiKey(segment) {
  if (/\uFE0E/u.test(segment)) return null;

  const tagSequence = /^(\p{Extended_Pictographic})([\u{E0030}-\u{E0039}\u{E0061}-\u{E007A}]+)\u{E007F}$/u.exec(segment);
  if (tagSequence) {
    const [, base, encodedPayload] = tagSequence;
    const payload = [...encodedPayload]
      .map((value) => String.fromCodePoint(value.codePointAt(0) - 0xE0000))
      .join("");
    if (base === "\u{1F3F4}" && ["gbeng", "gbsct", "gbwls"].includes(payload)) return segment;
  }

  const sanitized = [...segment]
    .filter((value) => {
      const codePoint = value.codePointAt(0);
      if (codePoint >= 0xE0000 && codePoint <= 0xE007F) return false;
      if (value === "\uFE0F" || value === "\u20E3") return true;
      return !/\p{Mark}/u.test(value);
    })
    .join("");

  const parts = sanitized.split("\u200D");
  if (parts.length > 1) {
    const canonicalParts = parts.map((part) => canonicalEmojiAtom(part, { allowMinimallyQualified: true }));
    if (canonicalParts.some((part) => part == null)) return null;

    const canonicalSequence = canonicalParts.join("\u200D");
    if (!rgiEmojiZwjSequence.test(canonicalSequence)) return null;
    return canonicalSequence;
  }

  return canonicalEmojiAtom(sanitized);
}

function isEmojiGrapheme(segment) {
  return canonicalEmojiKey(segment) !== null;
}

function hasQuestionPunctuation(text) {
  return /[?¿՞؟？⁇⁈⁉]/u.test(text);
}

function hasExclamationPunctuation(text) {
  return /[!¡՜！‼⁈⁉]/u.test(text);
}

export function summarizeCreatorVoiceOnboardingDataset(dataset, expected, options = {}) {
  requireCondition(dataset && typeof dataset === "object" && !Array.isArray(dataset), "voice_onboarding_dataset_required");
  const expectedWorkspaceId = canonicalUuid(expected?.expectedWorkspaceId);
  const expectedCreatorId = canonicalUuid(expected?.expectedCreatorId);
  const workspaceId = canonicalUuid(dataset.workspaceId);
  const creatorId = canonicalUuid(dataset.creatorId);
  requireCondition(
    workspaceId === expectedWorkspaceId && creatorId === expectedCreatorId,
    "voice_onboarding_summary_scope_mismatch",
  );
  requireCondition(Array.isArray(dataset.messages), "voice_onboarding_messages_required");
  requireCondition(dataset.messages.length === dataset.sampleSize, "voice_onboarding_sample_size_mismatch");
  const validated = normalizeCreatorVoiceOnboardingDataset(
    dataset.messages,
    { expectedWorkspaceId, expectedCreatorId },
    options,
  );
  requireCondition(validated.sampleSize === dataset.sampleSize, "voice_onboarding_sample_size_mismatch");

  const lengths = [];
  let questionMessages = 0;
  let exclamationMessages = 0;
  let emojiMessages = 0;
  let totalEmojiCount = 0;
  const emojiCounts = new Map();

  for (const message of validated.messages) {
    requireCondition(
      message &&
        typeof message === "object" &&
        canonicalUuid(message.workspaceId) === workspaceId &&
        canonicalUuid(message.creatorId) === creatorId &&
        message.direction === "outbound" &&
        message.confirmed === true &&
        message.source === "manual_outbound" &&
        message.aiGenerated === false,
      "voice_onboarding_summary_scope_mismatch",
    );
    const text = boundedText(message.text, CREATOR_VOICE_ONBOARDING_MAX_TEXT_LENGTH, "invalid_voice_onboarding_text");
    const textGraphemes = graphemes(text);
    lengths.push(textGraphemes.length);
    if (hasQuestionPunctuation(text)) questionMessages += 1;
    if (hasExclamationPunctuation(text)) exclamationMessages += 1;

    const emojis = textGraphemes
      .map(canonicalEmojiKey)
      .filter((emoji) => emoji !== null);
    if (emojis.length > 0) emojiMessages += 1;
    totalEmojiCount += emojis.length;
    for (const emoji of emojis) emojiCounts.set(emoji, (emojiCounts.get(emoji) ?? 0) + 1);
  }

  const sortedLengths = [...lengths].sort((a, b) => a - b);
  const midpoint = Math.floor(sortedLengths.length / 2);
  const medianChars =
    sortedLengths.length % 2 === 0
      ? (sortedLengths[midpoint - 1] + sortedLengths[midpoint]) / 2
      : sortedLengths[midpoint];

  function compareCodePoints(left, right) {
    const leftPoints = Array.from(left, (value) => value.codePointAt(0));
    const rightPoints = Array.from(right, (value) => value.codePointAt(0));
    const length = Math.min(leftPoints.length, rightPoints.length);
    for (let index = 0; index < length; index += 1) {
      if (leftPoints[index] !== rightPoints[index]) return leftPoints[index] - rightPoints[index];
    }
    return leftPoints.length - rightPoints.length;
  }

  const preferredEmojis = [...emojiCounts.entries()]
    .sort((a, b) => b[1] - a[1] || compareCodePoints(a[0], b[0]))
    .slice(0, 10)
    .map(([emoji]) => emoji);

  return {
    workspaceId,
    creatorId,
    sampleSize: dataset.sampleSize,
    evidenceOnly: true,
    autoApprovalAllowed: false,
    rawTextIncluded: false,
    messageIdIncluded: false,
    metrics: {
      averageChars: Math.round((lengths.reduce((sum, value) => sum + value, 0) / lengths.length) * 1000) / 1000,
      medianChars,
      questionMessageRatio: roundRatio(questionMessages, lengths.length),
      exclamationMessageRatio: roundRatio(exclamationMessages, lengths.length),
      emojiMessageRatio: roundRatio(emojiMessages, lengths.length),
      emojisPerMessage: roundRatio(totalEmojiCount, lengths.length),
      preferredEmojis,
    },
  };
}
