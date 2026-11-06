import { redirect } from "next/navigation";
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
import { PlatformLogo } from "@/components/PlatformLogo";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { getWorkspaceNavigationForUser } from "@/lib/workspaceNavigation";
import { getWorkspaceKpiStatsFromContacts } from "@/lib/workspaceKpiStats";
import dashboardStyles from "../dashboard/dashboard.module.css";
import { TopFanToggleForm } from "../fans/TopFanToggleForm";

type TopFansWorkspaceProps = {
  workspace: WorkspaceDashboardRow;
  userDisplayName: string;
  contacts: ContactRow[];
  contactsError?: string;
  openFollowupCount: number;
  userEmail: string | null | undefined;
};

const sourceLabels: Record<string, string> = {
  manual: "Manuell",
  instagram: "Instagram (manuell)",
  tiktok: "TikTok (manuell)",
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

function formatSource(value: string | null): string {
  return sourceLabels[value ?? ""] ?? value ?? "Manuell";
}

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function TopFansList({ contacts }: { contacts: ContactRow[] }) {
  if (!contacts.length) {
    return (
      <div className={dashboardStyles.emptyState}>
        <strong>Noch keine Top Fans markiert.</strong>
        <p>
          Markiere Kontakte manuell als Top Fan. FanMind zeigt hier kein
          automatisches Scoring und kein Ranking.
        </p>
      </div>
    );
  }

  return (
    <div className={dashboardStyles.tableWrap}>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Quelle/Kanal</th>
            <th>Status</th>
            <th>Markierung</th>
            <th>Tags</th>
            <th>Erstellt am</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => (
            <tr key={contact.id}>
              <td>
                <strong className={dashboardStyles.contactName}>
                  {contact.display_name}
                </strong>
                {contact.handle ? <span> · {contact.handle}</span> : null}
              </td>
              <td>
                <span className={dashboardStyles.sourceChip}>
                  <PlatformLogo platform={contact.source_platform} size="sm" />
                  {formatSource(contact.source_platform)}
                </span>
              </td>
              <td>{contact.status ?? "Neu"}</td>
              <td>
                <span className={dashboardStyles.sourceChip}>Top Fan</span>
                <TopFanToggleForm
                  compact
                  contactId={contact.id}
                  isTopFan={contact.is_top_fan}
                  returnTo="/top-fans#top-fans-list"
                />
              </td>
              <td>
                {contact.tags?.length ? (
                  <span className={dashboardStyles.tagList}>
                    {contact.tags.map((tag) => (
                      <span key={`${contact.id}-${tag}`}>{tag}</span>
                    ))}
                  </span>
                ) : (
                  "Keine Tags"
                )}
              </td>
              <td>{formatDate(contact.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopFansWorkspace({
  workspace,
  userDisplayName,
  contacts,
  contactsError,
  openFollowupCount,
  userEmail,
}: TopFansWorkspaceProps) {
  const { mainNavigation, settingsNavigation, savedViews } =
    getWorkspaceNavigationForUser(
      "top-fans",
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
      planStatus="MVP"
      mainNavigation={mainNavigation}
      settingsNavigation={settingsNavigation}
      savedViews={savedViews}
      header={{
        title: "Top Fans",
        subtitle: "Willkommen zurück, Pilot Test 👋",
        searchPlaceholder: "Suche nach Name, Tag, Kanal, Sprache ...",
        primaryActionLabel: "MVP-Vorschau",
        primaryActionHref: "#top-fans-list",
      }}
      contactCount={getWorkspaceKpiStatsFromContacts(contacts).totalFans}
      openFollowupCount={openFollowupCount}
      logoutAction={logout}
    >
      <section
        className={dashboardStyles.moduleCard}
        id="top-fans-list"
        aria-labelledby="top-fans-title"
      >
        <div className={dashboardStyles.moduleHeader}>
          <div>
            <p className={dashboardStyles.eyebrow}>Gespeicherte Ansicht</p>
            <h2 id="top-fans-title">Top Fans</h2>
          </div>
          <span>{contacts.length ? "Echte Daten" : "MVP-Vorschau"}</span>
        </div>
        <p className={dashboardStyles.moduleText}>
          Diese MVP-Ansicht zeigt ausschließlich manuell markierte Kontakte aus
          dem aktuellen Workspace. Eine Scoring- oder Ranking-Logik wird nicht
          vorgetäuscht.
        </p>
        {contactsError ? (
          <p className={dashboardStyles.error}>
            <strong>Kontakte konnten nicht geladen werden.</strong>
            <span>{contactsError}</span>
          </p>
        ) : null}
        <TopFansList contacts={contacts} />
      </section>
    </WorkspaceShell>
  );
}

export default async function TopFansPage() {
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
  const topFanContacts = (contactsResult?.contacts ?? []).filter((contact) =>
    Boolean(contact.is_top_fan),
  );
  const openFollowupCountResult = workspace
    ? await getOpenFollowupCount(workspace.id)
    : null;

  return (
    <main className={dashboardStyles.page}>
      {workspace ? (
        <TopFansWorkspace
          workspace={workspace}
          userDisplayName={getUserDisplayName(
            data.user.user_metadata,
            workspace.name,
          )}
          contacts={topFanContacts}
          openFollowupCount={openFollowupCountResult?.count ?? 0}
          userEmail={data.user.email}
          contactsError={contactsResult?.error?.message}
        />
      ) : (
        <section
          className={dashboardStyles.fallbackCard}
          aria-label="FanMind Top Fans"
        >
          <div>
            <p className={dashboardStyles.eyebrow}>FanMind Top Fans</p>
            <h1>Workspace-Status</h1>
            <p>
              Top Fans ist geschützt: Supabase Auth ist aktiv. Für deinen
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
