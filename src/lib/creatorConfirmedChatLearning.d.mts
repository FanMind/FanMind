export type ConfirmedChatIdentity = {
  workspaceId: string;
  creatorId: string;
  contactId: string;
  conversationId: string;
};

export type ConfirmedChatProposal = ConfirmedChatIdentity & {
  proposalId: string;
  generationId: string;
  creatorRevision: number;
  promptRevision: string;
  selectedVariant: "recommended" | "softer" | "stronger";
  proposedText: string;
  generatedAt: string;
};

export type ConfirmedChatOutbound = ConfirmedChatIdentity & {
  messageId: string;
  proposalId: string;
  generationId: string;
  creatorRevision: number;
  promptRevision: string;
  actualText: string;
  confirmedAt: string;
  confirmedBy: string;
};

export type ConfirmedChatReaction = ConfirmedChatIdentity & {
  messageId: string;
  reactedToMessageId: string;
  occurredAt: string;
};

export type ConfirmedChatPurchase = ConfirmedChatIdentity & {
  commercialEventId: string;
  evidenceReference: string;
  occurredAt: string;
  attribution: {
    proposalId: string;
    generationId: string;
    creatorRevision: number;
    promptRevision: string;
    outboundMessageId: string;
  };
};

export type ConfirmedChatLearningRecord = {
  proposal: ConfirmedChatProposal;
  outbound: ConfirmedChatOutbound | null;
  reaction: ConfirmedChatReaction | null;
  purchase: ConfirmedChatPurchase | null;
  metrics: {
    editDistance: number;
    editRatio: number;
    unchanged: boolean;
    reactionKnown: boolean;
    purchaseKnown: boolean;
  } | null;
};

export const CONFIRMED_CHAT_MAX_GRAPHEMES: number;
export const CONFIRMED_CHAT_MAX_RECORDS: number;
export const CONFIRMED_CHAT_CLOCK_SKEW_MS: number;

export function normalizeConfirmedChatLearning(
  value: unknown,
  options?: { now?: number; clockSkewMs?: number },
): ConfirmedChatLearningRecord;

export function summarizeConfirmedChatLearning(
  records: unknown[],
  expected: { expectedWorkspaceId: string; expectedCreatorId: string },
  options?: { now?: number; clockSkewMs?: number },
): {
  proposals: number;
  confirmedOutbounds: number;
  unknownOutcomes: number;
  unknownPurchases: number;
  meanEditRatio: number | null;
  linkedReactions: number;
  linkedPurchases: number;
};
