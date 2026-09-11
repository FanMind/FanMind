"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ComingSoonMark } from "@/components/ComingSoonMark";
import { PlatformLogo } from "@/components/PlatformLogo";
import { SocialProviderConnection } from "./SocialProviderConnection";
import { ChannelConnectionSteps } from "./ChannelConnectionSteps";
import styles from "./channels.module.css";
import { type TelegramWebhookStatus } from "@/lib/telegramStatus";
import {
  syncFacebookMessengerHistoryFromChannelPage,
  syncInstagramMessengerHistoryFromChannelPage,
} from "./metaSyncActions";

type ChannelStatus =
  | "Live / manuell nutzbar"
  | "Phase 3 / Beta oder Roadmap"
  | "Phase 7 / Roadmap"
  | "Phase 8 / noch nicht begonnen"
  | "Coming Soon / geplant / vorbereitet";
type ChannelPurpose =
  | "Nachrichten"
  | "Kommentare"
  | "Reviews"
  | "Community"
  | "Inbox";
type ChannelCategory =
  | "Globale Hauptkanäle"
  | "Creator & Community"
  | "Business & Reviews"
  | "Internationale Märkte";

type FacebookConnection = {
  page_name: string | null;
  page_id: string | null;
  webhook_subscribed: boolean;
  last_event_at: string | null;
  has_page_access_token: boolean;
  scopes: string[] | null;
  last_comment_fetch_at: string | null;
  last_comment_fetch_count: number | null;
  last_comment_fetch_error: string | null;
  last_messenger_sync_at: string | null;
  last_messenger_sync_checked_count: number | null;
  last_messenger_sync_imported_inbound_count: number | null;
  last_messenger_sync_imported_outbound_count: number | null;
  last_messenger_sync_imported_media_count: number | null;
  last_messenger_sync_skipped_count: number | null;
  last_messenger_sync_error: string | null;
  last_messenger_sync_outbound_at: string | null;
};

type InstagramConnection = {
  account_name: string | null;
  account_id: string | null;
  has_access_token: boolean;
  scopes: string[] | null;
  token_expires_at: string | null;
  webhook_subscribed: boolean;
  last_messenger_sync_at: string | null;
  last_messenger_sync_checked_count: number | null;
  last_messenger_sync_imported_inbound_count: number | null;
  last_messenger_sync_imported_outbound_count: number | null;
  last_messenger_sync_skipped_count: number | null;
  last_messenger_sync_error: string | null;
};

type MetaWebhookStorageHealth = {
  serviceRoleConfigured: boolean;
  tableReadable: boolean;
  error: string | null;
};

type FacebookLiveSetupStatus = {
  facebookAppIdConfigured: boolean;
  facebookAppSecretConfigured: boolean;
  webhookVerifyTokenConfigured: boolean;
  publicBaseUrlConfigured: boolean;
  metaBusinessIdConfigured: boolean;
  oauthCallbackUrl: string | null;
};

type TelegramMessage = {
  id: string;
  contact_id: string;
  author_label: string | null;
  content: string;
  source_type: string | null;
  created_at: string | null;
};

type MetaWebhookEvent = {
  id: string;
  event_type: string;
  page_id: string | null;
  sender_id: string | null;
  text: string | null;
  message_text: string | null;
  status: string;
  error_reason: string | null;
  received_at: string;
};

type ChannelInput = {
  key: string;
  name: string;
  description: string;
  status: ChannelStatus;
  purpose: ChannelPurpose;
  technology: string;
  live: boolean;
};

type Channel = {
  key: string;
  logoKey: string;
  name: string;
  category: ChannelCategory;
  description: string;
  status: ChannelStatus;
  purpose: ChannelPurpose;
  technology: string;
  live: boolean;
  inputs: ChannelInput[];
};

type ChannelGroup = {
  id: string;
  label: ChannelCategory;
  channels: Channel[];
};

const safetyNotice =
  "Keine automatische Sendefunktion. Antworten werden vorbereitet und manuell geprüft.";
const demoNotice =
  "Dieser Demo-Workspace ist öffentlich. Echte Kanalverbindungen und externe Tests sind deaktiviert.";

const phase3ChannelKeys = new Set(["facebook", "instagram", "whatsapp"]);
const phase7ChannelKeys = new Set(["tiktok", "twitter", "discord", "discord-server", "onlyfans"]);
const currentChannelKeys = new Set(["email", "website-chat", "webform", "manual"]);
const preparedPhase8ChannelKeys = new Set(["telegram"]);

function beginMetaAuthorization(provider: "facebook" | "instagram", scope: "messages" | "comments" | "insights") {
  // OAuth needs a document navigation: an SPA fetch cannot follow the external login.
  const target = new URL(`/api/integrations/${provider}/start`, window.location.origin);
  target.searchParams.set("type", `${provider}_${scope}`);
  window.location.assign(target.href);
}

