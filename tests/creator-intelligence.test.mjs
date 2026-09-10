import assert from "node:assert/strict";
import test from "node:test";
import { buildCreatorReplyContext, defaultCreatorBundle, deriveCreatorStrategy, normalizeCreatorFanReview, normalizeCreatorBundle, validateCreatorReplyOptions } from "../src/lib/creatorIntelligencePolicy.mjs";
import { buildBoundedReplySuggestionContext } from "../src/lib/aiExecutionPolicy.mjs";

const workspace = "11111111-1111-4111-8111-111111111111";
const otherWorkspace = "22222222-2222-4222-8222-222222222222";
const creatorId = "33333333-3333-4333-8333-333333333333";
const contact = "44444444-4444-4444-8444-444444444444";
const now = Date.parse("2026-09-10T12:00:00Z");
const date = new Date(now - 3600000).toISOString();
function bundle(name = "Sophie") {
  const value = defaultCreatorBundle();
  value.id = creatorId; value.revision = 1;
  value.persona.displayName = name; value.persona.status = "active";
  value.voice.tone = "warm, verspielt";
  value.voice.goodExamples = ["Hey, wie war dein Tag? ☀️", "Das freut mich richtig!", "Erzähl mir mehr davon 😊"];
  value.voice.avoidedPhrases = ["geschätzter Kunde"];
  value.approve = true;
  return value;
}
function offer(patch = {}) {
  return { id: "photos", name: "Foto-Set", category: "photos", description: "Freigegebenes Set", currency: "EUR", minimumPriceMinor: 1000, recommendedPriceMinor: 2000, maximumPriceMinor: 3000, maximumDiscountPercent: 10, delivery: "", exclusivity: "", requiresConfirmation: false, active: true, ...patch };
}
function rows(value = bundle(), ws = workspace) {
  return {
    workspaceId: ws, contactId: contact, creatorId,
    creator: { workspace_id: ws, id: creatorId, display_name: value.persona.displayName, bio: "", public_age: null, location: "", languages: ["de"], platforms: [], status: "active", revision: 1, internal_notes: "PRIVATE NEVER IN PROMPT" },
    voice: { workspace_id: ws, creator_id: creatorId, fingerprint: value.voice, revision: 1, approved_by: ws, approved_at: date },
    playbook: { workspace_id: ws, creator_id: creatorId, rules: value.playbook, revision: 1, approved_by: ws, approved_at: date },
    commercial: {}, events: [], now,
  };
}
const reviewed = { reviewStatus: "confirmed", reviewedAt: date, sourceReference: "manual interaction review", engagementScore: 80, purchaseIntentScore: 90, offerFatigue: 10, offerRequested: true, requestedOfferId: "photos" };
function event(kind, patch = {}) { return { workspace_id: workspace, creator_id: creatorId, contact_id: contact, kind, occurred_at: date, confirmed_at: date, confirmed_by: workspace, ...patch }; }

test("independent Creator accounts produce distinct complete voice contexts for the same inbound message", () => {
  const sophie = buildCreatorReplyContext(rows());
  const other = bundle("Mara"); other.voice.tone = "ruhig und knapp"; other.voice.warmth = 25; other.voice.preferredEmojis = []; other.voice.goodExamples = ["Hallo. Was interessiert dich?", "Danke dir.", "Ich melde mich morgen."];
  const mara = buildCreatorReplyContext(rows(other, otherWorkspace));
  const first = buildBoundedReplySuggestionContext({ incomingMessage: "Wie geht es dir?", creatorContext: sophie });
  const second = buildBoundedReplySuggestionContext({ incomingMessage: "Wie geht es dir?", creatorContext: mara });
  assert.equal(first.context.incomingMessage, second.context.incomingMessage);
  assert.notDeepEqual(first.context.creatorContext.voice, second.context.creatorContext.voice);
  assert.equal(first.context.creatorContext.persona.displayName, "Sophie");
  assert.equal(second.context.creatorContext.persona.displayName, "Mara");
  assert.ok(!JSON.stringify(first.context).includes("PRIVATE NEVER"));
});

