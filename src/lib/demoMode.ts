import type { SupabaseServerUser, WorkspaceDashboardRow } from "@/lib/supabase/server";

export const DEMO_WORKSPACE_EMAIL = "sandra.m@fanmind.ch";
export const DEMO_WORKSPACE_NAME = "Sandra M. Demo Workspace";
export const TEMPORARY_DEMO_WORKSPACE_NAME = "FanMind Demo Workspace";
const LEGACY_TEMPORARY_DEMO_WORKSPACE_NAME = "Temporary FanMind Demo";

export function isTemporaryDemoUser(user: Pick<SupabaseServerUser, "user_metadata"> | null | undefined): boolean {
  return user?.user_metadata?.fanmind_demo === true && user.user_metadata.demo_type === "temporary";
}

export function isExplicitDemoWorkspace(workspace: { name?: string | null } | null | undefined): boolean {
  const workspaceName = (workspace?.name ?? "").trim();
  return (
    workspaceName === DEMO_WORKSPACE_NAME ||
    workspaceName === TEMPORARY_DEMO_WORKSPACE_NAME ||
    workspaceName === LEGACY_TEMPORARY_DEMO_WORKSPACE_NAME
  );
}

export function isDemoWorkspace(workspace: {
  billing_status?: string | null;
  name?: string | null;
  test_access_flags?: Record<string, unknown> | null;
} | null | undefined): boolean {
  return (
    workspace?.billing_status === "demo_free" &&
    workspace.test_access_flags?.admin_crm_access !== true
  );
}

export function isPublicDemoWorkspace({
  userEmail,
  workspaceBillingStatus,
  workspaceTestAccessFlags,
  user,
}: {
  userEmail?: string | null;
  workspaceBillingStatus?: string | null;
  workspaceTestAccessFlags?: Record<string, unknown> | null;
  user?: Pick<SupabaseServerUser, "user_metadata"> | null;
}): boolean {
  return (
    (userEmail ?? "").trim().toLowerCase() === DEMO_WORKSPACE_EMAIL ||
    isDemoWorkspace({
      billing_status: workspaceBillingStatus,
      test_access_flags: workspaceTestAccessFlags,
    }) ||
    isTemporaryDemoUser(user)
  );
}

export function areDemoConnectionsDisabled(
  user: Pick<SupabaseServerUser, "email" | "user_metadata"> | null | undefined,
  workspace:
    | Pick<WorkspaceDashboardRow, "name" | "billing_status" | "test_access_flags">
    | null
    | undefined,
): boolean {
  return isPublicDemoWorkspace({
    userEmail: user?.email,
    workspaceBillingStatus: workspace?.billing_status,
    workspaceTestAccessFlags: workspace?.test_access_flags,
    user,
  });
}


export type TemporaryDemoExpiryState =
  | { isTemporaryDemo: false; isExpired: false; expiresAt: null }
  | { isTemporaryDemo: true; isExpired: boolean; expiresAt: Date };

export function getTemporaryDemoExpiryState(
  user: Pick<SupabaseServerUser, "user_metadata"> | null | undefined,
  now = new Date(),
): TemporaryDemoExpiryState {
  if (!isTemporaryDemoUser(user)) {
    return { isTemporaryDemo: false, isExpired: false, expiresAt: null };
  }

  const rawExpiresAt = user?.user_metadata?.demo_expires_at;
  if (typeof rawExpiresAt !== "string") {
    return { isTemporaryDemo: true, isExpired: true, expiresAt: new Date(0) };
  }

  const expiresAt = new Date(rawExpiresAt);
  if (Number.isNaN(expiresAt.getTime())) {
    return { isTemporaryDemo: true, isExpired: true, expiresAt: new Date(0) };
  }

  return { isTemporaryDemo: true, isExpired: expiresAt <= now, expiresAt };
}
