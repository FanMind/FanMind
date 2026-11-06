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

const VERSION = "fanmind-backup-verification-migration-1";
const MIGRATION_ID = "20260718173000_enable_safe_backup_verification";
const MIGRATION_FILE_NAME = `${MIGRATION_ID}.sql`;
const EXPECTED_MIGRATION_SHA256 =
  "8eed56adadef5c5a9a6075ead6a956d8414b8c592fe583ce8cdb6a4ab00e0cfa";
const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const INSTALLED_MIGRATION_PATH = join(SCRIPT_DIRECTORY, MIGRATION_FILE_NAME);
const SOURCE_MIGRATION_PATH = resolve(
  SCRIPT_DIRECTORY,
  "../../supabase/migrations",
  MIGRATION_FILE_NAME,
);
const APPLY_CONFIRMATION = "backup-verification-production-apply";
const VERIFY_CONFIRMATION = "backup-verification-production-verify";
const MAX_MIGRATION_BYTES = 64 * 1024;
const MAX_PASSFILE_BYTES = 64 * 1024;
const PSQL_BIN = "/usr/lib/postgresql/17/bin/psql";
const CURL_BIN = "/usr/bin/curl";

const JOB_TYPES = [
  "backup_check",
  "backup_database",
  "backup_full",
  "backup_server_config",
  "backup_snapshot",
  "backup_storage",
  "deployment_check",
  "health_check",
  "maintenance_note",
  "manual_review",
  "verify_backup",
];

const BACKUP_TYPES = [
  "configuration",
  "database",
  "full",
  "server_config",
  "storage",
  "verification",
];

const PREFLIGHT_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;

do $verify$
declare
  jobs_table oid := to_regclass('public.admin_operation_jobs');
  runs_table oid := to_regclass('public.backup_runs');
  claim_function oid := to_regprocedure('public.claim_admin_backup_job(text,integer)');
  anon_role oid := to_regrole('anon');
  authenticated_role oid := to_regrole('authenticated');
  service_role oid := to_regrole('service_role');
begin
  if jobs_table is null or runs_table is null or claim_function is null
     or anon_role is null or authenticated_role is null or service_role is null then
    raise exception 'backup_foundation_missing';
  end if;

  if (
    select count(*)
      from pg_class
     where oid in (jobs_table, runs_table)
       and relkind = 'r'
       and relrowsecurity
  ) <> 2 then
    raise exception 'rls_boundary_invalid';
  end if;

  if exists (
    select 1
      from pg_policies
     where schemaname = 'public'
       and tablename in ('admin_operation_jobs', 'backup_runs')
  ) then
    raise exception 'browser_policy_invalid';
  end if;

  if exists (
    select 1
      from pg_class as relation
      cross join lateral aclexplode(
        coalesce(relation.relacl, acldefault('r', relation.relowner))
      ) as privilege
     where relation.oid in (jobs_table, runs_table)
       and privilege.grantee in (0, anon_role, authenticated_role)
       and privilege.privilege_type in (
         'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
       )
  ) then
    raise exception 'browser_privilege_invalid';
  end if;

  if exists (
    select 1
      from pg_proc as function_definition
      cross join lateral aclexplode(
        coalesce(function_definition.proacl, acldefault('f', function_definition.proowner))
      ) as privilege
     where function_definition.oid = claim_function
       and privilege.grantee in (0, anon_role, authenticated_role)
       and privilege.privilege_type = 'EXECUTE'
  ) or not has_function_privilege(service_role, claim_function, 'EXECUTE')
     or not has_schema_privilege(service_role, 'public', 'USAGE') then
    raise exception 'claim_privilege_invalid';
  end if;

  if exists (
    select 1 from public.admin_operation_jobs
     where job_type not in (
       'health_check', 'backup_check', 'backup_snapshot', 'deployment_check',
       'maintenance_note', 'manual_review', 'backup_server_config',
       'backup_database', 'backup_storage', 'backup_full', 'verify_backup'
     )
  ) then
    raise exception 'existing_job_type_invalid';
  end if;

  if exists (
    select 1 from public.backup_runs
     where backup_type not in (
       'database', 'storage', 'configuration', 'server_config', 'full',
       'verification'
     )
  ) then
    raise exception 'existing_backup_type_invalid';
  end if;
end
$verify$;

