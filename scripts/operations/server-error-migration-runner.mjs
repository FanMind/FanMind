#!/usr/bin/env node

import { createHash } from "node:crypto";
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
import { dirname, isAbsolute, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const VERSION = "fanmind-server-error-migration-2";
const MIGRATION_ID = "20260718203000_privacy_server_error_tracking";
const MIGRATION_FILE_NAME = `${MIGRATION_ID}.sql`;
const EXPECTED_MIGRATION_SHA256 =
  "de48786613b33bc7d592d018c365cff5ca1417f18176e47c964d9d6a796f3cef";
const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const INSTALLED_MIGRATION_PATH = join(SCRIPT_DIRECTORY, MIGRATION_FILE_NAME);
const SOURCE_MIGRATION_PATH = resolve(
  SCRIPT_DIRECTORY,
  "../../supabase/migrations",
  MIGRATION_FILE_NAME,
);
const APPLY_CONFIRMATION = "server-error-tracking-production-apply";
const VERIFY_CONFIRMATION = "server-error-tracking-production-verify";
const MAX_MIGRATION_BYTES = 96 * 1024;
const MAX_PASSFILE_BYTES = 64 * 1024;
const PSQL_BIN = "/usr/lib/postgresql/17/bin/psql";
const CURL_BIN = "/usr/bin/curl";

const ALLOWED_PUBLIC_OBJECTS = new Set([
  "admin_notifications",
  "cleanup_server_error_events",
  "record_server_error_event",
  "server_error_events",
  "server_error_groups",
]);

const BASE_PREFLIGHT_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;

do $verify$
declare
  notification_table oid := to_regclass('public.admin_notifications');
  events_table oid := to_regclass('public.server_error_events');
  groups_table oid := to_regclass('public.server_error_groups');
  anon_role oid := to_regrole('anon');
  authenticated_role oid := to_regrole('authenticated');
begin
  if notification_table is null then
    raise exception 'admin_notifications_missing';
  end if;
  if anon_role is null or authenticated_role is null or to_regrole('service_role') is null then
    raise exception 'required_role_missing';
  end if;
  if not exists (
    select 1 from pg_class
     where oid = notification_table and relkind = 'r' and relrowsecurity
  ) then
    raise exception 'admin_notifications_rls_invalid';
  end if;
  if exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'admin_notifications'
  ) then
    raise exception 'admin_notifications_policy_invalid';
  end if;
  if exists (
    select 1
      from pg_class as relation
      cross join lateral aclexplode(
        coalesce(relation.relacl, acldefault('r', relation.relowner))
      ) as privilege
     where relation.oid = notification_table
       and privilege.grantee in (0, anon_role, authenticated_role)
       and privilege.privilege_type in ('SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
  ) then
    raise exception 'admin_notifications_privilege_invalid';
  end if;
  if (events_table is null) <> (groups_table is null) then
    raise exception 'partial_schema_detected';
  end if;
end
$verify$;

select 'SERVER_ERROR_MIGRATION_BASE_PREFLIGHT=PASS';
rollback;
`;

const POSTFLIGHT_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;

do $verify$
declare
  events_table oid := to_regclass('public.server_error_events');
  groups_table oid := to_regclass('public.server_error_groups');
  notification_table oid := to_regclass('public.admin_notifications');
  record_function oid := to_regprocedure('public.record_server_error_event(text,text,text,text,text,text,text,text,integer,integer)');
  cleanup_function oid := to_regprocedure('public.cleanup_server_error_events(integer)');
  anon_role oid := to_regrole('anon');
  authenticated_role oid := to_regrole('authenticated');
  service_role oid := to_regrole('service_role');
  actual_event_columns text[];
  actual_group_columns text[];
  expected_event_columns text[] := array[
    'created_at','digest','environment','fingerprint','http_method','id',
    'release_commit','route_path','route_type','router_kind'
  ];
  expected_group_columns text[] := array[
    'digest','environment','fingerprint','first_seen_at','http_method',
    'last_notified_at','last_notified_severity','last_seen_at',
    'latest_release_commit','occurrence_count','resolved_at','route_path',
    'route_type','router_kind','status'
  ];
  record_definition text;
  cleanup_definition text;
begin
  if events_table is null or groups_table is null or notification_table is null then
    raise exception 'schema_missing';
  end if;
  if record_function is null or cleanup_function is null then
    raise exception 'function_missing';
  end if;
  if anon_role is null or authenticated_role is null or service_role is null then
    raise exception 'required_role_missing';
  end if;

  if (
    select count(*)
      from pg_class
     where oid in (events_table, groups_table, notification_table)
       and relkind = 'r'
       and relrowsecurity
  ) <> 3 then
    raise exception 'rls_boundary_invalid';
  end if;
  if exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename in ('server_error_events','server_error_groups','admin_notifications')
  ) then
    raise exception 'browser_policy_invalid';
  end if;
  if exists (
    select 1
      from pg_class as relation
      cross join lateral aclexplode(
        coalesce(relation.relacl, acldefault('r', relation.relowner))
      ) as privilege
     where relation.oid in (events_table, groups_table, notification_table)
       and privilege.grantee in (0, anon_role, authenticated_role)
       and privilege.privilege_type in ('SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
  ) then
    raise exception 'browser_privilege_invalid';
  end if;

  select array_agg(attribute.attname::text order by attribute.attname)
    into actual_event_columns
    from pg_attribute as attribute
   where attribute.attrelid = events_table
     and attribute.attnum > 0
     and not attribute.attisdropped;
  select array_agg(attribute.attname::text order by attribute.attname)
    into actual_group_columns
    from pg_attribute as attribute
   where attribute.attrelid = groups_table
     and attribute.attnum > 0
     and not attribute.attisdropped;
  if actual_event_columns is distinct from expected_event_columns then
    raise exception 'event_columns_invalid';
  end if;
  if actual_group_columns is distinct from expected_group_columns then
    raise exception 'group_columns_invalid';
  end if;

  if (
    select count(*)
      from pg_index as index_definition
      join pg_class as index_relation
        on index_relation.oid = index_definition.indexrelid
     where index_definition.indrelid in (events_table, groups_table)
       and index_relation.relname in (
         'server_error_events_fingerprint_created_idx',
         'server_error_events_created_idx',
         'server_error_groups_last_seen_idx',
         'server_error_groups_open_idx'
       )
       and index_definition.indisvalid
       and index_definition.indisready
  ) <> 4 then
    raise exception 'index_contract_invalid';
  end if;

  if exists (
    select 1
      from pg_proc as function_definition
      cross join lateral aclexplode(
        coalesce(function_definition.proacl, acldefault('f', function_definition.proowner))
      ) as privilege
     where function_definition.oid in (record_function, cleanup_function)
       and privilege.grantee in (0, anon_role, authenticated_role)
       and privilege.privilege_type = 'EXECUTE'
  ) then
    raise exception 'browser_function_privilege_invalid';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.record_server_error_event(text,text,text,text,text,text,text,text,integer,integer)',
    'EXECUTE'
  ) or not has_function_privilege(
    'service_role',
    'public.cleanup_server_error_events(integer)',
    'EXECUTE'
  ) then
    raise exception 'service_function_privilege_invalid';
  end if;
  if exists (
    select 1 from pg_proc
     where oid in (record_function, cleanup_function)
       and (
         not prosecdef
         or not coalesce(proconfig, array[]::text[]) @> array['search_path=public']
       )
  ) then
    raise exception 'function_security_invalid';
  end if;

  select lower(pg_get_functiondef(record_function)) into record_definition;
  select lower(pg_get_functiondef(cleanup_function)) into cleanup_definition;
  if record_definition not like '%insert into public.server_error_events%'
     or record_definition not like '%insert into public.server_error_groups%'
     or record_definition not like '%server_error_tracking%'
     or record_definition like '%error_message%'
     or record_definition like '%stack_trace%'
     or cleanup_definition not like '%delete from public.server_error_events%'
  then
    raise exception 'function_contract_invalid';
  end if;
end
$verify$;

select 'SERVER_ERROR_MIGRATION_POSTFLIGHT=PASS';
rollback;
`;

const FIXED_CONFLICT_PREFLIGHT_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;

do $verify$
declare
  record_function oid := to_regprocedure('public.record_server_error_event(text,text,text,text,text,text,text,text,integer,integer)');
  record_definition text;
begin
  if record_function is null then
    raise exception 'function_missing';
  end if;
  select regexp_replace(lower(pg_get_functiondef(record_function)), '\s+', ' ', 'g')
    into record_definition;
  if position('on conflict on constraint server_error_groups_pkey do update set' in record_definition) = 0
     or position('on conflict (fingerprint) do update set' in record_definition) > 0
  then
    raise exception 'conflict_contract_invalid';
  end if;
end
$verify$;

select 'SERVER_ERROR_MIGRATION_CONFLICT_FIX=PASS';
rollback;
`;

const LEGACY_CONFLICT_PREFLIGHT_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;

do $verify$
declare
  record_function oid := to_regprocedure('public.record_server_error_event(text,text,text,text,text,text,text,text,integer,integer)');
  record_definition text;
begin
  if record_function is null then
    raise exception 'function_missing';
  end if;
  select regexp_replace(lower(pg_get_functiondef(record_function)), '\s+', ' ', 'g')
    into record_definition;
  if position('on conflict (fingerprint) do update set' in record_definition) = 0
     or position('on conflict on constraint server_error_groups_pkey do update set' in record_definition) > 0
  then
    raise exception 'legacy_conflict_contract_invalid';
  end if;
end
$verify$;

select 'SERVER_ERROR_MIGRATION_LEGACY_CONFLICT=PASS';
rollback;
`;

function fail(code) {
  throw new Error(`SERVER_ERROR_MIGRATION_ERROR=${code}`);
}

function emit(level, event, fields = {}) {
  process.stdout.write(`${JSON.stringify({
    ts: new Date().toISOString(),
    version: VERSION,
    level,
    event,
    ...fields,
  })}\n`);
}

function modeFromArguments(argumentsList) {
  const [mode = "--check", confirmation, extra] = argumentsList;
  if (extra !== undefined || !["--check", "--verify", "--apply"].includes(mode)) {
    fail("argument_invalid");
  }
  if (mode === "--verify" && confirmation !== VERIFY_CONFIRMATION) {
    fail("verify_confirmation_invalid");
  }
  if (mode === "--apply" && confirmation !== APPLY_CONFIRMATION) {
    fail("apply_confirmation_invalid");
  }
  if (mode === "--check" && confirmation !== undefined) {
    fail("check_confirmation_invalid");
  }
  return mode;
}

function migrationPath() {
  if (existsSync(INSTALLED_MIGRATION_PATH)) return INSTALLED_MIGRATION_PATH;
  return SOURCE_MIGRATION_PATH;
}

function readAndVerifyMigration(mode) {
  const path = migrationPath();
  let descriptor;
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = fstatSync(descriptor);
    if (!stat.isFile() || stat.size < 1 || stat.size > MAX_MIGRATION_BYTES) {
      fail("migration_file_invalid");
    }
    if (
      mode !== "--check" &&
      (path !== INSTALLED_MIGRATION_PATH || stat.uid !== 0 || (stat.mode & 0o777) !== 0o600)
    ) {
      fail("installed_migration_permissions_invalid");
    }
    const sql = readFileSync(descriptor, "utf8");
    const digest = createHash("sha256").update(sql).digest("hex");
    if (digest !== EXPECTED_MIGRATION_SHA256) fail("migration_checksum_mismatch");

    const requiredContracts = [
      /^begin;/imu,
      /set local lock_timeout = '5s'/iu,
      /set local statement_timeout = '60s'/iu,
      /create table if not exists public\.server_error_events/iu,
      /create table if not exists public\.server_error_groups/iu,
      /alter table public\.server_error_events enable row level security/iu,
      /alter table public\.server_error_groups enable row level security/iu,
      /create or replace function public\.record_server_error_event/iu,
      /create or replace function public\.cleanup_server_error_events/iu,
      /revoke all on function public\.record_server_error_event[\s\S]*from public, anon, authenticated/iu,
      /grant execute on function public\.record_server_error_event[\s\S]*to service_role/iu,
      /revoke all on function public\.cleanup_server_error_events[\s\S]*from public, anon, authenticated/iu,
      /grant execute on function public\.cleanup_server_error_events[\s\S]*to service_role/iu,
      /commit;\s*$/iu,
    ];
    const publicObjects = new Set(
      [...sql.matchAll(/\bpublic\.([a-z_][a-z0-9_]*)/giu)].map((match) => match[1].toLowerCase()),
    );
    if (
      requiredContracts.some((contract) => !contract.test(sql)) ||
      [...publicObjects].some((objectName) => !ALLOWED_PUBLIC_OBJECTS.has(objectName)) ||
      /\b(?:drop\s+(?:table|schema|database)|truncate\s+table)\b/iu.test(sql) ||
      /\bgrant\b[\s\S]{0,240}\bto\s+(?:public|anon|authenticated)\b/iu.test(sql) ||
      /(?:error_message|stack_trace|request_headers|request_body|query_string|cookie|ip_address)/iu.test(sql)
    ) {
      fail("migration_contract_invalid");
    }
    return sql;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("SERVER_ERROR_MIGRATION_ERROR=")) {
      throw error;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "ELOOP") {
      fail("migration_file_invalid");
    }
    fail("migration_unreadable");
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
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
    if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash) return "";
    return /^([a-z0-9]{8,64})\.supabase\.co$/u.exec(url.hostname.toLowerCase())?.[1] ?? "";
  } catch {
    return "";
  }
}

