import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildStagingOperatorWorkspaceSql } from "../scripts/operations/staging-operator-workspace.mjs";
import {
  STAGING_OPERATOR_WORKSPACE_CONFIRMATION,
  STAGING_OPERATOR_WORKSPACE_FLAG,
  STAGING_OPERATOR_WORKSPACE_NAME,
  evaluateStagingOperatorWorkspaceEnvironment,
  normalizeStagingAdminEmails,
} from "../src/lib/stagingOperatorWorkspacePolicy.mjs";

function acceptedEnvironment(overrides = {}) {
  return {
    FANMIND_RUNTIME_ENVIRONMENT: "staging",
    NEXT_PUBLIC_APP_URL: "https://staging.fanmind.ch",
    FANMIND_TARGET_SUPABASE_PROJECT_REF: "stagingprojectref",
    FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: "productionprojectref",
    FANMIND_STAGING_ADMIN_EMAILS:
      "operator@fanmind.ch,secondary-admin@fanmind.ch",
    FANMIND_STAGING_OPERATOR_EMAIL: "operator@fanmind.ch",
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
    FANMIND_NON_PRODUCTION_WRITE_ACK: "I_UNDERSTAND_NON_PRODUCTION_ONLY",
    FANMIND_STAGING_OPERATOR_REVIEWED_COMMIT: "a".repeat(40),
    FANMIND_STAGING_OPERATOR_CONFIRM:
      STAGING_OPERATOR_WORKSPACE_CONFIRMATION,
    GITHUB_SHA: "a".repeat(40),
    GITHUB_REF: "refs/heads/main",
    PGHOST: "aws-0-eu-west-3.pooler.supabase.com",
    FANMIND_TARGET_DB_HOST: "aws-0-eu-west-3.pooler.supabase.com",
    PGPORT: "5432",
    PGDATABASE: "postgres",
    PGUSER: "postgres.stagingprojectref",
    PGSSLMODE: "verify-full",
    PGSSLROOTCERT: "/workspace/supabase-root.crt",
    ...overrides,
  };
}

