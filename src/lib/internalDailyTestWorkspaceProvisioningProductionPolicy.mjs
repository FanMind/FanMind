export const DAILY_PRODUCTION_VERIFY_CONFIRMATION =
  "verify-daily-workspace-provisioning-production";
export const DAILY_PRODUCTION_APPLY_CONFIRMATION =
  "apply-daily-workspace-provisioning-production";

const SHA = /^[0-9a-f]{40}$/u;
const REF = /^[a-z0-9]{20}$/u;
const HOST = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/u;
const clean = (value) => (typeof value === "string" ? value.trim() : "");

export function evaluateInternalDailyTestWorkspaceProvisioningProductionEnvironment(
  environment = {},
  { mode = "verify" } = {},
) {
  const errors = [];
  const sha = clean(environment.GITHUB_SHA).toLowerCase();
  const reviewed = clean(
    environment.FANMIND_INTERNAL_DAILY_TEST_WORKSPACE_PROVISIONING_REVIEWED_COMMIT,
  ).toLowerCase();
  const projectRef = clean(
    environment.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF,
  ).toLowerCase();
  const targetRef = clean(environment.FANMIND_TARGET_SUPABASE_PROJECT_REF).toLowerCase();
  const host = clean(environment.PGHOST).toLowerCase().replace(/\.$/u, "");
  const targetHost = clean(environment.FANMIND_PRODUCTION_DB_HOST)
    .toLowerCase()
    .replace(/\.$/u, "");
  const expectedConfirmation =
    mode === "apply"
      ? DAILY_PRODUCTION_APPLY_CONFIRMATION
      : DAILY_PRODUCTION_VERIFY_CONFIRMATION;

  if (!new Set(["verify", "apply"]).has(mode)) errors.push("mode");
  if (clean(environment.GITHUB_REF) !== "refs/heads/main") errors.push("main_ref");
  if (!SHA.test(sha) || sha !== reviewed) errors.push("reviewed_commit");
  if (clean(environment.FANMIND_RUNTIME_ENVIRONMENT) !== "production")
    errors.push("runtime_environment");
  if (
    clean(environment.NEXT_PUBLIC_APP_URL) !== "https://fanmind.ch" ||
    clean(environment.FANMIND_TARGET_API_ORIGIN) !== "https://fanmind.ch"
  ) errors.push("api_target_binding");
  if (!REF.test(projectRef) || projectRef !== targetRef) errors.push("project_binding");
  if (
    clean(environment.NEXT_PUBLIC_SUPABASE_URL) !==
    `https://${projectRef}.supabase.co`
  ) errors.push("supabase_binding");
  if (!HOST.test(host) || host !== targetHost || !host.endsWith(".pooler.supabase.com"))
    errors.push("database_host_binding");
  if (
    clean(environment.PGPORT) !== "5432" ||
    clean(environment.PGDATABASE) !== "postgres" ||
    clean(environment.PGUSER).toLowerCase() !== `postgres.${projectRef}`
  ) errors.push("database_identity");
  if (
    clean(environment.PGSSLMODE).toLowerCase() !== "verify-full" ||
    !clean(environment.PGSSLROOTCERT).startsWith("/")
  ) errors.push("database_tls");
  for (const key of ["DATABASE_URL", "POSTGRES_URL", "SUPABASE_DB_URL", "PGPASSWORD", "PGHOSTADDR", "PGSERVICE", "PGSERVICEFILE"])
    if (clean(environment[key])) errors.push("libpq_redirect");
  if (
    clean(environment.FANMIND_INTERNAL_DAILY_TEST_WORKSPACE_PROVISIONING_PRODUCTION_CONFIRM) !==
    expectedConfirmation
  ) errors.push("confirmation");
  if (
    mode === "apply" &&
    (clean(environment.FANMIND_ENABLE_PRODUCTION_WRITES) !== "true" ||
      clean(environment.FANMIND_PRODUCTION_WRITE_ACK) !==
        "I_UNDERSTAND_THIS_MUTATES_PRODUCTION" ||
      clean(environment.FANMIND_DAILY_PRODUCTION_READINESS_DECISION) !==
        "APPLY")
  ) errors.push("production_write_gate");

  return Object.freeze({
    ok: errors.length === 0,
    mode,
    writeEnabled: mode === "apply" && errors.length === 0,
    errors: Object.freeze([...new Set(errors)]),
  });
}
