/** Closed support vocabulary: no prompts, arbitrary commands, SQL or raw errors. */
export const supportPlatforms = ["facebook", "instagram", "whatsapp"] as const;
export type SupportPlatform = typeof supportPlatforms[number];
export const supportProblems = {
  connection_attention: {
    problem: "Verbindung muss geprüft werden.",
    diagnosis: "Der gespeicherte Verbindungsstatus ist nicht verbunden.",
    repair: "Gespeicherten Verbindungsstatus erneut lesen und unabhängig nachprüfen.",
    permission: "read_connection_status",
    risk: "Niedrig: ausschließlich lesender Zugriff.",
    impact: "Kein Provideraufruf und keine Änderung am Kundenkonto.",
  },
  sync_attention: {
    problem: "Die Nachrichtensynchronisierung meldet einen Fehler.",
    diagnosis: "Eine verbundene Verbindung enthält einen Synchronisierungsfehler.",
    repair: "Status und Fehlerklasse erneut prüfen; ungelöste Probleme weiterleiten.",
    permission: "read_connection_status",
    risk: "Niedrig: ausschließlich lesender Zugriff.",
    impact: "Kein Synchronisierungsneustart. Kundenbestätigung wird nicht ersetzt.",
  },
} as const;
export type SupportProblem = keyof typeof supportProblems;
export type SupportCase = {
  id: string; workspace_id: string; connection_id: string; platform: SupportPlatform;
  problem: SupportProblem; action: "refresh_readonly_status"; permission: "read_connection_status";
  status: "pending" | "running" | "rejected" | "succeeded" | "failed" | "expired";
  created_at: string; expires_at: string; completed_at: string | null;
};
export const isSupportUuid = (value: unknown): value is string => typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);

export function isSupportCase(value: unknown, workspace: string): value is SupportCase {
  if (!value || typeof value !== "object") return false;
  const row = value as SupportCase;
  return isSupportUuid(row.id) && row.workspace_id === workspace && isSupportUuid(row.connection_id) &&
    supportPlatforms.includes(row.platform) && Object.hasOwn(supportProblems, row.problem) &&
    row.action === "refresh_readonly_status" && row.permission === "read_connection_status" &&
    ["pending", "running", "rejected", "succeeded", "failed", "expired"].includes(row.status) &&
    Number.isFinite(Date.parse(row.created_at)) && Number.isFinite(Date.parse(row.expires_at)) &&
    Date.parse(row.expires_at) > Date.parse(row.created_at) &&
    Date.parse(row.expires_at) - Date.parse(row.created_at) <= 3600000;
}

export function supportCaseNeedsAttention(row: SupportCase, now: number): boolean {
  return row.status === "failed" || row.status === "running" ||
    (row.status === "pending" && Date.parse(row.expires_at) > now);
}

/** The database owns the lease. A failed/ambiguous claim never reaches execution. */
export async function performSupportDecision(input: { workspace: string; id: string; decision: "approve" | "reject" }, deps: {
  claim: () => Promise<SupportCase>;
  check: () => Promise<boolean>;
  finish: (success: boolean) => Promise<void>;
}): Promise<"rejected" | "succeeded" | "failed"> {
  const row = await deps.claim();
  if (!isSupportCase(row, input.workspace) || row.id !== input.id ||
    row.status !== (input.decision === "approve" ? "running" : "rejected")) throw new Error("invalid_claim");
  if (input.decision === "reject") return "rejected";
  if (Date.parse(row.expires_at) <= Date.now()) throw new Error("expired_claim");
  let success = false;
  try {
    // Two distinct fresh reads; no provider, credential or customer mutation.
    const before = await deps.check();
    const after = await deps.check();
    success = before === true && after === true;
  } catch { success = false; }
  // A missing terminal audit remains running/reconciliation-required, never success.
  await deps.finish(success);
  return success ? "succeeded" : "failed";
}
