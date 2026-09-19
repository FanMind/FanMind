import "server-only";

import { revalidatePath } from "next/cache";
import {
  buildAttachmentFallbackText,
  getMessageKindFromAttachments,
  normalizeMessageAttachments,
} from "@/lib/messageAttachments";
import {
  createEmptySocialSyncResult,
  type SocialSyncResult,
} from "@/lib/socialSync";
import {
  decryptToken,
  FACEBOOK_GRAPH_API_VERSION,
  type FacebookConversationFieldProbe,
  type FacebookMessengerMessage,
  type FacebookMessageFieldProbe,
  type FacebookMessengerConversation,
  type FacebookPageComment,
  getFacebookGrantedScopeNames,
  fetchFacebookPagePostsWithComments,
  fetchFacebookMessengerConversationMessages,
  fetchFacebookMessengerConversationPage,
  fetchFacebookMessengerConversations,
  probeFacebookMessengerConversationFieldSets,
  probeFacebookMessengerMessageFieldSet,
  FacebookCommentFetchError,
  fetchFacebookPageWebhookStatus,
  fetchFacebookTokenDiagnostics,
  hasFacebookCommentFeedScopes,
  hasFacebookPagesMessagingScope,
  hasFacebookPagesReadUserContentScope,
  subscribeFacebookPage,
  type FacebookPageWebhookStatus,
} from "@/lib/facebookIntegration";
import {
  getSupabaseServerUser,
  getUserWorkspaceDashboard,
  getWorkspaceProcessingEntitlement,
  getMetaMessengerSyncContinuation,
  getWorkspaceSocialConnectionsServer,
  createMetaWebhookConversationMessage,
  updateFacebookCommentFetchStatus,
  updateFacebookMessengerSyncStatus,
  updateFacebookWebhookSubscribed,
  markContactInboundMessagesSeen,
  getWorkspaceContacts,
  type SocialConnectionRow,
} from "@/lib/supabase/server";
import {
  extractBusinessInboxUrlCandidates,
  extractSelectedItemIdFromMetaUrl,
} from "@/lib/sourceContext";
import { areDemoConnectionsDisabled } from "@/lib/demoMode";
import { canManageMetaConnections } from "@/lib/metaIntegrationPolicy.mjs";
import {
  META_INCREMENTAL_CHAT_FETCH_LIMIT,
  META_INITIAL_CHAT_BACKFILL_LIMIT,
} from "@/lib/metaDataHandlingPolicy.mjs";
import { shouldPersistMetaConnectionSyncStatus } from "@/lib/metaSyncScopePolicy.mjs";
import {
  assertMetaConversationSyncBudget,
  META_CONVERSATION_SYNC_EXECUTION_BUDGET_MS,
  resolveMetaConversationSyncCheckpoint,
} from "@/lib/metaConversationPaginationPolicy.mjs";

export type FacebookCommentFetchResult = {
  ok: boolean;
  fetchedAt: string;
  postsChecked: number;
  commentsChecked: number;
  importedCount: number;
  error?: string | null;
  endpointType?: string | null;
  usedPageAccessToken?: boolean;
  tokenScopes?: string[];
  continuationPending?: boolean;
};

const FACEBOOK_MESSENGER_INCREMENTAL_CONVERSATION_LIMIT = 10;
const FACEBOOK_MESSENGER_INITIAL_CONVERSATION_LIMIT = 25;

const FACEBOOK_COMMENT_SYNC_MAX_PERSISTED_PER_RUN = 100;
const FACEBOOK_COMMENT_SYNC_EXECUTION_BUDGET_MS = 8_000;
const FACEBOOK_COMMENT_CONTINUATION_PREFIX = "__fanmind_comment_cursor_v1__:";

type FacebookCommentContinuationCursor = {
  createdTime: string | null;
  id: string;
};

const facebookCommentSyncInFlight = new Map<
  string,
  Promise<FacebookCommentFetchResult>
>();

export type FacebookMessengerSyncResult = SocialSyncResult & {
  syncedAt: string;
  conversationsChecked: number;
  continuationPending?: boolean;
  error?: string | null;
};

export type FacebookPageWebhookActionResult = FacebookPageWebhookStatus & {
  updatedConnection: boolean;
  tokenScopes?: string[];
  pagesMessagingGranted?: boolean;
  commentFeedScopesGranted?: boolean;
  pagesReadUserContentGranted?: boolean;
};

export type MetaPermissionDiagnosis = {
  ok: boolean;
  checkedAt: string;
  connectionActive: boolean;
  pageIdDetected: boolean;
  tokenCheckSuccessful: boolean;
  pageAccessTokenPresent: boolean;
  detectedPermissions: string[];
  visiblePageRights: string[];
  missingPermissions: string[];
  appReviewCheckRecommended: boolean;
  advancedAccessCheckRecommended: boolean;
  tokenAppearsRestricted: boolean;
  directChatIdStatus: string;
  note: string;
  error?: string | null;
};

export type FacebookDirectLinkSourceDiagnosis = {
  ok: boolean;
  graphApiVersion: string;
  pageIdConfigured: boolean;
  businessIdConfigured: boolean;
  sampledConversations: number;
  conversationLinkAvailable: number;
  conversationLinkWithDirectId: number;
  participantIdsAvailable: number;
  matchedConversationFound: boolean;
  matchedConversationHasDirectId: boolean;
  participantIdMatchesDirectId: boolean | null;
  conversationFieldsetStable: boolean;
  messageFieldsetStable: boolean;
  linkFieldsFound: boolean;
  businessInboxUrlFound: boolean;
  selectedItemIdRecognized: boolean;
  directLinkIdDetected: boolean;
  directLinkIdSource:
    | "conversation.link"
    | "message_field"
    | "share"
    | "attachment"
    | "stored_auto"
    | "not_detected";
  conversationFieldProbes: FacebookConversationFieldProbe[];
  messageFieldProbe: FacebookMessageFieldProbe | null;
  note: string;
};

