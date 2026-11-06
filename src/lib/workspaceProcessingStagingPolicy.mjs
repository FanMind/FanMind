export const WORKSPACE_PROCESSING_STAGING_CONFIRMATION =
  "run-workspace-processing-staging-acceptance";

export const WORKSPACE_PROCESSING_STAGING_WORKSPACE_NAME =
  "FanMind Staging Processing Acceptance";

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const PROJECT_REF_PATTERN = /^[a-z0-9]{8,64}$/u;
const DATABASE_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/u;
const HOST_PATTERN =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/u;

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedOrigin(value) {
  try {
    const url = new URL(clean(value));
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return "";
    }
    return url.origin;
  } catch {
    return "";
  }
}

function normalizedHost(value) {
  const candidate = clean(value).toLowerCase().replace(/\.$/u, "");
  return HOST_PATTERN.test(candidate) ? candidate : "";
}

function supabaseProjectRef(value) {
  const candidate = clean(value).toLowerCase();
  return PROJECT_REF_PATTERN.test(candidate) ? candidate : "";
}

export function evaluateWorkspaceProcessingStagingEnvironment(
  environment = {},
) {
  const errors = [];
  const targetOrigin = normalizedOrigin(environment.NEXT_PUBLIC_APP_URL);
  const targetApiOrigin = normalizedOrigin(
    environment.FANMIND_TARGET_API_ORIGIN,
  );
  const productionOrigin = normalizedOrigin(
    environment.FANMIND_PRODUCTION_API_ORIGIN,
  );
  const targetProjectRef = supabaseProjectRef(
    environment.FANMIND_TARGET_SUPABASE_PROJECT_REF,
  );
  const productionProjectRef = supabaseProjectRef(
    environment.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF,
  );
  const supabaseOrigin = normalizedOrigin(
    environment.NEXT_PUBLIC_SUPABASE_URL,
  );
  const pgHost = normalizedHost(environment.PGHOST);
  const expectedHost = normalizedHost(environment.FANMIND_TARGET_DB_HOST);
  const productionHost = normalizedHost(
    environment.FANMIND_PRODUCTION_DB_HOST,
  );
  const reviewedCommit = clean(
    environment.FANMIND_WORKSPACE_PROCESSING_REVIEWED_COMMIT,
  ).toLowerCase();
  const githubSha = clean(environment.GITHUB_SHA).toLowerCase();

  if (clean(environment.FANMIND_RUNTIME_ENVIRONMENT) !== "staging") {
    errors.push("runtime_environment");
  }
  if (
    !targetOrigin ||
    !targetApiOrigin ||
    targetOrigin !== targetApiOrigin ||
    !productionOrigin ||
    targetOrigin === productionOrigin
  ) {
    errors.push("application_boundary");
  }
  if (
    !targetProjectRef ||
    !productionProjectRef ||
    targetProjectRef === productionProjectRef ||
    supabaseOrigin !== `https://${targetProjectRef}.supabase.co`
  ) {
    errors.push("supabase_boundary");
  }
  if (
    clean(environment.GITHUB_REF) !== "refs/heads/main" ||
    !COMMIT_PATTERN.test(reviewedCommit) ||
    reviewedCommit !== githubSha
  ) {
    errors.push("reviewed_commit");
  }
  if (
    clean(environment.FANMIND_ENABLE_NON_PRODUCTION_WRITES) !== "true" ||
    clean(environment.FANMIND_NON_PRODUCTION_WRITE_ACK) !==
      "I_UNDERSTAND_NON_PRODUCTION_ONLY"
  ) {
    errors.push("write_acknowledgement");
  }
  if (
    clean(
      environment.FANMIND_WORKSPACE_PROCESSING_STAGING_ACCEPTANCE_CONFIRM,
    ) !== WORKSPACE_PROCESSING_STAGING_CONFIRMATION
  ) {
    errors.push("acceptance_confirmation");
  }
  if (
    !UUID_PATTERN.test(
      clean(environment.FANMIND_WORKSPACE_PROCESSING_STAGING_WORKSPACE_ID),
    )
  ) {
    errors.push("synthetic_workspace");
  }
  if (
    !pgHost ||
    !expectedHost ||
    pgHost !== expectedHost ||
    !pgHost.endsWith(".pooler.supabase.com") ||
    !productionHost
  ) {
    errors.push("database_host_binding");
  }
  if (
    clean(environment.PGPORT) !== "5432" ||
    !DATABASE_NAME_PATTERN.test(clean(environment.PGDATABASE)) ||
    clean(environment.PGUSER) !== `postgres.${targetProjectRef}`
  ) {
    errors.push("database_identity");
  }
  if (
    clean(environment.PGSSLMODE) !== "verify-full" ||
    !clean(environment.PGSSLROOTCERT).startsWith("/")
  ) {
    errors.push("database_tls");
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
      errors.push("database_redirect");
      break;
    }
  }

  return { ok: errors.length === 0, errors };
}
