import {
  FACEBOOK_COMMENT_FEED_SCOPES,
  FACEBOOK_INSIGHTS_OAUTH_SCOPES,
  FACEBOOK_MESSAGES_OAUTH_SCOPES,
  FACEBOOK_PAGES_MESSAGING_SCOPE,
  FACEBOOK_PAGES_READ_USER_CONTENT_SCOPE,
} from "@/lib/facebookScopes";
import { META_GRAPH_API_VERSION } from "@/lib/metaIntegrationPolicy.mjs";
import {
  resolveFacebookGraphPagingCursor,
  validateFacebookGraphPagingUrl,
} from "@/lib/facebookGraphPagingPolicy.mjs";
import {
  createMetaConversationSyncAbortSignal,
  normalizeMetaPagingCursor,
} from "@/lib/metaConversationPaginationPolicy.mjs";
import {
  normalizeFacebookPageSelectionPayload,
  type FacebookPageSelectionConnectionType,
  type FacebookPageSelectionPayload,
} from "@/lib/facebookPageSelectionPolicy.mjs";
import { sanitizeMetaProviderError } from "@/lib/metaProviderErrorPolicy.mjs";
import {
  isUsableMetaAppId,
  isUsableMetaAppSecret,
  normalizeMetaCallbackUrl,
  normalizeMetaRuntimeValue,
} from "@/lib/metaRuntimeConfigPolicy.mjs";
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const OAUTH_VERSION = META_GRAPH_API_VERSION;
export const FACEBOOK_GRAPH_API_VERSION = OAUTH_VERSION;
const STATE_MAX_AGE_SECONDS = 10 * 60;

export const REQUIRED_FACEBOOK_PAGE_PERMISSIONS =
  FACEBOOK_MESSAGES_OAUTH_SCOPES;

export type FacebookPermissionStatus = {
  permission: string;
  status: string;
};

export type FacebookOAuthState = {
  workspaceId: string;
  userId: string;
  nonce: string;
  issuedAt: number;
  connectionType?: FacebookPageSelectionConnectionType;
};

export type FacebookPage = {
  id: string;
  name: string;
  accessToken: string | null;
  scopes: string[];
};

export type FacebookTokenDiagnostics = {
  app_id?: string;
  is_valid?: boolean;
  user_id?: string;
  scopes?: string[];
  granular_scopes?: Array<{
    scope?: string;
    target_ids?: string[];
  }>;
  error?: { message?: string; code?: number; type?: string };
};

function resolveValidatedFacebookValue(
  names: readonly string[],
  validator: (value: string) => boolean,
): string | null {
  for (const name of names) {
    const value = normalizeMetaRuntimeValue(process.env[name]);
    if (value && validator(value)) return value;
  }
  return null;
}

function resolveFacebookAppId(): string | null {
  return resolveValidatedFacebookValue(
    ["FACEBOOK_APP_ID", "META_APP_ID"],
    isUsableMetaAppId,
  );
}

function resolveFacebookAppSecret(): string | null {
  return resolveValidatedFacebookValue(
    ["FACEBOOK_APP_SECRET", "META_APP_SECRET"],
    isUsableMetaAppSecret,
  );
}

function resolveFacebookRedirectUri(): string | null {
  for (const name of ["FACEBOOK_REDIRECT_URI", "META_REDIRECT_URI"] as const) {
    const value = normalizeMetaCallbackUrl(
      process.env[name],
      "/api/integrations/facebook/callback",
    );
    if (value) return value;
  }
  return null;
}

export function isFacebookOAuthRuntimeReady(): boolean {
  return Boolean(
    resolveFacebookAppId() &&
      resolveFacebookAppSecret() &&
      resolveFacebookRedirectUri() &&
      isTokenEncryptionConfigured(),
  );
}

export function getFacebookOAuthUrl(
  state: string,
  scopes: readonly string[] = FACEBOOK_MESSAGES_OAUTH_SCOPES,
): string {
  const appId = requireFacebookAppId();
  const redirectUri = requireFacebookRedirectUri();
  const url = new URL(`https://www.facebook.com/${OAUTH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("auth_type", "rerequest");
  url.searchParams.set("scope", scopes.join(","));
  return url.toString();
}

export function createFacebookOAuthState(
  input: Omit<FacebookOAuthState, "nonce" | "issuedAt">,
): string {
  const payload: FacebookOAuthState = {
    ...input,
    nonce: randomBytes(16).toString("hex"),
    issuedAt: Math.floor(Date.now() / 1000),
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  return `${encoded}.${signState(encoded)}`;
}

export function verifyFacebookOAuthState(
  state: string | null,
): FacebookOAuthState | null {
  if (!state) return null;
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) return null;
  if (!safeEqual(signature, signState(encoded))) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as FacebookOAuthState;
    const now = Math.floor(Date.now() / 1000);
    if (
      !payload.workspaceId ||
      !payload.userId ||
      !payload.nonce ||
      !payload.issuedAt
    )
      return null;
    if (now - payload.issuedAt > STATE_MAX_AGE_SECONDS) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createPendingFacebookPageSelection(input: {
  workspaceId: string;
  userId: string;
  userAccessToken: string;
  connectionType: FacebookPageSelectionConnectionType;
}): string | null {
  const payload: FacebookPageSelectionPayload = {
    version: 1,
    workspaceId: input.workspaceId,
    userId: input.userId,
    userAccessToken: input.userAccessToken,
    connectionType: input.connectionType,
    issuedAt: Math.floor(Date.now() / 1000),
  };
  return encryptToken(JSON.stringify(payload));
}

export function verifyPendingFacebookPageSelection(
  encryptedPayload: string | null | undefined,
): FacebookPageSelectionPayload | null {
  if (!encryptedPayload) return null;
  try {
    const decrypted = decryptToken(encryptedPayload);
    if (!decrypted) return null;
    return normalizeFacebookPageSelectionPayload(JSON.parse(decrypted));
  } catch {
    return null;
  }
}

export async function exchangeFacebookCode(code: string): Promise<string> {
  const url = new URL(
    `https://graph.facebook.com/${OAUTH_VERSION}/oauth/access_token`,
  );
  url.searchParams.set(
    "client_id",
    requireFacebookAppId(),
  );
  url.searchParams.set(
    "client_secret",
    requireFacebookAppSecret(),
  );
  url.searchParams.set(
    "redirect_uri",
    requireFacebookRedirectUri(),
  );
  url.searchParams.set("code", code);

  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as {
    access_token?: string;
    error?: { message?: string; code?: number; type?: string };
  } | null;
  if (!response.ok || !payload?.access_token) {
    logFacebookApiError("Facebook OAuth code exchange failed", payload?.error);
    throw new Error("Facebook OAuth-Code konnte nicht getauscht werden.");
  }
  return payload.access_token;
}

export async function fetchFacebookGrantedPermissions(
  userAccessToken: string,
): Promise<FacebookPermissionStatus[] | null> {
  const url = new URL(
    `https://graph.facebook.com/${OAUTH_VERSION}/me/permissions`,
  );
  url.searchParams.set("access_token", userAccessToken);

  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as {
    data?: FacebookPermissionStatus[];
    error?: { message?: string; code?: number; type?: string };
  } | null;

  if (!response.ok) {
    logFacebookApiError("Facebook permissions fetch failed", payload?.error);
    return null;
  }

  const permissions = payload?.data ?? [];
  const requiredPermissionDiagnostics = REQUIRED_FACEBOOK_PAGE_PERMISSIONS.map(
    (requiredPermission) => {
      const permission = permissions.find(
        (entry) => entry.permission === requiredPermission,
      );
      return {
        permission: requiredPermission,
        status: permission?.status ?? "missing",
      };
    },
  );

  console.info("Facebook permissions diagnostics", {
    permissions: requiredPermissionDiagnostics,
  });

  return permissions;
}

