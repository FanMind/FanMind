import Link from "next/link";
import { redirect } from "next/navigation";
import { isPlatformAdminEmail } from "@/lib/admin";
import { getPreActivationRedirect } from "@/lib/preActivation";
import {
  getOpenFollowupCount,
  getSupabaseServerUser,
  getUserWorkspaceDashboard,
  getWorkspaceContacts,
  signOutSupabaseServerSession,
  type ContactRow,
  type WorkspaceDashboardRow,
} from "@/lib/supabase/server";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { getWorkspaceNavigationForUser } from "@/lib/workspaceNavigation";
import { getWorkspaceKpiStatsFromContacts } from "@/lib/workspaceKpiStats";
import dashboardStyles from "../dashboard/dashboard.module.css";

type ReachChannelRow = {
  channel: string;
  source: string;
  reach: number;
  impressions: number;
  engagements: number;
  comments: number;
  newContacts: number;
  status: "MVP" | "CSV" | "Später API";
  note: string;
};

type ReachTrendPoint = {
  label: string;
  reach: number;
  height: string;
};

type ReachWorkspaceProps = {
  workspace: WorkspaceDashboardRow;
  userDisplayName: string;
  contacts: ContactRow[];
  contactsError?: string;
  openFollowupCount: number;
  userEmail: string | null | undefined;
};

const numberFormatter = new Intl.NumberFormat("de-DE");
const percentFormatter = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const REACH_CHANNELS: ReachChannelRow[] = [
  {
    channel: "Instagram",
    source: "Manuell / CSV",
    reach: 12800,
    impressions: 18600,
    engagements: 1320,
    comments: 148,
    newContacts: 18,
    status: "MVP",
    note: "Beste Demo-Quelle für Creator-Agenturen: hohe Sichtbarkeit und schnelle Gesprächsanlässe.",
  },
  {
    channel: "TikTok",
    source: "Manuell / CSV",
    reach: 21400,
    impressions: 31800,
    engagements: 2240,
    comments: 93,
    newContacts: 11,
    status: "MVP",
    note: "Starker Reichweitenkanal; FanMind bewertet daraus, wo sich Follow-ups lohnen.",
  },
  {
    channel: "Facebook",
    source: "Manuell / CSV",
    reach: 6200,
    impressions: 9100,
    engagements: 410,
    comments: 64,
    newContacts: 7,
    status: "MVP",
    note: "Nützlich für bestehende Communities und ältere Zielgruppen.",
  },
  {
    channel: "X/Twitter",
    source: "Roadmap API",
    reach: 3900,
    impressions: 5400,
    engagements: 180,
    comments: 21,
    newContacts: 3,
    status: "Später API",
    note: "Als API-Integration erst nach Kosten-, Rechte- und Use-Case-Prüfung aktivieren.",
  },
  {
    channel: "Discord",
    source: "Roadmap / Bot-Kontext",
    reach: 2800,
    impressions: 2800,
    engagements: 360,
    comments: 118,
    newContacts: 9,
    status: "Später API",
    note: "Community-Signale sind wertvoll, aber keine ungeprüfte Server-/Nachrichtenanalyse im MVP.",
  },
];

const REACH_TREND: ReachTrendPoint[] = [
  { label: "Mo", reach: 7800, height: "34%" },
  { label: "Di", reach: 9200, height: "40%" },
  { label: "Mi", reach: 14400, height: "62%" },
  { label: "Do", reach: 11900, height: "52%" },
  { label: "Fr", reach: 18600, height: "80%" },
  { label: "Sa", reach: 23200, height: "100%" },
  { label: "So", reach: 16700, height: "72%" },
];

async function logout() {
  "use server";

  await signOutSupabaseServerSession();
  redirect("/");
}

function getUserDisplayName(
  metadata: Record<string, unknown> | undefined,
  fallback: string,
): string {
  const displayName = metadata?.display_name ?? metadata?.full_name ?? metadata?.name;

  return typeof displayName === "string" && displayName.trim()
    ? displayName.trim()
    : fallback;
}

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function formatPercent(numerator: number, denominator: number): string {
  if (!denominator) {
    return "0,0 %";
  }

  return `${percentFormatter.format((numerator / denominator) * 100)} %`;
}

