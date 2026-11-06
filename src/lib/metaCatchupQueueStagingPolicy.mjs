import {
  NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT,
  evaluateEnvironmentBoundary,
} from "./environmentBoundaryPolicy.mjs";

export const META_CATCHUP_QUEUE_VERIFY_CONFIRMATION =
  "verify-meta-catchup-queue";
export const META_CATCHUP_QUEUE_APPLY_CONFIRMATION =
  "apply-meta-catchup-queue";
export const META_CATCHUP_QUEUE_ACCEPTANCE_CONFIRMATION =
  "run-meta-catchup-queue-staging-acceptance";

const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const DB_IDENTITY_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/u;
const HOST_PATTERN = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/u;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const MODES = new Set(["verify", "apply", "acceptance"]);

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
    environment.FANMIND_META_CATCHUP_QUEUE_REVIEWED_COMMIT,
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
    !targetRef ||
    !productionRef ||
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

export function evaluateMetaCatchupQueueStagingEnvironment(
  environment = {},
  { mode = "verify" } = {},
) {
  if (!MODES.has(mode)) {
    return Object.freeze({ ok: false, mode, writeEnabled: false, errors: ["mode"] });
  }
  const allowWrite = mode === "apply" || mode === "acceptance";
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
  evaluateTargets(environment, errors);

  const confirmation =
    mode === "acceptance"
      ? clean(environment.FANMIND_META_CATCHUP_QUEUE_ACCEPTANCE_CONFIRM)
      : mode === "apply"
        ? clean(environment.FANMIND_META_CATCHUP_QUEUE_APPLY_CONFIRM)
        : clean(environment.FANMIND_META_CATCHUP_QUEUE_VERIFY_CONFIRM);
  const expected =
    mode === "acceptance"
      ? META_CATCHUP_QUEUE_ACCEPTANCE_CONFIRMATION
      : mode === "apply"
        ? META_CATCHUP_QUEUE_APPLY_CONFIRMATION
        : META_CATCHUP_QUEUE_VERIFY_CONFIRMATION;
  if (confirmation !== expected) errors.push("confirmation");
  if (
    mode === "acceptance" &&
    !UUID_PATTERN.test(
      clean(environment.FANMIND_META_CATCHUP_QUEUE_STAGING_WORKSPACE_ID),
    )
  ) {
    errors.push("synthetic_workspace");
  }
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
