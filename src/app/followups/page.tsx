import Link from "next/link";
import { redirect } from "next/navigation";
import { getPreActivationRedirect } from "@/lib/preActivation";
import {
  getOpenFollowupCount,
  getSupabaseServerUser,
  getWorkspaceContacts,
  getWorkspaceFollowups,
  getWorkspaceOpenFollowups,
  signOutSupabaseServerSession,
  type ContactRow,
  type FollowupRow,
  type WorkspaceDashboardRow,
} from "@/lib/supabase/server";
import { getUserAuthorizedWorkspaceDashboard } from "@/lib/workspaceAuthorization";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { getWorkspaceNavigationForUser } from "@/lib/workspaceNavigation";
import { resolveWorkspaceLocale } from "@/lib/workspaceLocale";
import { wt } from "@/lib/workspaceCopy";
import type { FanMindLanguage } from "@/lib/fanmindCopy";
import { getWorkspaceKpiStatsFromContacts } from "@/lib/workspaceKpiStats";
import dashboardStyles from "../dashboard/dashboard.module.css";
import { FollowupStatusForm } from "./FollowupStatusForm";

type FollowupsPageProps = {
  searchParams?: Promise<{ status?: string | string[]; notice?: string | string[]; lang?: string | string[] }>;
};

async function logout() {
  "use server";
  await signOutSupabaseServerSession();
  redirect("/");
}

export default async function FollowupsPage({ searchParams }: FollowupsPageProps) {
  const params = await searchParams;
  const requestedStatus = getSingleParam(params?.status);
  const status = requestedStatus === "done" || requestedStatus === "completed" ? "completed" : "open";
  const { data } = await getSupabaseServerUser();

  if (!data.user) redirect("/login");

  const workspaceResult = await getUserAuthorizedWorkspaceDashboard(data.user);
  if (workspaceResult.error?.message === "TEMPORARY_DEMO_DELETED") {
    redirect("/login?demo_deleted=1");
  }

  const workspace = workspaceResult.workspace;
  const preActivationRedirect = getPreActivationRedirect(workspace, data.user.email);
  if (preActivationRedirect) redirect(preActivationRedirect);
  if (!workspace) redirect("/login");

  const locale = await resolveWorkspaceLocale({ lang: getSingleParam(params?.lang), user: data.user });
  const [
    contactsResult,
    followupsResult,
    openFollowupsResult,
    openFollowupCountResult,
  ] = await Promise.all([
    getWorkspaceContacts(workspace.id),
    getWorkspaceFollowups(workspace.id, status),
    getWorkspaceOpenFollowups(workspace.id),
    getOpenFollowupCount(workspace.id),
  ]);

  return (
    <main className={dashboardStyles.page}>
      <FollowupsWorkspace
        workspace={workspace}
        locale={locale}
        userDisplayName={getUserDisplayName(data.user.user_metadata, workspace.name)}
        contacts={contactsResult.contacts}
        contactsError={contactsResult.error?.message}
        followups={followupsResult.followups}
        followupsError={followupsResult.error?.message}
        openFollowupCount={openFollowupCountResult.count}
        dueFollowupCount={countDueOrOverdueOpenFollowups(openFollowupsResult.followups)}
        activeStatus={status}
        notice={getSingleParam(params?.notice)}
        userEmail={data.user.email}
      />
    </main>
  );
}

function countDueOrOverdueOpenFollowups(followups: FollowupRow[]): number {
  const today = new Date().toISOString().slice(0, 10);

  return followups.filter(
    (followup) => followup.status === "open" && followup.due_date && followup.due_date <= today,
  ).length;
}

