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

import { evaluateMobilePushStagingControlEnvironment } from "../../src/lib/mobilePushStagingControlPolicy.mjs";

const MIGRATION_ID = "20260729120000_mobile_push_registrations";
const MIGRATION_PATH = resolve(
  process.cwd(),
  `supabase/migrations/${MIGRATION_ID}.sql`,
);
const EXPECTED_MIGRATION_SHA256 =
  "1a22d71a09427bbf0093dfc12f6fbcaf76256d61728048390b1299c526bfd0d7";
const MAX_PASSFILE_BYTES = 64 * 1024;

const POSTFLIGHT_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;

do $verify$
declare
  registrations_table oid :=
    to_regclass('public.mobile_push_registrations');
  registration_column record;
begin
  if registrations_table is null then
    raise exception 'table_missing';
  end if;

  if not exists (
    select 1
      from pg_class
     where oid = registrations_table
       and relkind = 'r'
       and relrowsecurity
  ) then
    raise exception 'rls_boundary_invalid';
  end if;

  if exists (
    select 1
      from pg_policies
     where schemaname = 'public'
       and tablename = 'mobile_push_registrations'
  ) then
    raise exception 'browser_policy_invalid';
  end if;

  if has_table_privilege(
       'anon', registrations_table,
       'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
     )
     or has_table_privilege(
       'authenticated', registrations_table,
       'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
     ) then
    raise exception 'browser_table_privilege_invalid';
  end if;

  for registration_column in
    select attribute.attname::text as column_name
      from pg_attribute as attribute
     where attribute.attrelid = registrations_table
       and attribute.attnum > 0
       and not attribute.attisdropped
  loop
    if has_column_privilege(
         'anon', registrations_table,
         registration_column.column_name,
         'SELECT,INSERT,UPDATE,REFERENCES'
       )
       or has_column_privilege(
         'authenticated', registrations_table,
         registration_column.column_name,
         'SELECT,INSERT,UPDATE,REFERENCES'
       ) then
      raise exception 'browser_column_privilege_invalid';
    end if;
  end loop;

  if not has_table_privilege(
       'service_role', registrations_table, 'SELECT'
     )
     or not has_table_privilege(
       'service_role', registrations_table, 'INSERT'
     )
     or not has_table_privilege(
       'service_role', registrations_table, 'UPDATE'
     )
     or not has_table_privilege(
       'service_role', registrations_table, 'DELETE'
     )
     or has_table_privilege(
       'service_role', registrations_table, 'TRUNCATE'
     )
     or has_table_privilege(
       'service_role', registrations_table, 'REFERENCES'
     )
     or has_table_privilege(
       'service_role', registrations_table, 'TRIGGER'
     ) then
    raise exception 'service_role_privilege_invalid';
  end if;

  if (
    select count(*)
      from pg_attribute
     where attrelid = registrations_table
       and attnum > 0
       and not attisdropped
  ) <> 13 then
    raise exception 'column_contract_invalid';
  end if;

  if exists (
    select 1
      from pg_constraint
     where conrelid = registrations_table
       and not convalidated
  ) then
    raise exception 'constraint_validation_invalid';
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conrelid = registrations_table
       and conname = 'mobile_push_registrations_one_device_per_user'
       and contype = 'u'
  )
     or not exists (
       select 1
         from pg_constraint
        where conrelid = registrations_table
          and conname = 'mobile_push_registrations_expiry_check'
          and contype = 'c'
     )
     or (
       select count(*)
         from pg_constraint
        where conrelid = registrations_table
          and contype = 'f'
          and confdeltype = 'c'
     ) <> 2
     or (
       select count(*)
         from pg_constraint
        where conrelid = registrations_table
          and contype = 'u'
     ) <> 2 then
    raise exception 'constraint_contract_invalid';
  end if;

  if not exists (
    select 1
      from pg_index as index_definition
      join pg_class as index_relation
        on index_relation.oid = index_definition.indexrelid
     where index_definition.indrelid = registrations_table
       and index_relation.relname =
         'mobile_push_registrations_active_expiry_idx'
       and index_definition.indisvalid
       and index_definition.indisready
       and index_definition.indpred is not null
  ) then
    raise exception 'index_contract_invalid';
  end if;

  if (
    select count(*)
      from pg_trigger
     where tgrelid = registrations_table
       and not tgisinternal
  ) <> 1
     or not exists (
       select 1
         from pg_trigger
        where tgrelid = registrations_table
          and tgname = 'mobile_push_registrations_set_updated_at'
          and tgenabled = 'O'
          and not tgisinternal
     ) then
    raise exception 'trigger_contract_invalid';
  end if;

  if not exists (
    select 1
      from pg_proc
     where oid = to_regprocedure(
       'public.set_mobile_push_registration_updated_at()'
     )
       and not prosecdef
       and proconfig @> array['search_path=public, pg_temp']
  ) then
    raise exception 'function_contract_invalid';
  end if;
end
$verify$;

