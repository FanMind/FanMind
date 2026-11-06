#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { constants, lstatSync } from "node:fs";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

import {
  UUID_PATTERN,
  WORKSPACE_PROCESSING_STAGING_CONFIRMATION,
  WORKSPACE_PROCESSING_STAGING_WORKSPACE_NAME,
  evaluateWorkspaceProcessingStagingEnvironment,
} from "../../src/lib/workspaceProcessingStagingPolicy.mjs";

const CONFIRMATION = "run-meta-webhook-processing-staging-acceptance";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const SNAPSHOT_PREFIX = "META_WEBHOOK_PROCESSING_STAGING_SNAPSHOT=";
const COUNTS_PREFIX = "META_WEBHOOK_PROCESSING_STAGING_COUNTS=";
const DIAGNOSTIC_PREFIX = "META_WEBHOOK_PROCESSING_STAGING_DIAGNOSTIC=";

function fail(code) {
  throw new Error(`META_WEBHOOK_PROCESSING_STAGING_ERROR=${code}`);
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlUuid(value, code = "uuid_invalid") {
  if (!UUID_PATTERN.test(value)) fail(code);
  return `'${value}'::uuid`;
}

function modeFromArguments(argumentsList) {
  const known = new Set(["--check", "--run"]);
  if (argumentsList.some((argument) => !known.has(argument))) {
    fail("argument_invalid");
  }
  const selected = argumentsList.filter((argument) => known.has(argument));
  if (selected.length > 1) fail("mode_ambiguous");
  return selected[0] ?? "--check";
}

function assertPrivatePassfile(environment) {
  const passfile = clean(environment.PGPASSFILE);
  if (!passfile || !isAbsolute(passfile)) fail("passfile_missing");
  const stats = lstatSync(passfile);
  if (!stats.isFile() || stats.isSymbolicLink()) fail("passfile_invalid");
  if ((stats.mode & (constants.S_IRWXG | constants.S_IRWXO)) !== 0) {
    fail("passfile_permissions");
  }
  if (stats.size < 8 || stats.size > 64 * 1024) fail("passfile_size");
}

function runSql(sql, environment = process.env) {
  const result = spawnSync(
    "psql",
    [
      "-X",
      "--no-psqlrc",
      "--set",
      "ON_ERROR_STOP=1",
      "--tuples-only",
      "--no-align",
      "--quiet",
    ],
    {
      encoding: "utf8",
      env: { ...environment, PGPASSWORD: "" },
      input: sql,
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  if (result.status !== 0) {
    const diagnostic = clean(result.stderr).split("\n").slice(-4).join(" | ");
    if (diagnostic) console.error(diagnostic);
    fail("database_command_failed");
  }
  return result.stdout;
}

function parsePrefixedJson(output, prefix, code) {
  const line = String(output)
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  if (!line) fail(code);
  try {
    return JSON.parse(line.slice(prefix.length));
  } catch {
    fail(code);
  }
}

export function evaluateMetaWebhookProcessingStagingEnvironment(
  environment = {},
) {
  const boundary = evaluateWorkspaceProcessingStagingEnvironment({
    ...environment,
    FANMIND_WORKSPACE_PROCESSING_REVIEWED_COMMIT:
      environment.FANMIND_META_WEBHOOK_PROCESSING_REVIEWED_COMMIT,
    FANMIND_WORKSPACE_PROCESSING_STAGING_ACCEPTANCE_CONFIRM:
      WORKSPACE_PROCESSING_STAGING_CONFIRMATION,
  });
  const errors = [...boundary.errors];
  const email = clean(environment.FANMIND_STAGING_E2E_EMAIL).toLowerCase();
  const password = environment.FANMIND_STAGING_E2E_PASSWORD;
  const reviewedCommit = clean(
    environment.FANMIND_META_WEBHOOK_PROCESSING_REVIEWED_COMMIT,
  ).toLowerCase();

  if (
    clean(environment.FANMIND_META_WEBHOOK_PROCESSING_CONFIRM) !== CONFIRMATION
  ) {
    errors.push("meta_webhook_confirmation");
  }
  if (
    !EMAIL_PATTERN.test(email) ||
    !/staging|synthetic|test/iu.test(email)
  ) {
    errors.push("synthetic_email");
  }
  if (
    typeof password !== "string" ||
    password.length < 20 ||
    /[\r\n]/u.test(password)
  ) {
    errors.push("synthetic_password");
  }
  if (
    !COMMIT_PATTERN.test(reviewedCommit) ||
    reviewedCommit !== clean(environment.GITHUB_SHA).toLowerCase()
  ) {
    errors.push("meta_webhook_reviewed_commit");
  }

  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

export function buildMetaWebhookProcessingPreflightSql({
  workspaceId,
  connectionId,
  pageId,
  ownerEmail,
}) {
  const workspace = sqlUuid(workspaceId, "workspace_invalid");
  const connection = sqlUuid(connectionId, "connection_invalid");
  const fixtureName = sqlText(WORKSPACE_PROCESSING_STAGING_WORKSPACE_NAME);
  const page = sqlText(pageId);
  const email = sqlText(ownerEmail.toLowerCase());

  return String.raw`
\set ON_ERROR_STOP on
do $guard$
begin
  if not exists (
    select 1
      from public.workspaces as workspace
      join auth.users as owner on owner.id = workspace.owner_user_id
     where workspace.id = ${workspace}
       and workspace.name = ${fixtureName}
       and workspace.workspace_access_mode = 'active'
       and workspace.billing_status = 'active'
       and workspace.billing_manual_override = false
       and workspace.billing_grace_until is null
       and workspace.billing_suspended_at is null
       and workspace.stripe_customer_id is null
       and workspace.stripe_subscription_id is null
       and workspace.test_access_flags ->> 'workspace_processing_acceptance' = 'true'
       and lower(owner.email) = ${email}
  ) then
    raise exception 'dedicated_synthetic_workspace_invalid';
  end if;
  if exists (
    select 1 from public.social_connections
     where workspace_id = ${workspace}
       and platform = 'facebook'
       and status = 'connected'
  ) then
    raise exception 'existing_connected_facebook_fixture';
  end if;
end
$guard$;

select '${SNAPSHOT_PREFIX}' || jsonb_build_object(
  'workspace_access_mode', workspace_access_mode,
  'subscription_effective_end_at', subscription_effective_end_at,
  'billing_status', billing_status,
  'billing_manual_override', billing_manual_override,
  'billing_grace_until', billing_grace_until,
  'billing_suspended_at', billing_suspended_at,
  'test_access_flags', test_access_flags,
  'state_digest', md5(jsonb_build_object(
    'workspace_access_mode', workspace_access_mode,
    'subscription_effective_end_at', subscription_effective_end_at,
    'billing_status', billing_status,
    'billing_manual_override', billing_manual_override,
    'billing_grace_until', billing_grace_until,
    'billing_suspended_at', billing_suspended_at,
    'test_access_flags', test_access_flags
  )::text)
)::text
from public.workspaces where id = ${workspace};

insert into public.social_connections (
  id, workspace_id, platform, provider, status, page_id, page_name,
  webhook_subscribed, analytics_enabled
) values (
  ${connection}, ${workspace}, 'facebook', 'meta', 'connected', ${page},
  'FanMind synthetic webhook processing acceptance', true, false
);
`;
}

function stateSql(workspaceId, snapshot) {
  const nullableTimestamp = (value) =>
    value === null || value === undefined
      ? "null"
      : `${sqlText(value)}::timestamptz`;
  return String.raw`
update public.workspaces
   set workspace_access_mode = ${sqlText(snapshot.workspace_access_mode)},
       subscription_effective_end_at = ${nullableTimestamp(snapshot.subscription_effective_end_at)},
       billing_status = ${sqlText(snapshot.billing_status)},
       billing_manual_override = ${snapshot.billing_manual_override ? "true" : "false"},
       billing_grace_until = ${nullableTimestamp(snapshot.billing_grace_until)},
       billing_suspended_at = ${nullableTimestamp(snapshot.billing_suspended_at)},
       test_access_flags = ${sqlText(JSON.stringify(snapshot.test_access_flags ?? {}))}::jsonb
 where id = ${sqlUuid(workspaceId, "workspace_invalid")};
`;
}

function suspendSql(workspaceId) {
  return String.raw`
update public.workspaces
   set workspace_access_mode = 'active',
       subscription_effective_end_at = null,
       billing_status = 'suspended',
       billing_manual_override = false,
       billing_grace_until = null,
       billing_suspended_at = current_timestamp
 where id = ${sqlUuid(workspaceId, "workspace_invalid")};
`;
}

function countsSql({ workspaceId, connectionId, startedAt, blockedEndAt }) {
  const workspace = sqlUuid(workspaceId, "workspace_invalid");
  const connection = sqlUuid(connectionId, "connection_invalid");
  const start = `${sqlText(startedAt)}::timestamptz`;
  const blockedEnd = `${sqlText(blockedEndAt)}::timestamptz`;
  return String.raw`
select '${COUNTS_PREFIX}' || jsonb_build_object(
  'contacts', (select count(*) from public.contacts where workspace_id = ${workspace} and handle like 'fanmind-self-test-sender-%' and created_at >= ${start}),
  'messages', (select count(*) from public.conversation_messages where workspace_id = ${workspace} and external_message_id like 'fanmind-self-test-%' and created_at >= ${start}),
  'events', (select count(*) from public.meta_webhook_events where social_connection_id = ${connection} and created_at >= ${start}),
  'jobs', (select count(*) from public.meta_conversation_catchup_jobs where social_connection_id = ${connection} and created_at >= ${start}),
  'blocked_unmapped_events', (select count(*) from public.meta_webhook_events where workspace_id is null and status = 'ignored_unmapped_page' and created_at >= ${start} and created_at <= ${blockedEnd}),
  'cursor_after', (select messenger_sync_continuation_after from public.social_connections where id = ${connection}),
  'cursor_started_at', (select messenger_sync_continuation_started_at from public.social_connections where id = ${connection})
)::text;
`;
}

function diagnosticSql({ workspaceId, connectionId, startedAt }) {
  const workspace = sqlUuid(workspaceId, "workspace_invalid");
  const connection = sqlUuid(connectionId, "connection_invalid");
  const start = `${sqlText(startedAt)}::timestamptz`;
  return String.raw`
select '${DIAGNOSTIC_PREFIX}' || jsonb_build_object(
  'contacts', (select count(*) from public.contacts where workspace_id = ${workspace} and handle like 'fanmind-self-test-sender-%' and created_at >= ${start}),
  'conversations', (select count(*) from public.conversations where workspace_id = ${workspace} and created_at >= ${start}),
  'messages', (select count(*) from public.conversation_messages where workspace_id = ${workspace} and external_message_id like 'fanmind-self-test-%' and created_at >= ${start}),
  'events', (select count(*) from public.meta_webhook_events where social_connection_id = ${connection} and created_at >= ${start}),
  'jobs', (select count(*) from public.meta_conversation_catchup_jobs where social_connection_id = ${connection} and created_at >= ${start}),
  'latest_status', (select status from public.meta_webhook_events where social_connection_id = ${connection} and created_at >= ${start} order by created_at desc limit 1),
  'latest_error_reason', (select error_reason from public.meta_webhook_events where social_connection_id = ${connection} and created_at >= ${start} order by created_at desc limit 1)
)::text;
`;
}

function cleanupSql({ workspaceId, connectionId, startedAt, snapshot }) {
  const workspace = sqlUuid(workspaceId, "workspace_invalid");
  const connection = sqlUuid(connectionId, "connection_invalid");
  const start = `${sqlText(startedAt)}::timestamptz`;
  return String.raw`
begin;
delete from public.meta_conversation_catchup_jobs where social_connection_id = ${connection};
delete from public.meta_webhook_events where social_connection_id = ${connection};
delete from public.contacts where workspace_id = ${workspace} and handle like 'fanmind-self-test-sender-%' and created_at >= ${start};
delete from public.social_connections where id = ${connection};
${stateSql(workspaceId, snapshot)}
commit;
select 'META_WEBHOOK_PROCESSING_STAGING_CLEANUP=' || jsonb_build_object(
  'connection_count', (select count(*) from public.social_connections where id = ${connection}),
  'contact_count', (select count(*) from public.contacts where workspace_id = ${workspace} and handle like 'fanmind-self-test-sender-%' and created_at >= ${start}),
  'conversation_count', (select count(*) from public.conversations where workspace_id = ${workspace} and created_at >= ${start}),
  'message_count', (select count(*) from public.conversation_messages where workspace_id = ${workspace} and external_message_id like 'fanmind-self-test-%' and created_at >= ${start}),
  'event_count', (select count(*) from public.meta_webhook_events where social_connection_id = ${connection}),
  'job_count', (select count(*) from public.meta_conversation_catchup_jobs where social_connection_id = ${connection}),
  'state_digest', (select md5(jsonb_build_object(
    'workspace_access_mode', workspace_access_mode,
    'subscription_effective_end_at', subscription_effective_end_at,
    'billing_status', billing_status,
    'billing_manual_override', billing_manual_override,
    'billing_grace_until', billing_grace_until,
    'billing_suspended_at', billing_suspended_at,
    'test_access_flags', test_access_flags
  )::text) from public.workspaces where id = ${workspace})
)::text;
`;
}

async function login(page, appOrigin, supabaseOrigin, email, password) {
  await page.goto(`${appOrigin}/login`);
  const emailField = page.getByRole("textbox", { name: "E-Mail", exact: true });
  const passwordField = page.locator('input[name="password"]');
  await emailField.waitFor({ state: "visible" });
  await passwordField.waitFor({ state: "visible" });
  await emailField.fill(email);
  await passwordField.fill(password);

  let response;
  try {
    [response] = await Promise.all([
      page.waitForResponse((candidate) => {
        const url = new URL(candidate.url());
        return (
          url.origin === supabaseOrigin &&
          url.pathname === "/auth/v1/token" &&
          url.searchParams.get("grant_type") === "password"
        );
      }),
      page.getByRole("button", { name: /Einloggen/u }).click(),
    ]);
  } catch {
    fail("staging_login_exchange_missing");
  }
  if (!response.ok()) fail("staging_login_rejected");
  let payload;
  try {
    payload = await response.json();
  } catch {
    fail("staging_login_session_missing");
  }
  if (typeof payload?.access_token !== "string") {
    fail("staging_login_session_missing");
  }

  try {
    await page.waitForURL(/\/dashboard(?:\?|$)/u, { timeout: 30_000 });
  } catch {
    fail("staging_login_not_redirected");
  }
}

async function invokeSelfTest(page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/webhooks/meta/self-test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    return { status: response.status, body: await response.json() };
  });
}

function requireSelfTest(result, expected) {
  if (
    result.status !== 200 ||
    result.body?.ok !== true ||
    result.body?.saved !== expected.saved ||
    result.body?.skipped !== expected.skipped ||
    result.body?.page_id !== expected.pageId ||
    result.body?.workspace_id !== expected.workspaceId
  ) {
    console.error(JSON.stringify({ status: result.status, body: result.body }));
    fail(expected.saved ? "reactivated_webhook_failed" : "blocked_webhook_failed");
  }
}

function requireCounts(counts, phase) {
  const numeric = (key) => Number(counts?.[key] ?? Number.NaN);
  if (phase === "blocked") {
    if (
      numeric("contacts") !== 0 ||
      numeric("messages") !== 0 ||
      numeric("events") !== 0 ||
      numeric("jobs") !== 0 ||
      numeric("blocked_unmapped_events") !== 0
    ) {
      fail("blocked_write_detected");
    }
    return;
  }
  if (
    numeric("contacts") !== 1 ||
    numeric("messages") !== 1 ||
    numeric("events") !== 1 ||
    ![0, 1].includes(numeric("jobs")) ||
    counts.cursor_after !== null ||
    counts.cursor_started_at !== null
  ) {
    fail("reactivated_write_proof_invalid");
  }
}

export async function runMetaWebhookProcessingStagingAcceptance(
  environment = process.env,
) {
  const evaluation = evaluateMetaWebhookProcessingStagingEnvironment(environment);
  if (!evaluation.ok) fail(`environment_${evaluation.errors.join("_")}`);
  assertPrivatePassfile(environment);

  const workspaceId = clean(
    environment.FANMIND_WORKSPACE_PROCESSING_STAGING_WORKSPACE_ID,
  );
  const ownerEmail = clean(environment.FANMIND_STAGING_E2E_EMAIL).toLowerCase();
  const password = environment.FANMIND_STAGING_E2E_PASSWORD;
  const appOrigin = new URL(clean(environment.NEXT_PUBLIC_APP_URL)).origin;
  const supabaseOrigin = new URL(
    clean(environment.NEXT_PUBLIC_SUPABASE_URL),
  ).origin;
  const connectionId = randomUUID();
  const pageId = `fanmind-meta-processing-${randomUUID()}`;
  const startedAt = new Date().toISOString();
  let snapshot;
  let browser;

  try {
    const preflight = runSql(
      buildMetaWebhookProcessingPreflightSql({
        workspaceId,
        connectionId,
        pageId,
        ownerEmail,
      }),
      environment,
    );
    snapshot = parsePrefixedJson(preflight, SNAPSHOT_PREFIX, "snapshot_invalid");

    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await login(page, appOrigin, supabaseOrigin, ownerEmail, password);

    runSql(suspendSql(workspaceId), environment);
    const blockedResult = await invokeSelfTest(page);
    const blockedEndAt = new Date().toISOString();
    requireSelfTest(blockedResult, {
      saved: false,
      skipped: true,
      pageId,
      workspaceId,
    });
    const blockedCounts = parsePrefixedJson(
      runSql(
        countsSql({ workspaceId, connectionId, startedAt, blockedEndAt }),
        environment,
      ),
      COUNTS_PREFIX,
      "blocked_counts_invalid",
    );
    requireCounts(blockedCounts, "blocked");

    runSql(stateSql(workspaceId, snapshot), environment);
    const activeResult = await invokeSelfTest(page);
    try {
      requireSelfTest(activeResult, {
        saved: true,
        skipped: false,
        pageId,
        workspaceId,
      });
    } catch (error) {
      const diagnostic = parsePrefixedJson(
        runSql(
          diagnosticSql({ workspaceId, connectionId, startedAt }),
          environment,
        ),
        DIAGNOSTIC_PREFIX,
        "active_diagnostic_invalid",
      );
      console.error(`${DIAGNOSTIC_PREFIX}${JSON.stringify(diagnostic)}`);
      throw error;
    }
    const activeCounts = parsePrefixedJson(
      runSql(
        countsSql({
          workspaceId,
          connectionId,
          startedAt,
          blockedEndAt,
        }),
        environment,
      ),
      COUNTS_PREFIX,
      "active_counts_invalid",
    );
    requireCounts(activeCounts, "active");
  } finally {
    if (browser) await browser.close();
    if (snapshot) {
      const cleanup = parsePrefixedJson(
        runSql(
          cleanupSql({ workspaceId, connectionId, startedAt, snapshot }),
          environment,
        ),
        "META_WEBHOOK_PROCESSING_STAGING_CLEANUP=",
        "cleanup_output_invalid",
      );
      if (
        Number(cleanup.connection_count) !== 0 ||
        Number(cleanup.contact_count) !== 0 ||
        Number(cleanup.conversation_count) !== 0 ||
        Number(cleanup.message_count) !== 0 ||
        Number(cleanup.event_count) !== 0 ||
        Number(cleanup.job_count) !== 0 ||
        cleanup.state_digest !== snapshot.state_digest
      ) {
        fail("cleanup_verification_failed");
      }
    }
  }

  return {
    blockedWrites: 0,
    reactivatedMessages: 1,
    cursorMutations: 0,
  };
}

async function main() {
  const mode = modeFromArguments(process.argv.slice(2));
  console.log(
    `META_WEBHOOK_PROCESSING_STAGING_ACCEPTANCE_MODE=${mode === "--run" ? "run" : "check"}`,
  );
  if (mode === "--check") {
    console.log("META_WEBHOOK_PROCESSING_STAGING_ACCEPTANCE_READY=YES");
    return;
  }
  const result = await runMetaWebhookProcessingStagingAcceptance(process.env);
  console.log(`META_WEBHOOK_PROCESSING_STAGING_BLOCKED_WRITES=${result.blockedWrites}`);
  console.log(
    `META_WEBHOOK_PROCESSING_STAGING_REACTIVATED_MESSAGES=${result.reactivatedMessages}`,
  );
  console.log(
    `META_WEBHOOK_PROCESSING_STAGING_CURSOR_MUTATIONS=${result.cursorMutations}`,
  );
  console.log("META_WEBHOOK_PROCESSING_STAGING_ACCEPTANCE=PASS");
}

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectExecution) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

export { CONFIRMATION as META_WEBHOOK_PROCESSING_STAGING_CONFIRMATION };
