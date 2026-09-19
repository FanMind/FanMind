import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { META_GRAPH_API_VERSION } from "@/lib/metaIntegrationPolicy.mjs";
import {
  resolveInstagramGraphPagingCursor,
  validateInstagramGraphPagingUrl,
} from "@/lib/instagramGraphPagingPolicy.mjs";
import {
  createMetaConversationSyncAbortSignal,
  normalizeMetaPagingCursor,
} from "@/lib/metaConversationPaginationPolicy.mjs";
import {
  INSTAGRAM_COMMENTS_OAUTH_SCOPES,
  INSTAGRAM_INSIGHTS_OAUTH_SCOPES,
  INSTAGRAM_MESSAGES_OAUTH_SCOPES,
} from "@/lib/instagramScopes";
import { sanitizeMetaProviderError } from "@/lib/metaProviderErrorPolicy.mjs";
import {
  isUsableMetaAppId,
  isUsableMetaAppSecret,
  normalizeMetaCallbackUrl,
  normalizeMetaRuntimeValue,
} from "@/lib/metaRuntimeConfigPolicy.mjs";

const STATE_MAX_AGE_SECONDS = 10 * 60;

export type InstagramConnectionType =
  | "instagram_messages"
  | "instagram_comments"
  | "instagram_insights";

export type InstagramOAuthState = {
  workspaceId: string;
  userId: string;
  connectionType: InstagramConnectionType;
  nonce: string;
  issuedAt: number;
};

export type InstagramToken = {
  accessToken: string;
  userId: string;
  expiresIn: number | null;
};

export type InstagramProfile = {
  userId: string;
  username: string;
  name: string | null;
  profilePictureUrl: string | null;
};

export type InstagramConversation = {
  id: string;
  updatedTime: string | null;
};

export type InstagramConversationPage = {
  conversations: InstagramConversation[];
  nextAfter: string | null;
};

export type InstagramConversationMessage = {
  id: string;
  createdTime: string | null;
  message: string | null;
  from: { id: string; username: string | null } | null;
  to: Array<{ id: string; username: string | null }>;
  unsupported: boolean;
};

export function getInstagramOAuthScopes(
  connectionType: InstagramConnectionType,
): readonly string[] {
  if (connectionType === "instagram_comments")
    return INSTAGRAM_COMMENTS_OAUTH_SCOPES;
  if (connectionType === "instagram_insights")
    return INSTAGRAM_INSIGHTS_OAUTH_SCOPES;
  return INSTAGRAM_MESSAGES_OAUTH_SCOPES;
}

export function getInstagramOAuthUrl(
  state: string,
  scopes: readonly string[],
): string {
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", requireInstagramAppId());
  url.searchParams.set("redirect_uri", requireInstagramRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes.join(","));
  url.searchParams.set("state", state);
  url.searchParams.set("enable_fb_login", "0");
  url.searchParams.set("force_authentication", "1");
  return url.toString();
}

export function createInstagramOAuthState(
  input: Omit<InstagramOAuthState, "nonce" | "issuedAt">,
): string {
  const payload: InstagramOAuthState = {
    ...input,
    nonce: randomBytes(16).toString("hex"),
    issuedAt: Math.floor(Date.now() / 1000),
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  return `${encoded}.${signState(encoded)}`;
}

export function verifyInstagramOAuthState(
  state: string | null,
): InstagramOAuthState | null {
  if (!state) return null;
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature || !safeEqual(signature, signState(encoded)))
    return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Partial<InstagramOAuthState>;
    const now = Math.floor(Date.now() / 1000);
    if (
      !validIdentifier(payload.workspaceId) ||
      !validIdentifier(payload.userId) ||
      !isInstagramConnectionType(payload.connectionType) ||
      typeof payload.nonce !== "string" ||
      !/^[a-f0-9]{32}$/u.test(payload.nonce) ||
      !Number.isSafeInteger(payload.issuedAt) ||
      !payload.issuedAt ||
      payload.issuedAt > now + 30 ||
      now - payload.issuedAt > STATE_MAX_AGE_SECONDS
    ) {
      return null;
    }
    return payload as InstagramOAuthState;
  } catch {
    return null;
  }
}

