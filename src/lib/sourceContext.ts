import { onlyFansManualTarget } from "@/lib/socialHandoffPolicy.mjs";

export type SourceContextType =
  | "general_chat"
  | "post"
  | "reel"
  | "video"
  | "story"
  | "ad"
  | "campaign"
  | "comment_thread"
  | "unknown";

export type SourceContextMessage = {
  id?: string | null;
  message_type?: string | null;
  source_platform?: string | null;
  source_type?: string | null;
  source_url?: string | null;
  reply_target_url?: string | null;
  external_thread_id?: string | null;
  external_message_id?: string | null;
  external_post_id?: string | null;
  external_comment_id?: string | null;
  original_text_excerpt?: string | null;
  content?: string | null;
};

export type MessageSourceContext = {
  contextKey: string;
  contextLabel: string;
  contextType: SourceContextType;
  contextUrl: string | null;
};

export type ReplyTargetQuality =
  | "exact_thread"
  | "manual_exact_thread"
  | "auto_selected_item"
  | "attempted_thread_link"
  | "inbox_fallback"
  | "unavailable";

export type ReplyTargetAction = {
  href: string | null;
  label: string;
  quality: ReplyTargetQuality;
  reason: string;
  disabledHint: string;
  platform?: string;
  selectedItemSource?:
    | "manual"
    | "reply_target_url"
    | "source_url"
    | "stored_auto"
    | "not_detected";
  fallbackContactLabel?: string | null;
  fallbackContactId?: string | null;
};

const generalChatContext: MessageSourceContext = {
  contextKey: "general_chat",
  contextLabel: "Allgemeiner Chat",
  contextType: "general_chat",
  contextUrl: null,
};

export function getMessageSourceContext(
  message: SourceContextMessage,
): MessageSourceContext {
  const contextUrl =
    normalizeHttpUrl(message.reply_target_url) ??
    normalizeHttpUrl(message.source_url);
  const sourceType = normalizeText(message.source_type ?? message.message_type);
  const platform = normalizeText(message.source_platform);
  const externalPostId = normalizeText(message.external_post_id);
  const externalCommentId = normalizeText(message.external_comment_id);
  const externalThreadId = normalizeText(message.external_thread_id);
  const contentLabel = buildContentLabel(
    message.original_text_excerpt ?? message.content,
  );

  if (externalPostId) {
    const contextType = getPostContextType(platform, sourceType, contextUrl);
    return {
      contextKey: [platform || "source", contextType, externalPostId].join(":"),
      contextLabel: `${getContextTypeLabel(contextType)}: ${contentLabel ?? shortenIdentifier(externalPostId)}`,
      contextType,
      contextUrl,
    };
  }

  if (externalCommentId) {
    return {
      contextKey: [
        platform || "source",
        "comment_thread",
        externalCommentId,
      ].join(":"),
      contextLabel: `Kommentar-Thread${contentLabel ? `: ${contentLabel}` : ""}`,
      contextType: "comment_thread",
      contextUrl,
    };
  }

  const inferredVideoId = inferVideoId(message, contextUrl);
  if (inferredVideoId) {
    return {
      contextKey: [platform || "source", "video", inferredVideoId].join(":"),
      contextLabel: `Video: ${contentLabel ?? shortenIdentifier(inferredVideoId)}`,
      contextType: "video",
      contextUrl,
    };
  }

  if (isCampaignSource(sourceType, contextUrl)) {
    const key = externalThreadId || contextUrl || message.id || "campaign";
    return {
      contextKey: [platform || "source", "campaign", key].join(":"),
      contextLabel: `Kampagne${contentLabel ? `: ${contentLabel}` : ""}`,
      contextType: "campaign",
      contextUrl,
    };
  }

  return generalChatContext;
}

export function getSourceContextKey(message: SourceContextMessage): string {
  return getMessageSourceContext(message).contextKey;
}

export function buildSourceContextLabel(message: SourceContextMessage): string {
  return getMessageSourceContext(message).contextLabel;
}