export async function diagnoseMetaPermissions(): Promise<MetaPermissionDiagnosis> {
  const checkedAt = new Date().toISOString();
  const { connection, error } = await getCurrentFacebookConnection();
  if (error || !connection) {
    return {
      ok: false,
      checkedAt,
      connectionActive: false,
      pageIdDetected: false,
      tokenCheckSuccessful: false,
      pageAccessTokenPresent: false,
      detectedPermissions: [],
      visiblePageRights: [],
      missingPermissions: requiredMetaPermissionNames(),
      appReviewCheckRecommended: true,
      advancedAccessCheckRecommended: true,
      tokenAppearsRestricted: true,
      directChatIdStatus:
        "Mit aktuellem Zugriff liefert Meta keine Direktchat-ID.",
      note: error ?? "Facebook-Verbindung fehlt.",
      error: error ?? "Facebook-Verbindung fehlt.",
    };
  }

  const token = connection.page_access_token_encrypted
    ? decryptToken(connection.page_access_token_encrypted)
    : null;
  const tokenScopes = await getSafeTokenScopeNames(token);
  const pageStatus = await fetchFacebookPageWebhookStatus(
    connection.page_id,
    token,
  );
  const visiblePageRights = Array.from(
    new Set([...(connection.scopes ?? []), ...tokenScopes]),
  ).sort();
  const missingPermissions = requiredMetaPermissionNames().filter(
    (permission) => !tokenScopes.includes(permission),
  );
  const tokenCheckSuccessful = Boolean(
    token && tokenScopes.length > 0 && !pageStatus.error,
  );
  const webhookMissing =
    pageStatus.fields.messages !== "active" ||
    pageStatus.fields.message_echoes !== "active" ||
    pageStatus.subscribedAppsStatus !== "active";
  const tokenAppearsRestricted =
    !token ||
    missingPermissions.length > 0 ||
    !pageStatus.ok ||
    webhookMissing;

  return {
    ok: !tokenAppearsRestricted,
    checkedAt,
    connectionActive: true,
    pageIdDetected: Boolean(connection.page_id),
    tokenCheckSuccessful,
    pageAccessTokenPresent: Boolean(token),
    detectedPermissions: tokenScopes,
    visiblePageRights,
    missingPermissions,
    appReviewCheckRecommended: tokenAppearsRestricted,
    advancedAccessCheckRecommended: tokenAppearsRestricted,
    tokenAppearsRestricted,
    directChatIdStatus:
      "Mit aktuellem Zugriff liefert Meta keine Direktchat-ID.",
    note: tokenAppearsRestricted
      ? "Prüfe Meta App Review, Advanced Access und Page-Zuweisung für die fehlenden Berechtigungen."
      : "Keine klare Berechtigungslücke erkannt. Meta liefert dennoch keine Direktchat-ID.",
    error: pageStatus.error,
  };
}

function requiredMetaPermissionNames(): string[] {
  return Array.from(
    new Set([
      "pages_show_list",
      "pages_manage_metadata",
      "pages_messaging",
      "pages_read_engagement",
      "pages_read_user_content",
      "read_insights",
    ]),
  );
}

export async function fetchFacebookCommentsNow(): Promise<FacebookCommentFetchResult> {
  const fetchedAt = new Date().toISOString();
  const { connection, error } = await getCurrentFacebookConnection();
  if (error || !connection) {
    return {
      ok: false,
      fetchedAt,
      postsChecked: 0,
      commentsChecked: 0,
      importedCount: 0,
      error: error ?? "Facebook-Verbindung fehlt.",
    };
  }

  const existingSync = facebookCommentSyncInFlight.get(connection.id);
  if (existingSync) return existingSync;

  const sync = fetchFacebookCommentsForConnection(connection, fetchedAt);
  facebookCommentSyncInFlight.set(connection.id, sync);
  try {
    return await sync;
  } finally {
    if (facebookCommentSyncInFlight.get(connection.id) === sync) {
      facebookCommentSyncInFlight.delete(connection.id);
    }
  }
}

