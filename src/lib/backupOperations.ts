import { getSupabaseHeaders, getSupabaseRestUrl } from "@/lib/supabase/config";
import { isPlatformAdminEmail } from "@/lib/admin";
import { isTrustedFanMindMutationRequest } from "@/lib/httpMutationPolicy.mjs";
import { consumeSharedRateLimit } from "@/lib/sharedRateLimit";
import type { SupabaseServerUser } from "@/lib/supabase/server";

export const BACKUP_JOB_TYPES = ["backup_server_config", "backup_database", "backup_storage", "backup_full", "verify_backup"] as const;
export type BackupJobType = typeof BACKUP_JOB_TYPES[number];

const MANUAL_BACKUP_RATE_LIMIT_MAX = 5;
const MANUAL_BACKUP_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

const JOB_TITLES: Record<BackupJobType, string> = {
  backup_server_config: "Server-Konfigurationsbackup anfordern",
  backup_database: "Datenbankbackup anfordern",
  backup_storage: "Storage-Backup anfordern",
  backup_full: "Vollbackup anfordern",
  verify_backup: "Neuestes lokales Backup prüfen",
};

function serviceKey() { return process.env.SUPABASE_SERVICE_ROLE_KEY; }
function isAllowedJobType(value: unknown): value is BackupJobType { return typeof value === "string" && (BACKUP_JOB_TYPES as readonly string[]).includes(value); }
function todayKey(jobType: BackupJobType) { return `manual:${jobType}:${new Date().toISOString().slice(0, 10)}`; }
async function rest<T>(table: string, query: string, init?: RequestInit): Promise<{ data:T|null; error:string|null; status:number }> {
  const key = serviceKey();
  if (!key) return { data:null, error:"SUPABASE_SERVICE_ROLE_KEY missing", status:500 };
  const response = await fetch(`${getSupabaseRestUrl(table)}${query}`, { ...init, headers: { ...getSupabaseHeaders(key), Prefer:"return=representation", "Content-Type":"application/json", ...(init?.headers ?? {}) }, cache:"no-store" });
  if (!response.ok) return { data:null, error:`${table} returned ${response.status}`, status:response.status };
  return { data: await response.json() as T, error:null, status:response.status };
}

export async function enqueueBackupJob(request: Request, user: SupabaseServerUser, rawJobType: unknown) {
  if (!isPlatformAdminEmail(user.email)) return { status:403, body:{ error:"forbidden" } };
  if (!isTrustedFanMindMutationRequest(request)) return { status:403, body:{ error:"origin_forbidden" } };
  if (!isAllowedJobType(rawJobType)) return { status:400, body:{ error:"job_type_not_allowed" } };

  let rateLimit;
  try {
    rateLimit = await consumeSharedRateLimit({
      scope: "admin_backup_user",
      subject: user.id,
      maxRequests: MANUAL_BACKUP_RATE_LIMIT_MAX,
      windowMs: MANUAL_BACKUP_RATE_LIMIT_WINDOW_MS,
    });
  } catch {
    return { status:503, body:{ error:"operations_rate_limit_unavailable" } };
  }
  if (!rateLimit.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000));
    return {
      status:429,
      body:{ error:"backup_job_rate_limited" },
      headers:{ "Retry-After": String(retryAfterSeconds) },
    };
  }

  const active = await rest<{ id:string }[]>("admin_operation_jobs", `?select=id&job_type=in.(backup_server_config,backup_database,backup_storage,backup_full,verify_backup)&status=in.(queued,claimed,running)&limit=1`);
  if (active.error) return { status:500, body:{ error:"operations_store_unavailable" } };
  if ((active.data ?? []).length > 0) return { status:409, body:{ error:"backup_job_already_active" } };

  const idempotency = request.headers.get("idempotency-key")?.trim().slice(0, 120) || todayKey(rawJobType);
  const existing = await rest<{ id:string; status:string; job_type:string }[]>("admin_operation_jobs", `?select=id,status,job_type&idempotency_key=eq.${encodeURIComponent(idempotency)}&limit=1`);
  if (existing.data?.[0]) return { status:200, body:{ message:"Job wurde bereits eingereiht", job: existing.data[0] } };

  const inserted = await rest<Record<string, unknown>[]>("admin_operation_jobs", "", { method:"POST", body: JSON.stringify({
    job_type: rawJobType,
    status: "queued",
    severity: "info",
    requested_by: user.id,
    requested_by_user_id: user.id,
    requested_at: new Date().toISOString(),
    title: JOB_TITLES[rawJobType],
    summary: rawJobType === "verify_backup"
      ? "Checksum-only-Prüfung des neuesten lokalen Backup-Artefakts wurde sicher eingereiht."
      : "Backup-Job wurde sicher eingereiht. Die Web-App führt keine Shell-Befehle aus.",
    idempotency_key: idempotency,
    priority: rawJobType === "backup_full" ? 50 : rawJobType === "verify_backup" ? 75 : 100,
    metadata: { source: "admin_operations_ui" },
  }) });
  if (inserted.error) return { status:500, body:{ error:"job_enqueue_failed" } };

  await rest("operations_audit_log", "", { method:"POST", body: JSON.stringify({ actor_user_id:user.id, actor_email:user.email, action:`enqueue_${rawJobType}`, target_table:"admin_operation_jobs", target_id: inserted.data?.[0]?.id, severity:"info", outcome:"success", metadata:{ source:"admin_operations_ui" } }) });
  return { status:202, body:{ message:"Job wurde eingereiht", job: inserted.data?.[0] ?? null } };
}
