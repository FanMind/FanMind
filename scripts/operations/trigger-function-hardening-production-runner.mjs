#!/usr/bin/env node

import { createHash } from "node:crypto";
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
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const VERSION = "fanmind-trigger-function-hardening-production-1";
const MIGRATION_ID = "20260806203023_harden_trigger_function_privileges";
const MIGRATION_FILE_NAME = `${MIGRATION_ID}.sql`;
const EXPECTED_MIGRATION_SHA256 =
  "6eb928fe7df73072ce03d6e78dfca7feb5c77c950fbdd70ffe1169e4dabf1132";
const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const INSTALLED_MIGRATION_PATH = join(SCRIPT_DIRECTORY, MIGRATION_FILE_NAME);
const SOURCE_MIGRATION_PATH = resolve(
  SCRIPT_DIRECTORY,
  "../../supabase/controlled",
  MIGRATION_FILE_NAME,
);
const APPLY_CONFIRMATION = "trigger-function-hardening-production-apply";
const VERIFY_CONFIRMATION = "trigger-function-hardening-production-verify";
const MAX_MIGRATION_BYTES = 64 * 1024;
const MAX_PASSFILE_BYTES = 64 * 1024;
const PSQL_BIN = "/usr/lib/postgresql/17/bin/psql";
const CURL_BIN = "/usr/bin/curl";

const BASE_PREFLIGHT_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;
set local statement_timeout = '15s';

do $verify$
declare
  function_signature text;
  function_oid oid;
  optional_function_oid oid;
  anon_role oid := to_regrole('anon');
  authenticated_role oid := to_regrole('authenticated');
begin
  if anon_role is null or authenticated_role is null then
    raise exception 'required_role_missing';
  end if;

  foreach function_signature in array array[
    'public.set_social_connections_updated_at()',
    'public.set_referral_updated_at()',
    'public.set_demo_start_session_updated_at()'
  ]
  loop
    function_oid := to_regprocedure(function_signature);
    if function_oid is null then
      raise exception 'required_function_missing';
    end if;
    if not exists (
      select 1
        from pg_proc
       where oid = function_oid
         and pronargs = 0
         and prorettype = 'trigger'::regtype
         and (
           proconfig is null
           or proconfig @> array['search_path=pg_catalog, pg_temp']
         )
    ) then
      raise exception 'required_function_preflight_invalid';
    end if;
    if not exists (
      select 1 from pg_trigger
       where tgfoid = function_oid
         and not tgisinternal
    ) then
      raise exception 'required_trigger_missing';
    end if;
  end loop;

  optional_function_oid := to_regprocedure(
    'public.trim_conversation_messages_to_latest_50()'
  );
  if optional_function_oid is not null and not exists (
    select 1
      from pg_proc
     where oid = optional_function_oid
       and pronargs = 0
       and prorettype = 'trigger'::regtype
       and prosecdef
       and (
         proconfig @> array['search_path=public, pg_temp']
         or proconfig @> array['search_path=pg_catalog, pg_temp']
       )
  ) then
    raise exception 'optional_function_preflight_invalid';
  end if;
end
$verify$;

