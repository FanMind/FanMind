import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPreActivationRedirect } from "@/lib/preActivation";
import {
  getContactConversationMessages,
  getContactFollowups,
  getContactMemories,
  getContactReplyTarget,
  getFanAnalysisReport,
  getOpenFollowupCount,
  getWorkspaceContact,
  getWorkspaceContacts,
  getWorkspaceSocialConnections,
  getWorkspaceConversations,
  getWorkspaceOpenFollowups,
  getWorkspaceAnalysisCapabilityStatus,
  markContactInboundMessagesSeen,
  signOutSupabaseServerSession,
  type ContactReplyTargetRow,
  type ContactRow,
  type ConversationMessageRow,
  type ConversationRow,
  type FanAnalysisReportRow,
  type FollowupRow,
  type MemoryRow,
  type WorkspaceDashboardRow,
} from "@/lib/supabase/server";
import {
  requireAuthorizedWorkspaceMember,
  requireContactInActiveAuthorizedWorkspace,
} from "@/lib/workspaceAuthorization";
import { isOpenFollowupStatus } from "@/lib/followupStatus";
import { PlatformLogo } from "@/components/PlatformLogo";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { getWorkspaceNavigationForUser } from "@/lib/workspaceNavigation";
import { resolveWorkspaceLocale } from "@/lib/workspaceLocale";
import { wt } from "@/lib/workspaceCopy";
import type { FanMindLanguage } from "@/lib/fanmindCopy";
import { getWorkspaceKpiStatsFromContacts } from "@/lib/workspaceKpiStats";
import { getFanGroupKey } from "@/lib/fanIdentity";
import dashboardStyles from "../../dashboard/dashboard.module.css";
import { formatPlatformLabel } from "../import/csv";
import { getChannelSourceLabel } from "@/lib/channelSources";
import { areDemoConnectionsDisabled } from "@/lib/demoMode";
import styles from "./fan-detail.module.css";
import {
  buildReplyTargetAction,
  getMessageSourceContext,
  type MessageSourceContext,
  type ReplyTargetAction,
} from "@/lib/sourceContext";
import { AiReplySuggestions, type ReplyMode } from "./AiReplySuggestions";
import { FanContextPanel } from "./FanContextPanel";
import { FanActionMenu } from "./FanActionMenu";
import { TopFanToggleForm } from "../TopFanToggleForm";
import {
  saveFacebookReplyTarget,
  syncFacebookChatForContact,
  syncInstagramChatForContact,
} from "../actions";
import {
  diagnoseFacebookDirectLinkSource,
  type FacebookDirectLinkSourceDiagnosis,
} from "@/app/channels/facebookWebhookActions";

type FanDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    notice?: string | string[];
    seen_message?: string | string[];
    channel?: string | string[];
    source?: string | string[];
    lang?: string | string[];
  }>;
};

type FanDetailWorkspaceProps = {
  workspace: WorkspaceDashboardRow;
  userDisplayName: string;
  contact: ContactRow | null;
  contactCount: number;
  contactError?: string;
  memories: MemoryRow[];
  memoriesError?: string;
  followups: FollowupRow[];
  messages: ConversationMessageRow[];
  messagesError?: string;
  conversation: ConversationRow | null;
  conversationsError?: string;
  openFollowupCount: number;
  dueFollowupCount: number;
  notice?: string;
  fanAnalysisReport: FanAnalysisReportRow | null;
  fanAnalysisReportError?: string;
  fanAnalysisGenerationEnabled: boolean;
  fanAnalysisGenerationError?: string;
  activeChannel: ConversationChannelKey;
  activeSource: string;
  facebookMessengerLastSyncedAt?: string | null;
  instagramMessengerLastSyncedAt?: string | null;
  facebookReplyTarget: ContactReplyTargetRow | null;
  facebookReplyTargetError?: string;
  facebookDirectLinkDiagnosis: FacebookDirectLinkSourceDiagnosis | null;
  allContacts: ContactRow[];
  demoConnectionsDisabled: boolean;
  locale: FanMindLanguage;
  userEmail: string | null | undefined;
};

type ConversationChannelKey =
  | "all"
  | "instagram"
  | "whatsapp"
  | "facebook"
  | "tiktok"
  | "telegram"
  | "email"
  | "webform"
  | "notes";

type ConversationChannelTab = {
  key: ConversationChannelKey;
  label: string;
};

const conversationChannelTabs: ConversationChannelTab[] = [
  { key: "all", label: "Alle" },
  { key: "instagram", label: "Instagram" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "facebook", label: "Facebook" },
  { key: "tiktok", label: "TikTok" },
  { key: "telegram", label: "Telegram" },
  { key: "email", label: "E-Mail" },
  { key: "webform", label: "Webformular" },
  { key: "notes", label: "Notizen" },
];

const channelSourceTypes: Record<
  Exclude<ConversationChannelKey, "all">,
  string[]
> = {
  instagram: ["instagram_messages", "instagram_comments"],
  whatsapp: ["whatsapp_messages"],
  facebook: ["facebook_messages", "facebook_comments"],
  tiktok: ["tiktok_messages", "tiktok_comments"],
  telegram: ["telegram_messages", "telegram", "telegram_dm"],
  email: ["email", "e_mail", "manual_email"],
  webform: ["webform", "webformular"],
  notes: ["note", "notes", "manual_note", "internal_note"],
};

async function logout() {
  "use server";

  await signOutSupabaseServerSession();
  redirect("/");
}

function FanDetailWorkspace({
  workspace,
  userDisplayName,
  contact,
  contactCount,
  contactError,
  memories,
  memoriesError,
  followups,
  messages,
  messagesError,
  conversation,
  conversationsError,
  openFollowupCount,
  dueFollowupCount,
  notice,
  fanAnalysisReport,
  fanAnalysisReportError,
  fanAnalysisGenerationEnabled,
  fanAnalysisGenerationError,
  activeChannel,
  activeSource,
  facebookMessengerLastSyncedAt,
  instagramMessengerLastSyncedAt,
  facebookReplyTarget,
  facebookReplyTargetError,
  facebookDirectLinkDiagnosis,
  allContacts,
  demoConnectionsDisabled,
  locale,
  userEmail,
}: FanDetailWorkspaceProps) {
  const memberReadOnly = workspace.role.trim().toLowerCase() !== "owner";
  const { mainNavigation, settingsNavigation, savedViews } =
    getWorkspaceNavigationForUser(
      "fans",
      userEmail,
      locale,
      dueFollowupCount,
      workspace.role,
    );
  const userLabel =
    userDisplayName || workspace.name || (locale === "en" ? "User" : "Nutzer");
  const title = contact?.display_name ?? "Fan-Detail";
  return (
    <WorkspaceShell
      workspaceName={workspace.name}
      userLabel={userLabel}
      planLabel={workspace.plan_id}
      planMeta={workspace.role}
      planStatus={wt(locale, "Aktiv")}
      mainNavigation={mainNavigation}
      settingsNavigation={settingsNavigation}
      savedViews={savedViews}
      header={{
        title,
        subtitle: wt(locale, "Kontaktdetail mit echten Workspace-Daten"),
        searchPlaceholder: wt(locale, "Fans und Nachrichten suchen ..."),
        primaryActionLabel: wt(locale, "Zur Fanliste"),
        primaryActionHref: "/fans#fans-list",
      }}
      contactCount={contactCount}
      openFollowupCount={openFollowupCount}
      showStats={false}
      logoutAction={logout}
      locale={locale}
    >
      <div className={styles.detailStack}>
        <Link className={styles.backLink} href="/fans#fans-list">
          {wt(locale, "← Zurück zur Fanliste")}
        </Link>

        {notice ? (
          <p className={styles.safeNotice}>
            <strong>{formatNotice(notice, locale)}</strong>
          </p>
        ) : null}
        {memberReadOnly ? (
          <p className={styles.safeNotice} role="status">
            <strong>Teamzugang im Nur-Lese-Modus.</strong> Kontakt- und
            Nachrichtenkontext bleiben sichtbar; CRM-, KI- und
            Connector-Aktionen sind dem Workspace-Owner vorbehalten.
          </p>
        ) : null}

        {contactError ? (
          <p className={dashboardStyles.error}>
            <strong>Kontakt konnte nicht geladen werden.</strong>
            <span>{contactError}</span>
          </p>
        ) : null}

        {contact ? (
          <FanDetailContent
            workspaceName={workspace.name}
            contact={contact}
            followups={followups}
            memories={memories}
            memoriesError={memoriesError}
            messages={messages}
            messagesError={messagesError}
            conversation={conversation}
            conversationsError={conversationsError}
            fanAnalysisReport={fanAnalysisReport}
            fanAnalysisReportError={fanAnalysisReportError}
            fanAnalysisGenerationEnabled={fanAnalysisGenerationEnabled}
            fanAnalysisGenerationError={fanAnalysisGenerationError}
            activeChannel={activeChannel}
            activeSource={activeSource}
            facebookMessengerLastSyncedAt={facebookMessengerLastSyncedAt}
            instagramMessengerLastSyncedAt={instagramMessengerLastSyncedAt}
            facebookReplyTarget={facebookReplyTarget}
            facebookReplyTargetError={facebookReplyTargetError}
            facebookDirectLinkDiagnosis={facebookDirectLinkDiagnosis}
            allContacts={allContacts}
            demoConnectionsDisabled={demoConnectionsDisabled}
            locale={locale}
            readOnly={memberReadOnly}
          />
        ) : (
          <FanNotFound />
        )}
      </div>
    </WorkspaceShell>
  );
}

