import {
  buildRepairAuditEvent,
  type RepairAuditEvent,
} from "./supportRepairAudit";

/**
 * Inject server-side database writers; never accept these dependencies from a
 * browser request. Failed writes reject, so callers must fail closed.
 */
export type RepairAuditWriter = (record: RepairAuditEvent) => Promise<void>;

export async function persistRepairAuditEvent(
  input: RepairAuditEvent,
  writer: RepairAuditWriter,
): Promise<RepairAuditEvent> {
  const record = buildRepairAuditEvent(input);
  await writer(record);
  return record;
}

export async function persistRepairAuditCompletion(
  input: RepairAuditEvent,
  writer: RepairAuditWriter,
): Promise<RepairAuditEvent> {
  const record = buildRepairAuditEvent(input);
  if (!["succeeded", "failed", "partial"].includes(record.status)) {
    throw new Error("repair_terminal_status_required");
  }
  await writer(record);
  return record;
}