select 'TRIGGER_FUNCTION_HARDENING_PRODUCTION_BASE_PREFLIGHT=PASS';
rollback;
`;

const POSTFLIGHT_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;
set local statement_timeout = '15s';

do $verify$
declare
  function_signature text;
  function_oid oid;
  optional_function_oid oid;
begin
  foreach function_signature in array array[
    'public.set_social_connections_updated_at()',
    'public.set_referral_updated_at()',
    'public.set_demo_start_session_updated_at()'
  ]
  loop
    function_oid := to_regprocedure(function_signature);
    if function_oid is null then
      raise exception 'required_function_missing';
    end if;
    if not exists (
      select 1
        from pg_proc
       where oid = function_oid
         and pronargs = 0
         and prorettype = 'trigger'::regtype
         and proconfig @> array['search_path=pg_catalog, pg_temp']
    ) then
      raise exception 'required_function_contract_invalid';
    end if;
    if has_function_privilege('anon', function_oid, 'EXECUTE')
       or has_function_privilege('authenticated', function_oid, 'EXECUTE')
       or exists (
         select 1
           from pg_proc as function_definition
           cross join lateral aclexplode(
             coalesce(
               function_definition.proacl,
               acldefault('f', function_definition.proowner)
             )
           ) as function_acl
          where function_definition.oid = function_oid
            and function_acl.grantee = 0
            and function_acl.privilege_type = 'EXECUTE'
       ) then
      raise exception 'required_function_execute_invalid';
    end if;
  end loop;

  optional_function_oid := to_regprocedure(
    'public.trim_conversation_messages_to_latest_50()'
  );
  if optional_function_oid is not null then
    if not exists (
      select 1
        from pg_proc
       where oid = optional_function_oid
         and pronargs = 0
         and prorettype = 'trigger'::regtype
         and prosecdef
         and proconfig @> array['search_path=pg_catalog, pg_temp']
    ) then
      raise exception 'optional_function_contract_invalid';
    end if;
    if has_function_privilege('anon', optional_function_oid, 'EXECUTE')
       or has_function_privilege(
         'authenticated', optional_function_oid, 'EXECUTE'
       )
       or exists (
         select 1
           from pg_proc as function_definition
           cross join lateral aclexplode(
             coalesce(
               function_definition.proacl,
               acldefault('f', function_definition.proowner)
             )
           ) as function_acl
          where function_definition.oid = optional_function_oid
            and function_acl.grantee = 0
            and function_acl.privilege_type = 'EXECUTE'
       ) then
      raise exception 'optional_function_execute_invalid';
    end if;
  end if;
end
$verify$;

select 'TRIGGER_FUNCTION_HARDENING_PRODUCTION_POSTFLIGHT=PASS';
rollback;
`;

