export class WorkspaceAuthorizationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "WorkspaceAuthorizationError";
    this.code = code;
  }
}

export function assertWorkspaceId(value, label = "workspace_id") {
  if (typeof value !== "string" || !value.trim()) {
    throw new WorkspaceAuthorizationError(
      `${label} fehlt; workspace-gescopter Zugriff wurde abgebrochen.`,
      "workspace_missing",
    );
  }
}

export function assertResourceInWorkspace(
  resource,
  workspaceId,
  resourceLabel = "Ressource",
) {
  assertWorkspaceId(workspaceId);
  if (!resource || resource.workspace_id !== workspaceId) {
    throw new WorkspaceAuthorizationError(
      `${resourceLabel} wurde im autorisierten Workspace nicht gefunden.`,
      "resource_forbidden",
    );
  }
}
