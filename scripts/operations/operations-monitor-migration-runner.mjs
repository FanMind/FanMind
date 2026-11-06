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

const VERSION = "fanmind-operations-monitor-migration-1";
const MIGRATION_ID = "20260718190000_operations_monitor_components";
const MIGRATION_FILE_NAME = `${MIGRATION_ID}.sql`;
const EXPECTED_MIGRATION_SHA256 =
  "7470587f067152bbf40679572bd7f34e0e7fef281e71ca771da151abad402a06";
const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const INSTALLED_MIGRATION_PATH = join(SCRIPT_DIRECTORY, MIGRATION_FILE_NAME);
const SOURCE_MIGRATION_PATH = resolve(
  SCRIPT_DIRECTORY,
  "../../supabase/migrations",
  MIGRATION_FILE_NAME,
);
const APPLY_CONFIRMATION = "operations-monitor-components-production-apply";
const VERIFY_CONFIRMATION = "operations-monitor-components-production-verify";
const MAX_MIGRATION_BYTES = 64 * 1024;
const MAX_PASSFILE_BYTES = 64 * 1024;
const PSQL_BIN = "/usr/lib/postgresql/17/bin/psql";
const CURL_BIN = "/usr/bin/curl";

const EXPECTED_COMPONENTS = [
  "application",
  "backup",
  "backup_freshness",
  "backup_offsite",
  "backup_retention",
  "backup_worker",
  "deployment",
  "email_config",
  "host_disk",
  "host_memory",
  "nginx",
  "openai_config",
  "operations_monitor",
  "pm2",
  "ssl_certificate",
  "stripe_config",
  "supabase_config",
  "supabase_database",
  "supabase_storage",
];

const BASE_PREFLIGHT_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;

do $verify$
declare
  health_table oid := to_regclass('public.system_health_events');
  notification_table oid := to_regclass('public.admin_notifications');
begin
  if health_table is null or notification_table is null then
    raise exception 'base_table_missing';
  end if;

  if (
    select count(*)
      from pg_class
     where oid in (health_table, notification_table)
       and relkind = 'r'
       and relrowsecurity
  ) <> 2 then
    raise exception 'rls_boundary_invalid';
  end if;

  if exists (
    select 1
      from pg_policies
     where schemaname = 'public'
       and tablename in ('system_health_events', 'admin_notifications')
  ) then
    raise exception 'browser_policy_invalid';
  end if;

  if has_table_privilege('anon', health_table, 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', health_table, 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('anon', notification_table, 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', notification_table, 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'browser_privilege_invalid';
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conrelid = health_table
       and conname = 'system_health_events_component_check'
       and contype = 'c'
       and convalidated
  ) then
    raise exception 'base_constraint_invalid';
  end if;

  if exists (
    select 1
      from pg_class
     where relname = 'system_health_events_component_created_idx'
       and relkind = 'i'
  ) and not exists (
    select 1
      from pg_index as index_definition
      join pg_class as index_relation
        on index_relation.oid = index_definition.indexrelid
     where index_definition.indrelid = health_table
       and index_relation.relname = 'system_health_events_component_created_idx'
       and index_definition.indisvalid
       and index_definition.indisready
       and lower(pg_get_indexdef(index_definition.indexrelid)) like
         '%(component, created_at desc)%'
  ) then
    raise exception 'existing_health_index_invalid';
  end if;

  if exists (
    select 1
      from pg_class
     where relname = 'admin_notifications_active_monitor_idx'
       and relkind = 'i'
  ) and not exists (
    select 1
      from pg_index as index_definition
      join pg_class as index_relation
        on index_relation.oid = index_definition.indexrelid
     where index_definition.indrelid = notification_table
       and index_relation.relname = 'admin_notifications_active_monitor_idx'
       and index_definition.indisvalid
       and index_definition.indisready
       and lower(pg_get_indexdef(index_definition.indexrelid)) like
         '%(source, technical_reference, created_at desc)%'
       and lower(pg_get_indexdef(index_definition.indexrelid)) like
         '%operations_monitor%'
       and lower(pg_get_indexdef(index_definition.indexrelid)) like '%status%'
       and lower(pg_get_indexdef(index_definition.indexrelid)) like '%open%'
       and lower(pg_get_indexdef(index_definition.indexrelid)) like '%read%'
       and lower(pg_get_indexdef(index_definition.indexrelid)) like '%acknowledged%'
  ) then
    raise exception 'existing_notification_index_invalid';
  end if;

  if exists (
    select 1
      from public.system_health_events
     where component not in (
       'application',
       'supabase_config',
       'supabase_database',
       'supabase_storage',
       'stripe_config',
       'openai_config',
       'email_config',
       'backup',
       'backup_worker',
       'backup_offsite',
       'backup_retention',
       'backup_freshness',
       'operations_monitor',
       'deployment',
       'nginx',
       'pm2',
       'host_disk',
       'host_memory',
       'ssl_certificate'
     )
  ) then
    raise exception 'existing_component_invalid';
  end if;
