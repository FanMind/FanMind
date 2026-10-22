/** Compare an observed provider connection state with the requested repair outcome. */
export type RepairPostcheck =
  | { verified: true; status: "connected" }
  | { verified: false; status: "not_configured" | "attention_required" | "diagnostics_unavailable" };

/** Fail closed: a successful provider call alone is never proof of repair. */
export function verifyConnectionAfterRepair(
  observed: ReadonlyArray<{ platform: string; status: string }> | null,
  platform: "instagram" | "facebook" | "whatsapp",
): RepairPostcheck {
  if (observed === null) return { verified: false, status: "diagnostics_unavailable" };
  const matching = observed.filter((item) => item.platform === platform);
  if (matching.length === 0) return { verified: false, status: "not_configured" };
  if (matching.every((item) => item.status === "connected")) {
    return { verified: true, status: "connected" };
  }
  return { verified: false, status: "attention_required" };
}
