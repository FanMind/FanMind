import { isAbsolute } from "node:path";

import {
  NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT,
  evaluateEnvironmentBoundary,
} from "./environmentBoundaryPolicy.mjs";

export const META_CONTENT_STAGING_MIGRATION_CONFIRMATION =
  "apply-meta-content-intelligence-migrations";
export const META_CONTENT_STAGING_VERIFY_CONFIRMATION =
  "verify-meta-content-intelligence-schema";
export const META_CONTENT_STAGING_RESOURCE_CONFIRMATION =
  "verify-meta-content-staging-resources";

const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const DB_IDENTITY_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/u;
const HOST_PATTERN =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/u;

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
  const githubRef = clean(environment.GITHUB_REF);
  const githubSha = clean(environment.GITHUB_SHA).toLowerCase();
  const reviewedCommit = clean(
    environment.FANMIND_META_CONTENT_REVIEWED_COMMIT,
  ).toLowerCase();
  if (githubRef !== "refs/heads/main") errors.push("main_ref");
  if (
    !COMMIT_PATTERN.test(githubSha) ||
    !COMMIT_PATTERN.test(reviewedCommit) ||
    githubSha !== reviewedCommit
  ) {
    errors.push("reviewed_commit");
  }
}

function evaluateTargetBinding(environment, errors) {
  const targetApiOrigin = strictOrigin(
    environment.FANMIND_TARGET_API_ORIGIN,
  );
  const appOrigin = strictOrigin(environment.NEXT_PUBLIC_APP_URL);
  const productionApiOrigin = strictOrigin(
    environment.FANMIND_PRODUCTION_API_ORIGIN,
  );
  if (
    !targetApiOrigin ||
    !appOrigin ||
    !productionApiOrigin ||
    targetApiOrigin !== appOrigin
  ) {
    errors.push("api_target_binding");
  }
  if (targetApiOrigin && targetApiOrigin === productionApiOrigin) {
    errors.push("production_api_target");
  }

  const pgHost = normalizedHost(environment.PGHOST);
  const expectedHost = normalizedHost(environment.FANMIND_TARGET_DB_HOST);
  const productionHost = normalizedHost(
    environment.FANMIND_PRODUCTION_DB_HOST,
  );
  if (!pgHost || !expectedHost || pgHost !== expectedHost) {
    errors.push("database_host_binding");
  }
  // Supabase session-pooler hostnames are regional shared infrastructure.
  // Project separation is therefore bound by the independently checked
  // project refs plus the project-qualified database user, not by requiring
  // two different shared pooler hostnames.
  if (!productionHost) {
    errors.push("production_database_target");
  }

  const pgPort = clean(environment.PGPORT);
  const targetProjectRef = clean(
    environment.FANMIND_TARGET_SUPABASE_PROJECT_REF,
  ).toLowerCase();
  const pgUser = clean(environment.PGUSER).toLowerCase();
  if (
    !/^[0-9]{1,5}$/u.test(pgPort) ||
    Number(pgPort) < 1 ||
    Number(pgPort) > 65_535 ||
    !DB_IDENTITY_PATTERN.test(clean(environment.PGDATABASE)) ||
    !DB_IDENTITY_PATTERN.test(clean(environment.PGUSER))
  ) {
    errors.push("database_identity");
  }
  if (!pgHost.endsWith(".pooler.supabase.com") || pgPort !== "5432") {
    errors.push("database_session_pooler");
  }
  if (!targetProjectRef || pgUser !== `postgres.${targetProjectRef}`) {
    errors.push("database_user_project_binding");
  }

  for (const redirect of [
    "DATABASE_URL",
    "POSTGRES_URL",
    "SUPABASE_DB_URL",
    "PGHOSTADDR",
    "PGSERVICE",
    "PGSERVICEFILE",
    "PGSYSCONFDIR",
  ]) {
    if (clean(environment[redirect])) errors.push("database_redirect");
  }
}

function evaluateTlsBinding(environment, errors) {
  if (clean(environment.PGSSLMODE).toLowerCase() !== "verify-full") {
    errors.push("tls_mode");
  }
  const rootCertificate = clean(environment.PGSSLROOTCERT);
  if (!rootCertificate || !isAbsolute(rootCertificate)) {
    errors.push("tls_root_certificate");
  }
  for (const key of [
    "PGSSLCERT",
    "PGSSLKEY",
    "PGSSLPASSWORD",
    "PGSSLCRL",
    "PGSSLCRLDIR",
  ]) {
    if (clean(environment[key])) errors.push("tls_client_override");
  }
}

export function evaluateMetaContentStagingMigrationEnvironment(
  environment = {},
  { mode = "verify" } = {},
) {
  const errors = [];
  if (mode !== "verify" && mode !== "apply" && mode !== "readiness") {
    return Object.freeze({ ok: false, mode, errors: ["mode"] });
  }

  const allowWrite = mode === "apply";
  const boundary = evaluateEnvironmentBoundary(environment, { allowWrite });
  if (!boundary.ok) errors.push("environment_boundary");
  if (boundary.runtimeEnvironment !== "staging") {
    errors.push("runtime_environment");
  }
  if (boundary.appProduction || boundary.supabaseProductionMatch) {
    errors.push("production_target");
  }
  if (
    !boundary.supabaseTargetRefMatchesUrl ||
    boundary.supabaseTargetRefMismatch
  ) {
    errors.push("supabase_target_binding");
  }

  evaluateCommitBinding(environment, errors);
  evaluateTargetBinding(environment, errors);
  evaluateTlsBinding(environment, errors);

  const expectedConfirmation =
    mode === "apply"
      ? META_CONTENT_STAGING_MIGRATION_CONFIRMATION
      : mode === "readiness"
        ? META_CONTENT_STAGING_RESOURCE_CONFIRMATION
        : META_CONTENT_STAGING_VERIFY_CONFIRMATION;
  const confirmationKey =
    mode === "apply"
      ? "FANMIND_META_CONTENT_STAGING_MIGRATION_CONFIRM"
      : mode === "readiness"
        ? "FANMIND_META_CONTENT_STAGING_RESOURCE_CONFIRM"
        : "FANMIND_META_CONTENT_STAGING_VERIFY_CONFIRM";
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

  return Object.freeze({
    ok: errors.length === 0,
    mode,
    writeEnabled: allowWrite,
    errors: Object.freeze([...new Set(errors)]),
  });
}

export { COMMIT_PATTERN };
