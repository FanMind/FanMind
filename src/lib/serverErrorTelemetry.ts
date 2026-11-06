import { createHash } from "node:crypto";
import {
  buildSupabaseApiKeyHeaders as getSupabaseApiKeyHeaders,
} from "@/lib/supabase/apiKeyPolicy.mjs";

export type ServerErrorRequest = {
  path?: string;
  method?: string;
};

export type ServerErrorContext = {
  routerKind?: string;
  routePath?: string;
  routeType?: string;
  renderSource?: string;
  revalidateReason?: string;
  renderType?: string;
};

export type ServerErrorRecord = {
  fingerprint: string;
  digest: string | null;
  routePath: string;
  routeType: string;
  routerKind: string;
  httpMethod: string;
  environment: string;
  releaseCommit: string | null;
};

type CaptureResult = {
  captured: boolean;
  fingerprint: string | null;
  notified: boolean;
  severity: string | null;
  error: string | null;
};

const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const RELEASE_PATTERN = /^[a-f0-9]{40}$/;
const SAFE_DIGEST_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const ROUTE_TYPE_VALUES = new Set(["render", "route", "action", "proxy", "unknown"]);
const ROUTER_KIND_VALUES = new Set(["App Router", "Pages Router", "unknown"]);
const METHOD_PATTERN = /^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD|UNKNOWN)$/;

export function serverErrorTrackingEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.FANMIND_SERVER_ERROR_TRACKING_ENABLED === "true";
}

