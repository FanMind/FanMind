import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildStagingSyntheticFixtureSql,
} from "../scripts/operations/staging-synthetic-fixtures.mjs";
import {
  STAGING_SYNTHETIC_FIXTURE_CONFIRMATION,
  STAGING_SYNTHETIC_MEMBER_EMAIL,
  STAGING_SYNTHETIC_PRIMARY_WORKSPACE_NAME,
  deriveStagingSyntheticContactId,
  evaluateStagingSyntheticFixtureEnvironment,
  stagingSyntheticFixtureAssignments,
} from "../src/lib/stagingSyntheticFixturePolicy.mjs";

const PRIMARY_USER_ID = "33333333-3333-4333-8333-333333333333";
const SECONDARY_USER_ID = "44444444-4444-4444-8444-444444444444";
const MEMBER_USER_ID = "55555555-5555-4555-8555-555555555555";
const PRIMARY_WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const SECONDARY_WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";
const PRIMARY_CONTACT_ID = deriveStagingSyntheticContactId(
  PRIMARY_WORKSPACE_ID,
  "primary",
);
const SECONDARY_CONTACT_ID = deriveStagingSyntheticContactId(
  SECONDARY_WORKSPACE_ID,
  "secondary",
);

function acceptedEnvironment(overrides = {}) {
  return {
    FANMIND_RUNTIME_ENVIRONMENT: "staging",
    NEXT_PUBLIC_APP_URL: "https://staging.fanmind.ch",
    FANMIND_TARGET_SUPABASE_PROJECT_REF: "stagingprojectref",
    FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: "productionprojectref",
    FANMIND_STAGING_SUPABASE_URL:
      "https://stagingprojectref.supabase.co",
    FANMIND_STAGING_SUPABASE_ANON_KEY: "sb_publishable_synthetic",
    FANMIND_STAGING_SUPABASE_SERVICE_ROLE_KEY: "sb_secret_synthetic",
    FANMIND_STAGING_E2E_EMAIL: "primary-staging@example.invalid",
    FANMIND_STAGING_E2E_PASSWORD: "Primary-Staging-Password-123!",
    FANMIND_STAGING_E2E_SECONDARY_EMAIL:
      "secondary-staging@example.invalid",
    FANMIND_STAGING_E2E_SECONDARY_PASSWORD:
      "Secondary-Staging-Password-456!",
    FANMIND_STAGING_E2E_MEMBER_PASSWORD:
      "Member-Staging-Password-789!",
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
    FANMIND_NON_PRODUCTION_WRITE_ACK: "I_UNDERSTAND_NON_PRODUCTION_ONLY",
    FANMIND_STAGING_FIXTURE_REVIEWED_COMMIT: "a".repeat(40),
    FANMIND_STAGING_FIXTURE_CONFIRM:
      STAGING_SYNTHETIC_FIXTURE_CONFIRMATION,
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

test("persistent fixture environment accepts only reviewed isolated staging writes", () => {
  assert.deepEqual(
    evaluateStagingSyntheticFixtureEnvironment(acceptedEnvironment()),
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
    [{ FANMIND_STAGING_FIXTURE_CONFIRM: "yes" }, "fixture_confirmation"],
    [{ FANMIND_STAGING_E2E_EMAIL: "customer@example.com" }, "synthetic_emails"],
    [{ FANMIND_STAGING_E2E_PASSWORD: "short" }, "synthetic_passwords"],
    [{ FANMIND_STAGING_E2E_MEMBER_PASSWORD: "short" }, "synthetic_passwords"],
    [
      {
        FANMIND_STAGING_E2E_MEMBER_PASSWORD:
          "Primary-Staging-Password-123!",
      },
      "synthetic_passwords",
    ],
    [{ FANMIND_STAGING_SUPABASE_SERVICE_ROLE_KEY: "sb_publishable_wrong" }, "supabase_keys"],
    [{ PGHOST: "db.production.invalid" }, "database_host_binding"],
    [{ DATABASE_URL: "postgres://redirect.invalid" }, "database_redirect"],
  ]) {
    const result = evaluateStagingSyntheticFixtureEnvironment(
      acceptedEnvironment(overrides),
    );
    assert.equal(result.ok, false);
    assert.ok(result.errors.includes(expected));
  }
});

test("contact IDs and GitHub variable assignments are deterministic and isolated", () => {
  assert.equal(
    deriveStagingSyntheticContactId(PRIMARY_WORKSPACE_ID, "primary"),
    PRIMARY_CONTACT_ID,
  );
  assert.notEqual(PRIMARY_CONTACT_ID, SECONDARY_CONTACT_ID);

  const assignments = stagingSyntheticFixtureAssignments({
    primaryWorkspaceId: PRIMARY_WORKSPACE_ID,
    primaryContactId: PRIMARY_CONTACT_ID,
    secondaryWorkspaceId: SECONDARY_WORKSPACE_ID,
    secondaryContactId: SECONDARY_CONTACT_ID,
  });
  assert.equal(
    assignments.FANMIND_AI_TIER_STAGING_WORKSPACE_ID,
    PRIMARY_WORKSPACE_ID,
  );
  assert.equal(
    assignments.FANMIND_WORKSPACE_PROCESSING_STAGING_WORKSPACE_ID,
    PRIMARY_WORKSPACE_ID,
  );
  assert.equal(Object.keys(assignments).length, 6);
});

test("database apply reuses workspace provisioning and creates only marked reusable fixtures", () => {
  const sql = buildStagingSyntheticFixtureSql({
    primaryUserId: PRIMARY_USER_ID,
    primaryEmail: "primary-staging@example.invalid",
    primaryWorkspaceId: PRIMARY_WORKSPACE_ID,
    primaryContactId: PRIMARY_CONTACT_ID,
    secondaryUserId: SECONDARY_USER_ID,
    secondaryEmail: "secondary-staging@example.invalid",
    secondaryWorkspaceId: SECONDARY_WORKSPACE_ID,
    secondaryContactId: SECONDARY_CONTACT_ID,
    memberUserId: MEMBER_USER_ID,
  });

  assert.match(sql, /begin;[\s\S]*commit;/u);
  assert.match(sql, new RegExp(STAGING_SYNTHETIC_PRIMARY_WORKSPACE_NAME, "u"));
  assert.match(sql, /workspace_processing_acceptance/u);
  assert.match(sql, /staging_synthetic_fixture/u);
  assert.match(sql, /insert into public\.profiles/u);
  assert.match(sql, /insert into public\.workspace_members/u);
  assert.match(sql, /'member'/u);
  assert.match(sql, /insert into public\.contacts/u);
  assert.match(sql, /synthetic_fixture_cross_membership/u);
  assert.match(sql, /synthetic_fixture_stripe_state_not_empty/u);
  assert.equal(
    (sql.match(/subscription_effective_end_at = null/gu) ?? []).length,
    2,
  );
  assert.equal(
    (sql.match(/subscription_cancel_at_period_end = false/gu) ?? []).length,
    2,
  );
  assert.doesNotMatch(sql, /insert into auth\.users|delete from|truncate/iu);
  assert.doesNotMatch(sql, /rollback;/iu);
});

test("server-side provisioning uses Admin Auth, user RPC and secret-safe header policy", async () => {
  const source = await readFile(
    "scripts/operations/staging-synthetic-fixtures.mjs",
    "utf8",
  );
  assert.match(source, /buildSupabaseApiKeyHeaders/u);
  assert.match(source, /\/auth\/v1\/admin\/users/u);
  assert.match(source, /\/auth\/v1\/token/u);
  assert.match(source, /ensure_current_user_workspace/u);
  assert.match(source, /starter_paid_setup/u);
  assert.match(source, /STAGING_SYNTHETIC_MEMBER_EMAIL/u);
  assert.match(
    source,
    /"FANMIND_STAGING_E2E_MEMBER_PASSWORD"[\s\S]*delete safeEnvironment\[key\]/u,
  );
  assert.equal(STAGING_SYNTHETIC_MEMBER_EMAIL.endsWith("@example.invalid"), true);
  assert.match(source, /STAGING_SYNTHETIC_FIXTURE_SECRETS_OUTPUT=0/u);
  assert.doesNotMatch(source, /console\.log\([^\n]*(?:password|serviceKey|accessToken)/iu);
});

test("manual workflow is protected, commit-exact and isolated from Production", async () => {
  const workflow = await readFile(
    ".github/workflows/staging-synthetic-fixture-provisioning.yml",
    "utf8",
  );
  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/u);
  assert.match(workflow, /inputs\.reviewed_commit == github\.sha/u);
  assert.match(workflow, /provision-staging-synthetic-fixtures/u);
  assert.match(workflow, /environment: staging/u);
  assert.match(workflow, /permissions:\s*\n\s*contents: read/u);
  assert.match(workflow, /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'true'/u);
  assert.match(workflow, /FANMIND_STAGING_SUPABASE_SERVICE_ROLE_KEY/u);
  assert.match(workflow, /FANMIND_STAGING_E2E_SECONDARY_PASSWORD/u);
  assert.match(workflow, /FANMIND_STAGING_E2E_MEMBER_PASSWORD/u);
  assert.match(
    workflow,
    /NEXT_PUBLIC_SUPABASE_URL: \$\{\{ secrets\.FANMIND_STAGING_SUPABASE_URL \}\}/u,
  );
  assert.match(
    workflow,
    /FANMIND_TARGET_API_ORIGIN: \$\{\{ vars\.FANMIND_STAGING_APP_URL \}\}/u,
  );
  assert.match(workflow, /FANMIND_PRODUCTION_API_ORIGIN: https:\/\/fanmind\.ch/u);
  assert.match(
    workflow,
    /FANMIND_PRODUCTION_DB_HOST: \$\{\{ format\('db\.\{0\}\.supabase\.co', vars\.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF\) \}\}/u,
  );
  assert.match(workflow, /db:staging-rollout-state:run/u);
  assert.match(workflow, /staging:fixtures:run/u);
  assert.match(workflow, /PGSSLMODE: verify-full/u);
  assert.doesNotMatch(workflow, /pull_request:|push:|upload-artifact/u);
  assert.doesNotMatch(workflow, /contents: write|write-all/u);
});

test("offline fixture contract runs without network or credentials", () => {
  const output = execFileSync(
    process.execPath,
    ["scripts/operations/staging-synthetic-fixtures.mjs", "--check"],
    { encoding: "utf8" },
  );
  assert.match(output, /STAGING_SYNTHETIC_FIXTURE_MODE=check/u);
  assert.match(output, /STAGING_SYNTHETIC_FIXTURE_CONTRACT=PASS/u);
});
