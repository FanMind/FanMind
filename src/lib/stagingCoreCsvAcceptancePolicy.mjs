import { createHash } from "node:crypto";

export const STAGING_CORE_CSV_ACCEPTANCE_CONFIRMATION =
  "run-staging-core-csv-acceptance";
export const STAGING_CORE_CSV_ACCEPTANCE_CONTACT_NAME =
  "Sandra Staging Core Acceptance";
export const STAGING_CORE_CSV_ACCEPTANCE_IMPORTED_NAME =
  "CSV Staging Core Acceptance";
export const STAGING_CORE_CSV_ACCEPTANCE_IMPORTED_HANDLE =
  "fanmind-staging-core-csv";
export const STAGING_CORE_CSV_ACCEPTANCE_IMPORTED_SUMMARY =
  "Kontrollierte synthetische Staging-CSV-Acceptance.";
export const STAGING_CORE_CSV_ACCEPTANCE_INBOUND_MESSAGE =
  "Hallo, bitte erinnere mich am Montag an die neuen Termine und merke dir, dass Montag für mich am besten passt.";
export const STAGING_CORE_CSV_ACCEPTANCE_APP_ORIGIN =
  "https://staging.fanmind.ch";

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const PROJECT_REF_PATTERN = /^[a-z0-9]{8,64}$/u;
const DATABASE_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/u;
const HOST_PATTERN =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/u;
const SYNTHETIC_EMAIL_PATTERN = /staging|synthetic|test/iu;

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function origin(value) {
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

function host(value) {
  const candidate = clean(value).toLowerCase().replace(/\.$/u, "");
  return HOST_PATTERN.test(candidate) ? candidate : "";
}

function validSyntheticEmail(value) {
  const email = clean(value).toLowerCase();
  return (
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) &&
    SYNTHETIC_EMAIL_PATTERN.test(email)
  );
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

export function deriveStagingCoreCsvAcceptanceIds(workspaceId) {
  const workspace = clean(workspaceId).toLowerCase();
  if (!UUID_PATTERN.test(workspace)) {
    throw new Error("STAGING_CORE_CSV_ACCEPTANCE_ERROR=workspace_identity");
  }
  const uuid = (label) => {
    const hex = createHash("sha256")
      .update(`fanmind-staging-core-csv-v1:${workspace}:${label}`)
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
  };
  return {
    contactId: uuid("contact"),
    conversationId: uuid("conversation"),
    messageId: uuid("message"),
  };
}

export function evaluateStagingCoreCsvAcceptanceEnvironment(environment = {}) {
  const errors = [];
  const appOrigin = origin(environment.NEXT_PUBLIC_APP_URL);
  const supabaseOrigin = origin(environment.FANMIND_STAGING_SUPABASE_URL);
  const targetRef = clean(environment.FANMIND_TARGET_SUPABASE_PROJECT_REF)
    .toLowerCase();
  const productionRef = clean(
    environment.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF,
  ).toLowerCase();
  const reviewedCommit = clean(
    environment.FANMIND_STAGING_CORE_REVIEWED_COMMIT,
  ).toLowerCase();
  const githubSha = clean(environment.GITHUB_SHA).toLowerCase();
  const primaryEmail = clean(environment.FANMIND_STAGING_E2E_EMAIL)
    .toLowerCase();
  const secondaryEmail = clean(
    environment.FANMIND_STAGING_E2E_SECONDARY_EMAIL,
  ).toLowerCase();
  const passwords = [
    environment.FANMIND_STAGING_E2E_PASSWORD,
    environment.FANMIND_STAGING_E2E_SECONDARY_PASSWORD,
    environment.FANMIND_STAGING_E2E_MEMBER_PASSWORD,
  ];

  if (clean(environment.FANMIND_RUNTIME_ENVIRONMENT) !== "staging") {
    errors.push("runtime_environment");
  }
  if (
    appOrigin !== STAGING_CORE_CSV_ACCEPTANCE_APP_ORIGIN
  ) {
    errors.push("application_boundary");
  }
  if (
    !PROJECT_REF_PATTERN.test(targetRef) ||
    !PROJECT_REF_PATTERN.test(productionRef) ||
    targetRef === productionRef ||
    supabaseOrigin !== `https://${targetRef}.supabase.co`
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
      "I_UNDERSTAND_NON_PRODUCTION_ONLY" ||
    clean(environment.FANMIND_STAGING_CORE_CONFIRM) !==
      STAGING_CORE_CSV_ACCEPTANCE_CONFIRMATION
  ) {
    errors.push("write_confirmation");
  }
  if (
    !validSyntheticEmail(primaryEmail) ||
    !validSyntheticEmail(secondaryEmail) ||
    primaryEmail === secondaryEmail
  ) {
    errors.push("synthetic_identities");
  }
  if (
    passwords.some((password) => !validPassword(password)) ||
    new Set(passwords).size !== passwords.length
  ) {
    errors.push("synthetic_passwords");
  }
  const fixtureIds = [
    environment.FANMIND_STAGING_E2E_WORKSPACE_ID,
    environment.FANMIND_STAGING_E2E_CONTACT_ID,
    environment.FANMIND_STAGING_E2E_SECONDARY_WORKSPACE_ID,
    environment.FANMIND_STAGING_E2E_SECONDARY_CONTACT_ID,
  ].map((value) => clean(value).toLowerCase());
  if (
    fixtureIds.some((value) => !UUID_PATTERN.test(value)) ||
    new Set(fixtureIds).size !== fixtureIds.length
  ) {
    errors.push("fixture_identity");
  }

  const pgHost = host(environment.PGHOST);
  const targetHost = host(environment.FANMIND_TARGET_DB_HOST);
  if (
    !pgHost ||
    pgHost !== targetHost ||
    !pgHost.endsWith(".pooler.supabase.com") ||
    clean(environment.PGPORT) !== "5432" ||
    !DATABASE_NAME_PATTERN.test(clean(environment.PGDATABASE)) ||
    clean(environment.PGUSER) !== `postgres.${targetRef}` ||
    clean(environment.PGSSLMODE) !== "verify-full" ||
    !clean(environment.PGSSLROOTCERT).startsWith("/")
  ) {
    errors.push("database_boundary");
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
