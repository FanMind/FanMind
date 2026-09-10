import Link from "next/link";
import { redirect } from "next/navigation";
import { getPreActivationRedirect } from "@/lib/preActivation";
import { isPlatformAdminEmail } from "@/lib/admin";
import {
  getFollowupCompletionCounts,
  getSupabaseServerUser,
  getWorkspaceContacts,
  getWorkspaceOpenFollowups,
  getWorkspaceUnseenInboundMessages,
  signOutSupabaseServerSession,
  type ContactRow,
  type FollowupRow,
  type ConversationMessageRow,
  type WorkspaceDashboardRow,
} from "@/lib/supabase/server";
import { getUserAuthorizedWorkspaceDashboard } from "@/lib/workspaceAuthorization";
import { getCommercialOptionLabel, getWorkspacePlanStatus } from "@/lib/dashboardFeatures";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { getWorkspaceNavigation } from "@/lib/workspaceNavigation";
import { resolveWorkspaceLocale } from "@/lib/workspaceLocale";
import { wt } from "@/lib/workspaceCopy";
import type { FanMindLanguage } from "@/lib/fanmindCopy";
import {
  calculateFollowupCompletionRate,
  getWorkspaceKpiStatsFromContacts,
  type FollowupCompletionRate,
} from "@/lib/workspaceKpiStats";
import { getFanGroupKey } from "@/lib/fanIdentity";
import { PlatformLogo } from "@/components/PlatformLogo";
import styles from "./dashboard.module.css";
import { resolvePublicWorkspacePlanId } from "@/lib/publicDailyPlanPolicy.mjs";
import { getMessageSourceContext } from "@/lib/sourceContext";

type WorkspaceDetailsProps = {
  workspace: WorkspaceDashboardRow;
  userDisplayName?: string;
  contacts: ContactRow[];
  contactsError?: string;
  followups: FollowupRow[];
  followupsError?: string;
  unseenMessages: ConversationMessageRow[];
  unseenMessagesError?: string;
  openFollowupCount: number;
  followupCompletionRate: FollowupCompletionRate | null;
  showAdminArea: boolean;
};

type WorkspaceDisplay = {
  packageName: string;
  commercialOptionName: string;
  setupFeeLabel: string;
  monthlyFeeLabel: string;
  commitmentLabel: string;
  planHint: string;
  packageSummary: string;
  contractNote: string;
};

type WorkInboxItem = {
  key: string;
  contactId: string;
  name: string;
  handle: string;
  source: string;
  reason: string;
  due: string;
  status: string;
  dueTime: number;
};

type NewMessageItem = {
  id: string;
  contactId: string;
  name: string;
  source: string;
  sourceContext: string;
  sourceKey: string;
  excerpt: string;
  createdAt: string | null;
};

const euroFormatter = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

async function logout() {
  "use server";

  await signOutSupabaseServerSession();
  redirect("/");
}

function formatEuro(cents: number): string {
  return `${euroFormatter.format(cents / 100)} €`;
}

