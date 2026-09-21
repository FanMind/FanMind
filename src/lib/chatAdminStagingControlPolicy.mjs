import {
  NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT,
  evaluateEnvironmentBoundary,
} from "./environmentBoundaryPolicy.mjs";

export const CHAT_ADMIN_SCHEMA_CONFIRMATION = "verify-chat-admin-schema";
export const CHAT_ADMIN_MIGRATION_CONFIRMATION = "apply-chat-admin-migration";
export const CHAT_ADMIN_ACCEPTANCE_CONFIRMATION = "run-chat-admin-acceptance";

const COMMIT = /^[0-9a-f]{40}$/u;
const PROJECT_REF = /^[a-z0-9]{8,64}$/u;
const HOST = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/u;
const DB = /^[A-Za-z0-9_.-]{1,128}$/u;
const REQUIRED_CA_SUFFIX = "/config/certificates/supabase-root-2021-ca.crt";

const clean = (value) => (typeof value === "string" ? value.trim() : "");
const origin = (value) => {
  try {
    const url = new URL(clean(value));
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      ["", "/"].includes(url.pathname)
      ? url.origin
      : "";
  } catch {
    return "";
  }
};
const host = (value) => {
  const normalized = clean(value).toLowerCase().replace(/\.$/u, "");
  return HOST.test(normalized) ? normalized : "";
};

export function evaluateChatAdminStagingControlEnvironment(
  environment = {},
  { mode = "schema" } = {},
) {
  const errors = [];
  const write = mode === "migration" || mode === "acceptance";
  if (!["schema", "migration", "acceptance"].includes(mode)) {
    errors.push("mode");
  }

  const boundary = evaluateEnvironmentBoundary(environment, { allowWrite: write });
  if (!boundary.ok || boundary.runtimeEnvironment !== "staging") {
    errors.push("environment_boundary");
  }
  if (
    boundary.appProduction ||
    boundary.supabaseProductionMatch ||
    !boundary.supabaseTargetRefMatchesUrl
  ) {
    errors.push("production_or_unbound_target");
  }

  const sha = clean(environment.GITHUB_SHA).toLowerCase();
  if (
    clean(environment.GITHUB_REF) !== "refs/heads/main" ||
    !COMMIT.test(sha) ||
    sha !== clean(environment.FANMIND_CHAT_ADMIN_REVIEWED_COMMIT).toLowerCase()
  ) {
    errors.push("reviewed_main_commit");
  }

  const targetOrigin = origin(environment.FANMIND_TARGET_API_ORIGIN);
  if (
    !targetOrigin ||
    targetOrigin !== origin(environment.NEXT_PUBLIC_APP_URL) ||
    targetOrigin === origin(environment.FANMIND_PRODUCTION_API_ORIGIN)
  ) {
    errors.push("api_target");
  }

  const targetRef = clean(environment.FANMIND_TARGET_SUPABASE_PROJECT_REF).toLowerCase();
  const productionRef = clean(
    environment.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF,
  ).toLowerCase();
  const targetSupabaseOrigin = origin(environment.NEXT_PUBLIC_SUPABASE_URL);
  if (
    !PROJECT_REF.test(targetRef) ||
    !PROJECT_REF.test(productionRef) ||
    targetRef === productionRef ||
    targetSupabaseOrigin !== `https://${targetRef}.supabase.co`
  ) {
    errors.push("supabase_target");
  }

  const pgHost = host(environment.PGHOST);
  const targetHost = host(environment.FANMIND_TARGET_DB_HOST);
  const productionHost = host(environment.FANMIND_PRODUCTION_DB_HOST);
  const pgUser = clean(environment.PGUSER);
  const directHost = `db.${targetRef}.supabase.co`;
  const directIdentity = pgHost === directHost && pgUser === "postgres";
  const poolerIdentity =
    pgHost.endsWith(".pooler.supabase.com") && pgUser === `postgres.${targetRef}`;
  if (
    !pgHost ||
    pgHost !== targetHost ||
    pgHost === productionHost ||
    pgHost === `db.${productionRef}.supabase.co` ||
    (!directIdentity && !poolerIdentity)
  ) {
    errors.push("database_target");
  }

  const rootCertificate = clean(environment.PGSSLROOTCERT);
  if (
    clean(environment.PGPORT) !== "5432" ||
    !DB.test(clean(environment.PGDATABASE)) ||
    clean(environment.PGSSLMODE).toLowerCase() !== "verify-full" ||
    !rootCertificate.startsWith("/") ||
    !rootCertificate.endsWith(REQUIRED_CA_SUFFIX)
  ) {
    errors.push("database_identity");
  }

  for (const redirect of [
    "DATABASE_URL",
    "POSTGRES_URL",
    "SUPABASE_DB_URL",
    "PGHOSTADDR",
    "PGPASSWORD",
    "PGSERVICE",
    "PGSERVICEFILE",
    "PGSYSCONFDIR",
  ]) {
    if (clean(environment[redirect])) {
      errors.push("libpq_redirect");
      break;
    }
  }

  const expected = {
    schema: ["FANMIND_CHAT_ADMIN_SCHEMA_CONFIRM", CHAT_ADMIN_SCHEMA_CONFIRMATION],
    migration: [
      "FANMIND_CHAT_ADMIN_MIGRATION_CONFIRM",
      CHAT_ADMIN_MIGRATION_CONFIRMATION,
    ],
    acceptance: [
      "FANMIND_CHAT_ADMIN_ACCEPTANCE_CONFIRM",
      CHAT_ADMIN_ACCEPTANCE_CONFIRMATION,
    ],
  }[mode];
  if (!expected || clean(environment[expected[0]]) !== expected[1]) {
    errors.push("confirmation");
  }
  if (
    write &&
    clean(environment.FANMIND_NON_PRODUCTION_WRITE_ACK) !==
      NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT
  ) {
    errors.push("write_acknowledgement");
  }

  return Object.freeze({
    ok: errors.length === 0,
    mode,
    writeEnabled: write,
    errors: Object.freeze([...new Set(errors)]),
  });
}
