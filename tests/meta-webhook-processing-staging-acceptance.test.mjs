import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import test from "node:test";

import {
  META_WEBHOOK_PROCESSING_STAGING_CONFIRMATION,
  buildMetaWebhookProcessingPreflightSql,
  evaluateMetaWebhookProcessingStagingEnvironment,
} from "../scripts/operations/meta-webhook-processing-staging-acceptance.mjs";
import { WORKSPACE_PROCESSING_STAGING_WORKSPACE_NAME } from "../src/lib/workspaceProcessingStagingPolicy.mjs";

const execFileAsync = promisify(execFile);
const scriptPath =
  "scripts/operations/meta-webhook-processing-staging-acceptance.mjs";
const workflowPath =
  ".github/workflows/meta-webhook-processing-staging-acceptance.yml";
const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const CONNECTION_ID = "22222222-2222-4222-8222-222222222222";
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
    FANMIND_META_WEBHOOK_PROCESSING_REVIEWED_COMMIT: COMMIT,
    FANMIND_META_WEBHOOK_PROCESSING_CONFIRM:
      META_WEBHOOK_PROCESSING_STAGING_CONFIRMATION,
    FANMIND_WORKSPACE_PROCESSING_STAGING_WORKSPACE_ID: WORKSPACE_ID,
    FANMIND_STAGING_E2E_EMAIL: "synthetic-staging@fanmind.example",
    FANMIND_STAGING_E2E_PASSWORD: "synthetic-staging-password-123",
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

