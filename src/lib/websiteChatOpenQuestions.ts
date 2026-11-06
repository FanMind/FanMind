import "server-only";
import { getSupabaseHeaders, getSupabaseRestUrl } from "@/lib/supabase/config";
import { classifyWebsiteChatUnanswered } from "@/lib/websiteChatUnanswered.mjs";
import type { WebsiteChatAssistantContext } from "@/lib/websiteChat";

// Best-effort persistence is deliberately not invoked until the migration is approved.
// Unique(workspace_id,inbound_message_id) makes retries idempotent.
export async function persistWebsiteChatOpenQuestionCandidate(
  context: WebsiteChatAssistantContext,
  reply: string,
): Promise<"not_candidate" | "recorded"> {
  if (!classifyWebsiteChatUnanswered(reply).candidate) return "not_candidate";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey) throw new Error("Website chat persistence unavailable");
  const response = await fetch(
    getSupabaseRestUrl("website_chat_open_questions?on_conflict=workspace_id,inbound_message_id"),
    {
      method: "POST",
      headers: {
        ...getSupabaseHeaders(serviceKey),
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify({
        workspace_id: context.workspaceId,
        conversation_id: context.conversationId,
        inbound_message_id: context.incomingMessageId,
        reason: "assistant_uncertainty",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    },
  );
  if (!response.ok) throw new Error("Website chat open question persistence failed");
  return "recorded";
}