test("operator workspace environment accepts only an allowlisted exact-main Staging write", () => {
  assert.deepEqual(
    evaluateStagingOperatorWorkspaceEnvironment(acceptedEnvironment()),
    { ok: true, errors: [] },
  );

  for (const [overrides, expected] of [
    [{ FANMIND_RUNTIME_ENVIRONMENT: "production" }, "runtime_environment"],
    [{ NEXT_PUBLIC_APP_URL: "https://fanmind.ch" }, "application_boundary"],
    [
      { FANMIND_TARGET_SUPABASE_PROJECT_REF: "productionprojectref" },
      "supabase_boundary",
    ],
    [{ GITHUB_REF: "refs/heads/feature" }, "reviewed_commit"],
    [{ FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false" }, "write_acknowledgement"],
    [{ FANMIND_STAGING_OPERATOR_CONFIRM: "yes" }, "operator_confirmation"],
    [
      { FANMIND_STAGING_OPERATOR_EMAIL: "customer@example.com" },
      "operator_admin_allowlist",
    ],
    [
      { FANMIND_STAGING_ADMIN_EMAILS: "operator@fanmind.ch,operator@fanmind.ch" },
      "operator_admin_allowlist",
    ],
    [{ PGHOST: "db.production.invalid" }, "database_host_binding"],
    [{ PGUSER: "postgres.productionprojectref" }, "database_identity"],
    [{ PGSSLMODE: "require" }, "database_tls"],
    [{ DATABASE_URL: "postgres://redirect.invalid" }, "database_redirect"],
  ]) {
    const result = evaluateStagingOperatorWorkspaceEnvironment(
      acceptedEnvironment(overrides),
    );
    assert.equal(result.ok, false);
    assert.ok(result.errors.includes(expected));
  }
});

test("admin allowlist normalization is exact, case-insensitive and rejects ambiguity", () => {
  assert.deepEqual(
    normalizeStagingAdminEmails(" Operator@FanMind.ch , second@fanmind.ch "),
    ["operator@fanmind.ch", "second@fanmind.ch"],
  );
  assert.deepEqual(normalizeStagingAdminEmails("invalid"), []);
  assert.deepEqual(
    normalizeStagingAdminEmails("operator@fanmind.ch,operator@fanmind.ch"),
    [],
  );
});

test("database operation creates or reuses only the marked manual zero-fee workspace", () => {
  const sql = buildStagingOperatorWorkspaceSql({
    operatorEmail: "operator-staging@example.invalid",
  });

  assert.match(sql, /begin;[\s\S]*commit;/u);
  assert.match(sql, /from auth\.users/u);
  assert.match(sql, /pg_advisory_xact_lock/u);
  assert.match(sql, new RegExp(STAGING_OPERATOR_WORKSPACE_NAME, "u"));
  assert.match(sql, new RegExp(STAGING_OPERATOR_WORKSPACE_FLAG, "u"));
  assert.match(sql, /staging_operator_existing_workspace_unmarked/u);
  assert.match(sql, /insert into public\.profiles/u);
  assert.match(sql, /insert into public\.workspace_members/u);
  assert.match(
    sql,
    /on conflict on constraint workspace_members_workspace_id_user_id_key/u,
  );
  assert.match(sql, /billing_provider = 'manual'/u);
  assert.match(sql, /payment_collection_method = 'none'/u);
  assert.match(sql, /billing_manual_override = true/u);
  assert.match(sql, /payment_terms_version = null/u);
  assert.match(sql, /payment_terms_accepted_at = null/u);
  assert.match(sql, /stripe_customer_id = null/u);
  assert.match(sql, /stripe_subscription_id = null/u);
  assert.doesNotMatch(sql, /insert into auth\.users|delete from|truncate/iu);
  assert.doesNotMatch(sql, /fanmind@fanmind\.ch/iu);
});

test("operation keeps database credentials private and prints only bounded receipts", async () => {
  const source = await readFile(
    "scripts/operations/staging-operator-workspace.mjs",
    "utf8",
  );
  assert.match(source, /constants\.O_NOFOLLOW/u);
  assert.match(source, /mode: 0o600/u);
  assert.match(source, /STAGING_OPERATOR_WORKSPACE_PAYMENT_TERMS_WRITES=0/u);
  assert.match(source, /STAGING_OPERATOR_WORKSPACE_STRIPE_REFERENCES=0/u);
  assert.doesNotMatch(
    source,
    /console\.log\([^\n]*(?:password|passfile|operatorEmail)/iu,
  );
});

test("manual workflow is protected, commit-exact and isolated from Production", async () => {
  const workflow = await readFile(
    ".github/workflows/staging-operator-workspace-provisioning.yml",
    "utf8",
  );
  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/u);
  assert.match(workflow, /inputs\.reviewed_commit == github\.sha/u);
  assert.match(workflow, /provision-staging-operator-workspace/u);
  assert.match(workflow, /environment: staging/u);
  assert.match(workflow, /permissions:\s*\n\s*contents: read/u);
  assert.match(workflow, /FANMIND_STAGING_ADMIN_EMAILS/u);
  assert.match(workflow, /FANMIND_STAGING_OPERATOR_EMAIL: \$\{\{ inputs\.operator_email \}\}/u);
  assert.match(workflow, /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'true'/u);
  assert.match(
    workflow,
    /NEXT_PUBLIC_SUPABASE_URL: \$\{\{ secrets\.FANMIND_STAGING_SUPABASE_URL \}\}/u,
  );
  assert.match(
    workflow,
    /FANMIND_TARGET_API_ORIGIN: \$\{\{ vars\.FANMIND_STAGING_APP_URL \}\}/u,
  );
  assert.match(workflow, /FANMIND_PRODUCTION_API_ORIGIN: https:\/\/fanmind\.ch/u);
  assert.match(workflow, /FANMIND_PRODUCTION_SUPABASE_PROJECT_REF/u);
  assert.match(workflow, /FANMIND_PRODUCTION_DB_HOST/u);
  assert.match(workflow, /db:staging-rollout-state:run/u);
  assert.match(workflow, /staging:operator-workspace:run/u);
  assert.match(workflow, /PGSSLMODE: verify-full/u);
  assert.doesNotMatch(workflow, /pull_request:|push:|upload-artifact/u);
  assert.doesNotMatch(workflow, /contents: write|write-all/u);
});

test("offline operator workspace contract runs without network or credentials", () => {
  const output = execFileSync(
    process.execPath,
    ["scripts/operations/staging-operator-workspace.mjs", "--check"],
    { encoding: "utf8" },
  );
  assert.match(output, /STAGING_OPERATOR_WORKSPACE_MODE=check/u);
  assert.match(output, /STAGING_OPERATOR_WORKSPACE_CONTRACT=PASS/u);
});
