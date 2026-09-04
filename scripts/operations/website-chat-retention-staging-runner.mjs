#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  closeSync, constants, fstatSync, mkdtempSync, openSync,
  readFileSync, readSync, rmSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  WEBSITE_CHAT_RETENTION_PATH,
  checkWebsiteChatRetentionMigration,
} from "./website-chat-retention-migration-check.mjs";
import {
  evaluateWebsiteChatRetentionStagingEnvironment,
} from "../../src/lib/websiteChatRetentionStagingPolicy.mjs";

const MAX_PASSFILE_BYTES = 64 * 1024;

export const WEBSITE_CHAT_RETENTION_POSTFLIGHT_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;

do $verify$
declare
  retention_function oid := to_regprocedure(
    'public.manage_website_chat_retention(integer,boolean,uuid)'
  );
  guarded_table regclass;
begin
  if retention_function is null
     or to_regprocedure(
       'public.manage_website_chat_retention(integer,boolean)'
     ) is not null
     or (
       select count(*)
         from pg_proc as function
         join pg_namespace as namespace on namespace.oid = function.pronamespace
        where namespace.nspname = 'public'
          and function.proname = 'manage_website_chat_retention'
     ) <> 1
     or not exists (
       select 1
         from pg_proc
        where oid = retention_function
          and proowner = to_regrole('postgres')
          and not prosecdef
          and proconfig = array['search_path=public, pg_temp']::text[]
     )
     or has_function_privilege('anon', retention_function, 'EXECUTE')
     or has_function_privilege('authenticated', retention_function, 'EXECUTE')
     or not has_function_privilege('service_role', retention_function, 'EXECUTE')
     or not exists (
       select 1 from pg_roles
        where rolname = 'service_role'
          and rolbypassrls
     )
     or not has_table_privilege(
       'service_role', 'public.website_chat_visitor_sessions', 'SELECT'
     )
     or not has_table_privilege(
       'service_role', 'public.website_chat_visitor_sessions', 'DELETE'
     )
     or not has_table_privilege(
       'service_role', 'public.website_chat_message_receipts', 'SELECT'
     )
     or not has_table_privilege(
       'service_role', 'public.website_chat_handoffs', 'SELECT'
     )
     or has_table_privilege(
       'service_role', 'public.website_chat_visitor_sessions', 'TRUNCATE'
     )
     or exists (
       select 1
         from pg_proc as function,
              lateral aclexplode(
                coalesce(function.proacl, acldefault('f', function.proowner))
              ) as acl
        where function.oid = retention_function
          and acl.privilege_type = 'EXECUTE'
          and acl.grantee <> all(array[
            to_regrole('postgres')::oid,
            to_regrole('service_role')::oid
          ])
     )
     or not exists (
       select 1
         from pg_constraint
        where conrelid = 'public.website_chat_message_receipts'::regclass
          and confrelid = 'public.website_chat_visitor_sessions'::regclass
          and contype = 'f' and confdeltype = 'c'
     )
     or not exists (
       select 1
         from pg_constraint
        where conrelid = 'public.website_chat_handoffs'::regclass
          and confrelid = 'public.website_chat_visitor_sessions'::regclass
          and contype = 'f' and confdeltype = 'c'
     ) then
    raise exception 'website_chat_retention_schema_invalid';
  end if;

  foreach guarded_table in array array[
    'public.website_chat_visitor_sessions'::regclass,
    'public.website_chat_message_receipts'::regclass,
    'public.website_chat_handoffs'::regclass
  ] loop
    if not exists (
         select 1 from pg_class
          where oid = guarded_table
            and relrowsecurity
       )
       or has_table_privilege(
         'anon', guarded_table, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'
       )
       or has_table_privilege(
         'authenticated', guarded_table, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'
       ) then
      raise exception 'website_chat_retention_browser_table_boundary_invalid';
    end if;
  end loop;
end
$verify$;