export function getGrantedFacebookPermissionNames(
  permissions: FacebookPermissionStatus[] | null,
): string[] {
  return (permissions ?? [])
    .filter((entry) => entry.status === "granted")
    .map((entry) => entry.permission);
}

export function getFacebookGrantedScopeNames(
  diagnostics: FacebookTokenDiagnostics | null,
): string[] {
  const scopes = new Set<string>();
  for (const scope of diagnostics?.scopes ?? []) {
    if (scope) scopes.add(scope);
  }
  for (const granularScope of diagnostics?.granular_scopes ?? []) {
    if (granularScope.scope) scopes.add(granularScope.scope);
  }
  return [...scopes].sort();
}

export function hasFacebookPagesMessagingScope(
  scopes: string[] | null | undefined,
): boolean {
  return Boolean(scopes?.includes(FACEBOOK_PAGES_MESSAGING_SCOPE));
}

export function hasFacebookPagesReadUserContentScope(
  scopes: string[] | null | undefined,
): boolean {
  return Boolean(scopes?.includes(FACEBOOK_PAGES_READ_USER_CONTENT_SCOPE));
}

export function hasFacebookCommentFeedScopes(
  scopes: string[] | null | undefined,
): boolean {
  return FACEBOOK_COMMENT_FEED_SCOPES.every((scope) => scopes?.includes(scope));
}

export function hasFacebookInsightsScopes(
  scopes: string[] | null | undefined,
): boolean {
  return FACEBOOK_INSIGHTS_OAUTH_SCOPES.every((scope) =>
    scopes?.includes(scope),
  );
}

export function hasRequiredFacebookPagePermissions(
  permissions: FacebookPermissionStatus[] | null,
): boolean {
  if (!permissions) return true;

  return REQUIRED_FACEBOOK_PAGE_PERMISSIONS.every((requiredPermission) =>
    permissions.some(
      (entry) =>
        entry.permission === requiredPermission && entry.status === "granted",
    ),
  );
}

export async function fetchFacebookPages(
  userAccessToken: string,
): Promise<FacebookPage[]> {
  const primary = await fetchFacebookPagesFromAccountsEdge(userAccessToken);
  if (primary.pages.length > 0) return primary.pages;

  console.warn("Facebook /me/accounts returned no usable pages", {
    httpStatus: primary.httpStatus,
    pageCount: primary.pages.length,
    pagesMissingAccessToken: primary.pagesMissingAccessToken,
    hasMetaError: Boolean(primary.error),
    errorCode: primary.error?.code,
    errorType: primary.error?.type,
  });

  const fallback = await fetchFacebookPagesFromMeAccountsField(userAccessToken);
  if (fallback.pages.length > 0) {
    console.info("Facebook pages recovered through /me accounts field", {
      pageCount: fallback.pages.length,
      pagesMissingAccessToken: fallback.pagesMissingAccessToken,
    });
    return fallback.pages;
  }

  console.warn("Facebook pages fetch returned 0 pages after fallback", {
    primaryHttpStatus: primary.httpStatus,
    fallbackHttpStatus: fallback.httpStatus,
    primaryMetaError: primary.error
      ? {
          code: primary.error.code,
          type: primary.error.type,
        }
      : null,
    fallbackMetaError: fallback.error
      ? {
          code: fallback.error.code,
          type: fallback.error.type,
        }
      : null,
  });

  const diagnostics = await fetchFacebookTokenDiagnostics(userAccessToken);
  const targetIds = getFacebookGranularPageTargetIds(diagnostics);
  if (targetIds.length === 0) return [];

  const recoveredPages = await fetchFacebookPagesFromGranularTargets(
    userAccessToken,
    targetIds,
  );
  if (recoveredPages.length > 0) return recoveredPages;

  return [];
}

export type FacebookMessengerConversation = {
  id: string;
  link: string | null;
  updatedTime: string | null;
  participants: Array<{ id: string; name: string | null }>;
  senders: Array<{ id: string; name: string | null }>;
  snippet: string | null;
  canReply: boolean | null;
  scopedThreadKey: string | null;
  messageCount: number | null;
};

export type FacebookMessengerConversationPage = {
  conversations: FacebookMessengerConversation[];
  nextAfter: string | null;
};

export type FacebookMessengerMessage = {
  id: string;
  createdTime: string | null;
  message: string | null;
  from: { id: string; name: string | null } | null;
  to: Array<{ id: string; name: string | null }>;
  link: string | null;
  sourceUrl: string | null;
  replyTargetUrl: string | null;
  shares: Array<{ url: string | null }>;
  tags: string[];
  attachments: Array<{
    type: "image" | "video" | "audio" | "file" | "unknown";
    url?: string;
    name?: string;
    title?: string;
    mime_type?: string;
    size?: number;
  }> | null;
};

export type FacebookConversationFieldProbe = {
  label: string;
  endpoint: string;
  fields: string;
  ok: boolean;
  conversationCount: number;
  linkFieldPresent: boolean;
  selectedItemIdInLink: boolean;
  participantsPresent: boolean;
  participantMatchesKnownHandle: boolean | null;
  snippetFieldPresent: boolean;
  canReplyFieldPresent: boolean;
  scopedThreadKeyFieldPresent: boolean;
  sendersPresent: boolean;
  messageCountFieldPresent: boolean;
  observedKeys: string[];
  note: string;
};

export type FacebookMessageFieldProbe = {
  label: string;
  endpoint: string;
  fields: string;
  ok: boolean;
  messageCount: number;
  fromFieldPresent: boolean;
  toFieldPresent: boolean;
  attachmentsFieldPresent: boolean;
  sharesFieldPresent: boolean;
  tagsFieldPresent: boolean;
  linkFieldPresent: boolean;
  businessInboxUrlFound: boolean;
  selectedItemIdFound: boolean;
  selectedItemIdSource: "message_field" | "share" | "attachment" | "not_detected";
  usedFallback: boolean;
  observedKeys: string[];
  note: string;
};

const FACEBOOK_MESSENGER_CONVERSATION_FIELD_SETS = [
  "id,link,updated_time,participants{id,name},senders{id,name},snippet,can_reply,scoped_thread_key,message_count",
  "id,link,updated_time,participants{id,name},snippet,can_reply,scoped_thread_key",
  "id,link,updated_time,participants{id,name}",
  "id,updated_time,participants{id,name}",
] as const;

const FACEBOOK_MESSENGER_MESSAGE_FIELD_SETS = [
  "id,created_time,message,from{id,name},to{id,name},link,source_url,reply_target_url,attachments{id,mime_type,name,size,image_data,video_data,file_url,url,target},shares,tags",
  "id,created_time,message,from{id,name},to{id,name},attachments{id,mime_type,name,size,image_data,video_data,file_url,url,target},shares,tags",
  "id,created_time,message,from{id,name},attachments{id,mime_type,name,size,image_data,video_data,file_url}",
] as const;

export async function fetchFacebookMessengerConversations(
  pageId: string,
  pageAccessToken: string,
  limit = 10,
): Promise<FacebookMessengerConversation[]> {
  const page = await fetchFacebookMessengerConversationPage(
    pageId,
    pageAccessToken,
    limit,
  );
  return page.conversations;
}