export function getSourceContextActionLabel(
  context: MessageSourceContext,
): string {
  if (!context.contextUrl) return "Original öffnen";
  if (context.contextType === "comment_thread") return "Kommentar öffnen";
  if (context.contextType === "video" || context.contextType === "reel")
    return "Video öffnen";
  if (context.contextType === "general_chat") return "Chat öffnen";
  return "Beitrag öffnen";
}

export function buildReplyTargetAction(
  messageOrConversation: SourceContextMessage | null | undefined,
  fallback?: SourceContextMessage | null,
  options?: {
    fallbackContactLabel?: string | null;
    fallbackContactId?: string | null;
    storedReplyTargetUrl?: string | null;
    storedReplyTargetQuality?: string | null;
    facebookPageId?: string | null;
    facebookBusinessId?: string | null;
  },
): ReplyTargetAction {
  const primary = messageOrConversation ?? null;
  const platform = normalizeText(
    primary?.source_platform ?? fallback?.source_platform,
  );
  const sourceType = normalizeText(
    primary?.source_type ??
      primary?.message_type ??
      fallback?.source_type ??
      fallback?.message_type,
  );
  const replyTargetUrl =
    normalizeHttpUrl(primary?.reply_target_url) ??
    normalizeHttpUrl(fallback?.reply_target_url);
  const sourceUrl =
    normalizeHttpUrl(primary?.source_url) ??
    normalizeHttpUrl(fallback?.source_url);
  const externalThreadId = normalizeText(
    primary?.external_thread_id ?? fallback?.external_thread_id,
  );

  if (platform === "onlyfans") {
    const target = onlyFansManualTarget(replyTargetUrl) ?? onlyFansManualTarget(sourceUrl);
    return {
      href: target ?? "https://onlyfans.com/",
      label: target ? "OnlyFans-Original öffnen" : "OnlyFans öffnen",
      quality: target ? "attempted_thread_link" : "inbox_fallback",
      reason: "Manuell öffnen und den richtigen Fan prüfen. Keine automatische OnlyFans-Anbindung oder Sendefunktion.",
      disabledHint: "OnlyFans wird manuell geöffnet.",
      platform, selectedItemSource: "not_detected",
      fallbackContactLabel: options?.fallbackContactLabel ?? null,
      fallbackContactId: options?.fallbackContactId ?? null,
    };
  }

  if (platform === "facebook" && isMessengerSource(sourceType)) {
    const storedReplyTargetUrl =
      isAllowedManualFacebookThreadUrl(options?.storedReplyTargetUrl)
        ? options?.storedReplyTargetUrl
        : null;
    const storedReplyTargetQuality = normalizeText(
      options?.storedReplyTargetQuality,
    );

    if (storedReplyTargetUrl && storedReplyTargetQuality === "manual_exact_thread") {
      return {
        href: storedReplyTargetUrl,
        label: "Direkten Facebook-Chat öffnen",
        quality: "manual_exact_thread",
        reason: "Manuell hinterlegter Direktlink.",
        disabledHint: "Originalkanal-Link noch nicht verfügbar.",
        platform,
        selectedItemSource: "manual",
      };
    }

    if (
      storedReplyTargetUrl &&
      storedReplyTargetQuality === "auto_selected_item" &&
      extractFacebookSelectedItemId(storedReplyTargetUrl)
    ) {
      return {
        href: storedReplyTargetUrl,
        label: "Direkten Facebook-Chat öffnen",
        quality: "auto_selected_item",
        reason:
          "Direktlink wurde bereits aus einer echten Facebook-Chat-Adresse erkannt und gespeichert.",
        disabledHint: "Originalkanal-Link noch nicht verfügbar.",
        platform,
        selectedItemSource: "stored_auto",
      };
    }

    const selectedFromReplyTarget = extractFacebookSelectedItemId(replyTargetUrl);
    const selectedFromSourceUrl = extractFacebookSelectedItemId(sourceUrl);
    const selectedItemId = selectedFromReplyTarget ?? selectedFromSourceUrl;
    const selectedItemSource: ReplyTargetAction["selectedItemSource"] =
      selectedFromReplyTarget
        ? "reply_target_url"
        : selectedFromSourceUrl
          ? "source_url"
          : "not_detected";
    const threadId =
      extractFacebookThreadId(replyTargetUrl) ??
      extractFacebookThreadId(sourceUrl) ??
      deriveFacebookThreadIdFromExternalThreadId(externalThreadId);
    const pageId =
      extractFacebookPageId(replyTargetUrl) ??
      extractFacebookPageId(sourceUrl) ??
      normalizeFacebookPageId(options?.facebookPageId);
    const businessId =
      extractFacebookBusinessId(replyTargetUrl) ??
      extractFacebookBusinessId(sourceUrl) ??
      normalizeFacebookBusinessId(options?.facebookBusinessId);

    const autoSelectedItemUrl = selectedItemId
      ? buildFacebookBusinessInboxThreadUrl({
          selectedItemId,
          pageId,
          businessId,
          threadId,
        })
      : null;

    if (autoSelectedItemUrl) {
      return {
        href: autoSelectedItemUrl,
        label: "Direkten Facebook-Chat öffnen",
        quality: "auto_selected_item",
        reason:
          "Direktlink wurde automatisch aus den vorhandenen Facebook-Daten aufgebaut.",
        disabledHint: "Originalkanal-Link noch nicht verfügbar.",
        platform,
        selectedItemSource,
      };
    }

    const exactConversationUrl =
      sourceUrl && isGuaranteedFacebookThreadPathUrl(sourceUrl)
        ? sourceUrl
        : null;
    if (exactConversationUrl) {
      return {
        href: exactConversationUrl,
        label: "Facebook-Postfach öffnen",
        quality: "attempted_thread_link",
        reason:
          "Spezifischer Chat-Link vorhanden, Meta kann dennoch eine andere Unterhaltung zeigen.",
        disabledHint: "Originalkanal-Link noch nicht verfügbar.",
        platform,
        selectedItemSource,
      };
    }

    const exactReplyTargetUrl =
      replyTargetUrl && isExactFacebookThreadUrl(replyTargetUrl)
        ? replyTargetUrl
        : null;
    if (exactReplyTargetUrl) {
      return {
        href: exactReplyTargetUrl,
        label: "Facebook-Postfach öffnen",
        quality: "attempted_thread_link",
        reason:
          "Spezifischer Chat-Link vorhanden, Meta kann dennoch eine andere Unterhaltung zeigen.",
        disabledHint: "Originalkanal-Link noch nicht verfügbar.",
        platform,
        selectedItemSource,
      };
    }

    const attemptedThreadId = getFacebookThreadIdentifier(
      replyTargetUrl,
      sourceUrl,
      externalThreadId,
    );
    if (attemptedThreadId) {
      const attemptedUrl = buildFacebookInboxFallbackUrl({
        replyTargetUrl,
        sourceUrl,
        externalThreadId,
      });
      return {
        href: attemptedUrl,
        label: "Facebook-Postfach öffnen",
        quality: "attempted_thread_link",
        reason:
          "Thread-Parameter wurden ergänzt, Meta kann dennoch die zuletzt aktive Unterhaltung öffnen.",
        disabledHint: "Originalkanal-Link noch nicht verfügbar.",
        platform,
        selectedItemSource,
        fallbackContactLabel: options?.fallbackContactLabel ?? null,
        fallbackContactId: options?.fallbackContactId ?? null,
      };
    }

    const inboxUrl = buildFacebookInboxFallbackUrl({
      replyTargetUrl,
      sourceUrl,
      externalThreadId,
    });
    return {
      href: inboxUrl,
      label: "Facebook-Postfach öffnen",
      quality: "inbox_fallback",
      reason:
        "Nur der allgemeine Facebook-Postfach-Zugang ist verfügbar. Bitte den Kontakt dort manuell auswählen.",
      disabledHint: "Originalkanal-Link noch nicht verfügbar.",
      platform,
      selectedItemSource,
      fallbackContactLabel: options?.fallbackContactLabel ?? null,
      fallbackContactId: options?.fallbackContactId ?? null,
    };
  }

  const url = replyTargetUrl ?? sourceUrl;
  if (url) {
    return {
      href: url,
      label: getNonFacebookReplyLabel(platform || sourceType, url),
      quality: "exact_thread",
      reason: "Originalkanal-Link ist gespeichert.",
      disabledHint: "Originalkanal-Link noch nicht verfügbar.",
      platform,
      selectedItemSource: "not_detected",
    };
  }

  return {
    href: null,
    label: "Originalkanal-Link noch nicht verfügbar",
    quality: "unavailable",
    reason:
      "Für diese Nachricht ist noch kein öffnbarer Originalkanal-Link gespeichert.",
    disabledHint: "Originalkanal-Link noch nicht verfügbar.",
    platform,
    selectedItemSource: "not_detected",
  };
}