export async function exchangeInstagramCode(
  code: string,
): Promise<InstagramToken> {
  const body = new URLSearchParams();
  body.set("client_id", requireInstagramAppId());
  body.set("client_secret", requireInstagramAppSecret());
  body.set("grant_type", "authorization_code");
  body.set("redirect_uri", requireInstagramRedirectUri());
  body.set("code", code);

  const response = await fetch(
    "https://api.instagram.com/oauth/access_token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    },
  );
  const payload = (await response.json().catch(() => null)) as {
    access_token?: string;
    user_id?: string | number;
    error_message?: string;
    error?: { message?: string; code?: number; type?: string };
  } | null;
  const userId = stringValue(payload?.user_id);
  if (!response.ok || !payload?.access_token || !userId) {
    logInstagramApiError("Instagram OAuth code exchange failed", payload);
    throw new Error("Instagram OAuth-Code konnte nicht getauscht werden.");
  }
  return {
    accessToken: payload.access_token,
    userId,
    expiresIn: null,
  };
}

export async function exchangeInstagramLongLivedToken(
  shortLivedToken: InstagramToken,
): Promise<InstagramToken> {
  const url = new URL("https://graph.instagram.com/access_token");
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", requireInstagramAppSecret());
  url.searchParams.set("access_token", shortLivedToken.accessToken);

  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
    error?: { message?: string; code?: number; type?: string };
  } | null;
  if (!response.ok || !payload?.access_token) {
    logInstagramApiError("Instagram long-lived token exchange failed", payload);
    throw new Error("Instagram-Langzeittoken konnte nicht erstellt werden.");
  }
  return {
    accessToken: payload.access_token,
    userId: shortLivedToken.userId,
    expiresIn: Number.isFinite(payload.expires_in)
      ? Math.max(0, Math.trunc(payload.expires_in!))
      : null,
  };
}

export async function fetchInstagramProfile(
  token: InstagramToken,
): Promise<InstagramProfile> {
  const url = new URL(
    `https://graph.instagram.com/${META_GRAPH_API_VERSION}/me`,
  );
  url.searchParams.set("fields", "user_id,username,name,profile_picture_url");
  url.searchParams.set("access_token", token.accessToken);

  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as {
    id?: string | number;
    user_id?: string | number;
    username?: string;
    name?: string;
    profile_picture_url?: string;
    error?: { message?: string; code?: number; type?: string };
  } | null;
  const userId = stringValue(payload?.user_id) ?? stringValue(payload?.id);
  const username = stringValue(payload?.username);
  if (!response.ok || !userId || !username || userId !== token.userId) {
    logInstagramApiError("Instagram profile fetch failed", payload);
    throw new Error("Instagram-Professional-Konto konnte nicht bestätigt werden.");
  }
  return {
    userId,
    username,
    name: stringValue(payload?.name),
    profilePictureUrl: validHttpsUrl(payload?.profile_picture_url),
  };
}

export async function fetchInstagramConversations(
  profileId: string,
  accessToken: string,
  limit = 10,
): Promise<InstagramConversation[]> {
  const page = await fetchInstagramConversationPage(
    profileId,
    accessToken,
    limit,
  );
  return page.conversations;
}

export async function fetchInstagramConversationPage(
  profileId: string,
  accessToken: string,
  limit = 25,
  after?: string | null,
  deadlineMs?: number,
): Promise<InstagramConversationPage> {
  const normalizedAfter = after == null
    ? null
    : normalizeMetaPagingCursor(after);
  if (after != null && !normalizedAfter) {
    throw new Error("Ungültiger Instagram-Paging-Cursor blockiert.");
  }

  const url = new URL(
    `https://graph.instagram.com/${META_GRAPH_API_VERSION}/${encodeURIComponent(profileId)}/conversations`,
  );
  url.searchParams.set("platform", "instagram");
  url.searchParams.set("fields", "id,updated_time");
  url.searchParams.set("limit", String(Math.max(1, Math.min(limit, 25))));
  if (normalizedAfter) url.searchParams.set("after", normalizedAfter);

  const payload = await fetchInstagramGraph(url, accessToken, {
    errorContext: "Instagram conversations fetch failed",
    userMessage: "Instagram-Unterhaltungen konnten nicht abgerufen werden.",
    deadlineMs,
  });
  const conversations = (Array.isArray(payload.data) ? payload.data : [])
    .filter(isRecord)
    .map((conversation) => ({
      id: stringValue(conversation.id) ?? "",
      updatedTime: stringValue(conversation.updated_time),
    }))
    .filter((conversation) => conversation.id);

  const paging = isRecord(payload.paging) ? payload.paging : null;
  return {
    conversations,
    nextAfter: resolveInstagramGraphPagingCursor(
      stringValue(paging?.next),
    ),
  };
}