function productionTarget() {
  if (process.env.FANMIND_RUNTIME_ENVIRONMENT !== "production") {
    fail("runtime_environment_invalid");
  }
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
    if (process.env[key]) fail("connection_redirect_invalid");
  }

  const projectReference = projectReferenceFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const host = normalizedHost(process.env.FANMIND_BACKUP_DB_HOST);
  const port = process.env.FANMIND_BACKUP_DB_PORT?.trim() || "5432";
  const database = process.env.FANMIND_BACKUP_DB_NAME?.trim() ?? "";
  const user = process.env.FANMIND_BACKUP_DB_USER?.trim().toLowerCase() ?? "";
  const passfile = process.env.FANMIND_BACKUP_PGPASSFILE?.trim() ?? "";
  if (!projectReference || !host) fail("project_binding_missing");
  if (!/^[0-9]{1,5}$/u.test(port) || Number(port) < 1 || Number(port) > 65535) {
    fail("database_port_invalid");
  }
  if (!/^[A-Za-z0-9_.-]{1,128}$/u.test(database) || !/^[a-z0-9_.-]{1,160}$/u.test(user)) {
    fail("database_identity_invalid");
  }
  const directHostBound = host === `db.${projectReference}.supabase.co`;
  const poolerUserBound = user === `postgres.${projectReference}`;
  if (!directHostBound && !poolerUserBound) fail("database_project_binding_invalid");
  if (!isAbsolute(passfile) || !passfile.startsWith("/etc/fanmind-backup/")) {
    fail("passfile_path_invalid");
  }
  return { host, port, database, user, passfile };
}

