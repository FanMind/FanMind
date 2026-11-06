import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import test from "node:test";

import {
  buildReferralStagingAcceptanceSql,
  referralAcceptanceFailureCode,
} from "../scripts/operations/referral-lifecycle-staging-acceptance.mjs";
import {
  REFERRAL_STAGING_ACCEPTANCE_CONFIRMATION,
  evaluateReferralStagingAcceptanceEnvironment,
} from "../src/lib/referralStagingAcceptancePolicy.mjs";

const execFileAsync = promisify(execFile);
const scriptPath =
  "scripts/operations/referral-lifecycle-staging-acceptance.mjs";
const workflowPath =
  ".github/workflows/referral-lifecycle-staging-acceptance.yml";
const PRIMARY_WORKSPACE = "11111111-1111-4111-8111-111111111111";
const SECONDARY_WORKSPACE = "22222222-2222-4222-8222-222222222222";
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
    FANMIND_REFERRAL_STAGING_REVIEWED_COMMIT: COMMIT,
    FANMIND_REFERRAL_STAGING_ACCEPTANCE_CONFIRM:
      REFERRAL_STAGING_ACCEPTANCE_CONFIRMATION,
    FANMIND_STAGING_E2E_WORKSPACE_ID: PRIMARY_WORKSPACE,
    FANMIND_STAGING_E2E_SECONDARY_WORKSPACE_ID: SECONDARY_WORKSPACE,
    FANMIND_ENABLE_REFERRAL_BILLING: "false",
    FANMIND_REFERRAL_SANDBOX_ACK: "",
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: COMMIT,
    PGHOST: "aws-0-eu-central-1.pooler.supabase.com",
    FANMIND_TARGET_DB_HOST: "aws-0-eu-central-1.pooler.supabase.com",
    FANMIND_PRODUCTION_DB_HOST: "db.productionref123.supabase.co",
    PGPORT: "5432",
    PGDATABASE: "postgres",
    PGUSER: "postgres.stagingref12345",
    PGSSLMODE: "verify-full",
    PGSSLROOTCERT: "/etc/ssl/certs/ca-certificates.crt",
    ...overrides,
  };
}

