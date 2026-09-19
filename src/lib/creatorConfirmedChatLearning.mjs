// Pure validation/measurement for confirmed-chat learning. This module performs
// no persistence, provider call, message send, or automatic profile update.
import { creatorUuid, CreatorPolicyError } from "./creatorIntelligencePolicy.mjs";

const VARIANTS = Object.freeze(["recommended", "softer", "stronger"]);

function requireCondition(condition, code) {
  if (!condition) throw new CreatorPolicyError(code);
}

function boundedText(value, maximum, code, required = true) {
  requireCondition(typeof value === "string" && value.length <= maximum, code);
  const normalized = value.trim();
  requireCondition(!required || normalized.length > 0, code);
  return normalized;
}

function timestamp(value, code) {
  const normalized = boundedText(value, 40, code);
  requireCondition(Number.isFinite(Date.parse(normalized)), code);
  return normalized;
}

function identity(row, prefix) {
  requireCondition(row && typeof row === "object" && !Array.isArray(row), `${prefix}_required`);
  return {
    workspaceId: creatorUuid(row.workspaceId),
    creatorId: creatorUuid(row.creatorId),
    contactId: creatorUuid(row.contactId),
    conversationId: creatorUuid(row.conversationId),
  };
}

function requireSameIdentity(expected, actual, code) {
  requireCondition(
    expected.workspaceId === actual.workspaceId &&
      expected.creatorId === actual.creatorId &&
      expected.contactId === actual.contactId &&
      expected.conversationId === actual.conversationId,
    code,
  );
}

function editDistance(left, right) {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length];
}

export function normalizeConfirmedChatLearning(value) {
  requireCondition(value && typeof value === "object" && !Array.isArray(value), "learning_record_required");
  const proposal = value.proposal;
  const scope = identity(proposal, "proposal");
  const normalizedProposal = {
    ...scope,
    proposalId: creatorUuid(proposal.proposalId),
    generationId: creatorUuid(proposal.generationId),
    creatorRevision: Number.isSafeInteger(proposal.creatorRevision) && proposal.creatorRevision > 0
      ? proposal.creatorRevision
      : null,
    promptRevision: boundedText(proposal.promptRevision, 120, "invalid_prompt_revision"),
    selectedVariant: VARIANTS.includes(proposal.selectedVariant) ? proposal.selectedVariant : null,
    proposedText: boundedText(proposal.proposedText, 4000, "invalid_proposed_text"),
    generatedAt: timestamp(proposal.generatedAt, "invalid_generated_at"),
  };
  requireCondition(normalizedProposal.creatorRevision !== null, "invalid_creator_revision");
  requireCondition(normalizedProposal.selectedVariant !== null, "invalid_selected_variant");

  // Selecting or copying a draft is deliberately not a confirmed outbound.
  if (value.outbound === null || value.outbound === undefined) {
    requireCondition(value.reaction == null && value.purchase == null, "outcome_without_confirmed_outbound");
    return { proposal: normalizedProposal, outbound: null, reaction: null, purchase: null, metrics: null };
  }

  const outboundScope = identity(value.outbound, "outbound");
  requireSameIdentity(scope, outboundScope, "outbound_scope_mismatch");
  const outbound = {
    ...outboundScope,
    messageId: creatorUuid(value.outbound.messageId),
    actualText: boundedText(value.outbound.actualText, 4000, "invalid_outbound_text"),
    confirmedAt: timestamp(value.outbound.confirmedAt, "invalid_outbound_confirmation"),
    confirmedBy: creatorUuid(value.outbound.confirmedBy),
  };
  requireCondition(Date.parse(outbound.confirmedAt) >= Date.parse(normalizedProposal.generatedAt), "outbound_before_proposal");

  let reaction = null;
  if (value.reaction !== null && value.reaction !== undefined) {
    const reactionScope = identity(value.reaction, "reaction");
    requireSameIdentity(scope, reactionScope, "reaction_scope_mismatch");
    reaction = {
      ...reactionScope,
      messageId: creatorUuid(value.reaction.messageId),
      reactedToMessageId: creatorUuid(value.reaction.reactedToMessageId),
      occurredAt: timestamp(value.reaction.occurredAt, "invalid_reaction_time"),
    };
    requireCondition(reaction.reactedToMessageId === outbound.messageId, "reaction_outbound_mismatch");
    requireCondition(Date.parse(reaction.occurredAt) >= Date.parse(outbound.confirmedAt), "reaction_before_outbound");
  }

  let purchase = null;
  if (value.purchase !== null && value.purchase !== undefined) {
    const purchaseScope = identity(value.purchase, "purchase");
    requireSameIdentity(scope, purchaseScope, "purchase_scope_mismatch");
    purchase = {
      ...purchaseScope,
      commercialEventId: creatorUuid(value.purchase.commercialEventId),
      evidenceReference: boundedText(value.purchase.evidenceReference, 200, "purchase_evidence_required"),
      occurredAt: timestamp(value.purchase.occurredAt, "invalid_purchase_time"),
    };
    requireCondition(value.purchase.kind === "purchase", "invalid_purchase_event");
    requireCondition(Date.parse(purchase.occurredAt) >= Date.parse(outbound.confirmedAt), "purchase_before_outbound");
  }

  const distance = editDistance(normalizedProposal.proposedText, outbound.actualText);
  const denominator = Math.max(normalizedProposal.proposedText.length, outbound.actualText.length, 1);
  return {
    proposal: normalizedProposal,
    outbound,
    reaction,
    purchase,
    metrics: {
      editDistance: distance,
      editRatio: Number((distance / denominator).toFixed(4)),
      unchanged: distance === 0,
      reactionKnown: reaction !== null,
      purchaseKnown: purchase !== null,
    },
  };
}

export function summarizeConfirmedChatLearning(records) {
  requireCondition(Array.isArray(records), "learning_records_required");
  const normalized = records.map(normalizeConfirmedChatLearning);
  const confirmed = normalized.filter((record) => record.outbound !== null);
  const reactionKnown = confirmed.filter((record) => record.reaction !== null).length;
  const purchaseKnown = confirmed.filter((record) => record.purchase !== null).length;
  return {
    proposals: normalized.length,
    confirmedOutbounds: confirmed.length,
    unknownOutcomes: confirmed.length - reactionKnown,
    unknownPurchases: confirmed.length - purchaseKnown,
    meanEditRatio: confirmed.length === 0
      ? null
      : Number((confirmed.reduce((sum, record) => sum + record.metrics.editRatio, 0) / confirmed.length).toFixed(4)),
    // Counts only: these are observed links, never causal success or conversion claims.
    linkedReactions: reactionKnown,
    linkedPurchases: purchaseKnown,
  };
}
