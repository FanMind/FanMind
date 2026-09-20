// Pure validation/measurement for confirmed-chat learning. This module performs
// no persistence, provider call, message send, or automatic profile update.
import { creatorUuid, CreatorPolicyError } from "./creatorIntelligencePolicy.mjs";

const VARIANTS = Object.freeze(["recommended", "softer", "stronger"]);
export const CONFIRMED_CHAT_MAX_GRAPHEMES = 512;
export const CONFIRMED_CHAT_MAX_RECORDS = 100;
export const CONFIRMED_CHAT_CLOCK_SKEW_MS = 30_000;
const segmenter = new Intl.Segmenter("und", { granularity: "grapheme" });

function requireCondition(condition, code) {
  if (!condition) throw new CreatorPolicyError(code);
}

function boundedText(value, maximum, code, required = true) {
  requireCondition(typeof value === "string" && value.length <= maximum, code);
  const normalized = value.trim();
  requireCondition(!required || normalized.length > 0, code);
  return normalized;
}

function revision(value, code) {
  requireCondition(Number.isSafeInteger(value) && value > 0, code);
  return value;
}

function validationClock(options = {}) {
  const now = options.now ?? Date.now();
  const clockSkewMs = options.clockSkewMs ?? CONFIRMED_CHAT_CLOCK_SKEW_MS;
  requireCondition(Number.isFinite(now) && now >= 0, "invalid_validation_time");
  requireCondition(Number.isSafeInteger(clockSkewMs) && clockSkewMs >= 0 && clockSkewMs <= CONFIRMED_CHAT_CLOCK_SKEW_MS, "invalid_clock_skew");
  return { now, clockSkewMs };
}

