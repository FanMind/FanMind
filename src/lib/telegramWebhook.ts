import {
  createMetaWebhookConversationMessage,
  findTelegramWebhookWorkspaceId,
} from "@/lib/supabase/server";

export type TelegramIncomingMessage = {
  platform: "telegram";
  externalUserId: string | null;
  chatId: string | null;
  username: string | null;
  displayName: string;
  messageText: string;
  receivedAt: string;
  messageId: string | null;
};

export type TelegramWebhookProcessResult = {
  received: boolean;
  saved: boolean;
  skipped: boolean;
  reason?: "unsupported" | "empty_text" | "no_workspace";
  errorCode?: "workspace_not_configured" | "message_persist_failed";
};

export async function processTelegramWebhookUpdate(
  update: unknown,
): Promise<TelegramWebhookProcessResult> {
  const mapped = mapTelegramTextMessage(update);

  if (!mapped) {
    return {
      received: true,
      saved: false,
      skipped: true,
      reason: "unsupported",
    };
  }

  if (!mapped.messageText.trim()) {
    return {
      received: true,
      saved: false,
      skipped: true,
      reason: "empty_text",
    };
  }

  const workspace = await findTelegramWebhookWorkspaceId();
  if (workspace.error || !workspace.workspaceId) {
    return {
      received: true,
      saved: false,
      skipped: true,
      reason: "no_workspace",
      errorCode: "workspace_not_configured",
    };
  }

  const saved = await createMetaWebhookConversationMessage({
    workspaceId: workspace.workspaceId,
    senderId: mapped.externalUserId ?? mapped.chatId,
    pageId: "FanMindBot",
    recipientId: "FanMindBot",
    sourcePlatform: "telegram",
    authorLabel: mapped.displayName,
    content: mapped.messageText,
    messageType: "dm",
    sourceType: "telegram_messages",
    externalMessageId: mapped.messageId,
    externalThreadId: mapped.chatId,
    originalAuthorLabel: mapped.displayName,
    originalTextExcerpt: mapped.messageText,
    messageKind: "text",
    receivedAt: mapped.receivedAt,
    direction: "inbound",
  });

  if (saved.error) {
    return {
      received: true,
      saved: false,
      skipped: false,
      errorCode: "message_persist_failed",
    };
  }

  return { received: true, saved: true, skipped: false };
}

export function mapTelegramTextMessage(
  update: unknown,
): TelegramIncomingMessage | null {
  if (!isRecord(update)) return null;
  const message = firstRecord(update.message, update.edited_message);
  if (!message) return null;
  const text = stringValue(message.text);
  if (text === null) return null;

  const from = isRecord(message.from) ? message.from : null;
  const chat = isRecord(message.chat) ? message.chat : null;
  const externalUserId = numberOrString(from?.id);
  const chatId = numberOrString(chat?.id);
  const username = stringValue(from?.username) ?? stringValue(chat?.username);
  const displayName = buildDisplayName(
    from,
    chat,
    username,
    externalUserId,
    chatId,
  );
  const date = numberOrString(message.date);
  const receivedAt = date
    ? new Date(Number(date) * 1000).toISOString()
    : new Date().toISOString();

  return {
    platform: "telegram",
    externalUserId,
    chatId,
    username,
    displayName,
    messageText: text,
    receivedAt,
    messageId: numberOrString(message.message_id),
  };
}

function buildDisplayName(
  from: Record<string, unknown> | null,
  chat: Record<string, unknown> | null,
  username: string | null,
  externalUserId: string | null,
  chatId: string | null,
): string {
  const firstName = stringValue(from?.first_name);
  const lastName = stringValue(from?.last_name);
  const title = stringValue(chat?.title);
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  return (
    fullName ||
    title ||
    (username ? `@${username}` : null) ||
    `Telegram Nutzer ${externalUserId ?? chatId ?? "unbekannt"}`
  );
}

function firstRecord(...values: unknown[]): Record<string, unknown> | null {
  return values.find(isRecord) ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberOrString(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}
