import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildStagingCoreCsvCleanupSql,
  buildStagingCoreCsvPrepareSql,
  buildStagingCoreCsvVerifySql,
} from "../scripts/operations/staging-core-csv-acceptance.mjs";
import {
  STAGING_CORE_CSV_ACCEPTANCE_CONFIRMATION,
  deriveStagingCoreCsvAcceptanceIds,
  evaluateStagingCoreCsvAcceptanceEnvironment,
} from "../src/lib/stagingCoreCsvAcceptancePolicy.mjs";
import { canonicalizeStagingRolloutEvidence } from "../scripts/operations/canonicalize-staging-rollout-evidence.mjs";

const PRIMARY_WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const PRIMARY_CONTACT_ID = "33333333-3333-4333-8333-333333333333";
const SECONDARY_WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";
const SECONDARY_CONTACT_ID = "44444444-4444-4444-8444-444444444444";

function acceptedEnvironment(overrides = {}) {
  return {
    FANMIND_RUNTIME_ENVIRONMENT: "staging",
    NEXT_PUBLIC_APP_URL: "https://staging.fanmind.ch",
    FANMIND_STAGING_SUPABASE_URL: "https://stagingprojectref.supabase.co",
    FANMIND_TARGET_SUPABASE_PROJECT_REF: "stagingprojectref",
    FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: "productionprojectref",
    FANMIND_STAGING_CORE_REVIEWED_COMMIT: "a".repeat(40),
    FANMIND_STAGING_CORE_CONFIRM:
      STAGING_CORE_CSV_ACCEPTANCE_CONFIRMATION,
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
    FANMIND_NON_PRODUCTION_WRITE_ACK: "I_UNDERSTAND_NON_PRODUCTION_ONLY",
    FANMIND_STAGING_E2E_EMAIL: "primary-staging@example.invalid",
    FANMIND_STAGING_E2E_PASSWORD: "Primary-Staging-Password-123!",
    FANMIND_STAGING_E2E_SECONDARY_EMAIL:
      "secondary-staging@example.invalid",
    FANMIND_STAGING_E2E_SECONDARY_PASSWORD:
      "Secondary-Staging-Password-456!",
    FANMIND_STAGING_E2E_MEMBER_PASSWORD: "Member-Staging-Password-789!",
    FANMIND_STAGING_E2E_WORKSPACE_ID: PRIMARY_WORKSPACE_ID,
    FANMIND_STAGING_E2E_CONTACT_ID: PRIMARY_CONTACT_ID,
    FANMIND_STAGING_E2E_SECONDARY_WORKSPACE_ID: SECONDARY_WORKSPACE_ID,
    FANMIND_STAGING_E2E_SECONDARY_CONTACT_ID: SECONDARY_CONTACT_ID,
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

test("Staging core and CSV writes require exact reviewed non-production boundaries", () => {
  assert.deepEqual(
    evaluateStagingCoreCsvAcceptanceEnvironment(acceptedEnvironment()),
    { ok: true, errors: [] },
  );
  for (const [overrides, expected] of [
    [{ FANMIND_RUNTIME_ENVIRONMENT: "production" }, "runtime_environment"],
    [{ NEXT_PUBLIC_APP_URL: "https://fanmind.ch" }, "application_boundary"],
    [
      { NEXT_PUBLIC_APP_URL: "https://staging.attacker.example" },
      "application_boundary",
    ],
    [
      { FANMIND_TARGET_SUPABASE_PROJECT_REF: "productionprojectref" },
      "supabase_boundary",
    ],
    [{ GITHUB_REF: "refs/heads/feature" }, "reviewed_commit"],
    [{ FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false" }, "write_confirmation"],
    [{ FANMIND_STAGING_E2E_MEMBER_PASSWORD: "short" }, "synthetic_passwords"],
    [{ PGHOST: "db.production.invalid" }, "database_boundary"],
    [{ DATABASE_URL: "postgres://redirect.invalid" }, "database_redirect"],
  ]) {
    const result = evaluateStagingCoreCsvAcceptanceEnvironment(
      acceptedEnvironment(overrides),
    );
    assert.equal(result.ok, false);
    assert.ok(result.errors.includes(expected));
  }
});

test("acceptance identities are deterministic, distinct and workspace-bound", () => {
  const first = deriveStagingCoreCsvAcceptanceIds(PRIMARY_WORKSPACE_ID);
  assert.deepEqual(
    first,
    deriveStagingCoreCsvAcceptanceIds(PRIMARY_WORKSPACE_ID),
  );
  assert.equal(new Set(Object.values(first)).size, 3);
  assert.notDeepEqual(
    first,
    deriveStagingCoreCsvAcceptanceIds(SECONDARY_WORKSPACE_ID),
  );
});

test("database prepare, verify and cleanup are marker-bound and residue-free", () => {
  const environment = acceptedEnvironment();
  const prepare = buildStagingCoreCsvPrepareSql(environment);
  const verify = buildStagingCoreCsvVerifySql(environment);
  const cleanup = buildStagingCoreCsvCleanupSql(environment);

  assert.match(prepare, /primary_fixture_workspace_invalid/u);
  assert.match(prepare, /member_fixture_invalid/u);
  assert.match(prepare, /insert into public\.contacts/u);
  assert.match(prepare, /insert into public\.conversations/u);
  assert.match(prepare, /insert into public\.conversation_messages/u);
  assert.match(prepare, /fanmind-staging-core-acceptance/u);
  assert.match(prepare, /STAGING_CORE_CSV_PREPARE=PASS/u);
  assert.doesNotMatch(prepare, /insert into auth\.|truncate|delete from public\.workspaces/iu);

  assert.match(verify, /acceptance_message_not_seen/u);
  assert.match(verify, /acceptance_memory_count/u);
  assert.match(verify, /acceptance_followup_count/u);
  assert.match(verify, /acceptance_ai_usage_count/u);
  assert.match(verify, /acceptance_csv_contact_count/u);
  assert.match(verify, /secondary_workspace_contamination/u);
  assert.match(verify, /STAGING_CORE_CSV_VERIFY=PASS/u);

  assert.match(cleanup, /cleanup_workspace_invalid/u);
  assert.match(cleanup, /cleanup_contact_collision/u);
  assert.match(cleanup, /cleanup_import_collision/u);
  assert.match(cleanup, /delete from public\.contacts/u);
  assert.match(cleanup, /delete from public\.ai_usage_events/u);
  assert.match(cleanup, /source_route = '\/api\/ai\/reply-suggestions'/u);
  assert.match(cleanup, /cleanup_incomplete/u);
  assert.match(cleanup, /STAGING_CORE_CSV_CLEANUP=PASS/u);
  assert.doesNotMatch(cleanup, /truncate|delete from public\.workspaces/iu);
});

test("manual workflow binds deployed commit, real browser flow and always cleanup", async () => {
  const [workflow, config, spec] = await Promise.all([
    readFile(".github/workflows/browser-e2e-staging-write.yml", "utf8"),
    readFile("playwright.staging-write.config.mts", "utf8"),
    readFile("e2e-staging-write/core-csv.spec.ts", "utf8"),
  ]);
  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /validate-dispatch:/u);
  assert.match(workflow, /\[\[ "\$REQUESTED_REVIEWED_COMMIT" == "\$GITHUB_SHA" \]\]/u);
  assert.match(workflow, /\[\[ "\$GITHUB_REF" == 'refs\/heads\/main' \]\]/u);
  assert.match(workflow, /staging-core-csv:[\s\S]*needs: validate-dispatch/u);
  assert.match(workflow, /run-staging-core-csv-acceptance/u);
  assert.match(workflow, /environment: staging/u);
  assert.match(workflow, /persist-credentials: false/u);
  assert.match(workflow, /NEXT_PUBLIC_SUPABASE_URL: \$\{\{ secrets\.FANMIND_STAGING_SUPABASE_URL \}\}/u);
  assert.match(workflow, /FANMIND_TARGET_API_ORIGIN: \$\{\{ vars\.FANMIND_STAGING_APP_URL \}\}/u);
  assert.match(workflow, /FANMIND_PRODUCTION_API_ORIGIN: https:\/\/fanmind\.ch/u);
  assert.match(workflow, /FANMIND_PRODUCTION_DB_HOST:/u);
  assert.match(workflow, /\/api\/version/u);
  assert.match(workflow, /payload\.releaseCommit !== process\.env\.FANMIND_EXPECTED_RELEASE_COMMIT/u);
  assert.match(workflow, /staging:core-csv:prepare/u);
  assert.match(workflow, /test:e2e:staging-write/u);
  assert.match(workflow, /staging:core-csv:verify/u);
  assert.match(workflow, /if: \$\{\{ always\(\) && steps\.passfile\.outcome == 'success' \}\}/u);
  assert.match(workflow, /staging:core-csv:cleanup/u);
  assert.match(
    workflow,
    /staging:core-csv:cleanup[\s\S]*Recheck database postflight and exact deployed release/u,
  );
  assert.match(workflow, /steps\.cleanup\.outcome == 'success'/u);
  assert.match(workflow, /steps\.rollout_baseline\.outcome == 'success'/u);
  assert.match(workflow, /canonicalize-staging-rollout-evidence\.mjs/u);
  assert.match(workflow, /cmp --silent --/u);
  assert.match(workflow, /staging_final_deployed_release_mismatch/u);
  assert.match(workflow, /STAGING_CORE_CSV_DATABASE_POSTFLIGHT=PASS/u);
  assert.match(workflow, /STAGING_CORE_CSV_FINAL_RELEASE=PASS/u);
  assert.match(workflow, /STAGING_CORE_CSV_ACCEPTANCE=PASS/u);
  assert.equal((workflow.match(/\/api\/version/gu) ?? []).length, 2);
  assert.ok(
    workflow.lastIndexOf("staging_final_deployed_release_mismatch") >
      workflow.indexOf("staging:core-csv:cleanup"),
  );
  assert.ok(
    workflow.lastIndexOf("STAGING_CORE_CSV_ACCEPTANCE=PASS") >
      workflow.lastIndexOf("staging_final_deployed_release_mismatch"),
  );
  assert.doesNotMatch(workflow, /pull_request:|push:|upload-artifact/u);

  assert.match(config, /fanmind-staging-core-csv-write/u);
  assert.match(config, /target\.origin !== STAGING_APP_ORIGIN/u);
  assert.match(config, /reviewedCommit !== githubSha/u);
  assert.match(config, /trace: "off"/u);
  assert.match(config, /screenshot: "off"/u);
  assert.match(config, /video: "off"/u);

  assert.match(spec, /FANMIND_E2E_STAGING_MEMBER_PASSWORD/u);
  assert.match(spec, /\/api\/ai\/reply-suggestions/u);
  assert.doesNotMatch(spec, /route\.fulfill/u);
  assert.match(spec, /Vorschlag fürs Kontaktwissen/u);
  assert.match(spec, /Follow-up-Vorschlag/u);
  assert.match(spec, /1 Duplikate übersprungen/u);
  assert.match(spec, /1 Zeilen mit Fehlern/u);
  assert.match(spec, /SECONDARY_WORKSPACE_ID/u);
  assert.match(spec, /Keine automatische Sendefunktion/u);
  assert.match(spec, /TURNSTILE_SCRIPT_PATH/u);
  assert.match(spec, /test\.afterEach[\s\S]*auth\/v1\/logout/u);
  assert.match(spec, /await logout\(page, secondarySession\)/u);
});

test("database rollout evidence is canonical, complete and fail-closed", () => {
  const output = [
    "> fanmind-temp@0.1.0 db:staging-rollout-state:run",
    "STAGING_DATABASE_ROLLOUT_STATE=PASS",
    "STAGING_DATABASE_ROLLOUT_WORKSPACE_MEMBER_BOUNDARY=verify",
    "STAGING_DATABASE_ROLLOUT_WHATSAPP_CLOUD_INBOUND=apply",
    "STAGING_DATABASE_ROLLOUT_META_CONTENT=apply",
    "STAGING_DATABASE_ROLLOUT_AI_TIER=verify",
    "STAGING_DATABASE_ROLLOUT_GENERIC_MIGRATION=disabled",
    "STAGING_DATABASE_ROLLOUT_TRIGGER_HARDENING=skip",
    "STAGING_DATABASE_ROLLOUT_META_CONTINUATION=verify",
    "STAGING_DATABASE_ROLLOUT_MOBILE_PUSH=apply",
    "STAGING_DATABASE_ROLLOUT_META_CATCHUP=skip",
    "SECRETS_WURDEN_NICHT_AUSGEGEBEN=true",
  ].join("\n");

  assert.equal(
    canonicalizeStagingRolloutEvidence(output),
    [
      "STAGING_DATABASE_ROLLOUT_WORKSPACE_MEMBER_BOUNDARY=verify",
      "STAGING_DATABASE_ROLLOUT_WHATSAPP_CLOUD_INBOUND=apply",
      "STAGING_DATABASE_ROLLOUT_AI_TIER=verify",
      "STAGING_DATABASE_ROLLOUT_MOBILE_PUSH=apply",
      "STAGING_DATABASE_ROLLOUT_META_CONTENT=apply",
      "STAGING_DATABASE_ROLLOUT_META_CATCHUP=skip",
      "STAGING_DATABASE_ROLLOUT_META_CONTINUATION=verify",
      "STAGING_DATABASE_ROLLOUT_TRIGGER_HARDENING=skip",
      "STAGING_DATABASE_ROLLOUT_GENERIC_MIGRATION=disabled",
      "STAGING_DATABASE_ROLLOUT_STATE=PASS",
      "",
    ].join("\n"),
  );

  for (const invalid of [
    output.replace("STAGING_DATABASE_ROLLOUT_WORKSPACE_MEMBER_BOUNDARY=verify\n", ""),
    output.replace("STAGING_DATABASE_ROLLOUT_WHATSAPP_CLOUD_INBOUND=apply\n", ""),
    output.replace("STAGING_DATABASE_ROLLOUT_META_CATCHUP=skip\n", ""),
    `${output}\nSTAGING_DATABASE_ROLLOUT_META_CATCHUP=skip`,
    output.replace("STAGING_DATABASE_ROLLOUT_STATE=PASS", "STAGING_DATABASE_ROLLOUT_STATE=BLOCKED"),
    output.replace("STAGING_DATABASE_ROLLOUT_AI_TIER=verify", "STAGING_DATABASE_ROLLOUT_AI_TIER=unknown"),
    output.replace("STAGING_DATABASE_ROLLOUT_GENERIC_MIGRATION=disabled", "STAGING_DATABASE_ROLLOUT_GENERIC_MIGRATION=enabled"),
  ]) {
    assert.throws(
      () => canonicalizeStagingRolloutEvidence(invalid),
      /invalid_rollout_evidence/u,
    );
  }
});

test("offline acceptance contract is credential-free", () => {
  const output = execFileSync(
    process.execPath,
    ["scripts/operations/staging-core-csv-acceptance.mjs", "--check"],
    { encoding: "utf8" },
  );
  assert.match(output, /STAGING_CORE_CSV_ACCEPTANCE_CONTRACT=PASS/u);
});
