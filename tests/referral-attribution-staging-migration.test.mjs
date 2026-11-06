import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import test from "node:test";

import {
  EXPECTED_MIGRATION_SHA256,
  POSTFLIGHT_SQL,
  evaluateReferralAttributionMigrationSql,
  safeDatabaseFailure,
} from "../scripts/operations/referral-attribution-migration-runner.mjs";
import {
  REFERRAL_ATTRIBUTION_APPLY_CONFIRMATION,
  REFERRAL_ATTRIBUTION_VERIFY_CONFIRMATION,
  evaluateReferralAttributionMigrationEnvironment,
} from "../src/lib/referralAttributionMigrationPolicy.mjs";

const execFileAsync = promisify(execFile);
const COMMIT = "a".repeat(40);
const migrationPath =
  "supabase/migrations/20260814230000_referral_attribution_integrity.sql";
const runnerPath =
  "scripts/operations/referral-attribution-migration-runner.mjs";

function stagingEnvironment(mode = "verify", overrides = {}) {
  const apply = mode === "apply";
  return {
    FANMIND_RUNTIME_ENVIRONMENT: "staging",
    NEXT_PUBLIC_APP_URL: "https://staging.fanmind.example",
    NEXT_PUBLIC_SUPABASE_URL: "https://stagingref12345.supabase.co",
    FANMIND_TARGET_API_ORIGIN: "https://staging.fanmind.example",
    FANMIND_PRODUCTION_API_ORIGIN: "https://fanmind.ch",
    FANMIND_TARGET_SUPABASE_PROJECT_REF: "stagingref12345",
    FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: "productionref123",
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: apply ? "true" : "false",
    FANMIND_NON_PRODUCTION_WRITE_ACK: apply
      ? "I_UNDERSTAND_NON_PRODUCTION_ONLY"
      : "",
    FANMIND_ENABLE_REFERRAL_BILLING: "false",
    FANMIND_REFERRAL_SANDBOX_ACK: "",
    FANMIND_REFERRAL_ATTRIBUTION_REVIEWED_COMMIT: COMMIT,
    FANMIND_REFERRAL_ATTRIBUTION_VERIFY_CONFIRM:
      REFERRAL_ATTRIBUTION_VERIFY_CONFIRMATION,
    FANMIND_REFERRAL_ATTRIBUTION_APPLY_CONFIRM:
      REFERRAL_ATTRIBUTION_APPLY_CONFIRMATION,
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

test("migration policy binds read-only verify and explicit apply to isolated Staging", () => {
  assert.deepEqual(
    evaluateReferralAttributionMigrationEnvironment(
      stagingEnvironment("verify"),
      { mode: "verify" },
    ),
    { ok: true, mode: "verify", writeEnabled: false, errors: [] },
  );
  assert.deepEqual(
    evaluateReferralAttributionMigrationEnvironment(stagingEnvironment("apply"), {
      mode: "apply",
    }),
    { ok: true, mode: "apply", writeEnabled: true, errors: [] },
  );

  const unsafe = evaluateReferralAttributionMigrationEnvironment(
    stagingEnvironment("apply", {
      FANMIND_RUNTIME_ENVIRONMENT: "production",
      NEXT_PUBLIC_APP_URL: "https://fanmind.ch",
      FANMIND_TARGET_API_ORIGIN: "https://fanmind.ch",
      NEXT_PUBLIC_SUPABASE_URL: "https://productionref123.supabase.co",
      FANMIND_TARGET_SUPABASE_PROJECT_REF: "productionref123",
      FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false",
      FANMIND_NON_PRODUCTION_WRITE_ACK: "",
      FANMIND_REFERRAL_ATTRIBUTION_REVIEWED_COMMIT: "b".repeat(40),
      FANMIND_REFERRAL_ATTRIBUTION_APPLY_CONFIRM: "",
      FANMIND_ENABLE_REFERRAL_BILLING: "true",
      STRIPE_SECRET_KEY: "must-not-appear",
      PGUSER: "postgres.productionref123",
      PGSSLMODE: "disable",
      DATABASE_URL: "postgres://must-not-appear.invalid/db",
    }),
    { mode: "apply" },
  );
  assert.equal(unsafe.ok, false);
  for (const error of [
    "environment_boundary",
    "runtime_environment",
    "production_target",
    "reviewed_commit",
    "production_api_target",
    "database_user_project_binding",
    "database_tls",
    "libpq_redirect",
    "confirmation",
    "write_acknowledgement",
    "provider_write_boundary",
  ]) {
    assert.ok(unsafe.errors.includes(error), `missing ${error}`);
  }
  assert.doesNotMatch(JSON.stringify(unsafe), /must-not-appear/u);
});

test("offline check pins the transactional Referral integrity contract", async () => {
  const sql = await readFile(migrationPath, "utf8");
  const result = evaluateReferralAttributionMigrationSql(sql);
  assert.equal(result.digest, EXPECTED_MIGRATION_SHA256);
  assert.match(sql, /\bbegin;/u);
  assert.match(sql, /commit;\s*$/u);
  assert.match(sql, /set search_path = pg_catalog, pg_temp/u);
  assert.match(sql, /referral_attribution_duplicates_require_manual_review/u);
  assert.match(sql, /referrals_no_self_user_check/u);
  assert.match(sql, /protect_referral_attribution_trigger/u);
  assert.match(sql, /revoke all[\s\S]*from authenticated/u);
  assert.throws(
    () => evaluateReferralAttributionMigrationSql(`${sql}\n-- drift`),
    /migration_checksum_mismatch/u,
  );
});

test("postflight proves the exact index, constraint, guard, trigger and rollback", () => {
  assert.match(POSTFLIGHT_SQL, /set transaction read only/u);
  assert.match(POSTFLIGHT_SQL, /indpred is null/u);
  assert.match(POSTFLIGHT_SQL, /referrals_no_self_user_check/u);
  assert.match(POSTFLIGHT_SQL, /search_path=pg_catalog, pg_temp/u);
  assert.match(POSTFLIGHT_SQL, /has_function_privilege\('anon'/u);
  assert.match(POSTFLIGHT_SQL, /function_acl\.grantee = 0/u);
  assert.match(POSTFLIGHT_SQL, /protect_referral_attribution_trigger/u);
  assert.match(POSTFLIGHT_SQL, /REFERRAL_ATTRIBUTION_POSTFLIGHT=PASS/u);
  assert.match(POSTFLIGHT_SQL, /rollback;/u);
  assert.doesNotMatch(POSTFLIGHT_SQL, /\bcommit\s*;/iu);
});

test("database failures expose only fixed diagnostic codes", () => {
  assert.equal(
    safeDatabaseFailure(
      "host and user hidden: referral_attribution_function_invalid",
      "postflight_failed",
    ),
    "referral_attribution_function_invalid",
  );
  assert.equal(
    safeDatabaseFailure("password=secret host=private", "postflight_failed"),
    "postflight_failed",
  );
});

test("offline runner needs no database or provider credentials", async () => {
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [runnerPath, "--check"],
    { env: process.env },
  );
  const output = `${stdout}\n${stderr}`;
  assert.match(output, /REFERRAL_ATTRIBUTION_CHECKSUM=verified/u);
  assert.match(output, /REFERRAL_ATTRIBUTION_CONTRACT=verified/u);
  assert.match(output, /REFERRAL_ATTRIBUTION_READY=YES/u);
  assert.doesNotMatch(output, /postgres|supabase|stripe/iu);
});

test("manual workflows separate read-only verify from explicit Staging apply", async () => {
  const [verifyWorkflow, applyWorkflow, acceptanceWorkflow, manifest] =
    await Promise.all([
      readFile(".github/workflows/referral-attribution-staging-verify.yml", "utf8"),
      readFile(".github/workflows/referral-attribution-staging-apply.yml", "utf8"),
      readFile(
        ".github/workflows/referral-lifecycle-staging-acceptance.yml",
        "utf8",
      ),
      readFile("package.json", "utf8"),
    ]);

  for (const workflow of [verifyWorkflow, applyWorkflow]) {
    assert.match(workflow, /github\.ref == 'refs\/heads\/main'/u);
    assert.match(workflow, /inputs\.reviewed_commit == github\.sha/u);
    assert.match(workflow, /environment: staging/u);
    assert.match(workflow, /PGSSLMODE: verify-full/u);
    assert.match(workflow, /supabase-root-2021-ca\.crt/u);
    assert.match(workflow, /FANMIND_ENABLE_REFERRAL_BILLING: 'false'/u);
    assert.match(workflow, /PGPASSFILE:.*referral-attribution/iu);
    assert.doesNotMatch(workflow, /STRIPE_SECRET|STRIPE_WEBHOOK/u);
  }
  assert.match(verifyWorkflow, /db:referral-attribution:verify/u);
  assert.doesNotMatch(verifyWorkflow, /db:referral-attribution:apply/u);
  assert.match(verifyWorkflow, /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'false'/u);
  assert.match(applyWorkflow, /db:referral-attribution:apply/u);
  assert.match(applyWorkflow, /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'true'/u);
  assert.match(applyWorkflow, /I_UNDERSTAND_NON_PRODUCTION_ONLY/u);
  assert.match(acceptanceWorkflow, /db:referral-attribution:verify/u);

  const scripts = JSON.parse(manifest).scripts;
  assert.ok(scripts["db:referral-attribution:check"]);
  assert.ok(scripts["db:referral-attribution:verify"]);
  assert.ok(scripts["db:referral-attribution:apply"]);
  assert.match(scripts["test:operations"], /referral-attribution-staging-migration/u);
});
