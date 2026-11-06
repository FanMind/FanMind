#!/usr/bin/env node

import { spawnSync } from "node:child_process";
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
import { pathToFileURL } from "node:url";

import { evaluateMetaConversationContinuationStagingEnvironment } from "../../src/lib/metaConversationContinuationStagingPolicy.mjs";

const MIGRATION_ID = "20260811220000_meta_conversation_sync_continuation";
const MIGRATION_PATH = resolve(
  process.cwd(),
  `supabase/migrations/${MIGRATION_ID}.sql`,
);
const EXPECTED_MIGRATION_SHA256 =
  "798afe7d4a645b4e1184a880cc2e98d6325437df97d7f39fa228bbb24fa5b58d";
const MAX_PASSFILE_BYTES = 64 * 1024;

const STATE_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;

with continuation_state as (
  select
    count(*) filter (
      where attribute.attname = 'messenger_sync_continuation_after'
        and attribute.atttypid = 'text'::regtype
        and not attribute.attnotnull
    ) as valid_after_columns,
    count(*) filter (
      where attribute.attname = 'messenger_sync_continuation_started_at'
        and attribute.atttypid = 'timestamptz'::regtype
        and not attribute.attnotnull
    ) as valid_started_columns,
    count(*) as present_columns
  from pg_attribute as attribute
  where attribute.attrelid = to_regclass('public.social_connections')
    and attribute.attname in (
      'messenger_sync_continuation_after',
      'messenger_sync_continuation_started_at'
    )
    and attribute.attnum > 0
    and not attribute.attisdropped
), constraint_state as (
  select count(*) as present_constraints
  from pg_constraint
  where conrelid = to_regclass('public.social_connections')
    and conname = 'social_connections_messenger_sync_continuation_check'
    and contype = 'c'
)
select 'META_CONVERSATION_CONTINUATION_STATE=' ||
  case
    when present_columns = 0 and present_constraints = 0 then 'absent'
    when present_columns = 2
      and valid_after_columns = 1
      and valid_started_columns = 1
      and present_constraints = 1 then 'present'
    else 'partial'
  end
from continuation_state
cross join constraint_state;

rollback;
`;

const PREFLIGHT_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;

do $verify$
declare
  connection_table regclass := to_regclass('public.social_connections');
  privilege text;
begin
  if connection_table is null then
    raise exception 'social_connections_missing';
  end if;
  if not exists (
    select 1
    from pg_class
    where oid = connection_table
      and relrowsecurity
  ) then
    raise exception 'social_connections_rls_invalid';
  end if;
  foreach privilege in array array['SELECT', 'INSERT', 'UPDATE', 'REFERENCES']
  loop
    if has_table_privilege('anon', connection_table, privilege)
       or has_table_privilege('authenticated', connection_table, privilege)
    then
      raise exception 'browser_table_privilege_invalid';
    end if;
  end loop;
  if exists (
    select 1
    from information_schema.table_privileges
    where table_schema = 'public'
      and table_name = 'social_connections'
      and grantee = 'PUBLIC'
  ) then
    raise exception 'public_table_privilege_invalid';
  end if;
  if not has_table_privilege('service_role', connection_table, 'SELECT')
     or not has_table_privilege('service_role', connection_table, 'UPDATE')
  then
    raise exception 'service_role_table_privilege_invalid';
  end if;
end
$verify$;

select 'META_CONVERSATION_CONTINUATION_PREFLIGHT=PASS';
rollback;
`;

const POSTFLIGHT_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;

do $verify$
declare
  connection_table regclass := to_regclass('public.social_connections');
  continuation_after_attnum smallint;
  continuation_started_attnum smallint;
  continuation_constraint text;
  managed_column text;
  privilege text;