function getReachTotals(rows: ReachChannelRow[]) {
  return rows.reduce(
    (totals, row) => ({
      reach: totals.reach + row.reach,
      impressions: totals.impressions + row.impressions,
      engagements: totals.engagements + row.engagements,
      comments: totals.comments + row.comments,
      newContacts: totals.newContacts + row.newContacts,
    }),
    { reach: 0, impressions: 0, engagements: 0, comments: 0, newContacts: 0 },
  );
}

function countWarmContactSignals(contacts: ContactRow[]): number {
  const warmStatuses = new Set(["warm", "buyer", "vip"]);

  return contacts.filter((contact) => warmStatuses.has((contact.status ?? "").toLowerCase())).length;
}

function ReachWorkspace({
  workspace,
  userDisplayName,
  contacts,
  contactsError,
  openFollowupCount,
  userEmail,
}: ReachWorkspaceProps) {
  const { mainNavigation, settingsNavigation, savedViews } =
    getWorkspaceNavigationForUser(
      "reach",
      userEmail,
      "de",
      openFollowupCount,
      workspace.role,
    );
  const userLabel = userDisplayName || workspace.name || "Nutzer";
  const totals = getReachTotals(REACH_CHANNELS);
  const topChannel = [...REACH_CHANNELS].sort((left, right) => right.reach - left.reach)[0];
  const warmContactSignals = countWarmContactSignals(contacts);

  return (
    <WorkspaceShell
      workspaceName={workspace.name}
      userLabel={userLabel}
      planLabel={workspace.plan_id}
      planMeta={workspace.role}
      planStatus="MVP"
      mainNavigation={mainNavigation}
      settingsNavigation={settingsNavigation}
      savedViews={savedViews}
      header={{
        title: "Reichweiten-Auswertung",
        subtitle: "MVP-Modul: manuelle/CSV-Kennzahlen jetzt, echte Plattform-APIs später.",
        searchPlaceholder: "Suche nach Kanal, Kampagne, Zeitraum ...",
        primaryActionLabel: "CSV-Import vorbereiten",
        primaryActionHref: "/fans/import",
      }}
      contactCount={getWorkspaceKpiStatsFromContacts(contacts).totalFans}
      openFollowupCount={openFollowupCount}
      logoutAction={logout}
    >
      <section className={dashboardStyles.kpiGrid} aria-label="Reichweiten-Kennzahlen">
        <article className={`${dashboardStyles.kpiCard} ${dashboardStyles["tone-cyan"]}`}>
          <div className={dashboardStyles.kpiTextBlock}>
            <span className={dashboardStyles.kpiLabel}>Gesamtreichweite</span>
            <strong className={dashboardStyles.kpiValue}>{formatNumber(totals.reach)}</strong>
            <span className={dashboardStyles.kpiMeta}>Demo-/CSV-Summe über alle Kanäle</span>
          </div>
        </article>
        <article className={`${dashboardStyles.kpiCard} ${dashboardStyles["tone-blue"]}`}>
          <div className={dashboardStyles.kpiTextBlock}>
            <span className={dashboardStyles.kpiLabel}>Impressions</span>
            <strong className={dashboardStyles.kpiValue}>{formatNumber(totals.impressions)}</strong>
            <span className={dashboardStyles.kpiMeta}>Sichtkontakte, nicht einzelne Personen</span>
          </div>
        </article>
        <article className={`${dashboardStyles.kpiCard} ${dashboardStyles["tone-green"]}`}>
          <div className={dashboardStyles.kpiTextBlock}>
            <span className={dashboardStyles.kpiLabel}>Engagement-Rate</span>
            <strong className={dashboardStyles.kpiValue}>{formatPercent(totals.engagements, totals.impressions)}</strong>
            <span className={dashboardStyles.kpiMeta}>Engagements / Impressions</span>
          </div>
        </article>
        <article className={`${dashboardStyles.kpiCard} ${dashboardStyles["tone-violet"]}`}>
          <div className={dashboardStyles.kpiTextBlock}>
            <span className={dashboardStyles.kpiLabel}>Neue Kontakte</span>
            <strong className={dashboardStyles.kpiValue}>{formatNumber(totals.newContacts)}</strong>
            <span className={dashboardStyles.kpiMeta}>Manuelle Zuordnung zu FanMind-Kontakten</span>
          </div>
        </article>
        <article className={`${dashboardStyles.kpiCard} ${dashboardStyles["tone-orange"]}`}>
          <div className={dashboardStyles.kpiTextBlock}>
            <span className={dashboardStyles.kpiLabel}>Warme Signale</span>
            <strong className={dashboardStyles.kpiValue}>{formatNumber(warmContactSignals)}</strong>
            <span className={dashboardStyles.kpiMeta}>Status warm, buyer oder vip im Workspace</span>
          </div>
        </article>
        <article className={`${dashboardStyles.kpiCard} ${dashboardStyles["tone-cyan"]}`}>
          <div className={dashboardStyles.kpiTextBlock}>
            <span className={dashboardStyles.kpiLabel}>Bester Kanal</span>
            <strong className={dashboardStyles.kpiValue}>{topChannel.channel}</strong>
            <span className={dashboardStyles.kpiMeta}>{formatNumber(topChannel.reach)} Reichweite</span>
          </div>
        </article>
      </section>

      <section className={dashboardStyles.crmGrid} aria-label="Reichweiten-Auswertung Details">
        <section className={dashboardStyles.moduleCard} aria-labelledby="reach-chart-title">
          <div className={dashboardStyles.moduleHeader}>
            <div>
              <p className={dashboardStyles.eyebrow}>Auswertung</p>
              <h2 id="reach-chart-title">7-Tage-Reichweite</h2>
            </div>
            <span>MVP / CSV</span>
          </div>
          <div className={dashboardStyles.chartPlaceholder}>
            <div className={dashboardStyles.chartBars} aria-label="Demo-Balkendiagramm Reichweite pro Tag">
              {REACH_TREND.map((point) => (
                <span
                  key={point.label}
                  title={`${point.label}: ${formatNumber(point.reach)} Reichweite`}
                  style={{ height: point.height }}
                />
              ))}
            </div>
            <div className={dashboardStyles.chartSummary}>
              <strong>Was Gerhard in der Demo zeigen kann:</strong>
              <p>
                FanMind verknüpft Reichweite nicht nur mit Eitelkeitszahlen, sondern
                mit konkreten Gesprächsanlässen: Welche Kanäle bringen Sichtbarkeit,
                wo entstehen Kommentare, und welche Kontakte müssen in Follow-ups oder
                ins Fan-Memory übernommen werden.
              </p>
            </div>
          </div>
        </section>

        <section className={dashboardStyles.moduleCard} aria-labelledby="reach-table-title">
          <div className={dashboardStyles.moduleHeader}>
            <div>
              <p className={dashboardStyles.eyebrow}>Kanäle</p>
              <h2 id="reach-table-title">Reichweite nach Quelle</h2>
            </div>
            <Link className={dashboardStyles.moduleHeaderLink} href="/fans/import">
              CSV vorbereiten
            </Link>
          </div>
          <p className={dashboardStyles.moduleText}>
            Diese Ansicht ist bewusst kein Scraping und keine Live-Social-Integration.
            Im MVP werden Kennzahlen als manuelle Demo-/CSV-Werte geführt; echte APIs
            kommen erst nach technischer und rechtlicher Prüfung.
          </p>
          {contactsError ? (
            <p className={dashboardStyles.error}>
              <strong>Kontakt-Signale konnten nicht vollständig geladen werden.</strong>
              <span>{contactsError}</span>
            </p>
          ) : null}
          <div className={dashboardStyles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Kanal</th>
                  <th>Quelle</th>
                  <th>Reichweite</th>
                  <th>Impressions</th>
                  <th>Engagement</th>
                  <th>Kommentare</th>
                  <th>Neue Kontakte</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {REACH_CHANNELS.map((row) => (
                  <tr key={row.channel}>
                    <td>
                      <strong className={dashboardStyles.contactName}>{row.channel}</strong>
                      <p className={dashboardStyles.moduleText}>{row.note}</p>
                    </td>
                    <td>{row.source}</td>
                    <td>{formatNumber(row.reach)}</td>
                    <td>{formatNumber(row.impressions)}</td>
                    <td>{formatPercent(row.engagements, row.impressions)}</td>
                    <td>{formatNumber(row.comments)}</td>
                    <td>{formatNumber(row.newContacts)}</td>
                    <td><span className={dashboardStyles.tableBadge}>{row.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={dashboardStyles.featureSection} aria-labelledby="reach-next-title">
          <div>
            <p className={dashboardStyles.eyebrow}>Nächster Ausbau</p>
            <h2 id="reach-next-title">So wird daraus echte Produktlogik</h2>
            <p>
              Reichweite wird als Entscheidungshelfer gebaut: erst sauber anzeigen,
              dann mit Kontakten, Memory und Follow-ups verbinden, danach APIs prüfen.
            </p>
          </div>
          <div className={dashboardStyles.featurePillGrid}>
            <article className={dashboardStyles.featurePill}>
              <div>
                <h3>1. CSV-Metriken</h3>
                <p>Datum, Kanal, Kampagne, Reichweite, Impressions, Engagements, Kommentare.</p>
              </div>
              <span>Jetzt</span>
            </article>
            <article className={dashboardStyles.featurePill}>
              <div>
                <h3>2. FanMind-Signale</h3>
                <p>Neue Kontakte, warme Leads, offene Kommentare und passende Follow-ups.</p>
              </div>
              <span>MVP</span>
            </article>
            <article className={dashboardStyles.featurePill}>
              <div>
                <h3>3. API-Prüfung</h3>
                <p>Instagram, TikTok, X/Twitter und Discord nur über erlaubte Schnittstellen.</p>
              </div>
              <span>Später</span>
            </article>
          </div>
        </section>
      </section>
    </WorkspaceShell>
  );
}

export default async function ReachPage() {
  const { data, error: userError } = await getSupabaseServerUser();

  if (!data.user) {
    redirect("/login");
  }

  const workspaceResult = await getUserWorkspaceDashboard(data.user);
  if (workspaceResult.error?.message === "TEMPORARY_DEMO_DELETED") {
    redirect("/login?demo_deleted=1");
  }

  const workspace = workspaceResult.workspace;
  const preActivationRedirect = getPreActivationRedirect(workspace, data.user.email);
  if (preActivationRedirect) redirect(preActivationRedirect);

  if (!isPlatformAdminEmail(data.user.email)) {
    return (
      <main className={dashboardStyles.page}>
        <section className={dashboardStyles.fallbackCard} aria-label="Reach Intelligence">
          <div>
            <p className={dashboardStyles.eyebrow}>Späteres Modul</p>
            <h1>Reach Intelligence kommt später</h1>
            <p>Die Reichweitenanalyse ist nicht Teil der aktiven Starter-Funktionen und wird im Nutzerbereich aktuell nicht prominent angezeigt.</p>
          </div>
          <div className={dashboardStyles.emptyActions}>
            <Link className={dashboardStyles.primaryButton} href="/dashboard">Zum Dashboard</Link>
            <Link className={dashboardStyles.secondaryButton} href="/roadmap">Roadmap ansehen</Link>
          </div>
        </section>
      </main>
    );
  }
  const contactsResult = workspace
    ? await getWorkspaceContacts(workspace.id)
    : null;
  const openFollowupCountResult = workspace
    ? await getOpenFollowupCount(workspace.id)
    : null;

  return (
    <main className={dashboardStyles.page}>
      {workspace ? (
        <ReachWorkspace
          workspace={workspace}
          userDisplayName={getUserDisplayName(
            data.user.user_metadata,
            workspace.name,
          )}
          contacts={contactsResult?.contacts ?? []}
          contactsError={contactsResult?.error?.message}
          openFollowupCount={openFollowupCountResult?.count ?? 0}
          userEmail={data.user.email}
        />
      ) : (
        <section
          className={dashboardStyles.fallbackCard}
          aria-label="FanMind Reichweiten-Auswertung"
        >
          <div>
            <p className={dashboardStyles.eyebrow}>FanMind Reichweite</p>
            <h1>Workspace-Status</h1>
            <p>
              Reichweiten-Auswertung ist geschützt: Supabase Auth ist aktiv. Für
              deinen Account wurde noch kein Workspace gefunden.
            </p>
          </div>
          {userError ? (
            <p className={dashboardStyles.error}>
              <strong>Supabase-Session konnte nicht vollständig geprüft werden.</strong>
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
