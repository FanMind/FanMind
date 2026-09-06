#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  closeSync,
  constants,
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

import { evaluateMetaContentStagingMigrationEnvironment } from "../../src/lib/metaContentStagingMigrationPolicy.mjs";

const MIGRATIONS = Object.freeze([
  Object.freeze({
    id: "20260803120000_meta_content_intelligence_foundation",
    path: "supabase/migrations/20260803120000_meta_content_intelligence_foundation.sql",
    stage: "foundation",
    sha256:
      "3936aeddf0c6b2ed2e3628c169eb52ed64264a3cf97c53c9c91a2063da7c55af",
  }),
  Object.freeze({
    id: "20260803210000_preserve_incremental_conversation_history",
    path: "supabase/migrations/20260803210000_preserve_incremental_conversation_history.sql",
    stage: "foundation",
    sha256:
      "79c81cdd204fc2fc45f4fa16ab381ce2278e16f13950914e125e22cfdca924f1",
  }),
  Object.freeze({
    id: "20260806160000_meta_webhook_external_id_idempotency",
    path: "supabase/controlled/20260806160000_meta_webhook_external_id_idempotency.sql",
    stage: "idempotency",
    sha256:
      "378f04578a70ff18891482a4f2d8b3df6ebde7fd7a28a3f0c103385d52dcf2f9",
  }),
]);
const MAX_PASSFILE_BYTES = 64 * 1024;

const STATE_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;

with foundation_markers(present) as (
  values
    (to_regclass('public.workspace_analysis_settings') is not null),
    (to_regclass('public.content_metric_snapshots') is not null),
    (to_regclass('public.communication_analysis_reports') is not null),
    (exists (
      select 1 from pg_attribute
       where attrelid = to_regclass('public.social_connections')
         and attname = 'oauth_login_type'
         and attnum > 0
         and not attisdropped
    )),
    (exists (
      select 1 from pg_attribute
       where attrelid = to_regclass('public.content_sources')
         and attname = 'social_connection_id'
         and attnum > 0
         and not attisdropped
    )),
    (exists (
      select 1 from pg_attribute
       where attrelid = to_regclass('public.fan_analysis_reports')
         and attname = 'review_status'
         and attnum > 0
         and not attisdropped
    )),
    (exists (
      select 1 from pg_attribute
       where attrelid = to_regclass('public.workspace_voice_profiles')
         and attname = 'source_scope'
         and attnum > 0
         and not attisdropped
    )),
    (exists (
      select 1 from pg_attribute
       where attrelid = to_regclass('public.workspace_analysis_settings')
         and attname = 'meta_sync_mode'
         and attnum > 0
         and not attisdropped
    ))
),
idempotency_markers(present) as (
  values
    (exists (
      select 1
        from pg_index as index_definition
        join pg_class as index_relation
          on index_relation.oid = index_definition.indexrelid
       where index_definition.indrelid =
         to_regclass('public.conversation_messages')
         and index_relation.relname =
           'conversation_messages_meta_external_message_unique_idx'
         and index_definition.indisunique
         and index_definition.indisvalid
         and index_definition.indisready
         and index_definition.indpred is not null
    )),
    (exists (
      select 1
        from pg_index as index_definition
        join pg_class as index_relation
          on index_relation.oid = index_definition.indexrelid
       where index_definition.indrelid =
         to_regclass('public.conversation_messages')
         and index_relation.relname =
           'conversation_messages_meta_external_comment_unique_idx'
         and index_definition.indisunique
         and index_definition.indisvalid
         and index_definition.indisready
         and index_definition.indpred is not null
    ))
),
state as (
  select
    (select bool_and(present) from foundation_markers) as foundation_all,
    (select bool_or(present) from foundation_markers) as foundation_any,
    (select bool_and(present) from idempotency_markers) as idempotency_all,
    (select bool_or(present) from idempotency_markers) as idempotency_any
)
select 'META_CONTENT_MIGRATION_STATE=' ||
  case
    when foundation_all and idempotency_all then 'installed'
    when foundation_all and not idempotency_any then 'foundation'
    when not foundation_any and not idempotency_any then 'absent'
    else 'partial'
  end
