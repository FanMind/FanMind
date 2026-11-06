export type WorkspaceAuthorizationErrorCode =
  | "unauthenticated"
  | "workspace_missing"
  | "resource_forbidden"
  | "workspace_inactive"
  | "workspace_member_mutations_disabled";

export class WorkspaceAuthorizationError extends Error {
  constructor(message: string, code: WorkspaceAuthorizationErrorCode);
  readonly code: WorkspaceAuthorizationErrorCode;
}

export function assertWorkspaceId(
  value: string | null | undefined,
  label?: string,
): asserts value is string;

export function assertResourceInWorkspace(
  resource: { workspace_id?: string | null } | null | undefined,
  workspaceId: string,
  resourceLabel?: string,
): void;