function FanDetailContent({
  workspaceName,
  contact,
  memories,
  memoriesError,
  followups,
  messages,
  messagesError,
  conversation,
  conversationsError,
  fanAnalysisReport,
  fanAnalysisReportError,
  fanAnalysisGenerationEnabled,
  fanAnalysisGenerationError,
  activeChannel,
  activeSource,
  facebookMessengerLastSyncedAt,
  instagramMessengerLastSyncedAt,
  facebookReplyTarget,
  facebookReplyTargetError,
  facebookDirectLinkDiagnosis,
  allContacts,
  demoConnectionsDisabled,
  locale,
  readOnly,
}: {
  workspaceName: string;
  contact: ContactRow;
  memories: MemoryRow[];
  memoriesError?: string;
  followups: FollowupRow[];
  messages: ConversationMessageRow[];
  messagesError?: string;
  conversation: ConversationRow | null;
  conversationsError?: string;
  fanAnalysisReport: FanAnalysisReportRow | null;
  fanAnalysisReportError?: string;
  fanAnalysisGenerationEnabled: boolean;
  fanAnalysisGenerationError?: string;
  activeChannel: ConversationChannelKey;
  activeSource: string;
  facebookMessengerLastSyncedAt?: string | null;
  instagramMessengerLastSyncedAt?: string | null;
  facebookReplyTarget: ContactReplyTargetRow | null;
  facebookReplyTargetError?: string;
  facebookDirectLinkDiagnosis: FacebookDirectLinkSourceDiagnosis | null;
  allContacts: ContactRow[];
  demoConnectionsDisabled: boolean;
  locale: FanMindLanguage;
  readOnly: boolean;
}) {
  const primaryChannel = formatSource(contact.source_platform);
  const activeFanContacts = getActiveRelatedFanContacts(contact, allContacts);
  const availableChannels = getAvailableConversationChannels(
    messages,
    activeFanContacts,
  );
  const effectiveChannel = availableChannels.includes(activeChannel)
    ? activeChannel
    : "all";
  const channelMessages = filterMessagesByChannel(messages, effectiveChannel);
  const availableSources = getAvailableSourceFilterKeys(channelMessages);
  const effectiveSource = availableSources.includes(activeSource)
    ? activeSource
    : "all";
  const channelTabs = buildConversationChannelTabs(
    messages,
    contact.id,
    effectiveChannel,
    effectiveSource,
    availableChannels,
  );
  const sourceFilters = buildSourceFilters(
    messages,
    contact.id,
    effectiveChannel,
    effectiveSource,
  );
  const filteredMessages = filterMessagesBySource(
    channelMessages,
    effectiveSource,
  );
  const originalChannelAction = getOriginalChannelAction(
    conversation,
    filteredMessages,
    contact,
    facebookReplyTarget,
  );
  const timeline = filteredMessages.length
    ? buildMessageTimeline(
        filteredMessages,
        contact,
        facebookReplyTarget,
        workspaceName,
        locale,
      )
    : [];
  const openFollowups = followups.filter((followup) =>
    isOpenFollowupStatus(followup.status),
  );

  return (
    <>
      <section className={styles.contactHeader} aria-label="Fan-Workbench">
        <div className={styles.contactHeaderTop}>
          <div>
            <p className={dashboardStyles.eyebrow}>
              {wt(locale, "Fan-Aktionen")}
            </p>
            <h2>
              {contact.display_name || contact.handle || "Unbenannter Fan"}
            </h2>
            {contact.is_top_fan ? (
              <span className={styles.topFanBadge}>Top Fan</span>
            ) : null}
          </div>
          {demoConnectionsDisabled ? (
            <span className={styles.demoModeBadge}>
              <strong>{wt(locale, "Demo Modus")}</strong>
              <small>{wt(locale, "Externe Verbindungen deaktiviert")}</small>
            </span>
          ) : null}
          {readOnly ? null : (
            <div className={styles.headerActions}>
              <TopFanToggleForm
                contactId={contact.id}
                isTopFan={contact.is_top_fan}
                returnTo={`/fans/${contact.id}`}
              />
              <FanActionMenu
                fanName={contact.display_name || contact.handle || "Fan"}
              />
            </div>
          )}
        </div>
        <dl className={styles.headerMetrics}>
          <div className={styles.metric}>
            <dt>{wt(locale, "Owner")}</dt>
            <dd>
              <strong>
                {workspaceName ||
                  (locale === "en" ? "Workspace team" : "Workspace-Team")}
              </strong>
            </dd>
          </div>
          <div className={styles.metric}>
            <dt>{wt(locale, "Letzter Kontakt")}</dt>
            <dd>
              <strong>
                {formatDate(contact.updated_at || contact.created_at)}
              </strong>
            </dd>
          </div>
          <div className={styles.metric}>
            <dt>{wt(locale, "Kontakt seit")}</dt>
            <dd>
              <strong>{formatDate(contact.created_at)}</strong>
            </dd>
          </div>
          <div className={styles.metric}>
            <dt>{wt(locale, "Primärkanal")}</dt>
            <dd>
              <strong>{primaryChannel}</strong>
            </dd>
          </div>
          <div className={styles.metric}>
            <dt>{wt(locale, "Offene Follow-ups")}</dt>
            <dd>
              <strong>{openFollowups.length}</strong>
            </dd>
          </div>
        </dl>
      </section>

      <section
        className={styles.workbenchGrid}
        aria-label="Conversation Workbench"
      >
        <main
          className={styles.conversation}
          aria-label={wt(locale, "Kanalübergreifender Nachrichtenverlauf")}
        >
          <article className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <p className={dashboardStyles.eyebrow}>
                  {wt(locale, "Nachrichtenverlauf")}
                </p>
                <h3>{wt(locale, "Kanalübergreifender Nachrichtenverlauf")}</h3>
              </div>
            </div>
            <nav
              className={styles.channelTabs}
              aria-label="Verlauf nach Kanal filtern"
            >
              {channelTabs.map((tab) => (
                <Link
                  aria-current={tab.active ? "page" : undefined}
                  className={
                    tab.active ? styles.channelTabActive : styles.channelTab
                  }
                  href={tab.href}
                  key={tab.key}
                >
                  <PlatformLogo
                    className={styles.channelIcon}
                    platform={tab.key}
                    size="sm"
                  />
                  <span>{tab.label}</span>
                  {tab.hasUnread ? (
                    <span
                      aria-label="Ungesehene eingehende Nachrichten"
                      className={styles.unreadDot}
                    />
                  ) : null}
                </Link>
              ))}
            </nav>
            <nav
              className={styles.sourceTabs}
              aria-label="Verlauf nach Ursprung filtern"
            >
              {sourceFilters.map((filter) => (
                <Link
                  aria-current={filter.active ? "page" : undefined}
                  className={
                    filter.active ? styles.sourceTabActive : styles.sourceTab
                  }
                  href={filter.href}
                  key={filter.key}
                >
                  {filter.label}
                </Link>
              ))}
            </nav>
            {conversationsError ? (
              <p className={dashboardStyles.error}>
                <strong>
                  Conversation-Daten konnten gerade nicht geladen werden.
                </strong>
                <span>{conversationsError}</span>
              </p>
            ) : null}
            {messagesError ? (
              <p className={dashboardStyles.error}>
                <strong>Nachrichten konnten nicht geladen werden.</strong>
                <span>{messagesError}</span>
              </p>
            ) : null}
            {demoConnectionsDisabled ? (
              <p className={styles.demoCompactNotice}>
                Demo-Modus: Externe Kanalzugriffe sind deaktiviert.
                KI-Vorschläge und interne Bearbeitung können getestet werden.
              </p>
            ) : null}
            {!readOnly && shouldShowFacebookHelpers(effectiveChannel, filteredMessages) &&
            !demoConnectionsDisabled ? (
              <div className={styles.syncBox}>
                <p className={styles.syncHint}>
                  Facebook-Chat zuletzt synchronisiert:{" "}
                  <strong>
                    {facebookMessengerLastSyncedAt
                      ? formatDate(facebookMessengerLastSyncedAt)
                      : "noch nicht"}
                  </strong>{" "}
                  · Erstabgleich bis zu 150, danach nur neue Nachrichten.
                </p>
                {demoConnectionsDisabled ? (
                  <button
                    className={dashboardStyles.secondaryButton}
                    type="button"
                    disabled
                  >
                    Demo-Modus: Facebook-Chat aktualisieren blockiert
                  </button>
                ) : (
                  <form
                    action={syncFacebookChatForContact.bind(null, contact.id)}
                  >
                    <button
                      className={dashboardStyles.secondaryButton}
                      type="submit"
                    >
                      Facebook-Chat aktualisieren
                    </button>
                  </form>
                )}
              </div>
            ) : null}
            {!readOnly && shouldShowInstagramHelpers(effectiveChannel, filteredMessages) &&
            !demoConnectionsDisabled ? (
              <div className={styles.syncBox}>
                <p className={styles.syncHint}>
                  Instagram-Chat zuletzt synchronisiert:{" "}
                  <strong>
                    {instagramMessengerLastSyncedAt
                      ? formatDate(instagramMessengerLastSyncedAt)
                      : "noch nicht"}
                  </strong>{" "}
                  · Erstabgleich bis zu 150, danach nur neue Nachrichten.
                </p>
                <form
                  action={syncInstagramChatForContact.bind(null, contact.id)}
                >
                  <button
                    className={dashboardStyles.secondaryButton}
                    type="submit"
                  >
                    Instagram-Chat aktualisieren
                  </button>
                </form>
              </div>
            ) : null}
            {!readOnly && shouldShowFacebookHelpers(effectiveChannel, filteredMessages) &&
            !demoConnectionsDisabled ? (
              <FacebookReplyTargetCard
                contact={contact}
                target={facebookReplyTarget}
                error={facebookReplyTargetError}
                directAction={originalChannelAction}
                diagnosis={facebookDirectLinkDiagnosis}
                demoConnectionsDisabled={demoConnectionsDisabled}
              />
            ) : null}
            <div className={styles.timeline}>
              {timeline.length ? (
                timeline.map((item) => (
                  <article
                    className={`${styles.message} ${item.directionKind === "inbound" ? styles.messageFan : styles.messageTeam}`}
                    key={item.id}
                  >
                    <time
                      className={styles.messageTime}
                      dateTime={item.createdAt ?? undefined}
                    >
                      {item.time}
                    </time>
                    <div className={styles.messageAvatar} aria-hidden="true">
                      {item.avatar}
                    </div>
                    <div className={styles.messageBubble}>
                      <div className={styles.messageMeta}>
                        <span>
                          {item.direction} · {item.type}
                        </span>
                        <span className={styles.channelBadge}>
                          <PlatformLogo
                            platform={item.sourcePlatform}
                            size="sm"
                          />
                          {item.channel}
                        </span>
                        <span className={styles.sourceBadge}>
                          {item.sourceContext.contextLabel}
                        </span>
                      </div>
                      <p>{item.text}</p>
                      <AttachmentPreview attachments={item.attachments} />
                      {readOnly || demoConnectionsDisabled ? null : (
                        <OriginalChatAction
                          action={item.replyAction}
                          compact
                          demoConnectionsDisabled={demoConnectionsDisabled}
                        />
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <EmptyState
                  title={getTimelineEmptyTitle(effectiveChannel)}
                  body={getTimelineEmptyBody(effectiveChannel)}
                />
              )}
            </div>
          </article>
          {readOnly ? null : (
            <AiReplySuggestions
            contact={{
              contactId: contact.id,
              displayName: contact.display_name,
              handle: contact.handle,
              sourcePlatform: contact.source_platform,
              latestInboundMessage: getLatestInboundMessage(messages),
              language: contact.language,
              status: contact.status,
              tags: contact.tags,
              summary: contact.summary,
            }}
            modes={defaultReplyModes}
            originalChannelAction={{
              href: originalChannelAction.href,
              label: getOriginalChannelButtonLabel(
                originalChannelAction,
                messages,
                contact,
              ),
            }}
            demoConnectionsDisabled={demoConnectionsDisabled}
            telegramSendEnabled={
              process.env.FANMIND_ENABLE_TELEGRAM_SEND === "true"
            }
            locale={locale}
            />
          )}
        </main>

        <aside
          className={styles.copilot}
          aria-label={locale === "en" ? "Fan context" : "Fan-Kontext"}
        >
          <FanContextPanel
            contact={contact}
            memories={memories}
            memoriesError={memoriesError}
            followups={followups}
            report={fanAnalysisReport}
            reportError={fanAnalysisReportError}
            hasNewMessages={hasMessagesAfterReport(messages, fanAnalysisReport)}
            storedMessageCount={messages.length}
            locale={locale}
            readOnly={readOnly}
            analysisGenerationEnabled={fanAnalysisGenerationEnabled}
            analysisGenerationError={fanAnalysisGenerationError}
          />
        </aside>
      </section>
    </>
  );
}

function countDueOrOverdueOpenFollowups(followups: FollowupRow[]): number {
  const today = new Date().toISOString().slice(0, 10);

  return followups.filter(
    (followup) =>
      followup.status === "open" &&
      followup.due_date !== null &&
      followup.due_date <= today,
  ).length;
}

function shouldShowFacebookHelpers(
  activeChannel: ConversationChannelKey,
  visibleMessages: ConversationMessageRow[],
): boolean {
  return (
    activeChannel !== "telegram" &&
    (activeChannel === "all" || activeChannel === "facebook") &&
    hasFacebookMessages(visibleMessages)
  );
}

function shouldShowInstagramHelpers(
  activeChannel: ConversationChannelKey,
  visibleMessages: ConversationMessageRow[],
): boolean {
  return (
    activeChannel !== "telegram" &&
    (activeChannel === "all" || activeChannel === "instagram") &&
    visibleMessages.some((message) =>
      isMessageInChannel(message, "instagram"),
    )
  );
}

function getTimelineEmptyTitle(activeChannel: ConversationChannelKey): string {
  if (activeChannel === "all")
    return "Noch kein gespeicherter Nachrichtenverlauf.";
  return `Keine ${getChannelEmptyLabel(activeChannel)} für diesen Fan vorhanden.`;
}

function getTimelineEmptyBody(activeChannel: ConversationChannelKey): string {
  if (activeChannel === "all") {
    return "Sobald echte Nachrichten eingehen, erscheinen sie hier chronologisch.";
  }
  return "Wähle „Alle“, um kanalübergreifende Einträge zu sehen, oder prüfe einen anderen Kanalfilter.";
}

function getChannelEmptyLabel(activeChannel: ConversationChannelKey): string {
  const tab = conversationChannelTabs.find(
    (item) => item.key === activeChannel,
  );
  if (!tab) return "Nachrichten";
  if (activeChannel === "notes") return "manuellen Notizen";
  return `${tab.label}-Nachrichten`;
}

const defaultReplyModes: ReplyMode[] = [
  {
    id: "friendly",
    label: "Freundlich",
    prompt: "warm, persönlich und hilfreich",
  },
  {
    id: "short",
    label: "Kurz & direkt",
    prompt: "knapp, klar und ohne Umwege",
  },
  {
    id: "sales",
    label: "Verkaufsorientiert",
    prompt: "vorsichtig verkaufsorientiert ohne Druck",
  },
  {
    id: "calming",
    label: "Beruhigend",
    prompt: "ruhig, deeskalierend und sicherheitsgebend",
  },
  { id: "casual", label: "Locker", prompt: "natürlich, locker und nahbar" },
  {
    id: "vip",
    label: "VIP/Premium",
    prompt: "wertschätzend, exklusiv und serviceorientiert",
  },
];

function normalizeConversationChannel(value: string): ConversationChannelKey {
  return conversationChannelTabs.some((tab) => tab.key === value)
    ? (value as ConversationChannelKey)
    : "all";
}

function buildConversationChannelTabs(
  messages: ConversationMessageRow[],
  contactId: string,
  activeChannel: ConversationChannelKey,
  activeSource: string,
  availableChannels: ConversationChannelKey[],
) {
  return conversationChannelTabs
    .filter((tab) => availableChannels.includes(tab.key))
    .map((tab) => {
      const channelMessages =
        tab.key === "all"
          ? messages
          : filterMessagesByChannel(messages, tab.key);
      const hasUnread = channelMessages.some(
        (message) => message.direction === "inbound" && !message.seen_at,
      );
      const targetSourceKeys = getAvailableSourceFilterKeys(channelMessages);
      const params = new URLSearchParams();
      if (tab.key !== "all") params.set("channel", tab.key);
      if (activeSource !== "all" && targetSourceKeys.includes(activeSource)) {
        params.set("source", activeSource);
      }
      const query = params.toString();
      const href = `/fans/${contactId}${query ? `?${query}` : ""}`;

      return { ...tab, active: tab.key === activeChannel, hasUnread, href };
    });
}

function buildSourceFilters(
  messages: ConversationMessageRow[],
  contactId: string,
  activeChannel: ConversationChannelKey,
  activeSource: string,
) {
  const channelMessages = filterMessagesByChannel(messages, activeChannel);
  const contexts = getAvailableSourceContexts(channelMessages);

  const paramsFor = (source: string) => {
    const params = new URLSearchParams();
    if (activeChannel !== "all") params.set("channel", activeChannel);
    if (source !== "all") params.set("source", source);
    const query = params.toString();
    return `/fans/${contactId}${query ? `?${query}` : ""}`;
  };

  return [
    {
      key: "all",
      label: "Alle Ursprünge",
      active: activeSource === "all",
      href: paramsFor("all"),
    },
    ...contexts.map((context) => ({
      key: context.contextKey,
      label: context.contextLabel,
      active: activeSource === context.contextKey,
      href: paramsFor(context.contextKey),
    })),
  ];
}

function getActiveRelatedFanContacts(
  contact: ContactRow,
  allContacts: ContactRow[],
): ContactRow[] {
  const baseKey = getFanGroupKey(contact);
  const relatedContacts = allContacts.filter(
    (entry) => getFanGroupKey(entry) === baseKey && !isArchivedContact(entry),
  );

  if (relatedContacts.some((entry) => entry.id === contact.id)) {
    return relatedContacts;
  }

  return isArchivedContact(contact)
    ? relatedContacts
    : [contact, ...relatedContacts];
}

function getAvailableConversationChannels(
  messages: ConversationMessageRow[],
  activeContacts: ContactRow[],
): ConversationChannelKey[] {
  const channels = new Set<ConversationChannelKey>(["all"]);

  for (const contact of activeContacts) {
    const channel = normalizeContactPlatformChannel(contact.source_platform);
    if (channel) channels.add(channel);
  }

  for (const message of messages) {
    const channel = getMessageExplicitChannel(message);
    if (channel) channels.add(channel);
  }

  return conversationChannelTabs
    .map((tab) => tab.key)
    .filter((channel) => channels.has(channel));
}

function getAvailableSourceFilterKeys(
  messages: ConversationMessageRow[],
): string[] {
  return [
    "all",
    ...getAvailableSourceContexts(messages).map(
      (context) => context.contextKey,
    ),
  ];
}

function getAvailableSourceContexts(
  messages: ConversationMessageRow[],
): MessageSourceContext[] {
  const contexts = new Map<string, MessageSourceContext>();

  for (const message of messages) {
    const context = getMessageSourceContext(message);
    if (!contexts.has(context.contextKey)) {
      contexts.set(context.contextKey, context);
    }
  }

  return Array.from(contexts.values());
}

function normalizeContactPlatformChannel(
  value: string | null | undefined,
): Exclude<ConversationChannelKey, "all"> | null {
  const platform = normalizeSourceValue(value);
  return isConversationPlatformChannel(platform) ? platform : null;
}

function getMessageExplicitChannel(
  message: ConversationMessageRow,
): Exclude<ConversationChannelKey, "all"> | null {
  const platform = normalizeSourceValue(message.source_platform);
  if (isConversationPlatformChannel(platform)) return platform;

  const sourceType = normalizeSourceValue(message.source_type);
  for (const tab of conversationChannelTabs) {
    if (tab.key !== "all" && isExplicitChannelSourceType(sourceType, tab.key)) {
      return tab.key;
    }
  }

  return null;
}

function isConversationPlatformChannel(
  value: string,
): value is Exclude<ConversationChannelKey, "all"> {
  return conversationChannelTabs.some(
    (tab) => tab.key !== "all" && tab.key === value,
  );
}

function isArchivedContact(contact: ContactRow): boolean {
  return normalizeSourceValue(contact.status) === "archived";
}

function filterMessagesBySource(
  messages: ConversationMessageRow[],
  activeSource: string,
): ConversationMessageRow[] {
  if (activeSource === "all") return messages;
  return messages.filter(
    (message) => getMessageSourceContext(message).contextKey === activeSource,
  );
}

function filterMessagesByChannel(
  messages: ConversationMessageRow[],
  channel: ConversationChannelKey,
): ConversationMessageRow[] {
  if (channel === "all") return messages;
  return messages.filter((message) => isMessageInChannel(message, channel));
}

function isMessageInChannel(
  message: ConversationMessageRow,
  channel: Exclude<ConversationChannelKey, "all">,
): boolean {
  const sourceType = normalizeSourceValue(message.source_type);
  const platform = normalizeSourceValue(message.source_platform);
  const messageType = normalizeSourceValue(message.message_type);

  if (platform === channel) {
    return true;
  }

  if (isExplicitChannelSourceType(sourceType, channel)) {
    return true;
  }

  if (channel === "notes") {
    return message.direction === "note" || messageType === "note";
  }
  if (channel === "email") {
    return platform.includes("mail") || sourceType.includes("mail");
  }
  if (channel === "webform") {
    return platform === "webform" || sourceType === "webform";
  }

  return false;
}

function normalizeSourceValue(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function isExplicitChannelSourceType(
  sourceType: string,
  channel: Exclude<ConversationChannelKey, "all">,
): boolean {
  if (!sourceType) return false;
  return (
    channelSourceTypes[channel].includes(sourceType) ||
    sourceType.startsWith(`${channel}_`)
  );
}

function OriginalChatAction({
  action,
  className,
  demoConnectionsDisabled = false,
}: {
  action: ReplyTargetAction;
  className?: string;
  compact?: boolean;
  demoConnectionsDisabled?: boolean;
}) {
  if (demoConnectionsDisabled && action.platform === "facebook") {
    return (
      <div className={className}>
        <button
          className={dashboardStyles.secondaryButton}
          type="button"
          disabled
        >
          Demo-Fallback: Facebook-Postfach blockiert
        </button>
        <small className={styles.muted}>
          Dieser Demo-Workspace ist öffentlich. Echte externe Direktlinks werden
          hier nicht geöffnet; KI-Vorschläge können weiterhin kopiert werden.
        </small>
      </div>
    );
  }

  if (!action.href) return null;

  return (
    <div className={className}>
      <a
        className={dashboardStyles.secondaryButton}
        href={action.href}
        rel="noreferrer"
        target="_blank"
        title={action.reason}
      >
        {action.label}
      </a>
      {action.quality === "auto_selected_item" &&
      action.platform === "facebook" ? (
        <small className={styles.muted}>
          FanMind öffnet den Facebook-Chat über die erkannte
          Facebook-Kontakt-ID.
        </small>
      ) : null}
      {action.quality === "manual_exact_thread" &&
      action.platform === "facebook" ? (
        <small className={styles.muted}>
          Öffnet den gespeicherten Chat-Link.
        </small>
      ) : null}
      {(action.quality === "attempted_thread_link" ||
        action.quality === "inbox_fallback") &&
      action.platform === "facebook" ? (
        <small className={styles.muted}>
          Meta öffnet eventuell die zuletzt aktive Unterhaltung. FanMind prüft
          beim Sync automatisch verfügbare Direktlink-Daten. Falls nötig, kann
          im Postfach manuell dieser Kontakt gewählt werden:{" "}
          {action.fallbackContactLabel ?? "Kontakt"}
          {action.fallbackContactId
            ? ` · Facebook-ID: ${action.fallbackContactId}`
            : ""}
        </small>
      ) : null}
    </div>
  );
}

function FacebookReplyTargetCard({
  contact,
  target,
  error,
  directAction,
  diagnosis,
  demoConnectionsDisabled,
}: {
  contact: ContactRow;
  target: ContactReplyTargetRow | null;
  error?: string;
  directAction: ReplyTargetAction;
  diagnosis: FacebookDirectLinkSourceDiagnosis | null;
  demoConnectionsDisabled: boolean;
}) {
  const hasAutoDirectLink =
    directAction.platform === "facebook" &&
    directAction.quality === "auto_selected_item";
  const hasManualDirectLink =
    directAction.platform === "facebook" &&
    directAction.quality === "manual_exact_thread";
  const hasDirectLink = hasAutoDirectLink || hasManualDirectLink;
  const directLinkStatus = hasDirectLink
    ? "Direktlink vorhanden"
    : "Direktlink fehlt";
  const selectedItemStatus = hasDirectLink
    ? `Direktlink-ID erkannt aus: ${formatSelectedItemSource(directAction.selectedItemSource)}`
    : "Direktlink-ID nicht erkannt";
  const storageUnavailable =
    error?.includes(
      "Der exakte Chat-Link kann derzeit nicht gespeichert werden.",
    ) ?? false;
  const fallbackHint = hasAutoDirectLink
    ? "Direkter Chat-Link wurde automatisch erkannt und wird verwendet."
    : hasManualDirectLink
      ? "Direkter Chat-Link ist gespeichert und wird verwendet."
      : storageUnavailable
        ? "Direktlink-Speicherung ist derzeit nicht verfügbar. Das Facebook-Postfach kann weiterhin geöffnet werden."
        : error
          ? "Ein gespeicherter Direktlink konnte gerade nicht geladen werden. FanMind sammelt die nötigen Linkdaten weiter automatisch beim Sync."
          : "FanMind ermittelt den Direktlink automatisch über verfügbare Facebook-Metadaten beim Sync.";

  return (
    <details
      className={styles.replyTargetBox}
      open={!hasDirectLink || Boolean(error)}
    >
      <summary>
        {hasDirectLink
          ? "Direkter Facebook-Chat-Link hinterlegt"
          : "Facebook-Direktchat wird automatisch ermittelt"}
      </summary>
      <p className={styles.syncHint}>{fallbackHint}</p>
      <p className={styles.muted}>
        {directLinkStatus} · {selectedItemStatus}
      </p>
      {diagnosis ? (
        <div className={styles.replyTargetStatus}>
          <span>Graph-API-Version: {diagnosis.graphApiVersion}</span>
          <span>
            Meta-Direktlink-Quelle prüfen:{" "}
            {diagnosis.directLinkIdDetected
              ? "Direktlink-ID erkannt"
              : "Direktlink-ID nicht erkannt"}
          </span>
          <span>
            Conversation-Feldset stabil:{" "}
            {diagnosis.conversationFieldsetStable ? "ja" : "nein"}
          </span>
          <span>
            Message-Feldset stabil:{" "}
            {diagnosis.messageFieldsetStable ? "ja" : "nein"}
          </span>
          <span>
            Link-Felder gefunden: {diagnosis.linkFieldsFound ? "ja" : "nein"}
          </span>
          <span>
            Business-Inbox-URL gefunden:{" "}
            {diagnosis.businessInboxUrlFound ? "ja" : "nein"}
          </span>
          <span>
            selected_item_id erkannt:{" "}
            {diagnosis.selectedItemIdRecognized ? "ja" : "nein"}
          </span>
          <span>
            Quelle: {formatSelectedItemSource(diagnosis.directLinkIdSource)}
          </span>
          <span>
            Conversation-Link vorhanden:{" "}
            {diagnosis.conversationLinkAvailable > 0 ? "ja" : "nein"}
          </span>
          <span>
            Conversation-Link mit Direktlink-ID:{" "}
            {diagnosis.conversationLinkWithDirectId}/
            {diagnosis.sampledConversations}
          </span>
          <span>
            Teilnehmer-IDs vorhanden:{" "}
            {diagnosis.participantIdsAvailable > 0 ? "ja" : "nein"}
          </span>
          <span>
            Kontakt in geprüfter Auswahl gefunden:{" "}
            {diagnosis.matchedConversationFound ? "ja" : "nein"}
          </span>
          {diagnosis.participantIdMatchesDirectId !== null ? (
            <span>
              Teilnehmer-ID entspricht Direktlink-ID:{" "}
              {diagnosis.participantIdMatchesDirectId ? "ja" : "nein"}
            </span>
          ) : null}
          {diagnosis.conversationFieldProbes.map((probe) => (
            <span key={probe.label}>
              {probe.label}: Endpoint erfolgreich {probe.ok ? "ja" : "nein"} ·
              Link-Feld {probe.linkFieldPresent ? "ja" : "nein"} · Direktlink-ID
              in Link {probe.selectedItemIdInLink ? "ja" : "nein"} ·
              participants {probe.participantsPresent ? "ja" : "nein"} · senders{" "}
              {probe.sendersPresent ? "ja" : "nein"} · can_reply{" "}
              {probe.canReplyFieldPresent ? "ja" : "nein"} · scoped_thread_key{" "}
              {probe.scopedThreadKeyFieldPresent ? "ja" : "nein"} ·
              message_count {probe.messageCountFieldPresent ? "ja" : "nein"}
              {probe.observedKeys.length > 0
                ? ` · Keys: ${probe.observedKeys.join(", ")}`
                : ""}
            </span>
          ))}
          {diagnosis.messageFieldProbe ? (
            <span>
              {diagnosis.messageFieldProbe.label}: Endpoint erfolgreich{" "}
              {diagnosis.messageFieldProbe.ok ? "ja" : "nein"} · from{" "}
              {diagnosis.messageFieldProbe.fromFieldPresent ? "ja" : "nein"} ·
              to {diagnosis.messageFieldProbe.toFieldPresent ? "ja" : "nein"} ·
              attachments{" "}
              {diagnosis.messageFieldProbe.attachmentsFieldPresent
                ? "ja"
                : "nein"}{" "}
              · shares{" "}
              {diagnosis.messageFieldProbe.sharesFieldPresent ? "ja" : "nein"} ·
              tags{" "}
              {diagnosis.messageFieldProbe.tagsFieldPresent ? "ja" : "nein"} ·
              Link-Felder{" "}
              {diagnosis.messageFieldProbe.linkFieldPresent ? "ja" : "nein"} ·
              Business-Inbox-URL{" "}
              {diagnosis.messageFieldProbe.businessInboxUrlFound
                ? "ja"
                : "nein"}{" "}
              · selected_item_id{" "}
              {diagnosis.messageFieldProbe.selectedItemIdFound ? "ja" : "nein"}{" "}
              · Fallback aktiv{" "}
              {diagnosis.messageFieldProbe.usedFallback ? "ja" : "nein"}
              {diagnosis.messageFieldProbe.observedKeys.length > 0
                ? ` · Keys: ${diagnosis.messageFieldProbe.observedKeys.join(", ")}`
                : ""}
            </span>
          ) : null}
          <p className={styles.muted}>{diagnosis.note}</p>
        </div>
      ) : null}
      {demoConnectionsDisabled ? (
        <div className={styles.replyTargetStatus}>
          <span>
            Demo-Modus öffentlich: Facebook-Postfach öffnen, Chat-Link speichern
            und externe Direktlinks sind deaktiviert. Nutze einen eigenen
            Workspace, um echte Verbindungen sicher zu testen.
          </span>
          <button
            className={dashboardStyles.secondaryButton}
            type="button"
            disabled
          >
            Facebook-Postfach öffnen blockiert
          </button>
        </div>
      ) : !hasDirectLink && directAction.href ? (
        <div className={styles.replyTargetStatus}>
          <span>
            Solange keine Direktlink-ID erkannt wurde, öffnet FanMind das
            Facebook-Postfach.
          </span>
          <a
            className={dashboardStyles.secondaryButton}
            href={directAction.href}
            rel="noreferrer"
            target="_blank"
          >
            Facebook-Postfach öffnen
          </a>
        </div>
      ) : null}
      {hasDirectLink ? (
        <div className={styles.replyTargetStatus}>
          <span>
            {hasAutoDirectLink
              ? "Automatisch erkannter Direktlink"
              : "Gespeicherter Direktlink"}
          </span>
          {directAction.href ? (
            <a
              className={dashboardStyles.secondaryButton}
              href={directAction.href}
              rel="noreferrer"
              target="_blank"
            >
              Link testen
            </a>
          ) : null}
        </div>
      ) : null}
      {!storageUnavailable && !demoConnectionsDisabled ? (
        <form action={saveFacebookReplyTarget} className={styles.inlineForm}>
          <p className={styles.muted}>
            Admin-Notfall-Fallback: manuellen Direktlink nur verwenden, wenn die
            automatische Erkennung vorübergehend keinen Direktchat liefert.
          </p>
          <input name="contact_id" type="hidden" value={contact.id} />
          <label>
            <span>{target ? "Link ändern" : "Facebook-Chat-URL"}</span>
            <input
              defaultValue={target?.url ?? ""}
              name="reply_target_url"
              placeholder="https://business.facebook.com/.../inbox/t/..."
              type="url"
              required
            />
          </label>
          <button className={dashboardStyles.secondaryButton} type="submit">
            {target ? "Ändern" : "Chat-Link speichern"}
          </button>
        </form>
      ) : null}
    </details>
  );
}

function hasMessagesAfterReport(
  messages: ConversationMessageRow[],
  report: FanAnalysisReportRow | null,
): boolean {
  if (!report?.generated_at) return false;
  const generatedAt = new Date(report.generated_at).getTime();
  return messages.some((message) => {
    if (!message.created_at) return false;
    return new Date(message.created_at).getTime() > generatedAt;
  });
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className={dashboardStyles.emptyState}>
      <strong>{title}</strong>
      {body ? <p>{body}</p> : null}
    </div>
  );
}

function FanNotFound() {
  return (
    <section className={dashboardStyles.moduleCard}>
      <div className={dashboardStyles.moduleHeader}>
        <div>
          <p className={dashboardStyles.eyebrow}>Kontakt</p>
          <h2>Fan nicht gefunden</h2>
        </div>
        <span>Empty State</span>
      </div>
      <EmptyState
        title="Fan nicht gefunden"
        body="Für diese ID wurde im aktuellen Workspace kein Kontakt gefunden."
      />
    </section>
  );
}

function hasFacebookMessages(messages: ConversationMessageRow[]): boolean {
  return messages.some((message) => isMessageInChannel(message, "facebook"));
}

function getManualFacebookReplyTargetUrl(
  _message: ConversationMessageRow,
  target: ContactReplyTargetRow | null,
): string | null {
  if (!target) return null;
  if (target.source_platform !== "facebook") return null;
  if (target.source_type !== "facebook_messages") return null;
  if (
    target.quality !== "manual_exact_thread" &&
    target.quality !== "auto_selected_item"
  ) {
    return null;
  }
  return target.url;
}

function getStoredFacebookReplyTargetQuality(
  target: ContactReplyTargetRow | null,
): string | null {
  if (!target) return null;
  if (target.source_platform !== "facebook") return null;
  if (target.source_type !== "facebook_messages") return null;
  return target.quality;
}

function formatSelectedItemSource(
  value:
    | ReplyTargetAction["selectedItemSource"]
    | FacebookDirectLinkSourceDiagnosis["directLinkIdSource"]
    | undefined,
): string {
  if (value === "manual") return "manual";
  if (value === "reply_target_url") return "reply_target_url";
  if (value === "source_url") return "source_url";
  if (value === "message_field") return "message_field";
  if (value === "share") return "share";
  if (value === "attachment") return "attachment";
  if (value === "conversation.link") return "conversation.link";
  if (value === "stored_auto") return "stored_auto";
  return "unbekannt";
}

function buildMessageTimeline(
  messages: ConversationMessageRow[],
  contact: ContactRow,
  facebookReplyTarget: ContactReplyTargetRow | null,
  workspaceName: string,
  locale: FanMindLanguage,
) {
  return messages.map((message) => ({
    id: message.id,
    createdAt: message.created_at,
    avatar:
      message.direction === "inbound"
        ? (contact.display_name || contact.handle || "K")
            .trim()
            .charAt(0)
            .toUpperCase()
        : message.direction === "note"
          ? "N"
          : (workspaceName || "T").trim().charAt(0).toUpperCase(),
    directionKind: message.direction,
    direction: formatTimelineDirection(message, contact, workspaceName, locale),
    type:
      message.direction === "note" && message.author_label === "Antwortentwurf"
        ? "Antwortentwurf · nicht gesendet"
        : formatMessageType(message.message_type),
    channel: formatDetailedSource(
      message.source_platform,
      message.source_type ?? message.message_type,
    ),
    sourcePlatform: message.source_platform,
    time: formatDate(message.created_at),
    text: message.original_text_excerpt || message.content,
    attachments: message.attachments ?? [],
    sourceContext: getMessageSourceContext(message),
    replyAction: buildReplyTargetAction(message, null, {
      fallbackContactLabel: contact.display_name,
      fallbackContactId: contact.handle,
      storedReplyTargetUrl: getManualFacebookReplyTargetUrl(
        message,
        facebookReplyTarget,
      ),
      storedReplyTargetQuality:
        getStoredFacebookReplyTargetQuality(facebookReplyTarget),
    }),
  }));
}

function AttachmentPreview({
  attachments,
}: {
  attachments: ConversationMessageRow["attachments"];
}) {
  if (!attachments?.length) return null;

  return (
    <div className={styles.attachmentList}>
      {attachments.map((attachment, index) => {
        const label = getAttachmentLabel(attachment.type);
        const title = attachment.title || attachment.name || label;

        return (
          <div
            className={styles.attachmentCard}
            key={`${attachment.type}-${index}`}
          >
            {attachment.type === "image" && attachment.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={title} src={attachment.url} />
            ) : (
              <span className={styles.attachmentIcon}>
                {getAttachmentIcon(attachment.type)}
              </span>
            )}
            <div>
              <strong>{title}</strong>
              <small>
                {label}
                {attachment.mime_type ? ` · ${attachment.mime_type}` : ""}
                {typeof attachment.size === "number"
                  ? ` · ${attachment.size} Bytes`
                  : ""}
              </small>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getLatestInboundMessage(messages: ConversationMessageRow[]): string {
  return (
    [...messages].reverse().find((message) => message.direction === "inbound")
      ?.content ?? ""
  );
}

function getOriginalChannelButtonLabel(
  action: ReplyTargetAction,
  messages: ConversationMessageRow[],
  contact: ContactRow,
): string {
  const latestInbound = [...messages]
    .reverse()
    .find((message) => message.direction === "inbound");
  const platform = normalizeSourceValue(
    latestInbound?.source_platform ??
      contact.source_platform ??
      action.platform,
  );
  const sourceType = normalizeSourceValue(
    latestInbound?.source_type ?? latestInbound?.message_type,
  );
  const isComment = sourceType.includes("comment");

  if (platform === "facebook") {
    return isComment
      ? "Zum Facebook-Kommentar wechseln"
      : "Zu Facebook wechseln";
  }
  if (platform === "instagram") {
    return isComment
      ? "Zum Instagram-Kommentar wechseln"
      : "Zu Instagram wechseln";
  }
  if (platform === "linkedin") {
    return isComment
      ? "Zum LinkedIn-Kommentar wechseln"
      : "Zu LinkedIn wechseln";
  }
  if (platform === "whatsapp") return "Zu WhatsApp wechseln";
  if (platform === "email" || platform.includes("mail"))
    return "Zur E-Mail wechseln";
  return action.href ? action.label : "Zum Originalkanal wechseln";
}

function getOriginalChannelAction(
  conversation: ConversationRow | null,
  messages: ConversationMessageRow[],
  contact: ContactRow,
  facebookReplyTarget: ContactReplyTargetRow | null,
): ReplyTargetAction {
  const latestInbound = [...messages]
    .reverse()
    .find((message) => message.direction === "inbound");
  return buildReplyTargetAction(latestInbound ?? conversation, conversation, {
    fallbackContactLabel: contact.display_name,
    fallbackContactId: contact.handle,
    storedReplyTargetUrl: facebookReplyTarget?.url ?? null,
    storedReplyTargetQuality:
      getStoredFacebookReplyTargetQuality(facebookReplyTarget),
  });
}

function getAttachmentLabel(type: string): string {
  return (
    {
      image: "Bild empfangen",
      video: "Video empfangen",
      audio: "Audio empfangen",
      file: "Datei empfangen",
      unknown: "Anhang empfangen",
    }[type] ?? "Anhang empfangen"
  );
}

function getAttachmentIcon(type: string): string {
  return (
    { image: "🖼️", video: "🎬", audio: "🎧", file: "📎", unknown: "📎" }[
      type
    ] ?? "📎"
  );
}

function formatDetailedSource(
  platform: string | null,
  sourceType: string | null,
): string {
  const preparedLabel = getChannelSourceLabel(sourceType, "");
  if (preparedLabel) return preparedLabel;
  const source = (sourceType ?? "").toLowerCase();
  const base = formatSource(platform);
  if (source.includes("comment")) return `${base} Kommentare`;
  if (source.includes("dm") || source.includes("message"))
    return `${base} Nachrichten`;
  return base;
}

function formatTimelineDirection(
  message: ConversationMessageRow,
  contact: ContactRow,
  workspaceName: string,
  locale: FanMindLanguage,
): string {
  const author = message.author_label?.trim();
  const genericAuthors = new Set([
    "Fan",
    "FanMind Team",
    "Team",
    "Demo",
    "Demo User",
    "Demo Nutzer",
  ]);

  if (message.direction === "note") {
    if (author && author !== "Antwortentwurf" && !genericAuthors.has(author)) {
      return author;
    }
    return locale === "en" ? "Note" : "Notiz";
  }

  if (message.direction === "inbound") {
    if (author && !genericAuthors.has(author)) return author;
    return (
      contact.display_name ||
      contact.handle ||
      (locale === "en" ? "Contact" : "Kontakt")
    );
  }

  if (author && !genericAuthors.has(author)) return author;
  return workspaceName || (locale === "en" ? "Workspace team" : "Workspace-Team");
}

function formatMessageType(value: string | null): string {
  const labels: Record<string, string> = {
    dm: "DM",
    comment: "Kommentar",
    post: "Post",
    email: "E-Mail",
    form: "Formular",
    note: "Notiz",
    manual: "Manuell",
  };
  return getChannelSourceLabel(value, labels[value ?? ""] ?? "DM");
}

function formatSource(value: string | null): string {
  return getChannelSourceLabel(value, formatPlatformLabel(value));
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Kein Datum hinterlegt";
  }

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function normalizeParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function formatNotice(value: string, locale: FanMindLanguage = "de"): string {
  if (value === "draft_saved")
    return "Entwurf gespeichert – noch nicht gesendet.";
  if (value === "done")
    return "Konversation als erledigt markiert. Es wurde nichts extern gesendet.";
  if (value === "waiting")
    return "Konversation wartet auf Antwort im Originalkanal.";
  if (value === "open") return "Konversation wieder geöffnet.";
  if (value === "priority_saved") return "Priorität gespeichert.";
  if (value === "top_fan_marked") return "Kontakt wurde als Top Fan markiert.";
  if (value === "top_fan_removed") return "Top-Fan-Markierung wurde entfernt.";
  if (value === "top_fan_save_failed") return "Top-Fan-Markierung konnte nicht gespeichert werden.";
  if (value === "top_fan_forbidden") return "Kontakt wurde im aktuellen Workspace nicht gefunden.";
  if (value === "notes_saved")
    return locale === "en"
      ? "Saved: Notes were updated."
      : "Gespeichert: Notizen wurden aktualisiert.";
  if (value === "notes_empty")
    return locale === "en"
      ? "Empty note was not saved."
      : "Leere Notiz wurde nicht gespeichert.";
  if (value === "notes_save_failed")
    return locale === "en"
      ? "Notes could not be saved. Please try again."
      : "Notizen konnten nicht gespeichert werden. Bitte erneut versuchen.";
  if (value === "analysis_saved")
    return "Kommunikationsübersicht wurde aktualisiert.";
  if (value === "followup_completed")
    return locale === "en"
      ? "Follow-up was marked as completed."
      : "Follow-up wurde als erledigt markiert.";
  if (value === "followup_reopened")
    return locale === "en"
      ? "Follow-up was reopened."
      : "Follow-up wurde wieder geöffnet.";
  if (value === "followup_status_failed")
    return locale === "en"
      ? "Follow-up could not be changed. It may have already been deleted or belongs to another workspace."
      : "Follow-up konnte nicht geändert werden. Es wurde möglicherweise bereits gelöscht oder gehört zu einem anderen Workspace.";
  if (value === "followup_status_invalid")
    return locale === "en"
      ? "Follow-up could not be identified."
      : "Follow-up konnte nicht eindeutig erkannt werden.";
  if (value === "followup_deleted")
    return locale === "en"
      ? "Follow-up was deleted."
      : "Follow-up wurde gelöscht.";
  if (value === "followup_delete_failed")
    return locale === "en"
      ? "Follow-up could not be deleted. Please try again."
      : "Follow-up konnte nicht gelöscht werden. Bitte erneut versuchen.";
  if (value === "followup_delete_invalid")
    return locale === "en"
      ? "Follow-up could not be identified."
      : "Follow-up konnte nicht eindeutig erkannt werden.";
  if (value === "reply_target_saved")
    return "Direkter Facebook-Chat-Link wurde gespeichert.";
  if (value === "reply_target_save_failed")
    return "Der Chat-Link konnte gerade nicht gespeichert werden. Bitte später erneut versuchen.";
  if (value === "reply_target_storage_unavailable")
    return "Direktlink-Speicherung ist derzeit nicht verfügbar. Das Facebook-Postfach kann weiterhin geöffnet werden.";
  if (value === "demo_external_actions_disabled")
    return "Dieser Demo-Workspace ist öffentlich. Echte externe Kanalaktionen sind deaktiviert. KI-Vorschläge können weiterhin kopiert werden.";
  if (value === "reply_target_invalid")
    return "Bitte speichere nur einen HTTPS-Link zum direkten Chat dieses Fans, keinen generischen Postfach-Link.";
  if (value === "contacts_merged") return "Fans wurden zusammengeführt.";
  if (value === "contacts_merge_failed")
    return "Fans konnten nicht zusammengeführt werden. Bitte Ziel-Fan prüfen und erneut versuchen.";
  return value;
}

function getUserDisplayName(
  metadata: Record<string, unknown> | undefined,
  fallback: string,
): string {
  const displayName = metadata?.display_name ?? metadata?.full_name;

  return typeof displayName === "string" && displayName.trim()
    ? displayName.trim()
    : fallback;
}

export default async function FanDetailPage({
  params,
  searchParams,
}: FanDetailPageProps) {
  const { id } = await params;
  const pageSearchParams = await searchParams;
  const activeChannel = normalizeConversationChannel(
    normalizeParam(pageSearchParams?.channel),
  );
  const activeSource = normalizeParam(pageSearchParams?.source) || "all";
  let authorized;
  try {
    authorized = await requireAuthorizedWorkspaceMember();
  } catch (error) {
    if (error instanceof Error && error.message === "TEMPORARY_DEMO_DELETED") {
      redirect("/login?demo_deleted=1");
    }
    redirect("/login");
  }

  const { user, workspace } = authorized;
  const preActivationRedirect = getPreActivationRedirect(workspace, user.email);
  if (preActivationRedirect) redirect(preActivationRedirect);
  const locale = await resolveWorkspaceLocale({
    lang: pageSearchParams?.lang,
    user,
  });
  const workspaceOwner = workspace.role.trim().toLowerCase() === "owner";

  const [contactsResult, contactResult, socialConnectionsResult] =
    await Promise.all([
      getWorkspaceContacts(workspace.id),
      getWorkspaceContact(workspace.id, id),
      workspaceOwner
        ? getWorkspaceSocialConnections(workspace.id)
        : Promise.resolve({ connections: [], error: null }),
    ]);

  const contact = contactResult?.contact ?? null;
  if (!contact || contact.status?.trim().toLowerCase() === "archived") {
    notFound();
  }
  const relatedContactIds =
    contact && contactsResult
      ? getRelatedFanContactIds(contact, contactsResult.contacts).filter(
          (contactId) => contactId !== contact.id,
        )
      : [];

  if (workspaceOwner && contact) {
    await Promise.all(
      [contact.id, ...relatedContactIds].map((contactId) =>
        markContactInboundMessagesSeen({
          workspaceId: workspace.id,
          contactId,
        }),
      ),
    );
  }

  const facebookConnection =
    socialConnectionsResult?.connections.find(
      (connection) =>
        connection.platform === "facebook" && connection.status === "connected",
    ) ?? null;
  const instagramConnection =
    socialConnectionsResult?.connections.find(
      (connection) =>
        connection.platform === "instagram" &&
        connection.status === "connected",
    ) ?? null;

  const [
    memoriesResult,
    followupsResult,
    initialMessagesResult,
    conversationsResult,
    openFollowupCountResult,
    workspaceOpenFollowupsResult,
    fanAnalysisReportResult,
    fanAnalysisCapabilityResult,
    facebookReplyTargetResult,
  ] = workspace
    ? await Promise.all([
        contact
          ? getContactMemories(workspace.id, contact.id)
          : Promise.resolve(null),
        contact
          ? getContactFollowups(workspace.id, contact.id)
          : Promise.resolve(null),
        contact
          ? getContactConversationMessages(workspace.id, contact.id)
          : Promise.resolve(null),
        getWorkspaceConversations(workspace.id),
        getOpenFollowupCount(workspace.id),
        getWorkspaceOpenFollowups(workspace.id),
        contact
          ? getFanAnalysisReport(workspace.id, contact.id)
          : Promise.resolve(null),
        contact && workspaceOwner
          ? getWorkspaceAnalysisCapabilityStatus(workspace.id, "fan_analysis")
          : Promise.resolve(null),
        contact && workspaceOwner
          ? getContactReplyTarget(workspace.id, contact.id, "facebook_messages")
          : Promise.resolve(null),
      ])
    : [null, null, null, null, null, null, null, null, null];

  let messagesResult = initialMessagesResult;

  let additionalMessagesError: string | undefined;

  if (
    workspace &&
    contact &&
    messagesResult &&
    messagesResult.messages.length === 0 &&
    relatedContactIds.length
  ) {
    const relatedMessageResults = await Promise.all(
      relatedContactIds.map((contactId) =>
        getContactConversationMessages(workspace.id, contactId),
      ),
    );

    const mergedMessages = relatedMessageResults.flatMap(
      (result) => result.messages,
    );
    if (mergedMessages.length) {
      messagesResult = {
        messages: mergeUniqueMessagesById([
          ...messagesResult.messages,
          ...mergedMessages,
        ]),
        error: messagesResult.error,
      };
    }

    const firstError = relatedMessageResults.find(
      (result) => result.error,
    )?.error;
    if (firstError) additionalMessagesError = firstError.message;
  }

  const conversation =
    conversationsResult?.conversations.find((item) => item.contact_id === id) ??
    (relatedContactIds.length
      ? conversationsResult?.conversations.find((item) =>
          relatedContactIds.includes(item.contact_id),
        )
      : null) ??
    null;
  let facebookDirectLinkDiagnosis: FacebookDirectLinkSourceDiagnosis | null =
    null;
  if (
    !areDemoConnectionsDisabled(user, workspace) &&
    workspaceOwner &&
    contact &&
    facebookConnection
  ) {
    try {
      await requireContactInActiveAuthorizedWorkspace(contact.id);
      facebookDirectLinkDiagnosis = await diagnoseFacebookDirectLinkSource({
        connection: facebookConnection,
        contactHandle: contact.handle,
        limit: 5,
      });
    } catch {
      facebookDirectLinkDiagnosis = null;
    }
  }

  return (
    <main className={dashboardStyles.page}>
      <FanDetailWorkspace
        workspace={workspace}
        userDisplayName={getUserDisplayName(user.user_metadata, workspace.name)}
        contact={contact}
        contactCount={
          getWorkspaceKpiStatsFromContacts(contactsResult?.contacts ?? [])
            .totalFans
        }
        contactError={contactResult?.error?.message}
        followups={followupsResult?.followups ?? []}
        messages={messagesResult?.messages ?? []}
        messagesError={
          messagesResult?.error?.message ?? additionalMessagesError
        }
        conversation={conversation}
        conversationsError={conversationsResult?.error?.message}
        memories={memoriesResult?.memories ?? []}
        memoriesError={memoriesResult?.error?.message}
        openFollowupCount={openFollowupCountResult?.count ?? 0}
        dueFollowupCount={countDueOrOverdueOpenFollowups(
          workspaceOpenFollowupsResult?.followups ?? [],
        )}
        notice={normalizeParam(pageSearchParams?.notice)}
        fanAnalysisReport={fanAnalysisReportResult?.report ?? null}
        fanAnalysisReportError={fanAnalysisReportResult?.error?.message}
        fanAnalysisGenerationEnabled={
          fanAnalysisCapabilityResult?.enabled ?? false
        }
        fanAnalysisGenerationError={fanAnalysisCapabilityResult?.error?.message}
        activeChannel={activeChannel}
        activeSource={activeSource}
        facebookMessengerLastSyncedAt={
          facebookConnection?.last_messenger_sync_at ?? null
        }
        instagramMessengerLastSyncedAt={
          instagramConnection?.last_messenger_sync_at ?? null
        }
        facebookReplyTarget={facebookReplyTargetResult?.target ?? null}
        facebookReplyTargetError={facebookReplyTargetResult?.error?.message}
        facebookDirectLinkDiagnosis={facebookDirectLinkDiagnosis}
        allContacts={contactsResult?.contacts ?? []}
        demoConnectionsDisabled={areDemoConnectionsDisabled(user, workspace)}
        locale={locale}
        userEmail={user.email}
      />
    </main>
  );
}

function getRelatedFanContactIds(
  contact: ContactRow,
  contacts: ContactRow[],
): string[] {
  const baseKey = getFanGroupKey(contact);
  return contacts
    .filter((entry) => getFanGroupKey(entry) === baseKey)
    .map((entry) => entry.id);
}

function mergeUniqueMessagesById(
  messages: ConversationMessageRow[],
): ConversationMessageRow[] {
  const byId = new Map<string, ConversationMessageRow>();
  for (const message of messages) {
    byId.set(message.id, message);
  }

  return Array.from(byId.values()).sort(
    (left, right) =>
      new Date(left.created_at ?? 0).getTime() -
      new Date(right.created_at ?? 0).getTime(),
  );
}
