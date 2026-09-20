import { NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT, evaluateEnvironmentBoundary } from "./environmentBoundaryPolicy.mjs";

export const CHAT_ADMIN_SCHEMA_CONFIRMATION = "verify-chat-admin-schema";
export const CHAT_ADMIN_MIGRATION_CONFIRMATION = "apply-chat-admin-migration";
export const CHAT_ADMIN_ACCEPTANCE_CONFIRMATION = "run-chat-admin-acceptance";
const COMMIT = /^[0-9a-f]{40}$/u;
const HOST = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/u;
const DB = /^[A-Za-z0-9_.-]{1,128}$/u;

const clean = value => typeof value === "string" ? value.trim() : "";
const origin = value => { try { const u = new URL(clean(value)); return u.protocol === "https:" && !u.username && !u.password && !u.search && !u.hash && ["", "/"].includes(u.pathname) ? u.origin : ""; } catch { return ""; } };
const host = value => { const v = clean(value).toLowerCase().replace(/\.$/u, ""); return HOST.test(v) ? v : ""; };

export function evaluateChatAdminStagingControlEnvironment(environment = {}, { mode = "schema" } = {}) {
  const errors = [];
  const write = mode === "migration" || mode === "acceptance";
  if (!["schema", "migration", "acceptance"].includes(mode)) errors.push("mode");
  const boundary = evaluateEnvironmentBoundary(environment, { allowWrite: write });
  if (!boundary.ok || boundary.runtimeEnvironment !== "staging") errors.push("environment_boundary");
  if (boundary.appProduction || boundary.supabaseProductionMatch || !boundary.supabaseTargetRefMatchesUrl) errors.push("production_or_unbound_target");
  const sha = clean(environment.GITHUB_SHA).toLowerCase();
  if (clean(environment.GITHUB_REF) !== "refs/heads/main" || !COMMIT.test(sha) || sha !== clean(environment.FANMIND_CHAT_ADMIN_REVIEWED_COMMIT).toLowerCase()) errors.push("reviewed_main_commit");
  const targetOrigin = origin(environment.FANMIND_TARGET_API_ORIGIN);
  if (!targetOrigin || targetOrigin !== origin(environment.NEXT_PUBLIC_APP_URL) || targetOrigin === origin(environment.FANMIND_PRODUCTION_API_ORIGIN)) errors.push("api_target");
  const pgHost = host(environment.PGHOST);
  if (!pgHost || pgHost !== host(environment.FANMIND_TARGET_DB_HOST) || pgHost === host(environment.FANMIND_PRODUCTION_DB_HOST)) errors.push("database_target");
  if (!DB.test(clean(environment.PGDATABASE)) || !DB.test(clean(environment.PGUSER)) || clean(environment.PGSSLMODE) !== "verify-full") errors.push("database_identity");
  if (Object.keys(environment).some(k => ["PGHOSTADDR", "PGSERVICE", "PGSERVICEFILE", "PGSYSCONFDIR"].includes(k) && clean(environment[k]))) errors.push("libpq_redirect");
  const expected = { schema: ["FANMIND_CHAT_ADMIN_SCHEMA_CONFIRM", CHAT_ADMIN_SCHEMA_CONFIRMATION], migration: ["FANMIND_CHAT_ADMIN_MIGRATION_CONFIRM", CHAT_ADMIN_MIGRATION_CONFIRMATION], acceptance: ["FANMIND_CHAT_ADMIN_ACCEPTANCE_CONFIRM", CHAT_ADMIN_ACCEPTANCE_CONFIRMATION] }[mode];
  if (!expected || clean(environment[expected[0]]) !== expected[1]) errors.push("confirmation");
  if (write && clean(environment.FANMIND_NON_PRODUCTION_WRITE_ACK) !== NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT) errors.push("write_acknowledgement");
  return Object.freeze({ ok: errors.length === 0, mode, writeEnabled: write, errors: Object.freeze([...new Set(errors)]) });
}