async function fetchFacebookCommentsForConnection(
  connection: SocialConnectionRow,
  fetchedAt: string,
): Promise<FacebookCommentFetchResult> {
  const token = connection.page_access_token_encrypted
    ? decryptToken(connection.page_access_token_encrypted)
    : null;

  if (!connection.page_id || !token) {
    const message =
      "Page Access Token fehlt oder konnte nicht entschlüsselt werden.";
    await updateFacebookCommentFetchStatus(connection.id, {
      fetchedAt,
      importedCount: 0,
      error: message,
    });
    revalidatePath("/channels");
    return {
      ok: false,
      fetchedAt,
      postsChecked: 0,
      commentsChecked: 0,
      importedCount: 0,
      error: message,
    };
  }

  try {
    const tokenScopes = await getSafeTokenScopeNames(token);
    if (!hasFacebookCommentFeedScopes(tokenScopes)) {
      const message =
        "Die aktuelle Facebook-Verbindung besitzt keine gültige Kommentar-Berechtigung.";
      await updateFacebookCommentFetchStatus(connection.id, {
        fetchedAt,
        importedCount: 0,
        error: message,
      });
      revalidatePath("/channels");
      return {
        ok: false,
        fetchedAt,
        postsChecked: 0,
        commentsChecked: 0,
        importedCount: 0,
        error: message,
        tokenScopes,
      };
    }

    const { posts, comments, diagnostics } =
      await fetchFacebookPagePostsWithComments(connection.page_id, token);
    const orderedComments = [...comments].sort(compareFacebookCommentsByTime);
    const continuationCursor = decodeFacebookCommentContinuation(
      connection.last_comment_fetch_error,
    );
    const completedHighWaterAt = normalizeFacebookCommentHighWater(
      connection.last_comment_fetch_at,
    );
    const remainingComments = continuationCursor
      ? orderedComments.filter((comment) =>
          compareFacebookCommentToCursor(comment, continuationCursor) > 0,
        )
      : completedHighWaterAt
        ? orderedComments.filter((comment) =>
            isFacebookCommentAtOrAfterHighWater(comment, completedHighWaterAt),
          )
        : orderedComments;
    const persistenceStartedAt = Date.now();
    let importedCount = 0;
    let processedCount = 0;
    let lastProcessedCursor = continuationCursor;
    let latestValidHighWaterAt = completedHighWaterAt;
    let continuationPending = false;

    for (const comment of remainingComments) {
      if (
        processedCount >= FACEBOOK_COMMENT_SYNC_MAX_PERSISTED_PER_RUN ||
        Date.now() - persistenceStartedAt >=
          FACEBOOK_COMMENT_SYNC_EXECUTION_BUDGET_MS
      ) {
        continuationPending = true;
        break;
      }

      const commentCursor = facebookCommentCursor(comment);
      const attachments = normalizeFacebookCommentAttachments(comment);
      const content =
        comment.message?.trim() ||
        buildAttachmentFallbackText(attachments, "inbound");
      const senderId = comment.from?.id ?? null;

      if (commentCursor.createdTime) {
        latestValidHighWaterAt = laterFacebookCommentHighWater(
          latestValidHighWaterAt,
          commentCursor.createdTime,
        );
      }

      if (!content || (senderId && senderId === connection.page_id)) {
        processedCount += 1;
        lastProcessedCursor = commentCursor;
        continue;
      }

      const externalThreadId = `${comment.postId}:${senderId ?? comment.id}`;
      const result = await createMetaWebhookConversationMessage({
        workspaceId: connection.workspace_id,
        sourcePlatform: "facebook",
        senderId,
        authorLabel: comment.from?.name ?? "Facebook Nutzer",
        content,
        messageType: "comment",
        sourceType: "facebook_comments",
        sourceUrl:
          comment.permalink_url ??
          comment.postPermalinkUrl ??
          `https://www.facebook.com/${comment.postId}`,
        replyTargetUrl:
          comment.permalink_url ??
          comment.postPermalinkUrl ??
          `https://www.facebook.com/${comment.postId}`,
        externalMessageId: comment.id,
        externalThreadId,
        sourceConversationId: externalThreadId,
        externalPostId: comment.postId,
        externalCommentId: comment.id,
        attachments,
        messageKind: getMessageKindFromAttachments(
          comment.message,
          attachments,
        ),
        receivedAt: comment.created_time ?? null,
        direction: "inbound",
      });
      if (result.error) throw result.error;
      if (result.conversation) importedCount += 1;
      processedCount += 1;
      lastProcessedCursor = commentCursor;
    }

    if (
      !continuationPending &&
      lastProcessedCursor &&
      remainingComments.length > processedCount
    ) {
      continuationPending = true;
    }

    await updateFacebookCommentFetchStatus(connection.id, {
      fetchedAt,
      importedCount,
      highWaterAt: latestValidHighWaterAt,
      error:
        continuationPending && lastProcessedCursor
          ? encodeFacebookCommentContinuation(lastProcessedCursor)
          : null,
    });
    revalidatePath("/channels");
    revalidatePath("/inbox");
    return {
      ok: true,
      fetchedAt,
      postsChecked: posts.length,
      commentsChecked: comments.length,
      importedCount,
      error: null,
      endpointType: diagnostics.endpointType,
      usedPageAccessToken: diagnostics.usedPageAccessToken,
      tokenScopes,
      continuationPending,
    };
  } catch (fetchError) {
    const tokenScopes = await getSafeTokenScopeNames(token);
    const message = "Facebook-Kommentarabruf fehlgeschlagen.";
    await updateFacebookCommentFetchStatus(connection.id, {
      fetchedAt,
      importedCount: 0,
      error: message,
    });
    revalidatePath("/channels");
    return {
      ok: false,
      fetchedAt,
      postsChecked: 0,
      commentsChecked: 0,
      importedCount: 0,
      error: message,
      endpointType:
        fetchError instanceof FacebookCommentFetchError
          ? fetchError.endpointType
          : null,
      usedPageAccessToken:
        fetchError instanceof FacebookCommentFetchError
          ? fetchError.usedPageAccessToken
          : true,
      tokenScopes,
    };
  }
}

function compareFacebookCommentsByTime(
  left: FacebookPageComment,
  right: FacebookPageComment,
): number {
  return compareFacebookCommentCursors(
    facebookCommentCursor(left),
    facebookCommentCursor(right),
  );
}

function facebookCommentCursor(
  comment: FacebookPageComment,
): FacebookCommentContinuationCursor {
  const parsed = comment.created_time ? Date.parse(comment.created_time) : Number.NaN;
  return {
    createdTime: Number.isFinite(parsed)
      ? new Date(parsed).toISOString()
      : null,
    id: comment.id,
  };
}

