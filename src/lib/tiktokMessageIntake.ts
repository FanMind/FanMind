import { createMetaWebhookConversationMessage } from "@/lib/supabase/server";

export type TikTokMessageIntakeEvent = {
  sourcePlatform: "tiktok";
  sourceType: "tiktok_messages";
  content: string | null;
  externalThreadId: string | null;
  externalMessageId: string | null;
  senderId: string | null;
  recipientId: string | null;
  authorLabel: string;
  sourceUrl: string | null;
  replyTargetUrl: string | null;
  receivedAt: string | null;
  rawEvent: unknown;
};

export function extractTikTokMessageIntakeEvents(payload: unknown): TikTokMessageIntakeEvent[] {
  const candidates = collectMessageCandidates(payload);

  return candidates.map((message) => {
    const sender = isRecord(message.sender) ? message.sender : undefined;
    const recipient = isRecord(message.recipient) ? message.recipient : undefined;
    const externalThreadId = stringValue(message.conversation_id) ?? stringValue(message.thread_id);
    const externalMessageId = stringValue(message.message_id) ?? stringValue(message.id);
    const senderId =
      stringValue(message.sender_id) ??
      stringValue(message.sender_username) ??
      stringValue(sender?.id) ??
      stringValue(sender?.username) ??
      stringValue(sender?.display_name);
    const recipientId =
      stringValue(message.recipient_id) ??
      stringValue(message.recipient_username) ??
      stringValue(recipient?.id) ??
      stringValue(recipient?.username) ??
      stringValue(recipient?.display_name);
    const content = stringValue(message.text) ?? stringValue(message.content) ?? stringValue(message.message_text);
    const authorLabel =
      stringValue(message.sender_username) ??
      stringValue(message.sender_id) ??
      stringValue(sender?.display_name) ??
      stringValue(sender?.username) ??
      stringValue(sender?.id) ??
      "TikTok Nutzer";
    const sourceUrl = validHttpUrl(stringValue(message.source_url));
    const replyTargetUrl = validHttpUrl(stringValue(message.reply_target_url) ?? sourceUrl);

    return {
      sourcePlatform: "tiktok",
      sourceType: "tiktok_messages",
      content,
      externalThreadId,
      externalMessageId,
      senderId,
      recipientId,
      authorLabel,
      sourceUrl,
      replyTargetUrl,
      receivedAt: stringValue(message.created_at) ?? stringValue(message.create_time) ?? stringValue(message.timestamp),
      rawEvent: message,
    };
  });
}

export async function processTikTokMessageIntakePayload(input: { workspaceId: string; payload: unknown }) {
  const events = extractTikTokMessageIntakeEvents(input.payload);
  let saved = 0;
  let skipped = 0;
  let firstError: string | undefined;

  for (const event of events) {
    if (!event.content) {
      skipped += 1;
      continue;
    }

    const result = await createMetaWebhookConversationMessage({
      workspaceId: input.workspaceId,
      senderId: event.senderId ?? event.authorLabel,
      sourcePlatform: "tiktok",
      authorLabel: event.authorLabel,
      content: event.content,
      messageType: "dm",
      sourceType: "tiktok_messages",
      sourceUrl: event.sourceUrl,
      replyTargetUrl: event.replyTargetUrl,
      externalThreadId: event.externalThreadId,
      externalMessageId: event.externalMessageId,
      originalAuthorLabel: event.authorLabel,
      originalTextExcerpt: event.content,
      receivedAt: event.receivedAt,
    });

    if (result.error) firstError ??= result.error.message;
    else saved += 1;
  }

  return { received: true, saved: saved > 0, skipped: skipped > 0, eventCount: events.length, error: firstError };
}

function collectMessageCandidates(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];
  for (const key of ["messages", "conversations", "data", "items", "results"]) {
    const value = payload[key];
    if (Array.isArray(value)) return value.filter(isRecord);
  }
  const nestedData = isRecord(payload.data) ? payload.data : undefined;
  if (Array.isArray(nestedData?.messages)) return nestedData.messages.filter(isRecord);
  return [payload];
}

function validHttpUrl(value: string | null): string | null {
  return value && /^https?:\/\//i.test(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