function isMessengerSource(sourceType: string): boolean {
  return (
    sourceType.includes("message") ||
    sourceType.includes("messenger") ||
    sourceType === "dm"
  );
}

export function isExactFacebookThreadUrl(
  value: string | null | undefined,
): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!host.endsWith("facebook.com")) return false;
    const normalizedPath =
      url.pathname.toLowerCase().replace(/\/+$/, "") || "/";
    const hasThreadQuery =
      Boolean(url.searchParams.get("thread_id")) ||
      Boolean(url.searchParams.get("selected_item_id"));
    const hasThreadPath =
      normalizedPath.includes("/inbox/t/") ||
      normalizedPath.includes("/messenger/t/") ||
      normalizedPath.includes("/messages/t/");
    if (
      normalizedPath === "/" ||
      (normalizedPath === "/latest/inbox" && !hasThreadQuery)
    ) {
      return false;
    }
    if (
      normalizedPath.includes("/posts/") ||
      normalizedPath.includes("/permalink/")
    ) {
      return false;
    }
    return (
      hasThreadPath ||
      hasThreadQuery
    );
  } catch {
    return false;
  }
}

export function isAllowedManualFacebookThreadUrl(
  value: string | null | undefined,
): value is string {
  if (!value || !isExactFacebookThreadUrl(value)) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      ["business.facebook.com", "facebook.com", "www.facebook.com"].includes(
        url.hostname.toLowerCase(),
      )
    );
  } catch {
    return false;
  }
}