begin
  if connection_table is null then
    raise exception 'social_connections_missing';
  end if;
  if not exists (
    select 1
    from pg_class
    where oid = connection_table
      and relrowsecurity
  ) then
    raise exception 'social_connections_rls_invalid';
  end if;

  select attnum into continuation_after_attnum
  from pg_attribute
  where attrelid = connection_table
    and attname = 'messenger_sync_continuation_after'
    and atttypid = 'text'::regtype
    and not attnotnull
    and not attisdropped;
  select attnum into continuation_started_attnum
  from pg_attribute
  where attrelid = connection_table
    and attname = 'messenger_sync_continuation_started_at'
    and atttypid = 'timestamptz'::regtype
    and not attnotnull
    and not attisdropped;
  if continuation_after_attnum is null
     or continuation_started_attnum is null then
    raise exception 'continuation_column_contract_invalid';
  end if;
  if exists (
    select 1
    from pg_attrdef
    where adrelid = connection_table
      and adnum in (continuation_after_attnum, continuation_started_attnum)
  ) then
    raise exception 'continuation_column_default_invalid';
  end if;

  select pg_get_constraintdef(oid) into continuation_constraint
  from pg_constraint
  where conrelid = connection_table
    and conname = 'social_connections_messenger_sync_continuation_check'
    and contype = 'c'
    and convalidated;
  if continuation_constraint is null
     or continuation_constraint not like '%messenger_sync_continuation_after IS NULL%'
     or continuation_constraint not like '%messenger_sync_continuation_started_at IS NULL%'
     or continuation_constraint not like '%messenger_sync_continuation_after IS NOT NULL%'
     or continuation_constraint not like '%messenger_sync_continuation_started_at IS NOT NULL%'
     or continuation_constraint not like '%length(messenger_sync_continuation_after) >= 1%'
     or continuation_constraint not like '%length(messenger_sync_continuation_after) <= 2048%'
     or continuation_constraint not like '%^[A-Za-z0-9._~+/=-]+$%' then
    raise exception 'continuation_constraint_invalid';
  end if;

  foreach managed_column in array array[
    'messenger_sync_continuation_after',
    'messenger_sync_continuation_started_at'
  ]
  loop
    foreach privilege in array array['SELECT', 'INSERT', 'UPDATE', 'REFERENCES']
    loop
      if has_column_privilege(
           'anon', connection_table, managed_column, privilege
         )
         or has_column_privilege(
           'authenticated', connection_table, managed_column, privilege
         ) then
        raise exception 'browser_continuation_privilege_invalid';
      end if;
    end loop;
    if not has_column_privilege(
         'service_role', connection_table, managed_column, 'SELECT'
       )
       or not has_column_privilege(
         'service_role', connection_table, managed_column, 'UPDATE'
       ) then
      raise exception 'service_role_continuation_privilege_invalid';
    end if;
  end loop;

  if exists (
    select 1
    from information_schema.column_privileges
    where table_schema = 'public'
      and table_name = 'social_connections'
      and column_name in (
        'messenger_sync_continuation_after',
        'messenger_sync_continuation_started_at'
      )
      and grantee = 'PUBLIC'
  ) then
    raise exception 'public_continuation_privilege_invalid';
  end if;
end
$verify$;

