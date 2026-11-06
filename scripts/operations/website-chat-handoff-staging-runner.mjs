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
  WEBSITE_CHAT_HANDOFF_PATH,
  checkWebsiteChatHandoffMigration,
} from "./website-chat-handoff-migration-check.mjs";
import {
  evaluateWebsiteChatStagingControlEnvironment,
} from "../../src/lib/websiteChatStagingControlPolicy.mjs";

const MAX_PASSFILE_BYTES = 64 * 1024;

export const WEBSITE_CHAT_HANDOFF_POSTFLIGHT_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;

do $verify$
declare
  handoff_table oid := to_regclass('public.website_chat_handoffs');
  processing_function text := 'public.website_chat_processing_allowed(uuid)';
  legacy_message_function text := 'public.ingest_website_chat_message(uuid,text,text,uuid,text)';
  message_function text := 'public.ingest_website_chat_message_v2(uuid,text,text,uuid,text)';
  handoff_function text := 'public.request_website_chat_handoff(uuid,text,text,uuid,text,text)';
begin
  if handoff_table is null
     or not exists (
       select 1 from pg_class where oid = handoff_table and relkind = 'r' and relrowsecurity
     )
     or exists (
       select 1 from pg_policies
        where schemaname = 'public' and tablename = 'website_chat_handoffs'
     )
     or has_table_privilege('anon', handoff_table, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
     or has_table_privilege('authenticated', handoff_table, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
     or not has_table_privilege('service_role', handoff_table, 'SELECT')
     or not has_table_privilege('service_role', handoff_table, 'INSERT')
     or not has_table_privilege('service_role', handoff_table, 'UPDATE')
     or not has_table_privilege('service_role', handoff_table, 'DELETE')
     or has_table_privilege('service_role', handoff_table, 'TRUNCATE') then
    raise exception 'website_chat_handoff_table_invalid';
  end if;

  if to_regprocedure(processing_function) is null
     or to_regprocedure(legacy_message_function) is null
     or to_regprocedure(message_function) is null
     or to_regprocedure(handoff_function) is null
     or not exists (
       select 1 from pg_proc
        where oid = to_regprocedure(processing_function)
          and prosecdef
          and proconfig = array[
            'search_path=pg_catalog, public, pg_temp',
            'row_security=on'
          ]::text[]
     )
     or exists (
       select 1 from pg_proc
        where oid in (
          to_regprocedure(message_function),
          to_regprocedure(handoff_function)
        )
          and (
            prosecdef
            or proconfig is distinct from array['search_path=public, pg_temp']::text[]
          )
     )
     or has_function_privilege('anon', processing_function, 'EXECUTE')
     or has_function_privilege('authenticated', processing_function, 'EXECUTE')
     or has_function_privilege('anon', message_function, 'EXECUTE')
     or has_function_privilege('authenticated', message_function, 'EXECUTE')
     or has_function_privilege('anon', handoff_function, 'EXECUTE')
     or has_function_privilege('authenticated', handoff_function, 'EXECUTE')
     or not has_function_privilege('service_role', processing_function, 'EXECUTE')
     or not has_function_privilege('service_role', message_function, 'EXECUTE')
     or not has_function_privilege('service_role', handoff_function, 'EXECUTE')
     or exists (
       select 1
         from pg_proc as function,
              lateral aclexplode(
                coalesce(function.proacl, acldefault('f', function.proowner))
              ) as acl
       where function.oid in (
          to_regprocedure(processing_function),
          to_regprocedure(legacy_message_function),
          to_regprocedure(message_function),
          to_regprocedure(handoff_function)
        )
          and acl.grantee = 0
          and acl.privilege_type = 'EXECUTE'
     )
     or has_function_privilege(
       'anon', legacy_message_function, 'EXECUTE'
     )
     or has_function_privilege(
       'authenticated', legacy_message_function, 'EXECUTE'
     )
     or has_function_privilege('service_role', legacy_message_function, 'EXECUTE') then
    raise exception 'website_chat_handoff_function_acl_invalid';
  end if;
end
$verify$;

select 'WEBSITE_CHAT_HANDOFF_POSTFLIGHT=PASS';
rollback;
`;

function fail(code) {
  throw new Error(`WEBSITE_CHAT_HANDOFF_STAGING_ERROR=${code}`);
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
    directory = mkdtempSync(join(tmpdir(), "fanmind-website-chat-handoff-"));
    const snapshotPath = join(directory, "pgpass");
    writeFileSync(snapshotPath, content, { mode: 0o600, flag: "wx" });
    return { directory, snapshotPath };
  } catch (error) {
    if (directory) rmSync(directory, { recursive: true, force: true });
    if (error instanceof Error && error.message.startsWith("WEBSITE_CHAT_HANDOFF_STAGING_ERROR=")) throw error;
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
    ["--no-password", "--no-psqlrc", "--quiet", "--tuples-only", "--no-align", "--set=ON_ERROR_STOP=1"],
    { env: safe, input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  );
}

export function runWebsiteChatHandoffStaging(mode, environment = process.env) {
  checkWebsiteChatHandoffMigration();
  const policyMode = mode === "--apply" ? "migration" : "schema";
  if (!evaluateWebsiteChatStagingControlEnvironment(environment, { mode: policyMode }).ok) {
    fail("environment_invalid");
  }
  const version = spawnSync("psql", ["--version"], { stdio: "ignore" });
  if (version.error || version.status !== 0) fail("psql_unavailable");
  const { directory, snapshotPath } = privatePassfileSnapshot(environment);
  try {
    if (mode === "--apply") {
      const result = runPsql(readFileSync(WEBSITE_CHAT_HANDOFF_PATH, "utf8"), environment, snapshotPath);
      if (result.error || result.status !== 0) fail("apply_failed");
      console.log("WEBSITE_CHAT_HANDOFF_APPLY=completed");
    } else {
      console.log("WEBSITE_CHAT_HANDOFF_APPLY=not_requested");
    }
    const postflight = runPsql(WEBSITE_CHAT_HANDOFF_POSTFLIGHT_SQL, environment, snapshotPath);
    if (
      postflight.error || postflight.status !== 0 ||
      !postflight.stdout.includes("WEBSITE_CHAT_HANDOFF_POSTFLIGHT=PASS")
    ) fail("postflight_failed");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  console.log("WEBSITE_CHAT_HANDOFF_POSTFLIGHT=PASS");
  console.log("WEBSITE_CHAT_AI=disabled");
  console.log("WEBSITE_CHAT_EMAIL_DELIVERY=disabled");
  console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const mode = modeFromArguments(process.argv.slice(2));
    runWebsiteChatHandoffStaging(mode);
    console.log(`WEBSITE_CHAT_HANDOFF_STAGING_MODE=${mode.slice(2)}`);
    console.log("WEBSITE_CHAT_HANDOFF_STAGING_READY=YES");
  } catch (error) {
    console.error(error instanceof Error && /^WEBSITE_CHAT_HANDOFF_STAGING_ERROR=[a-z0-9_]+$/u.test(error.message) ? error.message : "WEBSITE_CHAT_HANDOFF_STAGING_ERROR=unexpected_failure");
    console.error("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
    process.exitCode = 1;
  }
}