function buildFacebookInboxFallbackUrl(options?: {
  replyTargetUrl?: string | null;
  sourceUrl?: string | null;
  externalThreadId?: string | null;
}): string {
  const baseUrl = getFacebookInboxBaseUrl(
    options?.replyTargetUrl,
    options?.sourceUrl,
  );
  const url = new URL(baseUrl);
  const businessId = firstConfiguredEnv(
    "META_BUSINESS_ID",
    "NEXT_PUBLIC_META_BUSINESS_ID",
  );
  if (businessId) url.searchParams.set("business_id", businessId);
  const threadId = getFacebookThreadIdentifier(
    options?.replyTargetUrl,
    options?.sourceUrl,
    options?.externalThreadId,
  );
  if (threadId && !url.searchParams.get("thread_id")) {
    url.searchParams.set("thread_id", threadId);
  }
  return url.toString();
}

function isGuaranteedFacebookThreadPathUrl(
  value: string | null | undefined,
): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!host.endsWith("facebook.com")) return false;
    const normalizedPath =
      url.pathname.toLowerCase().replace(/\/+$/, "") || "/";
    return (
      normalizedPath.includes("/inbox/t/") ||
      normalizedPath.includes("/messenger/t/") ||
      normalizedPath.includes("/messages/t/")
    );
  } catch {
    return false;
  }
}

function getFacebookInboxBaseUrl(
  replyTargetUrl?: string | null,
  sourceUrl?: string | null,
): string {
  for (const candidate of [replyTargetUrl, sourceUrl]) {
    if (!candidate) continue;
    try {
      const parsed = new URL(candidate);
      if (!parsed.hostname.toLowerCase().endsWith("facebook.com")) continue;
      if (!parsed.pathname.toLowerCase().includes("inbox")) continue;
      return parsed.toString();
    } catch {
      continue;
    }
  }
  return "https://business.facebook.com/latest/inbox";
}