function getWorkspaceDisplay(
  workspace: WorkspaceDashboardRow,
): WorkspaceDisplay {
  if (workspace.member_safe_projection === true) {
    return {
      packageName: "Teamzugang",
      commercialOptionName: "Mitglied · CRM-Lesezugriff",
      setupFeeLabel: "Nicht freigegeben",
      monthlyFeeLabel: "Nicht freigegeben",
      commitmentLabel: "Nur für den Workspace-Owner sichtbar",
      planHint: "Sicherer Teamzugang",
      packageSummary:
        "Teammitglieder sehen nur die für den CRM-Arbeitsfluss freigegebene Workspace-Projektion.",
      contractNote:
        "Vertrags-, Rechnungs-, Stripe-, Steuer-, Adress- und Testzugangsdaten bleiben dem Workspace-Owner vorbehalten.",
    };
  }
  if (resolvePublicWorkspacePlanId(workspace) === "daily") {
    return {
      packageName: "Daily",
      commercialOptionName: getCommercialOptionLabel(workspace.commercial_option),
      setupFeeLabel: "0 €",
      monthlyFeeLabel: "1 €/Tag",
      commitmentLabel: "täglich kündbar",
      planHint: "Daily · tägliche Abrechnung",
      packageSummary: "FanMind mit täglicher Abrechnung ohne Einrichtungsgebühr.",
      contractNote: "0 € Setup + 1 €/Tag · täglich zum Ende des bezahlten Abrechnungstags kündbar; kein Referral-Rabatt.",
    };
  }
  const setupFee = formatEuro(workspace.setup_fee_cents);
  const monthlyFee = formatEuro(workspace.monthly_fee_cents);

  if (
    workspace.plan_id === "pilot" &&
    workspace.commercial_option === "pilot_only"
  ) {
    return {
      packageName: "Pilot / Setup",
      commercialOptionName: getCommercialOptionLabel(
        workspace.commercial_option,
      ),
      setupFeeLabel: setupFee,
      monthlyFeeLabel: monthlyFee,
      commitmentLabel: "keine",
      planHint: "Pilot / Setup · Demo-/Setupmonat",
      packageSummary:
        "1 Monat Test-/Setup-Zugang mit sicheren Workspace-Daten und manuell gepflegten Kontakten.",
      contractNote:
        "990 € einmalig · 1 Monat testen · keine Bindung. Du arbeitest im sicheren Demo-/Setupmodus; es gibt keine automatische Verlängerung und wenn du nicht weitermachst, endet der Pilot.",
    };
  }

  if (workspace.plan_id === "starter") {
    const commercialOption = String(workspace.commercial_option);
    const isCommitmentOption =
      commercialOption === "starter_no_setup_commitment";

    return {
      packageName: isCommitmentOption ? "Starter Option B" : "Starter Option A",
      commercialOptionName: isCommitmentOption
        ? "312 €/Monat · 12 Monate"
        : "990 € Setup + 312 €/Monat",
      setupFeeLabel: setupFee,
      monthlyFeeLabel: monthlyFee,
      commitmentLabel: isCommitmentOption ? "12 Monate" : "monatlich kündbar",
      planHint: isCommitmentOption
        ? "Starter · ohne Einrichtung · 12 Monate"
        : "Starter · Setup + monatlich kündbar",
      packageSummary:
        "Produktiver MVP-Kern für Kontakte und manuelle Kontaktpflege.",
      contractNote: isCommitmentOption
        ? "312 €/Monat · ohne Einrichtung · 12 Monate Bindung. Hier wird keine Zahlungs- oder Subscription-Logik ausgelöst."
        : "990 € einmalige Einrichtung + 312 €/Monat · jederzeit zum Ende des laufenden, vollständig zu bezahlenden Abrechnungsmonats kündbar.",
    };
  }

  if (workspace.plan_id === "growth") {
    return {
      packageName: "Growth",
      commercialOptionName: getCommercialOptionLabel(
        workspace.commercial_option,
      ),
      setupFeeLabel: setupFee,
      monthlyFeeLabel: monthlyFee,
      commitmentLabel: "noch nicht produktiv gebucht",
      planHint: "Growth · Vorschau",
      packageSummary:
        "Growth-Funktionen bleiben Vorschau und werden nicht als aktive Vollversion angezeigt.",
      contractNote:
        "Growth wird im Dashboard als Vorschau gezeigt. Erweiterte Profile, Segmente und höhere Nutzung werden vorbereitet, aber nicht als produktive Vollversion verkauft.",
    };
  }

  if (workspace.plan_id === "agency") {
    return {
      packageName: "Agency",
      commercialOptionName: getCommercialOptionLabel(
        workspace.commercial_option,
      ),
      setupFeeLabel: setupFee,
      monthlyFeeLabel: monthlyFee,
      commitmentLabel: "Demo / Erstgespräch",
      planHint: "Agency · Demo/Erstgespräch/Vorschau",
      packageSummary:
        "Agency-Funktionen bleiben Demo-/Erstgesprächsmodus und sind nicht produktiv freigeschaltet.",
      contractNote:
        "Agency ist als Demo- und Erstgesprächsmodus markiert. Multi-Client, Teamstruktur und Agentur-Workflow sind Vorschau und nicht produktiv freigeschaltet.",
    };
  }

  return {
    packageName: workspace.plan_id,
    commercialOptionName: getCommercialOptionLabel(workspace.commercial_option),
    setupFeeLabel: setupFee,
    monthlyFeeLabel: monthlyFee,
    commitmentLabel: "keine",
    planHint: "Workspace geladen · Paket geprüft",
    packageSummary:
      "Workspace geladen; sichtbare Module richten sich nach Paket und Vertrag.",
    contractNote:
      "Workspace-Daten wurden geladen. Die sichtbaren Dashboard-Module werden aus plan_id und commercial_option abgeleitet.",
  };
}

function countDueOrOverdueOpenFollowups(followups: FollowupRow[]): number {
  const today = new Date().toISOString().slice(0, 10);

  return followups.filter(
    (followup) =>
      followup.status === "open" &&
      followup.due_date &&
      followup.due_date <= today,
  ).length;
}