test("foreign voice/playbook/Creator and foreign commercial events fail closed", () => {
  for (const key of ["creator", "voice", "playbook"]) {
    const input = rows(); input[key].workspace_id = otherWorkspace;
    assert.throws(() => buildCreatorReplyContext(input), /creator_context_mismatch/);
  }
  assert.throws(() => buildCreatorReplyContext({ ...rows(), events: [event("purchase", { contact_id: otherWorkspace })] }), /creator_event_mismatch/);
});

test("draft, revoked, stale and paused profiles cannot fall back to a chatter voice", () => {
  for (const key of ["voice", "playbook"]) {
    const missing = rows(); missing[key].approved_at = null;
    assert.throws(() => buildCreatorReplyContext(missing), /creator_review_required/);
    const stale = rows(); stale[key].revision = 2;
    assert.throws(() => buildCreatorReplyContext(stale), /creator_review_required/);
  }
  const paused = rows(); paused.creator.status = "paused";
  assert.throws(() => buildCreatorReplyContext(paused), /creator_not_active/);
});

test("approval needs real examples; malformed data, range violations and duplicate offers reject", () => {
  const noExamples = bundle(); noExamples.voice.goodExamples = [];
  assert.throws(() => normalizeCreatorBundle(noExamples), /creator_examples_required/);
  const price = bundle(); price.playbook.offers = [offer({ minimumPriceMinor: 2100 })];
  assert.throws(() => normalizeCreatorBundle(price), /invalid_offer_price_range/);
  price.playbook.offers = [offer(), offer()];
  assert.throws(() => normalizeCreatorBundle(price), /duplicate_offer/);
  for (const invalid of [-1, 101, "50", NaN, 1.5]) {
    const value = bundle(); value.voice.warmth = invalid;
    assert.throws(() => normalizeCreatorBundle(value));
  }
});

test("unknown or unreviewed commercial scores stay unknown and cannot authorize selling", () => {
  const playbook = { ...bundle().playbook, offers: [offer()] };
  for (const commercial of [{}, { ...reviewed, reviewStatus: "unreviewed" }, { ...reviewed, sourceReference: "" }, { ...reviewed, reviewedAt: "2099-01-01" }]) {
    const result = deriveCreatorStrategy({ playbook, commercial, now });
    assert.equal(result.sellNow, false); assert.equal(result.purchaseIntent, null); assert.equal(result.offerFatigue, null);
  }
});

test("confirmed purchase prioritizes AFTERCARE even with very high purchase intent", () => {
  const result = deriveCreatorStrategy({ playbook: { ...bundle().playbook, offers: [offer()] }, commercial: reviewed, events: [event("purchase", { amount_minor: 25000 })], now });
  assert.equal(result.state, "AFTERCARE"); assert.equal(result.sellNow, false); assert.equal(result.offer, null);
});

test("fatigue, last offer, refusal, and sales hold override a requested offer", () => {
  const playbook = { ...bundle().playbook, offers: [offer()] };
  for (const patch of [{ events: [event("offer")] }, { events: [event("offer_declined")] }, { commercial: { ...reviewed, offerFatigue: 70 } }, { commercial: { ...reviewed, salesHold: true } }]) {
    const result = deriveCreatorStrategy({ playbook, commercial: reviewed, now, ...patch });
    assert.equal(result.sellNow, false); assert.equal(result.offer, null);
  }
});

