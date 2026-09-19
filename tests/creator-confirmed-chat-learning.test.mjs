import assert from "node:assert/strict";
import test from "node:test";
import { normalizeConfirmedChatLearning, summarizeConfirmedChatLearning } from "../src/lib/creatorConfirmedChatLearning.mjs";

const ids = {
  workspaceId: "11111111-1111-4111-8111-111111111111",
  creatorId: "22222222-2222-4222-8222-222222222222",
  contactId: "33333333-3333-4333-8333-333333333333",
  conversationId: "44444444-4444-4444-8444-444444444444",
};
const proposal = {
  ...ids,
  proposalId: "55555555-5555-4555-8555-555555555555",
  generationId: "66666666-6666-4666-8666-666666666666",
  creatorRevision: 7,
  promptRevision: "workspace-prompt:3",
  selectedVariant: "recommended",
  proposedText: "Hey, wie war dein Tag?",
  generatedAt: "2026-09-19T10:00:00Z",
};
const outbound = {
  ...ids,
  messageId: "77777777-7777-4777-8777-777777777777",
  actualText: "Hey! Wie war dein Tag?",
  confirmedAt: "2026-09-19T10:02:00Z",
  confirmedBy: "88888888-8888-4888-8888-888888888888",
};

test("a selected proposal is not treated as an outbound or success", () => {
  const result = normalizeConfirmedChatLearning({ proposal, outbound: null, reaction: null, purchase: null });
  assert.equal(result.outbound, null);
  assert.equal(result.metrics, null);
  assert.throws(() => normalizeConfirmedChatLearning({ proposal, outbound: null, reaction: { ...ids } }), /outcome_without_confirmed_outbound/);
});

test("confirmed edited outbound records deterministic edit metrics and nullable outcomes", () => {
  const result = normalizeConfirmedChatLearning({ proposal, outbound, reaction: null, purchase: null });
  assert.equal(result.metrics.unchanged, false);
  assert.ok(result.metrics.editDistance > 0);
  assert.equal(result.metrics.reactionKnown, false);
  assert.equal(result.metrics.purchaseKnown, false);
  assert.equal(result.reaction, null);
  assert.equal(result.purchase, null);
});

test("reaction and purchase require explicit same-scope evidence after the outbound", () => {
  const reaction = {
    ...ids,
    messageId: "99999999-9999-4999-8999-999999999999",
    reactedToMessageId: outbound.messageId,
    occurredAt: "2026-09-19T10:03:00Z",
  };
  const purchase = {
    ...ids,
    commercialEventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    kind: "purchase",
    evidenceReference: "synthetic-order-42",
    occurredAt: "2026-09-19T10:04:00Z",
  };
  const result = normalizeConfirmedChatLearning({ proposal, outbound, reaction, purchase });
  assert.equal(result.metrics.reactionKnown, true);
  assert.equal(result.metrics.purchaseKnown, true);

  for (const key of ["workspaceId", "creatorId", "contactId", "conversationId"]) {
    assert.throws(
      () => normalizeConfirmedChatLearning({ proposal, outbound: { ...outbound, [key]: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" } }),
      /outbound_scope_mismatch/,
    );
  }
  assert.throws(() => normalizeConfirmedChatLearning({ proposal, outbound, reaction: { ...reaction, reactedToMessageId: proposal.proposalId } }), /reaction_outbound_mismatch/);
  assert.throws(() => normalizeConfirmedChatLearning({ proposal, outbound, purchase: { ...purchase, evidenceReference: "" } }), /purchase_evidence_required/);
  assert.throws(() => normalizeConfirmedChatLearning({ proposal, outbound, purchase: { ...purchase, kind: "offer" } }), /invalid_purchase_event/);
});

test("summary keeps unknown reaction and purchase separate from linked evidence", () => {
  const untouched = { ...proposal, proposalId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", proposedText: outbound.actualText };
  const summary = summarizeConfirmedChatLearning([
    { proposal, outbound: null, reaction: null, purchase: null },
    { proposal: untouched, outbound, reaction: null, purchase: null },
  ]);
  assert.deepEqual(summary, {
    proposals: 2,
    confirmedOutbounds: 1,
    unknownOutcomes: 1,
    unknownPurchases: 1,
    meanEditRatio: 0,
    linkedReactions: 0,
    linkedPurchases: 0,
  });
});
