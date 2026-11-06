import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getWorkspaceConversations,
  getWorkspaceContacts,
  getWorkspaceOpenFollowups,
  signOutSupabaseServerSession,
  type ContactRow,
  type ConversationRow,
  type FollowupRow,
  type WorkspaceDashboardRow,
} from "@/lib/supabase/server";
import { getFanGroupKey } from "@/lib/fanIdentity";
import { PlatformLogo } from "@/components/PlatformLogo";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import {
  getWorkspaceNavigationForUser,
  localizedWorkspaceHref,
} from "@/lib/workspaceNavigation";
import { getWorkspaceKpiStatsFromContacts } from "@/lib/workspaceKpiStats";
import dashboardStyles from "../dashboard/dashboard.module.css";
import {
  ORIGINAL_LINK_FALLBACK,
  getChannelSourceActionLabel,
  getChannelSourceConfig,
  getChannelSourceInteractionType,
  getChannelSourceLabel,
  normalizeHttpUrl,
} from "@/lib/channelSources";
import styles from "./inbox.module.css";
import { InboxSearchForm } from "./InboxSearchForm";
import { buildUnifiedInboxQueue } from "@/lib/inboxQueuePolicy.mjs";
import { claimConversation, releaseConversation } from "./actions";
import type { FanMindLanguage } from "@/lib/fanmindCopy";
import { resolveWorkspaceLocale } from "@/lib/workspaceLocale";
import { wt } from "@/lib/workspaceCopy";
import {
  formatInboxAverageResponseTime,
  formatInboxWaitingTime,
} from "@/lib/inboxMetricFormatting.mjs";
import {
  requireAuthorizedWorkspaceMember,
  WorkspaceAuthorizationError,
} from "@/lib/workspaceAuthorization";
import { getPreActivationRedirect } from "@/lib/preActivation";

type InboxPageProps = {
  searchParams?: Promise<{
    filter?: string | string[];
    q?: string | string[];
    notice?: string | string[];
    lang?: string | string[];
  }>;
};

type InboxWorkspaceProps = {
  workspace: WorkspaceDashboardRow;
  userDisplayName: string;
  contacts: ContactRow[];
  contactsError?: string;
  followups: FollowupRow[];
  followupsError?: string;
  conversations: ConversationRow[];
  conversationsError?: string;
  activeFilter: InboxFilter;
  searchQuery: string;
  userEmail: string | null | undefined;
  userId: string;
  notice: string;
  locale: FanMindLanguage;
};

type InboxFilter = "all" | "open" | "waiting" | "due" | "high" | "ai" | "done";

