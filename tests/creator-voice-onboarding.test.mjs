import assert from "node:assert/strict";
import test from "node:test";

import {
  CREATOR_VOICE_ONBOARDING_MAX_MESSAGES,
  CREATOR_VOICE_ONBOARDING_MIN_MESSAGES,
  normalizeCreatorVoiceOnboardingDataset,
  summarizeCreatorVoiceOnboardingDataset,
} from "../src/lib/creatorVoiceOnboarding.mjs";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const creatorId = "22222222-2222-4222-8222-222222222222";
const actorId = "33333333-3333-4333-8333-333333333333";

function uuid(index) {
  const suffix = String(index).padStart(12, "0");
  return `44444444-4444-4444-8444-${suffix}`;
}

function record(index, overrides = {}) {
  return {
    workspaceId,
    creatorId,
    messageId: uuid(index),
    text: `Echte manuelle Creator-Nachricht ${index}`,
    confirmedAt: "2026-09-25T10:00:00Z",
    confirmedBy: actorId,
    direction: "outbound",
    confirmed: true,
    source: "manual_outbound",
    aiGenerated: false,
    ...overrides,
  };
}

function dataset(size = CREATOR_VOICE_ONBOARDING_MIN_MESSAGES) {
  return Array.from({ length: size }, (_, index) => record(index + 1));
}

