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

for(const question of ["Magst du Musik?","Magst du Reisen?","Do you like music?","Welche Musik hörst du gerne?","What kind of music do you like?"])test(`shared quality remains context-free for known-fact questions (${question})`,()=>{
 const replies=[question,"Was machst du gerne?","Erzähl mir etwas von dir."];
 assert.deepEqual(assessReplyQuality(replies),[]);
 assert.deepEqual(assessReplyQuality(replies,["Ein anderer bestätigter Dialogbeitrag."]),[]);
});

test("known-fact question diagnostics add no provider attempt to the shared quality gate",async()=>{
 const replies=["Magst du Musik?","Was machst du gerne?","Erzähl mir etwas von dir."];
 const h=gateHarness([replies]);assert.equal(await h.run(),replies);
 assert.equal(h.calls.length,1);assert.equal(h.events.length,1);assert.equal(h.events[0].error,null);
});

test("validated positive and negative interests reject only the finite DE/EN broad-question set",async()=>{
 const replies=["Magst du Musik?","Was machst du gerne?","Erzähl mir etwas von dir."];
 for(const polarity of ["positive","negative"]){
  assert.ok(assessReplyQuality(replies,[],[{topic:"music",polarity}]).includes("known_interest_question"));
  const h=gateHarness([replies, fresh],{knownInterests:[{topic:"music",polarity}]});
  await assert.rejects(h.run,ReplyQualityError);assert.equal(h.calls.length,1);assert.equal(h.events.length,1);
 }
 assert.ok(assessReplyQuality(["Do you like music?","What do you enjoy?","Tell me about yourself."],[],[{topic:"music",polarity:"positive"}]).includes("known_interest_question"));
});

test("known-interest guard preserves detail, reconfirmation, quotations, hypotheticals and unknown topics",()=>{
 const known=[{topic:"music",polarity:"positive"}];
 for(const replies of [
  ["Welche Musik hörst du gerne?","Welche Künstler magst du?","Hast du ein Lieblingslied?"],
  ["Magst du Musik immer noch?","Hat sich dein Musikgeschmack geändert?","Soll ich Musik weiter als Interesse behandeln?"],
  ['Du hast gefragt: "Magst du Musik?"',"Wenn ich fragen würde, ob du Musik magst, wäre das zu direkt?","Hypothetisch: Magst du Musik?"],
  ["Magst du Filme?","Magst du Bücher?","Magst du Kunst?"],
 ])assert.ok(!assessReplyQuality(replies,[],known).includes("known_interest_question"));
 assert.ok(!assessReplyQuality(["Magst du Musik?","Was machst du gerne?","Erzähl mir etwas von dir."]).includes("known_interest_question"),"calls without facts stay unchanged");
});

test("all finite known-interest questions reject every allowed neutral wrapper for positive and negative facts", () => {
 const prefixes=["","Danke!","Alles klar.","Thanks!","All right."];
 const suffixes=["","Danke!","Thanks!"];
 for(const [topic,de,en] of [
  ["music","Musik","music"],["cats","Katzen","cats"],["dogs","Hunde","dogs"],
  ["travel","Reisen","travel"],["sports","Sport","sports"],["photos","Fotos","photos"],
  ["videos","Videos","videos"],["cooking","Kochen","cooking"],
 ]){
  for(const question of [
   `Magst du ${de}?`,`Liebst du ${de}?`,`Interessierst du dich für ${de}?`,
   `Do you like ${en}?`,`Do you love ${en}?`,`Are you interested in ${en}?`,
  ]){
   for(const prefix of prefixes)for(const suffix of suffixes)for(const polarity of ["positive","negative"]){
    const wrapped=[prefix,question,suffix].filter(Boolean).join(" ");
    assert.ok(assessReplyQuality([wrapped,...fresh.slice(1)],[],[{topic,polarity}]).includes("known_interest_question"),wrapped);
   }
  }
 }
});

test("known-interest wrappers stay exact and do not consume extra sentences or repeated wrappers", () => {
 const known=[{topic:"music",polarity:"positive"}];
 for(const reply of [
  "Danke! Danke! Magst du Musik?",
  "Magst du Musik? Danke! Thanks!",
  "Danke! Magst du Musik? Das frage ich nur aus Interesse.",
  "Vorab danke! Magst du Musik?",
  "Alles klar. Welche Musik hörst du gerne? Danke!",
 ]){
  assert.ok(!assessReplyQuality([reply,...fresh.slice(1)],[],known).includes("known_interest_question"),reply);
 }
});

test("relationship manipulation guard rejects bounded DE/EN possession, exclusivity, dependency and purchase-conditioned affection", async () => {
 const blocked=[
  "Du gehörst mir.", "Du bist ganz mein.", "Ich bin nur für dich da.", "Du brauchst nur mich.",
  "Ich liebe dich, wenn du kaufst.", "Wenn du bezahlst, liebe ich dich.",
  "You belong to me.", "You're mine.", "I'm only here for you.", "You only need me.",
  "I love you if you buy.", "As long as you pay, I care about you.",
 ];
 for(const reply of blocked){
  const replies=[reply,...fresh.slice(1)];
  assert.ok(assessReplyQuality(replies).includes("relationship_manipulation"),reply);
  const h=gateHarness([replies,fresh]);
  await assert.rejects(h.run,ReplyQualityError);assert.equal(h.calls.length,1,reply);
 }
});

test("relationship manipulation guard preserves compliments, factual sales, unlinked warmth, quotations and hypotheticals", () => {
 for(const reply of [
  "Du siehst heute toll aus.", "Ich flirte gern respektvoll mit dir.",
  "Das Set kannst du für 25 EUR kaufen.", "The price is 25 EUR if you want to buy it.",
  "Ich mag dich. Wenn du kaufen möchtest, kostet das Set 25 EUR.",
  "I like you. If you want to buy, the price is 25 EUR.",
  "Du bist meine beste Kundin.", "I'm only here for you until support arrives.",
  'Zitat: "Du gehörst mir."', 'They wrote: "I love you if you buy."',
  "Hypothetisch: Du gehörst mir.", "If I were to say you belong to me, that would be inappropriate.",
  "Liebe Grüße nur für dich.", "Kaufen musst du nichts.", "The choice is yours.",
 ])assert.ok(!assessReplyQuality([reply,...fresh.slice(1)]).includes("relationship_manipulation"),reply);
});