export async function fetchFacebookMessengerConversationPage(
  pageId: string,
  pageAccessToken: string,
  limit = 25,
  after?: string | null,
  deadlineMs?: number,
): Promise<FacebookMessengerConversationPage> {
  const normalizedAfter = after == null
    ? null
    : normalizeMetaPagingCursor(after);
  if (after != null && !normalizedAfter) {
    throw new Error("Ungültiger Facebook-Paging-Cursor blockiert.");
  }

  for (let index = 0; index < FACEBOOK_MESSENGER_CONVERSATION_FIELD_SETS.length; index += 1) {
    const fields = FACEBOOK_MESSENGER_CONVERSATION_FIELD_SETS[index];
    const fallbackActive = index > 0;
    try {
      return await fetchFacebookMessengerConversationsWithFields(
        pageId,
        pageAccessToken,
        limit,
        fields,
        normalizedAfter,
        deadlineMs,
      );
    } catch (error) {
      if (!(error instanceof FacebookFieldFetchError) || !error.retryable) {
        throw error;
      }
      if (fallbackActive) {
        console.info("Facebook Messenger conversation field fallback active", {
          fallbackFrom: FACEBOOK_MESSENGER_CONVERSATION_FIELD_SETS[index - 1],
          fallbackTo: fields,
          errorCode: error.code,
          errorType: error.type,
        });
      }
    }
  }

  throw new Error(
    "Facebook Messenger Conversations konnten mit keinem stabilen Feldset abgerufen werden.",
  );
}

export async function probeFacebookMessengerConversationFieldSets(input: {
  pageId: string;
  pageAccessToken: string;
  knownParticipantId?: string | null;
  limit?: number;
}): Promise<FacebookConversationFieldProbe[]> {
  const fieldSets = [
    {
      label: "Standard Conversations",
      fields: "id,link,updated_time,participants{id,name}",
    },
    {
      label: "Conversation Extended Metadata",
      fields:
        "id,link,updated_time,participants{id,name},senders{id,name},snippet,can_reply,scoped_thread_key,message_count",
    },
    {
      label: "Conversation Metadata",
      fields:
        "id,updated_time,participants{id,name},snippet,can_reply,scoped_thread_key",
    },
    {
      label: "Conversation Metadata With Link",
      fields:
        "id,link,updated_time,participants{id,name},snippet,can_reply,scoped_thread_key",
    },
  ] as const;

  return Promise.all(
    fieldSets.map((fieldSet) =>
      probeFacebookMessengerConversationFieldSet({
        pageId: input.pageId,
        pageAccessToken: input.pageAccessToken,
        knownParticipantId: input.knownParticipantId ?? null,
        limit: input.limit,
        label: fieldSet.label,
        fields: fieldSet.fields,
      }),
    ),
  );
}