const inboxTranslations: Record<string, string> = {
  Nutzer: "User",
  Aktiv: "Active",
  "Priorisierte Arbeitsliste für eingehende Nachrichten, Follow-ups und KI-vorbereitete Antworten.":
    "Prioritized work queue for incoming messages, follow-ups, and AI-prepared replies.",
  "Suche nach Fan, Kanal, Nachricht, Segment …": "Search fan, channel, message, segment …",
  "Manuelle Arbeitsliste": "Manual work queue",
  "Workspace-Daten und verbundene Messenger-Eingänge": "Workspace data and connected messenger inboxes",
  "Die Queue nutzt echte gespeicherte Conversations und ergänzt offene Follow-ups, die noch durch keine Conversation desselben Fans abgedeckt sind.":
    "The queue uses stored conversations and adds open follow-ups that are not yet covered by a conversation for the same fan.",
  "Inbox Suche": "Inbox search",
  "Inbox Kennzahlen": "Inbox metrics",
  "Offene Konversationen": "Open conversations",
  "Kontakte konnten nicht geladen werden.": "Contacts could not be loaded.",
  "Follow-ups konnten nicht geladen werden.": "Follow-ups could not be loaded.",
  "Conversations konnten nicht geladen werden.": "Conversations could not be loaded.",
  "Inbox Filter": "Inbox filters",
  "Inbox Regeln": "Inbox rules",
  "Queue-Regeln": "Queue rules",
  "VIP zuerst": "VIP first",
  "Käufer priorisieren": "Prioritize buyers",
  "Negative Stimmung markieren": "Flag negative sentiment",
  "Antworten nie automatisch senden": "Never send replies automatically",
  Hinweis: "Note",
  "FanMind zentralisiert Eingänge. Antworten werden manuell geprüft und erst nach Freigabe gesendet.":
    "FanMind centralizes incoming messages. Replies are reviewed manually and sent only after approval.",
  "Lokale Conversation Queue": "Local conversation queue",
  Kanal: "Channel",
  "Letzte Nachricht": "Latest message",
  Typ: "Type",
  Priorität: "Priority",
  "Wartet seit": "Waiting since",
  "KI-Status": "AI status",
  "Nächster Schritt": "Next step",
  "Workspace-Daten": "Workspace data",
  "Für diesen Kontakt ist noch kein Original-Chat-Link gespeichert.":
    "No original chat link is stored for this contact yet.",
  "Original-Link noch nicht verfügbar": "Original link not available yet",
  "Spätere Echt-Events können hier den Kommentar- oder Chat-Link liefern.":
    "Future real events can provide the comment or chat link here.",
  Übernehmen: "Claim",
  Freigeben: "Release",
  "Antwort vorbereiten": "Prepare reply",
  "Follow-up planen": "Plan follow-up",
  "Keine passenden Nachrichten gefunden.": "No matching messages found.",
  "Keine Queue-Einträge für diesen Filter.": "No queue entries for this filter.",
  "Passe den Suchbegriff an oder lösche die Suche, um alle passenden Inbox-Einträge zu sehen.":
    "Change the search term or clear the search to see all matching inbox entries.",
  "Lege Fans oder offene Follow-ups an, um die manuelle Arbeitsliste zu füllen. Verbundene Messenger-Eingänge erscheinen hier, ohne dass Antworten automatisch gesendet werden.":
    "Add fans or open follow-ups to fill the manual work queue. Connected messenger messages appear here without sending replies automatically.",
  Alle: "All",
  Offen: "Open",
  Wartet: "Waiting",
  "Antwort fällig": "Reply due",
  "Hohe Priorität": "High priority",
  "Mit KI vorbereitet": "AI prepared",
  Erledigt: "Done",
  Archiviert: "Archived",
  Hoch: "High",
  Mittel: "Medium",
  Niedrig: "Low",
  Teilweise: "Partial",
  "Nicht bereit": "Not ready",
  "KI-ready": "AI ready",
  Käufer: "Buyer",
  Kommentar: "Comment",
  "Post-Kommentar": "Post comment",
  Formular: "Form",
  Notiz: "Note",
  Manuell: "Manual",
  Webformular: "Web form",
  "Kommentar öffnen": "Open comment",
  "Beitrag öffnen": "Open post",
  "Chat öffnen": "Open chat",
  "Original öffnen": "Open original",
  "Unbenannter Fan": "Unnamed fan",
  "Kein Handle hinterlegt": "No handle stored",
  "Conversation ohne gespeicherte Vorschau.": "Conversation without a stored preview.",
  "Noch keine gespeicherte Eingangsnachricht. Kontext manuell einfügen.":
    "No stored incoming message yet. Add context manually.",
  "Vorschlag laden": "Load suggestion",
  "Info bereitstellen": "Provide information",
  "pro Fan dedupliziert": "deduplicated per fan",
  "auf Fan-Antwort": "waiting for fan reply",
  "Antwort fällig heute": "Reply due today",
  "aus Fälligkeitsdatum": "from due date",
  "Status, Tags, Follow-ups": "Status, tags, follow-ups",
  "Kontext + Tags vorhanden": "Context and tags available",
  "Ø Antwortzeit": "Average response time",
  "lokal abgeleitet": "derived locally",
  "Conversation wurde dir zugewiesen.": "Conversation assigned to you.",
  "Conversation wurde für das Team freigegeben.": "Conversation released to the team.",
  "Teamzugang im Nur-Lese-Modus: Zuweisen, Freigeben, Antworten vorbereiten und Follow-ups planen ist nur für den Workspace-Owner möglich.":
    "Read-only team access: assigning, releasing, preparing replies, and planning follow-ups is available only to the workspace owner.",
  "Conversation konnte nicht eindeutig bestimmt werden.": "Conversation could not be identified unambiguously.",
  "Conversation ist in diesem Workspace nicht verfügbar.": "Conversation is not available in this workspace.",
  "Zuweisung wurde nicht geändert. Bitte aktualisiere die Inbox und versuche es erneut.":
    "Assignment was not changed. Refresh the inbox and try again.",
};

function inboxText(locale: FanMindLanguage, text: string): string {
  if (locale !== "en") return text;
  return inboxTranslations[text] ?? wt(locale, text);
}

type InboxQueueItem = {
  key: string;
  dedupeKey: string;
  contactId: string;
  fanName: string;
  handle: string;
  initials: string;
  tags: string[];
  channel: string;
  channelClass: string;
  channelPlatform: string | null;
  messagePreview: string;
  conversationType: string;
  segment: string;
  status: "Offen" | "Wartet" | "Erledigt" | "Archiviert";
  statusValue: string;
  conversationId?: string;
  assignedUserId?: string;
  assignmentSupported?: boolean;
  priority: "Hoch" | "Mittel" | "Warm" | "Normal" | "Niedrig";
  priorityScore: number;
  waitingMinutes: number;
  owner: string;
  aiStatus: "KI-ready" | "Teilweise" | "Nicht bereit";
  nextStep: string;
  replyTargetUrl?: string;
  originalPreview?: string;
  sourceType?: "dm" | "comment" | "post" | "email" | "form" | "manual";
  sourcePlatformLabel?: string;
  unread: boolean;
  dueToday: boolean;
};

const filterChips: { label: string; value: InboxFilter }[] = [
  { label: "Alle", value: "all" },
  { label: "Offen", value: "open" },
  { label: "Wartet", value: "waiting" },
  { label: "Antwort fällig", value: "due" },
  { label: "Hohe Priorität", value: "high" },
  { label: "Mit KI vorbereitet", value: "ai" },
];

async function logout() {
  "use server";

  await signOutSupabaseServerSession();
  redirect("/");
}