from state;

rollback;
`;

const FOUNDATION_POSTFLIGHT_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;

do $verify$
declare
  managed_table text;
  managed_table_oid oid;
begin
  foreach managed_table in array array[
    'social_connections',
    'workspace_analysis_settings',
    'content_sources',
    'content_metric_snapshots',
    'communication_analysis_reports',
    'fan_analysis_reports',
    'contact_ai_profiles',
    'workspace_voice_profiles'
  ]
  loop
    managed_table_oid := to_regclass(format('public.%I', managed_table));
    if managed_table_oid is null then
      raise exception 'table_missing';
    end if;

    if not exists (
      select 1
        from pg_class
       where oid = managed_table_oid
         and relkind = 'r'
         and relrowsecurity
    ) then
      raise exception 'rls_boundary_invalid';
    end if;

    if exists (
      select 1
        from pg_policies
       where schemaname = 'public'
         and tablename = managed_table
         and cmd <> 'SELECT'
         -- Restrictive policies only reduce access; the later member-boundary
         -- control installs owner guards without granting browser writes.
         -- Permissive INSERT/UPDATE/DELETE/ALL policies remain forbidden.
         and permissive <> 'RESTRICTIVE'
    ) then
      raise exception 'browser_write_policy_invalid';
    end if;

    if not exists (
      select 1
        from pg_policies
       where schemaname = 'public'
         and tablename = managed_table
         and cmd = 'SELECT'
    ) then
      raise exception 'browser_select_policy_missing';
    end if;

    if exists (
      select 1
        from information_schema.table_privileges
       where table_schema = 'public'
         and table_name = managed_table
         and grantee in ('anon', 'authenticated')
         and privilege_type <> 'SELECT'
    ) or exists (
      select 1
        from information_schema.column_privileges
       where table_schema = 'public'
         and table_name = managed_table
         and grantee in ('anon', 'authenticated')
         and privilege_type <> 'SELECT'
    ) then
      raise exception 'browser_write_privilege_invalid';
    end if;

    if exists (
      select 1
        from information_schema.table_privileges
       where table_schema = 'public'
         and table_name = managed_table
         and grantee = 'anon'
    ) or exists (
      select 1
        from information_schema.column_privileges
       where table_schema = 'public'
         and table_name = managed_table
         and grantee = 'anon'
    ) then
      raise exception 'anonymous_privilege_invalid';
    end if;
  end loop;

  if has_column_privilege(
       'authenticated',
       'public.social_connections',
       'page_access_token_encrypted',
       'SELECT'
     ) then
    raise exception 'token_column_privilege_invalid';
  end if;

  if not has_table_privilege(
       'service_role', 'public.workspace_analysis_settings', 'SELECT'
     )
     or not has_table_privilege(
       'service_role', 'public.workspace_analysis_settings', 'INSERT'
     )
     or not has_table_privilege(
       'service_role', 'public.workspace_analysis_settings', 'UPDATE'
     )
     or not has_table_privilege(
       'service_role', 'public.workspace_analysis_settings', 'DELETE'
     )
     or not has_table_privilege(
       'service_role', 'public.content_metric_snapshots', 'SELECT'
     )
     or not has_table_privilege(
       'service_role', 'public.content_metric_snapshots', 'INSERT'
     )
     or not has_table_privilege(
       'service_role', 'public.content_metric_snapshots', 'UPDATE'
     )
     or not has_table_privilege(
       'service_role', 'public.content_metric_snapshots', 'DELETE'
     )
     or not has_table_privilege(
       'service_role', 'public.communication_analysis_reports', 'SELECT'
     )
     or not has_table_privilege(
       'service_role', 'public.communication_analysis_reports', 'INSERT'
     )
     or not has_table_privilege(
       'service_role', 'public.communication_analysis_reports', 'UPDATE'
     )
     or not has_table_privilege(
       'service_role', 'public.communication_analysis_reports', 'DELETE'
     ) then
    raise exception 'service_role_privilege_invalid';
  end if;

  if not exists (
    select 1
      from pg_index as index_definition
      join pg_class as index_relation
        on index_relation.oid = index_definition.indexrelid
     where index_definition.indrelid =
       to_regclass('public.social_connections')
       and index_relation.relname =
         'social_connections_active_external_account_unique_idx'
       and index_definition.indisunique
       and index_definition.indisvalid
       and index_definition.indisready
       and index_definition.indpred is not null
  )
     or not exists (
       select 1
         from pg_index as index_definition
         join pg_class as index_relation
           on index_relation.oid = index_definition.indexrelid
        where index_definition.indrelid =
          to_regclass('public.conversation_messages')
          and index_relation.relname =
            'conversation_messages_workspace_contact_created_desc_idx'
          and index_definition.indisvalid
          and index_definition.indisready
     ) then
    raise exception 'index_contract_invalid';
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conrelid = to_regclass('public.workspace_analysis_settings')
       and conname = 'workspace_analysis_settings_meta_sync_mode_check'
       and convalidated
       and pg_get_constraintdef(oid) like '%incremental_cache%'
  )
     or not exists (
       select 1
         from pg_constraint
        where conrelid = to_regclass('public.workspace_analysis_settings')
          and conname =
            'workspace_analysis_settings_personal_content_retention_days_check'
          and convalidated
          and pg_get_constraintdef(oid) like '%personal_content_retention_days = 0%'
     )
     or not exists (
       select 1
         from pg_constraint
        where conrelid = to_regclass('public.communication_analysis_reports')
          and conname =
            'communication_analysis_reports_source_message_count_check'
          and convalidated
          and pg_get_constraintdef(oid) like '%150%'
     ) then
    raise exception 'constraint_contract_invalid';
  end if;

  if exists (
    select 1
      from pg_proc
     where oid = to_regprocedure(
       'public.trim_conversation_messages_to_latest_50()'
     )
  )
     or exists (
       select 1
         from pg_trigger
        where tgrelid = to_regclass('public.conversation_messages')
          and tgname = 'conversation_messages_trim_to_latest_50'
          and not tgisinternal
     ) then
    raise exception 'obsolete_retention_trigger_present';
  end if;

  if not exists (
    select 1
      from pg_proc
     where oid = to_regprocedure(
       'public.set_meta_content_intelligence_updated_at()'
     )
       and not prosecdef
       and proconfig @> array['search_path=public']
  )
     or not exists (
       select 1
         from pg_trigger
        where tgrelid = to_regclass('public.workspace_analysis_settings')
          and tgname = 'workspace_analysis_settings_set_updated_at'
          and tgenabled = 'O'
          and not tgisinternal
     )
     or not exists (
       select 1
         from pg_trigger
        where tgrelid =
          to_regclass('public.communication_analysis_reports')
          and tgname = 'communication_analysis_reports_set_updated_at'
          and tgenabled = 'O'
          and not tgisinternal
     ) then
    raise exception 'trigger_contract_invalid';
  end if;

  if coalesce(
       (
         select pg_get_expr(attribute.adbin, attribute.adrelid)
           from pg_attrdef as attribute
           join pg_attribute as column_definition
             on column_definition.attrelid = attribute.adrelid
            and column_definition.attnum = attribute.adnum
          where attribute.adrelid =
            to_regclass('public.social_connections')
            and column_definition.attname = 'analytics_enabled'
       ),
       ''
     ) not in ('false', 'false::boolean') then
    raise exception 'analysis_default_invalid';
  end if;
end
$verify$;

select 'META_CONTENT_FOUNDATION_POSTFLIGHT=PASS';
rollback;
`;