function timestamp(value, code, clock) {
  const normalized = boundedText(value, 40, code);
  const parsed = Date.parse(normalized);
  requireCondition(Number.isFinite(parsed) && parsed <= clock.now + clock.clockSkewMs, code);
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

function graphemes(value) {
  return [...segmenter.segment(value.normalize("NFC"))].map(({ segment }) => segment);
}

function measurableText(value, code) {
  const result = graphemes(value);
  requireCondition(result.length <= CONFIRMED_CHAT_MAX_GRAPHEMES, code);
  return result;
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

function requireProposalBinding(proposal, candidate, code) {
  requireCondition(
    candidate.proposalId === proposal.proposalId &&
      candidate.generationId === proposal.generationId &&
      candidate.creatorRevision === proposal.creatorRevision &&
      candidate.promptRevision === proposal.promptRevision,
    code,
  );
}

export function normalizeConfirmedChatLearning(value, options = {}) {
  requireCondition(value && typeof value === "object" && !Array.isArray(value), "learning_record_required");
  const clock = validationClock(options);
  const proposal = value.proposal;
  const scope = identity(proposal, "proposal");
  const normalizedProposal = {
    ...scope,
    proposalId: creatorUuid(proposal.proposalId),
    generationId: creatorUuid(proposal.generationId),
    creatorRevision: revision(proposal.creatorRevision, "invalid_creator_revision"),
    promptRevision: boundedText(proposal.promptRevision, 120, "invalid_prompt_revision"),
    selectedVariant: VARIANTS.includes(proposal.selectedVariant) ? proposal.selectedVariant : null,
    proposedText: boundedText(proposal.proposedText, 4000, "invalid_proposed_text"),
    generatedAt: timestamp(proposal.generatedAt, "invalid_generated_at", clock),
  };
  requireCondition(normalizedProposal.selectedVariant !== null, "invalid_selected_variant");

  if (value.outbound === null || value.outbound === undefined) {
    requireCondition(value.reaction == null && value.purchase == null, "outcome_without_confirmed_outbound");
    return { proposal: normalizedProposal, outbound: null, reaction: null, purchase: null, metrics: null };
  }

  const outboundScope = identity(value.outbound, "outbound");
  requireSameIdentity(scope, outboundScope, "outbound_scope_mismatch");
  const outbound = {
    ...outboundScope,
    messageId: creatorUuid(value.outbound.messageId),
    proposalId: creatorUuid(value.outbound.proposalId),
    generationId: creatorUuid(value.outbound.generationId),
    creatorRevision: revision(value.outbound.creatorRevision, "invalid_outbound_creator_revision"),
    promptRevision: boundedText(value.outbound.promptRevision, 120, "invalid_outbound_prompt_revision"),
    actualText: boundedText(value.outbound.actualText, 4000, "invalid_outbound_text"),
    confirmedAt: timestamp(value.outbound.confirmedAt, "invalid_outbound_confirmation", clock),
    confirmedBy: creatorUuid(value.outbound.confirmedBy),
  };
  requireProposalBinding(normalizedProposal, outbound, "outbound_proposal_mismatch");
  requireCondition(Date.parse(outbound.confirmedAt) >= Date.parse(normalizedProposal.generatedAt), "outbound_before_proposal");

  let reaction = null;
  if (value.reaction !== null && value.reaction !== undefined) {
    const reactionScope = identity(value.reaction, "reaction");
    requireSameIdentity(scope, reactionScope, "reaction_scope_mismatch");
    reaction = {
      ...reactionScope,
      messageId: creatorUuid(value.reaction.messageId),
      reactedToMessageId: creatorUuid(value.reaction.reactedToMessageId),
      occurredAt: timestamp(value.reaction.occurredAt, "invalid_reaction_time", clock),
    };
    requireCondition(reaction.reactedToMessageId === outbound.messageId, "reaction_outbound_mismatch");
    requireCondition(Date.parse(reaction.occurredAt) >= Date.parse(outbound.confirmedAt), "reaction_before_outbound");
  }

  let purchase = null;
  if (value.purchase !== null && value.purchase !== undefined) {
    const purchaseScope = identity(value.purchase, "purchase");
    requireSameIdentity(scope, purchaseScope, "purchase_scope_mismatch");
    const occurredAt = timestamp(value.purchase.occurredAt, "invalid_purchase_time", clock);
    requireCondition(value.purchase.kind === "purchase", "invalid_purchase_event");
    requireCondition(Date.parse(occurredAt) >= Date.parse(outbound.confirmedAt), "purchase_before_outbound");
    // A later purchase with no explicit evidence chain stays unlinked/unknown.
    if (value.purchase.attribution !== null && value.purchase.attribution !== undefined) {
      const attribution = value.purchase.attribution;
      requireCondition(attribution && typeof attribution === "object" && !Array.isArray(attribution), "purchase_attribution_required");
      const binding = {
        proposalId: creatorUuid(attribution.proposalId),
        generationId: creatorUuid(attribution.generationId),
        creatorRevision: revision(attribution.creatorRevision, "invalid_purchase_creator_revision"),
        promptRevision: boundedText(attribution.promptRevision, 120, "invalid_purchase_prompt_revision"),
      };
      requireProposalBinding(normalizedProposal, binding, "purchase_proposal_mismatch");
      requireCondition(creatorUuid(attribution.outboundMessageId) === outbound.messageId, "purchase_outbound_mismatch");
      purchase = {
        ...purchaseScope,
        commercialEventId: creatorUuid(value.purchase.commercialEventId),
        evidenceReference: boundedText(attribution.evidenceReference, 200, "purchase_evidence_required"),
        occurredAt,
        attribution: { ...binding, outboundMessageId: outbound.messageId },
      };
    }
  }

  const proposedGraphemes = measurableText(normalizedProposal.proposedText, "proposed_text_not_measurable");
  const actualGraphemes = measurableText(outbound.actualText, "outbound_text_not_measurable");
  const distance = editDistance(proposedGraphemes, actualGraphemes);
  const denominator = Math.max(proposedGraphemes.length, actualGraphemes.length, 1);
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

function uniqueIds(records, selector, code) {
  const values = records.map(selector).filter(Boolean);
  requireCondition(new Set(values).size === values.length, code);
}

export function summarizeConfirmedChatLearning(records, expected, options = {}) {
  requireCondition(Array.isArray(records) && records.length <= CONFIRMED_CHAT_MAX_RECORDS, "learning_records_limit");
  const expectedScope = {
    workspaceId: creatorUuid(expected?.expectedWorkspaceId),
    creatorId: creatorUuid(expected?.expectedCreatorId),
  };
  const normalized = records.map((record) => normalizeConfirmedChatLearning(record, options));
  for (const record of normalized) {
    requireCondition(
      record.proposal.workspaceId === expectedScope.workspaceId && record.proposal.creatorId === expectedScope.creatorId,
      "learning_summary_scope_mismatch",
    );
  }
  uniqueIds(normalized, (record) => record.proposal.proposalId, "duplicate_proposal_id");
  uniqueIds(normalized, (record) => record.proposal.generationId, "duplicate_generation_id");
  uniqueIds(normalized, (record) => record.outbound?.messageId, "duplicate_outbound_message_id");
  uniqueIds(normalized, (record) => record.reaction?.messageId, "duplicate_reaction_message_id");
  uniqueIds(normalized, (record) => record.purchase?.commercialEventId, "duplicate_purchase_event_id");

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
    linkedReactions: reactionKnown,
    linkedPurchases: purchaseKnown,
  };
}
