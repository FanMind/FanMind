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

import { evaluateTriggerFunctionHardeningStagingEnvironment } from "../../src/lib/triggerFunctionHardeningStagingPolicy.mjs";

const MIGRATION_ID = "20260806203023_harden_trigger_function_privileges";
const MIGRATION_PATH = resolve(
  process.cwd(),
  `supabase/controlled/${MIGRATION_ID}.sql`,
);
const EXPECTED_MIGRATION_SHA256 =
  "6eb928fe7df73072ce03d6e78dfca7feb5c77c950fbdd70ffe1169e4dabf1132";
const MAX_PASSFILE_BYTES = 64 * 1024;

const POSTFLIGHT_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;

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
      raise exception 'optional_retention_function_contract_invalid';
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
      raise exception 'optional_retention_function_execute_invalid';
    end if;
  end if;
end
$verify$;

select 'TRIGGER_FUNCTION_HARDENING_POSTFLIGHT=PASS';
rollback;
`;

function fail(code) {
  throw new Error(`TRIGGER_FUNCTION_HARDENING_ERROR=${code}`);
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

export function evaluateTriggerFunctionHardeningMigrationSql(sql) {
  if (typeof sql !== "string") fail("migration_unreadable");
  const digest = createHash("sha256").update(sql).digest("hex");
  if (digest !== EXPECTED_MIGRATION_SHA256) {
    fail("migration_checksum_mismatch");
  }

  const requiredContracts = [
    /^begin;/iu,
    /alter function public\.set_social_connections_updated_at\(\)[\s\S]*set search_path = pg_catalog, pg_temp/iu,
    /revoke all on function public\.set_social_connections_updated_at\(\)[\s\S]*from public, anon, authenticated/iu,
    /alter function public\.set_referral_updated_at\(\)[\s\S]*set search_path = pg_catalog, pg_temp/iu,
    /revoke all on function public\.set_referral_updated_at\(\)[\s\S]*from public, anon, authenticated/iu,
    /alter function public\.set_demo_start_session_updated_at\(\)[\s\S]*set search_path = pg_catalog, pg_temp/iu,
    /revoke all on function public\.set_demo_start_session_updated_at\(\)[\s\S]*from public, anon, authenticated/iu,
    /to_regprocedure\([\s\S]*'public\.trim_conversation_messages_to_latest_50\(\)'[\s\S]*\) is not null/iu,
    /alter function public\.trim_conversation_messages_to_latest_50\(\)[\s\S]*set search_path = pg_catalog, pg_temp/iu,
    /revoke all on function public\.trim_conversation_messages_to_latest_50\(\)[\s\S]*from public, anon, authenticated/iu,
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

  return Object.freeze({ digest, migrationId: MIGRATION_ID });
}

function readAndVerifyMigration() {
  let sql;
  try {
    sql = readFileSync(MIGRATION_PATH, "utf8");
  } catch {
    fail("migration_unreadable");
  }
  const result = evaluateTriggerFunctionHardeningMigrationSql(sql);
  console.log(`TRIGGER_FUNCTION_HARDENING_MIGRATION_ID=${result.migrationId}`);
  console.log("TRIGGER_FUNCTION_HARDENING_CHECKSUM=verified");
  console.log("TRIGGER_FUNCTION_HARDENING_CONTRACT=verified");
  return sql;
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

    snapshotDirectory = mkdtempSync(
      join(tmpdir(), "fanmind-trigger-function-hardening-"),
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
      error.message.startsWith("TRIGGER_FUNCTION_HARDENING_ERROR=")
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
  ]) {
    delete safeEnvironment[key];
  }
  safeEnvironment.PGCONNECT_TIMEOUT = "10";
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
  console.log("TRIGGER_FUNCTION_HARDENING_PSQL=available");
}

function runDatabaseMode(mode, migrationSql, environment) {
  const policyMode = mode === "--apply" ? "apply" : "verify";
  const evaluation = evaluateTriggerFunctionHardeningStagingEnvironment(
    environment,
    { mode: policyMode },
  );
  if (!evaluation.ok) fail("environment_invalid");

  ensurePsqlAvailable();
  const { snapshotDirectory, snapshotPath } =
    privatePassfileSnapshot(environment);
  try {
    if (mode === "--apply") {
      const apply = runPsql(migrationSql, environment, snapshotPath);
      if (apply.error || apply.status !== 0) fail("apply_failed");
      console.log("TRIGGER_FUNCTION_HARDENING_APPLY=completed");
    } else {
      console.log("TRIGGER_FUNCTION_HARDENING_APPLY=not_requested");
    }

    const verification = runPsql(POSTFLIGHT_SQL, environment, snapshotPath);
    if (
      verification.error ||
      verification.status !== 0 ||
      !verification.stdout.includes(
        "TRIGGER_FUNCTION_HARDENING_POSTFLIGHT=PASS",
      )
    ) {
      fail("postflight_failed");
    }
    console.log("TRIGGER_FUNCTION_HARDENING_POSTFLIGHT=PASS");
    console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
  } finally {
    rmSync(snapshotDirectory, { recursive: true, force: true });
  }
}

async function main() {
  const mode = modeFromArguments(process.argv.slice(2));
  const migrationSql = readAndVerifyMigration();
  if (mode === "--check") {
    console.log("TRIGGER_FUNCTION_HARDENING_MODE=check");
    console.log("TRIGGER_FUNCTION_HARDENING_READY=YES");
    return;
  }
  console.log(
    `TRIGGER_FUNCTION_HARDENING_MODE=${
      mode === "--apply" ? "apply" : "verify"
    }`,
  );
  runDatabaseMode(mode, migrationSql, process.env);
  console.log("TRIGGER_FUNCTION_HARDENING_READY=YES");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    if (
      error instanceof Error &&
      /^TRIGGER_FUNCTION_HARDENING_ERROR=[a-z0-9_]+$/u.test(error.message)
    ) {
      console.error(error.message);
    } else {
      console.error("TRIGGER_FUNCTION_HARDENING_ERROR=unexpected_failure");
    }
    console.error("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
    process.exitCode = 1;
  });
}

export {
  EXPECTED_MIGRATION_SHA256,
  MIGRATION_ID,
  POSTFLIGHT_SQL,
};
