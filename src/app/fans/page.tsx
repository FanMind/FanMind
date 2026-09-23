import Link from "next/link";
import { redirect } from "next/navigation";
import { getPreActivationRedirect } from "@/lib/preActivation";
import {
  getOpenFollowupCount,
  getSupabaseServerUser,
  getWorkspaceContacts,
  getWorkspaceConversationMessages,
  getWorkspaceOpenFollowups,
  getWorkspaceUnseenInboundMessages,
  signOutSupabaseServerSession,
  type ContactRow,
  type FollowupRow,
  type ConversationMessageRow,
  type WorkspaceDashboardRow,
} from "@/lib/supabase/server";
import { getUserAuthorizedWorkspaceDashboard } from "@/lib/workspaceAuthorization";
import { PlatformLogo } from "@/components/PlatformLogo";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { getWorkspaceNavigationForUser } from "@/lib/workspaceNavigation";
import { resolveWorkspaceLocale } from "@/lib/workspaceLocale";
import { wt } from "@/lib/workspaceCopy";
import type { FanMindLanguage } from "@/lib/fanmindCopy";
import { getWorkspaceKpiStatsFromContacts } from "@/lib/workspaceKpiStats";
import { getFanGroupKey } from "@/lib/fanIdentity";
import dashboardStyles from "../dashboard/dashboard.module.css";
import { archiveFan, createFan, mergeFanContacts, updateFan } from "./actions";
import { TopFanToggleForm } from "./TopFanToggleForm";
import {
  PLATFORM_OPTIONS,
  formatPlatformLabel,
  normalizePlatform,
  type PlatformValue,
} from "./import/csv";
import styles from "./fans.module.css";

type FansWorkspaceProps = {
  workspace: WorkspaceDashboardRow;
  userDisplayName: string;
  contacts: ContactRow[];
  contactsError?: string;
  followups: FollowupRow[];
  followupsError?: string;
  openFollowupCount: number;
  unseenMessages: ConversationMessageRow[];
  conversationMessages: ConversationMessageRow[];
  conversationMessagesError?: string;
  unseenMessagesError?: string;
  activeChannel: PlatformValue | "all";
  searchQuery: string;
  notice?: string;
  activePlatformsNotice?: string;
  archivedChannelsNotice?: string;
  noticeError?: string;
  locale: FanMindLanguage;
  userEmail: string | null | undefined;
};

type FansPageProps = {
  searchParams?: Promise<{
    channel?: string | string[];
    notice?: string | string[];
    active?: string | string[];
    archived?: string | string[];
    error?: string | string[];
    lang?: string | string[];
    q?: string | string[];
  }>;
};

type FanGroup = {
  key: string;
  displayName: string;
  primaryContact: ContactRow;
  contacts: ContactRow[];
  handles: string[];
  platforms: PlatformValue[];
  tags: string[];
  latestCreatedAt: string | null;
  nextFollowup: FollowupRow | null;
  hasUnseenMessages: boolean;
  isTopFan: boolean;
};

const statusLabels: Record<string, string> = {
  new: "Neu",
  warm: "Warm",
  vip: "VIP",
  buyer: "Käufer",
  inactive: "Inaktiv",
  do_not_push: "Nicht drängen",
  active: "Aktiv",
  follow_up: "Follow-up",
  paused: "Pausiert",
};

const channelFilters = [
  { value: "all", label: "Alle" },
  ...PLATFORM_OPTIONS.filter((option) => option.value !== "manual"),
] as const;

async function logout() {
  "use server";

  await signOutSupabaseServerSession();
  redirect("/");
}

