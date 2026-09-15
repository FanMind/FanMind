import {
  getSupabaseServerUser,
  getUserWorkspaceDashboard,
  getUserWorkspaceMembershipDashboard,
  getWorkspaceContact,
  type ContactRow,
  type SupabaseServerUser,
  type WorkspaceDashboardRow,
} from "@/lib/supabase/server";
import {
  assertResourceInWorkspace,
  assertWorkspaceId,
  WorkspaceAuthorizationError,
} from "@/lib/workspaceAuthorizationPolicy.mjs";
import { evaluateWorkspaceProcessingEntitlement } from "@/lib/workspaceProcessingPolicy.mjs";
import { isAdminCrmAccessWorkspace } from "@/lib/adminCrmAccessPolicy.mjs";

export {
  assertResourceInWorkspace,
  assertWorkspaceId,
  WorkspaceAuthorizationError,
} from "@/lib/workspaceAuthorizationPolicy.mjs";

export type AuthorizedWorkspaceContext = {
  user: SupabaseServerUser;
  workspace: WorkspaceDashboardRow;
};

export async function getUserAuthorizedWorkspaceDashboard(
  user: SupabaseServerUser,
  accessToken?: string,
) {
  const ownerWorkspaceResult = await getUserWorkspaceDashboard(
    user,
    accessToken,
  );
  if (
    ownerWorkspaceResult.workspace ||
    ownerWorkspaceResult.error?.message === "TEMPORARY_DEMO_DELETED"
  ) {
    return ownerWorkspaceResult;
  }
  return getUserWorkspaceMembershipDashboard(user, accessToken);
}

function workspaceUnavailableMessage(error: Error | null | undefined): string {
  return error?.message === "TEMPORARY_DEMO_DELETED"
    ? "TEMPORARY_DEMO_DELETED"
    : "Kein autorisierter Workspace gefunden.";
}

function assertAdminCrmReadAccess(workspace: WorkspaceDashboardRow): void {
  if (
    isAdminCrmAccessWorkspace(workspace) &&
    !evaluateWorkspaceProcessingEntitlement(workspace).allowed
  ) {
    throw new WorkspaceAuthorizationError(
      "Der kostenlose CRM-Zugang ist abgelaufen oder wurde gesperrt.",
      "workspace_inactive",
    );
  }
}

export async function getAuthorizedWorkspaceForCurrentUser(
  accessToken?: string,
): Promise<AuthorizedWorkspaceContext | null> {
  const { data, error } = await getSupabaseServerUser(accessToken);
  if (error || !data.user) return null;

  const workspaceResult = await getUserAuthorizedWorkspaceDashboard(
    data.user,
    accessToken,
  );
  if (!workspaceResult.workspace) return null;

  assertAdminCrmReadAccess(workspaceResult.workspace);

  return { user: data.user, workspace: workspaceResult.workspace };
}

export async function requireAuthorizedWorkspace(
  accessToken?: string,
): Promise<AuthorizedWorkspaceContext> {
  const { data } = await getSupabaseServerUser(accessToken);
  if (!data.user) {
    throw new WorkspaceAuthorizationError(
      "Keine aktive User-Session gefunden.",
      "unauthenticated",
    );
  }

  const workspaceResult = await getUserWorkspaceDashboard(data.user, accessToken);
  if (!workspaceResult.workspace) {
    throw new WorkspaceAuthorizationError(
      workspaceUnavailableMessage(workspaceResult.error),
      "workspace_missing",
    );
  }

  assertWorkspaceId(workspaceResult.workspace.id);
  assertAdminCrmReadAccess(workspaceResult.workspace);
  return { user: data.user, workspace: workspaceResult.workspace };
}

export async function requireAuthorizedWorkspaceMember(
  accessToken?: string,
): Promise<AuthorizedWorkspaceContext> {
  const { data } = await getSupabaseServerUser(accessToken);
  if (!data.user) {
    throw new WorkspaceAuthorizationError(
      "Keine aktive User-Session gefunden.",
      "unauthenticated",
    );
  }

  const ownerWorkspaceResult = await getUserWorkspaceDashboard(
    data.user,
    accessToken,
  );
  if (ownerWorkspaceResult.workspace) {
    assertWorkspaceId(ownerWorkspaceResult.workspace.id);
    assertAdminCrmReadAccess(ownerWorkspaceResult.workspace);
    return { user: data.user, workspace: ownerWorkspaceResult.workspace };
  }
  if (ownerWorkspaceResult.error?.message === "TEMPORARY_DEMO_DELETED") {
    throw new WorkspaceAuthorizationError(
      "TEMPORARY_DEMO_DELETED",
      "workspace_missing",
    );
  }

  const memberWorkspaceResult = await getUserWorkspaceMembershipDashboard(
    data.user,
    accessToken,
  );
  if (!memberWorkspaceResult.workspace) {
    throw new WorkspaceAuthorizationError(
      workspaceUnavailableMessage(
        memberWorkspaceResult.error ?? ownerWorkspaceResult.error,
      ),
      "workspace_missing",
    );
  }

  assertWorkspaceId(memberWorkspaceResult.workspace.id);
  return { user: data.user, workspace: memberWorkspaceResult.workspace };
}