const IDEMPOTENCY_INDEX_POSTFLIGHT_SQL = String.raw`
  if not exists (
    select 1
      from pg_index as index_definition
      join pg_class as index_relation
        on index_relation.oid = index_definition.indexrelid
     where index_definition.indrelid =
       to_regclass('public.conversation_messages')
       and index_relation.relname =
         'conversation_messages_meta_external_message_unique_idx'
       and index_definition.indisunique
       and index_definition.indisvalid
       and index_definition.indisready
       and index_definition.indpred is not null
  )
     or not exists (
       select 1
         from pg_index as index_definition
         join pg_class as index_relation
           on index_relation.oid = index_definition.indexrelid
        where index_definition.indrelid =
          to_regclass('public.conversation_messages')
          and index_relation.relname =
            'conversation_messages_meta_external_comment_unique_idx'
          and index_definition.indisunique
          and index_definition.indisvalid
          and index_definition.indisready
          and index_definition.indpred is not null
     ) then
    raise exception 'meta_external_id_index_contract_invalid';
  end if;
`;

const POSTFLIGHT_SQL = FOUNDATION_POSTFLIGHT_SQL.replace(
  "end\n$verify$;",
  `${IDEMPOTENCY_INDEX_POSTFLIGHT_SQL}end\n$verify$;`,
).replace(
  "META_CONTENT_FOUNDATION_POSTFLIGHT=PASS",
  "META_CONTENT_MIGRATION_POSTFLIGHT=PASS",
);