function compareFacebookCommentToCursor(
  comment: FacebookPageComment,
  cursor: FacebookCommentContinuationCursor,
): number {
  return compareFacebookCommentCursors(facebookCommentCursor(comment), cursor);
}

function normalizeFacebookCommentHighWater(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function isFacebookCommentAtOrAfterHighWater(
  comment: FacebookPageComment,
  highWaterAt: string,
): boolean {
  const cursor = facebookCommentCursor(comment);
  if (!cursor.createdTime) return true;
  return Date.parse(cursor.createdTime) >= Date.parse(highWaterAt);
}

function laterFacebookCommentHighWater(
  current: string | null,
  candidate: string,
): string {
  if (!current) return candidate;
  return Date.parse(candidate) > Date.parse(current) ? candidate : current;
}

function compareFacebookCommentCursors(
  left: FacebookCommentContinuationCursor,
  right: FacebookCommentContinuationCursor,
): number {
  const leftTime = left.createdTime ? Date.parse(left.createdTime) : Number.NaN;
  const rightTime = right.createdTime ? Date.parse(right.createdTime) : Number.NaN;
  const leftValid = Number.isFinite(leftTime);
  const rightValid = Number.isFinite(rightTime);
  if (leftValid && rightValid && leftTime !== rightTime) return leftTime - rightTime;
  // Missing/malformed provider timestamps are processed after all historical
  // comments so their persistence-time fallback cannot be overwritten later
  // by older provider timestamps in the same fan thread.
  if (leftValid !== rightValid) return leftValid ? -1 : 1;
  return left.id.localeCompare(right.id);
}

function encodeFacebookCommentContinuation(
  cursor: FacebookCommentContinuationCursor,
): string {
  return `${FACEBOOK_COMMENT_CONTINUATION_PREFIX}${encodeURIComponent(
    JSON.stringify(cursor),
  )}`;
}

function decodeFacebookCommentContinuation(
  value: string | null | undefined,
): FacebookCommentContinuationCursor | null {
  if (!value?.startsWith(FACEBOOK_COMMENT_CONTINUATION_PREFIX)) return null;
  try {
    const parsed = JSON.parse(
      decodeURIComponent(value.slice(FACEBOOK_COMMENT_CONTINUATION_PREFIX.length)),
    ) as Partial<FacebookCommentContinuationCursor>;
    if (typeof parsed.id !== "string" || !parsed.id.trim()) return null;
    if (
      parsed.createdTime !== null &&
      (typeof parsed.createdTime !== "string" ||
        !Number.isFinite(Date.parse(parsed.createdTime)))
    ) {
      return null;
    }
    return {
      createdTime:
        typeof parsed.createdTime === "string"
          ? new Date(parsed.createdTime).toISOString()
          : null,
      id: parsed.id,
    };
  } catch {
    return null;
  }
}

function normalizeFacebookCommentAttachments(
  comment: FacebookPageComment,
) {
  const rawAttachments = [
    ...(comment.attachment ? [comment.attachment] : []),
    ...(comment.attachments?.data ?? []),
  ];
  const normalized = normalizeMessageAttachments(
    rawAttachments.map((attachment) => ({
      type: normalizeFacebookCommentAttachmentType(attachment.type),
      url:
        attachment.url ??
        attachment.media?.image?.src ??
        attachment.target?.url ??
        null,
    })),
  );
  if (!normalized?.length) return null;

  const unique = new Map(
    normalized.map((attachment) => [
      `${attachment.type}|${attachment.url ?? ""}|${attachment.sticker_id ?? ""}`,
      attachment,
    ]),
  );
  return [...unique.values()];
}

function normalizeFacebookCommentAttachmentType(
  type: string | undefined,
): "image" | "video" | "audio" | "file" | "unknown" {
  const normalized = type?.toLowerCase() ?? "";
  if (
    normalized.includes("image") ||
    normalized.includes("photo") ||
    normalized.includes("sticker")
  ) {
    return "image";
  }
  if (normalized.includes("video")) return "video";
  if (normalized.includes("audio")) return "audio";
  if (normalized.includes("file") || normalized.includes("document")) {
    return "file";
  }
  return "unknown";
}

export async function syncFacebookMessengerHistory(input?: {
  contactId?: string;
  markInboundSeen?: boolean;
  revalidate?: boolean;
}): Promise<FacebookMessengerSyncResult> {
  const syncedAt = new Date().toISOString();
  const { connection, error } = await getCurrentFacebookConnection();
  if (error || !connection)
    return syncError(syncedAt, error ?? "Facebook-Verbindung fehlt.");
  return syncFacebookMessengerHistoryForConnection(connection, {
    ...input,
    syncedAt,
    revalidate: input?.revalidate ?? true,
  });
}

export async function syncFacebookMessengerConversationForContact(input: {
  connection: SocialConnectionRow;
  contactId?: string | null;
  fanSenderId?: string | null;
  markInboundSeen?: boolean;
  revalidate?: boolean;
}): Promise<FacebookMessengerSyncResult> {
  return syncFacebookMessengerHistoryForConnection(input.connection, {
    contactId: input.contactId ?? undefined,
    fanSenderId: input.fanSenderId ?? undefined,
    markInboundSeen: input.markInboundSeen,
    revalidate: input.revalidate ?? true,
    syncedAt: new Date().toISOString(),
  });
}

export async function diagnoseFacebookDirectLinkSource(input: {
  connection: SocialConnectionRow;
  contactHandle?: string | null;
  limit?: number;
}): Promise<FacebookDirectLinkSourceDiagnosis> {
  const token = input.connection.page_access_token_encrypted
    ? decryptToken(input.connection.page_access_token_encrypted)
    : null;

  if (!input.connection.page_id || !token) {
    return {
      ok: false,
      graphApiVersion: FACEBOOK_GRAPH_API_VERSION,
      pageIdConfigured: Boolean(input.connection.page_id),
      businessIdConfigured: Boolean(
        process.env.META_BUSINESS_ID ?? process.env.NEXT_PUBLIC_META_BUSINESS_ID,
      ),
      sampledConversations: 0,
      conversationLinkAvailable: 0,
      conversationLinkWithDirectId: 0,
      participantIdsAvailable: 0,
      matchedConversationFound: false,
      matchedConversationHasDirectId: false,
      participantIdMatchesDirectId: null,
      conversationFieldsetStable: false,
      messageFieldsetStable: false,
      linkFieldsFound: false,
      businessInboxUrlFound: false,
      selectedItemIdRecognized: false,
      directLinkIdDetected: false,
      directLinkIdSource: "not_detected",
      conversationFieldProbes: [],
      messageFieldProbe: null,
      note: "Meta-Verbindung ist vorhanden, aber die Direktlink-Quelle konnte gerade nicht geprüft werden.",
    };
  }

  try {
    const limit = Math.max(1, Math.min(input.limit ?? 5, 10));
    const [conversations, conversationFieldProbes] = await Promise.all([
      fetchFacebookMessengerConversations(
        input.connection.page_id,
        token,
        limit,
      ),
      probeFacebookMessengerConversationFieldSets({
        pageId: input.connection.page_id,
        pageAccessToken: token,
        knownParticipantId: input.contactHandle ?? null,
        limit,
      }),
    ]);
    const messageFieldProbe = conversations[0]?.id
      ? await probeFacebookMessengerMessageFieldSet({
          conversationId: conversations[0].id,
          pageAccessToken: token,
          limit: 5,
        })
      : null;
    return summarizeFacebookDirectLinkDiagnosis({
      pageId: input.connection.page_id,
      businessId:
        process.env.META_BUSINESS_ID ?? process.env.NEXT_PUBLIC_META_BUSINESS_ID ?? null,
      contactHandle: input.contactHandle ?? null,
      conversations,
      conversationFieldProbes,
      messageFieldProbe,
    });
  } catch {
    return {
      ok: false,
      graphApiVersion: FACEBOOK_GRAPH_API_VERSION,
      pageIdConfigured: Boolean(input.connection.page_id),
      businessIdConfigured: Boolean(
        process.env.META_BUSINESS_ID ?? process.env.NEXT_PUBLIC_META_BUSINESS_ID,
      ),
      sampledConversations: 0,
      conversationLinkAvailable: 0,
      conversationLinkWithDirectId: 0,
      participantIdsAvailable: 0,
      matchedConversationFound: false,
      matchedConversationHasDirectId: false,
      participantIdMatchesDirectId: null,
      conversationFieldsetStable: false,
      messageFieldsetStable: false,
      linkFieldsFound: false,
      businessInboxUrlFound: false,
      selectedItemIdRecognized: false,
      directLinkIdDetected: false,
      directLinkIdSource: "not_detected",
      conversationFieldProbes: [],
      messageFieldProbe: null,
      note: "Meta-Direktlink-Quelle konnte gerade nicht geprüft werden.",
    };
  }
}

async function syncFacebookMessengerHistoryForConnection(
  connection: SocialConnectionRow,
  input: {
    contactId?: string;
    fanSenderId?: string;
    markInboundSeen?: boolean;
    revalidate: boolean;
    syncedAt: string;
  },
): Promise<FacebookMessengerSyncResult> {
  const { syncedAt } = input;
  const executionDeadlineMs =
    Date.now() + META_CONVERSATION_SYNC_EXECUTION_BUDGET_MS;
  const shouldPersistConnectionStatus =
    shouldPersistMetaConnectionSyncStatus(input);
  const token = connection.page_access_token_encrypted
    ? decryptToken(connection.page_access_token_encrypted)
    : null;

  if (!connection.page_id || !token) {
    const message =
      "Page Access Token fehlt oder konnte nicht entschlüsselt werden.";
    if (shouldPersistConnectionStatus) {
      await updateFacebookMessengerSyncStatus(connection.id, {
        syncedAt,
        checkedConversations: 0,
        importedInbound: 0,
        importedOutbound: 0,
        skippedDuplicates: 0,
        error: message,
        cursorUpdate: { kind: "preserve" },
      });
    }
    if (input.revalidate) revalidatePath("/channels");
    return syncError(syncedAt, message);
  }

  try {
    const continuation = shouldPersistConnectionStatus
      ? await getMetaMessengerSyncContinuation(connection.id, "facebook")
      : null;
    if (continuation?.error) throw continuation.error;
    if (continuation && !continuation.schemaReady) {
      throw new Error(
        "Meta-Sync-Fortsetzung ist in dieser Umgebung noch nicht bereit.",
      );
    }

    const workspaceContacts =
      input.contactId || input.fanSenderId
        ? (await getWorkspaceContacts(connection.workspace_id)).contacts
        : [];
    const contact = input.contactId
      ? workspaceContacts.find((entry) => entry.id === input.contactId)
      : null;
    const targetFanSenderId = input.fanSenderId ?? contact?.handle ?? null;
    const initialSync = !connection.last_messenger_sync_at;
    const messageFetchLimit = initialSync
      ? META_INITIAL_CHAT_BACKFILL_LIMIT
      : META_INCREMENTAL_CHAT_FETCH_LIMIT;
    const conversationFetchLimit = initialSync
      ? FACEBOOK_MESSENGER_INITIAL_CONVERSATION_LIMIT
      : FACEBOOK_MESSENGER_INCREMENTAL_CONVERSATION_LIMIT;
    assertMetaConversationSyncBudget(executionDeadlineMs);
    const conversationPage = await fetchFacebookMessengerConversationPage(
      connection.page_id,
      token,
      conversationFetchLimit,
      continuation?.continuationAfter ?? null,
      executionDeadlineMs,
    );
    const conversations = conversationPage.conversations;
    const checkpoint = shouldPersistConnectionStatus
      ? resolveMetaConversationSyncCheckpoint({
          runStartedAt: syncedAt,
          existingContinuationAfter:
            continuation?.continuationAfter ?? null,
          existingContinuationStartedAt:
            continuation?.continuationStartedAt ?? null,
          nextAfter: conversationPage.nextAfter,
        })
      : null;
    let conversationsChecked = 0;
    let importedInbound = 0;
    let importedOutbound = 0;
    let skippedDuplicates = 0;
    let checkedMessages = 0;
    let importedMedia = 0;
    let lastOutboundAt: string | null = null;

    for (const conversation of conversations) {
      assertMetaConversationSyncBudget(executionDeadlineMs);
      const fanParticipant = conversation.participants.find(
        (participant) => participant.id !== connection.page_id,
      );
      if (targetFanSenderId && fanParticipant?.id !== targetFanSenderId)
        continue;
      if (
        connection.last_messenger_sync_at &&
        conversation.updatedTime &&
        Date.parse(conversation.updatedTime) <=
          Date.parse(connection.last_messenger_sync_at) - 5 * 60 * 1_000
      ) {
        continue;
      }
      conversationsChecked += 1;

      const messages = await fetchFacebookMessengerConversationMessages(
        conversation.id,
        token,
        messageFetchLimit,
        connection.last_messenger_sync_at,
        executionDeadlineMs,
      );
      const chronologicalMessages = [...messages].sort(
        (a, b) =>
          (Date.parse(a.createdTime ?? "") || 0) -
          (Date.parse(b.createdTime ?? "") || 0),
      );
      for (const message of chronologicalMessages) {
        assertMetaConversationSyncBudget(executionDeadlineMs);
        checkedMessages += 1;
        const senderId = message.from?.id ?? fanParticipant?.id ?? null;
        const direction =
          senderId === connection.page_id ? "outbound" : "inbound";
        const fanSenderId =
          direction === "outbound"
            ? (fanParticipant?.id ?? targetFanSenderId)
            : senderId;
        const normalizedFanSenderId = fanSenderId?.trim() || null;
        const externalThreadId =
          conversation.id ||
          (connection.page_id && normalizedFanSenderId
            ? `${connection.page_id}:${normalizedFanSenderId}`
            : null);
        const content =
          message.message ??
          buildAttachmentFallbackText(message.attachments, direction);
        if (!content) continue;

        const metaUrlCandidates = collectFacebookMetaUrlCandidates(
          conversation,
          message,
        );
        const inboxCandidates = extractBusinessInboxUrlCandidates(metaUrlCandidates);
        const preferredMetaUrl =
          inboxCandidates[0] ??
          message.replyTargetUrl ??
          message.sourceUrl ??
          message.link ??
          conversation.link;
        const sourceMetaUrl =
          message.sourceUrl ?? message.link ?? conversation.link ?? preferredMetaUrl;

        const result = await createMetaWebhookConversationMessage({
          workspaceId: connection.workspace_id,
          senderId: normalizedFanSenderId,
          pageId: connection.page_id,
          recipientId: connection.page_id,
          sourcePlatform: "facebook",
          authorLabel:
            direction === "outbound"
              ? (connection.page_name ?? "Team")
              : (message.from?.name ??
                fanParticipant?.name ??
                "Facebook Nutzer"),
          content,
          messageType: "dm",
          sourceType: "facebook_messages",
          sourceUrl: sourceMetaUrl,
          replyTargetUrl: preferredMetaUrl,
          metaUrlCandidates,
          externalMessageId: message.id,
          externalThreadId,
          sourceConversationId: conversation.id,
          originalTextExcerpt: content,
          direction,
          attachments: message.attachments,
          messageKind: getMessageKindFromAttachments(
            message.message,
            message.attachments,
          ),
          receivedAt: message.createdTime,
        });
        if (result.error) throw result.error;
        if (result.conversation) {
          if (direction === "outbound") {
            importedOutbound += 1;
            lastOutboundAt = message.createdTime ?? syncedAt;
          } else {
            importedInbound += 1;
          }
          if (message.attachments?.length)
            importedMedia += message.attachments.length;
        } else {
          skippedDuplicates += 1;
        }
      }
    }

    if (shouldPersistConnectionStatus) {
      const statusResult = await updateFacebookMessengerSyncStatus(
        connection.id,
        {
          syncedAt,
          checkedConversations: conversationsChecked,
          importedInbound,
          importedOutbound,
          skippedDuplicates,
          importedMedia,
          error: null,
          lastOutboundAt,
          cursorUpdate: checkpoint?.completedSyncAt
            ? {
                kind: "complete",
                completedSyncAt: checkpoint.completedSyncAt,
              }
            : {
                kind: "partial",
                continuationAfter: checkpoint!.continuationAfter!,
                continuationStartedAt: checkpoint!.continuationStartedAt!,
              },
        },
      );
      if (statusResult.error) throw statusResult.error;
    }
    if (input.contactId && input.markInboundSeen)
      await markContactInboundMessagesSeen({
        workspaceId: connection.workspace_id,
        contactId: input.contactId,
      });
    if (input.revalidate) {
      revalidatePath("/channels");
      revalidatePath("/inbox");
      if (input.contactId) revalidatePath(`/fans/${input.contactId}`);
    }
    return {
      ok: true,
      syncedAt,
      conversationsChecked,
      checkedConversations: conversationsChecked,
      checkedMessages,
      importedInbound,
      importedOutbound,
      importedMedia,
      skippedDuplicates,
      errors: [],
      syncLimit: messageFetchLimit,
      lastSyncAt:
        checkpoint?.completedSyncAt ??
        connection.last_messenger_sync_at ??
        checkpoint?.intervalStartedAt ??
        syncedAt,
      continuationPending: Boolean(checkpoint?.continuationAfter),
      error: null,
    };
  } catch {
    const message =
      "Facebook-Verlauf konnte nicht abgerufen werden. Prüfe Page Access Token und Messenger-Berechtigungen.";
    if (shouldPersistConnectionStatus) {
      await updateFacebookMessengerSyncStatus(connection.id, {
        syncedAt,
        checkedConversations: 0,
        importedInbound: 0,
        importedOutbound: 0,
        skippedDuplicates: 0,
        error: message,
        cursorUpdate: { kind: "preserve" },
      });
    }
    if (input.revalidate) revalidatePath("/channels");
    return syncError(syncedAt, message);
  }
}

function syncError(
  syncedAt: string,
  error: string,
): FacebookMessengerSyncResult {
  return {
    ...createEmptySocialSyncResult({
      ok: false,
      lastSyncAt: syncedAt,
      syncLimit: META_INITIAL_CHAT_BACKFILL_LIMIT,
      error,
    }),
    syncedAt,
    conversationsChecked: 0,
    error,
  };
}

function summarizeFacebookDirectLinkDiagnosis(input: {
  pageId: string;
  businessId: string | null;
  contactHandle: string | null;
  conversations: FacebookMessengerConversation[];
  conversationFieldProbes: FacebookConversationFieldProbe[];
  messageFieldProbe: FacebookMessageFieldProbe | null;
}): FacebookDirectLinkSourceDiagnosis {
  let conversationLinkAvailable = 0;
  let conversationLinkWithDirectId = 0;
  let participantIdsAvailable = 0;
  let matchedConversationFound = false;
  let matchedConversationHasDirectId = false;
  let participantIdMatchesDirectId: boolean | null = null;
  let businessInboxUrlFound = false;
  let selectedItemIdRecognized = false;
  let selectedItemSource: FacebookDirectLinkSourceDiagnosis["directLinkIdSource"] =
    "not_detected";

  for (const conversation of input.conversations) {
    const fanParticipant = conversation.participants.find(
      (participant) => participant.id !== input.pageId,
    );
    if (fanParticipant?.id) participantIdsAvailable += 1;

    const selectedItemId = extractSelectedItemIdFromMetaUrl(conversation.link);
    if (conversation.link) conversationLinkAvailable += 1;
    if (conversation.link?.includes("business.facebook.com/latest/inbox")) {
      businessInboxUrlFound = true;
    }
    if (selectedItemId) {
      conversationLinkWithDirectId += 1;
      selectedItemIdRecognized = true;
      selectedItemSource = "conversation.link";
    }

    if (input.contactHandle && fanParticipant?.id === input.contactHandle) {
      matchedConversationFound = true;
      if (selectedItemId) {
        matchedConversationHasDirectId = true;
        participantIdMatchesDirectId = fanParticipant.id === selectedItemId;
      }
    }
  }

  if (
    !selectedItemIdRecognized &&
    input.messageFieldProbe?.selectedItemIdFound &&
    input.messageFieldProbe.selectedItemIdSource !== "not_detected"
  ) {
    selectedItemIdRecognized = true;
    selectedItemSource = input.messageFieldProbe.selectedItemIdSource;
  }

  if (input.messageFieldProbe?.businessInboxUrlFound) {
    businessInboxUrlFound = true;
  }

  const conversationFieldsetStable = input.conversationFieldProbes.some(
    (probe) =>
      probe.ok &&
      probe.participantsPresent &&
      probe.canReplyFieldPresent &&
      probe.scopedThreadKeyFieldPresent,
  );
  const messageFieldsetStable =
    input.messageFieldProbe?.ok === true &&
    input.messageFieldProbe.fromFieldPresent &&
    input.messageFieldProbe.attachmentsFieldPresent;
  const linkFieldsFound =
    conversationLinkAvailable > 0 ||
    Boolean(input.messageFieldProbe?.linkFieldPresent) ||
    Boolean(input.messageFieldProbe?.sharesFieldPresent) ||
    Boolean(input.messageFieldProbe?.attachmentsFieldPresent);

  const directLinkIdDetected = matchedConversationHasDirectId || selectedItemIdRecognized;
  const note = directLinkIdDetected
    ? "Direktlink-ID erkannt. FanMind kann den direkten Chat automatisch aufbauen."
    : matchedConversationFound
      ? "Meta liefert mit aktuellem Zugriff keine Direktchat-ID."
      : conversationLinkWithDirectId > 0
        ? "Meta liefert Direktlink-IDs in der Stichprobe, aber nicht für diesen Kontakt in der geprüften Auswahl."
        : "Meta liefert mit aktuellem Zugriff keine Direktchat-ID.";

  return {
    ok: true,
    graphApiVersion: FACEBOOK_GRAPH_API_VERSION,
    pageIdConfigured: Boolean(input.pageId),
    businessIdConfigured: Boolean(input.businessId),
    sampledConversations: input.conversations.length,
    conversationLinkAvailable,
    conversationLinkWithDirectId,
    participantIdsAvailable,
    matchedConversationFound,
    matchedConversationHasDirectId,
    participantIdMatchesDirectId,
    conversationFieldsetStable,
    messageFieldsetStable,
    linkFieldsFound,
    businessInboxUrlFound,
    selectedItemIdRecognized,
    directLinkIdDetected,
    directLinkIdSource: directLinkIdDetected ? selectedItemSource : "not_detected",
    conversationFieldProbes: input.conversationFieldProbes,
    messageFieldProbe: input.messageFieldProbe,
    note,
  };
}

function collectFacebookMetaUrlCandidates(
  conversation: FacebookMessengerConversation,
  message: FacebookMessengerMessage,
): string[] {
  const values = [
    conversation.link,
    message.link,
    message.sourceUrl,
    message.replyTargetUrl,
    ...message.shares.map((share) => share.url),
    ...(message.attachments?.map((attachment) => attachment.url ?? null) ?? []),
  ];

  return Array.from(
    new Set(values.filter((value): value is string => isFacebookUrl(value))),
  );
}

function isFacebookUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.hostname.toLowerCase().endsWith("facebook.com");
  } catch {
    return false;
  }
}