test("Meta webhook processing acceptance requires exact isolated Staging credentials", () => {
  assert.deepEqual(
    evaluateMetaWebhookProcessingStagingEnvironment(stagingEnvironment()),
    { ok: true, errors: [] },
  );

  const unsafe = evaluateMetaWebhookProcessingStagingEnvironment(
    stagingEnvironment({
      FANMIND_RUNTIME_ENVIRONMENT: "production",
      NEXT_PUBLIC_APP_URL: "https://fanmind.ch",
      FANMIND_TARGET_API_ORIGIN: "https://fanmind.ch",
      NEXT_PUBLIC_SUPABASE_URL: "https://productionref123.supabase.co",
      FANMIND_TARGET_SUPABASE_PROJECT_REF: "productionref123",
      FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false",
      FANMIND_NON_PRODUCTION_WRITE_ACK: "",
      FANMIND_META_WEBHOOK_PROCESSING_REVIEWED_COMMIT: "b".repeat(40),
      FANMIND_META_WEBHOOK_PROCESSING_CONFIRM: "",
      FANMIND_WORKSPACE_PROCESSING_STAGING_WORKSPACE_ID: "customer",
      FANMIND_STAGING_E2E_EMAIL: "customer@example.com",
      FANMIND_STAGING_E2E_PASSWORD: "short",
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
    "synthetic_workspace",
    "database_tls",
    "database_redirect",
    "meta_webhook_confirmation",
    "synthetic_email",
    "synthetic_password",
    "meta_webhook_reviewed_commit",
  ]) {
    assert.ok(unsafe.errors.includes(error), `missing ${error}`);
  }
  assert.doesNotMatch(JSON.stringify(unsafe), /postgres:\/\//u);
});

test("preflight is pinned to the dedicated non-customer fixture", () => {
  const sql = buildMetaWebhookProcessingPreflightSql({
    workspaceId: WORKSPACE_ID,
    connectionId: CONNECTION_ID,
    pageId: "fanmind-meta-processing-synthetic-page",
    ownerEmail: "synthetic-staging@fanmind.example",
  });
  assert.match(sql, new RegExp(WORKSPACE_PROCESSING_STAGING_WORKSPACE_NAME, "u"));
  assert.match(sql, /workspace_processing_acceptance/u);
  assert.match(sql, /owner\.id = workspace\.owner_user_id/u);
  assert.doesNotMatch(sql, /workspace\.owner_id/u);
  assert.match(sql, /stripe_customer_id is null/u);
  assert.match(sql, /stripe_subscription_id is null/u);
  assert.match(sql, /existing_connected_facebook_fixture/u);
  assert.match(sql, /insert into public\.social_connections/u);
  assert.match(sql, /'facebook', 'meta', 'connected'/u);
  assert.match(sql, /FanMind synthetic webhook processing acceptance/u);
  assert.doesNotMatch(sql, /access_token|refresh_token|stripe_secret/iu);
});

test("offline check needs no browser, database or provider credential", async () => {
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [scriptPath, "--check"],
    { env: process.env },
  );
  const output = `${stdout}\n${stderr}`;
  assert.match(output, /META_WEBHOOK_PROCESSING_STAGING_ACCEPTANCE_MODE=check/u);
  assert.match(output, /META_WEBHOOK_PROCESSING_STAGING_ACCEPTANCE_READY=YES/u);
  assert.doesNotMatch(output, /postgres|supabase|password|stripe|access.token/iu);
});

test("Staging proof exercises the real login and webhook route with complete cleanup", async () => {
  const source = await readFile(scriptPath, "utf8");
  const suspendAt = source.indexOf("runSql(suspendSql(workspaceId)");
  const selfTestAt = source.indexOf("const blockedResult = await invokeSelfTest(page)");
  const restoreAt = source.indexOf("runSql(stateSql(workspaceId, snapshot)");
  const activeAt = source.indexOf("const activeResult = await invokeSelfTest(page)");
  assert.ok(suspendAt >= 0 && suspendAt < selfTestAt);
  assert.ok(selfTestAt < restoreAt && restoreAt < activeAt);
  assert.match(source, /\/api\/webhooks\/meta\/self-test/u);
  assert.match(source, /page\.goto\(`\$\{appOrigin\}\/login`\)/u);
  assert.doesNotMatch(source, /waitUntil: "domcontentloaded"/u);
  assert.match(source, /emailField\.waitFor\(\{ state: "visible" \}\)/u);
  assert.match(source, /page\.waitForResponse/u);
  assert.match(source, /url\.origin === supabaseOrigin/u);
  assert.match(source, /url\.pathname === "\/auth\/v1\/token"/u);
  assert.match(source, /url\.searchParams\.get\("grant_type"\) === "password"/u);
  assert.match(source, /staging_login_exchange_missing/u);
  assert.match(source, /staging_login_rejected/u);
  assert.match(source, /staging_login_session_missing/u);
  assert.match(source, /page\.waitForURL\(\/\\\/dashboard/u);
  assert.match(source, /staging_login_not_redirected/u);
  assert.match(source, /blocked_write_detected/u);
  assert.match(source, /reactivated_write_proof_invalid/u);
  assert.match(source, /META_WEBHOOK_PROCESSING_STAGING_DIAGNOSTIC=/u);
  assert.match(source, /latest_status/u);
  assert.match(source, /latest_error_reason/u);
  assert.match(source, /active_diagnostic_invalid/u);
  assert.match(source, /diagnosticSql\(\{ workspaceId, connectionId, startedAt \}\)/u);
  assert.ok(
    source.indexOf("diagnosticSql({ workspaceId, connectionId, startedAt })") <
      source.indexOf("cleanupSql({ workspaceId, connectionId, startedAt, snapshot })"),
  );
  assert.match(source, /messenger_sync_continuation_after/u);
  assert.match(source, /delete from public\.meta_conversation_catchup_jobs/u);
  assert.match(source, /delete from public\.meta_webhook_events/u);
  assert.match(source, /delete from public\.contacts/u);
  assert.match(source, /delete from public\.social_connections/u);
  assert.match(source, /conversation_count/u);
  assert.match(source, /message_count/u);
  assert.match(source, /event_count/u);
  assert.match(source, /job_count/u);
  assert.match(source, /state_digest/u);
});

test("manual workflow is exact-main, Staging-only, browser-backed and provider-free", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/u);
  assert.match(workflow, /inputs\.reviewed_commit == github\.sha/u);
  assert.match(workflow, /environment: staging/u);
  assert.match(workflow, /timeout-minutes: 15/u);
  assert.match(
    workflow,
    /inputs\.confirmation == 'run-meta-webhook-processing-staging-acceptance'/u,
  );
  assert.match(workflow, /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'true'/u);
  assert.match(workflow, /npm ci/u);
  assert.match(workflow, /npx playwright install --with-deps chromium/u);
  assert.match(workflow, /npm run db:staging-rollout-state:run/u);
  assert.match(workflow, /STAGING_DATABASE_ROLLOUT_STATE=PASS/u);
  assert.match(workflow, /npm run meta:webhook-processing:staging:run/u);
  assert.match(workflow, /if: \$\{\{ always\(\) \}\}/u);
  assert.doesNotMatch(workflow, /STRIPE_SECRET|META_ACCESS|OPENAI_API/u);
});