function fail(code) {
  throw new Error(`META_CONTENT_MIGRATION_ERROR=${code}`);
}

function modeFromArguments(argumentsList) {
  const known = new Set(["--check", "--readiness", "--verify", "--apply"]);
  if (argumentsList.some((argument) => !known.has(argument))) {
    fail("argument_invalid");
  }
  const selected = argumentsList.filter((argument) => known.has(argument));
  if (selected.length > 1) fail("mode_ambiguous");
  return selected[0] ?? "--check";
}

export function evaluateMetaContentMigrationSql(id, sql) {
  const migration = MIGRATIONS.find((candidate) => candidate.id === id);
  if (!migration || typeof sql !== "string") fail("migration_unreadable");
  const digest = createHash("sha256").update(sql).digest("hex");
  if (digest !== migration.sha256) fail("migration_checksum_mismatch");

  const contractsById = {
    "20260803120000_meta_content_intelligence_foundation": [
      /social_connections_active_external_account_unique_idx/iu,
      /create table if not exists public\.workspace_analysis_settings/iu,
      /create table if not exists public\.content_metric_snapshots/iu,
      /create table if not exists public\.communication_analysis_reports/iu,
      /revoke all on table public\.social_connections from anon, authenticated/iu,
      /grant select \([\s\S]*\) on public\.social_connections to authenticated/iu,
      /source_scope text not null default 'confirmed_manual_outbound'/iu,
      /set_meta_content_intelligence_updated_at/iu,
    ],
    "20260803210000_preserve_incremental_conversation_history": [
      /meta_sync_mode text not null default 'incremental_cache'/iu,
      /personal_content_retention_days integer not null default 0/iu,
      /source_message_count between 0 and 150/iu,
      /drop trigger if exists conversation_messages_trim_to_latest_50/iu,
      /drop function if exists public\.trim_conversation_messages_to_latest_50\(\)/iu,
      /conversation_messages_workspace_contact_created_desc_idx/iu,
    ],
    "20260806160000_meta_webhook_external_id_idempotency": [
      /duplicate_meta_external_message_id/iu,
      /duplicate_meta_external_comment_id/iu,
      /conversation_messages_meta_external_message_unique_idx/iu,
      /conversation_messages_meta_external_comment_unique_idx/iu,
      /workspace_id,\s*source_platform,\s*external_message_id/iu,
      /workspace_id,\s*source_platform,\s*external_comment_id/iu,
      /where source_platform in \('facebook', 'instagram'\)/iu,
    ],
  };
  const forbidden = [
    /\bdrop\s+(?:table|schema|database)\b/iu,
    /\btruncate\b/iu,
    /\bcopy\b[^\n]*\bprogram\b/iu,
    /\b(?:http|net)\.(?:post|get)\b/iu,
  ];
  if (
    contractsById[id].some((contract) => !contract.test(sql)) ||
    forbidden.some((contract) => contract.test(sql))
  ) {
    fail("migration_contract_invalid");
  }
  return Object.freeze({ digest, migrationId: id });
}