export async function probeFacebookMessengerMessageFieldSet(input: {
  conversationId: string;
  pageAccessToken: string;
  limit?: number;
}): Promise<FacebookMessageFieldProbe> {
  const endpoint = `/${input.conversationId}/messages`;
  const maxLimit = Math.max(1, Math.min(input.limit ?? 5, 10));

  let rows: Record<string, unknown>[] = [];
  let fields: string = FACEBOOK_MESSENGER_MESSAGE_FIELD_SETS[0];
  let usedFallback = false;
  let lastErrorMessage: string | null = null;

  for (let index = 0; index < FACEBOOK_MESSENGER_MESSAGE_FIELD_SETS.length; index += 1) {
    fields = FACEBOOK_MESSENGER_MESSAGE_FIELD_SETS[index];
    const url = buildFacebookMessengerMessagesUrl(
      input.conversationId,
      input.pageAccessToken,
      maxLimit,
      fields,
    );
    const response = await fetch(url, { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as {
      data?: unknown[];
      error?: { message?: string; code?: number; type?: string };
    } | null;

    if (response.ok) {
      rows = (payload?.data ?? []).filter(isRecord);
      usedFallback = index > 0;
      lastErrorMessage = null;
      break;
    }

    lastErrorMessage = "Messages-Endpunkt lieferte keine nutzbare Antwort.";
    if (!isFacebookFieldError(payload?.error)) {
      return {
        label: "Messages Probe",
        endpoint,
        fields,
        ok: false,
        messageCount: 0,
        fromFieldPresent: false,
        toFieldPresent: false,
        attachmentsFieldPresent: false,
        sharesFieldPresent: false,
        tagsFieldPresent: false,
        linkFieldPresent: false,
        businessInboxUrlFound: false,
        selectedItemIdFound: false,
        selectedItemIdSource: "not_detected",
        usedFallback,
        observedKeys: [],
        note: lastErrorMessage,
      };
    }
  }

  if (!rows.length && lastErrorMessage) {
    return {
      label: "Messages Probe",
      endpoint,
      fields,
      ok: false,
      messageCount: 0,
      fromFieldPresent: false,
      toFieldPresent: false,
      attachmentsFieldPresent: false,
      sharesFieldPresent: false,
      tagsFieldPresent: false,
      linkFieldPresent: false,
      businessInboxUrlFound: false,
      selectedItemIdFound: false,
      selectedItemIdSource: "not_detected",
      usedFallback,
      observedKeys: [],
      note: lastErrorMessage,
    };
  }

  const normalizedMessages = rows.map(normalizeGraphMessage);
  const observedKeys = summarizeObservedGraphKeys(rows);
  const fromFieldPresent = rows.some((row) => isRecord(row.from));
  const toFieldPresent = rows.some(
    (row) => isRecord(row.to) && Array.isArray(row.to.data),
  );
  const attachmentsFieldPresent = rows.some(
    (row) => isRecord(row.attachments) && Array.isArray(row.attachments.data),
  );
  const sharesFieldPresent = rows.some(
    (row) => isRecord(row.shares) && Array.isArray(row.shares.data),
  );
  const tagsFieldPresent = rows.some((row) => {
    if (Array.isArray(row.tags)) return true;
    return isRecord(row.tags) && Array.isArray(row.tags.data);
  });
  const linkFieldPresent = normalizedMessages.some(
    (message) => Boolean(message.link || message.sourceUrl || message.replyTargetUrl),
  );

  let selectedItemIdSource: FacebookMessageFieldProbe["selectedItemIdSource"] =
    "not_detected";
  let selectedItemIdFound = false;
  let businessInboxUrlFound = false;

  for (const message of normalizedMessages) {
    const messageFieldUrls = [message.link, message.sourceUrl, message.replyTargetUrl];
    if (
      messageFieldUrls.some((url) =>
        isBusinessInboxUrl(url),
      )
    ) {
      businessInboxUrlFound = true;
    }
    if (
      !selectedItemIdFound &&
      messageFieldUrls.some((url) => hasSelectedItemId(url))
    ) {
      selectedItemIdFound = true;
      selectedItemIdSource = "message_field";
    }
    if (
      !selectedItemIdFound &&
      message.shares.some((share) => hasSelectedItemId(share.url))
    ) {
      selectedItemIdFound = true;
      selectedItemIdSource = "share";
    }
    if (
      !selectedItemIdFound &&
      message.attachments?.some((attachment) => hasSelectedItemId(attachment.url ?? null))
    ) {
      selectedItemIdFound = true;
      selectedItemIdSource = "attachment";
    }
    if (
      !businessInboxUrlFound &&
      (message.shares.some((share) => isBusinessInboxUrl(share.url)) ||
        Boolean(
          message.attachments?.some((attachment) =>
            isBusinessInboxUrl(attachment.url ?? null),
          ),
        ))
    ) {
      businessInboxUrlFound = true;
    }
  }

  return {
    label: "Messages Probe",
    endpoint,
    fields,
    ok: true,
    messageCount: normalizedMessages.length,
    fromFieldPresent,
    toFieldPresent,
    attachmentsFieldPresent,
    sharesFieldPresent,
    tagsFieldPresent,
    linkFieldPresent,
    businessInboxUrlFound,
    selectedItemIdFound,
    selectedItemIdSource,
    usedFallback,
    observedKeys,
    note: fromFieldPresent
      ? "Messages-Feldset wurde verarbeitet."
      : "Messages-Feldset enthält kein from-Feld in der Stichprobe.",
  };
}

async function fetchFacebookMessengerConversationsWithFields(
  pageId: string,
  pageAccessToken: string,
  limit: number,
  fields: string,
  after: string | null,
  deadlineMs?: number,
): Promise<FacebookMessengerConversationPage> {
  const url = new URL(
    `https://graph.facebook.com/${OAUTH_VERSION}/${encodeURIComponent(pageId)}/conversations`,
  );
  url.searchParams.set("platform", "messenger");
  url.searchParams.set("fields", fields);
  url.searchParams.set("limit", String(Math.max(1, Math.min(limit, 25))));
  if (after) url.searchParams.set("after", after);
  url.searchParams.set("access_token", pageAccessToken);

  const response = await fetch(url, {
    cache: "no-store",
    signal: deadlineMs == null
      ? undefined
      : createMetaConversationSyncAbortSignal(deadlineMs),
  });
  const payload = (await response.json().catch(() => null)) as {
    data?: unknown[];
    paging?: { next?: string };
    error?: { message?: string; code?: number; type?: string };
  } | null;
  if (!response.ok) {
    if (isFacebookFieldError(payload?.error)) {
      throw new FacebookFieldFetchError(
        "Facebook-Feldset wurde abgelehnt.",
        payload?.error?.code,
        payload?.error?.type,
        true,
      );
    }
    logFacebookApiError(
      "Facebook Messenger conversations fetch failed",
      payload?.error,
    );
    throw new Error(
      "Facebook Messenger Conversations konnten nicht abgerufen werden.",
    );
  }

  const conversations = (payload?.data ?? [])
    .filter(isRecord)
    .map((conversation) => ({
      id: stringValue(conversation.id) ?? "",
      link: validUrl(stringValue(conversation.link)),
      updatedTime: stringValue(conversation.updated_time),
      senders: normalizeActorArray(conversation.senders),
      participants: (isRecord(conversation.participants) &&
      Array.isArray(conversation.participants.data)
        ? conversation.participants.data
        : []
      )
        .filter(isRecord)
        .map((participant) => ({
          id: stringValue(participant.id) ?? "",
          name: stringValue(participant.name),
        }))
        .filter((participant) => participant.id),
      snippet: stringValue(conversation.snippet),
      canReply:
        typeof conversation.can_reply === "boolean"
          ? conversation.can_reply
          : null,
      scopedThreadKey:
        stringValue(conversation.scoped_thread_key) ??
        numberValue(conversation.scoped_thread_key)?.toString() ??
        null,
      messageCount: numberValue(conversation.message_count),
    }))
    .filter((conversation) => conversation.id);

  return {
    conversations,
    nextAfter: resolveFacebookGraphPagingCursor(
      payload?.paging?.next ?? null,
    ),
  };
}

async function probeFacebookMessengerConversationFieldSet(input: {
  pageId: string;
  pageAccessToken: string;
  knownParticipantId?: string | null;
  limit?: number;
  label: string;
  fields: string;
}): Promise<FacebookConversationFieldProbe> {
  const endpoint = `/${input.pageId}/conversations`;
  const url = new URL(
    `https://graph.facebook.com/${OAUTH_VERSION}/${encodeURIComponent(input.pageId)}/conversations`,
  );
  url.searchParams.set("platform", "messenger");
  url.searchParams.set("fields", input.fields);
  url.searchParams.set(
    "limit",
    String(Math.max(1, Math.min(input.limit ?? 5, 10))),
  );
  url.searchParams.set("access_token", input.pageAccessToken);

  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as {
    data?: unknown[];
    error?: { message?: string; code?: number; type?: string };
  } | null;

  if (!response.ok) {
    return {
      label: input.label,
      endpoint,
      fields: input.fields,
      ok: false,
      conversationCount: 0,
      linkFieldPresent: false,
      selectedItemIdInLink: false,
      participantsPresent: false,
      participantMatchesKnownHandle: null,
      snippetFieldPresent: false,
      canReplyFieldPresent: false,
      scopedThreadKeyFieldPresent: false,
      sendersPresent: false,
      messageCountFieldPresent: false,
      observedKeys: [],
      note: "Conversation-Endpunkt lieferte keine nutzbare Antwort.",
    };
  }

  const rows = (payload?.data ?? []).filter(isRecord);
  const observedKeys = summarizeObservedGraphKeys(rows);
  const linkFieldPresent = rows.some((row) => stringValue(row.link));
  const selectedItemIdInLink = rows.some((row) => {
    const link = stringValue(row.link);
    if (!link) return false;
    try {
      return Boolean(new URL(link).searchParams.get("selected_item_id"));
    } catch {
      return false;
    }
  });
  const participantsPresent = rows.some(
    (row) =>
      isRecord(row.participants) && Array.isArray(row.participants.data),
  );
  const participantMatchesKnownHandle = input.knownParticipantId
    ? rows.some((row) => {
        const participants =
          isRecord(row.participants) && Array.isArray(row.participants.data)
            ? row.participants.data.filter(isRecord)
            : [];
        return participants.some(
          (participant) =>
            stringValue(participant.id) === input.knownParticipantId,
        );
      })
    : null;
  const snippetFieldPresent = rows.some((row) => stringValue(row.snippet));
  const canReplyFieldPresent = rows.some(
    (row) => typeof row.can_reply === "boolean",
  );
  const scopedThreadKeyFieldPresent = rows.some((row) => {
    const value = row.scoped_thread_key;
    return typeof value === "string" || typeof value === "number";
  });
  const sendersPresent = rows.some(
    (row) => isRecord(row.senders) && Array.isArray(row.senders.data),
  );
  const messageCountFieldPresent = rows.some(
    (row) => typeof row.message_count === "number",
  );

  return {
    label: input.label,
    endpoint,
    fields: input.fields,
    ok: true,
    conversationCount: rows.length,
    linkFieldPresent,
    selectedItemIdInLink,
    participantsPresent,
    participantMatchesKnownHandle,
    snippetFieldPresent,
    canReplyFieldPresent,
    scopedThreadKeyFieldPresent,
    sendersPresent,
    messageCountFieldPresent,
    observedKeys,
    note: selectedItemIdInLink
      ? "Eine Direktlink-ID wurde in einem Conversation-Link erkannt."
      : "In diesem Feldset wurde keine Direktlink-ID erkannt.",
  };
}

export async function fetchFacebookMessengerConversationMessages(
  conversationId: string,
  pageAccessToken: string,
  limit = 50,
  since?: string | null,
  deadlineMs?: number,
): Promise<FacebookMessengerMessage[]> {
  const targetLimit = Math.max(1, Math.min(limit, 150));
  const messages: FacebookMessengerMessage[] = [];
  const seenIds = new Set<string>();
  let fieldSetIndex = 0;
  let nextUrl: string | null = buildFacebookMessengerMessagesUrl(
    conversationId,
    pageAccessToken,
    targetLimit,
    FACEBOOK_MESSENGER_MESSAGE_FIELD_SETS[fieldSetIndex],
    since,
  ).toString();

  while (nextUrl && messages.length < targetLimit) {
    const response = await fetch(nextUrl, {
      cache: "no-store",
      signal: deadlineMs == null
        ? undefined
        : createMetaConversationSyncAbortSignal(deadlineMs),
    });
    const payload = (await response.json().catch(() => null)) as {
      data?: unknown[];
      paging?: { next?: string };
      error?: { message?: string; code?: number; type?: string };
    } | null;
    if (!response.ok) {
      if (
        messages.length === 0 &&
        isFacebookFieldError(payload?.error) &&
        fieldSetIndex < FACEBOOK_MESSENGER_MESSAGE_FIELD_SETS.length - 1
      ) {
        const previousFields = FACEBOOK_MESSENGER_MESSAGE_FIELD_SETS[fieldSetIndex];
        fieldSetIndex += 1;
        const fallbackFields = FACEBOOK_MESSENGER_MESSAGE_FIELD_SETS[fieldSetIndex];
        console.info("Facebook Messenger message field fallback active", {
          fallbackFrom: previousFields,
          fallbackTo: fallbackFields,
          errorCode: payload?.error?.code,
          errorType: payload?.error?.type,
        });
        nextUrl = buildFacebookMessengerMessagesUrl(
          conversationId,
          pageAccessToken,
          targetLimit,
          fallbackFields,
          since,
        ).toString();
        continue;
      }
      logFacebookApiError(
        "Facebook Messenger conversation messages fetch failed",
        payload?.error,
      );
      throw new Error(
        "Facebook Messenger Nachrichten konnten nicht abgerufen werden.",
      );
    }

    for (const message of (payload?.data ?? [])
      .filter(isRecord)
      .map(normalizeGraphMessage)
      .filter((message) => message.id)) {
      if (seenIds.has(message.id)) continue;
      messages.push(message);
      seenIds.add(message.id);
      if (messages.length >= targetLimit) break;
    }

    nextUrl =
      messages.length < targetLimit
        ? validateFacebookGraphPagingUrl(payload?.paging?.next ?? null)
        : null;
  }

  return messages;
}

function buildFacebookMessengerMessagesUrl(
  conversationId: string,
  pageAccessToken: string,
  limit: number,
  fields: string,
  since?: string | null,
): URL {
  const url = new URL(
    `https://graph.facebook.com/${OAUTH_VERSION}/${encodeURIComponent(conversationId)}/messages`,
  );
  url.searchParams.set("fields", fields);
  url.searchParams.set("limit", String(Math.max(1, Math.min(limit, 50))));
  const sinceTimestamp = since ? Date.parse(since) : Number.NaN;
  if (Number.isFinite(sinceTimestamp)) {
    url.searchParams.set(
      "since",
      String(Math.max(0, Math.floor(sinceTimestamp / 1_000) - 300)),
    );
  }
  url.searchParams.set("access_token", pageAccessToken);
  return url;
}

function normalizeGraphMessage(
  message: Record<string, unknown>,
): FacebookMessengerMessage {
  const from = isRecord(message.from) ? message.from : null;
  const toRows =
    isRecord(message.to) && Array.isArray(message.to.data)
      ? message.to.data.filter(isRecord)
      : [];
  const normalizedShares = normalizeGraphMessageShares(message.shares);
  const normalizedTags = normalizeGraphMessageTags(message.tags);
  return {
    id: stringValue(message.id) ?? "",
    createdTime: stringValue(message.created_time),
    message: stringValue(message.message),
    from: from
      ? { id: stringValue(from.id) ?? "", name: stringValue(from.name) }
      : null,
    to: toRows
      .map((entry) => ({
        id: stringValue(entry.id) ?? "",
        name: stringValue(entry.name),
      }))
      .filter((entry) => entry.id),
    link: validUrl(stringValue(message.link)),
    sourceUrl: validUrl(stringValue(message.source_url)),
    replyTargetUrl: validUrl(stringValue(message.reply_target_url)),
    shares: normalizedShares,
    tags: normalizedTags,
    attachments: normalizeGraphMessageAttachments(message.attachments),
  };
}

type FacebookMessengerAttachment = NonNullable<
  FacebookMessengerMessage["attachments"]
>[number];

function normalizeGraphMessageAttachments(
  value: unknown,
): FacebookMessengerMessage["attachments"] {
  const raw = isRecord(value) && Array.isArray(value.data) ? value.data : [];
  const attachments = raw.filter(isRecord).map((attachment) => {
    const imageData = isRecord(attachment.image_data)
      ? attachment.image_data
      : undefined;
    const videoData = isRecord(attachment.video_data)
      ? attachment.video_data
      : undefined;
    const target = isRecord(attachment.target) ? attachment.target : undefined;
    const fileUrl = stringValue(attachment.file_url);
    const mime = stringValue(attachment.mime_type);
    const url = validUrl(
      stringValue(imageData?.url) ??
        stringValue(videoData?.url) ??
        fileUrl ??
        stringValue(attachment.url) ??
        stringValue(target?.url),
    );
    return {
      type: mime?.startsWith("image/")
        ? "image"
        : mime?.startsWith("video/")
          ? "video"
          : mime?.startsWith("audio/")
            ? "audio"
            : fileUrl
              ? "file"
              : "unknown",
      ...(url ? { url } : {}),
      ...(stringValue(attachment.name)
        ? { name: stringValue(attachment.name)! }
        : {}),
      ...(mime ? { mime_type: mime } : {}),
      ...(numberValue(attachment.size)
        ? { size: numberValue(attachment.size)! }
        : {}),
    } satisfies FacebookMessengerAttachment;
  });
  return attachments.length ? attachments : null;
}

function normalizeGraphMessageShares(
  value: unknown,
): FacebookMessengerMessage["shares"] {
  const rows =
    isRecord(value) && Array.isArray(value.data) ? value.data.filter(isRecord) : [];
  return rows.map((share) => ({
    url: validUrl(stringValue(share.link) ?? stringValue(share.url)),
  }));
}

function normalizeGraphMessageTags(value: unknown): string[] {
  const values = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.data)
      ? value.data
      : [];
  return values
    .map((entry) =>
      typeof entry === "string"
        ? entry
        : isRecord(entry)
          ? stringValue(entry.name) ?? stringValue(entry.value)
          : null,
    )
    .filter((entry): entry is string => Boolean(entry));
}

function normalizeActorArray(
  value: unknown,
): Array<{ id: string; name: string | null }> {
  const rows = isRecord(value) && Array.isArray(value.data) ? value.data : [];
  return rows
    .filter(isRecord)
    .map((entry) => ({
      id: stringValue(entry.id) ?? "",
      name: stringValue(entry.name),
    }))
    .filter((entry) => entry.id);
}

function isBusinessInboxUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.hostname.toLowerCase() === "business.facebook.com" &&
      url.pathname.toLowerCase().includes("/inbox")
    );
  } catch {
    return false;
  }
}