function roadmapPhaseForChannel(key: string) {
  if (phase3ChannelKeys.has(key)) return 3;
  if (phase7ChannelKeys.has(key)) return 7;
  if (currentChannelKeys.has(key)) return null;
  return 8;
}

function roadmapStatusForPhase(phase: number | null): ChannelStatus {
  if (phase === 3) return "Phase 3 / Beta oder Roadmap";
  if (phase === 7) return "Phase 7 / Roadmap";
  if (phase === 8) return "Phase 8 / noch nicht begonnen";
  return "Coming Soon / geplant / vorbereitet";
}

const makeInput = (
  key: string,
  name: string,
  purpose: ChannelPurpose,
  description: string,
  technology = "Roadmap-Eingang vorbereitet",
  live = false,
): ChannelInput => ({
  key,
  name,
  description,
  status: live
    ? "Live / manuell nutzbar"
    : "Coming Soon / geplant / vorbereitet",
  purpose,
  technology,
  live,
});

const makeChannel = (
  group: ChannelCategory,
  key: string,
  name: string,
  purpose: ChannelPurpose,
  description: string,
  technology = "Roadmap-Eingang vorbereitet",
  inputs?: ChannelInput[],
): Channel => {
  const phase = roadmapPhaseForChannel(key);
  const preparedPhase8Groundwork = phase === 8 && preparedPhase8ChannelKeys.has(key);
  const rawInputs = inputs ?? [
    makeInput(key, name, purpose, description, technology),
  ];
  const channelInputs = phase === 8 && !preparedPhase8Groundwork
    ? rawInputs.map((input) => ({
        ...input,
        description: "Diese Verbindung ist Phase 8 zugeordnet. Die Umsetzung hat noch nicht begonnen.",
        status: roadmapStatusForPhase(8),
        technology: "Phase 8 · noch nicht begonnen",
      }))
    : rawInputs.map((input) => ({
        ...input,
        status: input.live
          ? input.status
          : preparedPhase8Groundwork
            ? "Coming Soon / geplant / vorbereitet"
            : roadmapStatusForPhase(phase),
      }));
  const live = channelInputs.every((input) => input.live);

  return {
    key,
    logoKey: key,
    name,
    category: group,
    description: phase === 8 && !preparedPhase8Groundwork
      ? "Diese Plattform ist Phase 8 zugeordnet. Die Umsetzung hat noch nicht begonnen."
      : description,
    status: live
      ? "Live / manuell nutzbar"
      : preparedPhase8Groundwork
        ? "Coming Soon / geplant / vorbereitet"
        : roadmapStatusForPhase(phase),
    purpose,
    technology: phase === 8 && !preparedPhase8Groundwork ? "Phase 8 · noch nicht begonnen" : technology,
    live,
    inputs: channelInputs,
  };
};

