import {
  NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT,
  evaluateEnvironmentBoundary,
} from "./environmentBoundaryPolicy.mjs";

export const MOBILE_PUSH_STAGING_RESOURCE_CONFIRMATION =
  "verify-mobile-push-staging-resources";
export const MOBILE_PUSH_STAGING_MIGRATION_CONFIRMATION =
  "apply-mobile-push-registration-migration";
export const MOBILE_PUSH_STAGING_SCHEMA_CONFIRMATION =
  "verify-mobile-push-registration-schema";
export const MOBILE_PUSH_STAGING_ACCEPTANCE_CONFIRMATION =
  "run-mobile-push-staging-acceptance";
export const MOBILE_PUSH_DELIVERY_LEDGER_SCHEMA_CONFIRMATION =
  "verify-mobile-push-delivery-ledger-schema";
export const MOBILE_PUSH_DELIVERY_LEDGER_MIGRATION_CONFIRMATION =
  "apply-mobile-push-delivery-ledger";

const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const DB_IDENTITY_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/u;
const HOST_PATTERN =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/u;
const CONTROL_MODES = new Set([
  "resource",
  "schema",
  "migration",
  "acceptance",
  "ledger_schema",
  "ledger_migration",
]);

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
    environment.FANMIND_MOBILE_PUSH_REVIEWED_COMMIT,
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
  if (!productionHost || (pgHost && pgHost === productionHost)) {
    errors.push("production_database_target");
  }

  const pgPort = clean(environment.PGPORT);
  const pgDatabase = clean(environment.PGDATABASE);
  const pgUser = clean(environment.PGUSER);
  if (
    !/^[0-9]{1,5}$/u.test(pgPort) ||
    Number(pgPort) < 1 ||
    Number(pgPort) > 65_535 ||
    !DB_IDENTITY_PATTERN.test(pgDatabase) ||
    !DB_IDENTITY_PATTERN.test(pgUser)
  ) {
    errors.push("database_identity");
  }
  for (const redirect of [
    "PGHOSTADDR",
    "PGSERVICE",
    "PGSERVICEFILE",
    "PGSYSCONFDIR",
  ]) {
    if (clean(environment[redirect])) errors.push("libpq_redirect");
  }
}

export function evaluateMobilePushSyntheticIdentifiers(environment = {}) {
  const values = [
    environment.FANMIND_MOBILE_PUSH_STAGING_WORKSPACE_ID,
    environment.FANMIND_MOBILE_PUSH_STAGING_OWNER_USER_ID,
    environment.FANMIND_MOBILE_PUSH_STAGING_MEMBER_USER_ID,
    environment.FANMIND_MOBILE_PUSH_STAGING_EAS_PROJECT_ID,
    environment.FANMIND_MOBILE_PUSH_STAGING_DEVICE_ID,
  ].map((value) => clean(value).toLowerCase());
  return Object.freeze({
    ok:
      values.every((value) => UUID_PATTERN.test(value)) &&
      new Set(values).size === values.length,
    workspaceId: values[0] ?? "",
    ownerUserId: values[1] ?? "",
    memberUserId: values[2] ?? "",
    easProjectId: values[3] ?? "",
    deviceId: values[4] ?? "",
  });
}

export function evaluateMobilePushStagingControlEnvironment(
  environment = {},
  { mode = "resource" } = {},
) {
  const errors = [];
  if (!CONTROL_MODES.has(mode)) {
    return Object.freeze({ ok: false, mode, errors: ["mode"] });
  }

  const allowWrite =
    mode === "migration" ||
    mode === "acceptance" ||
    mode === "ledger_migration";
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

  const confirmationByMode = {
    resource: [
      "FANMIND_MOBILE_PUSH_STAGING_RESOURCE_CONFIRM",
      MOBILE_PUSH_STAGING_RESOURCE_CONFIRMATION,
    ],
    schema: [
      "FANMIND_MOBILE_PUSH_STAGING_SCHEMA_CONFIRM",
      MOBILE_PUSH_STAGING_SCHEMA_CONFIRMATION,
    ],
    migration: [
      "FANMIND_MOBILE_PUSH_STAGING_MIGRATION_CONFIRM",
      MOBILE_PUSH_STAGING_MIGRATION_CONFIRMATION,
    ],
    acceptance: [
      "FANMIND_MOBILE_PUSH_STAGING_ACCEPTANCE_CONFIRM",
      MOBILE_PUSH_STAGING_ACCEPTANCE_CONFIRMATION,
    ],
    ledger_schema: [
      "FANMIND_MOBILE_PUSH_DELIVERY_LEDGER_SCHEMA_CONFIRM",
      MOBILE_PUSH_DELIVERY_LEDGER_SCHEMA_CONFIRMATION,
    ],
    ledger_migration: [
      "FANMIND_MOBILE_PUSH_DELIVERY_LEDGER_MIGRATION_CONFIRM",
      MOBILE_PUSH_DELIVERY_LEDGER_MIGRATION_CONFIRMATION,
    ],
  };
  const [confirmationKey, expectedConfirmation] = confirmationByMode[mode];
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

  const syntheticIdentifiers = evaluateMobilePushSyntheticIdentifiers(
    environment,
  );
  if (
    (mode === "resource" || mode === "acceptance") &&
    !syntheticIdentifiers.ok
  ) {
    errors.push("synthetic_identifiers");
  }

  return Object.freeze({
    ok: errors.length === 0,
    mode,
    writeEnabled: allowWrite,
    syntheticIdentifiers,
    errors: Object.freeze([...new Set(errors)]),
  });
}

export {
  COMMIT_PATTERN,
  UUID_PATTERN,
};
