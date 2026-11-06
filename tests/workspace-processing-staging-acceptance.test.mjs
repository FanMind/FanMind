import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import test from "node:test";

import {
  buildWorkspaceProcessingAcceptanceSql,
  verifyWorkspaceProcessingFixtures,
} from "../scripts/operations/workspace-processing-staging-acceptance.mjs";
import {
  WORKSPACE_PROCESSING_STAGING_CONFIRMATION,
  WORKSPACE_PROCESSING_STAGING_WORKSPACE_NAME,
  evaluateWorkspaceProcessingStagingEnvironment,
} from "../src/lib/workspaceProcessingStagingPolicy.mjs";

const execFileAsync = promisify(execFile);
const scriptPath =
  "scripts/operations/workspace-processing-staging-acceptance.mjs";
const workflowPath =
  ".github/workflows/workspace-processing-staging-acceptance.yml";
const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const COMMIT = "a".repeat(40);

function stagingEnvironment(overrides = {}) {
  return {
    FANMIND_RUNTIME_ENVIRONMENT: "staging",
    NEXT_PUBLIC_APP_URL: "https://staging.fanmind.example",
    NEXT_PUBLIC_SUPABASE_URL: "https://stagingref12345.supabase.co",
    FANMIND_TARGET_API_ORIGIN: "https://staging.fanmind.example",
    FANMIND_PRODUCTION_API_ORIGIN: "https://fanmind.ch",
    FANMIND_TARGET_SUPABASE_PROJECT_REF: "stagingref12345",
    FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: "productionref123",
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
    FANMIND_NON_PRODUCTION_WRITE_ACK: "I_UNDERSTAND_NON_PRODUCTION_ONLY",
    FANMIND_WORKSPACE_PROCESSING_REVIEWED_COMMIT: COMMIT,
    FANMIND_WORKSPACE_PROCESSING_STAGING_ACCEPTANCE_CONFIRM:
      WORKSPACE_PROCESSING_STAGING_CONFIRMATION,
    FANMIND_WORKSPACE_PROCESSING_STAGING_WORKSPACE_ID: WORKSPACE_ID,
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: COMMIT,
    PGHOST: "aws-0-eu-central-1.pooler.supabase.com",
    FANMIND_TARGET_DB_HOST: "aws-0-eu-central-1.pooler.supabase.com",
    FANMIND_PRODUCTION_DB_HOST: "aws-0-eu-west-1.pooler.supabase.com",
    PGPORT: "5432",
    PGDATABASE: "postgres",
    PGUSER: "postgres.stagingref12345",
    PGSSLMODE: "verify-full",
    PGSSLROOTCERT: "/etc/ssl/certs/ca-certificates.crt",
    ...overrides,
  };
}

function fixture(caseName, workspace, now = "2026-08-11T18:00:00.000Z") {
  return `${"WORKSPACE_PROCESSING_STAGING_FIXTURE="}${JSON.stringify({
    case: caseName,
    now,
    workspace,
  })}`;
}

function workspace(overrides = {}) {
  return {
    workspace_access_mode: "active",
    subscription_effective_end_at: null,
    billing_status: "active",
    billing_manual_override: false,
    billing_grace_until: null,
    billing_suspended_at: null,
    test_access_flags: { workspace_processing_acceptance: true },
    ...overrides,
  };
}