function FansWorkspace({
  workspace,
  userDisplayName,
  contacts,
  contactsError,
  followups,
  followupsError,
  openFollowupCount,
  unseenMessages,
  conversationMessages,
  conversationMessagesError,
  unseenMessagesError,
  activeChannel,
  searchQuery,
  notice,
  activePlatformsNotice,
  archivedChannelsNotice,
  noticeError,
  locale,
  userEmail,
}: FansWorkspaceProps) {
  const memberReadOnly = workspace.role.trim().toLowerCase() !== "owner";
  const dueFollowupCount = countDueOrOverdueOpenFollowups(followups);
  const { mainNavigation, settingsNavigation, savedViews } =
    getWorkspaceNavigationForUser(
      "fans",
      userEmail,
      locale,
      dueFollowupCount,
      workspace.role,
    );
  const userLabel = userDisplayName || workspace.name || (locale === "en" ? "User" : "Nutzer");
  const fanGroups = groupContactsByFan(
    contacts,
    followups,
    unseenMessages,
    conversationMessages,
  );
  const channelFilteredFanGroups = filterFanGroupsByChannel(fanGroups, activeChannel);
  const visibleFanGroups = filterFanGroupsBySearch(channelFilteredFanGroups, searchQuery);

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
        title: wt(locale, "Fans"),
        subtitle: wt(locale, "Willkommen zurück, Pilot Test 👋"),
        searchPlaceholder: wt(locale, "Suche nach Name, Tag, Kanal, Sprache ..."),
        ...(memberReadOnly
          ? {}
          : {
              primaryActionLabel: wt(locale, "+ Neuer Fan"),
              primaryActionHref: "#new-fan-modal",
            }),
        searchAction: "/fans",
        searchValue: searchQuery,
        hiddenSearchParams: {
          ...(activeChannel !== "all" ? { channel: activeChannel } : {}),
          ...(locale === "en" ? { lang: locale } : {}),
        },
      }}
      contactCount={getWorkspaceKpiStatsFromContacts(contacts).totalFans}
      openFollowupCount={openFollowupCount}
      logoutAction={logout}
      locale={locale}
    >
      <div className={styles.fansStack}>
        <section
          className={`${dashboardStyles.moduleCard} ${styles.fansListCard}`}
          id="fans-list"
          aria-label="Fans-Liste"
        >
          {memberReadOnly ? (
            <p className={styles.successNotice} role="status">
              Teamzugang im Nur-Lese-Modus: Fans, Nachrichten, Kontaktwissen und
              Follow-ups können angesehen, aber nicht verändert werden.
            </p>
          ) : null}
          {notice ? (
            <p
              className={
                isErrorNotice(notice)
                  ? dashboardStyles.error
                  : styles.successNotice
              }
            >
              {formatNotice(
                notice,
                activePlatformsNotice,
                archivedChannelsNotice,
                noticeError,
              )}
            </p>
          ) : null}
          {contactsError ? (
            <p className={dashboardStyles.error}>
              <strong>Kontakte konnten nicht geladen werden.</strong>
              <span>{contactsError}</span>
            </p>
          ) : null}
          {followupsError ? (
            <p className={dashboardStyles.error}>
              <strong>Follow-ups konnten nicht geladen werden.</strong>
              <span>{followupsError}</span>
            </p>
          ) : null}
          {conversationMessagesError ? (
            <p className={dashboardStyles.error}>
              <strong>Nachrichten konnten nicht geladen werden.</strong>
              <span>{conversationMessagesError}</span>
            </p>
          ) : null}
          {unseenMessagesError ? (
            <p className={dashboardStyles.error}>
              <strong>Neue Nachrichten konnten nicht geladen werden.</strong>
              <span>{unseenMessagesError}</span>
            </p>
          ) : null}
          {fanGroups.length ? (
            <>
              <div className={styles.listToolbar}>
                <ChannelFilters activeChannel={activeChannel} searchQuery={searchQuery} locale={locale} />
                {memberReadOnly ? null : (
                  <Link className={styles.importLink} href="/fans/import">
                    {wt(locale, "CSV importieren")}
                  </Link>
                )}
              </div>
              {visibleFanGroups.length ? (
                <FansTable
                  fanGroups={visibleFanGroups}
                  locale={locale}
                  readOnly={memberReadOnly}
                />
              ) : (
                <div className={dashboardStyles.emptyState}>
                  <strong>Keine Fans gefunden.</strong>
                  <p>
                    Passe Suche oder Kanalfilter an, um wieder Fans zu sehen.
                  </p>
                </div>
              )}
            </>
          ) : (
            <FansEmptyState locale={locale} readOnly={memberReadOnly} />
          )}
        </section>

        {memberReadOnly ? null : (
          <section
            className={styles.modalOverlay}
            id="new-fan-modal"
            aria-labelledby="new-fan-title"
            role="dialog"
            aria-modal="true"
          >
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <div>
                <p className={dashboardStyles.eyebrow}>Manuell anlegen</p>
                <h2 id="new-fan-title">+ Neuer Fan</h2>
              </div>
              <a
                className={styles.modalClose}
                href="#fans-list"
                aria-label="Modal schließen"
              >
                ×
              </a>
            </div>
            <form className={styles.formGrid} action={createFan}>
              <div className={styles.fieldWide}>
                <label htmlFor="display_name">Name</label>
                <input
                  id="display_name"
                  name="display_name"
                  required
                  placeholder="z. B. Gerhard Müller"
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="handle">Handle optional</label>
                <input id="handle" name="handle" placeholder="@gerhard" />
              </div>
              <div className={styles.fieldFull}>
                <span className={styles.groupLabel}>Plattformen/Quellen</span>
                <PlatformCheckboxes selectedPlatforms={["manual"]} />
                <p className={styles.fieldHint}>
                  Mindestens ein Kanal ist Pflicht. Mehrere Kanäle erzeugen im
                  MVP je einen Kontakt-Datensatz.
                </p>
              </div>
              <div className={styles.field}>
                <label htmlFor="language">Sprache</label>
                <select id="language" name="language" defaultValue="de">
                  <option value="de">Deutsch</option>
                  <option value="en">Englisch</option>
                  <option value="fr">Französisch</option>
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="status">Status</label>
                <select id="status" name="status" defaultValue="new">
                  <option value="new">Neu</option>
                  <option value="active">Aktiv</option>
                  <option value="warm">Warm</option>
                  <option value="follow_up">Follow-up</option>
                  <option value="paused">Pausiert</option>
                </select>
              </div>
              <div className={styles.fieldFull}>
                <label htmlFor="tags">Tags</label>
                <input
                  id="tags"
                  name="tags"
                  placeholder="Kommagetrennt, z. B. VIP, Newsletter, Berlin"
                />
              </div>
              <div className={styles.fieldFull}>
                <label htmlFor="summary">Summary/Notiz</label>
                <textarea
                  id="summary"
                  name="summary"
                  placeholder="Kurze manuelle Notiz zum Fan."
                />
                <p className={styles.fieldHint}>
                  Wird nur im aktuellen Workspace gespeichert und löst keinen
                  Versand aus.
                </p>
              </div>
              <div className={styles.formActions}>
                <a
                  className={dashboardStyles.secondaryButton}
                  href="#fans-list"
                >
                  Abbrechen
                </a>
                <button type="submit" className={dashboardStyles.primaryButton}>
                  Kontakt speichern
                </button>
              </div>
            </form>
          </div>
          </section>
        )}

        {memberReadOnly
          ? null
          : fanGroups.map((group) => (
              <EditFanModal
                allGroups={fanGroups}
                group={group}
                key={getEditModalKey(group)}
              />
            ))}
      </div>
    </WorkspaceShell>
  );
}

