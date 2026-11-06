import { getSupabaseHeaders, getSupabasePublicConfig, getSupabaseRestUrl } from "@/lib/supabase/config";

export type OperationsStatus = "healthy" | "degraded" | "unavailable" | "unknown";
export type NotificationSeverity = "critical" | "warning" | "info" | "resolved";
export type AdminNotification = { id:string; created_at:string; category:NotificationSeverity; severity:NotificationSeverity; title:string; message:string; source:string|null; status:string; read_at:string|null; acknowledged_at:string|null; technical_reference:string|null };
export type HealthCheck = { component:string; status:OperationsStatus; publicMessage:string; adminMessage?:string; checkedAt:string; latencyMs?:number };
export type ServerErrorGroup = { fingerprint:string; first_seen_at:string; last_seen_at:string; occurrence_count:number; route_path:string; route_type:string; router_kind:string; http_method:string; environment:string; latest_release_commit:string|null; status:string; last_notified_severity:string|null };

function serviceKey() { return process.env.SUPABASE_SERVICE_ROLE_KEY; }
function envFlag(name: string): OperationsStatus { return process.env[name] ? "healthy" : "unknown"; }
function timeoutSignal(ms = 2500) { return AbortSignal.timeout(ms); }
function statusFromResponse(ok: boolean, status: number): OperationsStatus { if (ok) return "healthy"; if (status >= 500) return "unavailable"; return "degraded"; }
function publicCheck(component:string, status:OperationsStatus, publicMessage:string, latencyMs?:number, adminMessage?:string): HealthCheck { return { component, status, publicMessage, adminMessage, checkedAt: new Date().toISOString(), latencyMs }; }

async function timed<T>(fn: () => Promise<T>): Promise<{ value?: T; error?: string; latencyMs:number }> {
  const start = Date.now();
  try { return { value: await fn(), latencyMs: Date.now() - start }; }
  catch (error) { return { error: error instanceof Error ? error.message : "unknown", latencyMs: Date.now() - start }; }
}

export async function runOperationsHealthChecks(admin = false) {
  const checks: HealthCheck[] = [publicCheck("application", "healthy", "FanMind application responds")];
  const config = getSupabasePublicConfig();
  const key = serviceKey();
  checks.push(publicCheck("supabase_config", config ? "healthy" : "unavailable", config ? "Supabase public configuration present" : "Supabase public configuration missing", undefined, admin ? `service_role_configured=${Boolean(key)}` : undefined));

  if (config && key) {
    const db = await timed(async () => fetch(`${getSupabaseRestUrl("workspaces")}?select=id&limit=1`, { headers: getSupabaseHeaders(key), cache: "no-store", signal: timeoutSignal() }));
    checks.push(publicCheck("supabase_database", db.value ? statusFromResponse(db.value.ok, db.value.status) : "unavailable", db.value?.ok ? "Database reachable" : "Database check did not complete cleanly", db.latencyMs, admin ? `status=${db.value?.status ?? "request_failed"}` : undefined));
    const storage = await timed(async () => fetch(`${config.url}/storage/v1/bucket`, { headers: getSupabaseHeaders(key), cache: "no-store", signal: timeoutSignal() }));
    checks.push(publicCheck("supabase_storage", storage.value ? statusFromResponse(storage.value.ok, storage.value.status) : "unavailable", storage.value?.ok ? "Storage API reachable" : "Storage check did not complete cleanly", storage.latencyMs, admin ? `status=${storage.value?.status ?? "request_failed"}` : undefined));
  } else {
    checks.push(publicCheck("supabase_database", "unknown", "Database not checked because configuration is incomplete"));
    checks.push(publicCheck("supabase_storage", "unknown", "Storage not checked because configuration is incomplete"));
  }

  checks.push(publicCheck("stripe_config", envFlag("STRIPE_SECRET_KEY"), process.env.STRIPE_SECRET_KEY ? "Stripe server configuration present" : "Stripe server configuration missing"));
  checks.push(publicCheck("openai_config", envFlag("OPENAI_API_KEY"), process.env.OPENAI_API_KEY ? "OpenAI server configuration present" : "OpenAI server configuration missing"));
  const sharedRateLimitConfigured = (process.env.FANMIND_SHARED_RATE_LIMIT_SECRET?.trim().length ?? 0) >= 32;
  checks.push(publicCheck(
    "shared_rate_limit_config",
    sharedRateLimitConfigured ? "healthy" : "unavailable",
    sharedRateLimitConfigured
      ? "Shared rate-limit server configuration present"
      : "Shared rate-limit server configuration missing",
  ));
  checks.push(publicCheck("email_config", process.env.RESEND_API_KEY || process.env.SMTP_HOST ? "healthy" : "unknown", process.env.RESEND_API_KEY || process.env.SMTP_HOST ? "Email server configuration present" : "Email server configuration missing"));

  const worst = checks.some((c) => c.status === "unavailable") ? "unavailable" : checks.some((c) => c.status === "degraded") ? "degraded" : checks.some((c) => c.status === "unknown") ? "degraded" : "healthy";
  return { status: worst as OperationsStatus, checkedAt: new Date().toISOString(), checks: checks.map((c) => admin ? c : { component:c.component, status:c.status, publicMessage:c.publicMessage, checkedAt:c.checkedAt, latencyMs:c.latencyMs }) };
}

