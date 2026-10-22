import { verifyConnectionAfterRepair } from "./supportRepairPostcheck";
import { getSupportRepairPolicy } from "./supportRepairPolicy";

type Platform = "instagram" | "facebook" | "whatsapp";
type Connection = { platform: string; status: string };
export type SafeRepairResult =
  | { status: "connected"; verified: true; changed: false }
  | { status: "attention_required" | "not_configured" | "diagnostics_unavailable" | "manual_action_required"; verified: false; changed: false };

/** Only read-only remediation is automatic. Never mutate provider accounts here. */
export async function executeSafeSupportRepair(
  action: string,
  platform: Platform,
  readConnections: () => Promise<ReadonlyArray<Connection>>,
): Promise<SafeRepairResult> {
  const policy = getSupportRepairPolicy(action);
  if (!policy || policy.classification !== "automatic") {
    return { status: "manual_action_required", verified: false, changed: false };
  }
  try {
    const check = verifyConnectionAfterRepair(await readConnections(), platform);
    return { ...check, changed: false };
  } catch {
    return { status: "diagnostics_unavailable", verified: false, changed: false };
  }
}