function ChannelFilters({
  activeChannel,
  searchQuery,
  locale,
}: {
  activeChannel: PlatformValue | "all";
  searchQuery: string;
  locale: FanMindLanguage;
}) {
  return (
    <nav className={styles.channelFilters} aria-label="Kanalfilter">
      {channelFilters.map((filter) => {
        const isActive = filter.value === activeChannel;
        const href = getFansListHref(filter.value, searchQuery, locale);

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={`${styles.channelChip} ${isActive ? styles.channelChipActive : ""}`}
            href={href}
            key={filter.value}
          >
            {filter.value === "all" ? null : (
              <PlatformLogo platform={filter.value} size="sm" />
            )}
            {filter.label}
          </Link>
        );
      })}
    </nav>
  );
}

function getFansListHref(
  channel: PlatformValue | "all",
  searchQuery: string,
  locale: FanMindLanguage,
): string {
  const params = new URLSearchParams();

  if (channel !== "all") {
    params.set("channel", channel);
  }
  if (searchQuery.trim()) {
    params.set("q", searchQuery.trim());
  }
  if (locale === "en") {
    params.set("lang", locale);
  }

  const queryString = params.toString();
  return queryString ? `/fans?${queryString}#fans-list` : "/fans#fans-list";
}

function FansTable({
  fanGroups,
  locale,
  readOnly,
}: {
  fanGroups: FanGroup[];
  locale: FanMindLanguage;
  readOnly: boolean;
}) {
  return (
    <div className={styles.crmTableWrap}>
      <table className={styles.crmTable}>
        <thead>
          <tr>
            <th>{wt(locale, "Name")}</th>
            <th>{wt(locale, "Status")}</th>
            <th>Top Fan</th>
            <th>{wt(locale, "Kanäle")}</th>
            <th>{wt(locale, "Tags")}</th>
            <th>{wt(locale, "Angelegt")}</th>
            <th>{wt(locale, "Nächster Follow-up")}</th>
            <th>{wt(locale, "Antwortkanal")}</th>
            <th aria-label="Neue Nachrichten">Neu</th>
          </tr>
        </thead>
        <tbody>
          {fanGroups.map((group) => (
            <tr key={group.key}>
              <td>
                <span className={styles.nameCell}>
                  <Link
                    className={styles.fanDetailLink}
                    href={`/fans/${group.primaryContact.id}`}
                  >
                    {group.displayName}
                  </Link>
                  {group.handles.length ? (
                    <span>{formatLimitedList(group.handles, 2)}</span>
                  ) : (
                    <span>Kein Handle hinterlegt</span>
                  )}
                </span>
              </td>
              <td>
                <span className={styles.statusBadge}>
                  {formatStatus(group.primaryContact.status)}
                </span>
              </td>
              <td>
                <span className={group.isTopFan ? styles.topFanBadge : styles.mutedText}>
                  {group.isTopFan ? "Top Fan" : "—"}
                </span>
                {readOnly ? null : (
                  <TopFanToggleForm
                    compact
                    contactId={group.primaryContact.id}
                    isTopFan={group.primaryContact.is_top_fan}
                    returnTo="/fans#fans-list"
                  />
                )}
              </td>
              <td>{renderPlatformBadges(group.platforms)}</td>
              <td>
                {group.tags.length ? (
                  <span className={styles.compactTagList}>
                    {group.tags.slice(0, 3).map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                    {group.tags.length > 3 ? <span>+ weitere</span> : null}
                  </span>
                ) : (
                  <span className={styles.mutedText}>Keine Tags</span>
                )}
              </td>
              <td>
                {group.latestCreatedAt ? (
                  <span className={styles.dateCell}>
                    {formatDateOnlyFromTimestamp(group.latestCreatedAt)}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td>{renderNextFollowup(group.nextFollowup)}</td>
              <td>
                <span className={styles.replyChannel}>
                  {formatReplyChannel(group.platforms, group.primaryContact.source_platform)}
                </span>
              </td>
              <td className={styles.unseenCell}>
                {group.hasUnseenMessages ? (
                  <span
                    className={styles.unseenDot}
                    title="Neue ungesehene Nachricht"
                    aria-label="Neue ungesehene Nachricht"
                  />
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const maxVisiblePlatformBadges = 5;

function renderPlatformBadges(platforms: PlatformValue[]) {
  const visiblePlatforms = platforms.slice(0, maxVisiblePlatformBadges);
  const hiddenCount = platforms.length - visiblePlatforms.length;

  return (
    <span
      className={styles.platformBadgeList}
      aria-label={platforms.map(formatPlatformLabel).join(", ")}
    >
      {visiblePlatforms.map((platform) => (
        <span
          className={styles.platformBadge}
          key={platform}
          title={formatPlatformLabel(platform)}
        >
          <PlatformLogo platform={platform} size="sm" />
        </span>
      ))}
      {hiddenCount > 0 ? (
        <span
          className={`${styles.platformBadge} ${styles.platformBadgeMore}`}
          title={platforms
            .slice(maxVisiblePlatformBadges)
            .map(formatPlatformLabel)
            .join(", ")}
        >
          + weitere
        </span>
      ) : null}
    </span>
  );
}

function isArchivedContact(contact: ContactRow): boolean {
  return contact.status?.trim().toLowerCase() === "archived";
}

function getEditModalKey(group: FanGroup): string {
  const platformKey = group.platforms.join("-") || "no-platforms";
  const contactKey = group.contacts
    .map(
      (contact) =>
        `${contact.id}:${contact.status ?? ""}:${contact.source_platform ?? ""}`,
    )
    .join("|");

  return `${group.key}:${platformKey}:${contactKey}`;
}

function EditFanModal({
  allGroups,
  group,
}: {
  allGroups: FanGroup[];
  group: FanGroup;
}) {
  const primaryContact = group.primaryContact;
  const mergeTargets = allGroups.filter(
    (candidate) => candidate.key !== group.key,
  );
  const activeContactCount = group.contacts.filter(
    (contact) => !isArchivedContact(contact),
  ).length;

  return (
    <section
      className={styles.modalOverlay}
      id={getEditModalId(group)}
      aria-labelledby={`${getEditModalId(group)}-title`}
      role="dialog"
      aria-modal="true"
    >
      <div className={styles.modalCard}>
        <div className={styles.modalHeader}>
          <div>
            <p className={dashboardStyles.eyebrow}>Fan bearbeiten</p>
            <h2 id={`${getEditModalId(group)}-title`}>{group.displayName}</h2>
          </div>
          <a
            className={styles.modalClose}
            href="#fans-list"
            aria-label="Modal schließen"
          >
            ×
          </a>
        </div>
        <form className={styles.formGrid} action={updateFan}>
          <input
            name="primary_contact_id"
            type="hidden"
            value={primaryContact.id}
          />
          <input name="fan_group_key" type="hidden" value={group.key} />
          <div className={styles.fieldWide}>
            <label htmlFor={`${getEditModalId(group)}-display-name`}>
              Name
            </label>
            <input
              id={`${getEditModalId(group)}-display-name`}
              name="display_name"
              required
              defaultValue={group.displayName}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor={`${getEditModalId(group)}-handle`}>Handle</label>
            <input
              id={`${getEditModalId(group)}-handle`}
              name="handle"
              defaultValue={group.handles[0] ?? ""}
              placeholder="@handle"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor={`${getEditModalId(group)}-language`}>Sprache</label>
            <select
              id={`${getEditModalId(group)}-language`}
              name="language"
              defaultValue={primaryContact.language ?? "de"}
            >
              <option value="de">Deutsch</option>
              <option value="en">Englisch</option>
              <option value="fr">Französisch</option>
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor={`${getEditModalId(group)}-status`}>Status</label>
            <select
              id={`${getEditModalId(group)}-status`}
              name="status"
              defaultValue={primaryContact.status ?? "new"}
            >
              <option value="new">Neu</option>
              <option value="active">Aktiv</option>
              <option value="warm">Warm</option>
              <option value="follow_up">Follow-up</option>
              <option value="paused">Pausiert</option>
              <option value="vip">VIP</option>
              <option value="buyer">Käufer</option>
              <option value="inactive">Inaktiv</option>
              <option value="do_not_push">Nicht drängen</option>
            </select>
          </div>
          <div className={styles.fieldFull}>
            <label htmlFor={`${getEditModalId(group)}-tags`}>Tags</label>
            <input
              id={`${getEditModalId(group)}-tags`}
              name="tags"
              defaultValue={group.tags.join(", ")}
              placeholder="Kommagetrennt"
            />
          </div>
          <div className={styles.fieldFull}>
            <label htmlFor={`${getEditModalId(group)}-summary`}>
              Summary/Notiz
            </label>
            <textarea
              id={`${getEditModalId(group)}-summary`}
              name="summary"
              defaultValue={primaryContact.summary ?? ""}
              placeholder="Kurze manuelle Notiz zum Fan."
            />
          </div>
          <div className={styles.fieldFull}>
            <span className={styles.groupLabel}>Plattformen/Kanäle</span>
            <PlatformCheckboxes selectedPlatforms={group.platforms} />
            <p className={styles.fieldHint}>
              Kanäle sind aktuell als je ein Kontakt-Datensatz pro Fan-Gruppe
              modelliert. Abgewählte Kanäle werden archiviert, damit bestehende
              Nachrichten und Reply-Targets erhalten bleiben.
            </p>
          </div>
          <div className={styles.formActions}>
            <a className={dashboardStyles.secondaryButton} href="#fans-list">
              Abbrechen
            </a>
            <button type="submit" className={dashboardStyles.primaryButton}>
              Änderungen speichern
            </button>
          </div>
        </form>
        <div
          className={styles.mergePanel}
          id={`${getEditModalId(group)}-merge`}
        >
          <div>
            <p className={dashboardStyles.eyebrow}>Duplikate</p>
            <h3>Doppelten Fan zusammenführen</h3>
            <p className={styles.fieldHint}>
              Quelle: {group.displayName} · Kanäle:{" "}
              {group.platforms.map(formatPlatformLabel).join(", ")} · Tags:{" "}
              {group.tags.length ? group.tags.join(", ") : "keine"} · Aktive
              Kanal-Datensätze: {activeContactCount}
            </p>
          </div>
          <form className={styles.mergeForm} action={mergeFanContacts}>
            <input name="return_to" type="hidden" value="/fans" />
            <input
              name="source_contact_id"
              type="hidden"
              value={primaryContact.id}
            />
            <label htmlFor={`${getEditModalId(group)}-merge-target`}>
              Ziel-Fan auswählen
            </label>
            <select
              id={`${getEditModalId(group)}-merge-target`}
              name="target_contact_id"
              required
              defaultValue=""
            >
              <option value="" disabled>
                Nach Name/Handle auswählen
              </option>
              {mergeTargets.map((target) => (
                <option key={target.key} value={target.primaryContact.id}>
                  {target.displayName} · Handles:{" "}
                  {target.handles.join(", ") || "kein Handle"} · Kanäle:{" "}
                  {target.platforms.map(formatPlatformLabel).join("/") ||
                    "keine"}{" "}
                  · Kontakte: {target.contacts.length}
                </option>
              ))}
            </select>
            <p className={styles.fieldHint}>
              Conversations, Nachrichten, Memories, Follow-ups, Reply-Targets,
              Summaries und Profile werden auf den Ziel-Fan umgehängt. Tags,
              Notizen und Kanäle werden zusammengeführt; die Quelle wird danach
              archiviert.
            </p>
            <button
              className={dashboardStyles.secondaryButton}
              type="submit"
              disabled={!mergeTargets.length}
            >
              Zusammenführen bestätigen
            </button>
          </form>
        </div>
        <form className={styles.dangerForm} action={archiveFan}>
          <input name="contact_id" type="hidden" value={primaryContact.id} />
          <p className={styles.fieldHint}>
            Nachrichten bleiben erhalten. Der Fan wird aus der Standardliste
            ausgeblendet.
          </p>
          <button className={styles.dangerButton} type="submit">
            Fan archivieren
          </button>
        </form>
      </div>
    </section>
  );
}

function PlatformCheckboxes({
  selectedPlatforms,
}: {
  selectedPlatforms: PlatformValue[];
}) {
  return (
    <div className={styles.platformPicker}>
      {PLATFORM_OPTIONS.map((option) => {
        const isSelected = selectedPlatforms.includes(option.value);

        return (
          <label
            className={styles.platformOption}
            key={`${option.value}-${isSelected ? "checked" : "empty"}`}
          >
            <input
              name="source_platforms"
              type="checkbox"
              value={option.value}
              defaultChecked={isSelected}
            />
            <span>
              <PlatformLogo platform={option.value} size="sm" />
              {option.label === "Manuell"
                ? "Manuell / Sonstiges"
                : option.label}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function FansEmptyState({
  locale,
  readOnly,
}: {
  locale: FanMindLanguage;
  readOnly: boolean;
}) {
  return (
    <div className={dashboardStyles.emptyState}>
      <strong>Noch keine echten Fans gespeichert</strong>
      <p>
        {readOnly
          ? "Sobald der Workspace-Owner Fans hinzufügt, erscheinen sie hier für Teammitglieder im Nur-Lese-Modus."
          : "Lege den ersten Fan manuell an oder importiere eine vorbereitete Kontaktliste per CSV. FanMind behauptet hier keine aktive Instagram-, TikTok- oder Plattform-Synchronisation."}
      </p>
      {readOnly ? null : (
        <div className={dashboardStyles.emptyActions}>
          <Link
            className={dashboardStyles.primaryButton}
            href="/fans#new-fan-modal"
          >
            Ersten Fan anlegen
          </Link>
          <Link className={dashboardStyles.secondaryButton} href="/fans/import">
            {wt(locale, "CSV importieren")}
          </Link>
        </div>
      )}
    </div>
  );
}

function groupContactsByFan(
  contacts: ContactRow[],
  followups: FollowupRow[],
  unseenMessages: ConversationMessageRow[],
  conversationMessages: ConversationMessageRow[],
): FanGroup[] {
  const activeContacts = contacts.filter(
    (contact) => !isArchivedContact(contact),
  );
  const followupsByContact = new Map<string, FollowupRow[]>();
  const unseenContactIds = new Set(
    unseenMessages.map((message) => message.contact_id),
  );

  for (const followup of followups) {
    if (followup.status && followup.status !== "open") {
      continue;
    }

    followupsByContact.set(followup.contact_id, [
      ...(followupsByContact.get(followup.contact_id) ?? []),
      followup,
    ]);
  }

  const messagesByContact = new Map<string, ConversationMessageRow[]>();

  for (const message of conversationMessages) {
    messagesByContact.set(message.contact_id, [
      ...(messagesByContact.get(message.contact_id) ?? []),
      message,
    ]);
  }

  const groups = new Map<string, ContactRow[]>();

  for (const contact of activeContacts) {
    const groupKey = getFanGroupKey(contact);
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), contact]);
  }

  return Array.from(groups.entries())
    .map(([key, groupedContacts]) => {
      const sortedContacts = [...groupedContacts].sort(
        compareContactsByCreatedAt,
      );
      const primaryContact = sortedContacts[0];
      const groupFollowups = sortedContacts.flatMap(
        (contact) => followupsByContact.get(contact.id) ?? [],
      );

      return {
        key,
        displayName:
          primaryContact.display_name ||
          primaryContact.handle ||
          "Unbenannter Fan",
        primaryContact,
        contacts: sortedContacts,
        handles: uniqueValues(sortedContacts.map((contact) => contact.handle)),
        platforms: uniquePlatforms(
          sortedContacts,
          sortedContacts.flatMap(
            (contact) => messagesByContact.get(contact.id) ?? [],
          ),
        ),
        tags: uniqueValues(
          sortedContacts.flatMap((contact) => contact.tags ?? []),
        ),
        latestCreatedAt:
          sortedContacts.find((contact) => contact.created_at)?.created_at ??
          null,
        nextFollowup: getNextFollowup(groupFollowups),
        hasUnseenMessages: sortedContacts.some((contact) =>
          unseenContactIds.has(contact.id),
        ),
        isTopFan: Boolean(primaryContact.is_top_fan),
      };
    })
    .sort((left, right) => {
      if (left.hasUnseenMessages !== right.hasUnseenMessages) {
        return left.hasUnseenMessages ? -1 : 1;
      }
      return left.displayName.localeCompare(right.displayName, "de");
    });
}

function formatNotice(
  notice: string,
  activePlatformsNotice?: string,
  archivedChannelsNotice?: string,
  noticeError?: string,
): string {
  const activePlatforms = parseNoticePlatforms(activePlatformsNotice);
  const noticeLabels: Record<string, string> = {
    fan_created: "Fan wurde angelegt.",
    fan_updated: activePlatforms.length
      ? `Fan wurde aktualisiert: aktive Kanäle ${activePlatforms.map(formatPlatformLabel).join(", ")}${archivedChannelsNotice ? `; archivierte Kanäle: ${archivedChannelsNotice}` : ""}.`
      : "Fan wurde aktualisiert.",
    contact_archived: "Kontakt wurde archiviert.",
    contacts_merged: "Fans wurden zusammengeführt.",
    contact_delete_verification_failed:
      "Der Kontakt wurde gelöscht, aber die vollständige Löschung der bestätigten Chat-Lerndaten konnte danach nicht verifiziert werden. Bitte nicht erneut löschen; Admin-Reconciliation ist erforderlich.",
    fan_update_failed:
      "Kanäle konnten nicht aktualisiert werden. Bitte erneut versuchen oder Admin prüfen.",
    top_fan_marked: "Kontakt wurde als Top Fan markiert.",
    top_fan_removed: "Top-Fan-Markierung wurde entfernt.",
    top_fan_save_failed: "Top-Fan-Markierung konnte nicht gespeichert werden.",
    top_fan_forbidden: "Kontakt wurde im aktuellen Workspace nicht gefunden.",
    top_fan_unknown_contact: "Kontakt-ID fehlt oder ist unbekannt.",
    contacts_merge_failed: noticeError
      ? `Fans konnten nicht zusammengeführt werden: ${noticeError}`
      : "Fans konnten nicht zusammengeführt werden. Bitte Ziel-Fan prüfen und erneut versuchen.",
  };

  return noticeLabels[notice] ?? "Änderung wurde gespeichert.";
}

function isErrorNotice(notice: string): boolean {
  return notice.endsWith("_failed");
}

function parseNoticePlatforms(value?: string): PlatformValue[] {
  if (!value) return [];

  return value
    .split(",")
    .map((platform) => normalizePlatform(platform))
    .filter(
      (platform, index, platforms) => platforms.indexOf(platform) === index,
    );
}

function filterFanGroupsByChannel(
  groups: FanGroup[],
  activeChannel: PlatformValue | "all",
): FanGroup[] {
  if (activeChannel === "all") {
    return groups;
  }

  return groups.filter((group) => group.platforms.includes(activeChannel));
}

function filterFanGroupsBySearch(groups: FanGroup[], searchQuery: string): FanGroup[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  if (!normalizedQuery) {
    return groups;
  }

  return groups.filter((group) => getFanGroupSearchHaystack(group).includes(normalizedQuery));
}

function getFanGroupSearchHaystack(group: FanGroup): string {
  const values = [
    group.displayName,
    ...group.handles,
    ...group.tags,
    ...group.platforms,
    ...group.platforms.map(formatPlatformLabel),
    formatReplyChannel(group.platforms, group.primaryContact.source_platform),
    ...group.contacts.flatMap((contact) => [
      contact.display_name,
      contact.handle,
      contact.source_platform,
      contact.source_platform ? formatPlatformLabel(normalizePlatform(contact.source_platform)) : null,
      contact.language,
      contact.status,
      contact.summary,
      contact.internal_notes,
      ...(contact.tags ?? []),
    ]),
  ];

  return values
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
}

function compareContactsByCreatedAt(
  left: ContactRow,
  right: ContactRow,
): number {
  return getTime(right.created_at) - getTime(left.created_at);
}

function uniqueValues(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();

  return values.flatMap((value) => {
    const trimmed = value?.trim();

    if (!trimmed) {
      return [];
    }

    const key = trimmed.toLowerCase();

    if (seen.has(key)) {
      return [];
    }

    seen.add(key);
    return [trimmed];
  });
}

function uniquePlatforms(
  contacts: ContactRow[],
  messages: ConversationMessageRow[] = [],
): PlatformValue[] {
  const seen = new Set<PlatformValue>();

  return [
    ...contacts
      .filter((contact) => !isArchivedContact(contact))
      .map((contact) => contact.source_platform),
    ...messages.map((message) => message.source_platform ?? message.source_type),
  ].flatMap((source) => {
    const platform = normalizePlatform(source);

    if (seen.has(platform)) {
      return [];
    }

    seen.add(platform);
    return [platform];
  });
}

function getNextFollowup(followups: FollowupRow[]): FollowupRow | null {
  return (
    [...followups].sort((left, right) => {
      const dueDiff =
        getDateOnlyTime(left.due_date) - getDateOnlyTime(right.due_date);

      if (dueDiff !== 0) {
        return dueDiff;
      }

      return getTime(right.created_at) - getTime(left.created_at);
    })[0] ?? null
  );
}

function formatLimitedList(values: string[], limit: number): string {
  const visible = values.slice(0, limit).join(", ");
  const hiddenCount = values.length - limit;

  return hiddenCount > 0 ? `${visible} + weitere` : visible;
}

function formatReplyChannel(
  platforms: PlatformValue[],
  primaryPlatform?: string | null,
): string {
  const normalizedPrimary = primaryPlatform
    ? normalizePlatform(primaryPlatform)
    : null;

  if (normalizedPrimary && platforms.includes(normalizedPrimary)) {
    return `Antwort in ${formatPlatformLabel(normalizedPrimary)}`;
  }

  if (platforms.length === 1) {
    return `Antwort in ${formatPlatformLabel(platforms[0])}`;
  }

  return "Kanal wählen";
}

function countDueOrOverdueOpenFollowups(followups: FollowupRow[]): number {
  const today = new Date().toISOString().slice(0, 10);

  return followups.filter(
    (followup) => followup.status === "open" && followup.due_date && followup.due_date <= today,
  ).length;
}

function renderNextFollowup(followup: FollowupRow | null) {
  if (!followup) {
    return <span className={styles.mutedText}>—</span>;
  }

  return (
    <Link className={styles.followupCellLink} href={`/fans/${followup.contact_id}#followups`}>
      {followup.due_date ? (
        <span className={styles.followupDate}>
          {formatDateOnly(followup.due_date)}
        </span>
      ) : null}
      <span className={styles.followupReason}>{followup.reason}</span>
    </Link>
  );
}

function getTime(value: string | null): number {
  return value ? new Date(value).getTime() : 0;
}

function getDateOnlyTime(value: string | null): number {
  return value
    ? new Date(`${value}T00:00:00Z`).getTime()
    : Number.POSITIVE_INFINITY;
}

function formatStatus(value: string | null): string {
  return statusLabels[value ?? ""] ?? value ?? "Neu";
}

function formatDateOnly(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatDateOnlyFromTimestamp(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function getEditModalId(group: FanGroup): string {
  return `edit-fan-${group.primaryContact.id}`;
}

function getActiveChannel(value: string | undefined): PlatformValue | "all" {
  if (!value || value === "all") {
    return "all";
  }

  const normalized = normalizePlatform(value);

  return normalized === "manual" && value !== "manual" ? "all" : normalized;
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

export default async function FansPage({ searchParams }: FansPageProps) {
  const resolvedSearchParams = await searchParams;
  const channelParam = Array.isArray(resolvedSearchParams?.channel)
    ? resolvedSearchParams?.channel[0]
    : resolvedSearchParams?.channel;
  const noticeParam = Array.isArray(resolvedSearchParams?.notice)
    ? resolvedSearchParams?.notice[0]
    : resolvedSearchParams?.notice;
  const activeNoticeParam = Array.isArray(resolvedSearchParams?.active)
    ? resolvedSearchParams?.active[0]
    : resolvedSearchParams?.active;
  const archivedNoticeParam = Array.isArray(resolvedSearchParams?.archived)
    ? resolvedSearchParams?.archived[0]
    : resolvedSearchParams?.archived;
  const errorParam = Array.isArray(resolvedSearchParams?.error)
    ? resolvedSearchParams?.error[0]
    : resolvedSearchParams?.error;
  const queryParam = Array.isArray(resolvedSearchParams?.q)
    ? resolvedSearchParams?.q[0]
    : resolvedSearchParams?.q;
  const activeChannel = getActiveChannel(channelParam);
  const searchQuery = queryParam?.trim() ?? "";
  const { data, error: userError } = await getSupabaseServerUser();

  if (!data.user) {
    redirect("/login");
  }

  const locale = await resolveWorkspaceLocale({ lang: resolvedSearchParams?.lang, user: data.user });
  const workspaceResult = await getUserAuthorizedWorkspaceDashboard(data.user);
  if (workspaceResult.error?.message === "TEMPORARY_DEMO_DELETED") {
    redirect("/login?demo_deleted=1");
  }

  const workspace = workspaceResult.workspace;
  const preActivationRedirect = getPreActivationRedirect(workspace, data.user.email);
  if (preActivationRedirect) redirect(preActivationRedirect);
  const contactsResult = workspace
    ? await getWorkspaceContacts(workspace.id)
    : null;
  const followupsResult = workspace
    ? await getWorkspaceOpenFollowups(workspace.id)
    : null;
  const openFollowupCountResult = workspace
    ? await getOpenFollowupCount(workspace.id)
    : null;
  const conversationMessagesResult = workspace
    ? await getWorkspaceConversationMessages(workspace.id)
    : null;
  const unseenMessagesResult = workspace
    ? await getWorkspaceUnseenInboundMessages(workspace.id)
    : null;

  return (
    <main className={dashboardStyles.page}>
      {workspace ? (
        <FansWorkspace
          workspace={workspace}
          userDisplayName={getUserDisplayName(
            data.user.user_metadata,
            workspace.name,
          )}
          contacts={contactsResult?.contacts ?? []}
          contactsError={contactsResult?.error?.message}
          followups={followupsResult?.followups ?? []}
          followupsError={followupsResult?.error?.message}
          openFollowupCount={openFollowupCountResult?.count ?? 0}
          unseenMessages={unseenMessagesResult?.messages ?? []}
          conversationMessages={conversationMessagesResult?.messages ?? []}
          conversationMessagesError={conversationMessagesResult?.error?.message}
          unseenMessagesError={unseenMessagesResult?.error?.message}
          activeChannel={activeChannel}
          searchQuery={searchQuery}
          notice={noticeParam}
          activePlatformsNotice={activeNoticeParam}
          archivedChannelsNotice={archivedNoticeParam}
          noticeError={errorParam}
          locale={locale}
          userEmail={data.user.email}
        />
      ) : (
        <section
          className={dashboardStyles.fallbackCard}
          aria-label="FanMind Workspace"
        >
          <div>
            <p className={dashboardStyles.eyebrow}>FanMind Fans</p>
            <h1>Workspace-Status</h1>
            <p>
              Fans ist geschützt: Supabase Auth ist aktiv. Für deinen Account
              wurde noch kein Workspace gefunden.
            </p>
          </div>
          {userError ? (
            <p className={dashboardStyles.error}>
              <strong>
                Supabase-Session konnte nicht vollständig geprüft werden.
              </strong>
              <span>{userError.message}</span>
            </p>
          ) : null}
          {workspaceResult.error ? (
            <p className={dashboardStyles.error}>
              <strong>Workspace-Daten konnten nicht geladen werden.</strong>
              <span>{workspaceResult.error.message}</span>
            </p>
          ) : null}
          <form action={logout}>
            <button type="submit" className={dashboardStyles.secondaryButton}>
              Abmelden
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