function readAndVerifyMigrations() {
  return MIGRATIONS.map((migration) => {
    const migrationPath = resolve(process.cwd(), migration.path);
    let sql;
    try {
      sql = readFileSync(migrationPath, "utf8");
    } catch {
      fail("migration_unreadable");
    }
    evaluateMetaContentMigrationSql(migration.id, sql);
    console.log(`META_CONTENT_MIGRATION_ID=${migration.id}`);
    console.log("META_CONTENT_MIGRATION_CHECKSUM=verified");
    console.log("META_CONTENT_MIGRATION_CONTRACT=verified");
    return Object.freeze({ ...migration, sql });
  });
}

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

    snapshotDirectory = mkdtempSync(join(tmpdir(), "fanmind-meta-migration-"));
    const snapshotPath = join(snapshotDirectory, "pgpass");
    writeFileSync(snapshotPath, content, { mode: 0o600, flag: "wx" });
    return { snapshotDirectory, snapshotPath };
  } catch (error) {
    if (snapshotDirectory) {
      rmSync(snapshotDirectory, { recursive: true, force: true });
    }
    if (
      error instanceof Error &&
      error.message.startsWith("META_CONTENT_MIGRATION_ERROR=")
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

function runPsql(input, environment, passfilePath) {
  return spawnSync(
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
      env: psqlEnvironment(environment, passfilePath),
      input,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
}

function ensurePsqlAvailable() {
  const result = spawnSync("psql", ["--version"], {
    encoding: "utf8",
    stdio: ["ignore", "ignore", "ignore"],
  });
  if (result.error || result.status !== 0) fail("psql_unavailable");
  console.log("META_CONTENT_MIGRATION_PSQL=available");
}

function postflightPasses(
  environment,
  passfilePath,
  sql = POSTFLIGHT_SQL,
  marker = "META_CONTENT_MIGRATION_POSTFLIGHT=PASS",
) {
  const result = runPsql(sql, environment, passfilePath);
  return Boolean(
    !result.error &&
      result.status === 0 &&
      result.stdout.includes(marker),
  );
}

function foundationPostflightPasses(environment, passfilePath) {
  return postflightPasses(
    environment,
    passfilePath,
    FOUNDATION_POSTFLIGHT_SQL,
    "META_CONTENT_FOUNDATION_POSTFLIGHT=PASS",
  );
}

function migrationState(environment, passfilePath) {
  const result = runPsql(STATE_SQL, environment, passfilePath);
  if (result.error || result.status !== 0) fail("state_probe_failed");
  const match =
    /META_CONTENT_MIGRATION_STATE=(absent|foundation|installed|partial)/u.exec(
      result.stdout,
    );
  if (!match) fail("state_probe_invalid");
  return match[1];
}

function applySql(migrationSql) {
  return [
    "\\set ON_ERROR_STOP on",
    "begin;",
    ...migrationSql,
    "commit;",
    "",
  ].join("\n");
}

function runDatabaseMode(mode, migrations, environment) {
  const policyMode = mode === "--apply"
    ? "apply"
    : mode === "--readiness"
      ? "readiness"
      : "verify";
  const evaluation = evaluateMetaContentStagingMigrationEnvironment(
    environment,
    { mode: policyMode },
  );
  if (!evaluation.ok) fail("environment_invalid");

  ensurePsqlAvailable();
  const { snapshotDirectory, snapshotPath } =
    privatePassfileSnapshot(environment);
  try {
    if (mode === "--readiness") {
      const state = migrationState(environment, snapshotPath);
      if (state === "partial") fail("existing_schema_invalid");
      if (state === "installed") {
        if (!postflightPasses(environment, snapshotPath)) {
          fail("postflight_failed");
        }
        console.log("META_CONTENT_STAGING_SCHEMA=current");
        console.log("META_CONTENT_MIGRATION_POSTFLIGHT=PASS");
      } else if (state === "foundation") {
        if (!foundationPostflightPasses(environment, snapshotPath)) {
          fail("existing_schema_invalid");
        }
        console.log("META_CONTENT_STAGING_SCHEMA=upgrade_required");
        console.log("META_CONTENT_MIGRATION_POSTFLIGHT=upgrade_required");
      } else {
        console.log("META_CONTENT_STAGING_SCHEMA=absent");
        console.log("META_CONTENT_MIGRATION_POSTFLIGHT=not_applicable");
      }
      console.log("META_CONTENT_MIGRATION_APPLY=not_requested");
      console.log("META_CONTENT_STAGING_RESOURCES=PASS");
      console.log("META_CONTENT_ANALYSIS_ACTIVATION=disabled");
      console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
      return;
    }

    if (mode === "--apply") {
      if (postflightPasses(environment, snapshotPath)) {
        console.log("META_CONTENT_MIGRATION_APPLY=already_current");
      } else {
        const state = migrationState(environment, snapshotPath);
        if (state === "partial" || state === "installed") {
          fail("existing_schema_invalid");
        }
        if (
          state === "foundation" &&
          !foundationPostflightPasses(environment, snapshotPath)
        ) {
          fail("existing_schema_invalid");
        }
        const selectedMigrations = state === "foundation"
          ? migrations.filter((migration) => migration.stage === "idempotency")
          : migrations;
        const apply = runPsql(
          applySql(selectedMigrations.map((migration) => migration.sql)),
          environment,
          snapshotPath,
        );
        if (apply.error || apply.status !== 0) fail("apply_failed");
        console.log("META_CONTENT_MIGRATION_APPLY=completed");
      }
    } else {
      console.log("META_CONTENT_MIGRATION_APPLY=not_requested");
    }

    if (!postflightPasses(environment, snapshotPath)) {
      fail("postflight_failed");
    }
    console.log("META_CONTENT_MIGRATION_POSTFLIGHT=PASS");
    console.log("META_CONTENT_ANALYSIS_ACTIVATION=disabled");
    console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
  } finally {
    rmSync(snapshotDirectory, { recursive: true, force: true });
  }
}

async function main() {
  const mode = modeFromArguments(process.argv.slice(2));
  const migrations = readAndVerifyMigrations();
  if (mode === "--check") {
    console.log("META_CONTENT_MIGRATION_MODE=check");
    console.log("META_CONTENT_MIGRATION_READY=YES");
    return;
  }
  console.log(`META_CONTENT_MIGRATION_MODE=${mode.replace(/^--/u, "")}`);
  runDatabaseMode(mode, migrations, process.env);
  console.log("META_CONTENT_MIGRATION_READY=YES");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    if (
      error instanceof Error &&
      /^META_CONTENT_MIGRATION_ERROR=[a-z0-9_]+$/u.test(error.message)
    ) {
      console.error(error.message);
    } else {
      console.error("META_CONTENT_MIGRATION_ERROR=unexpected_failure");
    }
    console.error("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
    process.exitCode = 1;
  });
}

export {
  FOUNDATION_POSTFLIGHT_SQL,
  MIGRATIONS,
  POSTFLIGHT_SQL,
  STATE_SQL,
};
