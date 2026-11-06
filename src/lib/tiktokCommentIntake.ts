import { createMetaWebhookConversationMessage } from "@/lib/supabase/server";

export type TikTokCommentIntakeEvent = {
  sourcePlatform: "tiktok";
  sourceType: "tiktok_comments";
  content: string | null;
  externalCommentId: string | null;
  externalVideoId: string | null;
  externalPostId: string | null;
  externalThreadId: string | null;
  parentCommentId: string | null;
  likeCount: number | null;
  replyCount: number | null;
  sourceUrl: string | null;
  replyTargetUrl: string | null;
  authorLabel: string;
  receivedAt: string | null;
  rawEvent: unknown;
};

export function extractTikTokCommentIntakeEvents(payload: unknown): TikTokCommentIntakeEvent[] {
  const candidates = collectCommentCandidates(payload);

  return candidates.map((comment) => {
    const author = isRecord(comment.author) ? comment.author : undefined;
    const user = isRecord(comment.user) ? comment.user : undefined;
    const commentId = stringValue(comment.comment_id) ?? stringValue(comment.id);
    const videoId = stringValue(comment.video_id) ?? stringValue(comment.item_id) ?? stringValue(comment.aweme_id);
    const text = stringValue(comment.text) ?? stringValue(comment.comment_text) ?? stringValue(comment.content);
    const authorLabel =
      stringValue(comment.author_label) ??
      stringValue(comment.username) ??
      stringValue(comment.display_name) ??
      stringValue(author?.display_name) ??
      stringValue(author?.username) ??
      stringValue(user?.display_name) ??
      stringValue(user?.username) ??
      "TikTok Nutzer";
    const sourceUrl = validHttpUrl(stringValue(comment.source_url) ?? stringValue(comment.comment_url));
    const replyTargetUrl = validHttpUrl(
      stringValue(comment.reply_target_url) ??
        stringValue(comment.video_url) ??
        stringValue(comment.share_url) ??
        stringValue(comment.permalink_url) ??
        sourceUrl,
    );

    return {
      sourcePlatform: "tiktok",
      sourceType: "tiktok_comments",
      content: text,
      externalCommentId: commentId,
      externalVideoId: videoId,
      externalPostId: videoId,
      externalThreadId: videoId && commentId ? `${videoId}:${commentId}` : videoId ?? commentId,
      parentCommentId: stringValue(comment.parent_comment_id),
      likeCount: numberValue(comment.like_count),
      replyCount: numberValue(comment.reply_count),
      sourceUrl,
      replyTargetUrl,
      authorLabel,
      receivedAt: stringValue(comment.create_time) ?? stringValue(comment.created_at),
      rawEvent: comment,
    };
  });
}

export async function processTikTokCommentIntakePayload(input: { workspaceId: string; payload: unknown }) {
  const events = extractTikTokCommentIntakeEvents(input.payload);
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
      senderId: event.authorLabel,
      sourcePlatform: "tiktok",
      authorLabel: event.authorLabel,
      content: event.content,
      messageType: "comment",
      sourceType: "tiktok_comments",
      sourceUrl: event.sourceUrl,
      replyTargetUrl: event.replyTargetUrl,
      externalThreadId: event.externalThreadId,
      externalPostId: event.externalPostId,
      externalCommentId: event.externalCommentId,
      originalAuthorLabel: event.authorLabel,
      originalTextExcerpt: event.content,
      receivedAt: event.receivedAt,
    });

    if (result.error) firstError ??= result.error.message;
    else saved += 1;
  }

  return { received: true, saved: saved > 0, skipped: skipped > 0, eventCount: events.length, error: firstError };
}

function collectCommentCandidates(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];
  for (const key of ["comments", "data", "items", "results"]) {
    const value = payload[key];
    if (Array.isArray(value)) return value.filter(isRecord);
  }
  const nestedData = isRecord(payload.data) ? payload.data : undefined;
  if (Array.isArray(nestedData?.comments)) return nestedData.comments.filter(isRecord);
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

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}