function hasSelectedItemId(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return Boolean(url.searchParams.get("selected_item_id"));
  } catch {
    return false;
  }
}

const GRAPH_KEY_SUMMARY_LIMIT = 80;
const GRAPH_KEY_SUMMARY_DEPTH = 3;

function summarizeObservedGraphKeys(rows: Record<string, unknown>[]): string[] {
  const keys = new Set<string>();

  for (const row of rows) {
    collectObservedGraphKeys(row, "", keys, GRAPH_KEY_SUMMARY_DEPTH);
    if (keys.size >= GRAPH_KEY_SUMMARY_LIMIT) break;
  }

  return [...keys].sort().slice(0, GRAPH_KEY_SUMMARY_LIMIT);
}

function collectObservedGraphKeys(
  value: unknown,
  prefix: string,
  keys: Set<string>,
  depth: number,
): void {
  if (keys.size >= GRAPH_KEY_SUMMARY_LIMIT || depth < 0) return;

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectObservedGraphKeys(entry, prefix, keys, depth);
      if (keys.size >= GRAPH_KEY_SUMMARY_LIMIT) return;
    }
    return;
  }

  if (!isRecord(value)) return;

  for (const [key, nestedValue] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    keys.add(path);
    if (keys.size >= GRAPH_KEY_SUMMARY_LIMIT) return;
    if (depth > 0 && (isRecord(nestedValue) || Array.isArray(nestedValue))) {
      collectObservedGraphKeys(nestedValue, path, keys, depth - 1);
    }
  }
}

class FacebookFieldFetchError extends Error {
  code?: number;
  type?: string;
  retryable: boolean;

  constructor(
    message: string,
    code?: number,
    type?: string,
    retryable = false,
  ) {
    super(message);
    this.name = "FacebookFieldFetchError";
    this.code = code;
    this.type = type;
    this.retryable = retryable;
  }
}

type FacebookRawPage = {
  id?: string;
  name?: string;
  access_token?: string;
  perms?: string[];
  tasks?: string[];
};