test("only an explicitly requested, active, preapproved offer gets its server-owned price", () => {
  const playbook = { ...bundle().playbook, offers: [offer()] };
  const result = deriveCreatorStrategy({ playbook, commercial: reviewed, now });
  assert.equal(result.state, "OFFER"); assert.equal(result.offer.priceMinor, 2000);
  for (const patch of [{ requiresConfirmation: true }, { active: false }]) {
    assert.equal(deriveCreatorStrategy({ playbook: { ...playbook, offers: [offer(patch)] }, commercial: reviewed, now }).offer, null);
  }
  assert.equal(deriveCreatorStrategy({ playbook, commercial: { ...reviewed, requestedOfferId: "invented" }, now }).offer, null);
});

test("all three intensities retain the same voice and free text cannot supply prices", () => {
  const context = buildCreatorReplyContext(rows());
  const options = ["Hey, wie war dein Tag?", "Wenn du magst, erzähl mir davon.", "Was war heute dein Highlight?"].map((text) => ({ text }));
  assert.deepEqual(validateCreatorReplyOptions(options, context).map((option) => option.label), ["Recommended", "Softer", "Stronger"]);
  for (const bad of ["Für dich nur 1 €", "Just CHF 2", "Hallo, geschätzter Kunde!"]) {
    assert.throws(() => validateCreatorReplyOptions([{ text: bad }, ...options.slice(1)], context));
  }
});

test("total budget includes the complete Creator policy and never truncates boundaries", () => {
  const context = buildCreatorReplyContext(rows());
  const result = buildBoundedReplySuggestionContext({ incomingMessage: "Test", creatorContext: context, fanMemory: "a".repeat(10000), conversationSummary: "b".repeat(10000) });
  assert.equal(result.inputChars, JSON.stringify(result.context).length);
  assert.equal(result.context.fanMemory.length, 7000);
  assert.equal(result.context.conversationSummary.length, 4000);
  assert.throws(() => buildBoundedReplySuggestionContext({ creatorContext: { noGos: "x".repeat(18001) } }), /Creator context/);
});


test("commercial entry requires explicit confirmation, evidence, bounded scores and an actual purchase amount", () => {
  const commercial = { fanStage: "unknown", engagementScore: null, purchaseIntentScore: null, offerFatigue: null, salesHold: false, offerRequested: false, requestedOfferId: null, sourceReference: "synthetic-message", preferredContent: [], preferredStyle: "" };
  const input = { commercial, event: null, confirmed: true };
  assert.equal(normalizeCreatorFanReview(input, now).commercial.purchaseIntentScore, null);
  assert.throws(() => normalizeCreatorFanReview({ ...input, confirmed: false }, now), /confirmation_required/);
  assert.throws(() => normalizeCreatorFanReview({ ...input, commercial: { ...commercial, engagementScore: 101 } }, now));
  assert.throws(() => normalizeCreatorFanReview({ ...input, commercial: { ...commercial, sourceReference: "" } }, now));
  const purchase = { kind: "purchase", occurredAt: date, amountMinor: 25000, currency: "EUR", category: "photos", evidenceReference: "synthetic-order" };
  assert.equal(normalizeCreatorFanReview({ ...input, event: purchase }, now).event.amountMinor, 25000);
  assert.throws(() => normalizeCreatorFanReview({ ...input, event: { ...purchase, amountMinor: null, currency: null } }, now), /purchase_amount_required/);
  assert.throws(() => normalizeCreatorFanReview({ ...input, event: { ...purchase, occurredAt: "2099-01-01" } }, now), /invalid_event_date/);
  const untrusted = normalizeCreatorFanReview({ ...input, commercial: { ...commercial, reviewedBy: "forged", reviewedAt: "future" } }, now);
  assert.equal(untrusted.commercial.reviewedBy, undefined);
  assert.equal(untrusted.commercial.reviewedAt, undefined);
});

test("stale commercial reviews cannot authorize a fresh sales offer", () => {
  const result = deriveCreatorStrategy({ playbook: { ...bundle().playbook, offers: [offer()] }, commercial: { ...reviewed, reviewedAt: "2026-09-01T00:00:00Z" }, now });
  assert.equal(result.sellNow, false); assert.equal(result.purchaseIntent, null);
});