const channelGroups: ChannelGroup[] = [
  {
    id: "global",
    label: "Globale Hauptkanäle",
    channels: [
      makeChannel(
        "Globale Hauptkanäle",
        "instagram",
        "Instagram",
        "Inbox",
        "DMs und Kommentare werden als getrennte spätere Verbindungen vorbereitet.",
        "2 vorbereitete Eingänge",
        [
          makeInput(
            "instagram-messages",
            "Nachrichten / DM",
            "Nachrichten",
            "DM-Inbox als vorbereiteter Eingang.",
          ),
          makeInput(
            "instagram-comments",
            "Kommentare",
            "Kommentare",
            "Kommentar-Moderation als geplanter Eingang.",
          ),
        ],
      ),
      makeChannel(
        "Globale Hauptkanäle",
        "tiktok",
        "TikTok",
        "Inbox",
        "Offizielle Profilanmeldung in Vorbereitung. Nachrichten und Kommentare benötigen eine gesonderte Freigabe.",
        "Profilanbindung in Arbeit",
        [
          makeInput(
            "tiktok-messages",
            "Nachrichten",
            "Nachrichten",
            "Nachrichtenzugang wird separat geprüft; Login allein gibt keine DMs frei.",
          ),
          makeInput(
            "tiktok-comments",
            "Kommentare",
            "Kommentare",
            "Kommentar-Signale für spätere Prüfung.",
          ),
        ],
      ),
      makeChannel(
        "Globale Hauptkanäle",
        "youtube",
        "YouTube",
        "Community",
        "Kommentare und Live-Chat sind getrennt sichtbar, aber unter YouTube gebündelt.",
        "2 vorbereitete Eingänge",
        [
          makeInput(
            "youtube-comments",
            "Kommentare",
            "Kommentare",
            "Kommentar-Eingang für Kanalfeedback.",
          ),
          makeInput(
            "youtube-live-chat",
            "Live-Chat",
            "Community",
            "Live-Chat-Auswertung ist geplant.",
          ),
        ],
      ),
      makeChannel(
        "Globale Hauptkanäle",
        "facebook",
        "Facebook",
        "Inbox",
        "Messenger und Page-Kommentare bleiben getrennte vorbereitete Verbindungen.",
        "2 vorbereitete Eingänge",
        [
          makeInput(
            "facebook-messages",
            "Nachrichten",
            "Nachrichten",
            "Messenger-Inbox bleibt bis zur produktiven Freigabe geplant.",
          ),
          makeInput(
            "facebook-comments",
            "Kommentare",
            "Kommentare",
            "Page-Kommentare bleiben bis zur produktiven Freigabe geplant.",
          ),
        ],
      ),
      makeChannel(
        "Globale Hauptkanäle",
        "whatsapp",
        "WhatsApp",
        "Nachrichten",
        "WhatsApp Business Inbox als Roadmap-Kanal.",
        "1 vorbereiteter Eingang",
        [
          makeInput(
            "whatsapp-messages",
            "Nachrichten",
            "Nachrichten",
            "WhatsApp Business Inbox als Roadmap-Kanal.",
          ),
        ],
      ),
      makeChannel(
        "Globale Hauptkanäle",
        "telegram",
        "Telegram",
        "Inbox",
        "Telegram bleibt Coming Soon, solange kein produktiver Kanal aktiv ist.",
        "Bot-/Account-Struktur vorbereitet",
        [
          makeInput(
            "telegram-inbox",
            "Telegram",
            "Inbox",
            "Bot- oder Account-Struktur ist vorbereitet, aber nicht produktiv verbunden.",
            "Bot-/Account-Struktur vorbereitet",
          ),
        ],
      ),
      makeChannel(
        "Globale Hauptkanäle",
        "snapchat",
        "Snapchat",
        "Nachrichten",
        "Snapchat-Inbox ist vorgemerkt.",
      ),
      makeChannel(
        "Globale Hauptkanäle",
        "linkedin",
        "LinkedIn",
        "Inbox",
        "LinkedIn-Nachrichten und Kommentare werden getrennt geplant.",
        "2 vorbereitete Eingänge",
        [
          makeInput(
            "linkedin-messages",
            "Nachrichten",
            "Nachrichten",
            "LinkedIn-Nachrichten als späterer Inbox-Eingang.",
          ),
          makeInput(
            "linkedin-comments",
            "Kommentare",
            "Kommentare",
            "LinkedIn-Kommentare als späterer Moderations-Eingang.",
          ),
        ],
      ),
      makeChannel(
        "Globale Hauptkanäle",
        "discord",
        "Discord",
        "Community",
        "Discord Server / Channel Inbox als geplanter Community-Eingang.",
      ),
      makeChannel(
        "Globale Hauptkanäle",
        "twitter",
        "X / Twitter",
        "Inbox",
        "Offizielle Kontoanmeldung und Direktnachrichten-Lesevorschau in Vorbereitung. Mentions und Antworten folgen separat.",
      ),
      makeChannel(
        "Globale Hauptkanäle",
        "threads",
        "Threads",
        "Kommentare",
        "Threads-Kommentare und Antworten sind vorgemerkt.",
      ),
      makeChannel(
        "Globale Hauptkanäle",
        "reddit",
        "Reddit",
        "Community",
        "Reddit-Konversationen als geplanter Community-Eingang.",
      ),
      makeChannel(
        "Globale Hauptkanäle",
        "email",
        "E-Mail",
        "Inbox",
        "Starter: 1 E-Mail-Inbox. Growth: bis zu 3. Agency: bis zu 10.",
        "Inbox-Kontingente vorbereitet",
        [
          makeInput(
            "email-inbox",
            "E-Mail-Inbox",
            "Inbox",
            "Starter: 1 E-Mail-Inbox · Growth: bis zu 3 · Agency: bis zu 10.",
            "1 / 3 / 10 Inboxes vorbereitet",
          ),
        ],
      ),
      makeChannel(
        "Globale Hauptkanäle",
        "website-chat",
        "Website-Chat",
        "Nachrichten",
        "Website-Chat als späterer Inbox-Kanal.",
      ),
      makeChannel(
        "Globale Hauptkanäle",
        "webform",
        "Webformular",
        "Inbox",
        "Formular-Eingang für Leads und Support-Anfragen.",
      ),
      makeChannel(
        "Globale Hauptkanäle",
        "manual",
        "Manuell / CSV",
        "Inbox",
        "Manuelle Erfassung und CSV-Import sind live nutzbar.",
        "Manuelle Kontakte · Notizen · CSV",
        [
          makeInput(
            "manual-csv",
            "Manuell / CSV",
            "Inbox",
            "Manuelle Erfassung und CSV-Import sind live nutzbar.",
            "Manuelle Kontakte · Notizen · CSV",
            true,
          ),
        ],
      ),
    ],
  },
  {
    id: "creator",
    label: "Creator & Community",
    channels: [
      makeChannel(
        "Creator & Community",
        "onlyfans",
        "OnlyFans",
        "Community",
        "Unverbindliche Phase-7-Prüfung; keine Anbindung oder Zusage.",
        "Phase 7 · technische und rechtliche Prüfung erforderlich",
      ),
      makeChannel(
        "Creator & Community",
        "twitch",
        "Twitch",
        "Community",
        "Streams, Chat und Community-Signale.",
      ),
      makeChannel(
        "Creator & Community",
        "pinterest",
        "Pinterest",
        "Kommentare",
        "Pins und Kommentare als geplanter Eingang.",
      ),
      makeChannel(
        "Creator & Community",
        "patreon",
        "Patreon / Memberships",
        "Community",
        "Membership-Nachrichten und Support-Kontext.",
      ),
      makeChannel(
        "Creator & Community",
        "ko-fi",
        "Ko-fi",
        "Community",
        "Supporter-Nachrichten und Membership-Signale.",
      ),
      makeChannel(
        "Creator & Community",
        "buy-me-a-coffee",
        "Buy Me a Coffee",
        "Community",
        "Supporter-Nachrichten als Roadmap-Kanal.",
      ),
      makeChannel(
        "Creator & Community",
        "substack",
        "Newsletter / Substack",
        "Inbox",
        "Newsletter-Antworten und Community-Kontext.",
      ),
      makeChannel(
        "Creator & Community",
        "youtube-live-chat",
        "YouTube Live-Chat",
        "Community",
        "Live-Chat-Auswertung für Creator.",
      ),
      makeChannel(
        "Creator & Community",
        "discord-server",
        "Discord Server",
        "Community",
        "Server-Community und Channel-Nachrichten.",
      ),
      makeChannel(
        "Creator & Community",
        "reddit-communities",
        "Reddit Communities",
        "Community",
        "Subreddit-Konversationen und Kommentare.",
      ),
    ],
  },
  {
    id: "business",
    label: "Business & Reviews",
    channels: [
      "Google Business Profile",
      "Google Reviews",
      "Reviews / Bewertungen",
      "Trustpilot",
      "App Store Reviews",
      "Play Store Reviews",
      "Shopify",
      "Amazon",
      "Etsy",
      "Mercado Libre",
    ].map((name) =>
      makeChannel(
        "Business & Reviews",
        name,
        name,
        "Reviews",
        "Review-, Shop- oder Business-Feedback als geplanter Eingang.",
      ),
    ),
  },
  {
    id: "international",
    label: "Internationale Märkte",
    channels: [
      "WeChat",
      "Douyin",
      "Xiaohongshu / RedNote",
      "Weibo",
      "Kuaishou",
      "Bilibili",
      "QQ",
      "LINE",
      "KakaoTalk",
      "Viber",
      "ShareChat",
      "Moj",
      "Josh",
    ].map((name) =>
      makeChannel(
        "Internationale Märkte",
        name,
        name,
        "Community",
        "Internationaler Marktkanal als langfristige Roadmap-Vorbereitung.",
      ),
    ),
  },
];
function BodyPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;

  return createPortal(children, document.body);
}

