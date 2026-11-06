export type WorkspaceAiTierStorageReason =
  | "configuration"
  | "invalid_workspace"
  | "invalid_payload"
  | "ambiguous_rows"
  | "invalid_row"
  | "upstream";

export type WorkspaceAiTierStorageResult =
  | Readonly<{
      status: "found";
      reason: null;
      entitlement: Readonly<{
        tierId: "plus" | "ultra";
        status: "active" | "pending" | "paused" | "canceled" | "expired";
        source: "stripe";
        effectiveAt: string;
        expiresAt: string | null;
        stripeSubscriptionItemLinked: true;
        serverOwned: true;
      }>;
    }>
  | Readonly<{
      status: "not_found";
      reason: null;
      entitlement: null;
    }>
  | Readonly<{
      status: "unavailable";
      reason: WorkspaceAiTierStorageReason;
      entitlement: null;
    }>;

export function isWorkspaceAiTierStorageWorkspaceId(value: unknown): boolean;
export function unavailableWorkspaceAiTierStorage(
  reason: WorkspaceAiTierStorageReason,
): WorkspaceAiTierStorageResult;
export function normalizeWorkspaceAiTierStorageRows(
  payload: unknown,
  expectedWorkspaceId: string,
): WorkspaceAiTierStorageResult;