export async function requireActiveAuthorizedWorkspaceMember(
  accessToken?: string,
): Promise<AuthorizedWorkspaceContext> {
  const context = await requireAuthorizedWorkspaceMember(accessToken);
  if (context.workspace.role.trim().toLowerCase() !== "owner") {
    throw new WorkspaceAuthorizationError(
      "Schreibaktionen für Teammitglieder bleiben bis zu einem atomaren Datenbankvertrag deaktiviert.",
      "workspace_member_mutations_disabled",
    );
  }
  const processing = evaluateWorkspaceProcessingEntitlement(
    context.workspace,
  );
  if (!processing.allowed) {
    throw new WorkspaceAuthorizationError(
      "Der Workspace ist derzeit nur lesbar oder für Verarbeitung pausiert.",
      "workspace_inactive",
    );
  }
  return context;
}

export async function requireActiveAuthorizedWorkspace(
  accessToken?: string,
): Promise<AuthorizedWorkspaceContext> {
  const context = await requireAuthorizedWorkspace(accessToken);
  const processing = evaluateWorkspaceProcessingEntitlement(
    context.workspace,
  );
  if (!processing.allowed) {
    throw new WorkspaceAuthorizationError(
      "Der Workspace ist derzeit nur lesbar oder für Verarbeitung pausiert.",
      "workspace_inactive",
    );
  }
  return context;
}

export async function requireContactInAuthorizedWorkspace(
  contactId: string,
  accessToken?: string,
): Promise<AuthorizedWorkspaceContext & { contact: ContactRow }> {
  const context = await requireAuthorizedWorkspace(accessToken);
  const contactResult = await getWorkspaceContact(
    context.workspace.id,
    contactId,
    accessToken,
  );
  if (contactResult.error) {
    throw new WorkspaceAuthorizationError(
      "Kontakt konnte nicht autorisiert geladen werden.",
      "resource_forbidden",
    );
  }
  assertResourceInWorkspace(contactResult.contact, context.workspace.id, "Kontakt");
  return { ...context, contact: contactResult.contact as ContactRow };
}

export async function requireContactInActiveAuthorizedWorkspace(
  contactId: string,
  accessToken?: string,
): Promise<AuthorizedWorkspaceContext & { contact: ContactRow }> {
  const context = await requireActiveAuthorizedWorkspace(accessToken);
  const contactResult = await getWorkspaceContact(
    context.workspace.id,
    contactId,
    accessToken,
  );
  if (contactResult.error) {
    throw new WorkspaceAuthorizationError(
      "Kontakt konnte nicht autorisiert geladen werden.",
      "resource_forbidden",
    );
  }
  assertResourceInWorkspace(contactResult.contact, context.workspace.id, "Kontakt");
  return { ...context, contact: contactResult.contact as ContactRow };
}

export async function requireContactInAuthorizedWorkspaceMember(
  contactId: string,
  accessToken?: string,
): Promise<AuthorizedWorkspaceContext & { contact: ContactRow }> {
  const context = await requireAuthorizedWorkspaceMember(accessToken);
  const contactResult = await getWorkspaceContact(
    context.workspace.id,
    contactId,
    accessToken,
  );
  if (contactResult.error) {
    throw new WorkspaceAuthorizationError(
      "Kontakt konnte nicht autorisiert geladen werden.",
      "resource_forbidden",
    );
  }
  assertResourceInWorkspace(contactResult.contact, context.workspace.id, "Kontakt");
  return { ...context, contact: contactResult.contact as ContactRow };
}

export async function requireContactInActiveAuthorizedWorkspaceMember(
  contactId: string,
  accessToken?: string,
): Promise<AuthorizedWorkspaceContext & { contact: ContactRow }> {
  const context = await requireActiveAuthorizedWorkspaceMember(accessToken);
  const contactResult = await getWorkspaceContact(
    context.workspace.id,
    contactId,
    accessToken,
  );
  if (contactResult.error) {
    throw new WorkspaceAuthorizationError(
      "Kontakt konnte nicht autorisiert geladen werden.",
      "resource_forbidden",
    );
  }
  assertResourceInWorkspace(contactResult.contact, context.workspace.id, "Kontakt");
  return { ...context, contact: contactResult.contact as ContactRow };
}

export function requireResourceInAuthorizedWorkspace<
  T extends { workspace_id?: string | null },
>(
  resource: T | null | undefined,
  workspaceId: string,
  resourceLabel?: string,
): T {
  assertResourceInWorkspace(resource, workspaceId, resourceLabel);
  return resource as T;
}