function FollowupsWorkspace({
  workspace,
  locale,
  userDisplayName,
  contacts,
  contactsError,
  followups,
  followupsError,
  openFollowupCount,
  dueFollowupCount,
  activeStatus,
  notice,
  userEmail,
}: {
  workspace: WorkspaceDashboardRow;
  locale: FanMindLanguage;
  userDisplayName: string;
  contacts: ContactRow[];
  contactsError?: string;
  followups: FollowupRow[];
  followupsError?: string;
  openFollowupCount: number;
  dueFollowupCount: number;
  activeStatus: "open" | "completed";
  notice?: string;
  userEmail: string | null | undefined;
}) {
  const memberReadOnly = workspace.role.trim().toLowerCase() !== "owner";
  const { mainNavigation, settingsNavigation, savedViews } =
    getWorkspaceNavigationForUser(
      "followups",
      userEmail,
      locale,
      dueFollowupCount,
      workspace.role,
    );
  const contactsById = new Map(contacts.map((contact) => [contact.id, contact]));

  return (
    <WorkspaceShell
      workspaceName={workspace.name}
      userLabel={userDisplayName || workspace.name || (locale === "en" ? "User" : "Nutzer")}
      planLabel={workspace.plan_id}
      planMeta={workspace.role}
      planStatus={wt(locale, "Aktiv")}
      mainNavigation={mainNavigation}
      settingsNavigation={settingsNavigation}
      savedViews={savedViews}
      header={{
        title: "Follow-ups",
        subtitle: locale === "en" ? "Manual tasks and replies that are still open." : "Manuelle Aufgaben und Rückmeldungen, die noch offen sind.",
        searchPlaceholder: locale === "en" ? "Search follow-ups ..." : "Follow-ups suchen ...",
        primaryActionLabel: wt(locale, "Zur Fanliste"),
        primaryActionHref: "/fans#fans-list",
      }}
      contactCount={getWorkspaceKpiStatsFromContacts(contacts).totalFans}
      openFollowupCount={openFollowupCount}
      logoutAction={logout}
      locale={locale}
    >
      <section className={dashboardStyles.moduleCard}>
        <div className={dashboardStyles.moduleHeader}>
          <div>
            <p className={dashboardStyles.eyebrow}>{locale === "en" ? "Manual tasks" : "Manuelle Aufgaben"}</p>
            <h2>{activeStatus === "completed" ? (locale === "en" ? "Done" : "Erledigt") : (locale === "en" ? "Open" : "Offen")}</h2>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link className={dashboardStyles.secondaryButton} href="/followups?status=open">{locale === "en" ? "Open" : "Offen"}</Link>
            <Link className={dashboardStyles.secondaryButton} href="/followups?status=done">{locale === "en" ? "Done" : "Erledigt"}</Link>
          </div>
        </div>
        {contactsError ? <p className={dashboardStyles.error}><strong>{contactsError}</strong></p> : null}
        {memberReadOnly ? (
          <p style={{ border: "1px solid #bae6fd", borderRadius: 12, padding: "10px 12px", color: "#075985", background: "#f0f9ff" }} role="status">
            <strong>{locale === "en" ? "Read-only team access." : "Teamzugang im Nur-Lese-Modus."}</strong>{" "}
            {locale === "en" ? "Only the workspace owner can complete or reopen follow-ups." : "Nur der Workspace-Owner kann Follow-ups erledigen oder wieder öffnen."}
          </p>
        ) : null}
        {notice ? <p style={{ border: "1px solid #86efac", borderRadius: 12, padding: "10px 12px", color: "#166534", background: "#f0fdf4" }}><strong>{formatFollowupNotice(notice, locale)}</strong></p> : null}
        {followupsError ? <p className={dashboardStyles.error}><strong>{followupsError}</strong></p> : null}
        {followups.length ? (
          <div style={{ overflowX: "auto" }}>
            <table className={dashboardStyles.simpleTable}>
              <thead>
                <tr>
                  <th>{locale === "en" ? "Contact" : "Kontakt"}</th>
                  <th>{locale === "en" ? "Task" : "Aufgabe"}</th>
                  <th>{locale === "en" ? "Due" : "Fällig"}</th>
                  <th>{locale === "en" ? "Priority" : "Priorität"}</th>
                  <th>Status</th>
                  <th>Link</th>
                  <th>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {followups.map((followup) => {
                  const contact = contactsById.get(followup.contact_id);
                  return (
                    <tr key={followup.id}>
                      <td>{contact?.display_name || contact?.handle || followup.contact_id}</td>
                      <td>{followup.reason}</td>
                      <td>{followup.due_date ?? "—"}</td>
                      <td>{followup.priority ?? "normal"}</td>
                      <td>{followup.status ?? "open"}</td>
                      <td><Link href={`/fans/${followup.contact_id}`}>{locale === "en" ? "Open fan" : "Fan öffnen"}</Link></td>
                      <td>
                        {memberReadOnly ? (
                          <span>{locale === "en" ? "Read-only" : "Nur Lesen"}</span>
                        ) : (
                          <FollowupStatusForm contactId={followup.contact_id} followup={followup} locale={locale} returnTo="followups" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={dashboardStyles.emptyState}>
            <strong>{locale === "en" ? "No follow-ups found." : "Keine Follow-ups gefunden."}</strong>
          </div>
        )}
      </section>
    </WorkspaceShell>
  );
}

function getSingleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function getUserDisplayName(metadata: Record<string, unknown> | undefined, fallback: string): string {
  const displayName = metadata?.display_name ?? metadata?.full_name;
  return typeof displayName === "string" && displayName.trim() ? displayName.trim() : fallback;
}


function formatFollowupNotice(value: string, locale: FanMindLanguage): string {
  if (value === "followup_completed") return locale === "en" ? "Follow-up was marked as completed." : "Follow-up wurde als erledigt markiert.";
  if (value === "followup_reopened") return locale === "en" ? "Follow-up was reopened." : "Follow-up wurde wieder geöffnet.";
  if (value === "followup_status_invalid") return locale === "en" ? "Follow-up could not be identified." : "Follow-up konnte nicht eindeutig erkannt werden.";
  if (value === "followup_status_failed") return locale === "en" ? "Follow-up could not be changed. It may have already been deleted or belongs to another workspace." : "Follow-up konnte nicht geändert werden. Es wurde möglicherweise bereits gelöscht oder gehört zu einem anderen Workspace.";
  return value;
}
