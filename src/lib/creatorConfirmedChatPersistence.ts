import "server-only";

import { cookies } from "next/headers";
import { creatorUuid } from "@/lib/creatorIntelligencePolicy.mjs";
import { CONFIRMED_CHAT_MAX_GRAPHEMES } from "@/lib/creatorConfirmedChatLearning.mjs";
import {
  getSupabaseHeaders,
  getSupabaseRestUrl,
  SUPABASE_ACCESS_TOKEN_COOKIE,
} from "@/lib/supabase/config";

const VARIANTS = ["recommended", "softer", "stronger"] as const;
const MAX_TEXT_CODE_UNITS = 4_000;
const graphemeSegmenter = new Intl.Segmenter("und", { granularity: "grapheme" });
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

type OutboundEvidenceRow = {
  content?: unknown;
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

function measurableText(value: unknown, code: string): { raw: string; normalized: string } {
  const raw = typeof value === "string" ? value : "";
  if (!raw || raw.length > MAX_TEXT_CODE_UNITS) throw new Error(code);
  const normalized = raw.trim();
  if (!normalized) throw new Error(code);
  const graphemeCount = Array.from(
    graphemeSegmenter.segment(normalized.normalize("NFC")),
  ).length;
  if (graphemeCount > CONFIRMED_CHAT_MAX_GRAPHEMES) {
    throw new Error(code);
  }
  return { raw, normalized };
}

function measurableProposalText(value: unknown): string {
  return measurableText(value, "creator_learning_proposal_invalid").normalized;
}

function normalizeProposals(values: ProposalInput[]): ProposalInput[] {
  if (!Array.isArray(values) || values.length !== 3) {
    throw new Error("creator_learning_three_proposals_required");
  }
  const seen = new Set<string>();
  const normalized = values.map((value) => {
    const selectedVariant = value?.selectedVariant;
    const proposedText = measurableProposalText(value?.proposedText);
    if (!VARIANTS.includes(selectedVariant) || seen.has(selectedVariant)) {
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

async function readMeasurableOutboundText(input: {
  workspaceId: string;
  contactId: string;
  outboundMessageId: string;
  token: string;
}): Promise<string> {
  const query = new URLSearchParams({
    select: "content",
    id: `eq.${input.outboundMessageId}`,
    workspace_id: `eq.${input.workspaceId}`,
    contact_id: `eq.${input.contactId}`,
    direction: "eq.outbound",
    creator_learning_manual_send: "eq.true",
    limit: "2",
  });
  const response = await fetch(
    getSupabaseRestUrl(`conversation_messages?${query.toString()}`),
    {
      method: "GET",
      headers: getSupabaseHeaders(input.token),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    },
  ).catch(() => null);
  if (!response?.ok) throw new Error("creator_learning_persistence_unavailable");
  const rows = await response.json() as OutboundEvidenceRow[];
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error("creator_learning_outbound_evidence_mismatch");
  }
  return measurableText(
    rows[0]?.content,
    "creator_learning_outbound_evidence_mismatch",
  ).raw;
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
  actorUserId: string;
  accessToken?: string;
}): Promise<{ proposalId: string; outboundMessageId: string; confirmed: boolean }> {
  requireLearningEnabled();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey) throw new Error("creator_learning_service_unavailable");
  const workspaceId = creatorUuid(input.workspaceId);
  const contactId = creatorUuid(input.contactId);
  const proposalId = creatorUuid(input.proposalId);
  const outboundMessageId = creatorUuid(input.outboundMessageId);
  const actorUserId = creatorUuid(input.actorUserId);
  const token = await accessToken(input.accessToken);
  const expectedActualText = await readMeasurableOutboundText({
    workspaceId,
    contactId,
    outboundMessageId,
    token,
  });
  return rpc(
    "confirm_creator_confirmed_chat_outbound",
    serviceKey,
    {
      p_workspace_id: workspaceId,
      p_contact_id: contactId,
      p_proposal_id: proposalId,
      p_outbound_message_id: outboundMessageId,
      p_actor_user_id: actorUserId,
      p_expected_actual_text: expectedActualText,
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