export async function fetchInstagramConversationMessages(
  conversationId: string,
  accessToken: string,
  limit = 50,
  since?: string | null,
  deadlineMs?: number,
): Promise<InstagramConversationMessage[]> {
  const targetLimit = Math.max(1, Math.min(limit, 150));
  const pageLimit = Math.min(targetLimit, 50);
  const fields =
    `messages.limit(${pageLimit}){id,created_time,from,to,message}`;
  const firstUrl = new URL(
    `https://graph.instagram.com/${META_GRAPH_API_VERSION}/${encodeURIComponent(conversationId)}`,
  );
  firstUrl.searchParams.set("fields", fields);

  const messages: InstagramConversationMessage[] = [];
  const seenIds = new Set<string>();
  let nextUrl: URL | null = firstUrl;
  let firstPage = true;

  while (nextUrl && messages.length < targetLimit) {
    const payload = await fetchInstagramGraph(nextUrl, accessToken, {
      errorContext: "Instagram conversation messages fetch failed",
      userMessage: "Instagram-Nachrichten konnten nicht abgerufen werden.",
      deadlineMs,
    });
    const messageContainer = firstPage && isRecord(payload.messages)
      ? payload.messages
      : payload;
    const rows = Array.isArray(messageContainer.data)
      ? messageContainer.data
      : [];

    for (const message of rows
      .filter(isRecord)
      .map(normalizeInstagramConversationMessage)
      .filter((message) => message.id)) {
      if (seenIds.has(message.id)) continue;
      messages.push(message);
      seenIds.add(message.id);
      if (messages.length >= targetLimit) break;
    }

    const paging = isRecord(messageContainer.paging)
      ? messageContainer.paging
      : null;
    nextUrl =
      messages.length < targetLimit
        ? validInstagramGraphUrl(stringValue(paging?.next))
        : null;
    firstPage = false;
  }

  const sinceTimestamp = since ? Date.parse(since) : Number.NaN;
  if (!Number.isFinite(sinceTimestamp)) return messages;
  const overlapStart = sinceTimestamp - 5 * 60 * 1_000;
  return messages.filter((message) => {
    const createdAt = Date.parse(message.createdTime ?? "");
    return !Number.isFinite(createdAt) || createdAt >= overlapStart;
  });
}

export async function subscribeInstagramAccount(
  profileId: string,
  accessToken: string,
  connectionType: InstagramConnectionType,
): Promise<boolean> {
  if (connectionType === "instagram_insights") return false;
  const requestedField =
    connectionType === "instagram_comments" ? "comments" : "messages";
  const currentFields = await fetchInstagramSubscribedFields(
    profileId,
    accessToken,
  );
  const subscribedFields = [...new Set([...currentFields, requestedField])];
  const url = new URL(
    `https://graph.instagram.com/${META_GRAPH_API_VERSION}/${encodeURIComponent(profileId)}/subscribed_apps`,
  );
  url.searchParams.set("subscribed_fields", subscribedFields.join(","));
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url, { method: "POST", cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    error?: { message?: string; code?: number; type?: string };
  } | null;
  if (!response.ok || payload?.success !== true) {
    logInstagramApiError("Instagram webhook subscription failed", payload);
    return false;
  }
  return true;
}

async function fetchInstagramSubscribedFields(
  profileId: string,
  accessToken: string,
): Promise<string[]> {
  const url = new URL(
    `https://graph.instagram.com/${META_GRAPH_API_VERSION}/${encodeURIComponent(profileId)}/subscribed_apps`,
  );
  url.searchParams.set("fields", "subscribed_fields");
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return [];
  const payload = (await response.json().catch(() => null)) as {
    data?: Array<{ subscribed_fields?: unknown }>;
  } | null;
  const values = payload?.data?.flatMap((entry) =>
    Array.isArray(entry.subscribed_fields)
      ? entry.subscribed_fields
      : [],
  );
  return [
    ...new Set(
      (values ?? []).filter(
        (value): value is string =>
          typeof value === "string" && /^[a-z][a-z0-9_]{0,63}$/u.test(value),
      ),
    ),
  ];
}