function InboxWorkspace({
  workspace,
  userDisplayName,
  contacts,
  contactsError,
  followups,
  followupsError,
  conversations,
  conversationsError,
  activeFilter,
  searchQuery,
  userEmail,
  userId,
  notice,
  locale,
}: InboxWorkspaceProps) {
  const memberReadOnly = workspace.role.trim().toLowerCase() !== "owner";
  const { mainNavigation, settingsNavigation, savedViews } =
    getWorkspaceNavigationForUser(
      "inbox",
      userEmail,
      locale,
      0,
      workspace.role,
    );
  const activeContactIds = new Set(contacts.map((contact) => contact.id));
  const activeFollowups = followups.filter((followup) =>
    activeContactIds.has(followup.contact_id),
  );
  const activeConversations = conversations.filter((conversation) =>
    activeContactIds.has(conversation.contact_id),
  );
  const queueItems = buildUnifiedInboxQueue(
    {
      conversations: buildConversationInboxQueue(activeConversations, contacts),
      followups: buildInboxQueue(contacts, activeFollowups),
    },
    (item) => ({
      dedupeKey: item.dedupeKey,
      priorityScore: item.priorityScore,
      waitingMinutes: item.waitingMinutes,
      stableKey: item.key,
    }),
  );
  const visibleItems = filterQueueItems(queueItems, activeFilter, searchQuery);
  const kpis = getInboxKpis(queueItems, locale);
  const fanListHref = localizedWorkspaceHref("/fans#fans-list", locale);

  return (
    <WorkspaceShell
      workspaceName={workspace.name}
      userLabel={userDisplayName || workspace.name || inboxText(locale, "Nutzer")}
      planLabel={workspace.plan_id}
      planMeta={workspace.role}
      planStatus={inboxText(locale, "Aktiv")}
      mainNavigation={mainNavigation}
      settingsNavigation={settingsNavigation}
      savedViews={savedViews}
      header={{
        title: "Inbox",
        subtitle: inboxText(locale, "Priorisierte Arbeitsliste für eingehende Nachrichten, Follow-ups und KI-vorbereitete Antworten."),
        searchPlaceholder: inboxText(locale, "Suche nach Fan, Kanal, Nachricht, Segment …"),
        primaryActionLabel: inboxText(locale, "Zur Fanliste"),
        primaryActionHref: fanListHref,
      }}
      contactCount={getWorkspaceKpiStatsFromContacts(contacts).totalFans}
      openFollowupCount={activeFollowups.length}
      logoutAction={logout}
      locale={locale}
    >
      <div className={styles.inboxStack}>
        <section className={styles.introBar} aria-label={inboxText(locale, "Inbox Suche")}>
          <div>
            <p className={dashboardStyles.eyebrow}>{inboxText(locale, "Manuelle Arbeitsliste")}</p>
            <h2>{inboxText(locale, "Workspace-Daten und verbundene Messenger-Eingänge")}</h2>
            <p>
              {inboxText(locale, "Die Queue nutzt echte gespeicherte Conversations und ergänzt offene Follow-ups, die noch durch keine Conversation desselben Fans abgedeckt sind.")}
            </p>
          </div>
          <InboxSearchForm
            activeFilter={activeFilter}
            initialQuery={searchQuery}
            locale={locale}
          />
        </section>

        {getNoticeMessage(notice, locale) ? (
          <p className={styles.noticeCard} role="status">
            {getNoticeMessage(notice, locale)}
          </p>
        ) : null}
        {memberReadOnly ? (
          <p className={styles.noticeCard} role="status">
            {inboxText(locale, "Teamzugang im Nur-Lese-Modus: Zuweisen, Freigeben, Antworten vorbereiten und Follow-ups planen ist nur für den Workspace-Owner möglich.")}
          </p>
        ) : null}

        <section className={styles.kpiGrid} aria-label={inboxText(locale, "Inbox Kennzahlen")}>
          {kpis.map((kpi) => (
            <article className={styles.kpiCard} key={kpi.label}>
              <span>{inboxText(locale, kpi.label)}</span>
              <strong>{kpi.value}</strong>
              <small>{inboxText(locale, kpi.meta)}</small>
            </article>
          ))}
        </section>

        <div className={styles.contentGrid}>
          <section className={styles.queueCard} aria-labelledby="queue-title">
            <div className={styles.queueHeader}>
              <div>
                <p className={dashboardStyles.eyebrow}>Conversation Queue</p>
                <h2 id="queue-title">{inboxText(locale, "Offene Konversationen")}</h2>
              </div>
              <Link className={styles.secondaryLink} href={fanListHref}>
                {inboxText(locale, "Zur Fanliste")}
              </Link>
            </div>

            {contactsError ? (
              <ErrorBox
                title={inboxText(locale, "Kontakte konnten nicht geladen werden.")}
                message={contactsError}
              />
            ) : null}
            {followupsError ? (
              <ErrorBox
                title={inboxText(locale, "Follow-ups konnten nicht geladen werden.")}
                message={followupsError}
              />
            ) : null}
            {conversationsError ? (
              <ErrorBox
                title={inboxText(locale, "Conversations konnten nicht geladen werden.")}
                message={conversationsError}
              />
            ) : null}

            <nav className={styles.filterBar} aria-label={inboxText(locale, "Inbox Filter")}>
              {filterChips.map((chip) => (
                <Link
                  className={
                    chip.value === activeFilter
                      ? styles.filterChipActive
                      : styles.filterChip
                  }
                  href={`/inbox?${locale === "en" ? "lang=en&" : ""}filter=${chip.value}${
                    searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ""
                  }`}
                  key={chip.value}
                >
                  {inboxText(locale, chip.label)}
                </Link>
              ))}
            </nav>

            {visibleItems.length ? (
              <QueueList
                items={visibleItems}
                userId={userId}
                locale={locale}
                readOnly={memberReadOnly}
              />
            ) : (
              <EmptyState hasSearch={Boolean(searchQuery)} locale={locale} />
            )}
          </section>

          <aside className={styles.sideRail} aria-label={inboxText(locale, "Inbox Regeln")}>
            <InfoCard
              title={inboxText(locale, "Queue-Regeln")}
              items={[
                inboxText(locale, "VIP zuerst"),
                inboxText(locale, "Käufer priorisieren"),
                inboxText(locale, "Negative Stimmung markieren"),
                inboxText(locale, "Antworten nie automatisch senden"),
              ]}
            />
            <div className={styles.noticeCard}>
              <h3>{inboxText(locale, "Hinweis")}</h3>
              <p>
                {inboxText(locale, "FanMind zentralisiert Eingänge. Antworten werden manuell geprüft und erst nach Freigabe gesendet.")}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </WorkspaceShell>
  );
}