export async function checkFacebookPageWebhooks(): Promise<FacebookPageWebhookActionResult> {
  const { connection, error } = await getCurrentFacebookConnection();
  if (error || !connection)
    return actionError(error ?? "Facebook-Verbindung fehlt.");

  const token = connection.page_access_token_encrypted
    ? decryptToken(connection.page_access_token_encrypted)
    : null;
  const tokenDiagnostics = await getTokenScopeDiagnostics(token);
  const status = await fetchFacebookPageWebhookStatus(
    connection.page_id,
    token,
  );
  await updateFacebookWebhookSubscribed(connection.id, status.ok);
  revalidatePath("/channels");
  return { ...status, ...tokenDiagnostics, updatedConnection: true };
}

export async function activateFacebookPageWebhooks(): Promise<FacebookPageWebhookActionResult> {
  const { connection, error } = await getCurrentFacebookConnection();
  if (error || !connection)
    return actionError(error ?? "Facebook-Verbindung fehlt.");

  const token = connection.page_access_token_encrypted
    ? decryptToken(connection.page_access_token_encrypted)
    : null;
  const tokenDiagnostics = await getTokenScopeDiagnostics(token);
  if (!connection.page_id || !token) {
    const status = await fetchFacebookPageWebhookStatus(
      connection.page_id,
      token,
    );
    await updateFacebookWebhookSubscribed(connection.id, false);
    revalidatePath("/channels");
    return { ...status, ...tokenDiagnostics, updatedConnection: true };
  }

  const status = await subscribeFacebookPage(connection.page_id, token);
  await updateFacebookWebhookSubscribed(connection.id, status.ok);
  revalidatePath("/channels");
  return { ...status, ...tokenDiagnostics, updatedConnection: true };
}