test("Staging environment requires exact main, isolated targets, writes and synthetic workspace", () => {
  assert.deepEqual(
    evaluateWorkspaceProcessingStagingEnvironment(stagingEnvironment()),
    { ok: true, errors: [] },
  );

  const unsafe = evaluateWorkspaceProcessingStagingEnvironment(
    stagingEnvironment({
      FANMIND_RUNTIME_ENVIRONMENT: "production",
      NEXT_PUBLIC_APP_URL: "https://fanmind.ch",
      FANMIND_TARGET_API_ORIGIN: "https://fanmind.ch",
      NEXT_PUBLIC_SUPABASE_URL: "https://productionref123.supabase.co",
      FANMIND_TARGET_SUPABASE_PROJECT_REF: "productionref123",
      FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false",
      FANMIND_NON_PRODUCTION_WRITE_ACK: "",
      FANMIND_WORKSPACE_PROCESSING_REVIEWED_COMMIT: "b".repeat(40),
      FANMIND_WORKSPACE_PROCESSING_STAGING_ACCEPTANCE_CONFIRM: "",
      FANMIND_WORKSPACE_PROCESSING_STAGING_WORKSPACE_ID: "customer",
      PGUSER: "postgres.productionref123",
      PGSSLMODE: "disable",
      DATABASE_URL: "postgres://must-not-be-used.invalid/db",
    }),
  );
  assert.equal(unsafe.ok, false);
  for (const error of [
    "runtime_environment",
    "application_boundary",
    "supabase_boundary",
    "reviewed_commit",
    "write_acknowledgement",
    "acceptance_confirmation",
    "synthetic_workspace",
    "database_tls",
    "database_redirect",
  ]) {
    assert.ok(unsafe.errors.includes(error), `missing ${error}`);
  }
  assert.doesNotMatch(JSON.stringify(unsafe), /postgres:\/\//u);
});

test("rollback-only SQL is dedicated, locked and never commits", () => {
  const sql = buildWorkspaceProcessingAcceptanceSql(WORKSPACE_ID);
  assert.match(sql, new RegExp(WORKSPACE_PROCESSING_STAGING_WORKSPACE_NAME, "u"));
  assert.match(sql, /workspace_processing_acceptance/u);
  assert.match(sql, /stripe_customer_id is null/u);
  assert.match(sql, /stripe_subscription_id is null/u);
  assert.match(sql, /for update/u);
  assert.match(sql, /workspace_access_mode = 'archived_readonly'/u);
  assert.match(sql, /billing_status = 'payment_failed'/u);
  assert.match(sql, /billing_manual_override = true/u);
  assert.match(sql, /temporary_processing_access_expires_at/u);
  assert.equal(
    sql.match(/WORKSPACE_PROCESSING_STAGING_FIXTURE=/gu)?.length,
    9,
  );
  assert.match(sql, /rollback;/u);
  assert.doesNotMatch(sql, /\bcommit\s*;/iu);
  assert.doesNotMatch(sql, /social_connections|conversation_messages|meta_/u);
});

test("fixture proof covers denial, grace, temporary access and reactivation", () => {
  const output = [
    fixture("active", workspace()),
    fixture("archived", workspace({ workspace_access_mode: "archived_readonly" })),
    fixture(
      "contract_ended",
      workspace({ subscription_effective_end_at: "2026-08-11T17:59:59.000Z" }),
    ),
    fixture(
      "suspended",
      workspace({
        billing_status: "suspended",
        billing_suspended_at: "2026-08-11T17:00:00.000Z",
      }),
    ),
    fixture(
      "billing_grace",
      workspace({
        billing_status: "payment_failed",
        billing_grace_until: "2026-08-11T19:00:00.000Z",
      }),
    ),
    fixture(
      "manual_override",
      workspace({
        billing_status: "suspended",
        billing_suspended_at: "2026-08-11T17:00:00.000Z",
        billing_manual_override: true,
      }),
    ),
    fixture(
      "temporary_access",
      workspace({
        billing_status: "demo_free",
        test_access_flags: {
          workspace_processing_acceptance: true,
          temporary_processing_access: true,
          temporary_processing_access_expires_at:
            "2026-08-11T19:00:00.000Z",
        },
      }),
    ),
    fixture(
      "temporary_access_expired",
      workspace({
        billing_status: "demo_free",
        test_access_flags: {
          workspace_processing_acceptance: true,
          temporary_processing_access: true,
          temporary_processing_access_expires_at:
            "2026-08-11T17:59:59.000Z",
        },
      }),
    ),
    fixture("reactivated", workspace()),
  ].join("\n");

  assert.deepEqual(verifyWorkspaceProcessingFixtures(output), {
    databaseCases: 9,
    policyCases: 11,
  });
  assert.throws(
    () => verifyWorkspaceProcessingFixtures(output.replace(/reactivated/u, "active")),
    /fixture_output_invalid|fixture_count_invalid/u,
  );
});

test("offline check needs no database, workspace or provider credentials", async () => {
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [scriptPath, "--check"],
    { env: process.env },
  );
  const output = `${stdout}\n${stderr}`;
  assert.match(output, /WORKSPACE_PROCESSING_STAGING_ACCEPTANCE_MODE=check/u);
  assert.match(output, /WORKSPACE_PROCESSING_STAGING_ACCEPTANCE_READY=YES/u);
  assert.doesNotMatch(output, /11111111|postgres|supabase|stripe|meta/iu);
});

test("manual workflow is exact-commit Staging-only and provider-free", async () => {
  const [workflow, script] = await Promise.all([
    readFile(workflowPath, "utf8"),
    readFile(scriptPath, "utf8"),
  ]);
  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/u);
  assert.match(workflow, /inputs\.reviewed_commit == github\.sha/u);
  assert.match(workflow, /environment: staging/u);
  assert.match(workflow, /timeout-minutes: 10/u);
  assert.match(
    workflow,
    /inputs\.confirmation == 'run-workspace-processing-staging-acceptance'/u,
  );
  assert.match(workflow, /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'true'/u);
  assert.match(workflow, /npm run db:staging-rollout-state:run/u);
  assert.match(workflow, /STAGING_DATABASE_ROLLOUT_STATE=PASS/u);
  assert.match(workflow, /npm run workspace:processing:staging:run/u);
  assert.doesNotMatch(workflow, /STRIPE_SECRET|META_ACCESS|OPENAI_API/u);
  assert.doesNotMatch(script, /fetch\(|https?:\/\//u);
});