function ErrorBox({ title, message }: { title: string; message: string }) {
  return (
    <p className={dashboardStyles.error}>
      <strong>{title}</strong>
      <span>{message}</span>
    </p>
  );
}

function QueueList({
  items,
  userId,
  locale,
  readOnly,
}: {
  items: InboxQueueItem[];
  userId: string;
  locale: FanMindLanguage;
  readOnly: boolean;
}) {
  return (
    <div
      className={styles.queueTable}
      role="table"
      aria-label={inboxText(locale, "Lokale Conversation Queue")}
    >
      <div className={`${styles.queueRow} ${styles.queueHead}`} role="row">
        <span>Fan</span>
        <span>{inboxText(locale, "Kanal")}</span>
        <span>{inboxText(locale, "Letzte Nachricht")}</span>
        <span>{inboxText(locale, "Typ")}</span>
        <span>Status</span>
        <span>{inboxText(locale, "Priorität")}</span>
        <span>{inboxText(locale, "Wartet seit")}</span>
        <span>Owner</span>
        <span>{inboxText(locale, "KI-Status")}</span>
        <span>{inboxText(locale, "Nächster Schritt")}</span>
        <span>Original</span>
      </div>
      {items.map((item) => (
        <div className={styles.queueRowWrap} key={item.key}>
          <Link
            className={styles.queueRowLink}
            href={localizedWorkspaceHref(`/fans/${item.contactId}`, locale)}
          >
            <span className={styles.fanCell}>
              <span className={styles.avatar}>{item.initials}</span>
              <span>
                <strong>{item.fanName}</strong>
                <small>{item.handle}</small>
                <em>
                  {item.tags.slice(0, 2).join(" · ") || inboxText(locale, "Workspace-Daten")}
                </em>
              </span>
            </span>
            <span>
              <b
                className={`${styles.channelBadge} ${styles[item.channelClass]}`}
              >
                <PlatformLogo platform={item.channelPlatform} size="sm" />
                {item.channel}
              </b>
            </span>
            <span className={styles.messageCell}>
              {item.messagePreview}
              {item.originalPreview ? (
                <small>{item.originalPreview}</small>
              ) : null}
            </span>
            <span>{inboxText(locale, item.conversationType)}</span>
            <span>{inboxText(locale, item.status)}</span>
            <span>
              <b
                className={`${styles.priorityBadge} ${
                  styles[`priority${item.priority}`]
                }`}
              >
                {inboxText(locale, item.priority)}
              </b>
            </span>
            <span>{formatInboxWaitingTime(item.waitingMinutes, locale)}</span>
            <span>{item.owner}</span>
            <span>
              <b className={styles.aiBadge}>{inboxText(locale, item.aiStatus)}</b>
            </span>
            <span className={styles.nextStep}>{inboxText(locale, item.nextStep)}</span>
          </Link>
          <div className={styles.originalCell}>
            {item.replyTargetUrl ? (
              <a
                className={styles.originalLink}
                href={item.replyTargetUrl}
                rel="noreferrer"
                target="_blank"
              >
                {inboxText(locale, getOriginalActionLabel(
                  item.sourceType,
                  item.replyTargetUrl,
                  item.sourcePlatformLabel,
                ))}
              </a>
            ) : (
              <button
                className={styles.originalLinkDisabled}
                title={inboxText(locale, "Für diesen Kontakt ist noch kein Original-Chat-Link gespeichert.")}
                type="button"
                disabled
              >
                {inboxText(locale, ORIGINAL_LINK_FALLBACK)}
              </button>
            )}
            {!item.replyTargetUrl ? (
              <small>
                {inboxText(locale, ORIGINAL_LINK_FALLBACK)}. {inboxText(locale, "Spätere Echt-Events können hier den Kommentar- oder Chat-Link liefern.")}
              </small>
            ) : null}
            <div className={styles.rowActions}>
              {!readOnly && item.conversationId && item.assignmentSupported && !item.assignedUserId ? (
                <form
                  action={claimConversation}
                >
                  <input
                    name="conversation_id"
                    type="hidden"
                    value={item.conversationId}
                  />
                  <input name="lang" type="hidden" value={locale} />
                  <button type="submit">
                    {inboxText(locale, "Übernehmen")}
                  </button>
                </form>
              ) : null}
              {!readOnly && item.conversationId && item.assignmentSupported && item.assignedUserId === userId ? (
                <form action={releaseConversation}>
                  <input
                    name="conversation_id"
                    type="hidden"
                    value={item.conversationId}
                  />
                  <input name="lang" type="hidden" value={locale} />
                  <button type="submit">{inboxText(locale, "Freigeben")}</button>
                </form>
              ) : null}
              {readOnly ? null : (
                <>
                  <Link href={localizedWorkspaceHref(`/fans/${item.contactId}?focus=reply`, locale)}>
                    {inboxText(locale, "Antwort vorbereiten")}
                  </Link>
                  <Link href={localizedWorkspaceHref(`/fans/${item.contactId}?focus=followup`, locale)}>
                    {inboxText(locale, "Follow-up planen")}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ hasSearch, locale }: { hasSearch: boolean; locale: FanMindLanguage }) {
  return (
    <div className={dashboardStyles.emptyState}>
      <strong>
        {hasSearch
          ? inboxText(locale, "Keine passenden Nachrichten gefunden.")
          : inboxText(locale, "Keine Queue-Einträge für diesen Filter.")}
      </strong>
      <p>
        {hasSearch
          ? inboxText(locale, "Passe den Suchbegriff an oder lösche die Suche, um alle passenden Inbox-Einträge zu sehen.")
          : inboxText(locale, "Lege Fans oder offene Follow-ups an, um die manuelle Arbeitsliste zu füllen. Verbundene Messenger-Eingänge erscheinen hier, ohne dass Antworten automatisch gesendet werden.")}
      </p>
    </div>
  );
}

function InfoCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className={styles.rulesCard}>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function buildConversationInboxQueue(
  conversations: ConversationRow[],
  contacts: ContactRow[],
): InboxQueueItem[] {
  const contactsById = new Map(
    contacts.map((contact) => [contact.id, contact]),
  );

  return conversations
    .map<InboxQueueItem | null>((conversation) => {
      const contact = contactsById.get(conversation.contact_id);
      if (!contact) return null;

      const tags = contact.tags ?? [];
      const priority = getConversationPriority(conversation.priority);
      const waitingMinutes = getWaitingMinutes(
        null,
        conversation.last_inbound_at ??
          conversation.updated_at ??
          conversation.created_at,
      );
      const channel = getChannelLabel(
        conversation.source_type ??
          conversation.source_platform ??
          contact.source_platform,
      );
      const replyTargetUrl =
        normalizeHttpUrl(conversation.reply_target_url) ??
        normalizeHttpUrl(conversation.source_url);
      const sourceType = getSourceType(conversation.source_type);
      const originalSourceType = sourceType;

      return {
        key: conversation.id,
        dedupeKey: getFanGroupKey(contact),
        conversationId: conversation.id,
        assignedUserId: conversation.assigned_user_id ?? undefined,
        assignmentSupported: conversation.assignment_supported === true,
        contactId: contact.id,
        fanName: contact.display_name || contact.handle || "Unbenannter Fan",
        handle: contact.handle || "Kein Handle hinterlegt",
        initials: getInitials(contact.display_name || contact.handle),
        tags,
        channel,
        channelClass: getChannelClass(
          conversation.source_platform ?? contact.source_platform,
        ),
        channelPlatform:
          conversation.source_platform ?? contact.source_platform,
        messagePreview:
          conversation.last_message_preview ||
          "Conversation ohne gespeicherte Vorschau.",
        conversationType: formatConversationType(conversation.source_type),
        segment: getSegment(contact),
        status: formatConversationStatus(conversation.status),
        statusValue: conversation.status,
        priority,
        priorityScore: getPriorityScore(priority),
        waitingMinutes,
        owner: conversation.assigned_owner || "Team Inbox",
        aiStatus: formatAiStatus(conversation.ai_status),
        nextStep: conversation.next_step || "Antwort vorbereiten",
        replyTargetUrl,
        originalPreview: conversation.original_text_excerpt ?? undefined,
        sourceType: originalSourceType,
        sourcePlatformLabel: channel,
        unread: Boolean(conversation.last_inbound_at),
        dueToday: false,
      } satisfies InboxQueueItem;
    })
    .filter((item): item is InboxQueueItem => Boolean(item))
    .sort(
      (a, b) =>
        b.priorityScore - a.priorityScore ||
        b.waitingMinutes - a.waitingMinutes,
    );
}

function buildInboxQueue(
  contacts: ContactRow[],
  followups: FollowupRow[],
): InboxQueueItem[] {
  const followupsByContact = new Map<string, FollowupRow[]>();

  for (const followup of followups) {
    if (followup.status && followup.status !== "open") {
      continue;
    }

    followupsByContact.set(followup.contact_id, [
      ...(followupsByContact.get(followup.contact_id) ?? []),
      followup,
    ]);
  }

  const itemsByFan = new Map<string, InboxQueueItem>();

  for (const contact of contacts) {
    const contactFollowups = followupsByContact.get(contact.id) ?? [];
    if (!contactFollowups.length) continue;
    const item = createQueueItem(contact, contactFollowups);
    const existing = itemsByFan.get(item.key);

    if (
      !existing ||
      item.priorityScore > existing.priorityScore ||
      item.waitingMinutes > existing.waitingMinutes
    ) {
      itemsByFan.set(item.key, item);
    }
  }

  return Array.from(itemsByFan.values()).sort(
    (a, b) =>
      b.priorityScore - a.priorityScore || b.waitingMinutes - a.waitingMinutes,
  );
}

function createQueueItem(
  contact: ContactRow,
  followups: FollowupRow[],
): InboxQueueItem {
  const tags = contact.tags ?? [];
  const latestFollowup = followups[0];
  const priority = getPriority(contact, latestFollowup);
  const waitingMinutes = getWaitingMinutes(
    latestFollowup?.due_date,
    contact.updated_at ?? contact.created_at,
  );
  const hasContext = Boolean(
    contact.summary?.trim() || latestFollowup?.reason?.trim(),
  );
  const hasTags = tags.length > 0;
  const replyTargetUrl = getReplyTargetUrl(contact);
  const sourcePlatformLabel = getChannelLabel(contact.source_platform);

  return {
    key: getFanGroupKey(contact),
    dedupeKey: getFanGroupKey(contact),
    contactId: contact.id,
    fanName: contact.display_name || contact.handle || "Unbenannter Fan",
    handle: contact.handle || "Kein Handle hinterlegt",
    initials: getInitials(contact.display_name || contact.handle),
    tags,
    channel: getChannelLabel(contact.source_platform),
    channelClass: getChannelClass(contact.source_platform),
    channelPlatform: contact.source_platform,
    messagePreview:
      latestFollowup?.reason ||
      "Noch keine gespeicherte Eingangsnachricht. Kontext manuell einfügen.",
    conversationType: getConversationType(
      contact.source_platform,
      latestFollowup,
    ),
    segment: getSegment(contact),
    status: "Offen",
    statusValue: "open",
    priority,
    priorityScore: getPriorityScore(priority) + (latestFollowup ? 20 : 0),
    waitingMinutes,
    owner: "Team Inbox",
    aiStatus:
      hasContext && hasTags
        ? "KI-ready"
        : hasContext
          ? "Teilweise"
          : "Nicht bereit",
    nextStep: latestFollowup
      ? "Antwort vorbereiten"
      : hasContext
        ? "Vorschlag laden"
        : "Info bereitstellen",
    replyTargetUrl,
    sourceType: getSourceType(contact.source_platform),
    sourcePlatformLabel,
    unread: Boolean(latestFollowup),
    dueToday: isDueToday(latestFollowup?.due_date),
  };
}

function getConversationPriority(
  value: string | null,
): InboxQueueItem["priority"] {
  if (value === "high") return "Hoch";
  if (value === "medium") return "Mittel";
  if (value === "low") return "Niedrig";
  return "Normal";
}

function formatConversationStatus(value: string): InboxQueueItem["status"] {
  if (value === "waiting") return "Wartet";
  if (value === "done") return "Erledigt";
  if (value === "archived") return "Archiviert";
  return "Offen";
}

function formatAiStatus(value: string | null): InboxQueueItem["aiStatus"] {
  if (value === "ready") return "KI-ready";
  if (value === "partial") return "Teilweise";
  return "Nicht bereit";
}

function formatConversationType(value: string | null): string {
  const labels: Record<string, string> = {
    dm: "DM",
    comment: "Kommentar",
    post_comment: "Post-Kommentar",
    post: "Post",
    email: "E-Mail",
    form: "Formular",
    note: "Notiz",
    manual: "Manuell",
  };
  return getChannelSourceLabel(value, labels[value ?? ""] ?? "DM");
}

function getPriority(
  contact: ContactRow,
  followup?: FollowupRow,
): InboxQueueItem["priority"] {
  const raw = `${followup?.priority ?? ""} ${contact.status ?? ""} ${(
    contact.tags ?? []
  ).join(" ")}`.toLowerCase();

  if (/high|hoch|urgent|vip|kritisch/.test(raw)) return "Hoch";
  if (/buyer|käufer|kaeufer|kunde/.test(raw)) return "Mittel";
  if (/warm|follow/.test(raw)) return "Warm";
  if (/low|niedrig|paused|inactive/.test(raw)) return "Niedrig";

  return "Normal";
}

function getPriorityScore(priority: InboxQueueItem["priority"]): number {
  return { Hoch: 100, Mittel: 75, Warm: 60, Normal: 40, Niedrig: 10 }[priority];
}

function getSegment(contact: ContactRow): string {
  const raw =
    `${contact.status ?? ""} ${(contact.tags ?? []).join(" ")}`.toLowerCase();

  if (raw.includes("vip")) return "VIP";
  if (/buyer|käufer|kaeufer|kunde/.test(raw)) return "Käufer";
  if (/event|show|meet/.test(raw)) return "Event";
  if (raw.includes("warm")) return "Warm";

  return "Fan";
}

function getChannelLabel(value: string | null): string {
  const preparedLabel = getChannelSourceLabel(value, "");
  if (preparedLabel) return preparedLabel;

  const labels: Record<string, string> = {
    facebook: "Facebook",
    messenger: "Messenger",
    facebook_messenger: "Messenger",
    instagram: "Instagram",
    whatsapp: "WhatsApp",
    email: "E-Mail",
    form: "Webformular",
    webform: "Webformular",
    manual: "Manuell",
    tiktok: "TikTok",
    telegram: "Telegram",
    telegram_messages: "Telegram",
  };

  return labels[(value ?? "manual").toLowerCase()] ?? "Manuell";
}

function getReplyTargetUrl(contact: ContactRow): string | undefined {
  const metadata = contact as ContactRow & Record<string, unknown>;

  for (const key of [
    "source_url",
    "reply_target_url",
    "external_thread_url",
    "external_message_url",
    "replyTargetUrl",
  ]) {
    const value = metadata[key];

    const url = normalizeHttpUrl(typeof value === "string" ? value : undefined);
    if (url) return url;
  }

  return undefined;
}

function getSourceType(source: string | null): InboxQueueItem["sourceType"] {
  const value = (source ?? "").toLowerCase();

  const preparedType = getChannelSourceInteractionType(value);
  if (preparedType === "comment") return "comment";
  if (preparedType === "message") return "dm";
  if (value.includes("mail")) return "email";
  if (value.includes("form") || value.includes("web")) return "form";
  if (
    value.includes("post") &&
    (value.includes("comment") || value.includes("kommentar"))
  )
    return "post";
  if (value.includes("comment") || value.includes("kommentar"))
    return "comment";
  if (value.includes("post")) return "post";
  if (value.includes("manual") || !value) return "manual";

  return "dm";
}

function getOriginalActionLabel(
  sourceType?: InboxQueueItem["sourceType"],
  url?: string,
  platform?: string,
): string {
  const prepared = getChannelSourceConfig(platform);
  if (prepared)
    return getChannelSourceActionLabel(prepared.sourceType, Boolean(url));

  const normalized = `${sourceType ?? ""} ${platform ?? ""}`.toLowerCase();

  if (!url) return ORIGINAL_LINK_FALLBACK;
  if (normalized.includes("comment") || normalized.includes("kommentar"))
    return "Kommentar öffnen";
  if (normalized.includes("post")) return "Beitrag öffnen";
  if (
    normalized.includes("dm") ||
    normalized.includes("message") ||
    normalized.includes("messenger")
  )
    return "Chat öffnen";

  return "Original öffnen";
}

function getChannelClass(value: string | null): string {
  const channel = (value ?? "manual").toLowerCase();

  if (channel.includes("instagram")) return "channelInstagram";
  if (channel.includes("facebook") || channel.includes("messenger"))
    return "channelInstagram";
  if (channel.includes("whatsapp")) return "channelWhatsapp";
  if (channel.includes("telegram")) return "channelManual";
  if (channel.includes("tiktok")) return "channelManual";
  if (channel.includes("email")) return "channelEmail";
  if (channel.includes("form")) return "channelForm";

  return "channelManual";
}

function getConversationType(
  source: string | null,
  followup?: FollowupRow,
): string {
  if (!followup) return "Manuell";

  const value = (source ?? "").toLowerCase();

  const preparedLabel = getChannelSourceLabel(value, "");
  if (preparedLabel) return preparedLabel;
  if (value.includes("email")) return "E-Mail";
  if (value.includes("form")) return "Formular";
  if (
    value.includes("post") &&
    (value.includes("comment") || value.includes("kommentar"))
  )
    return "Post-Kommentar";
  if (value.includes("comment") || value.includes("kommentar"))
    return "Kommentar";
  if (
    value.includes("instagram") ||
    value.includes("whatsapp") ||
    value.includes("tiktok") ||
    value.includes("telegram")
  ) {
    return "DM";
  }

  return "Notiz";
}

function getWaitingMinutes(
  dueDate?: string | null,
  fallbackDate?: string | null,
): number {
  const value = dueDate ? `${dueDate}T00:00:00Z` : fallbackDate;

  if (!value) return 0;

  return Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60000),
  );
}

function isDueToday(value?: string | null): boolean {
  if (!value) return false;

  return value <= new Date().toISOString().slice(0, 10);
}

function getInitials(value?: string | null): string {
  const parts = (value ?? "FM")
    .replace(/^@/, "")
    .split(/[\s._-]+/)
    .filter(Boolean);

  return (
    parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "FM"
  );
}

function filterQueueItems(
  items: InboxQueueItem[],
  filter: InboxFilter,
  query: string,
): InboxQueueItem[] {
  const normalizedQuery = query.trim().toLowerCase();

  return items.filter((item) => {
    const matchesFilter =
      (filter === "all" && item.statusValue !== "done") ||
      (filter === "open" && item.statusValue === "open") ||
      (filter === "waiting" && item.statusValue === "waiting") ||
      (filter === "due" && item.dueToday) ||
      (filter === "high" && item.priority === "Hoch") ||
      (filter === "ai" && item.aiStatus === "KI-ready") ||
      (filter === "done" && item.statusValue === "done");

    if (!matchesFilter) return false;
    if (!normalizedQuery) return true;

    return [
      item.fanName,
      item.handle,
      item.channel,
      item.messagePreview,
      item.segment,
      ...item.tags,
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });
}

function getInboxKpis(items: InboxQueueItem[], locale: FanMindLanguage) {
  const responseReady = items.filter(
    (item) => item.aiStatus === "KI-ready",
  ).length;
  const averageMinutes = items.length
    ? Math.round(
        items.reduce((sum, item) => sum + item.waitingMinutes, 0) /
          items.length,
      )
    : 0;

  return [
    {
      label: "Offene Konversationen",
      value: String(items.length),
      meta: "pro Fan dedupliziert",
    },
    {
      label: "Wartet",
      value: String(
        items.filter((item) => item.statusValue === "waiting").length,
      ),
      meta: "auf Fan-Antwort",
    },
    {
      label: "Antwort fällig heute",
      value: String(items.filter((item) => item.dueToday).length),
      meta: "aus Fälligkeitsdatum",
    },
    {
      label: "Hohe Priorität",
      value: String(items.filter((item) => item.priority === "Hoch").length),
      meta: "Status, Tags, Follow-ups",
    },
    {
      label: "Mit KI vorbereitet",
      value: String(responseReady),
      meta: "Kontext + Tags vorhanden",
    },
    {
      label: "Ø Antwortzeit",
      value: formatInboxAverageResponseTime(averageMinutes, locale),
      meta: "lokal abgeleitet",
    },
  ];
}

function stringMetadataValue(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function getUserDisplayName(
  metadata: Record<string, unknown> | undefined,
  workspaceName: string,
): string {
  return (
    stringMetadataValue(metadata, "display_name") ??
    stringMetadataValue(metadata, "name") ??
    stringMetadataValue(metadata, "full_name") ??
    workspaceName ??
    "Nutzer"
  );
}

function normalizeParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function normalizeFilter(value: string): InboxFilter {
  return filterChips.some((chip) => chip.value === value)
    ? (value as InboxFilter)
    : "all";
}

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const params = await searchParams;
  let authorized;
  try {
    authorized = await requireAuthorizedWorkspaceMember();
  } catch (error) {
    if (error instanceof WorkspaceAuthorizationError) {
      if (error.code === "unauthenticated") redirect("/login");
      if (error.code === "workspace_inactive") {
        redirect("/workspace/access-paused");
      }
      if (error.message === "TEMPORARY_DEMO_DELETED") {
        redirect("/login?demo_deleted=1");
      }
      redirect("/onboarding");
    }
    throw error;
  }
  const { user, workspace } = authorized;
  const preActivationRedirect = getPreActivationRedirect(workspace, user.email);
  if (preActivationRedirect) redirect(preActivationRedirect);
  const locale = await resolveWorkspaceLocale({
    lang: params?.lang,
    user,
  });
  const contactsResult = workspace
    ? await getWorkspaceContacts(workspace.id)
    : null;
  const followupsResult = workspace
    ? await getWorkspaceOpenFollowups(workspace.id)
    : null;
  const conversationsResult = workspace
    ? await getWorkspaceConversations(workspace.id)
    : null;

  return (
    <main className={dashboardStyles.page}>
      {workspace ? (
        <InboxWorkspace
          workspace={workspace}
          userDisplayName={getUserDisplayName(
            user.user_metadata,
            workspace.name,
          )}
          contacts={contactsResult?.contacts ?? []}
          contactsError={contactsResult?.error?.message}
          followups={followupsResult?.followups ?? []}
          followupsError={followupsResult?.error?.message}
          conversations={conversationsResult?.conversations ?? []}
          conversationsError={conversationsResult?.error?.message}
          activeFilter={normalizeFilter(normalizeParam(params?.filter))}
          searchQuery={normalizeParam(params?.q)}
          userEmail={user.email}
          userId={user.id}
          notice={normalizeParam(params?.notice)}
          locale={locale}
        />
      ) : null}
    </main>
  );
}

function getNoticeMessage(notice: string, locale: FanMindLanguage): string | null {
  const messages: Record<string, string> = {
    conversation_claimed: "Conversation wurde dir zugewiesen.",
    conversation_released: "Conversation wurde für das Team freigegeben.",
    conversation_missing: "Conversation konnte nicht eindeutig bestimmt werden.",
    conversation_forbidden: "Conversation ist in diesem Workspace nicht verfügbar.",
    assignment_failed:
      "Zuweisung wurde nicht geändert. Bitte aktualisiere die Inbox und versuche es erneut.",
  };

  const message = messages[notice];
  return message ? inboxText(locale, message) : null;
}