async function getTokenScopeDiagnostics(token: string | null) {
  const tokenScopes = await getSafeTokenScopeNames(token);
  return {
    tokenScopes,
    pagesMessagingGranted: hasFacebookPagesMessagingScope(tokenScopes),
    commentFeedScopesGranted: hasFacebookCommentFeedScopes(tokenScopes),
    pagesReadUserContentGranted:
      hasFacebookPagesReadUserContentScope(tokenScopes),
  };
}

async function getSafeTokenScopeNames(token: string | null): Promise<string[]> {
  if (!token) return [];
  try {
    return getFacebookGrantedScopeNames(
      await fetchFacebookTokenDiagnostics(token),
    );
  } catch {
    console.error("Facebook token scope diagnostics failed", {
      code: "facebook_token_scope_diagnostics_failed",
    });
    return [];
  }
}

async function getCurrentFacebookConnection() {
  const { data } = await getSupabaseServerUser();
  if (!data.user) return { connection: null, error: "Nicht angemeldet." };
  const workspaceResult = await getUserWorkspaceDashboard(data.user);
  if (!workspaceResult.workspace)
    return { connection: null, error: "Kein Workspace gefunden." };
  if (areDemoConnectionsDisabled(data.user, workspaceResult.workspace)) {
    return {
      connection: null,
      error:
        "Dieser Demo-Workspace ist öffentlich. Echte Kanalverbindungen und externe Bot-Tests sind hier deaktiviert.",
    };
  }
  if (!canManageMetaConnections(workspaceResult.workspace.role)) {
    return {
      connection: null,
      error: "Nur Workspace-Owner oder -Admins dürfen externe Konten verwalten.",
    };
  }
  const entitlement = await getWorkspaceProcessingEntitlement(
    workspaceResult.workspace.id,
  );
  if (entitlement.error || !entitlement.allowed) {
    return {
      connection: null,
      error: "Workspace-Verarbeitung ist nicht freigegeben.",
    };
  }
  const connectionsResult = await getWorkspaceSocialConnectionsServer(
    workspaceResult.workspace.id,
  );
  if (connectionsResult.error)
    return {
      connection: null,
      error: "Facebook-Verbindung konnte nicht geladen werden.",
    };
  return {
    connection:
      connectionsResult.connections.find(
        (entry) =>
          entry.platform === "facebook" && entry.status === "connected",
      ) ?? null,
    error: null,
  };
}

function actionError(error: string): FacebookPageWebhookActionResult {
  return {
    ok: false,
    pageId: null,
    hasPageAccessToken: false,
    subscribedAppsStatus: "error",
    fields: { feed: "unknown", messages: "unknown", message_echoes: "unknown" },
    error,
    updatedConnection: false,
  };
}
