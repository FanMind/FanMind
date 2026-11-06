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

import { evaluateMetaCatchupQueueStagingEnvironment } from "../../src/lib/metaCatchupQueueStagingPolicy.mjs";

const MIGRATION_ID = "20260811230000_meta_conversation_catchup_queue";
const MIGRATION_PATH = resolve(process.cwd(), `supabase/controlled/${MIGRATION_ID}.sql`);
const EXPECTED_MIGRATION_SHA256 =
  "05b86ce53cb27a1516125fddad00fcf1614ac524a04de1b8c56adee264ba1c4a";
const MAX_PASSFILE_BYTES = 64 * 1024;

const POSTFLIGHT_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;

do $verify$
declare
  queue_table regclass := to_regclass('public.meta_conversation_catchup_jobs');
  function_oid oid;
  function_signature text;
begin
  if queue_table is null then
    raise exception 'queue_table_missing';
  end if;
  if not exists (
    select 1
      from pg_class
     where oid = queue_table
       and relrowsecurity
       and relforcerowsecurity
  ) then
    raise exception 'queue_rls_invalid';
  end if;

  if has_table_privilege('anon', queue_table, 'SELECT')
     or has_table_privilege('anon', queue_table, 'INSERT')
     or has_table_privilege('authenticated', queue_table, 'SELECT')
     or has_table_privilege('authenticated', queue_table, 'INSERT')
     or not has_table_privilege('service_role', queue_table, 'SELECT')
     or has_table_privilege('service_role', queue_table, 'INSERT')
     or has_table_privilege('service_role', queue_table, 'UPDATE')
     or has_table_privilege('service_role', queue_table, 'DELETE')
     or has_table_privilege('service_role', queue_table, 'TRUNCATE') then
    raise exception 'queue_privilege_invalid';
  end if;

  if not exists (
    select 1
      from pg_indexes
     where schemaname = 'public'
       and indexname = 'meta_conversation_catchup_active_thread_unique_idx'
       and indexdef ilike '%unique index%'
       and indexdef ilike '%where%status%pending%claimed%retry%'
  ) then
    raise exception 'queue_coalescing_index_invalid';
  end if;
  if not exists (
    select 1
      from pg_constraint as constraint_definition
     where constraint_definition.conrelid = queue_table
       and constraint_definition.conname =
         'meta_conversation_catchup_connection_workspace_fk'
       and constraint_definition.contype = 'f'
       and constraint_definition.confrelid =
         'public.social_connections'::regclass
       and constraint_definition.conkey = array[
         (select attnum from pg_attribute
           where attrelid = queue_table
             and attname = 'social_connection_id'
             and not attisdropped),
         (select attnum from pg_attribute
           where attrelid = queue_table
             and attname = 'workspace_id'
             and not attisdropped)
       ]::smallint[]
       and constraint_definition.confkey = array[
         (select attnum from pg_attribute
           where attrelid = 'public.social_connections'::regclass
             and attname = 'id'
             and not attisdropped),
         (select attnum from pg_attribute
           where attrelid = 'public.social_connections'::regclass
             and attname = 'workspace_id'
             and not attisdropped)
       ]::smallint[]
       and constraint_definition.confdeltype = 'c'
  ) or not exists (
    select 1
      from pg_constraint as constraint_definition
     where constraint_definition.conrelid = queue_table
       and constraint_definition.conname =
         'meta_conversation_catchup_contact_workspace_fk'
       and constraint_definition.contype = 'f'
       and constraint_definition.confrelid = 'public.contacts'::regclass
       and constraint_definition.conkey = array[
         (select attnum from pg_attribute
           where attrelid = queue_table
             and attname = 'contact_id'
             and not attisdropped),
         (select attnum from pg_attribute
           where attrelid = queue_table
             and attname = 'workspace_id'
             and not attisdropped)
       ]::smallint[]
       and constraint_definition.confkey = array[
         (select attnum from pg_attribute
           where attrelid = 'public.contacts'::regclass
             and attname = 'id'
             and not attisdropped),
         (select attnum from pg_attribute
           where attrelid = 'public.contacts'::regclass
             and attname = 'workspace_id'
             and not attisdropped)
       ]::smallint[]
       and constraint_definition.confdeltype = 'a'
  ) then
    raise exception 'queue_workspace_scope_invalid';
  end if;

  foreach function_signature in array array[
    'public.enqueue_meta_conversation_catchup(uuid,uuid,text,text,uuid)',
    'public.claim_meta_conversation_catchup_job(text,integer)',
    'public.finish_meta_conversation_catchup_job(uuid,text,uuid,text,text,integer)'
  ]
  loop
    function_oid := to_regprocedure(function_signature);
    if function_oid is null then
      raise exception 'queue_function_missing';
    end if;
    if not exists (
      select 1
        from pg_proc
       where oid = function_oid
         and prosecdef
         and proconfig @> array['search_path=pg_catalog, public, pg_temp']
    ) then
      raise exception 'queue_function_contract_invalid';
    end if;
    if has_function_privilege('anon', function_oid, 'EXECUTE')
       or has_function_privilege('authenticated', function_oid, 'EXECUTE')
       or not has_function_privilege('service_role', function_oid, 'EXECUTE')
       or exists (
         select 1
           from pg_proc as definition
           cross join lateral aclexplode(
             coalesce(definition.proacl, acldefault('f', definition.proowner))
           ) as acl
          where definition.oid = function_oid
            and acl.grantee = 0
            and acl.privilege_type = 'EXECUTE'
       ) then
      raise exception 'queue_function_privilege_invalid';
    end if;
  end loop;