select 'META_CONVERSATION_CONTINUATION_POSTFLIGHT=PASS';
rollback;
`;

function fail(code) {
  throw new Error(`META_CONVERSATION_CONTINUATION_ERROR=${code}`);
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
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

export function evaluateMetaConversationContinuationMigrationSql(sql) {
  if (typeof sql !== "string") fail("migration_unreadable");
  const digest = createHash("sha256").update(sql).digest("hex");
  if (digest !== EXPECTED_MIGRATION_SHA256) {
    fail("migration_checksum_mismatch");
  }
  const required = [
    /alter table public\.social_connections[\s\S]*add column if not exists messenger_sync_continuation_after text/iu,
    /add column if not exists messenger_sync_continuation_started_at timestamptz/iu,
    /add constraint social_connections_messenger_sync_continuation_check[\s\S]*length\(messenger_sync_continuation_after\) between 1 and 2048/iu,
    /revoke select \([\s\S]*messenger_sync_continuation_after[\s\S]*from public, anon, authenticated/iu,
    /revoke insert \([\s\S]*from public, anon, authenticated/iu,
    /revoke update \([\s\S]*from public, anon, authenticated/iu,
    /revoke references \([\s\S]*from public, anon, authenticated/iu,
  ];
  const forbidden = [
    /\bgrant\b/iu,
    /\bdrop\s+(?:table|schema|database)\b/iu,
    /\btruncate\b/iu,
    /\bdelete\s+from\b/iu,
    /\binsert\s+into\b/iu,
    /\bupdate\s+public\./iu,
  ];
  if (
    required.some((contract) => !contract.test(sql)) ||
    !sql.includes(
      "messenger_sync_continuation_after ~ '^[A-Za-z0-9._~+/=-]+$'",
    ) ||
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
  const result = evaluateMetaConversationContinuationMigrationSql(sql);
  console.log(`META_CONVERSATION_CONTINUATION_MIGRATION_ID=${result.migrationId}`);
  console.log("META_CONVERSATION_CONTINUATION_CHECKSUM=verified");
  console.log("META_CONVERSATION_CONTINUATION_CONTRACT=verified");
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
      join(tmpdir(), "fanmind-meta-continuation-"),
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
      error.message.startsWith("META_CONVERSATION_CONTINUATION_ERROR=")
    ) {
      throw error;
    }
    fail("passfile_read_failed");
  } finally {
    content?.fill(0);
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function psqlEnvironment(environment, passfilePath) {
  const safe = {
    ...environment,
    PGPASSFILE: passfilePath,
    PGCONNECT_TIMEOUT: "10",
  };
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

function ensurePsqlAvailable() {
  const result = spawnSync("psql", ["--version"], {
    encoding: "utf8",
    stdio: ["ignore", "ignore", "ignore"],
  });
  if (result.error || result.status !== 0) fail("psql_unavailable");
  console.log("META_CONVERSATION_CONTINUATION_PSQL=available");
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
    ],
    {
      env: psqlEnvironment(environment, passfilePath),
      input: sql,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
}

function requireSuccessfulPsql(result, marker, errorCode) {
  if (
    result.error ||
    result.status !== 0 ||
    (marker && !result.stdout.includes(marker))
  ) {
    fail(errorCode);
  }
  return result.stdout;
}

function continuationState(environment, passfilePath) {
  const output = requireSuccessfulPsql(
    runPsql(STATE_SQL, environment, passfilePath),
    "META_CONVERSATION_CONTINUATION_STATE=",
    "state_probe_failed",
  );
  if (output.includes("META_CONVERSATION_CONTINUATION_STATE=absent")) {
    return "absent";
  }
  if (output.includes("META_CONVERSATION_CONTINUATION_STATE=present")) {
    return "present";
  }
  if (output.includes("META_CONVERSATION_CONTINUATION_STATE=partial")) {
    return "partial";
  }
  fail("state_probe_invalid");
}

function runDatabaseMode(mode, migrationSql, environment) {
  const policyMode = mode === "--apply" ? "apply" : "verify";
  const evaluation = evaluateMetaConversationContinuationStagingEnvironment(
    environment,
    { mode: policyMode },
  );
  if (!evaluation.ok) fail("environment_invalid");
  ensurePsqlAvailable();
  const { snapshotDirectory, snapshotPath } =
    privatePassfileSnapshot(environment);
  try {
    const state = continuationState(environment, snapshotPath);
    if (state === "partial") fail("existing_schema_invalid");
    if (mode === "--apply" && state === "absent") {
      requireSuccessfulPsql(
        runPsql(PREFLIGHT_SQL, environment, snapshotPath),
        "META_CONVERSATION_CONTINUATION_PREFLIGHT=PASS",
        "preflight_failed",
      );
      console.log("META_CONVERSATION_CONTINUATION_PREFLIGHT=PASS");
      console.log(
        "META_CONVERSATION_CONTINUATION_PREFLIGHT_TRANSACTION=ROLLED_BACK",
      );
      const applySql = `begin;\n${migrationSql}\ncommit;\n`;
      requireSuccessfulPsql(
        runPsql(applySql, environment, snapshotPath),
        "",
        "apply_failed",
      );
      console.log("META_CONVERSATION_CONTINUATION_APPLY=completed");
    } else if (mode === "--apply") {
      console.log("META_CONVERSATION_CONTINUATION_APPLY=already_current");
    } else {
      console.log("META_CONVERSATION_CONTINUATION_APPLY=not_requested");
    }

    requireSuccessfulPsql(
      runPsql(POSTFLIGHT_SQL, environment, snapshotPath),
      "META_CONVERSATION_CONTINUATION_POSTFLIGHT=PASS",
      "postflight_failed",
    );
    console.log("META_CONVERSATION_CONTINUATION_POSTFLIGHT=PASS");
    console.log("META_CONVERSATION_CONTINUATION_POSTFLIGHT_TRANSACTION=ROLLED_BACK");
    console.log("META_CONVERSATION_CONTINUATION_BROWSER_ACCESS=DENIED");
    console.log("META_CONVERSATION_CONTINUATION_ACTIVATION=disabled");
    console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
  } finally {
    rmSync(snapshotDirectory, { recursive: true, force: true });
  }
}

async function main() {
  const mode = modeFromArguments(process.argv.slice(2));
  const migrationSql = readAndVerifyMigration();
  if (mode === "--check") {
    console.log("META_CONVERSATION_CONTINUATION_MODE=check");
    console.log("META_CONVERSATION_CONTINUATION_READY=YES");
    return;
  }
  console.log(
    `META_CONVERSATION_CONTINUATION_MODE=${mode === "--apply" ? "apply" : "verify"}`,
  );
  runDatabaseMode(mode, migrationSql, process.env);
  console.log("META_CONVERSATION_CONTINUATION_READY=YES");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    if (
      error instanceof Error &&
      /^META_CONVERSATION_CONTINUATION_ERROR=[a-z0-9_]+$/u.test(
        error.message,
      )
    ) {
      console.error(error.message);
    } else {
      console.error("META_CONVERSATION_CONTINUATION_ERROR=unexpected_failure");
    }
    console.error("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
    process.exitCode = 1;
  });
}

export {
  EXPECTED_MIGRATION_SHA256,
  MIGRATION_ID,
  POSTFLIGHT_SQL,
  PREFLIGHT_SQL,
  STATE_SQL,
};
