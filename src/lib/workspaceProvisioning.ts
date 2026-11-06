export const WORKSPACE_PROVISIONING_RPC =
  "ensure_current_user_workspace";

export const INTERNAL_DAILY_TEST_WORKSPACE_PROVISIONING_RPC =
  "ensure_internal_daily_test_workspace";

export const INTERNAL_DAILY_TEST_WORKSPACE_PROVISIONING_READY_RPC =
  "internal_daily_test_workspace_provisioning_ready";

// The deploy-before-migrate browser INSERT compatibility bridge is retired.
// Missing provisioning RPCs must fail closed instead of falling back to direct
// workspaces/workspace_members writes from an authenticated browser session.
export const WORKSPACE_DIRECT_INSERT_COMPATIBILITY_ENABLED = false;

export type WorkspaceProvisioningRpcRow = {
  workspace_id: string;
  created: boolean;
};

export const WORKSPACE_EXPAND_COLUMNS = [
  "payment_terms_version",
  "payment_terms_accepted_at",
  "payment_terms_accepted_by_user_id",
  "stripe_checkout_session_id",
  "stripe_payment_intent_id",
  "stripe_mandate_id",
  "billing_note",
] as const;

export function withoutWorkspaceExpandColumns<T>(
  values: Record<string, T>,
): Record<string, T> {
  const expandColumns = new Set<string>(WORKSPACE_EXPAND_COLUMNS);
  return Object.fromEntries(
    Object.entries(values).filter(([column]) => !expandColumns.has(column)),
  );
}

export function isMissingWorkspaceProvisioningRpc(
  error: Error | null | undefined,
): boolean {
  if (!WORKSPACE_DIRECT_INSERT_COMPATIBILITY_ENABLED) return false;

  const message = error?.message.toLowerCase() ?? "";

  return (
    message.includes(WORKSPACE_PROVISIONING_RPC) &&
    (message.includes("could not find the function") ||
      message.includes("pgrst202") ||
      message.includes("schema cache"))
  );
}

export function isMissingWorkspaceExpandColumn(
  error: Error | null | undefined,
): boolean {
  const message = error?.message.toLowerCase() ?? "";
  const namesKnownColumn = WORKSPACE_EXPAND_COLUMNS.some((column) =>
    message.includes(column),
  );

  return (
    namesKnownColumn &&
    message.includes("workspaces") &&
    ((message.includes("could not find") &&
      message.includes("column") &&
      message.includes("schema cache")) ||
      (message.includes("column") && message.includes("does not exist")))
  );
}