function getFacebookThreadIdentifier(
  replyTargetUrl?: string | null,
  sourceUrl?: string | null,
  externalThreadId?: string | null,
): string | null {
  const fromUrl = extractThreadIdFromUrl(replyTargetUrl) ?? extractThreadIdFromUrl(sourceUrl);
  if (fromUrl) return fromUrl;
  const normalized = normalizeText(externalThreadId);
  if (!normalized) return null;
  if (normalized.includes(":")) {
    const [, senderId] = normalized.split(":");
    return senderId?.trim() || null;
  }
  return normalized;
}

function deriveFacebookThreadIdFromExternalThreadId(
  externalThreadId?: string | null,
): string | null {
  const normalized = normalizeText(externalThreadId);
  if (!normalized) return null;
  if (normalized.includes(":")) {
    const [conversationId] = normalized.split(":");
    return conversationId?.trim() || null;
  }
  return normalized;
}

function normalizeFacebookSelectedItemId(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  return /^[a-zA-Z0-9_]+$/.test(normalized) ? normalized : null;
}

function normalizeFacebookPageId(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  return /^[0-9]+$/.test(normalized) ? normalized : null;
}

function normalizeFacebookBusinessId(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  return /^[0-9]+$/.test(normalized) ? normalized : null;
}

export function extractFacebookSelectedItemId(
  value: string | null | undefined,
): string | null {
  return extractSelectedItemIdFromMetaUrl(value);
}

export function extractFacebookThreadId(
  value: string | null | undefined,
): string | null {
  return extractThreadIdFromMetaUrl(value);
}

export function extractSelectedItemIdFromMetaUrl(
  value: string | null | undefined,
): string | null {
  const url = parseMetaUrl(value);
  if (!url) return null;
  return normalizeFacebookSelectedItemId(
    url.searchParams.get("selected_item_id"),
  );
}

export function extractThreadIdFromMetaUrl(
  value: string | null | undefined,
): string | null {
  const url = parseMetaUrl(value);
  if (!url) return null;
  const paramThreadId = normalizeFacebookSelectedItemId(
    url.searchParams.get("thread_id"),
  );
  if (paramThreadId) return paramThreadId;
  const match = url.pathname.match(/\/t\/([^/?#]+)/i);
  return normalizeFacebookSelectedItemId(match?.[1] ?? null);
}

export function extractBusinessInboxUrlCandidates(
  values: Array<string | null | undefined>,
): string[] {
  const candidates = new Set<string>();
  for (const value of values) {
    const url = parseMetaUrl(value);
    if (!url) continue;
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    if (
      host === "business.facebook.com" &&
      (path.includes("/latest/inbox") || path.includes("/inbox"))
    ) {
      candidates.add(url.toString());
      continue;
    }
    if (
      host.endsWith("facebook.com") &&
      extractSelectedItemIdFromMetaUrl(url.toString())
    ) {
      candidates.add(url.toString());
    }
  }
  return Array.from(candidates);
}

function parseMetaUrl(value: string | null | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!url.hostname.toLowerCase().endsWith("facebook.com")) return null;
    return url;
  } catch {
    return null;
  }
}

export function extractFacebookPageId(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return (
      normalizeFacebookPageId(url.searchParams.get("asset_id")) ??
      normalizeFacebookPageId(url.searchParams.get("mailbox_id"))
    );
  } catch {
    return null;
  }
}

export function extractFacebookBusinessId(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return normalizeFacebookBusinessId(url.searchParams.get("business_id"));
  } catch {
    return null;
  }
}