function getWorkInboxItems(
  contacts: ContactRow[],
  followups: FollowupRow[],
): WorkInboxItem[] {
  const contactsById = new Map(
    contacts.map((contact) => [contact.id, contact]),
  );
  const itemsByFan = new Map<string, WorkInboxItem>();

  for (const followup of followups) {
    if (followup.status && followup.status !== "open") {
      continue;
    }

    const contact = contactsById.get(followup.contact_id);

    if (!contact) {
      continue;
    }

    const key = getFanGroupKey(contact);
    const existingItem = itemsByFan.get(key);
    const candidate: WorkInboxItem = {
      key,
      contactId: contact.id,
      name: contact.display_name || contact.handle || "Unbenannter Kontakt",
      handle: contact.handle ?? "Kein Handle hinterlegt",
      source: formatSource(contact.source_platform),
      reason: followup.reason,
      due: formatDueDate(followup.due_date),
      status: followup.status ?? "open",
      dueTime: getFollowupDueTime(followup.due_date),
    };

    if (!existingItem || candidate.dueTime < existingItem.dueTime) {
      itemsByFan.set(key, candidate);
    }
  }

  return Array.from(itemsByFan.values()).slice(0, 8);
}

function getNewMessageItems(
  contacts: ContactRow[],
  messages: ConversationMessageRow[],
): NewMessageItem[] {
  const contactsById = new Map(
    contacts.map((contact) => [contact.id, contact]),
  );
  const latestByContact = new Map<string, ConversationMessageRow>();

  for (const message of messages) {
    const existing = latestByContact.get(message.contact_id);

    if (
      !existing ||
      getTimestamp(message.created_at) > getTimestamp(existing.created_at)
    ) {
      latestByContact.set(message.contact_id, message);
    }
  }

  return Array.from(latestByContact.values())
    .sort(
      (left, right) =>
        getTimestamp(right.created_at) - getTimestamp(left.created_at),
    )
    .slice(0, 8)
    .map((message) => {
      const contact = contactsById.get(message.contact_id);
      return {
        id: message.id,
        contactId: message.contact_id,
        name:
          contact?.display_name ||
          contact?.handle ||
          message.author_label ||
          "Unbenannter Kontakt",
        source: formatSource(message.source_platform),
        sourceContext: getMessageSourceContext(message).contextLabel,
        sourceKey: getMessageSourceContext(message).contextKey,
        excerpt: message.original_text_excerpt || message.content,
        createdAt: message.created_at,
      };
    });
}

function getTimestamp(value: string | null): number {
  return value ? new Date(value).getTime() : 0;
}

function getFollowupDueTime(value: string | null): number {
  return value
    ? new Date(`${value}T00:00:00Z`).getTime()
    : Number.POSITIVE_INFINITY;
}