end
$verify$;

select 'OPERATIONS_MONITOR_MIGRATION_BASE_PREFLIGHT=PASS';
rollback;
`;

const POSTFLIGHT_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;

do $verify$
declare
  health_table oid := to_regclass('public.system_health_events');
  notification_table oid := to_regclass('public.admin_notifications');
  actual_components text[];
  expected_components text[] := array[
    'application',
    'backup',
    'backup_freshness',
    'backup_offsite',
    'backup_retention',
    'backup_worker',
    'deployment',
    'email_config',
    'host_disk',
    'host_memory',
    'nginx',
    'openai_config',
    'operations_monitor',
    'pm2',
    'ssl_certificate',
    'stripe_config',
    'supabase_config',
    'supabase_database',
    'supabase_storage'
  ];
begin
  if health_table is null or notification_table is null then
    raise exception 'base_table_missing';
  end if;

  select array_agg(component_name order by component_name)
    into actual_components
    from (
      select distinct matches[1] as component_name
        from pg_constraint as constraint_definition
        cross join lateral regexp_matches(
          pg_get_constraintdef(constraint_definition.oid),
          '''([^'']+)''',
          'g'
        ) as matches
       where constraint_definition.conrelid = health_table
         and constraint_definition.conname = 'system_health_events_component_check'
         and constraint_definition.contype = 'c'
         and constraint_definition.convalidated
    ) as component_values;

  if actual_components is distinct from expected_components then
    raise exception 'component_constraint_invalid';
  end if;

  if not exists (
    select 1
      from pg_index as index_definition
      join pg_class as index_relation
        on index_relation.oid = index_definition.indexrelid
     where index_definition.indrelid = health_table
       and index_relation.relname = 'system_health_events_component_created_idx'
       and index_definition.indisvalid
       and index_definition.indisready
       and lower(pg_get_indexdef(index_definition.indexrelid)) like
         '%(component, created_at desc)%'
  ) then
    raise exception 'health_index_invalid';
  end if;

  if not exists (
    select 1
      from pg_index as index_definition
      join pg_class as index_relation
        on index_relation.oid = index_definition.indexrelid
     where index_definition.indrelid = notification_table
       and index_relation.relname = 'admin_notifications_active_monitor_idx'
       and index_definition.indisvalid
       and index_definition.indisready
       and lower(pg_get_indexdef(index_definition.indexrelid)) like
         '%(source, technical_reference, created_at desc)%'
       and lower(pg_get_indexdef(index_definition.indexrelid)) like
         '%operations_monitor%'
       and lower(pg_get_indexdef(index_definition.indexrelid)) like '%status%'
       and lower(pg_get_indexdef(index_definition.indexrelid)) like '%open%'
       and lower(pg_get_indexdef(index_definition.indexrelid)) like '%read%'
       and lower(pg_get_indexdef(index_definition.indexrelid)) like
         '%acknowledged%'
  ) then
    raise exception 'notification_index_invalid';
  end if;

  if (
    select count(*)
      from pg_class
     where oid in (health_table, notification_table)
       and relkind = 'r'
       and relrowsecurity
  ) <> 2 then
    raise exception 'rls_boundary_invalid';
  end if;

  if exists (
    select 1
      from pg_policies
     where schemaname = 'public'
       and tablename in ('system_health_events', 'admin_notifications')
  ) then
    raise exception 'browser_policy_invalid';
  end if;

  if has_table_privilege('anon', health_table, 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', health_table, 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('anon', notification_table, 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', notification_table, 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'browser_privilege_invalid';
  end if;
end
$verify$;

select 'OPERATIONS_MONITOR_MIGRATION_POSTFLIGHT=PASS';
rollback;
`;

function fail(code) {
  throw new Error(`OPERATIONS_MONITOR_MIGRATION_ERROR=${code}`);
}

