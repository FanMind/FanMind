#!/usr/bin/env node

import {
  closeSync,
  constants,
  fstatSync,
  mkdtempSync,
  openSync,
  readSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

import {
  STAGING_OPERATOR_WORKSPACE_FLAG,
  STAGING_OPERATOR_WORKSPACE_NAME,
  evaluateStagingOperatorWorkspaceEnvironment,
} from "../../src/lib/stagingOperatorWorkspacePolicy.mjs";

const MAX_PASSFILE_BYTES = 64 * 1024;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

function fail(code) {
  throw new Error(`STAGING_OPERATOR_WORKSPACE_ERROR=${code}`);
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
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

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function buildStagingOperatorWorkspaceSql({ operatorEmail }) {
  const email = clean(operatorEmail).toLowerCase();
  const emailLiteral = sqlLiteral(email);
  const workspaceName = sqlLiteral(STAGING_OPERATOR_WORKSPACE_NAME);
  const marker = sqlLiteral(STAGING_OPERATOR_WORKSPACE_FLAG);

  return String.raw`
\set ON_ERROR_STOP on
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $provision$
declare
  v_auth_count integer;
  v_user_id uuid;
  v_workspace_count integer;
  v_workspace_id uuid;
begin
  select count(*)
    into v_auth_count
    from auth.users
   where lower(btrim(coalesce(email, ''))) = ${emailLiteral};

  if v_auth_count <> 1 then
    raise exception 'staging_operator_auth_user_count_invalid';
  end if;

  select id
    into v_user_id
    from auth.users
   where lower(btrim(coalesce(email, ''))) = ${emailLiteral}
   limit 1;

  perform pg_advisory_xact_lock(
    hashtextextended('fanmind-staging-operator:' || v_user_id::text, 0)
  );

  select count(*)
    into v_workspace_count
    from public.workspaces
   where owner_user_id = v_user_id;

  if v_workspace_count > 1 then
    raise exception 'staging_operator_workspace_count_invalid';
  end if;

  if v_workspace_count = 1 then
    select id
      into v_workspace_id
      from public.workspaces
     where owner_user_id = v_user_id;

    if not exists (
      select 1
        from public.workspaces
       where id = v_workspace_id
         and test_access_flags ->> ${marker} = 'true'
    ) then
      raise exception 'staging_operator_existing_workspace_unmarked';
    end if;
  else
    insert into public.workspaces (
      name,
      owner_user_id,
      plan_id,
      commercial_option,
      setup_fee_cents,
      monthly_fee_cents,
      commitment_months,
      billing_status,
      billing_provider,
      payment_collection_method,
      billing_manual_override,
      billing_admin_note,
      billing_updated_at,
      billing_updated_by_user_id,
      test_access_flags,
      workspace_access_mode
    ) values (
      ${workspaceName},
      v_user_id,
      'pilot',
      'pilot_only',
      0,
      0,
      0,
      'demo_free',
      'manual',
      'none',
      true,
      'Protected Staging operator access; billing disabled; no payment terms acceptance.',
      statement_timestamp(),
      v_user_id,
      jsonb_build_object(
        'admin', true,
        'demo', true,
        'internal', true,
        'test', true,
        'billing_disabled', true,
        'mail_confirmed', true,
        'no_expiry', true,
        'ai_maintenance', true,
        ${marker}, true
      ),
      'active'
    )
    returning id into v_workspace_id;
  end if;

  if exists (
    select 1
      from public.workspaces
     where id = v_workspace_id
       and (
         stripe_customer_id is not null
         or stripe_subscription_id is not null
         or stripe_checkout_session_id is not null
         or stripe_payment_intent_id is not null
         or stripe_mandate_id is not null
       )
  ) then
    raise exception 'staging_operator_stripe_state_not_empty';
  end if;

  insert into public.profiles as profile (id, email, display_name)
  values (v_user_id, ${emailLiteral}, 'FanMind Staging Operator')
  on conflict (id) do update
  set email = excluded.email,
      display_name = coalesce(
        nullif(btrim(profile.display_name), ''),
        excluded.display_name
      );

  update public.workspaces
     set name = ${workspaceName},
         plan_id = 'pilot',
         commercial_option = 'pilot_only',
         setup_fee_cents = 0,
         monthly_fee_cents = 0,
         commitment_months = 0,
         billing_status = 'demo_free',
         billing_provider = 'manual',
         payment_collection_method = 'none',
         billing_manual_override = true,
         billing_suspended_at = null,
         billing_suspended_reason = null,
         billing_last_payment_failed_at = null,
         billing_last_payment_at = null,
         billing_retry_count = 0,
         billing_next_retry_at = null,
         billing_grace_until = null,
         billing_admin_note = 'Protected Staging operator access; billing disabled; no payment terms acceptance.',
         billing_contract_started_at = null,
         billing_current_period_end_at = null,
         billing_next_invoice_at = null,
         billing_minimum_term_ends_at = null,
         subscription_cancel_requested_at = null,
         subscription_cancel_requested_by_user_id = null,
         subscription_cancel_at_period_end = false,
         subscription_effective_end_at = null,
         subscription_cancellation_revoked_at = null,
         stripe_customer_id = null,
         stripe_subscription_id = null,
         stripe_checkout_session_id = null,
         stripe_payment_intent_id = null,
         stripe_mandate_id = null,
         last_invoice_id = null,
         last_invoice_status = null,
         last_invoice_amount_due_cents = null,
         last_invoice_amount_paid_cents = null,
         last_invoice_hosted_url = null,
         last_invoice_pdf_url = null,
         payment_terms_version = null,
         payment_terms_accepted_at = null,
         payment_terms_accepted_by_user_id = null,
         billing_note = null,
         test_access_flags = jsonb_build_object(
           'admin', true,
           'demo', true,
           'internal', true,
           'test', true,
           'billing_disabled', true,
           'mail_confirmed', true,
           'no_expiry', true,
           'ai_maintenance', true,
           ${marker}, true
         ),
         workspace_access_mode = 'active',
         billing_updated_at = statement_timestamp(),
         billing_updated_by_user_id = v_user_id
   where id = v_workspace_id
     and owner_user_id = v_user_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, v_user_id, 'owner')
  on conflict on constraint workspace_members_workspace_id_user_id_key do update
  set role = excluded.role;

  if not exists (
    select 1
      from public.workspaces
     where id = v_workspace_id
       and owner_user_id = v_user_id
       and name = ${workspaceName}
       and plan_id = 'pilot'
       and commercial_option = 'pilot_only'
       and setup_fee_cents = 0
       and monthly_fee_cents = 0
       and commitment_months = 0
       and billing_status = 'demo_free'
       and billing_provider = 'manual'
       and payment_collection_method = 'none'
       and billing_manual_override = true
       and workspace_access_mode = 'active'
       and payment_terms_version is null
       and payment_terms_accepted_at is null
       and payment_terms_accepted_by_user_id is null
       and stripe_customer_id is null
       and stripe_subscription_id is null
       and stripe_checkout_session_id is null
       and stripe_payment_intent_id is null
       and stripe_mandate_id is null
       and test_access_flags ->> ${marker} = 'true'
  ) then
    raise exception 'staging_operator_workspace_verification_failed';
  end if;

  if not exists (
    select 1
      from public.workspace_members
     where workspace_id = v_workspace_id
       and user_id = v_user_id
       and role = 'owner'
  ) then
    raise exception 'staging_operator_membership_verification_failed';
  end if;
end
$provision$;

commit;

select 'FANMIND_STAGING_OPERATOR_WORKSPACE_ID=' || workspace.id::text
  from public.workspaces as workspace
  join auth.users as auth_user on auth_user.id = workspace.owner_user_id
 where lower(btrim(coalesce(auth_user.email, ''))) = ${emailLiteral}
   and workspace.test_access_flags ->> ${marker} = 'true';
select 'STAGING_OPERATOR_WORKSPACE_DATABASE=PASS';
`;
}

function privatePassfileSnapshot(environment) {
  const sourcePath = clean(environment.PGPASSFILE);
  if (!sourcePath || !isAbsolute(sourcePath)) fail("passfile_missing");

  let sourceDescriptor;
  let snapshotDirectory;
  let content;
  try {
    sourceDescriptor = openSync(
      sourcePath,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    const opened = fstatSync(sourceDescriptor);
    if (
      !opened.isFile() ||
      (opened.mode & 0o777) !== 0o600 ||
      opened.size < 1 ||
      opened.size > MAX_PASSFILE_BYTES ||
      (typeof process.getuid === "function" && opened.uid !== process.getuid())
    ) {
      fail("passfile_invalid");
    }
    content = Buffer.alloc(opened.size);
    let offset = 0;
    while (offset < content.length) {
      const bytesRead = readSync(
        sourceDescriptor,
        content,
        offset,
        content.length - offset,
        offset,
      );
      if (bytesRead === 0) fail("passfile_read");
      offset += bytesRead;
    }
    const settled = fstatSync(sourceDescriptor);
    if (
      settled.dev !== opened.dev ||
      settled.ino !== opened.ino ||
      settled.size !== opened.size ||
      settled.mtimeMs !== opened.mtimeMs ||
      settled.ctimeMs !== opened.ctimeMs
    ) {
      fail("passfile_changed");
    }

    snapshotDirectory = mkdtempSync(join(tmpdir(), "fanmind-staging-operator-"));
    const snapshotPath = join(snapshotDirectory, "pgpass");
    writeFileSync(snapshotPath, content, { mode: 0o600, flag: "wx" });
    return { snapshotDirectory, snapshotPath };
  } catch (error) {
    if (snapshotDirectory) {
      rmSync(snapshotDirectory, { recursive: true, force: true });
    }
    if (
      error instanceof Error &&
      error.message.startsWith("STAGING_OPERATOR_WORKSPACE_ERROR=")
    ) {
      throw error;
    }
    fail("passfile_read");
  } finally {
    content?.fill(0);
    if (sourceDescriptor !== undefined) closeSync(sourceDescriptor);
  }
}

function psqlEnvironment(environment, passfilePath) {
  const safeEnvironment = { ...environment, PGPASSFILE: passfilePath };
  for (const key of [
    "DATABASE_URL",
    "POSTGRES_URL",
    "SUPABASE_DB_URL",
    "PGHOSTADDR",
    "PGPASSWORD",
    "PGSERVICE",
    "PGSERVICEFILE",
    "PGSYSCONFDIR",
    "FANMIND_STAGING_DB_PASSWORD",
  ]) {
    delete safeEnvironment[key];
  }
  safeEnvironment.PGCONNECT_TIMEOUT = "10";
  return safeEnvironment;
}

function ensurePsqlAvailable() {
  const result = spawnSync("psql", ["--version"], {
    encoding: "utf8",
    stdio: ["ignore", "ignore", "ignore"],
  });
  if (result.error || result.status !== 0) fail("psql_unavailable");
}

function verifyReceipt(output) {
  const lines = String(output ?? "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  const assignment = lines.find((line) =>
    line.startsWith("FANMIND_STAGING_OPERATOR_WORKSPACE_ID="),
  );
  const workspaceId = assignment?.split("=")[1]?.trim().toLowerCase() ?? "";
  if (!UUID_PATTERN.test(workspaceId)) fail("receipt_workspace_missing");
  if (!lines.includes("STAGING_OPERATOR_WORKSPACE_DATABASE=PASS")) {
    fail("receipt_database_missing");
  }
  return workspaceId;
}

function runOfflineContractCheck() {
  const sql = buildStagingOperatorWorkspaceSql({
    operatorEmail: "operator-staging@example.invalid",
  });
  if (
    !sql.includes("begin;") ||
    !sql.includes("commit;") ||
    !sql.includes(STAGING_OPERATOR_WORKSPACE_NAME) ||
    !sql.includes(STAGING_OPERATOR_WORKSPACE_FLAG) ||
    !sql.includes("payment_terms_version = null")
  ) {
    fail("offline_contract_invalid");
  }
  console.log("STAGING_OPERATOR_WORKSPACE_MODE=check");
  console.log("STAGING_OPERATOR_WORKSPACE_CONTRACT=PASS");
}

function runProvisioning(environment) {
  const evaluation = evaluateStagingOperatorWorkspaceEnvironment(environment);
  if (!evaluation.ok) fail("environment_invalid");
  ensurePsqlAvailable();
  const passfile = privatePassfileSnapshot(environment);
  try {
    const sql = buildStagingOperatorWorkspaceSql({
      operatorEmail: environment.FANMIND_STAGING_OPERATOR_EMAIL,
    });
    const result = spawnSync(
      "psql",
      [
        "--no-password",
        "--no-psqlrc",
        "--quiet",
        "--tuples-only",
        "--no-align",
        "--set=ON_ERROR_STOP=1",
      ],
      {
        env: psqlEnvironment(environment, passfile.snapshotPath),
        input: sql,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    if (result.error || result.status !== 0) fail("database_apply_failed");
    const workspaceId = verifyReceipt(result.stdout);
    console.log(`FANMIND_STAGING_OPERATOR_WORKSPACE_ID=${workspaceId}`);
    console.log("STAGING_OPERATOR_WORKSPACE_PAYMENT_TERMS_WRITES=0");
    console.log("STAGING_OPERATOR_WORKSPACE_STRIPE_REFERENCES=0");
    console.log("STAGING_OPERATOR_WORKSPACE=PASS");
  } finally {
    rmSync(passfile.snapshotDirectory, { recursive: true, force: true });
  }
}

export function main(
  argumentsList = process.argv.slice(2),
  environment = process.env,
) {
  const mode = modeFromArguments(argumentsList);
  if (mode === "--check") {
    runOfflineContractCheck();
    return;
  }
  runProvisioning(environment);
}

const isMain =
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  try {
    main();
  } catch (error) {
    const message =
      error instanceof Error &&
      error.message.startsWith("STAGING_OPERATOR_WORKSPACE_ERROR=")
        ? error.message
        : "STAGING_OPERATOR_WORKSPACE_ERROR=unexpected";
    console.error(message);
    process.exitCode = 1;
  }
}
