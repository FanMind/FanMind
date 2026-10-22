import "server-only";
import { getSupabaseApiKeyHeaders, getSupabaseRestUrl } from "@/lib/supabase/config";
import {
  persistRepairAuditEvent,
  type RepairAuditWriter,
} from "@/lib/supportRepairAuditPersistence";
import type { RepairAuditEvent } from "@/lib/supportRepairAudit";

/**
 * Server-only Supabase REST writer. Requires a service-role key, never an
 * anon key or browser-provided credential. The database table must be
 * installed and its RLS/access policy reviewed before enabling writes.
 */
export const writeRepairAuditToSupabase: RepairAuditWriter = async (record) => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("repair_audit_database_not_configured");
  const response = await fetch(getSupabaseRestUrl("support_repair_audit"), {
    method: "POST",
    headers: {
      ...getSupabaseApiKeyHeaders(serviceKey),
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(record),
    cache: "no-store",
  });
  if (!response.ok) {
    // Do not leak database details, row values or credentials into logs.
    throw new Error("repair_audit_write_failed");
  }
};

export async function saveRepairAuditEvent(input: RepairAuditEvent) {
  return persistRepairAuditEvent(input, writeRepairAuditToSupabase);
}