export async function fetchFacebookTokenDiagnostics(
  userAccessToken: string,
): Promise<FacebookTokenDiagnostics | null> {
  const url = new URL(
    `https://graph.facebook.com/${OAUTH_VERSION}/debug_token`,
  );
  url.searchParams.set("input_token", userAccessToken);
  url.searchParams.set(
    "access_token",
    `${requireFacebookAppId()}|${requireFacebookAppSecret()}`,
  );

  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as {
    data?: FacebookTokenDiagnostics;
    error?: { message?: string; code?: number; type?: string };
  } | null;
  const diagnostics = payload?.data ?? null;
  const error = payload?.error ?? diagnostics?.error;

  console.info("Facebook token diagnostics", {
    httpStatus: response.status,
    appId: diagnostics?.app_id,
    isValid: diagnostics?.is_valid,
    userIdPresent: Boolean(diagnostics?.user_id),
    scopes: diagnostics?.scopes ?? [],
    granularScopes: (diagnostics?.granular_scopes ?? []).map((entry) => ({
      scope: entry.scope,
      targetCount: entry.target_ids?.length ?? 0,
    })),
    errorCode: error?.code,
    errorType: error?.type,
  });

  if (!response.ok) {
    logFacebookApiError("Facebook debug_token fetch failed", error);
    return null;
  }

  return diagnostics;
}

function getFacebookGranularPageTargetIds(
  diagnostics: FacebookTokenDiagnostics | null,
): string[] {
  const relevantScopes = new Set<string>(REQUIRED_FACEBOOK_PAGE_PERMISSIONS);
  const targetCounts = new Map<string, number>();

  for (const granularScope of diagnostics?.granular_scopes ?? []) {
    if (!granularScope.scope || !relevantScopes.has(granularScope.scope)) {
      continue;
    }

    for (const targetId of granularScope.target_ids ?? []) {
      if (!targetId) continue;
      targetCounts.set(targetId, (targetCounts.get(targetId) ?? 0) + 1);
    }
  }

  const preferredTargets = [...targetCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([targetId]) => targetId);
  const targetIds =
    preferredTargets.length > 0 ? preferredTargets : [...targetCounts.keys()];

  console.info("Facebook granular page targets detected", {
    targetCount: targetIds.length,
  });

  return targetIds;
}

async function fetchFacebookPagesFromGranularTargets(
  userAccessToken: string,
  targetIds: string[],
): Promise<FacebookPage[]> {
  const pages: FacebookPage[] = [];

  for (const targetId of targetIds) {
    const page = await fetchFacebookPageById(userAccessToken, targetId);
    if (!page) continue;

    console.info("Facebook page recovered from granular scope target", {
      hasAccessToken: Boolean(page.accessToken),
    });
    pages.push(page);
  }

  return pages;
}

async function fetchFacebookPageById(
  userAccessToken: string,
  pageId: string,
): Promise<FacebookPage | null> {
  const withToken = await fetchFacebookPageByIdWithFields(
    userAccessToken,
    pageId,
    "id,name,access_token",
  );

  if (withToken.page || !isFacebookFieldError(withToken.error)) {
    return withToken.page;
  }

  console.warn("Facebook direct page fetch without access_token fallback", {
    errorCode: withToken.error?.code,
    errorType: withToken.error?.type,
  });

  const withoutToken = await fetchFacebookPageByIdWithFields(
    userAccessToken,
    pageId,
    "id,name",
  );
  return withoutToken.page;
}

type FacebookDirectPageFetchResult = {
  page: FacebookPage | null;
  error?: { message?: string; code?: number; type?: string };
};

async function fetchFacebookPageByIdWithFields(
  userAccessToken: string,
  pageId: string,
  fields: "id,name,access_token" | "id,name",
): Promise<FacebookDirectPageFetchResult> {
  const url = new URL(`https://graph.facebook.com/${OAUTH_VERSION}/${pageId}`);
  url.searchParams.set("fields", fields);
  url.searchParams.set("access_token", userAccessToken);

  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as
    | (FacebookRawPage & {
        error?: { message?: string; code?: number; type?: string };
      })
    | null;

  console.info("Facebook direct page fetch diagnostics", {
    httpStatus: response.status,
    fields,
    hasPage: Boolean(payload?.id && payload?.name),
    hasAccessToken: Boolean(payload?.access_token),
    errorCode: payload?.error?.code,
    errorType: payload?.error?.type,
  });

  if (!response.ok) {
    logFacebookApiError("Facebook direct page fetch failed", payload?.error);
    return { page: null, error: payload?.error };
  }

  if (!payload?.id || !payload.name) {
    return { page: null, error: payload?.error };
  }

  return {
    page: {
      id: payload.id,
      name: payload.name,
      accessToken: payload.access_token ?? null,
      scopes: [],
    },
    error: payload.error,
  };
}

function isFacebookFieldError(
  error: { message?: string; code?: number; type?: string } | undefined,
): boolean {
  return error?.code === 100;
}

type FacebookPagesFetchResult = {
  pages: FacebookPage[];
  httpStatus: number;
  pagesMissingAccessToken: number;
  error?: { message?: string; code?: number; type?: string };
};

async function fetchFacebookPagesFromAccountsEdge(
  userAccessToken: string,
): Promise<FacebookPagesFetchResult> {
  const url = new URL(
    `https://graph.facebook.com/${OAUTH_VERSION}/me/accounts`,
  );
  url.searchParams.set("fields", "id,name,access_token,perms,tasks");
  url.searchParams.set("access_token", userAccessToken);

  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as {
    data?: FacebookRawPage[];
    error?: { message?: string; code?: number; type?: string };
  } | null;

  const result = buildFacebookPagesFetchResult(
    response.status,
    payload?.data ?? [],
    payload?.error,
  );

  console.info("Facebook /me/accounts pages diagnostics", {
    httpStatus: result.httpStatus,
    pageCount: result.pages.length,
    pagesMissingAccessToken: result.pagesMissingAccessToken,
    errorCode: result.error?.code,
    errorType: result.error?.type,
  });

  if (!response.ok) {
    throw new Error("Facebook Pages konnten nicht geladen werden.");
  }

  return result;
}

async function fetchFacebookPagesFromMeAccountsField(
  userAccessToken: string,
): Promise<FacebookPagesFetchResult> {
  const url = new URL(`https://graph.facebook.com/${OAUTH_VERSION}/me`);
  url.searchParams.set("fields", "accounts{id,name,access_token,perms,tasks}");
  url.searchParams.set("access_token", userAccessToken);

  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as {
    accounts?: { data?: FacebookRawPage[] };
    error?: { message?: string; code?: number; type?: string };
  } | null;

  const result = buildFacebookPagesFetchResult(
    response.status,
    payload?.accounts?.data ?? [],
    payload?.error,
  );

  console.info("Facebook /me accounts field pages diagnostics", {
    httpStatus: result.httpStatus,
    pageCount: result.pages.length,
    pagesMissingAccessToken: result.pagesMissingAccessToken,
    errorCode: result.error?.code,
    errorType: result.error?.type,
  });

  if (!response.ok) {
    logFacebookApiError(
      "Facebook /me accounts field fetch failed",
      payload?.error,
    );
  }

  return result;
}

function buildFacebookPagesFetchResult(
  httpStatus: number,
  rawPages: FacebookRawPage[],
  error?: { message?: string; code?: number; type?: string },
): FacebookPagesFetchResult {
  const pages = rawPages
    .filter((page) => page.id && page.name)
    .map((page) => ({
      id: page.id!,
      name: page.name!,
      accessToken: page.access_token ?? null,
      scopes: page.tasks ?? page.perms ?? [],
    }));

  return {
    pages,
    httpStatus,
    pagesMissingAccessToken: pages.filter((page) => !page.accessToken).length,
    error,
  };
}

export type FacebookPageWebhookFieldStatus = "active" | "missing" | "unknown";

export const FACEBOOK_PAGE_MESSENGER_WEBHOOK_FIELDS = [
  "messages",
  "message_echoes",
] as const;
export const FACEBOOK_PAGE_COMMENT_WEBHOOK_FIELDS = ["feed"] as const;
export type FacebookPageWebhookField =
  | "feed"
  | "messages"
  | "message_echoes";

