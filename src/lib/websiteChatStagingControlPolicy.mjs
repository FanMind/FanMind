import {
  NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT,
  evaluateEnvironmentBoundary,
} from "./environmentBoundaryPolicy.mjs";

export const WEBSITE_CHAT_SCHEMA_CONFIRMATION =
  "verify-website-chat-handoff-schema";
export const WEBSITE_CHAT_MIGRATION_CONFIRMATION =
  "apply-website-chat-handoff-migration";
export const WEBSITE_CHAT_ACCEPTANCE_CONFIRMATION =
  "run-website-chat-handoff-acceptance";

export const WEBSITE_CHAT_STAGING_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const DB_IDENTITY_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/u;
const HOST_PATTERN = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/u;
const MODES = new Set(["schema", "migration", "acceptance"]);

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedHost(value) {
  const candidate = clean(value).toLowerCase().replace(/\.$/u, "");
  return HOST_PATTERN.test(candidate) ? candidate : "";
}

function strictOrigin(value) {
  try {
    const url = new URL(clean(value));
    if (
      url.protocol !== "https:" || url.username || url.password ||
      url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")
    ) return "";
    return url.origin;
  } catch {
    return "";
  }
}

export function evaluateWebsiteChatStagingControlEnvironment(
  environment = {},
  { mode = "schema" } = {},
) {
  if (!MODES.has(mode)) {
    return Object.freeze({ ok: false, mode, errors: Object.freeze(["mode"]) });
  }
  const errors = [];
  const allowWrite = mode !== "schema";
  const boundary = evaluateEnvironmentBoundary(environment, { allowWrite });
  if (!boundary.ok) errors.push("environment_boundary");
  if (boundary.runtimeEnvironment !== "staging") errors.push("runtime_environment");
  if (boundary.appProduction || boundary.supabaseProductionMatch) {
    errors.push("production_target");
  }
  if (!boundary.supabaseTargetRefMatchesUrl || boundary.supabaseTargetRefMismatch) {
    errors.push("supabase_target_binding");
  }

  const sha = clean(environment.GITHUB_SHA).toLowerCase();
  const reviewed = clean(environment.FANMIND_WEBSITE_CHAT_REVIEWED_COMMIT).toLowerCase();
  if (clean(environment.GITHUB_REF) !== "refs/heads/main") errors.push("main_ref");
  if (!COMMIT_PATTERN.test(sha) || sha !== reviewed) errors.push("reviewed_commit");

  const targetOrigin = strictOrigin(environment.FANMIND_TARGET_API_ORIGIN);
  const appOrigin = strictOrigin(environment.NEXT_PUBLIC_APP_URL);
  const productionOrigin = strictOrigin(environment.FANMIND_PRODUCTION_API_ORIGIN);
  if (!targetOrigin || targetOrigin !== appOrigin) errors.push("api_target_binding");
  if (!productionOrigin || targetOrigin === productionOrigin) errors.push("production_api_target");

  const pgHost = normalizedHost(environment.PGHOST);
  const targetHost = normalizedHost(environment.FANMIND_TARGET_DB_HOST);
  const productionHost = normalizedHost(environment.FANMIND_PRODUCTION_DB_HOST);
  if (!pgHost || pgHost !== targetHost) errors.push("database_host_binding");
  if (!productionHost || pgHost === productionHost) errors.push("production_database_target");
  if (
    !/^[0-9]{1,5}$/u.test(clean(environment.PGPORT)) ||
    Number(environment.PGPORT) < 1 || Number(environment.PGPORT) > 65_535 ||
    !DB_IDENTITY_PATTERN.test(clean(environment.PGDATABASE)) ||
    !DB_IDENTITY_PATTERN.test(clean(environment.PGUSER))
  ) errors.push("database_identity");
  for (const key of ["PGHOSTADDR", "PGSERVICE", "PGSERVICEFILE", "PGSYSCONFDIR"]) {
    if (clean(environment[key])) errors.push("libpq_redirect");
  }
  if (clean(environment.PGSSLMODE) !== "verify-full") errors.push("tls_mode");

  const confirmation = {
    schema: ["FANMIND_WEBSITE_CHAT_SCHEMA_CONFIRM", WEBSITE_CHAT_SCHEMA_CONFIRMATION],
    migration: ["FANMIND_WEBSITE_CHAT_MIGRATION_CONFIRM", WEBSITE_CHAT_MIGRATION_CONFIRMATION],
    acceptance: ["FANMIND_WEBSITE_CHAT_ACCEPTANCE_CONFIRM", WEBSITE_CHAT_ACCEPTANCE_CONFIRMATION],
  }[mode];
  if (clean(environment[confirmation[0]]) !== confirmation[1]) errors.push("confirmation");
  if (
    allowWrite &&
    clean(environment.FANMIND_NON_PRODUCTION_WRITE_ACK) !==
      NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT
  ) errors.push("write_acknowledgement");

  const workspaceId = clean(environment.FANMIND_WEBSITE_CHAT_STAGING_WORKSPACE_ID).toLowerCase();
  if (
    mode === "acceptance" &&
    (!WEBSITE_CHAT_STAGING_UUID_PATTERN.test(workspaceId) || workspaceId === NIL_UUID)
  ) {
    errors.push("synthetic_workspace");
  }

  return Object.freeze({
    ok: errors.length === 0,
    mode,
    writeEnabled: allowWrite,
    workspaceId,
    errors: Object.freeze([...new Set(errors)]),
  });
}
