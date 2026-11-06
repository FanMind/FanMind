import {
  ACCOUNT_DELETION_ACTIVE_STATUSES,
  getAccountDeletionDeadline,
  publicAccountDeletionStatus,
  requiresSubscriptionResolution,
} from "@/lib/accountDeletionPolicy.mjs";
import {
  sendAccountDeletionAcknowledgement,
  sendAccountDeletionOperationsNotice,
} from "@/lib/accountDeletionNotifications";
import {
  getSupabaseApiKeyHeaders,
  getSupabaseRestUrl,
} from "@/lib/supabase/config";
import type {
  SupabaseServerUser,
  WorkspaceDashboardRow,
} from "@/lib/supabase/server";

export class AccountDeletionServiceError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "AccountDeletionServiceError";
  }
}

type AccountDeletionRequestRow = {
  id: string;
  user_id: string | null;
  workspace_id: string | null;
  notification_email: string | null;
  request_source: "web" | "mobile";
  confirmation_version: string;
  status: string;
  requires_ownership_transfer: boolean;
  requires_subscription_resolution: boolean;
  requested_at: string;
  processing_deadline_at: string;
  acknowledgement_sent_at: string | null;
  last_error_code: string | null;
};

type OwnedWorkspaceDeletionRow = {
  id: string;
  owner_user_id: string;
  billing_status: string | null;
  stripe_subscription_id: string | null;
  subscription_effective_end_at: string | null;
};

const DELETION_COLUMNS = [
  "id",
  "user_id",
  "workspace_id",
  "notification_email",
  "request_source",
  "confirmation_version",
  "status",
  "requires_ownership_transfer",
  "requires_subscription_resolution",
  "requested_at",
  "processing_deadline_at",
  "acknowledgement_sent_at",
  "last_error_code",
].join(",");

function serviceKey(): string {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!value) throw new AccountDeletionServiceError("service_role_not_configured");
  return value;
}

function serviceHeaders(prefer?: string): HeadersInit {
  const key = serviceKey();
  return {
    ...getSupabaseApiKeyHeaders(key),
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

function activeStatusFilter(): string {
  return `in.(${ACCOUNT_DELETION_ACTIVE_STATUSES.join(",")})`;
}

async function serviceFetch(
  url: string,
  init: RequestInit,
  errorCode: string,
): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!response) throw new AccountDeletionServiceError(errorCode);
  return response;
}