export type FacebookPageWebhookStatus = {
  ok: boolean;
  pageId: string | null;
  hasPageAccessToken: boolean;
  subscribedAppsStatus: "active" | "missing" | "error" | "unknown";
  fields: Record<
    "feed" | "messages" | "message_echoes",
    FacebookPageWebhookFieldStatus
  >;
  error: string | null;
  metaError?: { code: number | null; type: string | null };
};

type FacebookSubscribedApp = {
  id?: string;
  name?: string;
  subscribed_fields?: string[];
};

export async function fetchFacebookPageWebhookStatus(
  pageId: string | null,
  pageAccessToken: string | null,
): Promise<FacebookPageWebhookStatus> {
  if (!pageId)
    return buildWebhookStatus(
      pageId,
      Boolean(pageAccessToken),
      "unknown",
      [],
      "Facebook Page-ID fehlt.",
    );
  if (!pageAccessToken)
    return buildWebhookStatus(
      pageId,
      false,
      "unknown",
      [],
      "Page Access Token fehlt serverseitig.",
    );

  const url = new URL(
    `https://graph.facebook.com/${OAUTH_VERSION}/${pageId}/subscribed_apps`,
  );
  url.searchParams.set("fields", "id,name,subscribed_fields");
  url.searchParams.set("access_token", pageAccessToken);

  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as {
    data?: FacebookSubscribedApp[];
    error?: { message?: string; code?: number; type?: string };
  } | null;

  if (!response.ok) {
    logFacebookApiError(
      "Facebook Page subscribed_apps check failed",
      payload?.error,
    );
    return {
      ...buildWebhookStatus(
        pageId,
        true,
        "error",
        [],
        "Meta subscribed_apps konnte nicht geprüft werden.",
      ),
      metaError: sanitizeMetaProviderError(payload?.error),
    };
  }

  const appId = resolveFacebookAppId();
  const appSubscription =
    (payload?.data ?? []).find((entry) => !appId || entry.id === appId) ?? null;
  const subscribedFields = appSubscription?.subscribed_fields ?? [];
  return buildWebhookStatus(
    pageId,
    true,
    appSubscription ? "active" : "missing",
    subscribedFields,
    null,
  );
}