function verifyReleaseBinding() {
  const expectedCommit = process.env.FANMIND_RELEASE_COMMIT?.trim() ?? "";
  if (!/^[0-9a-f]{40}$/u.test(expectedCommit)) fail("release_commit_invalid");
  const response = spawnSync(
    CURL_BIN,
    ["-fsSL", "--max-time", "15", "--max-filesize", "16384", "https://fanmind.ch/api/version"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 20000 },
  );
  if (response.error || response.status !== 0) fail("live_version_unavailable");
  let liveCommit;
  try {
    liveCommit = JSON.parse(response.stdout)?.releaseCommit;
  } catch {
    fail("live_version_invalid");
  }
  if (liveCommit !== expectedCommit) fail("release_commit_mismatch");
}

function privatePassfileSnapshot(sourcePath) {
  let descriptor;
  let snapshotDirectory;
  let content;
  try {
    descriptor = openSync(sourcePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const opened = fstatSync(descriptor);
    if (
      !opened.isFile() ||
      opened.uid !== 0 ||
      (opened.mode & 0o777) !== 0o600 ||
      opened.size < 1 ||
      opened.size > MAX_PASSFILE_BYTES
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
    snapshotDirectory = mkdtempSync(join(tmpdir(), "fanmind-server-error-migration-"));
    const snapshotPath = join(snapshotDirectory, "pgpass");
    writeFileSync(snapshotPath, content, { mode: 0o600, flag: "wx" });
    return { snapshotDirectory, snapshotPath };
  } catch (error) {
    if (snapshotDirectory) rmSync(snapshotDirectory, { recursive: true, force: true });
    if (error instanceof Error && error.message.startsWith("SERVER_ERROR_MIGRATION_ERROR=")) {
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

function psqlEnvironment(target, passfilePath) {
  return {
    HOME: "/tmp",
    LANG: "C",
    LC_ALL: "C",
    PATH: "/usr/bin:/bin",
    PGAPPNAME: "fanmind_server_error_migration",
    PGCONNECT_TIMEOUT: "10",
    PGDATABASE: target.database,
    PGHOST: target.host,
    PGPASSFILE: passfilePath,
    PGPORT: target.port,
    PGSSLMODE: "require",
    PGUSER: target.user,
  };
}

function runPsql(input, target, passfilePath) {
  return spawnSync(
    PSQL_BIN,
    [
      "--no-password",
      "--no-psqlrc",
      "--set=ON_ERROR_STOP=1",
      "--host",
      target.host,
      "--port",
      target.port,
      "--username",
      target.user,
      "--dbname",
      target.database,
    ],
    {
      env: psqlEnvironment(target, passfilePath),
      input,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 120000,
      maxBuffer: 1024 * 1024,
    },
  );
}

function psqlPassed(result, marker) {
  return !result.error && result.status === 0 && result.stdout.includes(marker);
}

function ensurePsqlAvailable() {
  const result = spawnSync(PSQL_BIN, ["--version"], {
    encoding: "utf8",
    stdio: ["ignore", "ignore", "ignore"],
    timeout: 10000,
  });
  if (result.error || result.status !== 0) fail("psql_unavailable");
}

export function serverErrorMigrationApplyPlan({
  schemaReady,
  fixedConflictReady,
  legacyConflictReady,
  schemaAbsent,
}) {
  if (schemaReady && fixedConflictReady) return "already_applied";
  if (schemaReady && !fixedConflictReady && legacyConflictReady) return "repair";
  if (!schemaReady && schemaAbsent) return "apply";
  return "reject";
}

function runDatabaseMode(mode, migrationSql) {
  if (typeof process.getuid !== "function" || process.getuid() !== 0) fail("root_required");
  verifyReleaseBinding();
  const target = productionTarget();
  ensurePsqlAvailable();
  const { snapshotDirectory, snapshotPath } = privatePassfileSnapshot(target.passfile);
  try {
    const basePreflight = runPsql(BASE_PREFLIGHT_SQL, target, snapshotPath);
    if (!psqlPassed(basePreflight, "SERVER_ERROR_MIGRATION_BASE_PREFLIGHT=PASS")) {
      fail("base_preflight_failed");
    }

    const currentPostflight = runPsql(POSTFLIGHT_SQL, target, snapshotPath);
    const schemaReady = psqlPassed(
      currentPostflight,
      "SERVER_ERROR_MIGRATION_POSTFLIGHT=PASS",
    );
    const fixedConflict = schemaReady
      ? runPsql(FIXED_CONFLICT_PREFLIGHT_SQL, target, snapshotPath)
      : null;
    const fixedConflictReady = Boolean(
      fixedConflict && psqlPassed(fixedConflict, "SERVER_ERROR_MIGRATION_CONFLICT_FIX=PASS"),
    );
    if (mode === "--verify") {
      if (!schemaReady || !fixedConflictReady) {
        fail("schema_not_ready");
      }
      return "verified";
    }

    const legacyConflict = schemaReady && !fixedConflictReady
      ? runPsql(LEGACY_CONFLICT_PREFLIGHT_SQL, target, snapshotPath)
      : null;
    const legacyConflictReady = Boolean(
      legacyConflict && psqlPassed(
        legacyConflict,
        "SERVER_ERROR_MIGRATION_LEGACY_CONFLICT=PASS",
      ),
    );
    const existenceProbe = !schemaReady
      ? runPsql(
        String.raw`\set ON_ERROR_STOP on
begin;
set transaction read only;
select case
  when to_regclass('public.server_error_events') is null
   and to_regclass('public.server_error_groups') is null
  then 'SERVER_ERROR_MIGRATION_SCHEMA=ABSENT'
  else 'SERVER_ERROR_MIGRATION_SCHEMA=PRESENT'
end;
rollback;`,
        target,
        snapshotPath,
      )
      : null;
    const schemaAbsent = Boolean(
      existenceProbe && psqlPassed(existenceProbe, "SERVER_ERROR_MIGRATION_SCHEMA=ABSENT"),
    );
    const applyPlan = serverErrorMigrationApplyPlan({
      schemaReady,
      fixedConflictReady,
      legacyConflictReady,
      schemaAbsent,
    });
    if (applyPlan === "already_applied") return applyPlan;
    if (applyPlan === "reject") {
      fail("existing_schema_invalid");
    }

    const apply = runPsql(migrationSql, target, snapshotPath);
    if (apply.error || apply.status !== 0) fail("apply_failed");
    const postflight = runPsql(POSTFLIGHT_SQL, target, snapshotPath);
    const conflictPostflight = runPsql(FIXED_CONFLICT_PREFLIGHT_SQL, target, snapshotPath);
    if (
      !psqlPassed(postflight, "SERVER_ERROR_MIGRATION_POSTFLIGHT=PASS") ||
      !psqlPassed(conflictPostflight, "SERVER_ERROR_MIGRATION_CONFLICT_FIX=PASS")
    ) {
      fail("postflight_failed");
    }
    return applyPlan === "repair" ? "repaired" : "applied";
  } finally {
    rmSync(snapshotDirectory, { recursive: true, force: true });
  }
}

export function verifyServerErrorMigrationSource(mode = "--check") {
  return readAndVerifyMigration(mode);
}

export function serverErrorMigrationMode(argumentsList) {
  return modeFromArguments(argumentsList);
}

async function main() {
  let action = "check";
  try {
    const mode = modeFromArguments(process.argv.slice(2));
    action = mode.slice(2);
    const migrationSql = readAndVerifyMigration(mode);
    if (mode === "--check") {
      emit("info", "migration_status", { action, status: "ready" });
      return;
    }
    const status = runDatabaseMode(mode, migrationSql);
    emit("info", "migration_status", { action, status });
  } catch (error) {
    const message =
      error instanceof Error && /^SERVER_ERROR_MIGRATION_ERROR=[a-z0-9_]+$/u.test(error.message)
        ? error.message
        : "SERVER_ERROR_MIGRATION_ERROR=unexpected_failure";
    emit("error", "migration_failed", {
      action,
      error_code: message.slice("SERVER_ERROR_MIGRATION_ERROR=".length),
    });
    process.exitCode = 1;
  }
}

const direct = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (direct) await main();
