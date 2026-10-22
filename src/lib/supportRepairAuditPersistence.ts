import { buildRepairAuditEvent, type RepairAuditEvent } from "./supportRepairAudit";

/**
 * Inject a server-side database writer; never accept this dependency from
 * a browser request. A failed write rejects, so callers must fail closed.
 * No service-role key is handled in this module.
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