export function buildFacebookBusinessInboxThreadUrl(input: {
  selectedItemId: string;
  pageId?: string | null;
  businessId?: string | null;
  threadId?: string | null;
}): string {
  const url = new URL("https://business.facebook.com/latest/inbox/all/");
  const selectedItemId = normalizeFacebookSelectedItemId(input.selectedItemId);
  if (!selectedItemId) {
    throw new Error("selectedItemId ist für den Facebook-Direktlink erforderlich.");
  }
  const pageId =
    normalizeFacebookPageId(input.pageId) ??
    firstConfiguredEnv("META_FACEBOOK_PAGE_ID", "NEXT_PUBLIC_META_FACEBOOK_PAGE_ID");
  const businessId =
    normalizeFacebookBusinessId(input.businessId) ??
    firstConfiguredEnv("META_BUSINESS_ID", "NEXT_PUBLIC_META_BUSINESS_ID");
  const threadId = normalizeFacebookSelectedItemId(input.threadId);

  if (pageId) {
    url.searchParams.set("asset_id", pageId);
    url.searchParams.set("mailbox_id", pageId);
  }
  if (businessId) {
    url.searchParams.set("business_id", businessId);
  }
  if (threadId) {
    url.searchParams.set("thread_id", threadId);
  }
  url.searchParams.set("ir_qe_exposed", "1");
  url.searchParams.set("selected_item_id", selectedItemId);
  url.searchParams.set("thread_type", "FB_MESSAGE");
  return url.toString();
}

function extractThreadIdFromUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const threadId =
      url.searchParams.get("thread_id") ?? url.searchParams.get("selected_item_id");
    if (threadId?.trim()) return threadId.trim();
    const match = url.pathname.match(/\/t\/([^/?#]+)/i);
    return match?.[1]?.trim() || null;
  } catch {
    return null;
  }
}

function firstConfiguredEnv(...names: string[]): string | null {
  for (const name of names) {
    const value = process.env[name];
    if (value?.trim()) return value.trim();
  }
  return null;
}

function getNonFacebookReplyLabel(platform: string, url: string): string {
  const haystack = `${platform} ${url}`.toLowerCase();
  if (haystack.includes("comment") || haystack.includes("kommentar"))
    return "Kommentar öffnen";
  if (haystack.includes("post") || haystack.includes("beitrag"))
    return "Beitrag öffnen";
  if (
    haystack.includes("dm") ||
    haystack.includes("message") ||
    haystack.includes("messenger") ||
    haystack.includes("chat")
  )
    return "Chat öffnen";
  if (haystack.includes("mail")) return "E-Mail öffnen";
  return "Original öffnen";
}

function getPostContextType(
  platform: string,
  sourceType: string,
  contextUrl: string | null,
): SourceContextType {
  const haystack = `${platform} ${sourceType} ${contextUrl ?? ""}`;
  if (haystack.includes("reel")) return "reel";
  if (haystack.includes("story")) return "story";
  if (haystack.includes("ad") || haystack.includes("anzeige")) return "ad";
  if (haystack.includes("video") || haystack.includes("tiktok")) return "video";
  return "post";
}

function getContextTypeLabel(contextType: SourceContextType): string {
  return {
    general_chat: "Allgemeiner Chat",
    post: "Post",
    reel: "Reel",
    video: "Video",
    story: "Story",
    ad: "Ad",
    campaign: "Kampagne",
    comment_thread: "Kommentar-Thread",
    unknown: "Unbekannt",
  }[contextType];
}

function isCampaignSource(
  sourceType: string,
  contextUrl: string | null,
): boolean {
  const haystack = `${sourceType} ${contextUrl ?? ""}`;
  return (
    haystack.includes("campaign") ||
    haystack.includes("kampagne") ||
    haystack.includes("utm_campaign")
  );
}

function inferVideoId(
  message: SourceContextMessage,
  contextUrl: string | null,
): string | null {
  const sourceType = normalizeText(message.source_type ?? message.message_type);
  if (
    !sourceType.includes("video") &&
    !sourceType.includes("tiktok") &&
    !contextUrl?.includes("/video")
  )
    return null;
  return (
    normalizeText(message.external_message_id) ||
    normalizeText(message.id) ||
    null
  );
}

function buildContentLabel(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.length > 48
    ? `${normalized.slice(0, 45).trim()}…`
    : normalized;
}

function shortenIdentifier(value: string): string {
  return value.length > 14 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

function normalizeText(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeHttpUrl(value: string | null | undefined): string | null {
  const prepared = value?.trim();
  if (!prepared) return null;
  return prepared.startsWith("http://") || prepared.startsWith("https://")
    ? prepared
    : null;
}
