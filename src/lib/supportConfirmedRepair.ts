export type ConfirmedRepairPlatform = "facebook" | "instagram";

export type SupportRepairConnection = {
  id: string;
  platform: string;
  status: string;
  last_messenger_sync_at: string | null;
  last_messenger_sync_error: string | null;
};

type RepairTerminalStatus = "succeeded" | "partial" | "failed";

export type ConfirmedRepairResult =
  | { status: "succeeded"; repairExecuted: true; verified: true }
  | {
      status:
        | "partial"
        | "failed"
        | "rate_limited"
        | "verification_failed"
        | "unavailable"
        | "replayed"
        | "audit_incomplete";
      repairExecuted: boolean;
      verified: false;
    };

type ConfirmedRepairDependencies = {
  acquireRateLimit: () => Promise<{ allowed: boolean }>;
  startAudit: () => Promise<void>;
  completeAudit: (status: RepairTerminalStatus) => Promise<void>;
  syncMessages: (
    platform: ConfirmedRepairPlatform,
  ) => Promise<{ ok: boolean; continuationPending?: boolean }>;
  readConnections: () => Promise<{
    connections: ReadonlyArray<SupportRepairConnection>;
    error: unknown;
  }>;
  now?: () => Date;
};

function terminalStatus(result: ConfirmedRepairResult): RepairTerminalStatus {
  if (result.status === "succeeded") return "succeeded";
  if (result.status === "partial") return "partial";
  return "failed";
}

async function completeWithRetry(
  result: ConfirmedRepairResult,
  completeAudit: ConfirmedRepairDependencies["completeAudit"],
): Promise<ConfirmedRepairResult> {
  const status = terminalStatus(result);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await completeAudit(status);
      return result;
    } catch {
      // A retry is idempotent: the persistence layer accepts the same terminal
      // status after an ambiguous response, but never a different transition.
    }
  }
  return {
    status: "audit_incomplete",
    repairExecuted: result.repairExecuted,
    verified: false,
  };
}

/**
 * Runs only an explicitly confirmed message-sync restart. The caller must
 * authenticate the actor and derive workspace plus exact connection
 * server-side. Rate limiting precedes durable audit; provider work can begin
 * only after the started record exists.
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

  try {
    await dependencies.startAudit();
  } catch (error) {
    const replayed =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      error.message === "repair_request_replayed";
    return {
      status: replayed ? "replayed" : "unavailable",
      repairExecuted: false,
      verified: false,
    };
  }

  const startedAt = (dependencies.now ?? (() => new Date()))().getTime();
  let outcome: ConfirmedRepairResult;
  try {
    const sync = await dependencies.syncMessages(input.platform);
    if (!sync.ok) {
      outcome = { status: "failed", repairExecuted: true, verified: false };
    } else if (sync.continuationPending) {
      outcome = { status: "partial", repairExecuted: true, verified: false };
    } else {
      let observed: Awaited<
        ReturnType<ConfirmedRepairDependencies["readConnections"]>
      >;
      try {
        observed = await dependencies.readConnections();
      } catch {
        observed = { connections: [], error: "postcheck_unavailable" };
      }
      const matching = observed.error
        ? []
        : observed.connections.filter(
            (connection) =>
              connection.id === input.connectionId &&
              connection.platform === input.platform,
          );
      const connection = matching.length === 1 ? matching[0] : null;
      const lastSyncAt = Date.parse(connection?.last_messenger_sync_at ?? "");
      if (
        !connection ||
        connection.status !== "connected" ||
        Boolean(connection.last_messenger_sync_error?.trim()) ||
        !Number.isFinite(lastSyncAt) ||
        lastSyncAt < startedAt
      ) {
        outcome = {
          status: "verification_failed",
          repairExecuted: true,
          verified: false,
        };
      } else {
        outcome = {
          status: "succeeded",
          repairExecuted: true,
          verified: true,
        };
      }
    }
  } catch {
    outcome = { status: "failed", repairExecuted: true, verified: false };
  }

  return completeWithRetry(outcome, dependencies.completeAudit);
}
