import {
  NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT,
  evaluateEnvironmentBoundary,
} from "./environmentBoundaryPolicy.mjs";

export const REFERRAL_ATTRIBUTION_VERIFY_CONFIRMATION =
  "verify-referral-attribution-integrity";
export const REFERRAL_ATTRIBUTION_APPLY_CONFIRMATION =
  "apply-referral-attribution-integrity";

const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const DB_IDENTITY_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/u;
const HOST_PATTERN =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/u;
const MODES = new Set(["verify", "apply"]);

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedHost(value) {
  const candidate = clean(value).toLowerCase().replace(/\.$/u, "");
  return HOST_PATTERN.test(candidate) ? candidate : "";
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

function evaluateCommitBinding(environment, errors) {
  const githubSha = clean(environment.GITHUB_SHA).toLowerCase();
  const reviewedCommit = clean(
    environment.FANMIND_REFERRAL_ATTRIBUTION_REVIEWED_COMMIT,
  ).toLowerCase();
  if (clean(environment.GITHUB_REF) !== "refs/heads/main") {
    errors.push("main_ref");
  }
  if (
    !COMMIT_PATTERN.test(githubSha) ||
    !COMMIT_PATTERN.test(reviewedCommit) ||
    githubSha !== reviewedCommit
  ) {
    errors.push("reviewed_commit");
  }
}

function evaluateApiTarget(environment, errors) {
  const appOrigin = strictOrigin(environment.NEXT_PUBLIC_APP_URL);
  const targetOrigin = strictOrigin(environment.FANMIND_TARGET_API_ORIGIN);
  const productionOrigin = strictOrigin(
    environment.FANMIND_PRODUCTION_API_ORIGIN,
  );
  if (!appOrigin || !targetOrigin || appOrigin !== targetOrigin) {
    errors.push("api_target_binding");
  }
  if (!productionOrigin || (targetOrigin && targetOrigin === productionOrigin)) {
    errors.push("production_api_target");
  }
}

function evaluateDatabaseTarget(environment, errors) {
  const pgHost = normalizedHost(environment.PGHOST);
  const targetHost = normalizedHost(environment.FANMIND_TARGET_DB_HOST);
  const productionHost = normalizedHost(
    environment.FANMIND_PRODUCTION_DB_HOST,
  );
  if (!pgHost || !targetHost || pgHost !== targetHost) {
    errors.push("database_host_binding");
  }
  if (!productionHost) errors.push("production_database_target");

  const targetProjectRef = clean(
    environment.FANMIND_TARGET_SUPABASE_PROJECT_REF,
  ).toLowerCase();
  const productionProjectRef = clean(
    environment.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF,
  ).toLowerCase();
  const pgUser = clean(environment.PGUSER).toLowerCase();
  if (
    clean(environment.PGPORT) !== "5432" ||
    !DB_IDENTITY_PATTERN.test(clean(environment.PGDATABASE)) ||
    !DB_IDENTITY_PATTERN.test(clean(environment.PGUSER))
  ) {
    errors.push("database_identity");
  }
  if (!pgHost.endsWith(".pooler.supabase.com")) {
    errors.push("database_session_pooler");
  }
  if (
    !targetProjectRef ||
    !productionProjectRef ||
    targetProjectRef === productionProjectRef
  ) {
    errors.push("production_database_target");
  }
  if (
    pgUser !== `postgres.${targetProjectRef}` ||
    pgUser === `postgres.${productionProjectRef}`
  ) {
    errors.push("database_user_project_binding");
  }
  if (
    clean(environment.PGSSLMODE).toLowerCase() !== "verify-full" ||
    !clean(environment.PGSSLROOTCERT).startsWith("/")
  ) {
    errors.push("database_tls");
  }
  for (const redirect of [
    "DATABASE_URL",
    "POSTGRES_URL",
    "SUPABASE_DB_URL",
    "PGPASSWORD",
    "PGHOSTADDR",
    "PGSERVICE",
    "PGSERVICEFILE",
    "PGSYSCONFDIR",
  ]) {
    if (clean(environment[redirect])) errors.push("libpq_redirect");
  }
}

export function evaluateReferralAttributionMigrationEnvironment(
  environment = {},
  { mode = "verify" } = {},
) {
  if (!MODES.has(mode)) {
    return Object.freeze({
      ok: false,
      mode,
      writeEnabled: false,
      errors: ["mode"],
    });
  }

  const errors = [];
  const allowWrite = mode === "apply";
  const boundary = evaluateEnvironmentBoundary(environment, { allowWrite });
  if (!boundary.ok) errors.push("environment_boundary");
  if (boundary.runtimeEnvironment !== "staging") {
    errors.push("runtime_environment");
  }
  if (
    boundary.appProduction ||
    !boundary.productionProjectIdentified ||
    boundary.supabaseProductionMatch
  ) {
    errors.push("production_target");
  }
  if (
    !boundary.supabaseTargetRefMatchesUrl ||
    boundary.supabaseTargetRefMismatch
  ) {
    errors.push("supabase_target_binding");
  }

  evaluateCommitBinding(environment, errors);
  evaluateApiTarget(environment, errors);
  evaluateDatabaseTarget(environment, errors);

  const confirmationKey = allowWrite
    ? "FANMIND_REFERRAL_ATTRIBUTION_APPLY_CONFIRM"
    : "FANMIND_REFERRAL_ATTRIBUTION_VERIFY_CONFIRM";
  const expectedConfirmation = allowWrite
    ? REFERRAL_ATTRIBUTION_APPLY_CONFIRMATION
    : REFERRAL_ATTRIBUTION_VERIFY_CONFIRMATION;
  if (clean(environment[confirmationKey]) !== expectedConfirmation) {
    errors.push("confirmation");
  }
  if (
    allowWrite &&
    clean(environment.FANMIND_NON_PRODUCTION_WRITE_ACK) !==
      NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT
  ) {
    errors.push("write_acknowledgement");
  }
  if (
    clean(environment.FANMIND_ENABLE_REFERRAL_BILLING) !== "false" ||
    clean(environment.FANMIND_REFERRAL_SANDBOX_ACK) ||
    clean(environment.STRIPE_SECRET_KEY) ||
    clean(environment.STRIPE_WEBHOOK_SECRET)
  ) {
    errors.push("provider_write_boundary");
  }

  return Object.freeze({
    ok: errors.length === 0,
    mode,
    writeEnabled: allowWrite,
    errors: Object.freeze([...new Set(errors)]),
  });
}

export { COMMIT_PATTERN };