export function isInstagramOAuthConfigured(): boolean {
  return Boolean(
    isUsableMetaAppId(optionalEnv("INSTAGRAM_APP_ID", "META_APP_ID")) &&
      isUsableMetaAppSecret(optionalEnv("INSTAGRAM_APP_SECRET", "META_APP_SECRET")) &&
      normalizeMetaCallbackUrl(
        optionalEnv("INSTAGRAM_REDIRECT_URI"),
        "/api/integrations/instagram/callback",
      ),
  );
}

function isInstagramConnectionType(
  value: unknown,
): value is InstagramConnectionType {
  return (
    value === "instagram_messages" ||
    value === "instagram_comments" ||
    value === "instagram_insights"
  );
}

function signState(encodedPayload: string): string {
  return createHmac("sha256", requireInstagramAppSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function requireInstagramAppId(): string {
  const value = optionalEnv("INSTAGRAM_APP_ID", "META_APP_ID");
  if (!isUsableMetaAppId(value)) {
    throw new Error("INSTAGRAM_APP_ID ist nicht gültig konfiguriert.");
  }
  return value;
}

function requireInstagramAppSecret(): string {
  const value = optionalEnv("INSTAGRAM_APP_SECRET", "META_APP_SECRET");
  if (!isUsableMetaAppSecret(value)) {
    throw new Error("INSTAGRAM_APP_SECRET ist nicht gültig konfiguriert.");
  }
  return value;
}

function requireInstagramRedirectUri(): string {
  const value = normalizeMetaCallbackUrl(
    optionalEnv("INSTAGRAM_REDIRECT_URI"),
    "/api/integrations/instagram/callback",
  );
  if (!value) {
    throw new Error("INSTAGRAM_REDIRECT_URI ist nicht gültig konfiguriert.");
  }
  return value;
}

function optionalEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = normalizeMetaRuntimeValue(process.env[name]);
    if (value) return value;
  }
  return undefined;
}

function validIdentifier(value: unknown): boolean {
  return /^[A-Za-z0-9_-]{8,255}$/u.test(String(value ?? "").trim());
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function validHttpsUrl(value: unknown): string | null {
  const normalized = stringValue(value);
  if (!normalized) return null;
  try {
    const url = new URL(normalized);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeInstagramConversationMessage(
  value: Record<string, unknown>,
): InstagramConversationMessage {
  return {
    id: stringValue(value.id) ?? "",
    createdTime: stringValue(value.created_time),
    message: stringValue(value.message),
    from: normalizeInstagramActor(value.from),
    to: normalizeInstagramActorArray(value.to),
    unsupported: value.is_unsupported === true,
  };
}

function normalizeInstagramActor(
  value: unknown,
): { id: string; username: string | null } | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  if (!id) return null;
  return { id, username: stringValue(value.username) };
}

function normalizeInstagramActorArray(
  value: unknown,
): Array<{ id: string; username: string | null }> {
  const rows = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.data)
      ? value.data
      : [];
  return rows
    .map(normalizeInstagramActor)
    .filter(
      (actor): actor is { id: string; username: string | null } =>
        actor !== null,
    );
}

async function fetchInstagramGraph(
  inputUrl: URL,
  accessToken: string,
  error: {
    errorContext: string;
    userMessage: string;
    deadlineMs?: number;
  },
): Promise<Record<string, unknown>> {
  const url = validInstagramGraphUrl(inputUrl.toString());
  if (!url) throw new Error("Ungültige Instagram-API-Weiterleitung blockiert.");
  url.searchParams.delete("access_token");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: error.deadlineMs == null
      ? undefined
      : createMetaConversationSyncAbortSignal(error.deadlineMs),
  });
  const payload = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  if (!response.ok || !payload) {
    logInstagramApiError(
      error.errorContext,
      payload as {
        error_message?: string;
        error?: { message?: string; code?: number; type?: string };
      } | null,
    );
    throw new Error(error.userMessage);
  }
  return payload;
}

function validInstagramGraphUrl(value: string | null): URL | null {
  const validated = validateInstagramGraphPagingUrl(value);
  return validated ? new URL(validated) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function logInstagramApiError(
  message: string,
  payload:
    | {
        error_message?: string;
        error?: { message?: string; code?: number; type?: string };
      }
    | null,
) {
  const providerError =
    payload?.error ??
    (payload?.error_message
      ? { type: "instagram_provider_error" }
      : undefined);
  const diagnostic = sanitizeMetaProviderError(providerError);
  console.error(message, {
    code: diagnostic.code,
    type: diagnostic.type,
  });
}