select 'BACKUP_VERIFICATION_MIGRATION_PREFLIGHT=PASS';
rollback;
`;

const POSTFLIGHT_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;

do $verify$
declare
  jobs_table oid := to_regclass('public.admin_operation_jobs');
  runs_table oid := to_regclass('public.backup_runs');
  claim_function oid := to_regprocedure('public.claim_admin_backup_job(text,integer)');
  anon_role oid := to_regrole('anon');
  authenticated_role oid := to_regrole('authenticated');
  service_role oid := to_regrole('service_role');
  actual_job_types text[];
  actual_backup_types text[];
  function_definition text;
begin
  if jobs_table is null or runs_table is null or claim_function is null
     or anon_role is null or authenticated_role is null or service_role is null then
    raise exception 'backup_foundation_missing';
  end if;

  select array_agg(value order by value)
    into actual_job_types
    from (
      select distinct matches[1] as value
        from pg_constraint as constraint_definition
        cross join lateral regexp_matches(
          pg_get_constraintdef(constraint_definition.oid),
          '''([^'']+)''',
          'g'
        ) as matches
       where constraint_definition.conrelid = jobs_table
         and constraint_definition.conname = 'admin_operation_jobs_job_type_check'
         and constraint_definition.contype = 'c'
         and constraint_definition.convalidated
    ) as values_from_constraint;

  select array_agg(value order by value)
    into actual_backup_types
    from (
      select distinct matches[1] as value
        from pg_constraint as constraint_definition
        cross join lateral regexp_matches(
          pg_get_constraintdef(constraint_definition.oid),
          '''([^'']+)''',
          'g'
        ) as matches
       where constraint_definition.conrelid = runs_table
         and constraint_definition.conname = 'backup_runs_backup_type_check'
         and constraint_definition.contype = 'c'
         and constraint_definition.convalidated
    ) as values_from_constraint;

  if actual_job_types is distinct from array[
    'backup_check', 'backup_database', 'backup_full', 'backup_server_config',
    'backup_snapshot', 'backup_storage', 'deployment_check', 'health_check',
    'maintenance_note', 'manual_review', 'verify_backup'
  ]::text[] then
    raise exception 'job_constraint_invalid';
  end if;

  if actual_backup_types is distinct from array[
    'configuration', 'database', 'full', 'server_config', 'storage',
    'verification'
  ]::text[] then
    raise exception 'backup_constraint_invalid';
  end if;

  select lower(pg_get_functiondef(claim_function)) into function_definition;
  if function_definition not like '%verify_backup%'
     or function_definition not like '%backup_server_config%'
     or function_definition not like '%backup_database%'
     or function_definition not like '%backup_storage%'
     or function_definition not like '%backup_full%'
     or function_definition not like '%for update skip locked%'
     or function_definition not like '%security definer%'
     or function_definition not like '%set search_path to ''public''%' then
    raise exception 'claim_function_invalid';
  end if;

  if exists (
    select 1
      from pg_proc as stored_function
      cross join lateral aclexplode(
        coalesce(stored_function.proacl, acldefault('f', stored_function.proowner))
      ) as privilege
     where stored_function.oid = claim_function
       and privilege.grantee in (0, anon_role, authenticated_role)
       and privilege.privilege_type = 'EXECUTE'
  ) or not has_function_privilege(service_role, claim_function, 'EXECUTE')
     or not has_schema_privilege(service_role, 'public', 'USAGE') then
    raise exception 'claim_privilege_invalid';
  end if;

  if (
    select count(*)
      from pg_class
     where oid in (jobs_table, runs_table)
       and relkind = 'r'
       and relrowsecurity
  ) <> 2 then
    raise exception 'rls_boundary_invalid';
  end if;

  if exists (
    select 1
      from pg_policies
     where schemaname = 'public'
       and tablename in ('admin_operation_jobs', 'backup_runs')
  ) then
    raise exception 'browser_policy_invalid';
  end if;

  if exists (
    select 1
      from pg_class as relation
      cross join lateral aclexplode(
        coalesce(relation.relacl, acldefault('r', relation.relowner))
      ) as privilege
     where relation.oid in (jobs_table, runs_table)
       and privilege.grantee in (0, anon_role, authenticated_role)
       and privilege.privilege_type in (
         'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
       )
  ) then
    raise exception 'browser_privilege_invalid';
  end if;
end
$verify$;

select 'BACKUP_VERIFICATION_MIGRATION_POSTFLIGHT=PASS';
rollback;
`;

