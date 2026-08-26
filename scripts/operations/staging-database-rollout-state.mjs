#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  MIGRATION_ID as AI_TIER_MIGRATION_ID,
  POSTFLIGHT_SQL as AI_TIER_POSTFLIGHT_SQL,
} from "./ai-tier-entitlement-migration-runner.mjs";
import * as metaContentMigrationControl from "./meta-content-migration-runner.mjs";
import {
  MIGRATION_ID as MOBILE_PUSH_MIGRATION_ID,
  POSTFLIGHT_SQL as MOBILE_PUSH_POSTFLIGHT_SQL,
} from "./mobile-push-registration-migration-runner.mjs";
import { POSTFLIGHT_SQL as META_CATCHUP_POSTFLIGHT_SQL } from "./meta-catchup-queue-migration-runner.mjs";
import {
  MIGRATION_ID as META_CONTINUATION_MIGRATION_ID,
  POSTFLIGHT_SQL as META_CONTINUATION_POSTFLIGHT_SQL,
  STATE_SQL as META_CONTINUATION_STATE_SQL,
} from "./meta-conversation-continuation-migration-runner.mjs";
import {
  CONTROL_PATH as STRIPE_BILLING_LEDGER_CONTROL_PATH,
  materializeStripeBillingEventLedgerPostflight,
} from "./stripe-billing-event-ledger-runner.mjs";
import {
  POSTFLIGHT_SQL as AI_TIER_STRIPE_LEDGER_POSTFLIGHT_SQL,
} from "./ai-tier-stripe-event-ledger-runner.mjs";
import {
  deriveStagingDatabaseRolloutActions,
  evaluateStagingDatabaseRolloutStateEnvironment,
} from "../../src/lib/stagingDatabaseRolloutStatePolicy.mjs";
import {
  CONTROL_PATH as WORKSPACE_MEMBER_BOUNDARY_CONTROL_PATH,
  PROTECTED_MEMBER_WRITABLE_TABLES,
  materializeWorkspaceMemberDataBoundaryPostflight,
} from "./workspace-member-data-boundary-runner.mjs";
import {
  CONTROL_PATH as WHATSAPP_CLOUD_INBOUND_CONTROL_PATH,
  STATE_SQL as WHATSAPP_CLOUD_INBOUND_STATE_SQL,
  materializeWhatsAppCloudInboundPostflight,
} from "./whatsapp-cloud-inbound-migration-runner.mjs";

const MAX_PASSFILE_BYTES = 64 * 1024;
const OPTIONAL_TRIGGER_RUNNER = resolve(
  process.cwd(),
  "scripts/operations/trigger-function-hardening-migration-runner.mjs",
);

const OFFLINE_CONTROLS = Object.freeze([
  Object.freeze({
    path: resolve(
      process.cwd(),
      "scripts/operations/workspace-member-data-boundary-runner.mjs",
    ),
    arguments: ["--check"],
  }),
  Object.freeze({
    path: resolve(
      process.cwd(),
      "scripts/operations/whatsapp-cloud-inbound-migration-runner.mjs",
    ),
    arguments: ["--check"],
  }),
  Object.freeze({
    path: resolve(
      process.cwd(),
      "scripts/operations/ai-tier-stripe-event-ledger-runner.mjs",
    ),
    arguments: ["--check"],
  }),
  Object.freeze({
    path: resolve(
      process.cwd(),
      "scripts/operations/ai-tier-entitlement-migration-runner.mjs",
    ),
    arguments: ["--check"],
  }),
  Object.freeze({
    path: resolve(
      process.cwd(),
      "scripts/operations/mobile-push-registration-migration-runner.mjs",
    ),
    arguments: ["--check"],
  }),
  Object.freeze({
    path: resolve(
      process.cwd(),
      "scripts/operations/meta-content-migration-runner.mjs",
    ),
    arguments: ["--check"],
  }),
  Object.freeze({
    path: resolve(
      process.cwd(),
      "scripts/operations/meta-catchup-queue-migration-runner.mjs",
    ),
    arguments: ["--check"],
  }),
  Object.freeze({
    path: resolve(
      process.cwd(),
      "scripts/operations/meta-conversation-continuation-migration-runner.mjs",
    ),
    arguments: ["--check"],
  }),
  Object.freeze({
    path: resolve(
      process.cwd(),
      "scripts/operations/stripe-billing-event-ledger-runner.mjs",
    ),
    arguments: ["--check"],
  }),
]);

