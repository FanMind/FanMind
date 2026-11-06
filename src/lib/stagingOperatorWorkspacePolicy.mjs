export const STAGING_OPERATOR_WORKSPACE_CONFIRMATION =
  "provision-staging-operator-workspace";
export const STAGING_OPERATOR_WORKSPACE_NAME = "FanMind Staging Operator";
export const STAGING_OPERATOR_WORKSPACE_FLAG = "staging_operator_workspace";

const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const PROJECT_REF_PATTERN = /^[a-z0-9]{8,64}$/u;
const DATABASE_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
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

export function normalizeStagingAdminEmails(value) {
  const emails = clean(value)
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (
    emails.length === 0 ||
    emails.some((email) => !EMAIL_PATTERN.test(email)) ||
    new Set(emails).size !== emails.length
  ) {
    return [];
  }
  return emails;
}

export function evaluateStagingOperatorWorkspaceEnvironment(environment = {}) {
  const errors = [];
  const appOrigin = normalizedOrigin(environment.NEXT_PUBLIC_APP_URL);
  const targetProjectRef = clean(
    environment.FANMIND_TARGET_SUPABASE_PROJECT_REF,
  ).toLowerCase();
  const productionProjectRef = clean(
    environment.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF,
  ).toLowerCase();
  const reviewedCommit = clean(
    environment.FANMIND_STAGING_OPERATOR_REVIEWED_COMMIT,
  ).toLowerCase();
  const githubSha = clean(environment.GITHUB_SHA).toLowerCase();
  const operatorEmail = clean(
    environment.FANMIND_STAGING_OPERATOR_EMAIL,
  ).toLowerCase();
  const adminEmails = normalizeStagingAdminEmails(
    environment.FANMIND_STAGING_ADMIN_EMAILS,
  );
  const pgHost = normalizedHost(environment.PGHOST);
  const expectedHost = normalizedHost(environment.FANMIND_TARGET_DB_HOST);

  if (clean(environment.FANMIND_RUNTIME_ENVIRONMENT) !== "staging") {
    errors.push("runtime_environment");
  }
  if (
    !appOrigin ||
    !new URL(appOrigin).hostname.includes("staging") ||
    appOrigin === "https://fanmind.ch" ||
    appOrigin === "https://www.fanmind.ch"
  ) {
    errors.push("application_boundary");
  }
  if (
    !PROJECT_REF_PATTERN.test(targetProjectRef) ||
    !PROJECT_REF_PATTERN.test(productionProjectRef) ||
    targetProjectRef === productionProjectRef
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
    clean(environment.FANMIND_STAGING_OPERATOR_CONFIRM) !==
    STAGING_OPERATOR_WORKSPACE_CONFIRMATION
  ) {
    errors.push("operator_confirmation");
  }
  if (
    !EMAIL_PATTERN.test(operatorEmail) ||
    adminEmails.length === 0 ||
    !adminEmails.includes(operatorEmail)
  ) {
    errors.push("operator_admin_allowlist");
  }
  if (
    !pgHost ||
    !expectedHost ||
    pgHost !== expectedHost ||
    !pgHost.endsWith(".pooler.supabase.com")
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