test("accepts 30 confirmed manual outbound messages for one creator scope", () => {
  const result = normalizeCreatorVoiceOnboardingDataset(
    dataset(),
    { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
    { now: Date.parse("2026-09-25T10:00:00Z") },
  );

  assert.equal(result.sampleSize, CREATOR_VOICE_ONBOARDING_MIN_MESSAGES);
  assert.equal(result.workspaceId, workspaceId);
  assert.equal(result.creatorId, creatorId);
});

test("accepts the bounded maximum sample size", () => {
  const result = normalizeCreatorVoiceOnboardingDataset(
    dataset(CREATOR_VOICE_ONBOARDING_MAX_MESSAGES),
    { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
    { now: Date.parse("2026-09-25T10:00:00Z") },
  );

  assert.equal(result.sampleSize, CREATOR_VOICE_ONBOARDING_MAX_MESSAGES);
});

test("rejects undersized onboarding samples", () => {
  assert.throws(
    () => normalizeCreatorVoiceOnboardingDataset(
      dataset(CREATOR_VOICE_ONBOARDING_MIN_MESSAGES - 1),
      { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
    ),
    /voice_onboarding_sample_size/u,
  );
});

test("rejects AI drafts, inbound messages, and unconfirmed messages", () => {
  for (const overrides of [
    { aiGenerated: true },
    { direction: "inbound" },
    { confirmed: false },
    { source: "ai_draft" },
  ]) {
    const records = dataset();
    records[0] = record(1, overrides);
    assert.throws(
      () => normalizeCreatorVoiceOnboardingDataset(
        records,
        { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
      ),
      /voice_onboarding_/u,
    );
  }
});

test("rejects cross-workspace, cross-creator, duplicate-message and future evidence", () => {
  const cases = [
    { workspaceId: "55555555-5555-4555-8555-555555555555" },
    { creatorId: "66666666-6666-4666-8666-666666666666" },
    { messageId: uuid(2) },
    { confirmedAt: "2026-09-25T10:01:00Z" },
  ];

  for (const overrides of cases) {
    const records = dataset();
    records[0] = record(1, overrides);
    assert.throws(
      () => normalizeCreatorVoiceOnboardingDataset(
        records,
        { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
        { now: Date.parse("2026-09-25T10:00:00Z") },
      ),
      /voice_onboarding_|duplicate_voice_onboarding_message_id/u,
    );
  }
});


test("rejects non-canonical or impossible confirmation timestamps", () => {
  for (const confirmedAt of ["0", "2026-02-30T10:00:00Z", "2026-09-25 10:00:00Z"]) {
    const records = dataset();
    records[0] = record(1, { confirmedAt });
    assert.throws(
      () => normalizeCreatorVoiceOnboardingDataset(
        records,
        { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
        { now: Date.parse("2026-09-25T10:00:00Z") },
      ),
      /invalid_voice_onboarding_confirmed_at/u,
    );
  }
});

test("normalizes UUID case before duplicate detection", () => {
  const records = dataset();
  records[0] = record(1, { messageId: uuid(2).toUpperCase() });
  assert.throws(
    () => normalizeCreatorVoiceOnboardingDataset(
      records,
      { expectedWorkspaceId: workspaceId.toUpperCase(), expectedCreatorId: creatorId.toUpperCase() },
    ),
    /duplicate_voice_onboarding_message_id/u,
  );
});

test("rejects sparse samples even when array length reaches the minimum", () => {
  const records = dataset();
  delete records[0];
  assert.equal(records.length, CREATOR_VOICE_ONBOARDING_MIN_MESSAGES);
  assert.throws(
    () => normalizeCreatorVoiceOnboardingDataset(
      records,
      { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
    ),
    /voice_onboarding_sparse_sample/u,
  );
});

test("applies the text bound after NFC normalization", () => {
  const records = dataset();
  records[0] = record(1, { text: "\u0344".repeat(4000) });
  assert.throws(
    () => normalizeCreatorVoiceOnboardingDataset(
      records,
      { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
    ),
    /invalid_voice_onboarding_text/u,
  );
});


test("summarizes validated Creator onboarding evidence without returning raw text or message IDs", () => {
  const records = dataset();
  records[0] = record(1, { text: "Hey 😊 Wie geht es dir?" });
  records[1] = record(2, { text: "Mega! 😊" });
  records[2] = record(3, { text: "Erzähl mir mehr davon 😄" });
  const normalized = normalizeCreatorVoiceOnboardingDataset(
    records,
    { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
    { now: Date.parse("2026-09-25T10:00:00Z") },
  );
  const summary = summarizeCreatorVoiceOnboardingDataset(normalized);

  assert.equal(summary.sampleSize, CREATOR_VOICE_ONBOARDING_MIN_MESSAGES);
  assert.equal(summary.evidenceOnly, true);
  assert.equal(summary.autoApprovalAllowed, false);
  assert.equal(summary.rawTextIncluded, false);
  assert.equal(summary.messageIdIncluded, false);
  assert.ok(summary.metrics.averageChars > 0);
  assert.ok(summary.metrics.medianChars > 0);
  assert.ok(summary.metrics.questionMessageRatio > 0);
  assert.ok(summary.metrics.exclamationMessageRatio > 0);
  assert.ok(summary.metrics.emojiMessageRatio > 0);
  assert.deepEqual(summary.metrics.preferredEmojis.slice(0, 2), ["😊", "😄"]);
  assert.doesNotMatch(JSON.stringify(summary), /Hey|Mega|Erzähl|44444444/u);
});

test("summary fails closed when a normalized-looking dataset crosses Creator scope", () => {
  const normalized = normalizeCreatorVoiceOnboardingDataset(
    dataset(),
    { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
  );
  normalized.messages[0] = {
    ...normalized.messages[0],
    creatorId: "66666666-6666-4666-8666-666666666666",
  };
  assert.throws(
    () => summarizeCreatorVoiceOnboardingDataset(normalized),
    /voice_onboarding_summary_scope_mismatch/u,
  );
});

test("summary requires a sampleSize that exactly matches the validated message array", () => {
  const normalized = normalizeCreatorVoiceOnboardingDataset(
    dataset(),
    { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
  );
  assert.throws(
    () => summarizeCreatorVoiceOnboardingDataset({ ...normalized, sampleSize: normalized.sampleSize + 1 }),
    /voice_onboarding_sample_size_mismatch/u,
  );
});
