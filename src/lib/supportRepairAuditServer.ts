import "server-only";
import {
  getSupabaseApiKeyHeaders,
  getSupabaseRestUrl,
} from "@/lib/supabase/config";
import {
  persistRepairAuditCompletion,
  persistRepairAuditEvent,
  type RepairAuditWriter,
} from "@/lib/supportRepairAuditPersistence";
import type { RepairAuditEvent } from "@/lib/supportRepairAudit";

function serviceHeaders() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("repair_audit_database_not_configured");
  return {
    ...getSupabaseApiKeyHeaders(serviceKey),
    "Content-Type": "application/json",
  };
}

/**
 * Insert the durable started record before any provider call. The unique
 * request_id makes a repeated customer request fail closed.
 */
export const writeRepairAuditToSupabase: RepairAuditWriter = async (record) => {
  const response = await fetch(getSupabaseRestUrl("support_repair_audit"), {
    method: "POST",
    headers: {
      ...serviceHeaders(),
      Prefer: "return=minimal",
    },
    body: JSON.stringify(record),
    cache: "no-store",
  });
  if (response.status === 409) throw new Error("repair_request_replayed");
  if (!response.ok) throw new Error("repair_audit_write_failed");
};

const updateRepairAuditInSupabase: RepairAuditWriter = async (record) => {
  const url = new URL(getSupabaseRestUrl("support_repair_audit"));
  url.searchParams.set("request_id", `eq.${record.request_id}`);
  url.searchParams.set("workspace_id", `eq.${record.workspace_id}`);
  url.searchParams.set("actor_user_id", `eq.${record.actor_user_id}`);
  url.searchParams.set("status", `in.(started,${record.status})`);
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      ...serviceHeaders(),
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      status: record.status,
      completed_at: record.completed_at,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("repair_audit_update_failed");
  const rows: unknown = await response.json();
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error("repair_audit_transition_failed");
  }
};

export async function startRepairAuditEvent(input: RepairAuditEvent) {
  if (input.status !== "started" || input.completed_at !== null) {
    throw new Error("repair_started_status_required");
  }
  return persistRepairAuditEvent(input, writeRepairAuditToSupabase);
}

export async function completeRepairAuditEvent(input: RepairAuditEvent) {
  return persistRepairAuditCompletion(input, updateRepairAuditInSupabase);
}
