import { redirect } from "next/navigation";
import { getPreActivationRedirect } from "@/lib/preActivation";
import {
  getOpenFollowupCount,
  getSupabaseServerUser,
  getUserWorkspaceDashboard,
  getWorkspaceContacts,
  signOutSupabaseServerSession,
  type WorkspaceDashboardRow,
} from "@/lib/supabase/server";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { getWorkspaceNavigationForUser } from "@/lib/workspaceNavigation";
import { getWorkspaceKpiStatsFromContacts } from "@/lib/workspaceKpiStats";
import dashboardStyles from "../dashboard/dashboard.module.css";

type ReactivationWorkspaceProps = {
  workspace: WorkspaceDashboardRow;
  userDisplayName: string;
  contactCount: number;
  openFollowupCount: number;
  userEmail: string | null | undefined;
};

async function logout() {
  "use server";

  await signOutSupabaseServerSession();
  redirect("/");
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

function ReactivationWorkspace({
  workspace,
  userDisplayName,
  contactCount,
  openFollowupCount,
  userEmail,
}: ReactivationWorkspaceProps) {
  const { mainNavigation, settingsNavigation, savedViews } =
    getWorkspaceNavigationForUser(
      "reactivation",
      userEmail,
      "de",
      0,
      workspace.role,
    );
  const userLabel = userDisplayName || workspace.name || "Nutzer";

  return (
    <WorkspaceShell
      workspaceName={workspace.name}
      userLabel={userLabel}
      planLabel={workspace.plan_id}
      planMeta={workspace.role}
      planStatus="Roadmap"
      mainNavigation={mainNavigation}
      settingsNavigation={settingsNavigation}
      savedViews={savedViews}
      header={{
        title: "Reaktivierung",
        subtitle: "Vorbereitete Roadmap-Ansicht für manuelle Rückgewinnung",
        searchPlaceholder: "Suche nach Name, Tag, Status ...",
        primaryActionLabel: "Roadmap",
        primaryActionHref: "#reactivation-preview",
      }}
      contactCount={contactCount}
      openFollowupCount={openFollowupCount}
      logoutAction={logout}
    >
      <section
        className={dashboardStyles.moduleCard}
        id="reactivation-preview"
        aria-labelledby="reactivation-title"
      >
        <div className={dashboardStyles.moduleHeader}>
          <div>
            <p className={dashboardStyles.eyebrow}>Roadmap</p>
            <h2 id="reactivation-title">Reaktivierung vorbereiten</h2>
          </div>
          <span>Coming Soon</span>
        </div>
        <p className={dashboardStyles.moduleText}>
          Die Reaktivierungslogik ist noch nicht produktiv aktiv. Geplant sind
          nachvollziehbare Hinweise auf länger inaktive Kontakte sowie manuell
          geprüfte nächste Schritte. FanMind sendet dabei niemals automatisch.
        </p>
        <div className={dashboardStyles.emptyState}>
          <strong>Noch keine Reaktivierungsfälle aktiv.</strong>
          <p>
            Diese Ansicht zeigt bewusst keine erfundenen Fälle und startet keine
            automatische Kontaktaufnahme. Bis zur Freigabe bleibt sie eine klar
            gekennzeichnete Roadmap-Vorschau.
          </p>
        </div>
      </section>
    </WorkspaceShell>
  );
}

export default async function ReactivationPage() {
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
  const contactsResult = workspace
    ? await getWorkspaceContacts(workspace.id)
    : null;
  const openFollowupCountResult = workspace
    ? await getOpenFollowupCount(workspace.id)
    : null;

  return (
    <main className={dashboardStyles.page}>
      {workspace ? (
        <ReactivationWorkspace
          workspace={workspace}
          userDisplayName={getUserDisplayName(
            data.user.user_metadata,
            workspace.name,
          )}
          contactCount={getWorkspaceKpiStatsFromContacts(contactsResult?.contacts ?? []).totalFans}
          openFollowupCount={openFollowupCountResult?.count ?? 0}
          userEmail={data.user.email}
        />
      ) : (
        <section
          className={dashboardStyles.fallbackCard}
          aria-label="FanMind Reaktivierung"
        >
          <div>
            <p className={dashboardStyles.eyebrow}>FanMind Reaktivierung</p>
            <h1>Workspace-Status</h1>
            <p>
              Reaktivierung ist geschützt: Supabase Auth ist aktiv. Für deinen
              Account wurde noch kein Workspace gefunden.
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
