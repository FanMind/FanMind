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
  const summary = summarizeCreatorVoiceOnboardingDataset(normalized, { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId });

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
    () => summarizeCreatorVoiceOnboardingDataset(normalized, { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId }),
    /voice_onboarding_(?:summary_)?scope_mismatch/u,
  );
});

test("summary requires a sampleSize that exactly matches the validated message array", () => {
  const normalized = normalizeCreatorVoiceOnboardingDataset(
    dataset(),
    { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
  );
  assert.throws(
    () => summarizeCreatorVoiceOnboardingDataset({ ...normalized, sampleSize: normalized.sampleSize + 1 }, { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId }),
    /voice_onboarding_sample_size_mismatch/u,
  );
});


test("summary revalidates message identity and rejects duplicate message IDs", () => {
  const normalized = normalizeCreatorVoiceOnboardingDataset(
    dataset(),
    { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
  );
  normalized.messages[0] = { ...normalized.messages[0], messageId: normalized.messages[1].messageId };
  assert.throws(
    () => summarizeCreatorVoiceOnboardingDataset(normalized, { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId }),
    /duplicate_voice_onboarding_message_id/u,
  );
});


test("summary binds the dataset header and messages to authorization-owned Creator scope", () => {
  const foreignWorkspaceId = "77777777-7777-4777-8777-777777777777";
  const foreignCreatorId = "88888888-8888-4888-8888-888888888888";
  const foreign = dataset().map((item) => ({
    ...item,
    workspaceId: foreignWorkspaceId,
    creatorId: foreignCreatorId,
  }));
  const normalized = normalizeCreatorVoiceOnboardingDataset(
    foreign,
    { expectedWorkspaceId: foreignWorkspaceId, expectedCreatorId: foreignCreatorId },
  );
  assert.throws(
    () => summarizeCreatorVoiceOnboardingDataset(
      normalized,
      { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
    ),
    /voice_onboarding_summary_scope_mismatch/u,
  );
});

test("summary measures user-perceived graphemes rather than UTF-16 code units", () => {
  const records = dataset();
  records[0] = record(1, { text: "👨‍👩‍👧‍👦" });
  records[1] = record(2, { text: "é" });
  for (let index = 2; index < records.length; index += 1) {
    records[index] = record(index + 1, { text: "a" });
  }
  const normalized = normalizeCreatorVoiceOnboardingDataset(
    records,
    { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
  );
  const summary = summarizeCreatorVoiceOnboardingDataset(
    normalized,
    { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
  );
  assert.equal(summary.metrics.averageChars, 1);
  assert.equal(summary.metrics.medianChars, 1);
});

test("summary preserves complete emoji graphemes and excludes plain emoji-capable symbols", () => {
  const records = dataset();
  records[0] = record(1, { text: "👨‍👩‍👧‍👦" });
  records[1] = record(2, { text: "❤️" });
  records[2] = record(3, { text: "🇦🇹" });
  records[3] = record(4, { text: "©" });
  records[4] = record(5, { text: "©️" });
  const normalized = normalizeCreatorVoiceOnboardingDataset(
    records,
    { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
  );
  const summary = summarizeCreatorVoiceOnboardingDataset(
    normalized,
    { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
  );

  assert.ok(summary.metrics.preferredEmojis.includes("👨‍👩‍👧‍👦"));
  assert.ok(summary.metrics.preferredEmojis.includes("❤️"));
  assert.ok(summary.metrics.preferredEmojis.includes("🇦🇹"));
  assert.ok(!summary.metrics.preferredEmojis.includes("©"));
  assert.ok(summary.metrics.preferredEmojis.includes("©️"));
  assert.equal(summary.metrics.emojisPerMessage, 0.133);
});


test("summary recognizes Arabic and full-width question/exclamation punctuation", () => {
  const records = dataset();
  records[0] = record(1, { text: "كيف حالك؟" });
  records[1] = record(2, { text: "元気ですか？" });
  records[2] = record(3, { text: "すごい！" });

  const normalized = normalizeCreatorVoiceOnboardingDataset(
    records,
    { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
  );
  const summary = summarizeCreatorVoiceOnboardingDataset(
    normalized,
    { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
  );

  assert.equal(summary.metrics.questionMessageRatio, 0.067);
  assert.equal(summary.metrics.exclamationMessageRatio, 0.033);
});


test("summary recognizes combined Unicode question and exclamation punctuation", () => {
  const records = dataset();
  records[0] = record(1, { text: "Really⁇" });
  records[1] = record(2, { text: "Really⁈" });
  records[2] = record(3, { text: "Really⁉️" });
  records[3] = record(4, { text: "Really‼" });

  const normalized = normalizeCreatorVoiceOnboardingDataset(
    records,
    { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
  );
  const summary = summarizeCreatorVoiceOnboardingDataset(
    normalized,
    { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
  );

  assert.equal(summary.metrics.questionMessageRatio, 0.1);
  assert.equal(summary.metrics.exclamationMessageRatio, 0.1);
});

test("summary preserves fractional medians for even samples", () => {
  const records = dataset();
  for (let index = 0; index < 15; index += 1) records[index] = record(index + 1, { text: "a" });
  for (let index = 15; index < 30; index += 1) records[index] = record(index + 1, { text: "ab" });

  const normalized = normalizeCreatorVoiceOnboardingDataset(
    records,
    { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
  );
  const summary = summarizeCreatorVoiceOnboardingDataset(
    normalized,
    { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
  );

  assert.equal(summary.metrics.medianChars, 1.5);
});

test("summary uses a locale-independent code-point tie-breaker for equally common emojis", () => {
  const records = dataset();
  records[0] = record(1, { text: "🧡" });
  records[1] = record(2, { text: "😀" });
  records[2] = record(3, { text: "😄" });

  const normalized = normalizeCreatorVoiceOnboardingDataset(
    records,
    { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
  );
  const summary = summarizeCreatorVoiceOnboardingDataset(
    normalized,
    { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
  );

  assert.deepEqual(summary.metrics.preferredEmojis.slice(0, 3), ["😀", "😄", "🧡"]);
});


test("summary preserves fractional average character lengths", () => {
  const records = dataset();
  for (let index = 0; index < 15; index += 1) records[index] = record(index + 1, { text: "a" });
  for (let index = 15; index < 30; index += 1) records[index] = record(index + 1, { text: "ab" });

  const normalized = normalizeCreatorVoiceOnboardingDataset(
    records,
    { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
  );
  const summary = summarizeCreatorVoiceOnboardingDataset(
    normalized,
    { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
  );

  assert.equal(summary.metrics.averageChars, 1.5);
});

test("summary excludes text-presented emoji-capable symbols from emoji metrics", () => {
  const records = dataset();
  records[0] = record(1, { text: "☕︎" });

  const normalized = normalizeCreatorVoiceOnboardingDataset(
    records,
    { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
  );
  const summary = summarizeCreatorVoiceOnboardingDataset(
    normalized,
    { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
  );

  assert.equal(summary.metrics.emojiMessageRatio, 0);
  assert.equal(summary.metrics.emojisPerMessage, 0);
  assert.ok(!summary.metrics.preferredEmojis.includes("☕︎"));
});


test("summary recognizes Spanish opening and Armenian question/exclamation punctuation", () => {
  const records = dataset();
  records[0] = record(1, { text: "¿Solo apertura" });
  records[1] = record(2, { text: "¡Solo apertura" });
  records[2] = record(3, { text: "Հայերեն՞" });
  records[3] = record(4, { text: "Հայերեն՜" });
  records[4] = record(5, { text: "ქართული ნ ტექსტი" });

  const normalized = normalizeCreatorVoiceOnboardingDataset(
    records,
    { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
  );
  const summary = summarizeCreatorVoiceOnboardingDataset(
    normalized,
    { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
  );

  assert.equal(summary.metrics.questionMessageRatio, 0.067);
  assert.equal(summary.metrics.exclamationMessageRatio, 0.067);
});

test("summary merges redundant emoji presentation selectors but preserves meaningful FE0F", () => {
  const records = dataset();
  records[0] = record(1, { text: "☕" });
  records[1] = record(2, { text: "☕️" });
  records[2] = record(3, { text: "❤️" });

  const normalized = normalizeCreatorVoiceOnboardingDataset(
    records,
    { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
  );
  const summary = summarizeCreatorVoiceOnboardingDataset(
    normalized,
    { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
  );

  assert.equal(summary.metrics.preferredEmojis.filter((emoji) => emoji === "☕").length, 1);
  assert.ok(!summary.metrics.preferredEmojis.includes("☕️"));
  assert.ok(summary.metrics.preferredEmojis.includes("❤️"));
  assert.deepEqual(summary.metrics.preferredEmojis.slice(0, 2), ["☕", "❤️"]);
});


test("summary recognizes minimally-qualified keycap emoji", () => {
  const records = dataset();
  records[0] = record(1, { text: "1⃣" });
  records[1] = record(2, { text: "#⃣" });
  records[2] = record(3, { text: "*⃣" });

  const normalized = normalizeCreatorVoiceOnboardingDataset(
    records,
    { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
  );
  const summary = summarizeCreatorVoiceOnboardingDataset(
    normalized,
    { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
  );

  assert.equal(summary.metrics.emojiMessageRatio, 0.1);
  assert.equal(summary.metrics.emojisPerMessage, 0.1);
  assert.ok(summary.metrics.preferredEmojis.includes("1⃣"));
  assert.ok(summary.metrics.preferredEmojis.includes("#⃣"));
  assert.ok(summary.metrics.preferredEmojis.includes("*⃣"));
});

test("summary strips arbitrary combining and tag extenders from preferred emoji output", () => {
  const records = dataset();
  records[0] = record(1, { text: "😀\u0301\u0301" });
  records[1] = record(2, { text: "😀\u{E0061}\u{E0062}" });
  records[2] = record(3, { text: "😀\u{E0073}\u{E0065}\u{E0063}\u{E0072}\u{E0065}\u{E0074}\u{E007F}" });

  const normalized = normalizeCreatorVoiceOnboardingDataset(
    records,
    { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
  );
  const summary = summarizeCreatorVoiceOnboardingDataset(
    normalized,
    { expectedWorkspaceId: workspaceId, expectedCreatorId: creatorId },
  );

  assert.equal(summary.metrics.emojiMessageRatio, 0.1);
  assert.equal(summary.metrics.emojisPerMessage, 0.1);
  assert.deepEqual(summary.metrics.preferredEmojis, ["😀"]);
  assert.equal(summary.metrics.preferredEmojis.some((emoji) => /\p{Mark}/u.test(emoji)), false);
  assert.equal(summary.metrics.preferredEmojis.some((emoji) => /[\u{E0000}-\u{E007F}]/u.test(emoji)), false);
});
