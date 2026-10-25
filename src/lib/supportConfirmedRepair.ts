export type ConfirmedRepairPlatform = "facebook" | "instagram";

export type SupportRepairConnection = {
  id: string;
  platform: string;
  status: string;
  last_messenger_sync_at: string | null;
  last_messenger_sync_error: string | null;
};

export type ConfirmedRepairResult =
  | { status: "succeeded"; repairExecuted: true; verified: true }
  | {
      status:
        | "partial"
        | "failed"
        | "rate_limited"
        | "verification_failed"
        | "unavailable";
      repairExecuted: boolean;
      verified: false;
    };

type ConfirmedRepairDependencies = {
  acquireRateLimit: () => Promise<{ allowed: boolean }>;
  syncMessages: (
    platform: ConfirmedRepairPlatform,
  ) => Promise<{ ok: boolean; continuationPending?: boolean }>;
  readConnections: () => Promise<{
    connections: ReadonlyArray<SupportRepairConnection>;
    error: unknown;
  }>;
  now?: () => Date;
};

/**
 * Runs only an explicitly confirmed message-sync restart. The caller must
 * authenticate the actor, derive the workspace and connection server-side,
 * and persist the started audit event before invoking this function.
 */
export async function executeConfirmedMessageSyncRepair(
  input: {
    platform: ConfirmedRepairPlatform;
    connectionId: string;
  },
  dependencies: ConfirmedRepairDependencies,
): Promise<ConfirmedRepairResult> {
  let allowance: { allowed: boolean };
  try {
    allowance = await dependencies.acquireRateLimit();
  } catch {
    return { status: "unavailable", repairExecuted: false, verified: false };
  }
  if (!allowance.allowed) {
    return { status: "rate_limited", repairExecuted: false, verified: false };
  }

  const startedAt = (dependencies.now ?? (() => new Date()))().getTime();
  let sync: { ok: boolean; continuationPending?: boolean };
  try {
    sync = await dependencies.syncMessages(input.platform);
  } catch {
    return { status: "failed", repairExecuted: true, verified: false };
  }
  if (!sync.ok) {
    return { status: "failed", repairExecuted: true, verified: false };
  }
  if (sync.continuationPending) {
    return { status: "partial", repairExecuted: true, verified: false };
  }

  let observed: Awaited<ReturnType<ConfirmedRepairDependencies["readConnections"]>>;
  try {
    observed = await dependencies.readConnections();
  } catch {
    return {
      status: "verification_failed",
      repairExecuted: true,
      verified: false,
    };
  }
  if (observed.error) {
    return {
      status: "verification_failed",
      repairExecuted: true,
      verified: false,
    };
  }

  const matching = observed.connections.filter(
    (connection) =>
      connection.id === input.connectionId &&
      connection.platform === input.platform,
  );
  if (matching.length !== 1) {
    return {
      status: "verification_failed",
      repairExecuted: true,
      verified: false,
    };
  }
  const connection = matching[0];
  const lastSyncAt = Date.parse(connection.last_messenger_sync_at ?? "");
  if (
    connection.status !== "connected" ||
    Boolean(connection.last_messenger_sync_error?.trim()) ||
    !Number.isFinite(lastSyncAt) ||
    lastSyncAt < startedAt
  ) {
    return {
      status: "verification_failed",
      repairExecuted: true,
      verified: false,
    };
  }

  return { status: "succeeded", repairExecuted: true, verified: true };
}