function formatDueDate(value: string | null): string {
  if (!value) {
    return "Ohne Fälligkeitsdatum";
  }

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatDateTime(value: string | null): string {
  if (!value) return "Zeitpunkt unbekannt";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatSource(value: string | null): string {
  const sourceLabels: Record<string, string> = {
    manual: "Manuell",
    facebook: "Facebook Nachrichten",
    instagram: "Instagram",
    tiktok: "TikTok (manuell)",
    telegram: "Telegram",
    telegram_messages: "Telegram",
  };

  return sourceLabels[value ?? ""] ?? value ?? "Manuell";
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

function WorkspaceDetails({
  workspace,
  userDisplayName,
  contacts,
  contactsError,
  followups,
  followupsError,
  unseenMessages,
  unseenMessagesError,
  openFollowupCount,
  followupCompletionRate,
  locale,
  showAdminArea,
}: WorkspaceDetailsProps & { locale: FanMindLanguage }) {
  const display = getWorkspaceDisplay(workspace);
  const pageTitle = "Dashboard";
  const displayName = userDisplayName ?? workspace.name ?? "Nutzer";
  const pageSubtitle = wt(locale, "Willkommen zurück, Pilot Test 👋");
  const primaryActionLabel = wt(locale, "+ Neuer Kontakt");
  const planStatus = getWorkspacePlanStatus(workspace);
  const userLabel = displayName;
  const dueFollowupCount = countDueOrOverdueOpenFollowups(followups);
  const { mainNavigation, settingsNavigation, savedViews } =
    getWorkspaceNavigation(
      "dashboard",
      locale,
      dueFollowupCount,
      showAdminArea,
      workspace.role,
    );
  const workInboxItems = getWorkInboxItems(contacts, followups);
  const newMessageItems = getNewMessageItems(contacts, unseenMessages);
  const workspaceKpis = getWorkspaceKpiStatsFromContacts(
    contacts,
    openFollowupCount,
  );
  return (
    <WorkspaceShell
      workspaceName={workspace.name}
      userLabel={userLabel}
      planLabel={display.packageName}
      planMeta={display.commercialOptionName}
      planStatus={wt(locale, planStatus)}
      mainNavigation={mainNavigation}
      settingsNavigation={settingsNavigation}
      savedViews={savedViews}
      header={{
        title: wt(locale, pageTitle),
        subtitle: pageSubtitle,
        searchPlaceholder: wt(
          locale,
          "Suche nach Name, Tag, Kanal, Sprache ...",
        ),
        primaryActionLabel,
        primaryActionHref: "/fans",
      }}
      contactCount={workspaceKpis.totalFans}
      openFollowupCount={openFollowupCount}
      followupCompletionRate={followupCompletionRate}
      logoutAction={logout}
      locale={locale}
    >
      <section
        className={styles.crmGrid}
        aria-label={wt(locale, "Arbeits-Eingang")}
      >
        <section
          className={`${styles.moduleCard} ${styles.contactCard}`}
          id="work-inbox"
          aria-labelledby="work-inbox-title"
        >
          <div className={styles.moduleHeader}>
            <div>
              <p className={styles.eyebrow}>{wt(locale, "Arbeits-Eingang")}</p>
              <h2 id="work-inbox-title">{wt(locale, "Neue Nachrichten")}</h2>
            </div>
            <Link className={styles.moduleHeaderLink} href="/fans#fans-list">
              {wt(locale, "Alle Fans öffnen")}
            </Link>
          </div>
          <p className={styles.moduleText}>
            Hier erscheinen nur Arbeitsfälle: neue eingegangene Nachrichten oder
            offene/fällige Follow-ups. Normale Kontakte ohne Aufgabe bleiben in
            der vollständigen Fanliste. Pro Fan wird nur ein Eintrag angezeigt.
          </p>
          {contactsError ? (
            <p className={styles.error}>
              <strong>Kontakte konnten nicht geladen werden.</strong>
              <span>{contactsError}</span>
            </p>
          ) : null}
          {followupsError ? (
            <p className={styles.error}>
              <strong>Follow-ups konnten nicht geladen werden.</strong>
              <span>{followupsError}</span>
            </p>
          ) : null}
          {unseenMessagesError ? (
            <p className={styles.error}>
              <strong>Neue Nachrichten konnten nicht geladen werden.</strong>
              <span>{unseenMessagesError}</span>
            </p>
          ) : null}
          {newMessageItems.length ? (
            <div className={styles.newMessageList}>
              {newMessageItems.map((item) => {
                const params = new URLSearchParams({
                  seen_message: item.id,
                  from: "dashboard",
                });
                const channel = normalizeDashboardChannel(item.source);
                if (channel) params.set("channel", channel);
                if (item.sourceKey !== "all")
                  params.set("source", item.sourceKey);
                const detailHref = `/fans/${item.contactId}?${params.toString()}`;

                return (
                  <article className={styles.newMessageRow} key={item.id}>
                    <div className={styles.newMessageMain}>
                      <div className={styles.newMessageHeader}>
                        <Link
                          className={styles.contactNameLink}
                          href={detailHref}
                        >
                          {item.name}
                        </Link>
                        <PlatformLogo
                          className={styles.newMessageChannelLogo}
                          platform={item.source}
                          size="sm"
                        />
                        <span className={styles.tableBadge}>
                          {item.sourceContext}
                        </span>
                        <time dateTime={item.createdAt ?? undefined}>
                          {formatDateTime(item.createdAt)}
                        </time>
                      </div>
                      <p className={styles.newMessageExcerpt}>{item.excerpt}</p>
                    </div>
                    <Link className={styles.newMessageAction} href={detailHref}>
                      Öffnen
                    </Link>
                  </article>
                );
              })}
            </div>
          ) : workInboxItems.length ? (
            <div className={styles.workInboxList}>
              {workInboxItems.map((item) => (
                <article className={styles.workInboxItem} key={item.key}>
                  <div>
                    <span className={styles.tableBadge}>Follow-up</span>
                    <h3>
                      <Link
                        className={styles.contactNameLink}
                        href={`/fans/${item.contactId}`}
                      >
                        {item.name}
                      </Link>
                    </h3>
                    <p>{item.reason}</p>
                    <small>
                      {item.handle} · {item.source}
                    </small>
                  </div>
                  <div className={styles.workInboxMeta}>
                    <strong>{item.due}</strong>
                    <span>{item.status}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <strong>Keine offenen Nachrichten oder Aufgaben.</strong>
              <p>
                Sobald eine neue Nachricht vorliegt oder ein Follow-up offen
                ist, erscheint der Kontakt hier. Die vollständige Kontaktliste
                bleibt unter /fans.
              </p>
              <div className={styles.emptyActions}>
                <Link className={styles.secondaryButton} href="/fans#fans-list">
                  Vollständige Fanliste öffnen
                </Link>
              </div>
            </div>
          )}
        </section>
      </section>

      <div className={styles.safetyNote} role="note">
        <strong>{wt(locale, "Keine automatische Sendefunktion.")}</strong>
        <span>
          Social-Media-Synchronisation wird als Pflichtbereich ausgebaut, soweit
          Plattformen es technisch und rechtlich zulassen. Mensch prüft und
          sendet final selbst.
        </span>
      </div>
    </WorkspaceShell>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ lang?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const { data, error: userError } = await getSupabaseServerUser();

  if (!data.user) {
    redirect("/login");
  }

  const locale = await resolveWorkspaceLocale({
    lang: resolvedSearchParams?.lang,
    user: data.user,
  });
  const workspaceResult = await getUserAuthorizedWorkspaceDashboard(data.user);
  if (workspaceResult.error?.message === "TEMPORARY_DEMO_DELETED") {
    redirect("/login?demo_deleted=1");
  }

  const workspace = workspaceResult.workspace;
  const preActivationRedirect = getPreActivationRedirect(
    workspace,
    data.user.email,
  );
  if (preActivationRedirect) redirect(preActivationRedirect);
  const contactsResult = workspace
    ? await getWorkspaceContacts(workspace.id)
    : null;
  const followupsResult = workspace
    ? await getWorkspaceOpenFollowups(workspace.id)
    : null;
  const followupCompletionCountsResult = workspace
    ? await getFollowupCompletionCounts(workspace.id)
    : null;
  const unseenMessagesResult = workspace
    ? await getWorkspaceUnseenInboundMessages(workspace.id)
    : null;

  return (
    <main className={styles.page}>
      {workspace ? (
        <WorkspaceDetails
          workspace={workspace}
          userDisplayName={getUserDisplayName(
            data.user.user_metadata,
            workspace.name,
          )}
          contacts={contactsResult?.contacts ?? []}
          contactsError={contactsResult?.error?.message}
          followups={followupsResult?.followups ?? []}
          followupsError={followupsResult?.error?.message}
          unseenMessages={unseenMessagesResult?.messages ?? []}
          unseenMessagesError={unseenMessagesResult?.error?.message}
          openFollowupCount={
            followupCompletionCountsResult &&
            !followupCompletionCountsResult.error
              ? followupCompletionCountsResult.open
              : 0
          }
          followupCompletionRate={
            followupCompletionCountsResult &&
            !followupCompletionCountsResult.error
              ? calculateFollowupCompletionRate(
                  followupCompletionCountsResult.open,
                  followupCompletionCountsResult.completed,
                )
              : null
          }
          locale={locale}
          showAdminArea={isPlatformAdminEmail(data.user.email)}
        />
      ) : (
        <section className={styles.fallbackCard} aria-label="FanMind Workspace">
          <div>
            <p className={styles.eyebrow}>FanMind Dashboard</p>
            <h1>Workspace-Status</h1>
            <p>
              Dashboard geschützt: Supabase Auth ist aktiv. Für deinen Account
              wurde noch kein Workspace gefunden.
            </p>
          </div>
          {userError ? (
            <p className={styles.error}>
              <strong>
                Supabase-Session konnte nicht vollständig geprüft werden.
              </strong>
              <span>{userError.message}</span>
            </p>
          ) : null}
          {workspaceResult.error ? (
            <p className={styles.error}>
              <strong>Workspace-Daten konnten nicht geladen werden.</strong>
              <span>{workspaceResult.error.message}</span>
            </p>
          ) : null}
          <form action={logout}>
            <button type="submit" className={styles.secondaryButton}>
              Abmelden
            </button>
          </form>
        </section>
      )}
    </main>
  );
}

function normalizeDashboardChannel(source: string): string | null {
  const value = source.toLowerCase();
  if (value.includes("instagram")) return "instagram";
  if (value.includes("whatsapp")) return "whatsapp";
  if (value.includes("facebook")) return "facebook";
  if (value.includes("tiktok")) return "tiktok";
  if (value.includes("mail")) return "email";
  if (value.includes("web") || value.includes("formular")) return "webform";
  return null;
}