export function ChannelsGrid({
  facebookConnection,
  facebookError,
  facebookLiveSetupStatus,
  instagramConnection,
  instagramError,
  instagramOAuthConfigured,
  demoConnectionsDisabled = false,
}: {
  facebookConnection: FacebookConnection | null;
  facebookError?: string | null;
  instagramConnection: InstagramConnection | null;
  instagramError?: string | null;
  instagramOAuthConfigured: boolean;
  metaWebhookEvents: MetaWebhookEvent[];
  metaWebhookError?: string | null;
  metaWebhookStorageHealth: MetaWebhookStorageHealth;
  facebookLiveSetupStatus: FacebookLiveSetupStatus;
  telegramMessages: TelegramMessage[];
  telegramMessagesError?: string | null;
  telegramSetupStatus: TelegramWebhookStatus;
  telegramCheckRequested: boolean;
  demoConnectionsDisabled?: boolean;
}) {
  const [activeGroupId, setActiveGroupId] = useState(channelGroups[0].id);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [notice, setNotice] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);
  const modalBodyRef = useRef<HTMLDivElement>(null);
  const activeGroup =
    channelGroups.find((group) => group.id === activeGroupId) ??
    channelGroups[0];
  const facebookOAuthConfigured =
    facebookLiveSetupStatus.facebookAppIdConfigured &&
    facebookLiveSetupStatus.facebookAppSecretConfigured &&
    facebookLiveSetupStatus.publicBaseUrlConfigured;

  useEffect(() => {
    const openReturnedChannel = () => {
      const query = new URLSearchParams(window.location.search);
      const provider = query.get("social");
      const connected = query.get("connected");
      const instagramReturn = ["instagram_messages", "instagram_comments", "instagram_insights"].includes(connected ?? "") || query.has("instagram_error");
      const facebookReturn = ["facebook_messages", "facebook_comments", "facebook_insights"].includes(connected ?? "") || query.has("facebook_error");
      const key = provider === "x" ? "twitter" : provider === "tiktok" ? "tiktok" : instagramReturn ? "instagram" : facebookReturn ? "facebook" : null;
      if (!key) return;
      const group = channelGroups.find(group => group.channels.some(channel => channel.key === key));
      const channel = group?.channels.find(channel => channel.key === key);
      if (group && channel) { setActiveGroupId(group.id); setActiveChannel(channel); }
    };
    const frame = window.requestAnimationFrame(openReturnedChannel);
    window.addEventListener("popstate", openReturnedChannel);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("popstate", openReturnedChannel); };
  }, []);

  useEffect(() => {
    if (!activeChannel) return;

    modalBodyRef.current?.scrollTo({ top: 0, left: 0 });
    modalRef.current?.focus({ preventScroll: true });

    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveChannel(null);
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, [activeChannel]);

  const openModal = (channel: Channel) => {
    setNotice("");
    setActiveChannel(channel);
  };

  return (
    <section className={styles.gridSection} aria-label="Kanalkarten">
      {demoConnectionsDisabled ? (
        <p className={styles.modalNotice} role="status">
          {demoNotice}
        </p>
      ) : null}

      <div className={styles.tabs} role="tablist" aria-label="Kanalgruppen">
        {channelGroups.map((group) => {
          const active = group.id === activeGroup.id;

          return (
            <button
              key={group.id}
              type="button"
              className={`${styles.tabButton} ${active ? styles.tabButtonActive : ""}`}
              role="tab"
              aria-selected={active}
              aria-controls="channel-tab-panel"
              id={`channel-tab-${group.id}`}
              onClick={() => setActiveGroupId(group.id)}
            >
              <span>{group.label}</span>
              <span className={styles.tabCount}>{group.channels.length}</span>
            </button>
          );
        })}
      </div>

      <div
        id="channel-tab-panel"
        role="tabpanel"
        aria-labelledby={`channel-tab-${activeGroup.id}`}
        className={styles.channelGrid}
      >
        {activeGroup.channels.map((channel) => (
          <article className={styles.channelCard} key={channel.key}>
            <button
              type="button"
              className={styles.cardButton}
              onClick={() => openModal(channel)}
            >
              <div className={styles.cardTopline}>
                <div className={styles.identityGroup}>
                  <PlatformLogo
                    className={styles.logoTile}
                    platform={channel.logoKey}
                    size="md"
                  />
                  <div>
                    <h3>{channel.name}</h3>
                    <p>{channel.description}</p>
                  </div>
                </div>
                <span
                  className={styles.infoIcon}
                  title="Keine automatische Sendefunktion"
                  aria-label="Info"
                >
                  i
                </span>
              </div>

              <span className={styles.metaRow}>
                <span
                  className={`${styles.statusBadge} ${
                    channel.live ? styles.statusConnected : styles.statusPreview
                  }`}
                >
                  {channel.live ? (
                    <span className={styles.signalDot} aria-hidden="true" />
                  ) : null}
                  {channel.status}
                </span>
                <span className={styles.techBadge}>{channel.technology}</span>
              </span>

              <span className={styles.cardSummary}>
                <span className={styles.inputCountBadge}>
                  {channel.status === "Phase 8 / noch nicht begonnen"
                    ? "Noch keine Eingänge umgesetzt"
                    : channel.inputs.length === 1
                      ? "1 Eingang vorbereitet"
                      : `${channel.inputs.length} Eingänge vorbereitet`}
                </span>
                <span className={styles.inputTypeHint}>
                  {channel.inputs.map((input) => input.purpose).join(" · ")}
                </span>
              </span>

              <span className={styles.cardSpacer} />
              <span className={styles.cardActions}>
                <span className={styles.primaryCardAction}>Details</span>
              </span>
              {!channel.live ? (
                <ComingSoonMark
                  className={styles.soonCornerBadge}
                  size="overlay"
                />
              ) : null}
            </button>
          </article>
        ))}
      </div>

      {activeChannel ? (
        <BodyPortal>
          <div
            className={styles.modalBackdrop}
            role="presentation"
            onMouseDown={() => setActiveChannel(null)}
          >
            <div
              ref={modalRef}
              className={styles.modal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="channel-modal-title"
              tabIndex={-1}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <PlatformLogo
                  className={styles.modalLogo}
                  platform={activeChannel.logoKey}
                  size="lg"
                />
                <div>
                  <p className={styles.modalEyebrow}>Kanal-Roadmap</p>
                  <h2 id="channel-modal-title">{activeChannel.name}</h2>
                  <div className={styles.metaRow}>
                    {!activeChannel.live ? (
                      <ComingSoonMark
                        className={styles.soonBadgeImage}
                        size="small"
                        alt="Coming Soon / geplant / vorbereitet"
                      />
                    ) : (
                      <span
                        className={`${styles.statusBadge} ${styles.statusConnected}`}
                      >
                        {activeChannel.status}
                      </span>
                    )}
                    <span className={styles.techBadge}>
                      {activeChannel.category}
                    </span>
                  </div>
                </div>
              </div>

              <div ref={modalBodyRef} className={styles.modalBody}>
                <p className={styles.modalText}>{activeChannel.description}</p>
                <div className={styles.modalDetailGrid}>
                  {["facebook", "instagram", "onlyfans", "website-chat"].includes(activeChannel.key) ? (
                    <div className={`${styles.releaseBox} ${styles.fullWidthBlock}`}>
                      <strong>KI-Antworten mit menschlicher Übergabe</strong>
                      <p>Jeder Creator verwendet seinen eigenen FanMind-Account. Öffne den passenden Fan, prüfe den KI-Entwurf, kopiere die Antwort und sende sie selbst im Originalkanal. Speichere anschließend nur den tatsächlich gesendeten Text als bestätigten Ausgang.</p>
                      <p>Das Öffnen oder Kopieren einer Antwort ist weder ein Versand- noch ein Kaufnachweis.</p>
                      {activeChannel.key === "onlyfans" ? <p>OnlyFans kann als manuelle Quelle verwendet werden. Eine direkte API-Anbindung, automatischer Abruf oder automatisches Senden ist damit nicht freigegeben. Die technische und rechtliche Prüfung bleibt offen.</p> : null}
                      <Link href="/fans">Fans und Antwortentwürfe öffnen</Link>{" · "}<Link href="/settings/ai-usage">Creator-Stimme vorbereiten</Link>
                    </div>
                  ) : null}
                  {activeChannel.key === "facebook" ? (
                    <div
                      className={`${styles.releaseBox} ${styles.fullWidthBlock}`}
                    >
                      <strong>Eigene Facebook-Seite verbinden · Beta</strong>
                      <ChannelConnectionSteps name="Facebook" />
                      {facebookError ? (
                        <p className={styles.modalNotice} role="alert">
                          {facebookError === "page_selection_required"
                            ? "Dieses Meta-Konto verwaltet mehrere Seiten. FanMind hat bewusst keine Seite automatisch gewählt. Die ausdrückliche Seitenauswahl wird vor dieser Verbindung benötigt."
                            : "Die Facebook-Verbindung wurde nicht abgeschlossen. Es wurden keine fremden Kontodaten übernommen."}
                        </p>
                      ) : null}
                      {facebookConnection ? (
                        <>
                          <ul className={styles.compactStatusList}>
                            <li>
                              Verbundene Seite: {facebookConnection.page_name ?? "Name nicht verfügbar"}
                            </li>
                            <li>
                              Token serverseitig vorhanden: {facebookConnection.has_page_access_token ? "ja" : "nein"}
                            </li>
                            <li>
                              Automatische Webhook-Synchronisierung: {facebookConnection.webhook_subscribed ? "separat aktiviert" : "aus"}
                            </li>
                            <li>
                              Berechtigungen: {facebookConnection.scopes?.length ?? 0}
                            </li>
                            <li>
                              Messenger-Abgleich: {formatSyncTimestamp(facebookConnection.last_messenger_sync_at)}
                            </li>
                            <li>
                              Letzter Lauf: {facebookConnection.last_messenger_sync_imported_inbound_count ?? 0} inbound · {facebookConnection.last_messenger_sync_imported_outbound_count ?? 0} outbound · {facebookConnection.last_messenger_sync_skipped_count ?? 0} bereits vorhanden
                            </li>
                            {facebookConnection.last_messenger_sync_error ? (
                              <li>Letzter Sync-Fehler: {facebookConnection.last_messenger_sync_error}</li>
                            ) : null}
                          </ul>
                          <div className={styles.connectionCardActions}>
                            <form action={syncFacebookMessengerHistoryFromChannelPage}>
                              <button type="submit" disabled={demoConnectionsDisabled}>
                                Facebook-DMs jetzt synchronisieren
                              </button>
                            </form>
                            <button type="button" disabled={demoConnectionsDisabled} onClick={() => beginMetaAuthorization("facebook", "messages")}>
                                Messenger-Berechtigung prüfen
                              </button>
                            <button type="button" disabled={demoConnectionsDisabled} onClick={() => beginMetaAuthorization("facebook", "comments")}>
                                Kommentare freigeben
                              </button>
                            <button type="button" disabled={demoConnectionsDisabled} onClick={() => beginMetaAuthorization("facebook", "insights")}>
                                Insights freigeben
                              </button>
                            <form action="/api/integrations/facebook/disconnect" method="post">
                              <button type="submit" disabled={demoConnectionsDisabled}>
                                Verbindung trennen
                              </button>
                            </form>
                          </div>
                        </>
                      ) : (
                        <>
                          <ul className={styles.compactStatusList}>
                            <li>Login erfolgt direkt bei Meta; kein Passwort wird an FanMind übergeben.</li>
                            <li>Die Verbindung gilt nur für den aktuell angemeldeten FanMind-Workspace.</li>
                            <li>Mehrere verwaltete Seiten werden nicht automatisch ausgewählt.</li>
                            <li>Eigene Posts und Insights werden als Workspace-Cache gespeichert.</li>
                            <li>Beim Erstabgleich werden bis zu 150 aktuelle Nachrichten je Thread geladen; danach ergänzt der Webhook nur neue Ereignisse.</li>
                            <li>Persönliche fremde Profile und Posts werden nicht gespiegelt oder gescrapt.</li>
                            <li>
                              Serverkonfiguration: {facebookOAuthConfigured ? "bereit" : "noch unvollständig"}
                            </li>
                          </ul>
                          <div className={styles.connectionCardActions}>
                            <button
                                type="button"
                                disabled={demoConnectionsDisabled || !facebookOAuthConfigured}
                               onClick={() => beginMetaAuthorization("facebook", "messages")}>
                                Eigene Facebook-Seite verbinden
                              </button>
                          </div>
                        </>
                      )}
                    </div>
                  ) : null}

                  {activeChannel.key === "instagram" ? (
                    <div
                      className={`${styles.releaseBox} ${styles.fullWidthBlock}`}
                    >
                      <strong>Eigenes Instagram-Professional-Konto · Beta</strong>
                      <ChannelConnectionSteps name="Instagram" />
                      {instagramError ? (
                        <p className={styles.modalNotice} role="alert">
                          Die Instagram-Verbindung wurde nicht abgeschlossen. Es wurden keine fremden Kontodaten oder Meta-Rohinhalte gespeichert.
                        </p>
                      ) : null}
                      {instagramConnection ? (
                        <>
                          <ul className={styles.compactStatusList}>
                            <li>Verbundener Account: @{instagramConnection.account_name ?? "Name nicht verfügbar"}</li>
                            <li>Verschlüsselter Zugriff serverseitig: {instagramConnection.has_access_token ? "ja" : "nein"}</li>
                            <li>Berechtigungen: {instagramConnection.scopes?.length ?? 0}</li>
                            <li>Inkrementeller Webhook: {instagramConnection.webhook_subscribed ? "aktiv" : "noch nicht aktiv"}</li>
                            <li>Eigene Posts/Insights: als Workspace-Cache vorgesehen</li>
                            <li>Chats: Erstabgleich bis 150 je Thread, danach inkrementell; KI-Kontext je Stufe 50/100/150</li>
                            <li>DM-Abgleich: {formatSyncTimestamp(instagramConnection.last_messenger_sync_at)}</li>
                            <li>Letzter Lauf: {instagramConnection.last_messenger_sync_imported_inbound_count ?? 0} inbound · {instagramConnection.last_messenger_sync_imported_outbound_count ?? 0} outbound · {instagramConnection.last_messenger_sync_skipped_count ?? 0} bereits vorhanden</li>
                            {instagramConnection.last_messenger_sync_error ? (
                              <li>Letzter Sync-Fehler: {instagramConnection.last_messenger_sync_error}</li>
                            ) : null}
                            <li>Persönliche fremde Posts: keine dauerhafte Kopie</li>
                          </ul>
                          <div className={styles.connectionCardActions}>
                            <form action={syncInstagramMessengerHistoryFromChannelPage}>
                              <button type="submit" disabled={demoConnectionsDisabled}>
                                Instagram-DMs jetzt synchronisieren
                              </button>
                            </form>
                            <button type="button" disabled={demoConnectionsDisabled} onClick={() => beginMetaAuthorization("instagram", "messages")}>
                                DM-Zugriff prüfen
                              </button>
                            <button type="button" disabled={demoConnectionsDisabled} onClick={() => beginMetaAuthorization("instagram", "comments")}>
                                Kommentare freigeben
                              </button>
                            <button type="button" disabled={demoConnectionsDisabled} onClick={() => beginMetaAuthorization("instagram", "insights")}>
                                Insights freigeben
                              </button>
                            <form action="/api/integrations/instagram/disconnect" method="post">
                              <button type="submit" disabled={demoConnectionsDisabled}>
                                Verbindung trennen
                              </button>
                            </form>
                          </div>
                        </>
                      ) : (
                        <>
                          <ul className={styles.compactStatusList}>
                            <li>Login erfolgt direkt bei Instagram; kein Passwort wird an FanMind übergeben.</li>
                            <li>Unterstützt werden nur Professional-Konten.</li>
                            <li>Eigene Posts/Insights werden gecacht; autorisierte Chats werden inkrementell gespeichert.</li>
                            <li>Persönliche fremde Posts oder Profile werden nicht gespiegelt oder gescrapt.</li>
                            <li>Vollständige Followerlisten und Consumer-Konten werden nicht unterstützt.</li>
                            <li>Serverkonfiguration: {instagramOAuthConfigured ? "bereit" : "noch unvollständig"}</li>
                          </ul>
                          <div className={styles.connectionCardActions}>
                            <button
                                type="button"
                                disabled={demoConnectionsDisabled || !instagramOAuthConfigured}
                               onClick={() => beginMetaAuthorization("instagram", "messages")}>
                                Eigenes Instagram-Konto verbinden
                              </button>
                          </div>
                        </>
                      )}
                    </div>
                  ) : null}

                  {activeChannel.key === "tiktok" || activeChannel.key === "twitter" ? (
                    <SocialProviderConnection key={activeChannel.key} provider={activeChannel.key === "twitter" ? "x" : "tiktok"} demo={demoConnectionsDisabled} />
                  ) : null}

                  <div className={styles.releaseBox}>
                    <strong>Details</strong>
                    <ul className={styles.compactStatusList}>
                      <li>Kanalname: {activeChannel.name}</li>
                      <li>Kategorie: {activeChannel.category}</li>
                      <li>Status: {activeChannel.status}</li>
                      <li>Zweck: {activeChannel.purpose}</li>
                      <li>
                        Verbindungen: {activeChannel.inputs.length} getrennte
                        Eingänge
                      </li>
                      {activeChannel.key === "facebook" || activeChannel.key === "instagram" ? (
                        <>
                          <li>Workspace-gebundener Meta-OAuth-Pilot vorhanden</li>
                          <li>Cache und Chat-Sync bleiben bis Staging-/Rechtsabnahme gesperrt</li>
                          <li>Automatisches Senden bleibt deaktiviert</li>
                        </>
                      ) : activeChannel.key === "tiktok" || activeChannel.key === "twitter" ? (
                        <li>Offizielle Kontoanbindung in Vorbereitung; Nutzung erst nach Testfreigabe.</li>
                      ) : (
                        <>
                          <li>Keine OAuth-, Connect- oder Sync-Aktion</li>
                          <li>Externe Kanalaktionen bleiben deaktiviert</li>
                        </>
                      )}
                    </ul>
                  </div>

                  <div
                    className={`${styles.releaseBox} ${styles.fullWidthBlock}`}
                  >
                    <strong>Geplante Verbindungsblöcke</strong>
                    <div className={styles.connectionGrid}>
                      {activeChannel.inputs.map((input) => (
                        <article
                          className={styles.connectionCard}
                          key={input.key}
                        >
                          <div className={styles.connectionCardHeader}>
                            <strong>
                              {activeChannel.name} {input.name}
                            </strong>
                            <span
                              className={`${styles.statusBadge} ${
                                input.live
                                  ? styles.statusConnected
                                  : styles.statusPreview
                              }`}
                            >
                              {input.live ? "Live / manuell" : input.status}
                            </span>
                          </div>
                          <p>{input.description}</p>
                          <div className={styles.inputMeta}>
                            <span>{input.purpose}</span>
                            <span>{input.technology}</span>
                          </div>
                          <span className={styles.connectionHint}>
                            Separat verbindbar, sobald freigegeben.
                          </span>
                          <div className={styles.connectionCardActions}>
                            <button
                              type="button"
                              disabled={demoConnectionsDisabled}
                              onClick={() =>
                                setNotice(
                                  demoConnectionsDisabled
                                    ? demoNotice
                                    : `${activeChannel.name} ${input.name} wurde lokal vorgemerkt. Es wurde keine API-Aktion gestartet.`,
                                )
                              }
                            >
                              {demoConnectionsDisabled
                                ? "Im Demo-Modus deaktiviert"
                                : input.live
                                  ? "Details vormerken"
                                  : "Verbindung vormerken"}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                  <div className={styles.releaseBox}>
                    <strong>Sicherheit</strong>
                    <ul>
                      <li>{safetyNotice}</li>
                      {demoConnectionsDisabled ? <li>{demoNotice}</li> : null}
                      <li>
                        Kein Scraping, kein automatisches Senden, kein Payment.
                      </li>
                    </ul>
                  </div>
                </div>
                {notice ? (
                  <p className={styles.modalNotice} role="status">
                    {notice}
                  </p>
                ) : null}
                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.secondaryModalButton}
                    disabled={demoConnectionsDisabled}
                    onClick={() =>
                      setNotice(
                        demoConnectionsDisabled
                          ? demoNotice
                          : `${activeChannel.name} wurde lokal vorgemerkt. Es wurde keine API-Aktion gestartet.`,
                      )
                    }
                  >
                    {demoConnectionsDisabled
                      ? "Demo-Modus aktiv"
                      : "Details vormerken"}
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryModalButton}
                    onClick={() => setActiveChannel(null)}
                  >
                    Schließen
                  </button>
                </div>
              </div>
            </div>
          </div>
        </BodyPortal>
      ) : null}
    </section>
  );
}

function formatSyncTimestamp(value: string | null): string {
  if (!value) return "noch nicht ausgeführt";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Zeitpunkt nicht verfügbar";
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
