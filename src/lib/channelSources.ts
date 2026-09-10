export type PreparedSourceType =
  | "facebook_messages"
  | "facebook_comments"
  | "instagram_messages"
  | "instagram_comments"
  | "onlyfans_manual"
  | "whatsapp_messages"
  | "telegram_messages"
  | "tiktok_comments"
  | "tiktok_messages"
  | "email"
  | "webform"
  | "manual";

export type SourceInteractionType = "message" | "comment" | "note";
export type SourceStatus =
  | "live"
  | "prepared"
  | "parked"
  | "import_only"
  | "manual";
export type SourcePlatform =
  | "facebook"
  | "instagram"
  | "onlyfans"
  | "whatsapp"
  | "telegram"
  | "tiktok"
  | "email"
  | "webform"
  | "manual";

export type ChannelSourceConfig = {
  sourceType: PreparedSourceType;
  source_platform: SourcePlatform;
  source_type: PreparedSourceType;
  label: string;
  platformName:
    | "Facebook"
    | "Instagram"
    | "OnlyFans"
    | "WhatsApp"
    | "Telegram"
    | "TikTok"
    | "E-Mail"
    | "Webformular"
    | "Manuell";
  platformKey: SourcePlatform;
  interactionType: SourceInteractionType;
  inboundSupported: boolean;
  outboundSupported: boolean;
  mediaSupported: boolean;
  historySyncSupported: boolean;
  liveWebhookSupported: boolean;
  manualFallbackSupported: boolean;
  defaultSyncLimit: number | null;
  status: SourceStatus;
  statusText: string;
  statusHint: string;
  actionLabel:
    | "Chat öffnen"
    | "Kommentar öffnen"
    | "Beitrag öffnen"
    | "Original öffnen"
    | "Notiz öffnen";
  fallbackText: "Original-Link noch nicht verfügbar";
};

export const ORIGINAL_LINK_FALLBACK =
  "Original-Link noch nicht verfügbar" as const;

const base = {
  fallbackText: ORIGINAL_LINK_FALLBACK,
  manualFallbackSupported: true,
  defaultSyncLimit: null,
} as const;

export const CHANNEL_SOURCE_CONFIGS: Record<
  PreparedSourceType,
  ChannelSourceConfig