end
$verify$;

select 'META_CATCHUP_QUEUE_POSTFLIGHT=PASS';
rollback;
`;

function fail(code) {
  throw new Error(`META_CATCHUP_QUEUE_ERROR=${code}`);
}

function modeFromArguments(argumentsList) {
  const known = new Set(["--check", "--verify", "--apply"]);
  if (argumentsList.some((argument) => !known.has(argument))) fail("argument_invalid");
  const selected = argumentsList.filter((argument) => known.has(argument));
  if (selected.length > 1) fail("mode_ambiguous");
  return selected[0] ?? "--check";
}

export function evaluateMetaCatchupQueueMigrationSql(sql) {
  if (typeof sql !== "string") fail("migration_unreadable");
  const digest = createHash("sha256").update(sql).digest("hex");
  if (digest !== EXPECTED_MIGRATION_SHA256) fail("migration_checksum_mismatch");

  const required = [
    /^begin;/imu,
    /create table public\.meta_conversation_catchup_jobs/iu,
    /force row level security/iu,
    /create unique index meta_conversation_catchup_active_thread_unique_idx[\s\S]*where status in \('pending', 'claimed', 'retry'\)/iu,
    /create function public\.enqueue_meta_conversation_catchup[\s\S]*on conflict[\s\S]*generation = job\.generation \+ 1/iu,
    /create function public\.claim_meta_conversation_catchup_job[\s\S]*for update skip locked/iu,
    /create function public\.finish_meta_conversation_catchup_job[\s\S]*dead_letter/iu,
    /auth\.role\(\) is distinct from 'service_role'/iu,
    /revoke all on table public\.meta_conversation_catchup_jobs[\s\S]*from public, anon, authenticated, service_role/iu,
    /grant select on table public\.meta_conversation_catchup_jobs to service_role/iu,
    /grant execute on function public\.enqueue_meta_conversation_catchup[\s\S]*to service_role/iu,
    /commit;\s*$/iu,
  ];
  const forbidden = [
    /grant (?:select|insert|update|delete|all)[\s\S]*to (?:anon|authenticated)/iu,
    /drop (?:table|schema|database)/iu,
    /truncate/iu,
  ];
  if (
    required.some((contract) => !contract.test(sql)) ||
    forbidden.some((contract) => contract.test(sql))
  ) {
    fail("migration_contract_invalid");
  }
  return Object.freeze({ digest, migrationId: MIGRATION_ID });
}

function readAndVerifyMigration() {
  let sql;
  try {
    sql = readFileSync(MIGRATION_PATH, "utf8");
  } catch {
    fail("migration_unreadable");
  }
  const result = evaluateMetaCatchupQueueMigrationSql(sql);
  console.log(`META_CATCHUP_QUEUE_MIGRATION_ID=${result.migrationId}`);
  console.log("META_CATCHUP_QUEUE_CHECKSUM=verified");
  console.log("META_CATCHUP_QUEUE_CONTRACT=verified");
  return sql;
}

function privatePassfileSnapshot(environment) {
  const sourcePath = clean(environment.PGPASSFILE);
  if (!sourcePath || !isAbsolute(sourcePath)) fail("passfile_missing");

  let descriptor;
  let snapshotDirectory;
  let content;
  try {
    descriptor = openSync(sourcePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const opened = fstatSync(descriptor);
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
      const bytesRead = readSync(descriptor, content, offset, content.length - offset, offset);
      if (bytesRead === 0) fail("passfile_read_failed");
      offset += bytesRead;
    }
    const settled = fstatSync(descriptor);
    if (
      settled.dev !== opened.dev ||
      settled.ino !== opened.ino ||
      settled.size !== opened.size ||
      settled.mtimeMs !== opened.mtimeMs ||
      settled.ctimeMs !== opened.ctimeMs
    ) {
      fail("passfile_changed");
    }
    snapshotDirectory = mkdtempSync(join(tmpdir(), "fanmind-meta-catchup-"));
    const snapshotPath = join(snapshotDirectory, "pgpass");
    writeFileSync(snapshotPath, content, { mode: 0o600, flag: "wx" });
    return { snapshotDirectory, snapshotPath };
  } catch (error) {
    if (snapshotDirectory) rmSync(snapshotDirectory, { recursive: true, force: true });
    if (error instanceof Error && error.message.startsWith("META_CATCHUP_QUEUE_ERROR=")) {
      throw error;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "ELOOP") {
      fail("passfile_invalid");
    }
    fail("passfile_read_failed");
  } finally {
    content?.fill(0);
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function psqlEnvironment(environment, passfilePath) {
  const safe = { ...environment, PGPASSFILE: passfilePath, PGCONNECT_TIMEOUT: "10" };
  for (const key of [
    "DATABASE_URL",
    "POSTGRES_URL",
    "SUPABASE_DB_URL",
    "PGPASSWORD",
    "PGHOSTADDR",
    "PGSERVICE",
    "PGSERVICEFILE",
    "PGSYSCONFDIR",
  ]) {
    delete safe[key];
  }
  return safe;
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
  console.log("META_CATCHUP_QUEUE_PSQL=available");
}

function runDatabaseMode(mode, migrationSql, environment) {
  const policyMode = mode === "--apply" ? "apply" : "verify";
  const evaluation = evaluateMetaCatchupQueueStagingEnvironment(environment, {
    mode: policyMode,
  });
  if (!evaluation.ok) fail("environment_invalid");
  ensurePsqlAvailable();
  const { snapshotDirectory, snapshotPath } = privatePassfileSnapshot(environment);
  try {
    if (mode === "--apply") {
      const apply = runPsql(migrationSql, environment, snapshotPath);
      if (apply.error || apply.status !== 0) fail("apply_failed");
      console.log("META_CATCHUP_QUEUE_APPLY=completed");
    } else {
      console.log("META_CATCHUP_QUEUE_APPLY=not_requested");
    }
    const postflight = runPsql(POSTFLIGHT_SQL, environment, snapshotPath);
    if (
      postflight.error ||
      postflight.status !== 0 ||
      !postflight.stdout.includes("META_CATCHUP_QUEUE_POSTFLIGHT=PASS")
    ) {
      fail("postflight_failed");
    }
    console.log("META_CATCHUP_QUEUE_POSTFLIGHT=PASS");
    console.log("META_CATCHUP_QUEUE_POSTFLIGHT_TRANSACTION=ROLLED_BACK");
    console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
  } finally {
    rmSync(snapshotDirectory, { recursive: true, force: true });
  }
}

async function main() {
  const mode = modeFromArguments(process.argv.slice(2));
  const migrationSql = readAndVerifyMigration();
  if (mode === "--check") {
    console.log("META_CATCHUP_QUEUE_MODE=check");
    console.log("META_CATCHUP_QUEUE_READY=YES");
    return;
  }
  console.log(`META_CATCHUP_QUEUE_MODE=${mode === "--apply" ? "apply" : "verify"}`);
  runDatabaseMode(mode, migrationSql, process.env);
  console.log("META_CATCHUP_QUEUE_READY=YES");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    if (
      error instanceof Error &&
      /^META_CATCHUP_QUEUE_ERROR=[a-z0-9_]+$/u.test(error.message)
    ) {
      console.error(error.message);
    } else {
      console.error("META_CATCHUP_QUEUE_ERROR=unexpected_failure");
    }
    console.error("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
    process.exitCode = 1;
  });
}

export { EXPECTED_MIGRATION_SHA256, MIGRATION_ID, POSTFLIGHT_SQL };