async function rest<T>(table: string, query: string, init?: RequestInit): Promise<{ data:T|null; error:string|null }> {
  const key = serviceKey();
  if (!key) return { data: null, error: "SUPABASE_SERVICE_ROLE_KEY is not configured server-side." };
  const response = await fetch(`${getSupabaseRestUrl(table)}${query}`, { ...init, headers: { ...getSupabaseHeaders(key), Prefer: "return=representation", ...(init?.headers ?? {}) }, cache: "no-store" });
  if (!response.ok) return { data:null, error:`${table} returned ${response.status}` };
  return { data: await response.json() as T, error:null };
}

export async function getRecentAdminNotifications(limit = 8) { return rest<AdminNotification[]>("admin_notifications", `?select=*&order=created_at.desc&limit=${limit}`); }
export async function getUnreadAdminNotificationCount() { const result = await rest<AdminNotification[]>("admin_notifications", `?select=id&read_at=is.null&limit=1000`); return { count: result.data?.length ?? 0, error: result.error }; }
export async function markAdminNotificationRead(id: string, userId: string, acknowledge = false) {
  const body: Record<string,string> = { read_at: new Date().toISOString(), read_by_user_id: userId };
  if (acknowledge) { body.acknowledged_at = body.read_at; body.acknowledged_by_user_id = userId; }
  return rest<AdminNotification[]>("admin_notifications", `?id=eq.${encodeURIComponent(id)}`, { method:"PATCH", body: JSON.stringify(body) });
}
export async function getRecentServerErrorGroups(limit = 8) {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
  return rest<ServerErrorGroup[]>(
    "server_error_groups",
    `?select=fingerprint,first_seen_at,last_seen_at,occurrence_count,route_path,route_type,router_kind,http_method,environment,latest_release_commit,status,last_notified_severity&order=last_seen_at.desc&limit=${safeLimit}`,
  );
}

export async function getOperationsOverviewData() {
  const [notifications, healthEvents, jobs, backups, audits, serverErrors] = await Promise.all([
    getRecentAdminNotifications(6),
    rest<Record<string,unknown>[]>("system_health_events", "?select=*&order=created_at.desc&limit=6"),
    rest<Record<string,unknown>[]>("admin_operation_jobs", "?select=*&order=priority.asc,requested_at.asc&limit=12"),
    rest<Record<string,unknown>[]>("backup_runs", "?select=*&order=started_at.desc&limit=12"),
    rest<Record<string,unknown>[]>("operations_audit_log", "?select=*&order=created_at.desc&limit=6"),
    getRecentServerErrorGroups(8),
  ]);
  return { notifications, healthEvents, jobs, backups, audits, serverErrors };
}