function positiveInt(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function safeDigest(value: unknown): string | null {
  const candidate = typeof value === "string" ? value.trim() : "";
  return SAFE_DIGEST_PATTERN.test(candidate) ? candidate : null;
}

function safeErrorDigest(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  try {
    return safeDigest((error as { digest?: unknown }).digest);
  } catch {
    return null;
  }
}

function safeErrorName(error: unknown): string {
  if (error instanceof Error && error.name.trim()) return error.name.trim().slice(0, 80);
  if (typeof error !== "object" || error === null) return "Error";
  try {
    const candidate = (error as { name?: unknown }).name;
    return typeof candidate === "string" && candidate.trim()
      ? candidate.trim().slice(0, 80)
      : "Error";
  } catch {
    return "Error";
  }
}

export function normalizeRoutePath(routePath: unknown): string {
  const primary = typeof routePath === "string" ? routePath : "";
  const raw = primary || "/unknown";
  const withoutQuery = raw.split("?", 1)[0].split("#", 1)[0];
  const normalized = withoutQuery
    .replace(/[^A-Za-z0-9_./\-[\]]+/g, "_")
    .replace(/\/{2,}/g, "/")
    .slice(0, 180);
  return normalized.startsWith("/") ? normalized || "/unknown" : `/${normalized || "unknown"}`;
}

function normalizeRouteType(value: unknown): string {
  const candidate = typeof value === "string" ? value : "unknown";
  return ROUTE_TYPE_VALUES.has(candidate) ? candidate : "unknown";
}

function normalizeRouterKind(value: unknown): string {
  const candidate = typeof value === "string" ? value : "unknown";
  return ROUTER_KIND_VALUES.has(candidate) ? candidate : "unknown";
}

function normalizeMethod(value: unknown): string {
  const candidate = typeof value === "string" ? value.toUpperCase() : "UNKNOWN";
  return METHOD_PATTERN.test(candidate) ? candidate : "UNKNOWN";
}

function normalizeEnvironment(value: unknown): string {
  const candidate = typeof value === "string" ? value.toLowerCase() : "unknown";
  return ["production", "staging", "test", "development"].includes(candidate) ? candidate : "unknown";
}

function releaseCommit(env: NodeJS.ProcessEnv): string | null {
  const candidate = env.FANMIND_RELEASE_COMMIT ?? env.GITHUB_SHA ?? "";
  return RELEASE_PATTERN.test(candidate) ? candidate : null;
}

export function buildServerErrorRecord(
  error: unknown,
  request: ServerErrorRequest,
  context: ServerErrorContext,
  env: NodeJS.ProcessEnv = process.env,
): ServerErrorRecord {
  const digest = safeErrorDigest(error);
  const routePath = normalizeRoutePath(context.routePath);
  const routeType = normalizeRouteType(context.routeType);
  const routerKind = normalizeRouterKind(context.routerKind);
  const httpMethod = normalizeMethod(request.method);
  const errorName = safeErrorName(error);
  const fingerprintInput = digest
    ? `digest:${digest}`
    : `name:${errorName}|route:${routePath}|type:${routeType}|router:${routerKind}`;
  const fingerprint = createHash("sha256").update(fingerprintInput).digest("hex");
  return {
    fingerprint,
    digest,
    routePath,
    routeType,
    routerKind,
    httpMethod,
    environment: normalizeEnvironment(env.NODE_ENV),
    releaseCommit: releaseCommit(env),
  };
}

function supabaseConfig(env: NodeJS.ProcessEnv) {
  const url = String(env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

async function recordError(record: ServerErrorRecord, env: NodeJS.ProcessEnv) {
  const config = supabaseConfig(env);
  if (!config) throw new Error("telemetry_store_not_configured");
  const threshold = positiveInt(env.FANMIND_SERVER_ERROR_ALERT_THRESHOLD, 5, 2, 100);
  const cooldown = positiveInt(env.FANMIND_SERVER_ERROR_ALERT_COOLDOWN_MINUTES, 30, 5, 1440);
  const response = await fetch(`${config.url}/rest/v1/rpc/record_server_error_event`, {
    method: "POST",
    headers: getSupabaseApiKeyHeaders(config.key),
    body: JSON.stringify({
      p_fingerprint: record.fingerprint,
      p_digest: record.digest,
      p_route_path: record.routePath,
      p_route_type: record.routeType,
      p_router_kind: record.routerKind,
      p_http_method: record.httpMethod,
      p_environment: record.environment,
      p_release_commit: record.releaseCommit,
      p_alert_threshold: threshold,
      p_cooldown_minutes: cooldown,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`telemetry_store_${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload) ? payload[0] ?? null : payload;
}

function adminRecipients(env: NodeJS.ProcessEnv): string[] {
  return [...new Set(String(env.FANMIND_ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)))]
    .slice(0, 20);
}

function criticalEmailEnabled(env: NodeJS.ProcessEnv, result: Record<string, unknown> | null): boolean {
  return env.FANMIND_SERVER_ERROR_EMAIL_ENABLED === "true"
    && Boolean(env.RESEND_API_KEY)
    && adminRecipients(env).length > 0
    && result?.should_notify === true
    && result?.severity === "critical";
}

async function sendCriticalEmail(
  record: ServerErrorRecord,
  result: Record<string, unknown>,
  env: NodeJS.ProcessEnv,
): Promise<boolean> {
  if (!criticalEmailEnabled(env, result)) return false;
  const recipients = adminRecipients(env);
  const recentCount = Number(result.recent_count ?? 0);
  const reference = record.fingerprint.slice(0, 12);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.FANMIND_NOTIFICATION_FROM || "FanMind <noreply@fanmind.ch>",
      to: recipients,
      subject: "[FanMind Betrieb] Serverfehler häufen sich",
      text: [
        "FanMind hat mehrere serverseitige Fehler derselben Gruppe erkannt.",
        "",
        `Referenz: ${reference}`,
        `Vorkommen im aktuellen Zeitfenster: ${recentCount}`,
        `Release: ${record.releaseCommit?.slice(0, 12) ?? "nicht gesetzt"}`,
        "Operations Center: https://fanmind.ch/admin/operations",
      ].join("\n"),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`telemetry_email_${response.status}`);
  return true;
}

function safeFailureCode(error: unknown): string {
  const value = error instanceof Error ? error.message : "telemetry_unknown_failure";
  return value.replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 100);
}

export async function captureServerRequestError(
  error: unknown,
  request: ServerErrorRequest,
  context: ServerErrorContext,
  env: NodeJS.ProcessEnv = process.env,
): Promise<CaptureResult> {
  if (!serverErrorTrackingEnabled(env)) {
    return { captured: false, fingerprint: null, notified: false, severity: null, error: null };
  }
  const record = buildServerErrorRecord(error, request, context, env);
  if (!FINGERPRINT_PATTERN.test(record.fingerprint)) {
    return { captured: false, fingerprint: null, notified: false, severity: null, error: "invalid_fingerprint" };
  }
  try {
    const result = await recordError(record, env) as Record<string, unknown> | null;
    const emailed = result ? await sendCriticalEmail(record, result, env).catch(() => false) : false;
    return {
      captured: true,
      fingerprint: record.fingerprint,
      notified: Boolean(result?.should_notify) || emailed,
      severity: typeof result?.severity === "string" ? result.severity : null,
      error: null,
    };
  } catch (captureError) {
    console.error(JSON.stringify({
      event: "server_error_telemetry_failed",
      error_code: safeFailureCode(captureError),
      fingerprint: record.fingerprint.slice(0, 12),
    }));
    return {
      captured: false,
      fingerprint: record.fingerprint,
      notified: false,
      severity: null,
      error: safeFailureCode(captureError),
    };
  }
}