function fail(code) {
  throw new Error(`BACKUP_VERIFICATION_MIGRATION_ERROR=${code}`);
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
      /alter table public\.admin_operation_jobs drop constraint if exists admin_operation_jobs_job_type_check/iu,
      /alter table public\.admin_operation_jobs add constraint admin_operation_jobs_job_type_check check/iu,
      /alter table public\.backup_runs drop constraint if exists backup_runs_backup_type_check/iu,
      /alter table public\.backup_runs add constraint backup_runs_backup_type_check check/iu,
      /create or replace function public\.claim_admin_backup_job\(p_worker_id text, p_lease_seconds integer default 900\)/iu,
      /security definer/iu,
      /set search_path = public/iu,
      /for update skip locked/iu,
      /revoke all on function public\.claim_admin_backup_job\(text, integer\) from public, anon, authenticated/iu,
      /grant execute on function public\.claim_admin_backup_job\(text, integer\) to service_role/iu,
    ];
    const schemaOnlySql = sql.replace(
      /create or replace function public\.claim_admin_backup_job[\s\S]*?\n\$\$;/iu,
      "",
    );
    if (
      requiredContracts.some((contract) => !contract.test(sql)) ||
      JOB_TYPES.some((jobType) => !sql.includes(`'${jobType}'`)) ||
      BACKUP_TYPES.some((backupType) => !sql.includes(`'${backupType}'`)) ||
      /\b(?:insert|update|delete)\s+(?:into|from)?\s*public\./iu.test(schemaOnlySql) ||
      /\bdrop\s+(?:table|schema|database)\b/iu.test(sql) ||
      /public\.(?:contacts|messages|memories|followups|workspace_members|workspaces)/iu.test(sql)
    ) {
      fail("migration_contract_invalid");
    }
    return sql;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("BACKUP_VERIFICATION_MIGRATION_ERROR=")
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
    snapshotDirectory = mkdtempSync(join(tmpdir(), "fanmind-backup-verification-migration-"));
    const snapshotPath = join(snapshotDirectory, "pgpass");
    writeFileSync(snapshotPath, content, { mode: 0o600, flag: "wx" });
    return { snapshotDirectory, snapshotPath };
  } catch (error) {
    if (snapshotDirectory) rmSync(snapshotDirectory, { recursive: true, force: true });
    if (
      error instanceof Error &&
      error.message.startsWith("BACKUP_VERIFICATION_MIGRATION_ERROR=")
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
    PGAPPNAME: "fanmind_backup_verification_migration",
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

function transactionalMigration(migrationSql) {
  return `\\set ON_ERROR_STOP on\nbegin;\nset local lock_timeout = '5s';\nset local statement_timeout = '60s';\n${migrationSql.trim()}\ncommit;\n`;
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
    const preflight = runPsql(PREFLIGHT_SQL, target, snapshotPath);
    if (!psqlPassed(preflight, "BACKUP_VERIFICATION_MIGRATION_PREFLIGHT=PASS")) {
      fail("preflight_failed");
    }

    const currentPostflight = runPsql(POSTFLIGHT_SQL, target, snapshotPath);
    if (mode === "--verify") {
      if (!psqlPassed(currentPostflight, "BACKUP_VERIFICATION_MIGRATION_POSTFLIGHT=PASS")) {
        fail("schema_not_ready");
      }
      return "verified";
    }

    if (psqlPassed(currentPostflight, "BACKUP_VERIFICATION_MIGRATION_POSTFLIGHT=PASS")) {
      return "already_applied";
    }

    const apply = runPsql(transactionalMigration(migrationSql), target, snapshotPath);
    if (apply.error || apply.status !== 0) fail("apply_failed");
    const postflight = runPsql(POSTFLIGHT_SQL, target, snapshotPath);
    if (!psqlPassed(postflight, "BACKUP_VERIFICATION_MIGRATION_POSTFLIGHT=PASS")) {
      fail("postflight_failed");
    }
    return "applied";
  } finally {
    rmSync(snapshotDirectory, { recursive: true, force: true });
  }
}

export function verifyBackupVerificationMigrationSource(mode = "--check") {
  return readAndVerifyMigration(mode);
}

export function backupVerificationMigrationMode(argumentsList) {
  return modeFromArguments(argumentsList);
}

export function wrapBackupVerificationMigration(migrationSql) {
  return transactionalMigration(migrationSql);
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
      /^BACKUP_VERIFICATION_MIGRATION_ERROR=[a-z0-9_]+$/u.test(error.message)
        ? error.message
        : "BACKUP_VERIFICATION_MIGRATION_ERROR=unexpected_failure";
    emit("error", "migration_failed", {
      action,
      error_code: message.slice("BACKUP_VERIFICATION_MIGRATION_ERROR=".length),
    });
    process.exitCode = 1;
  }
}

const direct = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (direct) await main();