> = {
  onlyfans_manual: {
    ...base,
    sourceType: "onlyfans_manual", source_platform: "onlyfans", source_type: "onlyfans_manual",
    label: "OnlyFans · manuell", platformName: "OnlyFans", platformKey: "onlyfans",
    interactionType: "message", actionLabel: "Original öffnen", status: "manual",
    inboundSupported: true, outboundSupported: false, mediaSupported: false,
    historySyncSupported: false, liveWebhookSupported: false,
    statusText: "Manuelle Übernahme · keine API-Verbindung",
    statusHint: "Berechtigt vorliegende Nachrichten manuell übernehmen, KI-Entwurf prüfen und selbst auf OnlyFans senden. Technische und rechtliche Prüfung der direkten Anbindung bleibt offen.",
  },
  facebook_messages: {
    ...base,
    sourceType: "facebook_messages",
    source_platform: "facebook",
    source_type: "facebook_messages",
    label: "Facebook Nachrichten",
    platformName: "Facebook",
    platformKey: "facebook",
    interactionType: "message",
    actionLabel: "Chat öffnen",
    status: "live",
    inboundSupported: true,
    outboundSupported: true,
    mediaSupported: true,
    historySyncSupported: true,
    liveWebhookSupported: true,
    defaultSyncLimit: 150,
    statusText:
      "Live verbunden, wenn Page/OAuth eingerichtet ist · kein automatisches Senden",
    statusHint:
      "Messenger-DMs sind verbunden, wenn die Facebook-Page eingerichtet ist. Der Erstabgleich übernimmt bis zu 150 aktuelle Nachrichten je Conversation; danach werden nur neue Ereignisse ergänzt. Antworten bleiben manuell; kein automatisches Senden.",
  },
  facebook_comments: {
    ...base,
    sourceType: "facebook_comments",
    source_platform: "facebook",
    source_type: "facebook_comments",
    label: "Facebook Kommentare",
    platformName: "Facebook",
    platformKey: "facebook",
    interactionType: "comment",
    actionLabel: "Kommentar öffnen",
    status: "parked",
    inboundSupported: false,
    outboundSupported: false,
    mediaSupported: false,
    historySyncSupported: false,
    liveWebhookSupported: false,
    statusText: "Geparkt/vorbereitet · Live-Test später",
    statusHint:
      "Vorbereitet · Noch nicht live: Kommentare bleiben geparkt. Keine automatische Antwort.",
  },
  instagram_messages: {
    ...base,
    sourceType: "instagram_messages",
    source_platform: "instagram",
    source_type: "instagram_messages",
    label: "Instagram Nachrichten",
    platformName: "Instagram",
    platformKey: "instagram",
    interactionType: "message",
    actionLabel: "Chat öffnen",
    status: "prepared",
    inboundSupported: false,
    outboundSupported: false,
    mediaSupported: true,
    historySyncSupported: false,
    liveWebhookSupported: false,
    statusText: "Vorbereitet · API-/Freigabe erforderlich",
    statusHint:
      "Vorbereitet · Noch nicht live: Nachrichtenempfang wird erst nach offizieller Freigabe aktiviert.",
  },
  instagram_comments: {
    ...base,
    sourceType: "instagram_comments",
    source_platform: "instagram",
    source_type: "instagram_comments",
    label: "Instagram Kommentare",
    platformName: "Instagram",
    platformKey: "instagram",
    interactionType: "comment",
    actionLabel: "Kommentar öffnen",
    status: "prepared",
    inboundSupported: false,
    outboundSupported: false,
    mediaSupported: true,
    historySyncSupported: false,
    liveWebhookSupported: false,
    statusText: "Vorbereitet · API-/Freigabe erforderlich",
    statusHint:
      "Vorbereitet · Noch nicht live: Kommentare werden erst nach offizieller Freigabe aktiviert. Kein automatisches Antworten.",
  },
  whatsapp_messages: {
    ...base,
    sourceType: "whatsapp_messages",
    source_platform: "whatsapp",
    source_type: "whatsapp_messages",
    label: "WhatsApp Nachrichten",
    platformName: "WhatsApp",
    platformKey: "whatsapp",
    interactionType: "message",
    actionLabel: "Chat öffnen",
    status: "prepared",
    inboundSupported: false,
    outboundSupported: false,
    mediaSupported: false,
    historySyncSupported: false,
    liveWebhookSupported: false,
    statusText: "Vorbereitet · Inbound-Text standardmäßig aus",
    statusHint:
      "Offizieller Cloud-API-Inbound-Textpfad vorbereitet, aber standardmäßig deaktiviert und nicht live. Keine Medien, kein Outbound und keine automatische Sendefunktion in FanMind.",
  },

  telegram_messages: {
    ...base,
    sourceType: "telegram_messages",
    source_platform: "telegram",
    source_type: "telegram_messages",
    label: "Telegram Nachrichten",
    platformName: "Telegram",
    platformKey: "telegram",
    interactionType: "message",
    actionLabel: "Chat öffnen",
    status: "live",
    inboundSupported: true,
    outboundSupported: false,
    mediaSupported: false,
    historySyncSupported: false,
    liveWebhookSupported: true,
    statusText: "Live-Eingang aktiv · Telegram Bot · kein automatisches Senden",
    statusHint:
      "Telegram ist als erster Live-Eingangskanal verbunden. Eingehende Bot-Nachrichten landen in FanMind. FanMind sendet keine automatischen Antworten.",
  },
  tiktok_comments: {
    ...base,
    sourceType: "tiktok_comments",
    source_platform: "tiktok",
    source_type: "tiktok_comments",
    label: "TikTok Kommentare",
    platformName: "TikTok",
    platformKey: "tiktok",
    interactionType: "comment",
    actionLabel: "Kommentar öffnen",
    status: "prepared",
    inboundSupported: false,
    outboundSupported: false,
    mediaSupported: true,
    historySyncSupported: false,
    liveWebhookSupported: false,
    statusText: "Vorbereitet · offizielle Freigabe erforderlich",
    statusHint:
      "Kommentare sind vorbereitet; Live-Zugriff erst mit offizieller Freigabe. Kein Scraping.",
  },
  tiktok_messages: {
    ...base,
    sourceType: "tiktok_messages",
    source_platform: "tiktok",
    source_type: "tiktok_messages",
    label: "TikTok Nachrichten",
    platformName: "TikTok",
    platformKey: "tiktok",
    interactionType: "message",
    actionLabel: "Chat öffnen",
    status: "import_only",
    inboundSupported: false,
    outboundSupported: false,
    mediaSupported: true,
    historySyncSupported: false,
    liveWebhookSupported: false,
    statusText: "Nicht-live · Export/Data-Portability vorbereitet",
    statusHint:
      "Noch nicht live: Importpfad vorbereitet. Kein Scraping und keine inoffizielle Anbindung.",
  },
  email: {
    ...base,
    sourceType: "email",
    source_platform: "email",
    source_type: "email",
    label: "E-Mail / Postfach",
    platformName: "E-Mail",
    platformKey: "email",
    interactionType: "message",
    actionLabel: "Original öffnen",
    status: "prepared",
    inboundSupported: false,
    outboundSupported: false,
    mediaSupported: true,
    historySyncSupported: false,
    liveWebhookSupported: false,
    statusText: "Vorbereitet · Postfach-Anbindung später",
    statusHint:
      "E-Mail ist als Nachrichtenquelle vorbereitet; keine automatische Sendefunktion in FanMind.",
  },
  webform: {
    ...base,
    sourceType: "webform",
    source_platform: "webform",
    source_type: "webform",
    label: "Webformular / Website-Lead",
    platformName: "Webformular",
    platformKey: "webform",
    interactionType: "message",
    actionLabel: "Original öffnen",
    status: "prepared",
    inboundSupported: false,
    outboundSupported: false,
    mediaSupported: false,
    historySyncSupported: false,
    liveWebhookSupported: false,
    statusText: "Vorbereitet · Formular-Anbindung später",
    statusHint:
      "Webformular-Leads sind als Inbound-Quelle vorbereitet, noch nicht live.",
  },
  manual: {
    ...base,
    sourceType: "manual",
    source_platform: "manual",
    source_type: "manual",
    label: "Manueller Eingang / Notiz",
    platformName: "Manuell",
    platformKey: "manual",
    interactionType: "note",
    actionLabel: "Notiz öffnen",
    status: "manual",
    inboundSupported: true,
    outboundSupported: false,
    mediaSupported: false,
    historySyncSupported: false,
    liveWebhookSupported: false,
    statusText: "Manuell nutzbar · kein Live-Sync",
    statusHint:
      "Manuelle Notizen bleiben manuell und werden nicht als Live-Kanal ausgegeben.",
  },
};