export async function subscribeFacebookPage(
  pageId: string,
  pageAccessToken: string,
  requestedFields: readonly FacebookPageWebhookField[] =
    FACEBOOK_PAGE_MESSENGER_WEBHOOK_FIELDS,
): Promise<FacebookPageWebhookStatus> {
  const currentStatus = await fetchFacebookPageWebhookStatus(
    pageId,
    pageAccessToken,
  );
  const subscribedFields = new Set<FacebookPageWebhookField>(requestedFields);
  for (const field of [
    "feed",
    "messages",
    "message_echoes",
  ] as const) {
    if (currentStatus.fields[field] === "active") subscribedFields.add(field);
  }
  const url = new URL(
    `https://graph.facebook.com/${OAUTH_VERSION}/${pageId}/subscribed_apps`,
  );
  url.searchParams.set(
    "subscribed_fields",
    [...subscribedFields].join(","),
  );
  url.searchParams.set("access_token", pageAccessToken);
  const response = await fetch(url, { method: "POST", cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    error?: { message?: string; code?: number; type?: string };
  } | null;

  if (!response.ok || payload?.success === false) {
    logFacebookApiError("Facebook Page subscribe failed", payload?.error);
    return {
      ...buildWebhookStatus(
        pageId,
        true,
        "error",
        [],
        "Meta hat die Page-Webhook-Aktivierung abgelehnt.",
      ),
      metaError: sanitizeMetaProviderError(payload?.error),
    };
  }

  return fetchFacebookPageWebhookStatus(pageId, pageAccessToken);
}

function buildWebhookStatus(
  pageId: string | null,
  hasPageAccessToken: boolean,
  subscribedAppsStatus: FacebookPageWebhookStatus["subscribedAppsStatus"],
  subscribedFields: string[],
  error: string | null,
): FacebookPageWebhookStatus {
  const fieldSet = new Set(subscribedFields);
  const fieldStatus = (
    field: "feed" | "messages" | "message_echoes",
  ): FacebookPageWebhookFieldStatus => {
    if (subscribedAppsStatus === "error" || subscribedAppsStatus === "unknown")
      return "unknown";
    return fieldSet.has(field) ? "active" : "missing";
  };

  return {
    ok:
      subscribedAppsStatus === "active" &&
      fieldSet.has("messages") &&
      fieldSet.has("message_echoes"),
    pageId,
    hasPageAccessToken,
    subscribedAppsStatus,
    fields: {
      feed: fieldStatus("feed"),
      messages: fieldStatus("messages"),
      message_echoes: fieldStatus("message_echoes"),
    },
    error,
  };
}

export type FacebookRuntimeConfigurationStatus = {
  appIdConfigured: boolean;
  appSecretConfigured: boolean;
  redirectUriConfigured: boolean;
  webhookVerifyTokenConfigured: boolean;
  publicBaseUrlConfigured: boolean;
  metaBusinessIdConfigured: boolean;
  tokenEncryptionConfigured: boolean;
  oauthCallbackUrl: string | null;
};

export function getFacebookRuntimeConfigurationStatus(): FacebookRuntimeConfigurationStatus {
  const appId = resolveFacebookAppId();
  const appSecret = resolveFacebookAppSecret();
  const redirectUri = resolveFacebookRedirectUri();
  const publicBaseUrl = getOptionalEnv("NEXT_PUBLIC_APP_URL", "FANMIND_APP_URL");

  return {
    appIdConfigured: isUsableMetaAppId(appId),
    appSecretConfigured: isUsableMetaAppSecret(appSecret),
    redirectUriConfigured: Boolean(redirectUri),
    webhookVerifyTokenConfigured: Boolean(
      getOptionalEnv("FACEBOOK_WEBHOOK_VERIFY_TOKEN", "META_WEBHOOK_VERIFY_TOKEN"),
    ),
    publicBaseUrlConfigured: Boolean(
      normalizeHttpsRuntimeUrl(publicBaseUrl),
    ),
    metaBusinessIdConfigured: Boolean(
      getOptionalEnv("META_BUSINESS_ID", "NEXT_PUBLIC_META_BUSINESS_ID"),
    ),
    tokenEncryptionConfigured: isTokenEncryptionConfigured(),
    oauthCallbackUrl: redirectUri,
  };
}

export function isTokenEncryptionConfigured(): boolean {
  return Boolean(getEncryptionKey());
}

export function encryptToken(token: string): string | null {
  const key = getEncryptionKey();
  if (!key) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${ciphertext.toString("base64url")}`;
}

export function decryptToken(encrypted: string): string | null {
  const key = getEncryptionKey();
  const [, ivRaw, tagRaw, ciphertextRaw] = encrypted.split(":");
  if (!key || !ivRaw || !tagRaw || !ciphertextRaw) return null;
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivRaw, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function tokenLastFour(token: string | null): string | null {
  return token ? token.slice(-4) : null;
}

function signState(encodedPayload: string): string {
  return createHmac(
    "sha256",
    requireFacebookAppSecret(),
  )
    .update(encodedPayload)
    .digest("base64url");
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

function getEncryptionKey(): Buffer | null {
  const raw = process.env.FANMIND_TOKEN_ENCRYPTION_KEY;
  if (!raw) return null;
  const decoded = Buffer.from(
    raw,
    raw.length === 64 && /^[a-f0-9]+$/i.test(raw) ? "hex" : "base64",
  );
  return decoded.length === 32 ? decoded : null;
}

function logFacebookApiError(
  message: string,
  error: { message?: string; code?: number; type?: string } | undefined,
) {
  const diagnostic = sanitizeMetaProviderError(error);
  console.error(message, {
    code: diagnostic.code,
    type: diagnostic.type,
  });
}

function getOptionalEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = normalizeMetaRuntimeValue(process.env[name]);
    if (value) return value;
  }
  return undefined;
}

function requireFacebookAppId(): string {
  const value = resolveFacebookAppId();
  if (!value) {
    throw new Error("FACEBOOK_APP_ID ist nicht gültig konfiguriert.");
  }
  return value;
}

function requireFacebookAppSecret(): string {
  const value = resolveFacebookAppSecret();
  if (!value) {
    throw new Error("FACEBOOK_APP_SECRET ist nicht gültig konfiguriert.");
  }
  return value;
}

function requireFacebookRedirectUri(): string {
  const value = resolveFacebookRedirectUri();
  if (!value) {
    throw new Error("FACEBOOK_REDIRECT_URI ist nicht gültig konfiguriert.");
  }
  return value;
}

function normalizeHttpsRuntimeUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export type FacebookPagePost = {
  id: string;
  message?: string;
  created_time?: string;
  permalink_url?: string;
};

export type FacebookPageCommentAttachment = {
  media?: { image?: { src?: string } };
  target?: { url?: string };
  type?: string;
  url?: string;
};

export type FacebookPageComment = {
  id: string;
  message?: string;
  created_time?: string;
  permalink_url?: string;
  attachment?: FacebookPageCommentAttachment;
  attachments?: { data?: FacebookPageCommentAttachment[] };
  from?: { id?: string; name?: string };
  postId: string;
  postPermalinkUrl?: string;
};

export type FacebookCommentFetchEndpointType =
  | "page-feed-with-comments"
  | "post-comments-fallback";

export type FacebookCommentFetchDiagnostics = {
  endpointType: FacebookCommentFetchEndpointType;
  usedPageAccessToken: boolean;
};

export class FacebookCommentFetchError extends Error {
  readonly endpointType: FacebookCommentFetchEndpointType;
  readonly usedPageAccessToken: boolean;
  readonly graphErrorCode?: number;

  constructor(
    message: string,
    input: {
      endpointType: FacebookCommentFetchEndpointType;
      usedPageAccessToken: boolean;
      graphErrorCode?: number;
    },
  ) {
    super(message);
    this.name = "FacebookCommentFetchError";
    this.endpointType = input.endpointType;
    this.usedPageAccessToken = input.usedPageAccessToken;
    this.graphErrorCode = input.graphErrorCode;
  }
}

type FacebookPagePostWithInlineComments = FacebookPagePost & {
  comments?: {
    data?: Array<Omit<FacebookPageComment, "postId" | "postPermalinkUrl">>;
  };
};

export async function fetchFacebookPagePostsWithComments(
  pageId: string,
  pageAccessToken: string,
): Promise<{
  posts: FacebookPagePost[];
  comments: FacebookPageComment[];
  diagnostics: FacebookCommentFetchDiagnostics;
}> {
  const feedUrl = new URL(
    `https://graph.facebook.com/${OAUTH_VERSION}/${pageId}/feed`,
  );
  feedUrl.searchParams.set(
    "fields",
    "id,message,created_time,permalink_url,comments.limit(50){id,message,created_time,from,permalink_url,attachment,attachments{media,target,type,url}}",
  );
  feedUrl.searchParams.set("limit", "25");
  feedUrl.searchParams.set("access_token", pageAccessToken);

  try {
    const feedPosts =
      await fetchGraphCollection<FacebookPagePostWithInlineComments>(
        feedUrl,
        "Facebook Page-Feed mit Kommentaren konnte nicht geladen werden.",
      );
    const posts = feedPosts.map((post) => ({
      id: post.id,
      message: post.message,
      created_time: post.created_time,
      permalink_url: post.permalink_url,
    }));
    const comments = feedPosts.flatMap((post) =>
      (post.comments?.data ?? [])
        .filter((comment) => Boolean(comment.id))
        .map((comment) => ({
          ...comment,
          postId: post.id,
          postPermalinkUrl: post.permalink_url,
        })),
    );
    return {
      posts,
      comments,
      diagnostics: {
        endpointType: "page-feed-with-comments",
        usedPageAccessToken: true,
      },
    };
  } catch (error) {
    if (!isMetaPermissionError(error))
      throw withCommentFetchEndpoint(error, "page-feed-with-comments");
  }

  const postsUrl = new URL(
    `https://graph.facebook.com/${OAUTH_VERSION}/${pageId}/feed`,
  );
  postsUrl.searchParams.set("fields", "id,message,created_time,permalink_url");
  postsUrl.searchParams.set("limit", "25");
  postsUrl.searchParams.set("access_token", pageAccessToken);

  const posts = await fetchGraphCollection<FacebookPagePost>(
    postsUrl,
    "Facebook Page-Feed konnte nicht geladen werden.",
  ).catch((error) => {
    throw withCommentFetchEndpoint(error, "post-comments-fallback");
  });
  const comments: FacebookPageComment[] = [];

  for (const post of posts) {
    const commentsUrl = new URL(
      `https://graph.facebook.com/${OAUTH_VERSION}/${post.id}/comments`,
    );
    commentsUrl.searchParams.set(
      "fields",
      "id,message,created_time,from,permalink_url,attachment,attachments{media,target,type,url}",
    );
    commentsUrl.searchParams.set("filter", "stream");
    commentsUrl.searchParams.set("limit", "100");
    commentsUrl.searchParams.set("access_token", pageAccessToken);
    const postComments = await fetchGraphCollection<
      Omit<FacebookPageComment, "postId" | "postPermalinkUrl">
    >(
      commentsUrl,
      "Facebook-Kommentare konnten nicht geladen werden.",
    ).catch((error) => {
      throw withCommentFetchEndpoint(error, "post-comments-fallback");
    });
    comments.push(
      ...postComments.map((comment) => ({
        ...comment,
        postId: post.id,
        postPermalinkUrl: post.permalink_url,
      })),
    );
  }

  return {
    posts,
    comments,
    diagnostics: {
      endpointType: "post-comments-fallback",
      usedPageAccessToken: true,
    },
  };
}

function isMetaPermissionError(error: unknown): boolean {
  return error instanceof GraphApiError && error.code === 10;
}

function withCommentFetchEndpoint(
  error: unknown,
  endpointType: FacebookCommentFetchEndpointType,
): Error {
  if (error instanceof FacebookCommentFetchError) return error;
  if (error instanceof GraphApiError) {
    return new FacebookCommentFetchError(
      "Facebook-Kommentarabruf fehlgeschlagen.",
      {
        endpointType,
        usedPageAccessToken: true,
        graphErrorCode: error.code,
      },
    );
  }
  return new FacebookCommentFetchError(
    "Facebook-Kommentarabruf fehlgeschlagen.",
    {
      endpointType,
      usedPageAccessToken: true,
    },
  );
}

class GraphApiError extends Error {
  readonly code?: number;

  constructor(message: string, code?: number) {
    super(message);
    this.name = "GraphApiError";
    this.code = code;
  }
}

async function fetchGraphCollection<T extends { id?: string }>(
  url: URL,
  errorFallback: string,
): Promise<T[]> {
  const items: T[] = [];
  let nextUrl: string | null = url.toString();

  while (nextUrl && items.length < 500) {
    const response = await fetch(nextUrl, { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as {
      data?: T[];
      paging?: { next?: string };
      error?: { message?: string; code?: number; type?: string };
    } | null;

    if (!response.ok) {
      logFacebookApiError(errorFallback, payload?.error);
      throw new GraphApiError(
        errorFallback,
        payload?.error?.code,
      );
    }

    items.push(...(payload?.data ?? []).filter((item) => Boolean(item.id)));
    nextUrl = validateFacebookGraphPagingUrl(payload?.paging?.next ?? null);
  }

  return items;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function validUrl(value: string | null): string | null {
  return value && /^https?:\/\//i.test(value) ? value : null;
}