export async function getActiveAccountDeletionRequest(
  userId: string,
): Promise<AccountDeletionRequestRow | null> {
  const url = `${getSupabaseRestUrl("account_deletion_requests")}?select=${encodeURIComponent(
    DELETION_COLUMNS,
  )}&user_id=eq.${encodeURIComponent(userId)}&status=${encodeURIComponent(
    activeStatusFilter(),
  )}&order=requested_at.desc&limit=1`;
  const response = await serviceFetch(
    url,
    { headers: serviceHeaders() },
    "request_status_unavailable",
  );
  if (!response.ok) {
    throw new AccountDeletionServiceError("request_status_unavailable");
  }
  const rows = (await response.json().catch(() => null)) as
    | AccountDeletionRequestRow[]
    | null;
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function getOwnedWorkspaceDeletionRows(
  userId: string,
): Promise<OwnedWorkspaceDeletionRow[]> {
  const url = `${getSupabaseRestUrl(
    "workspaces",
  )}?select=id,owner_user_id,billing_status,stripe_subscription_id,subscription_effective_end_at&owner_user_id=eq.${encodeURIComponent(
    userId,
  )}&order=created_at.asc&limit=101`;
  const response = await serviceFetch(
    url,
    { headers: serviceHeaders() },
    "workspace_inventory_failed",
  );
  if (!response.ok) {
    throw new AccountDeletionServiceError("workspace_inventory_failed");
  }
  const rows = (await response.json().catch(() => null)) as
    | OwnedWorkspaceDeletionRow[]
    | null;
  if (!Array.isArray(rows)) {
    throw new AccountDeletionServiceError("workspace_inventory_failed");
  }
  if (rows.length > 100) {
    throw new AccountDeletionServiceError("workspace_inventory_too_large");
  }
  return rows;
}

async function countOtherWorkspaceMembers(
  workspaceId: string,
  userId: string,
): Promise<number> {
  const url = `${getSupabaseRestUrl(
    "workspace_members",
  )}?select=id&workspace_id=eq.${encodeURIComponent(
    workspaceId,
  )}&user_id=neq.${encodeURIComponent(userId)}`;
  const response = await serviceFetch(
    url,
    {
      method: "GET",
      headers: {
        ...serviceHeaders(),
        Prefer: "count=exact",
        Range: "0-0",
      },
    },
    "workspace_member_check_failed",
  );
  if (!response.ok) {
    throw new AccountDeletionServiceError("workspace_member_check_failed");
  }
  const contentRange = response.headers.get("content-range") ?? "";
  const total = Number(contentRange.split("/")[1]);
  if (Number.isInteger(total) && total >= 0) return total;
  const rows = (await response.json().catch(() => [])) as unknown[];
  return Array.isArray(rows) ? rows.length : 0;
}

export async function getAccountDeletionBlockers(input: {
  user: SupabaseServerUser;
}): Promise<{
  requiresOwnershipTransfer: boolean;
  requiresSubscriptionResolution: boolean;
}> {
  const ownedWorkspaces = await getOwnedWorkspaceDeletionRows(input.user.id);
  let requiresOwnershipTransfer = false;
  let subscriptionBlocked = false;

  for (const workspace of ownedWorkspaces) {
    if (!requiresOwnershipTransfer) {
      const otherMembers = await countOtherWorkspaceMembers(
        workspace.id,
        input.user.id,
      );
      requiresOwnershipTransfer = otherMembers > 0;
    }
    subscriptionBlocked ||= requiresSubscriptionResolution(workspace);
  }

  return {
    requiresOwnershipTransfer,
    requiresSubscriptionResolution: subscriptionBlocked,
  };
}

async function patchDeletionRequest(
  requestId: string,
  userId: string,
  body: Record<string, unknown>,
): Promise<AccountDeletionRequestRow | null> {
  const url = `${getSupabaseRestUrl(
    "account_deletion_requests",
  )}?id=eq.${encodeURIComponent(requestId)}&user_id=eq.${encodeURIComponent(
    userId,
  )}&select=${encodeURIComponent(DELETION_COLUMNS)}`;
  const response = await serviceFetch(
    url,
    {
      method: "PATCH",
      headers: serviceHeaders("return=representation"),
      body: JSON.stringify(body),
    },
    "request_update_failed",
  );
  if (!response.ok) throw new AccountDeletionServiceError("request_update_failed");
  const rows = (await response.json().catch(() => null)) as
    | AccountDeletionRequestRow[]
    | null;
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function eraseCancellableDeletionRequest(
  requestId: string,
  userId: string,
): Promise<boolean> {
  const url = `${getSupabaseRestUrl(
    "account_deletion_requests",
  )}?id=eq.${encodeURIComponent(requestId)}&user_id=eq.${encodeURIComponent(
    userId,
  )}&status=${encodeURIComponent("in.(pending,blocked)")}&select=id`;
  const response = await serviceFetch(
    url,
    {
      method: "DELETE",
      headers: serviceHeaders("return=representation"),
    },
    "request_update_failed",
  );
  if (!response.ok) throw new AccountDeletionServiceError("request_update_failed");
  const rows = (await response.json().catch(() => null)) as
    | Array<{ id?: string }>
    | null;
  return Boolean(Array.isArray(rows) && rows.some((row) => row.id === requestId));
}

export async function createAccountDeletionRequest(input: {
  user: SupabaseServerUser;
  workspace: WorkspaceDashboardRow | null;
  email: string;
  source: "web" | "mobile";
  confirmationVersion: string;
}): Promise<ReturnType<typeof publicAccountDeletionStatus>> {
  const existing = await getActiveAccountDeletionRequest(input.user.id);
  if (existing) return publicAccountDeletionStatus(existing);

  const blockers = await getAccountDeletionBlockers({ user: input.user });
  const requestedAt = new Date();
  const processingDeadlineAt = getAccountDeletionDeadline(requestedAt).toISOString();
  const initialStatus =
    blockers.requiresOwnershipTransfer ||
    blockers.requiresSubscriptionResolution
      ? "blocked"
      : "pending";

  const response = await serviceFetch(
    `${getSupabaseRestUrl(
      "account_deletion_requests",
    )}?select=${encodeURIComponent(DELETION_COLUMNS)}`,
    {
      method: "POST",
      headers: serviceHeaders("return=representation"),
      body: JSON.stringify({
        user_id: input.user.id,
        workspace_id: input.workspace?.id ?? null,
        notification_email: input.email,
        request_source: input.source,
        confirmation_version: input.confirmationVersion,
        status: initialStatus,
        requires_ownership_transfer: blockers.requiresOwnershipTransfer,
        requires_subscription_resolution:
          blockers.requiresSubscriptionResolution,
        requested_at: requestedAt.toISOString(),
        processing_deadline_at: processingDeadlineAt,
      }),
    },
    "request_create_failed",
  );

  if (!response.ok) {
    if (response.status === 409) {
      const raced = await getActiveAccountDeletionRequest(input.user.id);
      if (raced) return publicAccountDeletionStatus(raced);
    }
    throw new AccountDeletionServiceError("request_create_failed");
  }

  const rows = (await response.json().catch(() => null)) as
    | AccountDeletionRequestRow[]
    | null;
  const row = Array.isArray(rows) && rows.length ? rows[0] : null;
  if (!row) throw new AccountDeletionServiceError("request_create_failed");

  const [acknowledgement, operationsNotice] = await Promise.all([
    sendAccountDeletionAcknowledgement({
      email: input.email,
      requestId: row.id,
      processingDeadlineAt,
      requiresOwnershipTransfer: blockers.requiresOwnershipTransfer,
      requiresSubscriptionResolution: blockers.requiresSubscriptionResolution,
    }),
    sendAccountDeletionOperationsNotice({
      requestId: row.id,
      source: input.source,
      processingDeadlineAt,
      requiresOwnershipTransfer: blockers.requiresOwnershipTransfer,
      requiresSubscriptionResolution: blockers.requiresSubscriptionResolution,
    }),
  ]);

  const notificationError = acknowledgement.errorCode ?? operationsNotice.errorCode;
  const updated = await patchDeletionRequest(row.id, input.user.id, {
    acknowledgement_sent_at: acknowledgement.sent
      ? new Date().toISOString()
      : null,
    last_error_code: notificationError,
  }).catch(() => row);

  return publicAccountDeletionStatus(updated ?? row);
}

export async function cancelAccountDeletionRequest(input: {
  userId: string;
  requestId: string;
}): Promise<ReturnType<typeof publicAccountDeletionStatus>> {
  const active = await getActiveAccountDeletionRequest(input.userId);
  if (!active || active.id !== input.requestId) {
    throw new AccountDeletionServiceError("request_not_found");
  }
  if (active.status === "processing") {
    throw new AccountDeletionServiceError("request_already_processing");
  }
  const erased = await eraseCancellableDeletionRequest(
    active.id,
    input.userId,
  );
  if (!erased) throw new AccountDeletionServiceError("request_update_failed");
  return publicAccountDeletionStatus(null);
}