function emit(level, event, fields = {}) {
  process.stdout.write(
    `${JSON.stringify({
      ts: new Date().toISOString(),
      version: VERSION,
      level,
      event,
      ...fields,
    })}\n`,
  );
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
    if (digest !== EXPECTED_MIGRATION_SHA256) {
      fail("migration_checksum_mismatch");
    }

    const requiredContracts = [
      /^begin;/imu,
      /set local lock_timeout = '5s'/iu,
      /set local statement_timeout = '60s'/iu,
      /alter table public\.system_health_events drop constraint if exists system_health_events_component_check/iu,
      /alter table public\.system_health_events add constraint system_health_events_component_check check/iu,
      /create index if not exists system_health_events_component_created_idx/iu,
      /create index if not exists admin_notifications_active_monitor_idx/iu,
      /where source = 'operations_monitor'/iu,
      /status in \('open', 'read', 'acknowledged'\)/iu,
      /commit;\s*$/iu,
    ];
    if (
      requiredContracts.some((contract) => !contract.test(sql)) ||
      EXPECTED_COMPONENTS.some((component) => !sql.includes(`'${component}'`)) ||
      /\b(?:insert|update|delete)\s+(?:into|from)?\s*public\./iu.test(sql) ||
      /\bdrop\s+(?:table|schema|database)\b/iu.test(sql) ||
      /public\.(?:contacts|messages|memories|followups|workspace_members|workspaces)/iu.test(sql)
    ) {
      fail("migration_contract_invalid");
    }
    return sql;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("OPERATIONS_MONITOR_MIGRATION_ERROR=")
    ) {
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
    if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash) {
      return "";
    }
    return /^([a-z0-9]{8,64})\.supabase\.co$/u.exec(url.hostname.toLowerCase())?.[1] ?? "";
  } catch {
    return "";
  }
}

function productionTarget() {
  if (process.env.FANMIND_RUNTIME_ENVIRONMENT !== "production") {
    fail("runtime_environment_invalid");
  }
  for (const key of ["DATABASE_URL", "POSTGRES_URL", "SUPABASE_DB_URL", "PGPASSWORD", "PGHOSTADDR", "PGSERVICE", "PGSERVICEFILE", "PGSYSCONFDIR"]) {
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
  if (!directHostBound && !poolerUserBound) {
    fail("database_project_binding_invalid");
  }
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
    const payload = JSON.parse(response.stdout);
    liveCommit = payload?.releaseCommit;
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
    snapshotDirectory = mkdtempSync(join(tmpdir(), "fanmind-monitor-migration-"));
    const snapshotPath = join(snapshotDirectory, "pgpass");
    writeFileSync(snapshotPath, content, { mode: 0o600, flag: "wx" });
    return { snapshotDirectory, snapshotPath };
  } catch (error) {
    if (snapshotDirectory) rmSync(snapshotDirectory, { recursive: true, force: true });
    if (
      error instanceof Error &&
      error.message.startsWith("OPERATIONS_MONITOR_MIGRATION_ERROR=")
    ) {
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
    PGAPPNAME: "fanmind_operations_monitor_migration",
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

function runDatabaseMode(mode, migrationSql) {
  if (typeof process.getuid !== "function" || process.getuid() !== 0) {
    fail("root_required");
  }
  verifyReleaseBinding();
  const target = productionTarget();
  ensurePsqlAvailable();
  const { snapshotDirectory, snapshotPath } = privatePassfileSnapshot(target.passfile);
  try {
    const basePreflight = runPsql(BASE_PREFLIGHT_SQL, target, snapshotPath);
    if (!psqlPassed(basePreflight, "OPERATIONS_MONITOR_MIGRATION_BASE_PREFLIGHT=PASS")) {
      fail("base_preflight_failed");
    }

    const currentPostflight = runPsql(POSTFLIGHT_SQL, target, snapshotPath);
    if (mode === "--verify") {
      if (!psqlPassed(currentPostflight, "OPERATIONS_MONITOR_MIGRATION_POSTFLIGHT=PASS")) {
        fail("schema_not_ready");
      }
      return "verified";
    }

    if (psqlPassed(currentPostflight, "OPERATIONS_MONITOR_MIGRATION_POSTFLIGHT=PASS")) {
      return "already_applied";
    }

    const apply = runPsql(migrationSql, target, snapshotPath);
    if (apply.error || apply.status !== 0) fail("apply_failed");
    const postflight = runPsql(POSTFLIGHT_SQL, target, snapshotPath);
    if (!psqlPassed(postflight, "OPERATIONS_MONITOR_MIGRATION_POSTFLIGHT=PASS")) {
      fail("postflight_failed");
    }
    return "applied";
  } finally {
    rmSync(snapshotDirectory, { recursive: true, force: true });
  }
}

export function verifyOperationsMonitorMigrationSource(mode = "--check") {
  return readAndVerifyMigration(mode);
}

export function operationsMonitorMigrationMode(argumentsList) {
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
      error instanceof Error &&
      /^OPERATIONS_MONITOR_MIGRATION_ERROR=[a-z0-9_]+$/u.test(error.message)
        ? error.message
        : "OPERATIONS_MONITOR_MIGRATION_ERROR=unexpected_failure";
    emit("error", "migration_failed", {
      action,
      error_code: message.slice("OPERATIONS_MONITOR_MIGRATION_ERROR=".length),
    });
    process.exitCode = 1;
  }
}

const direct = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (direct) await main();