export function isPreparedSourceType(
  value: string | null | undefined,
): value is PreparedSourceType {
  return Boolean(value && value.toLowerCase() in CHANNEL_SOURCE_CONFIGS);
}
export function getChannelSourceConfig(
  value: string | null | undefined,
): ChannelSourceConfig | undefined {
  const key = value?.toLowerCase();
  return isPreparedSourceType(key) ? CHANNEL_SOURCE_CONFIGS[key] : undefined;
}
export function getChannelSourceLabel(
  value: string | null | undefined,
  fallback = "Manuell",
): string {
  return getChannelSourceConfig(value)?.label ?? fallback;
}
export function getChannelSourceActionLabel(
  value: string | null | undefined,
  hasValidUrl: boolean,
): string {
  if (!hasValidUrl) return ORIGINAL_LINK_FALLBACK;
  return getChannelSourceConfig(value)?.actionLabel ?? "Original öffnen";
}
export function getChannelSourceInteractionType(
  value: string | null | undefined,
): SourceInteractionType | undefined {
  return getChannelSourceConfig(value)?.interactionType;
}
export function isValidHttpUrl(
  value: string | null | undefined,
): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}
export function normalizeHttpUrl(
  value: string | null | undefined,
): string | undefined {
  return isValidHttpUrl(value) ? value.trim() : undefined;
}
