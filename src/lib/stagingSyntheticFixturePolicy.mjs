import { createHash } from "node:crypto";

export const STAGING_SYNTHETIC_FIXTURE_CONFIRMATION =
  "provision-staging-synthetic-fixtures";
export const STAGING_SYNTHETIC_PRIMARY_WORKSPACE_NAME =
  "FanMind Staging Processing Acceptance";
export const STAGING_SYNTHETIC_SECONDARY_WORKSPACE_NAME =
  "FanMind Staging Secondary E2E";
export const STAGING_SYNTHETIC_MEMBER_EMAIL =
  "fanmind-ai-member-staging@example.invalid";

export const STAGING_SYNTHETIC_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const PROJECT_REF_PATTERN = /^[a-z0-9]{8,64}$/u;
const DATABASE_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/u;
const HOST_PATTERN =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/u;
const SYNTHETIC_EMAIL_PATTERN = /staging|synthetic|test/iu;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

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

function validSyntheticEmail(value) {
  const email = clean(value).toLowerCase();
  return EMAIL_PATTERN.test(email) && SYNTHETIC_EMAIL_PATTERN.test(email);
}

function validPassword(value) {
  const password = typeof value === "string" ? value : "";
  return (
    password.length >= 20 &&
    /[a-z]/u.test(password) &&
    /[A-Z]/u.test(password) &&
    /[0-9]/u.test(password) &&
    /[^A-Za-z0-9]/u.test(password) &&
    !/[\r\n]/u.test(password)
  );
}

function validPublishableKey(value) {
  const key = clean(value);
  return key.startsWith("sb_publishable_") || key.startsWith("eyJ");
}

function validSecretKey(value) {
  const key = clean(value);
  return key.startsWith("sb_secret_") || key.startsWith("eyJ");
}

export function evaluateStagingSyntheticFixtureEnvironment(environment = {}) {
  const errors = [];
  const appOrigin = normalizedOrigin(environment.NEXT_PUBLIC_APP_URL);
  const targetProjectRef = clean(
    environment.FANMIND_TARGET_SUPABASE_PROJECT_REF,
  ).toLowerCase();
  const productionProjectRef = clean(
    environment.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF,
  ).toLowerCase();
  const supabaseOrigin = normalizedOrigin(
    environment.FANMIND_STAGING_SUPABASE_URL,
  );
  const reviewedCommit = clean(
    environment.FANMIND_STAGING_FIXTURE_REVIEWED_COMMIT,
  ).toLowerCase();
  const githubSha = clean(environment.GITHUB_SHA).toLowerCase();
  const primaryEmail = clean(
    environment.FANMIND_STAGING_E2E_EMAIL,
  ).toLowerCase();
  const secondaryEmail = clean(
    environment.FANMIND_STAGING_E2E_SECONDARY_EMAIL,
  ).toLowerCase();
  const primaryPassword = environment.FANMIND_STAGING_E2E_PASSWORD;
  const secondaryPassword =
    environment.FANMIND_STAGING_E2E_SECONDARY_PASSWORD;
  const memberPassword = environment.FANMIND_STAGING_E2E_MEMBER_PASSWORD;
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
    clean(environment.FANMIND_STAGING_FIXTURE_CONFIRM) !==
    STAGING_SYNTHETIC_FIXTURE_CONFIRMATION
  ) {
    errors.push("fixture_confirmation");
  }
  if (
    !validSyntheticEmail(primaryEmail) ||
    !validSyntheticEmail(secondaryEmail) ||
    primaryEmail === secondaryEmail ||
    primaryEmail === STAGING_SYNTHETIC_MEMBER_EMAIL ||
    secondaryEmail === STAGING_SYNTHETIC_MEMBER_EMAIL
  ) {
    errors.push("synthetic_emails");
  }
  if (
    !validPassword(primaryPassword) ||
    !validPassword(secondaryPassword) ||
    !validPassword(memberPassword) ||
    new Set([primaryPassword, secondaryPassword, memberPassword]).size !== 3
  ) {
    errors.push("synthetic_passwords");
  }
  const anonKey = clean(environment.FANMIND_STAGING_SUPABASE_ANON_KEY);
  const serviceKey = clean(
    environment.FANMIND_STAGING_SUPABASE_SERVICE_ROLE_KEY,
  );
  if (
    !validPublishableKey(anonKey) ||
    !validSecretKey(serviceKey) ||
    anonKey === serviceKey
  ) {
    errors.push("supabase_keys");
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

export function deriveStagingSyntheticContactId(workspaceId, role) {
  const normalizedWorkspaceId = clean(workspaceId).toLowerCase();
  const normalizedRole = clean(role).toLowerCase();
  if (
    !STAGING_SYNTHETIC_UUID_PATTERN.test(normalizedWorkspaceId) ||
    !["primary", "secondary"].includes(normalizedRole)
  ) {
    throw new Error("STAGING_SYNTHETIC_FIXTURE_ERROR=contact_identity");
  }
  const hex = createHash("sha256")
    .update(`fanmind-staging-contact-v1:${normalizedWorkspaceId}:${normalizedRole}`)
    .digest("hex")
    .slice(0, 32)
    .split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return [
    hex.slice(0, 8).join(""),
    hex.slice(8, 12).join(""),
    hex.slice(12, 16).join(""),
    hex.slice(16, 20).join(""),
    hex.slice(20, 32).join(""),
  ].join("-");
}

export function stagingSyntheticFixtureAssignments({
  primaryWorkspaceId,
  primaryContactId,
  secondaryWorkspaceId,
  secondaryContactId,
}) {
  const values = [
    primaryWorkspaceId,
    primaryContactId,
    secondaryWorkspaceId,
    secondaryContactId,
  ].map((value) => clean(value).toLowerCase());
  if (
    values.some((value) => !STAGING_SYNTHETIC_UUID_PATTERN.test(value)) ||
    new Set(values).size !== values.length
  ) {
    throw new Error("STAGING_SYNTHETIC_FIXTURE_ERROR=receipt_identity");
  }
  return {
    FANMIND_STAGING_E2E_WORKSPACE_ID: values[0],
    FANMIND_STAGING_E2E_CONTACT_ID: values[1],
    FANMIND_STAGING_E2E_SECONDARY_WORKSPACE_ID: values[2],
    FANMIND_STAGING_E2E_SECONDARY_CONTACT_ID: values[3],
    FANMIND_AI_TIER_STAGING_WORKSPACE_ID: values[0],
    FANMIND_WORKSPACE_PROCESSING_STAGING_WORKSPACE_ID: values[0],
  };
}
