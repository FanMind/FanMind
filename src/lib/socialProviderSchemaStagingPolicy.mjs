import {
  NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT,
  evaluateEnvironmentBoundary,
} from "./environmentBoundaryPolicy.mjs";

export const SOCIAL_PROVIDER_SCHEMA_VERIFY_CONFIRMATION =
  "verify-social-provider-schema";
export const SOCIAL_PROVIDER_SCHEMA_APPLY_CONFIRMATION =
  "apply-social-provider-schema";
const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const DB_IDENTITY_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/u;
const HOST_PATTERN = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/u;
const MODES = new Set(["verify", "apply"]);

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function strictOrigin(value) {
  let url;
  try {
    url = new URL(clean(value));
  } catch {
    return "";
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "")
  ) {
    return "";
  }
  return url.origin;
}

function normalizedHost(value) {
  const candidate = clean(value).toLowerCase().replace(/\.$/u, "");
  return HOST_PATTERN.test(candidate) ? candidate : "";
}

function evaluateCommitBinding(environment, errors) {
  const githubSha = clean(environment.GITHUB_SHA).toLowerCase();
  const reviewedCommit = clean(
    environment.FANMIND_SOCIAL_PROVIDER_SCHEMA_REVIEWED_COMMIT,
  ).toLowerCase();
  if (clean(environment.GITHUB_REF) !== "refs/heads/main") errors.push("main_ref");
  if (
    !COMMIT_PATTERN.test(githubSha) ||
    !COMMIT_PATTERN.test(reviewedCommit) ||
    githubSha !== reviewedCommit
  ) {
    errors.push("reviewed_commit");
  }
}

function evaluateTargets(environment, errors) {
  const appOrigin = strictOrigin(environment.NEXT_PUBLIC_APP_URL);
  const targetOrigin = strictOrigin(environment.FANMIND_TARGET_API_ORIGIN);
  const productionOrigin = strictOrigin(environment.FANMIND_PRODUCTION_API_ORIGIN);
  if (!appOrigin || !targetOrigin || appOrigin !== targetOrigin) {
    errors.push("api_target_binding");
  }
  if (!productionOrigin || targetOrigin === productionOrigin) {
    errors.push("production_api_target");
  }

  const pgHost = normalizedHost(environment.PGHOST);
  const targetHost = normalizedHost(environment.FANMIND_TARGET_DB_HOST);
  const productionHost = normalizedHost(environment.FANMIND_PRODUCTION_DB_HOST);
  if (!pgHost || !targetHost || pgHost !== targetHost) {
    errors.push("database_host_binding");
  }
  if (!productionHost || pgHost === productionHost) {
    errors.push("production_database_target");
  }

  const targetRef = clean(environment.FANMIND_TARGET_SUPABASE_PROJECT_REF).toLowerCase();
  const productionRef = clean(
    environment.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF,
  ).toLowerCase();
  const pgUser = clean(environment.PGUSER).toLowerCase();
  if (
    !/^[a-z]{20}$/u.test(targetRef) ||
    !/^[a-z]{20}$/u.test(productionRef) ||
    targetRef === productionRef ||
    pgUser !== `postgres.${targetRef}` ||
    pgUser === `postgres.${productionRef}`
  ) {
    errors.push("database_project_binding");
  }
  if (
    clean(environment.PGPORT) !== "5432" ||
    !DB_IDENTITY_PATTERN.test(clean(environment.PGDATABASE)) ||
    !DB_IDENTITY_PATTERN.test(clean(environment.PGUSER)) ||
    !pgHost.endsWith(".pooler.supabase.com")
  ) {
    errors.push("database_identity");
  }
  if (
    clean(environment.PGSSLMODE).toLowerCase() !== "verify-full" ||
    !clean(environment.PGSSLROOTCERT).startsWith("/")
  ) {
    errors.push("database_tls");
  }
  for (const redirect of ["PGHOSTADDR", "PGSERVICE", "PGSERVICEFILE", "PGSYSCONFDIR"]) {
    if (clean(environment[redirect])) errors.push("libpq_redirect");
  }
}

export function evaluateSocialProviderSchemaStagingEnvironment(
  environment = {},
  { mode = "verify" } = {},
) {
  if (!MODES.has(mode)) {
    return Object.freeze({ ok: false, mode, writeEnabled: false, errors: ["mode"] });
  }
  const allowWrite = mode === "apply";
  const errors = [];
  const boundary = evaluateEnvironmentBoundary(environment, { allowWrite });
  if (!boundary.ok) errors.push("environment_boundary");
  if (boundary.runtimeEnvironment !== "staging") errors.push("runtime_environment");
  if (
    boundary.appProduction ||
    !boundary.productionProjectIdentified ||
    boundary.supabaseProductionMatch ||
    !boundary.supabaseTargetRefMatchesUrl ||
    boundary.supabaseTargetRefMismatch
  ) {
    errors.push("production_target");
  }

  evaluateCommitBinding(environment, errors);
  if (clean(environment.FANMIND_SOCIAL_PILOT_ENABLED) === "true") errors.push("runtime_must_remain_disabled");
  if (mode === "verify" && clean(environment.FANMIND_ENABLE_NON_PRODUCTION_WRITES) !== "false") errors.push("verify_write_gate");
  evaluateTargets(environment, errors);

  const confirmation = clean(mode === "apply" ? environment.FANMIND_SOCIAL_PROVIDER_SCHEMA_APPLY_CONFIRM : environment.FANMIND_SOCIAL_PROVIDER_SCHEMA_VERIFY_CONFIRM);
  const expected = mode === "apply" ? SOCIAL_PROVIDER_SCHEMA_APPLY_CONFIRMATION : SOCIAL_PROVIDER_SCHEMA_VERIFY_CONFIRMATION;
  if (confirmation !== expected) errors.push("confirmation");
  if (
    allowWrite &&
    clean(environment.FANMIND_NON_PRODUCTION_WRITE_ACK) !==
      NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT
  ) {
    errors.push("write_acknowledgement");
  }

  return Object.freeze({
    ok: errors.length === 0,
    mode,
    writeEnabled: allowWrite,
    errors: Object.freeze([...new Set(errors)]),
  });
}

export { COMMIT_PATTERN };
