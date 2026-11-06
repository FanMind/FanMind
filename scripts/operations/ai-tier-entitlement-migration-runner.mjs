#!/usr/bin/env node

import { createHash } from "node:crypto";
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
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const MIGRATION_ID = "20260727090000_workspace_ai_tier_entitlements";
const MIGRATION_PATH = resolve(
  process.cwd(),
  `supabase/migrations/${MIGRATION_ID}.sql`,
);
const EXPECTED_MIGRATION_SHA256 =
  "4cd8dce37b9c96cdaf218c3426bdc477c7db6bd2d7df0385ac7e415c509cc7e2";
const APPLY_CONFIRMATION = "apply-workspace-ai-tier-entitlements";
const NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT =
  "I_UNDERSTAND_NON_PRODUCTION_ONLY";
const MAX_PASSFILE_BYTES = 64 * 1024;

const POSTFLIGHT_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;

do $verify$
declare
  entitlements_table oid :=
    to_regclass('public.workspace_ai_tier_entitlements');
  entitlement_column record;
  ledger_object_count integer;
  ledger_function_count integer;
  ledger_state text;
begin
  if entitlements_table is null then
    raise exception 'table_missing';
  end if;

  if not exists (
    select 1
      from pg_class
     where oid = entitlements_table
       and relkind = 'r'
       and relrowsecurity
       and relforcerowsecurity
  ) then
    raise exception 'rls_boundary_invalid';
  end if;

  if exists (
    select 1
      from pg_policies
     where schemaname = 'public'
       and tablename = 'workspace_ai_tier_entitlements'
  ) then
    raise exception 'browser_policy_invalid';
  end if;

  if has_table_privilege(
       'anon',
       entitlements_table,
       'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
     )
     or has_table_privilege(
       'authenticated',
       entitlements_table,
       'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
     ) then
    raise exception 'browser_table_privilege_invalid';
  end if;

  select
    (case when exists (
      select 1 from pg_attribute
       where attrelid = entitlements_table
         and attname = 'stripe_sync_state'
         and attnum > 0 and not attisdropped
    ) then 1 else 0 end) +
    (case when exists (
      select 1 from pg_attribute
       where attrelid = entitlements_table
         and attname = 'stripe_sync_revision'
         and attnum > 0 and not attisdropped
    ) then 1 else 0 end) +
    (case when to_regclass(
      'public.workspace_ai_tier_stripe_events'
    ) is not null then 1 else 0 end) +
    (case when to_regclass(
      'public.workspace_ai_tier_stripe_reconciliations'
    ) is not null then 1 else 0 end) +
    (case when to_regprocedure(
      'public.apply_workspace_ai_tier_stripe_event(uuid,boolean,text,bigint,text,text,text,text,boolean,text,text,text,text,timestamp with time zone,timestamp with time zone)'
    ) is not null then 1 else 0 end) +
    (case when to_regprocedure(
      'public.reconcile_workspace_ai_tier_stripe_subscription(uuid,text,text,text,text,timestamp with time zone,text,bigint,boolean,text,text,text,text,timestamp with time zone,timestamp with time zone)'
    ) is not null then 1 else 0 end)
    into ledger_object_count;
  select count(*)::integer
    into ledger_function_count
    from pg_proc as definition
    join pg_namespace as namespace on namespace.oid = definition.pronamespace
   where namespace.nspname = 'public'
     and definition.proname in (
       'apply_workspace_ai_tier_stripe_event',
       'reconcile_workspace_ai_tier_stripe_subscription'
     );
  if ledger_object_count = 0 and ledger_function_count = 0 then
    ledger_state := 'pre_ledger';
  elsif ledger_object_count = 6 and ledger_function_count = 2 then
    ledger_state := 'post_ledger';
  else
    raise exception 'ledger_state_partial';
  end if;

  if ledger_state = 'post_ledger' and (
    not exists (
      select 1
        from pg_attribute as attribute
        join pg_attrdef as default_value
          on default_value.adrelid = attribute.attrelid
         and default_value.adnum = attribute.attnum
       where attribute.attrelid = entitlements_table
         and attribute.attname = 'stripe_sync_state'
         and format_type(attribute.atttypid, attribute.atttypmod) = 'text'
         and attribute.attnotnull
         and pg_get_expr(default_value.adbin, default_value.adrelid) =
             '''reconciliation_needed''::text'
    ) or not exists (
      select 1
        from pg_attribute as attribute
        join pg_attrdef as default_value
          on default_value.adrelid = attribute.attrelid
         and default_value.adnum = attribute.attnum
       where attribute.attrelid = entitlements_table
         and attribute.attname = 'stripe_sync_revision'
         and format_type(attribute.atttypid, attribute.atttypmod) = 'bigint'
         and attribute.attnotnull
         and pg_get_expr(default_value.adbin, default_value.adrelid) = '0'
    )
  ) then
    raise exception 'ledger_projection_columns_invalid';
  end if;

  for entitlement_column in
    select attribute.attname::text as column_name
      from pg_attribute as attribute
     where attribute.attrelid = entitlements_table
       and attribute.attnum > 0
       and not attribute.attisdropped
  loop
    if has_column_privilege(
         'anon',
         entitlements_table,
         entitlement_column.column_name,
         'SELECT,INSERT,UPDATE,REFERENCES'
       )
       or has_column_privilege(
         'authenticated',
         entitlements_table,
         entitlement_column.column_name,
         'SELECT,INSERT,UPDATE,REFERENCES'
       )
       or (
         ledger_state = 'post_ledger'
         and has_column_privilege(
           'service_role',
           entitlements_table,
           entitlement_column.column_name,
           'INSERT,UPDATE,REFERENCES'
         )
       ) then
      raise exception 'runtime_column_privilege_invalid';
    end if;
  end loop;

  if not has_table_privilege('service_role', entitlements_table, 'SELECT')
     or has_table_privilege('service_role', entitlements_table, 'TRUNCATE')
     or has_table_privilege('service_role', entitlements_table, 'REFERENCES')
     or has_table_privilege('service_role', entitlements_table, 'TRIGGER')
     or (
       ledger_state = 'pre_ledger'
       and (
         not has_table_privilege('service_role', entitlements_table, 'INSERT')
         or not has_table_privilege('service_role', entitlements_table, 'UPDATE')
         or not has_table_privilege('service_role', entitlements_table, 'DELETE')
       )
     )
     or (
       ledger_state = 'post_ledger'
       and has_table_privilege(
         'service_role', entitlements_table, 'INSERT,UPDATE,DELETE'
       )
     ) then
    raise exception 'service_role_privilege_invalid';
  end if;

  if (
    select count(*)
      from pg_constraint
     where conrelid = entitlements_table
       and conname in (
         'workspace_ai_tier_entitlements_tier_check',
         'workspace_ai_tier_entitlements_status_check',
         'workspace_ai_tier_entitlements_source_check',
         'workspace_ai_tier_entitlements_subscription_check',
         'workspace_ai_tier_entitlements_item_check',
         'workspace_ai_tier_entitlements_price_check',
         'workspace_ai_tier_entitlements_event_check',
         'workspace_ai_tier_entitlements_event_created_check',
         'workspace_ai_tier_entitlements_period_check',
         'workspace_ai_tier_entitlements_item_unique',
         'workspace_ai_tier_entitlements_sync_state_check',
         'workspace_ai_tier_entitlements_sync_revision_check'
       )
       and convalidated
  ) <> (case when ledger_state = 'post_ledger' then 12 else 10 end) then
    raise exception 'constraints_invalid';
  end if;

  if (
    select count(*)
      from pg_index as index_definition
      join pg_class as index_relation
        on index_relation.oid = index_definition.indexrelid
     where index_definition.indrelid = entitlements_table
       and index_definition.indisvalid
       and index_definition.indisready
       and index_relation.relname in (
         'workspace_ai_tier_entitlements_subscription_idx',
         'workspace_ai_tier_entitlements_lifecycle_idx'
       )
  ) <> 2 then
    raise exception 'indexes_invalid';
  end if;

  if not exists (
    select 1
      from pg_trigger
     where tgrelid = entitlements_table
       and tgname = 'workspace_ai_tier_entitlements_touch'
       and tgenabled = 'O'
       and not tgisinternal
  ) then
    raise exception 'updated_at_trigger_invalid';
  end if;

  if not exists (
    select 1
      from pg_proc
     where oid = to_regprocedure(
       'public.touch_workspace_ai_tier_entitlement()'
     )
       and not prosecdef
       and proconfig @> array['search_path=pg_catalog, public, pg_temp']
  ) then
    raise exception 'updated_at_function_invalid';
  end if;

  if has_function_privilege(
       'anon',
       'public.touch_workspace_ai_tier_entitlement()',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.touch_workspace_ai_tier_entitlement()',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.touch_workspace_ai_tier_entitlement()',
       'EXECUTE'
     ) then
    raise exception 'updated_at_function_privilege_invalid';
  end if;
end
$verify$;

select 'AI_TIER_ENTITLEMENT_MIGRATION_POSTFLIGHT=PASS';
rollback;
`;

function fail(code) {
  throw new Error(`AI_TIER_ENTITLEMENT_MIGRATION_ERROR=${code}`);
}

function modeFromArguments(argumentsList) {
  const known = new Set(["--check", "--verify", "--apply"]);
  if (argumentsList.some((argument) => !known.has(argument))) {
    fail("argument_invalid");
  }
  const selected = argumentsList.filter((argument) => known.has(argument));
  if (selected.length > 1) fail("mode_ambiguous");
  return selected[0] ?? "--check";
}

function readAndVerifyMigration() {
  let sql;
  try {
    sql = readFileSync(MIGRATION_PATH, "utf8");
  } catch {
    fail("migration_unreadable");
  }

  const digest = createHash("sha256").update(sql).digest("hex");
  if (digest !== EXPECTED_MIGRATION_SHA256) {
    fail("migration_checksum_mismatch");
  }

  const requiredContracts = [
    /^begin;/iu,
    /create table public\.workspace_ai_tier_entitlements/iu,
    /workspace_id uuid primary key\s+references public\.workspaces\(id\) on delete cascade/iu,
    /tier_id in \('plus', 'ultra'\)/iu,
    /status in \('active', 'pending', 'paused', 'canceled', 'expired'\)/iu,
    /source = 'stripe'/iu,
    /unique \(stripe_subscription_item_id\)/iu,
    /alter table public\.workspace_ai_tier_entitlements enable row level security/iu,
    /alter table public\.workspace_ai_tier_entitlements force row level security/iu,
    /revoke all on table public\.workspace_ai_tier_entitlements\s+from public, anon, authenticated/iu,
    /revoke select \(%1\$s\), insert \(%1\$s\), update \(%1\$s\), references \(%1\$s\)[\s\S]*from public, anon, authenticated/iu,
    /grant select, insert, update, delete\s+on table public\.workspace_ai_tier_entitlements\s+to service_role/iu,
    /language plpgsql\s+security invoker/iu,
    /revoke all\s+on function public\.touch_workspace_ai_tier_entitlement\(\)\s+from public, anon, authenticated/iu,
    /grant execute\s+on function public\.touch_workspace_ai_tier_entitlement\(\)\s+to service_role/iu,
    /create trigger workspace_ai_tier_entitlements_touch/iu,
    /workspace_ai_tier_entitlement_policy_boundary_failed/iu,
    /commit;\s*$/iu,
  ];
  if (
    requiredContracts.some((contract) => !contract.test(sql)) ||
    /create\s+policy/iu.test(sql) ||
    /\bdrop\s+(?:table|schema|database)\b/iu.test(sql)
  ) {
    fail("migration_contract_invalid");
  }

  console.log(`AI_TIER_ENTITLEMENT_MIGRATION_ID=${MIGRATION_ID}`);
  console.log("AI_TIER_ENTITLEMENT_MIGRATION_CHECKSUM=verified");
  console.log("AI_TIER_ENTITLEMENT_MIGRATION_CONTRACT=verified");
  return sql;
}

function normalizedReference(value) {
  const candidate = value?.trim().toLowerCase() ?? "";
  return /^[a-z0-9]{8,64}$/u.test(candidate) ? candidate : "";
}

function normalizedHost(value) {
  const candidate = value?.trim().toLowerCase().replace(/\.$/u, "") ?? "";
  return /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/u.test(candidate)
    ? candidate
    : "";
}

function projectReferenceFromUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return "";
    const match = /^([a-z0-9]{8,64})\.supabase\.co$/u.exec(
      url.hostname.toLowerCase(),
    );
    return match?.[1] ?? "";
  } catch {
    return "";
  }
}

function requireDatabaseTarget() {
  const runtime = process.env.FANMIND_RUNTIME_ENVIRONMENT?.trim().toLowerCase();
  if (!["production", "staging"].includes(runtime)) {
    fail("runtime_environment_invalid");
  }

  const targetReference = normalizedReference(
    process.env.FANMIND_TARGET_SUPABASE_PROJECT_REF,
  );
  const productionReference = normalizedReference(
    process.env.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF,
  );
  const urlReference = projectReferenceFromUrl(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  if (!targetReference || !productionReference || !urlReference) {
    fail("supabase_reference_missing");
  }
  if (targetReference !== urlReference) {
    fail("supabase_url_binding_invalid");
  }
  if (
    (runtime === "production" && targetReference !== productionReference) ||
    (runtime === "staging" && targetReference === productionReference)
  ) {
    fail("environment_target_binding_invalid");
  }

  const pgHost = normalizedHost(process.env.PGHOST);
  const expectedHost = normalizedHost(process.env.FANMIND_TARGET_DB_HOST);
  if (!pgHost || !expectedHost || pgHost !== expectedHost) {
    fail("database_host_binding_invalid");
  }
  if (
    process.env.PGHOSTADDR ||
    process.env.PGSERVICE ||
    process.env.PGSERVICEFILE ||
    process.env.PGSYSCONFDIR
  ) {
    fail("libpq_redirect_invalid");
  }

  const pgPort = process.env.PGPORT?.trim() ?? "";
  const pgDatabase = process.env.PGDATABASE?.trim() ?? "";
  const pgUser = process.env.PGUSER?.trim() ?? "";
  if (
    !/^[0-9]{1,5}$/u.test(pgPort) ||
    Number(pgPort) < 1 ||
    Number(pgPort) > 65535 ||
    !/^[A-Za-z0-9_.-]{1,128}$/u.test(pgDatabase) ||
    !/^[A-Za-z0-9_.-]{1,128}$/u.test(pgUser)
  ) {
    fail("database_identity_invalid");
  }

  console.log(`AI_TIER_ENTITLEMENT_MIGRATION_TARGET=${runtime}`);
  console.log("AI_TIER_ENTITLEMENT_MIGRATION_PROJECT_BINDING=verified");
  console.log("AI_TIER_ENTITLEMENT_MIGRATION_DATABASE_BINDING=verified");
  return runtime;
}

function privatePassfileSnapshot() {
  const sourcePath = process.env.PGPASSFILE?.trim();
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
      join(tmpdir(), "fanmind-ai-tier-migration-"),
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
      error.message.startsWith("AI_TIER_ENTITLEMENT_MIGRATION_ERROR=")
    ) {
      throw error;
    }
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ELOOP"
    ) {
      fail("passfile_invalid");
    }
    fail("passfile_read_failed");
  } finally {
    content?.fill(0);
    if (sourceDescriptor !== undefined) closeSync(sourceDescriptor);
  }
}

function psqlEnvironment(passfilePath) {
  const environment = { ...process.env, PGPASSFILE: passfilePath };
  for (const key of [
    "DATABASE_URL",
    "POSTGRES_URL",
    "SUPABASE_DB_URL",
    "PGHOSTADDR",
    "PGSERVICE",
    "PGSERVICEFILE",
    "PGSYSCONFDIR",
  ]) {
    delete environment[key];
  }
  environment.PGCONNECT_TIMEOUT = "10";
  return environment;
}

function runPsql(input, passfilePath) {
  return spawnSync(
    "psql",
    ["--no-password", "--no-psqlrc", "--set=ON_ERROR_STOP=1"],
    {
      env: psqlEnvironment(passfilePath),
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
  console.log("AI_TIER_ENTITLEMENT_MIGRATION_PSQL=available");
}

function runDatabaseMode(mode, migrationSql) {
  const runtime = requireDatabaseTarget();
  if (
    mode === "--apply" &&
    process.env.FANMIND_AI_TIER_ENTITLEMENT_MIGRATION_CONFIRM !==
      APPLY_CONFIRMATION
  ) {
    fail("apply_confirmation_invalid");
  }
  if (
    mode === "--apply" &&
    runtime === "staging" &&
    (process.env.FANMIND_ENABLE_NON_PRODUCTION_WRITES !== "true" ||
      process.env.FANMIND_NON_PRODUCTION_WRITE_ACK !==
        NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT)
  ) {
    fail("staging_write_acknowledgement_invalid");
  }
  if (
    mode === "--apply" &&
    runtime === "production" &&
    (process.env.FANMIND_PRODUCTION_CHANGE_TICKET?.trim().length ?? 0) < 3
  ) {
    fail("production_change_ticket_missing");
  }

  ensurePsqlAvailable();
  const { snapshotDirectory, snapshotPath } = privatePassfileSnapshot();
  try {
    if (mode === "--apply") {
      const apply = runPsql(migrationSql, snapshotPath);
      if (apply.error || apply.status !== 0) fail("apply_failed");
      console.log("AI_TIER_ENTITLEMENT_MIGRATION_APPLY=completed");
    } else {
      console.log("AI_TIER_ENTITLEMENT_MIGRATION_APPLY=not_requested");
    }

    const verification = runPsql(POSTFLIGHT_SQL, snapshotPath);
    if (
      verification.error ||
      verification.status !== 0 ||
      !verification.stdout.includes(
        "AI_TIER_ENTITLEMENT_MIGRATION_POSTFLIGHT=PASS",
      )
    ) {
      fail("postflight_failed");
    }
    console.log("AI_TIER_ENTITLEMENT_MIGRATION_POSTFLIGHT=PASS");
  } finally {
    rmSync(snapshotDirectory, { recursive: true, force: true });
  }
}

function main() {
  try {
    const mode = modeFromArguments(process.argv.slice(2));
    const migrationSql = readAndVerifyMigration();
    if (mode === "--check") {
      console.log("AI_TIER_ENTITLEMENT_MIGRATION_MODE=check");
      console.log("AI_TIER_ENTITLEMENT_MIGRATION_READY=YES");
    } else {
      console.log(
        `AI_TIER_ENTITLEMENT_MIGRATION_MODE=${
          mode === "--apply" ? "apply" : "verify"
        }`,
      );
      runDatabaseMode(mode, migrationSql);
      console.log("AI_TIER_ENTITLEMENT_MIGRATION_READY=YES");
    }
  } catch (error) {
    if (
      error instanceof Error &&
      /^AI_TIER_ENTITLEMENT_MIGRATION_ERROR=[a-z0-9_]+$/u.test(error.message)
    ) {
      console.error(error.message);
    } else {
      console.error("AI_TIER_ENTITLEMENT_MIGRATION_ERROR=unexpected_failure");
    }
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main();
}

export {
  EXPECTED_MIGRATION_SHA256,
  MIGRATION_ID,
  POSTFLIGHT_SQL,
};