function fail(code) {
  throw new Error(`TRIGGER_FUNCTION_HARDENING_PRODUCTION_ERROR=${code}`);
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
      (path !== INSTALLED_MIGRATION_PATH ||
        stat.uid !== 0 ||
        (stat.mode & 0o777) !== 0o600)
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
      /alter function public\.set_social_connections_updated_at\(\)[\s\S]*set search_path = pg_catalog, pg_temp/iu,
      /revoke all on function public\.set_social_connections_updated_at\(\)[\s\S]*from public, anon, authenticated/iu,
      /alter function public\.set_referral_updated_at\(\)[\s\S]*set search_path = pg_catalog, pg_temp/iu,
      /revoke all on function public\.set_referral_updated_at\(\)[\s\S]*from public, anon, authenticated/iu,
      /alter function public\.set_demo_start_session_updated_at\(\)[\s\S]*set search_path = pg_catalog, pg_temp/iu,
      /revoke all on function public\.set_demo_start_session_updated_at\(\)[\s\S]*from public, anon, authenticated/iu,
      /to_regprocedure\([\s\S]*'public\.trim_conversation_messages_to_latest_50\(\)'[\s\S]*\) is not null/iu,
      /commit;\s*$/iu,
    ];
    const forbiddenContracts = [
      /\bgrant\b/iu,
      /\bdrop\s+(?:function|table|schema|database)\b/iu,
      /\btruncate\b/iu,
      /\b(?:insert|update|delete)\s+(?:into|from|public\.)/iu,
      /\bcreate\s+(?:function|table|policy|trigger)\b/iu,
    ];
    if (
      requiredContracts.some((contract) => !contract.test(sql)) ||
      forbiddenContracts.some((contract) => contract.test(sql))
    ) {
      fail("migration_contract_invalid");
    }
    return sql;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("TRIGGER_FUNCTION_HARDENING_PRODUCTION_ERROR=")
    ) {
      throw error;
    }
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ELOOP"
    ) {
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
    if (
      url.protocol !== "https:" ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return "";
    }
    return /^([a-z0-9]{8,64})\.supabase\.co$/u.exec(
      url.hostname.toLowerCase(),
    )?.[1] ?? "";
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

  const projectReference = projectReferenceFromUrl(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  const host = normalizedHost(process.env.FANMIND_BACKUP_DB_HOST);
  const port = process.env.FANMIND_BACKUP_DB_PORT?.trim() || "5432";
  const database = process.env.FANMIND_BACKUP_DB_NAME?.trim() ?? "";
  const user = process.env.FANMIND_BACKUP_DB_USER?.trim().toLowerCase() ?? "";
  const passfile = process.env.FANMIND_BACKUP_PGPASSFILE?.trim() ?? "";
  if (!projectReference || !host) fail("project_binding_missing");
  if (!/^[0-9]{1,5}$/u.test(port) || Number(port) < 1 || Number(port) > 65535) {
    fail("database_port_invalid");
  }
  if (
    !/^[A-Za-z0-9_.-]{1,128}$/u.test(database) ||
    !/^[a-z0-9_.-]{1,160}$/u.test(user)
  ) {
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
  if (!/^[0-9a-f]{40}$/u.test(expectedCommit)) {
    fail("release_commit_invalid");
  }
  const response = spawnSync(
    CURL_BIN,
    [
      "-fsSL",
      "--max-time",
      "15",
      "--max-filesize",
      "16384",
      "https://fanmind.ch/api/version",
    ],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 20000,
    },
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
      const bytesRead = readSync(
        descriptor,
        content,
        offset,
        content.length - offset,
        offset,
      );
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
    snapshotDirectory = mkdtempSync(
      join(tmpdir(), "fanmind-trigger-function-hardening-production-"),
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
      error.message.startsWith("TRIGGER_FUNCTION_HARDENING_PRODUCTION_ERROR=")
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
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function psqlEnvironment(target, passfilePath) {
  return {
    HOME: "/tmp",
    LANG: "C",
    LC_ALL: "C",
    PATH: "/usr/bin:/bin",
    PGAPPNAME: "fanmind_trigger_function_hardening_production",
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
  const { snapshotDirectory, snapshotPath } = privatePassfileSnapshot(
    target.passfile,
  );
  try {
    const basePreflight = runPsql(BASE_PREFLIGHT_SQL, target, snapshotPath);
    if (
      !psqlPassed(
        basePreflight,
        "TRIGGER_FUNCTION_HARDENING_PRODUCTION_BASE_PREFLIGHT=PASS",
      )
    ) {
      fail("base_preflight_failed");
    }

    const currentPostflight = runPsql(POSTFLIGHT_SQL, target, snapshotPath);
    const alreadyReady = psqlPassed(
      currentPostflight,
      "TRIGGER_FUNCTION_HARDENING_PRODUCTION_POSTFLIGHT=PASS",
    );
    if (mode === "--verify") {
      if (!alreadyReady) fail("hardening_not_ready");
      return "verified";
    }
    if (alreadyReady) return "already_applied";

    const apply = runPsql(migrationSql, target, snapshotPath);
    if (apply.error || apply.status !== 0) fail("apply_failed");
    const postflight = runPsql(POSTFLIGHT_SQL, target, snapshotPath);
    if (
      !psqlPassed(
        postflight,
        "TRIGGER_FUNCTION_HARDENING_PRODUCTION_POSTFLIGHT=PASS",
      )
    ) {
      fail("postflight_failed");
    }
    return "applied";
  } finally {
    rmSync(snapshotDirectory, { recursive: true, force: true });
  }
}

export function verifyTriggerFunctionHardeningProductionSource(
  mode = "--check",
) {
  return readAndVerifyMigration(mode);
}

export function triggerFunctionHardeningProductionMode(argumentsList) {
  return modeFromArguments(argumentsList);
}

async function main() {
  let action = "check";
  try {
    const mode = modeFromArguments(process.argv.slice(2));
    action = mode.slice(2);
    const migrationSql = readAndVerifyMigration(mode);
    if (mode === "--check") {
      emit("info", "hardening_status", { action, status: "ready" });
      return;
    }
    const status = runDatabaseMode(mode, migrationSql);
    emit("info", "hardening_status", { action, status });
  } catch (error) {
    const message =
      error instanceof Error &&
      /^TRIGGER_FUNCTION_HARDENING_PRODUCTION_ERROR=[a-z0-9_]+$/u.test(
        error.message,
      )
        ? error.message
        : "TRIGGER_FUNCTION_HARDENING_PRODUCTION_ERROR=unexpected_failure";
    emit("error", "hardening_failed", {
      action,
      error_code: message.slice(
        "TRIGGER_FUNCTION_HARDENING_PRODUCTION_ERROR=".length,
      ),
    });
    process.exitCode = 1;
  }
}

const direct =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;
if (direct) await main();

export {
  APPLY_CONFIRMATION,
  BASE_PREFLIGHT_SQL,
  EXPECTED_MIGRATION_SHA256,
  MIGRATION_ID,
  POSTFLIGHT_SQL,
  VERIFY_CONFIRMATION,
  VERSION,
};