function fail(code) {
  throw new Error(`STAGING_DATABASE_ROLLOUT_STATE_ERROR=${code}`);
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

function migrationVersion(migrationId) {
  const match = /^(\d{14})_[a-z0-9_]+$/u.exec(migrationId);
  if (!match) fail("migration_id_invalid");
  return match[1];
}

function verifyOfflineControls() {
  const controls = [...OFFLINE_CONTROLS];
  if (existsSync(OPTIONAL_TRIGGER_RUNNER)) {
    controls.push(
      Object.freeze({ path: OPTIONAL_TRIGGER_RUNNER, arguments: ["--check"] }),
    );
  }
  for (const control of controls) {
    const result = spawnSync(process.execPath, [control.path, ...control.arguments], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (result.error || result.status !== 0) fail("offline_control_failed");
  }
  console.log("STAGING_DATABASE_ROLLOUT_STATE_CONTROLS=verified");
}

function ledgerManagedMetaMigrations(migrations) {
  if (!Array.isArray(migrations)) fail("migration_manifest_invalid");
  const normalizedMigrations =
    migrations.length === 2 &&
    migrations.every((migration) => migration?.stage === undefined)
      ? migrations.map((migration) => ({ ...migration, stage: "foundation" }))
      : migrations;
  const foundationMigrations = normalizedMigrations.filter(
    (migration) => migration?.stage === "foundation",
  );
  if (
    foundationMigrations.length !== 2 ||
    foundationMigrations.some(
      (migration) => typeof migration.id !== "string",
    )
  ) {
    fail("migration_manifest_invalid");
  }
  return foundationMigrations;
}

function ledgerSql({
  metaMigrations = metaContentMigrationControl.MIGRATIONS,
} = {}) {
  const ledgerMetaMigrations = ledgerManagedMetaMigrations(metaMigrations);
  const migrationIds = [
    AI_TIER_MIGRATION_ID,
    MOBILE_PUSH_MIGRATION_ID,
    ...ledgerMetaMigrations.map((migration) => migration.id),
    META_CONTINUATION_MIGRATION_ID,
  ];
  const versions = migrationIds.map((migrationId) =>
    migrationVersion(migrationId),
  );
  if (versions.length !== 5 || new Set(versions).size !== 5) {
    fail("migration_manifest_invalid");
  }
  const flags = migrationIds.map(
    (migrationId, index) => String.raw`case when count(*) filter (
      where version = '${versions[index]}'
        or name in (
          '${migrationId}',
          '${migrationId.replace(/^\d{14}_/u, "")}'
        )
    ) = 1 then '1' else '0' end`,
  );
  flags.push(String.raw`case when count(*) filter (
      where version = '20260809141141'
        and name = 'workspace_server_owned_columns_controlled'
    ) = 1 then '1' else '0' end`);
  flags.push(String.raw`case when count(*) filter (
      where version = '20260816120000'
        or name in (
          '20260816120000_workspace_member_data_boundary',
          'workspace_member_data_boundary'
        )
    ) = 0 then '0' else '1' end`);
  flags.push(String.raw`case when count(*) filter (
      where version = '20260817230000'
        or name in (
          '20260817230000_whatsapp_cloud_inbound_foundation',
          'whatsapp_cloud_inbound_foundation'
        )
    ) = 0 then '0' else '1' end`);
  return String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;
select concat(
  'STAGING_DATABASE_LEDGER=',
  ${flags.join(", ':', ")}
)
from supabase_migrations.schema_migrations;
rollback;
`;
}

const LEDGER_STATE_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;
select 'STAGING_DATABASE_LEDGER_OBJECT=' ||
  case when to_regclass('supabase_migrations.schema_migrations') is null
    then 'absent' else 'present' end;
rollback;
`;

const AI_TIER_STATE_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;
select 'STAGING_DATABASE_AI_TIER_OBJECT=' ||
  case when to_regclass('public.workspace_ai_tier_entitlements') is null
    then 'absent' else 'present' end;
rollback;
`;

const AI_TIER_STRIPE_LEDGER_STATE_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;
with topology as (
  select
    (case when exists (
      select 1 from pg_attribute
       where attrelid = to_regclass('public.workspace_ai_tier_entitlements')
         and attname = 'stripe_sync_state'
         and attnum > 0 and not attisdropped
    ) then 1 else 0 end) +
    (case when exists (
      select 1 from pg_attribute
       where attrelid = to_regclass('public.workspace_ai_tier_entitlements')
         and attname = 'stripe_sync_revision'
         and attnum > 0 and not attisdropped
    ) then 1 else 0 end) +
    (case when to_regclass('public.workspace_ai_tier_stripe_events')
      is not null then 1 else 0 end) +
    (case when to_regclass('public.workspace_ai_tier_stripe_reconciliations')
      is not null then 1 else 0 end) +
    (case when to_regprocedure(
      'public.apply_workspace_ai_tier_stripe_event(uuid,boolean,text,bigint,text,text,text,text,boolean,text,text,text,text,timestamp with time zone,timestamp with time zone)'
    ) is not null then 1 else 0 end) +
    (case when to_regprocedure(
      'public.reconcile_workspace_ai_tier_stripe_subscription(uuid,text,text,text,text,timestamp with time zone,text,bigint,boolean,text,text,text,text,timestamp with time zone,timestamp with time zone)'
    ) is not null then 1 else 0 end) as object_count,
    (
      select count(*)::integer
        from pg_proc as definition
        join pg_namespace as namespace
          on namespace.oid = definition.pronamespace
       where namespace.nspname = 'public'
         and definition.proname in (
           'apply_workspace_ai_tier_stripe_event',
           'reconcile_workspace_ai_tier_stripe_subscription'
         )
    ) as function_count
)
select 'STAGING_DATABASE_AI_TIER_STRIPE_LEDGER_OBJECT=' ||
  case
    when object_count = 0 and function_count = 0 then 'absent'
    when object_count = 6 and function_count = 2 then 'present'
    else 'invalid'
  end
  from topology;
rollback;
`;

const STRIPE_BILLING_LEDGER_STATE_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;
with topology as (
  select count(*)::integer as object_count
    from unnest(array[
      to_regclass('public.workspace_stripe_billing_streams')::oid,
      to_regclass('public.workspace_stripe_billing_object_bindings')::oid,
      to_regclass('public.workspace_stripe_billing_reconciliations')::oid,
      to_regclass('public.workspace_stripe_billing_events')::oid,
      to_regprocedure('public.workspace_stripe_billing_projection_valid(jsonb)')::oid,
      to_regprocedure('public.apply_workspace_stripe_billing_projection(uuid,jsonb)')::oid,
      to_regprocedure('public.mark_workspace_stripe_billing_reconciliation(uuid)')::oid,
      to_regprocedure('public.apply_workspace_stripe_billing_event(boolean,boolean,text,bigint,text,text,text,uuid,boolean,text,text,text,text,text,text,text,text,text,text,jsonb)')::oid,
      to_regprocedure('public.reconcile_workspace_stripe_billing_projection(uuid,text,text,timestamp with time zone,text,bigint,text,text,jsonb,text[],jsonb)')::oid,
      to_regprocedure('public.verify_workspace_stripe_billing_ledger_schema()')::oid
    ]::oid[]) as installed(oid)
   where installed.oid is not null
)
select 'STAGING_DATABASE_STRIPE_BILLING_LEDGER_OBJECT=' ||
  case object_count when 0 then 'absent' when 10 then 'present' else 'invalid' end
  from topology;
rollback;
`;

const MOBILE_PUSH_STATE_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;
select 'STAGING_DATABASE_MOBILE_PUSH_OBJECT=' ||
  case when to_regclass('public.mobile_push_registrations') is null
    then 'absent' else 'present' end;
rollback;
`;

const META_CATCHUP_STATE_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;
select 'STAGING_DATABASE_META_CATCHUP_OBJECT=' ||
  case when to_regclass('public.meta_conversation_catchup_jobs') is null
    then 'absent' else 'present' end;
rollback;
`;

const TRIGGER_HARDENING_STATE_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;
select 'STAGING_DATABASE_TRIGGER_OBJECT=' ||
  case
    when (
      select count(*)
      from pg_proc
      where oid in (
        to_regprocedure('public.set_social_connections_updated_at()'),
        to_regprocedure('public.set_referral_updated_at()'),
        to_regprocedure('public.set_demo_start_session_updated_at()')
      )
        and pronargs = 0
        and prorettype = 'trigger'::regtype
    ) <> 3 then 'invalid'
    when to_regprocedure(
      'public.trim_conversation_messages_to_latest_50()'
    ) is not null
      and not exists (
        select 1
        from pg_proc
        where oid = to_regprocedure(
          'public.trim_conversation_messages_to_latest_50()'
        )
          and pronargs = 0
          and prorettype = 'trigger'::regtype
          and prosecdef
      ) then 'invalid'
    else 'pending'
  end;
rollback;
`;

const WORKSPACE_MEMBER_BOUNDARY_STATE_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;
with control_state as (
  select
    (
      select count(*)
        from unnest(array[
          to_regprocedure(
            'public.workspace_processing_allowed_contract(text,text,text,boolean,text,text,jsonb,timestamp with time zone)'
          ),
          to_regprocedure(
            'public.workspace_owner_active_mutation_allowed(uuid)'
          ),
          to_regprocedure(
            'public.get_current_workspace_member_safe_dashboard()'
          )
        ]::oid[]) as function_oid
       where function_oid is not null
    ) as function_count,
    (
      select count(*)
        from pg_policies as policy
       where policy.schemaname = 'public'
         and (
           (
             policy.tablename = 'workspaces'
             and policy.policyname = 'workspaces_select_requires_owner'
           )
           or (
             policy.tablename = 'workspace_analysis_settings'
             and policy.policyname =
                 'workspace_analysis_settings_select_requires_workspace_owner'
           )
           or (
             policy.tablename = 'social_connections'
             and policy.policyname in (
               'social_connections_select_requires_workspace_owner',
               'social_connections_insert_requires_workspace_owner',
               'social_connections_update_requires_workspace_owner',
               'social_connections_delete_requires_workspace_owner'
             )
           )
           or (
             policy.tablename = any(array[
               ${PROTECTED_MEMBER_WRITABLE_TABLES.map((table) => `'${table}'`).join(",\n               ")}
             ]::text[])
             and policy.policyname in (
               policy.tablename || '_insert_requires_workspace_owner',
               policy.tablename || '_update_requires_workspace_owner',
               policy.tablename || '_delete_requires_workspace_owner'
             )
           )
         )
    ) as policy_count
)
select 'STAGING_DATABASE_WORKSPACE_MEMBER_BOUNDARY_OBJECT=' ||
  case
    when function_count = 0 and policy_count = 0 then 'absent'
    when function_count = 3 and policy_count = 42 then 'present'
    else 'invalid'
  end
  from control_state;
rollback;
`;

function privatePassfileSnapshot(environment) {
  const sourcePath = environment.PGPASSFILE?.trim();
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
      if (bytesRead === 0) fail("passfile_read_failed");
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

    snapshotDirectory = mkdtempSync(
      join(tmpdir(), "fanmind-staging-rollout-state-"),
    );
    const snapshotPath = join(snapshotDirectory, "pgpass");
    writeFileSync(snapshotPath, content, { mode: 0o600, flag: "wx" });
    return { snapshotDirectory, snapshotPath };
  } catch (error) {
    if (snapshotDirectory) {
      rmSync(snapshotDirectory, { recursive: true, force: true });
    }
    if (
      error instanceof Error &&
      error.message.startsWith("STAGING_DATABASE_ROLLOUT_STATE_ERROR=")
    ) {
      throw error;
    }
    fail("passfile_read_failed");
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
    "PGPASSWORD",
    "PGHOSTADDR",
    "PGSERVICE",
    "PGSERVICEFILE",
    "PGSYSCONFDIR",
    "PGSSLCERT",
    "PGSSLKEY",
    "PGSSLPASSWORD",
    "PGSSLCRL",
    "PGSSLCRLDIR",
  ]) {
    delete safeEnvironment[key];
  }
  safeEnvironment.PGCONNECT_TIMEOUT = "10";
  safeEnvironment.PGSSLMODE = "verify-full";
  return safeEnvironment;
}

function runPsql(sql, environment, passfilePath) {
  return spawnSync(
    "psql",
    [
      "--no-password",
      "--no-psqlrc",
      "--quiet",
      "--tuples-only",
      "--no-align",
      "--set=ON_ERROR_STOP=1",
      "--set=VERBOSITY=verbose",
      "--set=SHOW_CONTEXT=never",
    ],
    {
      env: psqlEnvironment(environment, passfilePath),
      input: sql,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
}

function psqlFailureCategory(result) {
  if (result?.error?.code === "ENOENT") return "client_unavailable";
  if (result?.error) return "client_execution_failed";

  const diagnostic = String(result?.stderr ?? "").toLowerCase();
  const patterns = [
    ["tenant_or_user_not_found", /tenant or user not found/u],
    ["password_authentication_failed", /password authentication failed/u],
    ["password_unavailable", /no password supplied/u],
    ["access_rule_rejected", /no pg_hba\.conf entry/u],
    ["tls_verification_failed", /certificate verify failed|root certificate file/u],
    ["dns_resolution_failed", /could not translate host name|name or service not known/u],
    ["connection_timeout", /connection timed out|timeout expired/u],
    ["network_unreachable", /network is unreachable|no route to host/u],
    ["connection_refused", /connection refused/u],
    ["connection_closed", /server closed the connection unexpectedly/u],
    ["permission_denied", /permission denied/u],
    ["object_absent", /does not exist/u],
    ["sql_syntax_invalid", /syntax error/u],
    ["transaction_aborted", /current transaction is aborted/u],
    ["write_blocked", /read-only transaction/u],
    ["tls_transport_failed", /ssl syscall error|ssl error/u],
  ];
  for (const [category, pattern] of patterns) {
    if (pattern.test(diagnostic)) return category;
  }

  const sqlState = /\b(?:error|fatal):\s+([0-9a-z]{5}):/u.exec(
    diagnostic,
  )?.[1];
  return sqlState ? `sqlstate_${sqlState}` : "unclassified";
}

function ensurePsqlAvailable() {
  const result = spawnSync("psql", ["--version"], {
    encoding: "utf8",
    stdio: ["ignore", "ignore", "ignore"],
  });
  if (result.error || result.status !== 0) fail("psql_unavailable");
}

function probeLines(output) {
  return String(output ?? "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function exactControlledObjectState(output, marker) {
  const lines = probeLines(output);
  if (lines.length !== 1) return "invalid";
  if (lines[0] === `${marker}=absent`) return "absent";
  if (lines[0] === `${marker}=present`) return "present";
  return "invalid";
}

function exactAiTierStripeLedgerPostflight(output) {
  const lines = probeLines(output);
  return (
    lines.length === 1 &&
    lines[0] === "AI_TIER_STRIPE_EVENT_LEDGER_POSTFLIGHT=PASS"
  );
}

function exactStripeBillingLedgerPostflight(output) {
  const lines = probeLines(output);
  return (
    lines.length === 3 &&
    lines[0] === "STRIPE_BILLING_EVENT_LEDGER_POSTFLIGHT=PASS" &&
    /^STRIPE_BILLING_EVENT_LEDGER_CUTOVER_PENDING=\d+$/u.test(lines[1]) &&
    /^STRIPE_BILLING_EVENT_LEDGER_CUTOVER_UNINVENTORIED=\d+$/u.test(
      lines[2],
    )
  );
}

function successfulProbe(
  sql,
  environment,
  passfilePath,
  marker,
  outputValidator = (output) => output.includes(marker),
  probeName = "postflight",
) {
  const result = runPsql(sql, environment, passfilePath);
  const safeProbeName = /^[a-z0-9_]+$/u.test(probeName)
    ? probeName
    : "postflight";
  if (result.error || result.status !== 0) {
    console.error(
      `STAGING_DATABASE_ROLLOUT_STATE_PROBE_FAILURE=${safeProbeName}:${psqlFailureCategory(result)}`,
    );
    return false;
  }
  if (!outputValidator(String(result.stdout ?? ""))) {
    console.error(
      `STAGING_DATABASE_ROLLOUT_STATE_PROBE_FAILURE=${safeProbeName}:output_invalid`,
    );
    return false;
  }
  return true;
}

function requiredProbe(sql, environment, passfilePath, probeName) {
  const result = runPsql(sql, environment, passfilePath);
  if (result.error || result.status !== 0) {
    console.error(
      `STAGING_DATABASE_ROLLOUT_STATE_PROBE_FAILURE=${probeName}:${psqlFailureCategory(result)}`,
    );
    fail("database_probe_failed");
  }
  return result.stdout.trim();
}

function parseLedger(output) {
  const match =
    /STAGING_DATABASE_LEDGER=([01]):([01]):([01]):([01]):([01]):([01]):([01]):([01])/u.exec(
      output,
    );
  if (!match) fail("ledger_probe_invalid");
  return Object.freeze({
    aiTier: match[1] === "1",
    mobilePush: match[2] === "1",
    metaFoundation: match[3] === "1",
    metaHistory: match[4] === "1",
    metaContinuation: match[5] === "1",
    workspaceMemberPrerequisite: match[6] === "1",
    workspaceMemberInGenericLedger: match[7] === "1",
    whatsappCloudInboundInGenericLedger: match[8] === "1",
  });
}

function tableObjectState({
  stateSql,
  stateMarker,
  postflightSql,
  postflightMarker,
  postflightOutputValidator,
  environment,
  passfilePath,
}) {
  const state = requiredProbe(
    stateSql,
    environment,
    passfilePath,
    `${stateMarker.toLowerCase()}_state`,
  );
  const objectState = exactControlledObjectState(state, stateMarker);
  if (objectState === "absent") return "absent";
  if (objectState !== "present") return "invalid";
  return successfulProbe(
    postflightSql,
    environment,
    passfilePath,
    postflightMarker,
    postflightOutputValidator,
    `${stateMarker.toLowerCase()}_postflight`,
  )
    ? "current"
    : "invalid";
}

function metaObjectState(environment, passfilePath) {
  const state = requiredProbe(
    metaContentMigrationControl.STATE_SQL,
    environment,
    passfilePath,
    "meta_content_state",
  );
  if (state.includes("META_CONTENT_MIGRATION_STATE=absent")) return "absent";
  if (state.includes("META_CONTENT_MIGRATION_STATE=foundation")) {
    const foundationPostflightSql =
      metaContentMigrationControl.FOUNDATION_POSTFLIGHT_SQL;
    if (typeof foundationPostflightSql !== "string") return "invalid";
    return successfulProbe(
      foundationPostflightSql,
      environment,
      passfilePath,
      "META_CONTENT_FOUNDATION_POSTFLIGHT=PASS",
      undefined,
      "meta_content_foundation_postflight",
    )
      ? "foundation"
      : "invalid";
  }
  if (!state.includes("META_CONTENT_MIGRATION_STATE=installed")) {
    return "invalid";
  }
  return successfulProbe(
    metaContentMigrationControl.POSTFLIGHT_SQL,
    environment,
    passfilePath,
    "META_CONTENT_MIGRATION_POSTFLIGHT=PASS",
    undefined,
    "meta_content_postflight",
  )
    ? "current"
    : "invalid";
}

async function triggerObjectState(environment, passfilePath) {
  if (!existsSync(OPTIONAL_TRIGGER_RUNNER)) return "unavailable";
  const controlModule = await import(
    pathToFileURL(OPTIONAL_TRIGGER_RUNNER).href
  );
  if (typeof controlModule.POSTFLIGHT_SQL !== "string") return "invalid";
  const state = requiredProbe(
    TRIGGER_HARDENING_STATE_SQL,
    environment,
    passfilePath,
    "trigger_hardening_state",
  );
  if (state.includes("STAGING_DATABASE_TRIGGER_OBJECT=invalid")) {
    return "invalid";
  }
  if (!state.includes("STAGING_DATABASE_TRIGGER_OBJECT=pending")) {
    return "invalid";
  }
  return successfulProbe(
    controlModule.POSTFLIGHT_SQL,
    environment,
    passfilePath,
    "TRIGGER_FUNCTION_HARDENING_POSTFLIGHT=PASS",
    undefined,
    "trigger_hardening_postflight",
  )
    ? "current"
    : "pending";
}

async function inspectDatabase(environment) {
  const evaluation = evaluateStagingDatabaseRolloutStateEnvironment(environment);
  if (!evaluation.ok) fail("environment_invalid");
  ensurePsqlAvailable();

  const { snapshotDirectory, snapshotPath } =
    privatePassfileSnapshot(environment);
  try {
    const ledgerState = requiredProbe(
      LEDGER_STATE_SQL,
      environment,
      snapshotPath,
      "ledger_object",
    );
    const ledger = ledgerState.includes("STAGING_DATABASE_LEDGER_OBJECT=absent")
      ? Object.freeze({
          aiTier: false,
          mobilePush: false,
          metaFoundation: false,
          metaHistory: false,
          metaContinuation: false,
          workspaceMemberPrerequisite: false,
          workspaceMemberInGenericLedger: false,
          whatsappCloudInboundInGenericLedger: false,
        })
      : ledgerState.includes("STAGING_DATABASE_LEDGER_OBJECT=present")
        ? parseLedger(
            requiredProbe(
              ledgerSql(),
              environment,
              snapshotPath,
              "ledger_rows",
            ),
          )
        : fail("ledger_probe_invalid");
    const objects = Object.freeze({
      workspaceMemberBoundary: tableObjectState({
        stateSql: WORKSPACE_MEMBER_BOUNDARY_STATE_SQL,
        stateMarker: "STAGING_DATABASE_WORKSPACE_MEMBER_BOUNDARY_OBJECT",
        postflightSql: materializeWorkspaceMemberDataBoundaryPostflight(
          readFileSync(WORKSPACE_MEMBER_BOUNDARY_CONTROL_PATH, "utf8"),
        ),
        postflightMarker: "WORKSPACE_MEMBER_DATA_BOUNDARY_POSTFLIGHT=PASS",
        environment,
        passfilePath: snapshotPath,
      }),
      whatsappCloudInbound: tableObjectState({
        stateSql: WHATSAPP_CLOUD_INBOUND_STATE_SQL,
        stateMarker: "WHATSAPP_CLOUD_INBOUND_OBJECT_STATE",
        postflightSql: materializeWhatsAppCloudInboundPostflight(
          readFileSync(WHATSAPP_CLOUD_INBOUND_CONTROL_PATH, "utf8"),
        ),
        postflightMarker: "WHATSAPP_CLOUD_INBOUND_POSTFLIGHT=PASS",
        environment,
        passfilePath: snapshotPath,
      }),
      aiTier: tableObjectState({
        stateSql: AI_TIER_STATE_SQL,
        stateMarker: "STAGING_DATABASE_AI_TIER_OBJECT",
        postflightSql: AI_TIER_POSTFLIGHT_SQL,
        postflightMarker: "AI_TIER_ENTITLEMENT_MIGRATION_POSTFLIGHT=PASS",
        environment,
        passfilePath: snapshotPath,
      }),
      aiTierStripeLedger: tableObjectState({
        stateSql: AI_TIER_STRIPE_LEDGER_STATE_SQL,
        stateMarker: "STAGING_DATABASE_AI_TIER_STRIPE_LEDGER_OBJECT",
        postflightSql: AI_TIER_STRIPE_LEDGER_POSTFLIGHT_SQL,
        postflightMarker: "AI_TIER_STRIPE_EVENT_LEDGER_POSTFLIGHT=PASS",
        postflightOutputValidator: exactAiTierStripeLedgerPostflight,
        environment,
        passfilePath: snapshotPath,
      }),
      stripeBillingLedger: tableObjectState({
        stateSql: STRIPE_BILLING_LEDGER_STATE_SQL,
        stateMarker: "STAGING_DATABASE_STRIPE_BILLING_LEDGER_OBJECT",
        postflightSql: materializeStripeBillingEventLedgerPostflight(
          readFileSync(STRIPE_BILLING_LEDGER_CONTROL_PATH, "utf8"),
        ),
        postflightMarker: "STRIPE_BILLING_EVENT_LEDGER_POSTFLIGHT=PASS",
        postflightOutputValidator: exactStripeBillingLedgerPostflight,
        environment,
        passfilePath: snapshotPath,
      }),
      mobilePush: tableObjectState({
        stateSql: MOBILE_PUSH_STATE_SQL,
        stateMarker: "STAGING_DATABASE_MOBILE_PUSH_OBJECT",
        postflightSql: MOBILE_PUSH_POSTFLIGHT_SQL,
        postflightMarker:
          "MOBILE_PUSH_REGISTRATION_MIGRATION_POSTFLIGHT=PASS",
        environment,
        passfilePath: snapshotPath,
      }),
      metaContent: metaObjectState(environment, snapshotPath),
      metaCatchup: tableObjectState({
        stateSql: META_CATCHUP_STATE_SQL,
        stateMarker: "STAGING_DATABASE_META_CATCHUP_OBJECT",
        postflightSql: META_CATCHUP_POSTFLIGHT_SQL,
        postflightMarker: "META_CATCHUP_QUEUE_POSTFLIGHT=PASS",
        environment,
        passfilePath: snapshotPath,
      }),
      metaContinuation: tableObjectState({
        stateSql: META_CONTINUATION_STATE_SQL,
        stateMarker: "META_CONVERSATION_CONTINUATION_STATE",
        postflightSql: META_CONTINUATION_POSTFLIGHT_SQL,
        postflightMarker: "META_CONVERSATION_CONTINUATION_POSTFLIGHT=PASS",
        environment,
        passfilePath: snapshotPath,
      }),
      triggerHardening: await triggerObjectState(environment, snapshotPath),
    });
    return deriveStagingDatabaseRolloutActions({ ledger, objects });
  } finally {
    rmSync(snapshotDirectory, { recursive: true, force: true });
  }
}

async function main() {
  const mode = modeFromArguments(process.argv.slice(2));
  verifyOfflineControls();
  if (mode === "--check") {
    console.log("STAGING_DATABASE_ROLLOUT_STATE_MODE=check");
    console.log("STAGING_DATABASE_ROLLOUT_STATE_READY=YES");
    return;
  }

  const result = await inspectDatabase(process.env);
  console.log("STAGING_DATABASE_ROLLOUT_STATE_MODE=read_only");
  console.log(
    `STAGING_DATABASE_ROLLOUT_WORKSPACE_MEMBER_BOUNDARY=${result.actions.workspaceMemberBoundary}`,
  );
  console.log(
    `STAGING_DATABASE_ROLLOUT_WHATSAPP_CLOUD_INBOUND=${result.actions.whatsappCloudInbound}`,
  );
  console.log(`STAGING_DATABASE_ROLLOUT_AI_TIER=${result.actions.aiTier}`);
  console.log(
    `STAGING_DATABASE_ROLLOUT_AI_TIER_STRIPE_LEDGER=${result.actions.aiTierStripeLedger}`,
  );
  console.log(
    `STAGING_DATABASE_ROLLOUT_STRIPE_BILLING_LEDGER=${result.actions.stripeBillingLedger}`,
  );
  console.log(
    `STAGING_DATABASE_ROLLOUT_MOBILE_PUSH=${result.actions.mobilePush}`,
  );
  console.log(
    `STAGING_DATABASE_ROLLOUT_META_CONTENT=${result.actions.metaContent}`,
  );
  console.log(
    `STAGING_DATABASE_ROLLOUT_META_CATCHUP=${result.actions.metaCatchup}`,
  );
  console.log(
    `STAGING_DATABASE_ROLLOUT_META_CONTINUATION=${result.actions.metaContinuation}`,
  );
  console.log(
    `STAGING_DATABASE_ROLLOUT_TRIGGER_HARDENING=${result.actions.triggerHardening}`,
  );
  console.log("STAGING_DATABASE_ROLLOUT_GENERIC_MIGRATION=disabled");
  console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
  console.log(
    `STAGING_DATABASE_ROLLOUT_STATE=${result.blocked ? "BLOCKED" : "PASS"}`,
  );
  if (result.blocked) process.exitCode = 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    if (
      error instanceof Error &&
      /^STAGING_DATABASE_ROLLOUT_STATE_ERROR=[a-z0-9_]+$/u.test(
        error.message,
      )
    ) {
      console.error(error.message);
    } else {
      console.error("STAGING_DATABASE_ROLLOUT_STATE_ERROR=unexpected_failure");
    }
    console.error("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
    process.exitCode = 1;
  });
}

export {
  AI_TIER_STRIPE_LEDGER_STATE_SQL,
  AI_TIER_STATE_SQL,
  LEDGER_STATE_SQL,
  META_CATCHUP_STATE_SQL,
  META_CONTINUATION_STATE_SQL,
  MOBILE_PUSH_STATE_SQL,
  STRIPE_BILLING_LEDGER_STATE_SQL,
  TRIGGER_HARDENING_STATE_SQL,
  WORKSPACE_MEMBER_BOUNDARY_STATE_SQL,
  WHATSAPP_CLOUD_INBOUND_STATE_SQL,
  exactAiTierStripeLedgerPostflight,
  exactControlledObjectState,
  exactStripeBillingLedgerPostflight,
  ledgerManagedMetaMigrations,
  ledgerSql,
  psqlFailureCategory,
};