set local role service_role;
do $dry_run$
declare result record;
begin
  select * into result
    from public.manage_website_chat_retention(
      1,
      false,
      '00000000-0000-4000-8000-000000000001'::uuid
    );
  if result.candidate_session_count <> 0
     or result.candidate_receipt_count <> 0
     or result.candidate_handoff_count <> 0
     or result.deleted_session_count <> 0
     or result.has_more is not false then
    raise exception 'website_chat_retention_postflight_dry_run_invalid';
  end if;
end
$dry_run$;
reset role;

select 'WEBSITE_CHAT_RETENTION_POSTFLIGHT=PASS';
rollback;
`;

function fail(code) {
  throw new Error(`WEBSITE_CHAT_RETENTION_STAGING_ERROR=${code}`);
}

function modeFromArguments(args) {
  const known = new Set(["--verify", "--apply"]);
  if (args.length !== 1 || !known.has(args[0])) fail("argument_invalid");
  return args[0];
}

function privatePassfileSnapshot(environment) {
  const sourcePath = environment.PGPASSFILE?.trim();
  if (!sourcePath || !isAbsolute(sourcePath)) fail("passfile_missing");
  let descriptor;
  let directory;
  let content;
  try {
    descriptor = openSync(sourcePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const opened = fstatSync(descriptor);
    if (
      !opened.isFile() || (opened.mode & 0o777) !== 0o600 ||
      opened.size < 1 || opened.size > MAX_PASSFILE_BYTES ||
      (typeof process.getuid === "function" && opened.uid !== process.getuid())
    ) fail("passfile_invalid");
    content = Buffer.alloc(opened.size);
    let offset = 0;
    while (offset < content.length) {
      const count = readSync(descriptor, content, offset, content.length - offset, offset);
      if (count === 0) fail("passfile_read_failed");
      offset += count;
    }
    const settled = fstatSync(descriptor);
    if (
      settled.dev !== opened.dev || settled.ino !== opened.ino ||
      settled.size !== opened.size || settled.mtimeMs !== opened.mtimeMs ||
      settled.ctimeMs !== opened.ctimeMs
    ) fail("passfile_changed");
    directory = mkdtempSync(join(tmpdir(), "fanmind-website-chat-retention-"));
    const snapshotPath = join(directory, "pgpass");
    writeFileSync(snapshotPath, content, { mode: 0o600, flag: "wx" });
    return { directory, snapshotPath };
  } catch (error) {
    if (directory) rmSync(directory, { recursive: true, force: true });
    if (error instanceof Error && error.message.startsWith("WEBSITE_CHAT_RETENTION_STAGING_ERROR=")) throw error;
    fail("passfile_read_failed");
  } finally {
    content?.fill(0);
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function runPsql(sql, environment, passfilePath) {
  const safe = { ...environment, PGPASSFILE: passfilePath, PGCONNECT_TIMEOUT: "10" };
  for (const key of [
    "DATABASE_URL", "POSTGRES_URL", "SUPABASE_DB_URL", "PGHOSTADDR",
    "PGSERVICE", "PGSERVICEFILE", "PGSYSCONFDIR",
  ]) delete safe[key];
  return spawnSync(
    "psql",
    [
      "--no-password", "--no-psqlrc", "--quiet", "--tuples-only", "--no-align",
      "--set=ON_ERROR_STOP=1", "--set=VERBOSITY=sqlstate",
    ],
    { env: safe, input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  );
}

export function classifyWebsiteChatRetentionDatabaseError(stderr = "") {
  const message = String(stderr).toLowerCase();
  const rules = [
    [/(?:^|\s)08[0-9a-z]{3}(?:\s|$)/u, "database_connection_failed"],
    [/(?:^|\s)28p01(?:\s|$)/u, "database_authentication_failed"],
    [/(?:^|\s)42501(?:\s|$)/u, "database_permission_denied"],
    [/(?:^|\s)2bp01(?:\s|$)/u, "database_dependency_conflict"],
    [/(?:^|\s)42p01(?:\s|$)/u, "database_relation_missing"],
    [/(?:^|\s)42703(?:\s|$)/u, "database_column_missing"],
    [/(?:^|\s)42883(?:\s|$)/u, "database_function_missing"],
    [/(?:^|\s)42601(?:\s|$)/u, "database_syntax_error"],
    [/(?:^|\s)42710(?:\s|$)/u, "database_object_conflict"],
    [/(?:password authentication failed|no pg_hba|could not translate host name|connection refused|connection timed out|timeout expired|certificate verify failed)/u, "database_connection_failed"],
    [/permission denied/u, "database_permission_denied"],
    [/must be owner/u, "database_owner_mismatch"],
    [/cannot drop function[\s\S]*depend/u, "database_dependency_conflict"],
    [/role [\s\S]* does not exist/u, "database_role_missing"],
    [/relation [\s\S]* does not exist/u, "database_relation_missing"],
    [/column [\s\S]* does not exist/u, "database_column_missing"],
    [/function [\s\S]* does not exist/u, "database_function_missing"],
    [/syntax error/u, "database_syntax_error"],
    [/already exists/u, "database_object_conflict"],
  ];
  return rules.find(([pattern]) => pattern.test(message))?.[1] ?? "database_apply_rejected";
}

function reportSafeDatabaseError(result) {
  const stderr = typeof result?.stderr === "string" ? result.stderr : "";
  console.error(`WEBSITE_CHAT_RETENTION_DB_ERROR_CLASS=${classifyWebsiteChatRetentionDatabaseError(stderr)}`);
  const sqlState = stderr.match(/(?:error|fatal):\s+([0-9a-z]{5})(?:\s|$)/iu)?.[1];
  if (sqlState) console.error(`WEBSITE_CHAT_RETENTION_DB_SQLSTATE=${sqlState.toUpperCase()}`);
  const line = stderr.match(/psql:<stdin>:(\d+):/iu)?.[1];
  if (line) console.error(`WEBSITE_CHAT_RETENTION_DB_ERROR_LINE=${line}`);
}

export function runWebsiteChatRetentionStaging(mode, environment = process.env) {
  checkWebsiteChatRetentionMigration();
  const policyMode = mode === "--apply" ? "migration" : "schema";
  if (!evaluateWebsiteChatRetentionStagingEnvironment(environment, { mode: policyMode }).ok) {
    fail("environment_invalid");
  }
  const version = spawnSync("psql", ["--version"], { stdio: "ignore" });
  if (version.error || version.status !== 0) fail("psql_unavailable");
  const { directory, snapshotPath } = privatePassfileSnapshot(environment);
  try {
    if (mode === "--apply") {
      const result = runPsql(readFileSync(WEBSITE_CHAT_RETENTION_PATH, "utf8"), environment, snapshotPath);
      if (result.error || result.status !== 0) {
        reportSafeDatabaseError(result);
        fail("apply_failed");
      }
      console.log("WEBSITE_CHAT_RETENTION_APPLY=completed");
    } else {
      console.log("WEBSITE_CHAT_RETENTION_APPLY=not_requested");
    }
    const postflight = runPsql(WEBSITE_CHAT_RETENTION_POSTFLIGHT_SQL, environment, snapshotPath);
    if (
      postflight.error || postflight.status !== 0 ||
      !postflight.stdout.includes("WEBSITE_CHAT_RETENTION_POSTFLIGHT=PASS")
    ) fail("postflight_failed");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  console.log("WEBSITE_CHAT_RETENTION_POSTFLIGHT=PASS");
  console.log("WEBSITE_CHAT_RETENTION_SCHEDULE=disabled");
  console.log("WEBSITE_CHAT_AI=disabled");
  console.log("WEBSITE_CHAT_EMAIL_DELIVERY=disabled");
  console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const mode = modeFromArguments(process.argv.slice(2));
    runWebsiteChatRetentionStaging(mode);
    console.log(`WEBSITE_CHAT_RETENTION_STAGING_MODE=${mode.slice(2)}`);
    console.log("WEBSITE_CHAT_RETENTION_STAGING_READY=YES");
  } catch (error) {
    console.error(error instanceof Error && /^WEBSITE_CHAT_RETENTION_STAGING_ERROR=[a-z0-9_]+$/u.test(error.message) ? error.message : "WEBSITE_CHAT_RETENTION_STAGING_ERROR=unexpected_failure");
    console.error("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
    process.exitCode = 1;
  }
}