select 'MOBILE_PUSH_REGISTRATION_MIGRATION_POSTFLIGHT=PASS';
rollback;
`;

function fail(code) {
  throw new Error(`MOBILE_PUSH_REGISTRATION_MIGRATION_ERROR=${code}`);
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

export function evaluateMobilePushMigrationSql(sql) {
  if (typeof sql !== "string") fail("migration_unreadable");
  const digest = createHash("sha256").update(sql).digest("hex");
  if (digest !== EXPECTED_MIGRATION_SHA256) {
    fail("migration_checksum_mismatch");
  }

  const requiredContracts = [
    /^begin;/iu,
    /create extension if not exists pgcrypto/iu,
    /create table if not exists public\.mobile_push_registrations/iu,
    /user_id uuid not null references auth\.users\(id\) on delete cascade/iu,
    /workspace_id uuid not null references public\.workspaces\(id\) on delete cascade/iu,
    /expo_token_ciphertext text not null check/iu,
    /expo_token_hash text not null unique check/iu,
    /constraint mobile_push_registrations_one_device_per_user unique \(user_id\)/iu,
    /constraint mobile_push_registrations_expiry_check check/iu,
    /create index if not exists mobile_push_registrations_active_expiry_idx/iu,
    /language plpgsql\s+security invoker\s+set search_path = public, pg_temp/iu,
    /create or replace trigger mobile_push_registrations_set_updated_at/iu,
    /alter table public\.mobile_push_registrations enable row level security/iu,
    /revoke all on table public\.mobile_push_registrations\s+from public, anon, authenticated/iu,
    /grant select, insert, update, delete\s+on table public\.mobile_push_registrations\s+to service_role/iu,
    /no delivery job is enabled by this migration/iu,
    /commit;\s*$/iu,
  ];
  const forbiddenContracts = [
    /create\s+policy/iu,
    /\bdrop\s+(?:table|schema|database)\b/iu,
    /\btruncate\b/iu,
    /\bpg_cron\b/iu,
    /\bcron\.schedule\b/iu,
    /\b(?:http|net)\.(?:post|get)\b/iu,
    /expo\.dev\/--\/api\/v2\/push\/send/iu,
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
  const result = evaluateMobilePushMigrationSql(sql);
  console.log(`MOBILE_PUSH_REGISTRATION_MIGRATION_ID=${result.migrationId}`);
  console.log("MOBILE_PUSH_REGISTRATION_MIGRATION_CHECKSUM=verified");
  console.log("MOBILE_PUSH_REGISTRATION_MIGRATION_CONTRACT=verified");
  console.log("MOBILE_PUSH_REGISTRATION_DELIVERY=disabled");
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
      join(tmpdir(), "fanmind-mobile-push-migration-"),
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
      error.message.startsWith(
        "MOBILE_PUSH_REGISTRATION_MIGRATION_ERROR=",
      )
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
  console.log("MOBILE_PUSH_REGISTRATION_MIGRATION_PSQL=available");
}

function runDatabaseMode(mode, migrationSql, environment) {
  const policyMode = mode === "--apply" ? "migration" : "schema";
  const evaluation = evaluateMobilePushStagingControlEnvironment(environment, {
    mode: policyMode,
  });
  if (!evaluation.ok) fail("environment_invalid");

  ensurePsqlAvailable();
  const { snapshotDirectory, snapshotPath } =
    privatePassfileSnapshot(environment);
  try {
    if (mode === "--apply") {
      const apply = runPsql(migrationSql, environment, snapshotPath);
      if (apply.error || apply.status !== 0) fail("apply_failed");
      console.log("MOBILE_PUSH_REGISTRATION_MIGRATION_APPLY=completed");
    } else {
      console.log("MOBILE_PUSH_REGISTRATION_MIGRATION_APPLY=not_requested");
    }

    const verification = runPsql(
      POSTFLIGHT_SQL,
      environment,
      snapshotPath,
    );
    if (
      verification.error ||
      verification.status !== 0 ||
      !verification.stdout.includes(
        "MOBILE_PUSH_REGISTRATION_MIGRATION_POSTFLIGHT=PASS",
      )
    ) {
      fail("postflight_failed");
    }
    console.log("MOBILE_PUSH_REGISTRATION_MIGRATION_POSTFLIGHT=PASS");
    console.log("MOBILE_PUSH_REGISTRATION_DELIVERY=disabled");
    console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
  } finally {
    rmSync(snapshotDirectory, { recursive: true, force: true });
  }
}

async function main() {
  const mode = modeFromArguments(process.argv.slice(2));
  const migrationSql = readAndVerifyMigration();
  if (mode === "--check") {
    console.log("MOBILE_PUSH_REGISTRATION_MIGRATION_MODE=check");
    console.log("MOBILE_PUSH_REGISTRATION_MIGRATION_READY=YES");
    return;
  }
  console.log(
    `MOBILE_PUSH_REGISTRATION_MIGRATION_MODE=${
      mode === "--apply" ? "apply" : "verify"
    }`,
  );
  runDatabaseMode(mode, migrationSql, process.env);
  console.log("MOBILE_PUSH_REGISTRATION_MIGRATION_READY=YES");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    if (
      error instanceof Error &&
      /^MOBILE_PUSH_REGISTRATION_MIGRATION_ERROR=[a-z0-9_]+$/u.test(
        error.message,
      )
    ) {
      console.error(error.message);
    } else {
      console.error(
        "MOBILE_PUSH_REGISTRATION_MIGRATION_ERROR=unexpected_failure",
      );
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
