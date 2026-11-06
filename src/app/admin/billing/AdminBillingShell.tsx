import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { AdminNotificationsBell } from "@/app/admin/operations/AdminNotificationsBell";
import { isPlatformAdminEmail } from "@/lib/admin";
import { getCommercialOptionLabel } from "@/lib/dashboardFeatures";
import {
  getRecentAdminNotifications,
  getUnreadAdminNotificationCount,
} from "@/lib/operations";
import {
  getOpenFollowupCount,
  getUserWorkspaceDashboard,
  getWorkspaceContacts,
  signOutSupabaseServerSession,
  type SupabaseServerUser,
} from "@/lib/supabase/server";
import { getWorkspaceKpiStatsFromContacts } from "@/lib/workspaceKpiStats";
import { getWorkspaceNavigation } from "@/lib/workspaceNavigation";

async function logout() {
  "use server";

  await signOutSupabaseServerSession();
  redirect("/");
}

function displayName(user: SupabaseServerUser, fallback: string): string {
  const metadata = user.user_metadata;
  const value = metadata?.display_name ?? metadata?.full_name;
  return typeof value === "string" && value.trim()
    ? value.trim()
    : user.email ?? fallback;
}

function planLabel(planId: string | null): string {
  if (planId === "pilot") return "Interne Demo / Legacy";
  if (planId === "starter") return "Starter";
  if (planId === "growth") return "Growth";
  if (planId === "agency") return "Agency";
  return planId ?? "Workspace";
}

export async function AdminBillingShell({
  user,
  title,
  subtitle,
  children,
}: {
  user: SupabaseServerUser;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const workspaceResult = await getUserWorkspaceDashboard(user);
  const workspace = workspaceResult.workspace;

  const [contactsResult, openFollowupCountResult, notificationResult, unreadResult] =
    await Promise.all([
      workspace ? getWorkspaceContacts(workspace.id) : Promise.resolve(null),
      workspace ? getOpenFollowupCount(workspace.id) : Promise.resolve(null),
      getRecentAdminNotifications(8),
      getUnreadAdminNotificationCount(),
    ]);

  const { mainNavigation, settingsNavigation, savedViews } = getWorkspaceNavigation(
    "admin",
    "de",
    0,
    isPlatformAdminEmail(user.email),
  );

  return (
    <WorkspaceShell
      workspaceName={workspace?.name ?? "FanMind Admin"}
      userLabel={displayName(user, workspace?.name ?? "Admin")}
      planLabel={planLabel(workspace?.plan_id ?? null)}
      planMeta={
        workspace
          ? getCommercialOptionLabel(workspace.commercial_option)
          : "Interner Bereich"
      }
      planStatus="Admin"
      mainNavigation={mainNavigation}
      settingsNavigation={settingsNavigation}
      savedViews={savedViews}
      header={{
        title,
        subtitle,
        searchPlaceholder: "Suche nach Workspace, Rechnung, Status ...",
        primaryActionLabel: "Billing öffnen",
        primaryActionHref: "/admin/billing",
        operationsWidget: isPlatformAdminEmail(user.email) ? (
          <AdminNotificationsBell
            initialItems={notificationResult.data ?? []}
            initialUnread={unreadResult.count}
          />
        ) : undefined,
      }}
      contactCount={
        getWorkspaceKpiStatsFromContacts(contactsResult?.contacts ?? []).totalFans
      }
      openFollowupCount={openFollowupCountResult?.count ?? 0}
      showStats={false}
      logoutAction={logout}
    >
      {children}
    </WorkspaceShell>
  );
}