test("policy permits only exact-commit isolated Staging rollback acceptance", () => {
  assert.deepEqual(
    evaluateReferralStagingAcceptanceEnvironment(stagingEnvironment()),
    { ok: true, errors: [] },
  );

  const unsafe = evaluateReferralStagingAcceptanceEnvironment(
    stagingEnvironment({
      FANMIND_RUNTIME_ENVIRONMENT: "production",
      NEXT_PUBLIC_APP_URL: "https://fanmind.ch",
      FANMIND_TARGET_API_ORIGIN: "https://fanmind.ch",
      NEXT_PUBLIC_SUPABASE_URL: "https://productionref123.supabase.co",
      FANMIND_TARGET_SUPABASE_PROJECT_REF: "productionref123",
      FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false",
      FANMIND_NON_PRODUCTION_WRITE_ACK: "",
      FANMIND_REFERRAL_STAGING_REVIEWED_COMMIT: "b".repeat(40),
      FANMIND_REFERRAL_STAGING_ACCEPTANCE_CONFIRM: "",
      FANMIND_STAGING_E2E_SECONDARY_WORKSPACE_ID: PRIMARY_WORKSPACE,
      FANMIND_ENABLE_REFERRAL_BILLING: "true",
      FANMIND_REFERRAL_SANDBOX_ACK: "approved",
      STRIPE_SECRET_KEY: "must-not-be-used",
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
    "synthetic_workspaces",
    "provider_write_boundary",
    "database_tls",
    "database_redirect",
  ]) {
    assert.ok(unsafe.errors.includes(error), `missing ${error}`);
  }
  assert.doesNotMatch(JSON.stringify(unsafe), /must-not-be-used/u);
});

test("SQL proves attribution, lifecycle, caps, idempotency and full rollback", () => {
  const sql = buildReferralStagingAcceptanceSql(
    PRIMARY_WORKSPACE,
    SECONDARY_WORKSPACE,
  );
  assert.match(sql, /staging_synthetic_fixture/u);
  assert.match(sql, /stripe_customer_id is null/u);
  assert.match(sql, /stripe_subscription_id is null/u);
  assert.match(sql, /for update/u);
  assert.match(sql, /self_referral_guard_missing/u);
  assert.match(sql, /referrer_user_id/u);
  assert.match(sql, /referred_user_id/u);
  assert.match(sql, /first_valid_click_guard_missing/u);
  assert.match(sql, /immutable_attribution_guard_missing/u);
  assert.match(sql, /payment_failed/u);
  assert.match(sql, /cancelled/u);
  assert.match(sql, /refunded/u);
  assert.match(sql, /reactivated/u);
  assert.match(sql, /duplicate_event/u);
  assert.match(sql, /discount_percent <> 100/u);
  assert.match(sql, /discount_percent <> 25/u);
  assert.match(sql, /referral_setup_fee_changed/u);
  assert.match(sql, /monthly_fee_cents_before_discount <> 31200/u);
  assert.match(sql, /setup_fee_cents = 99000/u);
  assert.match(sql, /growth_window_auto_reopened/u);
  assert.match(sql, /rollback;/u);
  assert.doesNotMatch(sql, /\bcommit\s*;/iu);
  assert.doesNotMatch(sql, /fetch\(|https?:\/\//u);
});

test("offline check needs no database or provider credentials", async () => {
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [scriptPath, "--check"],
    { env: process.env },
  );
  const output = `${stdout}\n${stderr}`;
  assert.match(output, /REFERRAL_STAGING_ACCEPTANCE_MODE=check/u);
  assert.match(output, /REFERRAL_STAGING_ACCEPTANCE_READY=YES/u);
  assert.doesNotMatch(output, /11111111|postgres|supabase|stripe/iu);
});

test("database failure classification emits only allowlisted Referral codes", () => {
  assert.equal(
    referralAcceptanceFailureCode(
      "private context referral_attribution_guard_missing password=hidden",
    ),
    "referral_attribution_guard_missing",
  );
  assert.equal(
    referralAcceptanceFailureCode("host=private password=secret"),
    "database_acceptance_failed",
  );
});

test("workflow is exact-main Staging-only, rollback-only and provider-free", async () => {
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
    /inputs\.confirmation == 'run-referral-lifecycle-staging-acceptance'/u,
  );
  assert.match(workflow, /FANMIND_ENABLE_REFERRAL_BILLING: 'false'/u);
  assert.match(workflow, /npm run db:staging-rollout-state:run/u);
  assert.match(workflow, /STAGING_DATABASE_ROLLOUT_STATE=PASS/u);
  assert.match(workflow, /npm run db:referral-attribution:verify/u);
  assert.match(workflow, /npm run referral:lifecycle:staging:run/u);
  assert.doesNotMatch(workflow, /STRIPE_SECRET|STRIPE_WEBHOOK|META_ACCESS|OPENAI_API/u);
  assert.doesNotMatch(script, /fetch\(|https?:\/\//u);
});

test("migration enforces first attribution and blocks identity mutation", async () => {
  const migration = await readFile(
    "supabase/migrations/20260814230000_referral_attribution_integrity.sql",
    "utf8",
  );
  assert.match(migration, /referrals_referred_workspace_unique_idx/u);
  assert.match(migration, /referrals_no_self_user_check/u);
  assert.match(migration, /protect_referral_attribution/u);
  assert.match(migration, /referral_attribution_immutable/u);
  assert.match(migration, /duplicates_require_manual_review/u);
  assert.doesNotMatch(
    migration,
    /create unique index referrals_referred_workspace_unique_idx[\s\S]*where referred_workspace_id is not null/iu,
  );
  assert.match(migration, /new\.referred_workspace_id is not null/u);
  assert.match(migration, /new\.referrer_user_id is not null/u);
  assert.match(migration, /new\.referred_user_id is not null/u);
  assert.doesNotMatch(
    migration,
    /old\.(?:referred_workspace_id|referrer_user_id|referred_user_id) is not null\s+and new\./u,
  );
  assert.doesNotMatch(migration, /grant execute.*authenticated/iu);
});
