import "server-only";

import { cookies } from "next/headers";
import { creatorUuid } from "@/lib/creatorIntelligencePolicy.mjs";
import {
  getSupabaseHeaders,
  getSupabaseRestUrl,
  SUPABASE_ACCESS_TOKEN_COOKIE,
} from "@/lib/supabase/config";

const VARIANTS = ["recommended", "softer", "stronger"] as const;
type CreatorLearningVariant = (typeof VARIANTS)[number];

type ProposalInput = {
  selectedVariant: CreatorLearningVariant;
  proposedText: string;
};

type RegisteredProposal = {
  proposalId: string;
  generationId: string;
  selectedVariant: CreatorLearningVariant;
};

export function creatorConfirmedChatLearningEnabled(): boolean {
  return process.env.FANMIND_CREATOR_CONFIRMED_CHAT_LEARNING_ENABLED === "true";
}

function requireLearningEnabled(): void {
  if (!creatorConfirmedChatLearningEnabled()) {
    throw new Error("creator_learning_rollout_pending");
  }
}

function normalizePromptRevision(value: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 120) {
    throw new Error("creator_learning_prompt_revision_invalid");
  }
  return normalized;
}

function normalizeProposals(values: ProposalInput[]): ProposalInput[] {
  if (!Array.isArray(values) || values.length !== 3) {
    throw new Error("creator_learning_three_proposals_required");
  }
  const seen = new Set<string>();
  const normalized = values.map((value) => {
    const selectedVariant = value?.selectedVariant;
    const proposedText = typeof value?.proposedText === "string" ? value.proposedText.trim() : "";
    if (!VARIANTS.includes(selectedVariant) || seen.has(selectedVariant) || !proposedText || proposedText.length > 4000) {
      throw new Error("creator_learning_proposal_invalid");
    }
    seen.add(selectedVariant);
    return { selectedVariant, proposedText };
  });
  if (seen.size !== VARIANTS.length || VARIANTS.some((variant) => !seen.has(variant))) {
    throw new Error("creator_learning_variants_incomplete");
  }
  return normalized;
}

async function accessToken(explicit?: string): Promise<string> {
  const direct = explicit?.trim();
  if (direct) return direct;
  const fromCookie = (await cookies()).get(SUPABASE_ACCESS_TOKEN_COOKIE)?.value?.trim();
  if (!fromCookie) throw new Error("creator_learning_auth_required");
  return fromCookie;
}

async function rpc<T>(name: string, token: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(getSupabaseRestUrl(`rpc/${name}`), {
    method: "POST",
    headers: {
      ...getSupabaseHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  }).catch(() => null);
  if (!response?.ok) throw new Error("creator_learning_persistence_unavailable");
  return await response.json() as T;
}

// Server-only proposal capture. The SQL contract grants this RPC only to
// service_role, so browsers cannot mint proposal/generation identities. This
// helper is intentionally not wired into reply generation until the controlled
// schema and rollout flag are independently accepted on the target.
export async function registerCreatorConfirmedChatProposals(input: {
  workspaceId: string;
  contactId: string;
  conversationId: string;
  creatorId: string;
  creatorRevision: number;
  promptRevision: string;
  proposals: ProposalInput[];
}): Promise<RegisteredProposal[]> {
  requireLearningEnabled();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey) throw new Error("creator_learning_service_unavailable");
  const workspaceId = creatorUuid(input.workspaceId);
  const contactId = creatorUuid(input.contactId);
  const conversationId = creatorUuid(input.conversationId);
  const creatorId = creatorUuid(input.creatorId);
  if (!Number.isSafeInteger(input.creatorRevision) || input.creatorRevision <= 0) {
    throw new Error("creator_learning_creator_revision_invalid");
  }
  const promptRevision = normalizePromptRevision(input.promptRevision);
  const proposals = normalizeProposals(input.proposals);
  const result = await rpc<RegisteredProposal[]>(
    "record_creator_confirmed_chat_proposals",
    serviceKey,
    {
      p_workspace_id: workspaceId,
      p_contact_id: contactId,
      p_conversation_id: conversationId,
      p_creator_id: creatorId,
      p_creator_revision: input.creatorRevision,
      p_prompt_revision: promptRevision,
      p_proposals: proposals,
    },
  );
  if (!Array.isArray(result) || result.length !== 3) {
    throw new Error("creator_learning_persistence_invalid_response");
  }
  for (const row of result) {
    creatorUuid(row?.proposalId);
    creatorUuid(row?.generationId);
    if (!VARIANTS.includes(row?.selectedVariant)) {
      throw new Error("creator_learning_persistence_invalid_response");
    }
  }
  return result;
}

export async function confirmCreatorConfirmedChatOutbound(input: {
  workspaceId: string;
  contactId: string;
  proposalId: string;
  outboundMessageId: string;
  accessToken?: string;
}): Promise<{ proposalId: string; outboundMessageId: string; confirmed: boolean }> {
  requireLearningEnabled();
  const workspaceId = creatorUuid(input.workspaceId);
  const contactId = creatorUuid(input.contactId);
  const proposalId = creatorUuid(input.proposalId);
  const outboundMessageId = creatorUuid(input.outboundMessageId);
  return rpc(
    "confirm_creator_confirmed_chat_outbound",
    await accessToken(input.accessToken),
    {
      p_workspace_id: workspaceId,
      p_contact_id: contactId,
      p_proposal_id: proposalId,
      p_outbound_message_id: outboundMessageId,
    },
  );
}

export async function linkCreatorConfirmedChatOutcomes(input: {
  workspaceId: string;
  contactId: string;
  proposalId: string;
  reactionMessageId?: string | null;
  purchaseEventId?: string | null;
  accessToken?: string;
}): Promise<{ proposalId: string; reactionLinked: boolean; purchaseLinked: boolean }> {
  requireLearningEnabled();
  const reactionMessageId = input.reactionMessageId ? creatorUuid(input.reactionMessageId) : null;
  const purchaseEventId = input.purchaseEventId ? creatorUuid(input.purchaseEventId) : null;
  if (!reactionMessageId && !purchaseEventId) {
    throw new Error("creator_learning_outcome_required");
  }
  return rpc(
    "link_creator_confirmed_chat_outcomes",
    await accessToken(input.accessToken),
    {
      p_workspace_id: creatorUuid(input.workspaceId),
      p_contact_id: creatorUuid(input.contactId),
      p_proposal_id: creatorUuid(input.proposalId),
      p_reaction_message_id: reactionMessageId,
      p_purchase_event_id: purchaseEventId,
    },
  );
}
