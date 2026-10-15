import assert from "node:assert/strict";
import test from "node:test";
import { FANMIND_REPLY_QUALITY_INSTRUCTIONS, ReplyQualityError, assessReplyQuality, fitRecentDialogueContext, runReplyQualityGate } from "../src/lib/replyQualityPolicy.mjs";

const copied = "Ich freue mich über deine konkrete Rückmeldung und möchte mit dir gemeinsam die nächsten Schritte im Gespräch in aller Ruhe besprechen.";
const fresh = ["Die Größe fehlt noch. Welche brauchst du?", "Gerne, schick mir bitte die gewünschte Größe.", "Welche Größe soll ich prüfen?"];
test("normalization catches copied variants, long historic copies and repeated stock openings", () => {
  assert.deepEqual(assessReplyQuality(["Gerne!", "gerne.", "Ja"]), ["duplicate_variants"]);
  assert.ok(assessReplyQuality([copied, ...fresh.slice(1)], [copied]).includes("repeated_reply"));
  assert.ok(assessReplyQuality(["Ich verstehe deinen Punkt.", ...fresh.slice(1)], ["Ich verstehe die Frage.", "Ich verstehe das Problem."]).includes("repeated_opening"));
  assert.ok(assessReplyQuality([copied, copied.replace("Rückmeldung", "Nachricht"), fresh[2]]).includes("duplicate_variants"));
});
test("short factual answers can recur in history; scopes have no shared mutable memory", () => {
  assert.deepEqual(assessReplyQuality(["Das kostet 20 EUR.", "Der Preis ist 20 EUR.", "Für 20 EUR ist es erhältlich."], ["Das kostet 20 EUR."]), []);
  assert.deepEqual(assessReplyQuality([copied, ...fresh.slice(1)]), []);
  assert.deepEqual(assessReplyQuality(fresh), []);
  assert.deepEqual(assessReplyQuality(["Nur eine Antwort"]), ["invalid_replies"]);
});
test("newest complete dialogue lines survive a small history budget", () => {
  const result = fitRecentDialogueContext("Stil: kurz", ["old".repeat(30), "Vorher: Frage", "Aktuell: Antwort"], 60);
  assert.equal(result, "Stil: kurz\n\nVorher: Frage\nAktuell: Antwort");
  assert.ok(result.length <= 60);
  assert.equal(fitRecentDialogueContext("", ["Älter", "x".repeat(100)], 40), "");
});
function gateHarness(outputs, overrides = {}) {
  const calls = [], events = [];
  return { calls, events, run: () => runReplyQualityGate({
    inputChars: 100, inputLimit: 80_000,
    generate: async feedback => { calls.push(feedback); const output = outputs[calls.length - 1]; if (output instanceof Error) throw output; return output; },
    readReplies: result => result,
    onAttempt: async event => { events.push(event); },
    ...overrides,
  }) };
}
test("clean replies use one attempt and duplicate drafts get exactly one bounded rewrite", async () => {
  const clean = gateHarness([fresh]); assert.equal(await clean.run(), fresh); assert.equal(clean.calls.length, 1);
  const h = gateHarness([["Hallo", "Hallo!", "Hallo."], fresh]);
  assert.equal(await h.run(), fresh); assert.equal(h.calls.length, 2); assert.equal(h.events.length, 2);
  const feedback = JSON.parse(h.calls[1]);
  assert.deepEqual(feedback.quality_revision.issues, ["duplicate_variants"]);
  assert.deepEqual(feedback.quality_revision.previous_drafts, ["Hallo", "Hallo!", "Hallo."]);
  assert.ok(h.events[0].error instanceof ReplyQualityError); assert.equal(h.events[1].error, null);
});
test("two rejected outputs never leak a fallback or trigger a third call", async () => {
  const h = gateHarness([[copied, copied, copied], [copied, copied, copied], fresh]);
  await assert.rejects(h.run, ReplyQualityError); assert.equal(h.calls.length, 2); assert.equal(h.events.length, 2);
});
test("provider and domain-validation failures are recorded once and never retried", async () => {
  for (const overrides of [{}, { readReplies: () => { throw new Error("price_not_permitted"); } }]) {
    const h = gateHarness([new Error("provider_failed"), fresh], overrides);
    await assert.rejects(h.run); assert.equal(h.calls.length, 1); assert.equal(h.events.length, 1);
  }
  const invalidPrice = gateHarness([fresh, fresh], { readReplies: () => { throw new Error("price_not_permitted"); } });
  await assert.rejects(invalidPrice.run, /price_not_permitted/); assert.equal(invalidPrice.calls.length, 1);
});
test("repair cannot exceed the original context budget or retry invalid shape", async () => {
  const h = gateHarness([[copied, copied, copied], fresh], { inputChars: 79_999 });
  await assert.rejects(h.run, ReplyQualityError); assert.equal(h.calls.length, 1);
  const invalid = gateHarness([["One"], fresh]); await assert.rejects(invalid.run, ReplyQualityError); assert.equal(invalid.calls.length, 1);
});
test("shared examples remain bounded and cannot supply prices or override a voice", () => {
  assert.ok(FANMIND_REPLY_QUALITY_INSTRUCTIONS.length < 6_000);
  assert.doesNotMatch(FANMIND_REPLY_QUALITY_INSTRUCTIONS, /\d+\s*(?:EUR|USD|CHF|GBP|€)/u);
  assert.match(FANMIND_REPLY_QUALITY_INSTRUCTIONS, /Creator-\/Character-Stimme hat Vorrang/u);
  assert.match(FANMIND_REPLY_QUALITY_INSTRUCTIONS, /kein bestätigter Verlauf oder Faktenquelle/u);
});

test("different numbers and negations are not collapsed into the same long factual answer", () => {
 const base="Die angebotene Leistung umfasst eine schriftliche Zusammenfassung und eine ausführliche Beschreibung aller nächsten Schritte für deinen konkreten Auftrag";
 assert.deepEqual(assessReplyQuality([base+" ohne Zusatzkosten.",base+" mit Zusatzkosten.","Ich kläre die Kosten." ]),[]);
 assert.deepEqual(assessReplyQuality([base+" in 10 Tagen.",base+" in 20 Tagen.","Ich kläre den Termin." ]),[]);
});
