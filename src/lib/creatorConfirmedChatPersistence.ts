import "server-only";
import { cookies } from "next/headers";
import {
  getSupabaseHeaders,
  getSupabaseRestUrl,
  SUPABASE_ACCESS_TOKEN_COOKIE,
} from "@/lib/supabase/config";
import {
  normalizeConfirmedChatLearning,
  type ConfirmedChatLearningRecord,
} from "@/lib/creatorConfirmedChatLearning.mjs";
import { creatorUuid, CreatorPolicyError } from "@/lib/creatorIntelligencePolicy.mjs";

function bindConfirmedActor(value: unknown, actorId: string): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  const outbound = record.outbound;
  if (!outbound || typeof outbound !== "object" || Array.isArray(outbound)) return value;
  return {
    ...record,
    outbound: { ...(outbound as Record<string, unknown>), confirmedBy: actorId },
  };
}

function assertAuthorizedScope(
  record: ConfirmedChatLearningRecord,
  workspaceId: string,
  contactId: string,
): void {
  if (
    record.proposal.workspaceId !== workspaceId ||
    record.proposal.contactId !== contactId
  ) {
    throw new CreatorPolicyError("learning_authorization_scope_mismatch");
  }
}

export async function persistConfirmedChatLearning(
  workspaceId: string,
  contactId: string,
  actorId: string,
  value: unknown,
  accessToken?: string,
): Promise<string> {
  creatorUuid(workspaceId);
  creatorUuid(contactId);
  const normalizedActor = creatorUuid(actorId);
  const normalized = normalizeConfirmedChatLearning(
    bindConfirmedActor(value, normalizedActor),
  );
  assertAuthorizedScope(normalized, workspaceId, contactId);

  const token =
    accessToken ?? (await cookies()).get(SUPABASE_ACCESS_TOKEN_COOKIE)?.value;
  if (!token) throw new Error("creator_learning_auth_required");

  const response = await fetch(
    getSupabaseRestUrl("rpc/record_creator_confirmed_chat_learning"),
    {
      method: "POST",
      headers: {
        ...getSupabaseHeaders(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_workspace_id: workspaceId,
        p_contact_id: contactId,
        p_record: normalized,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    },
  );
  if (!response.ok) throw new Error("creator_learning_persistence_unavailable");
  return creatorUuid(await response.json());
}
