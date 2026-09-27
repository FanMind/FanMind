#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { evaluateChatAdminStagingControlEnvironment } from "../../src/lib/chatAdminStagingControlPolicy.mjs";

export const SQL_PATH = "supabase/controlled/20260927200000_chat_admin_character_fans.sql";
export const SQL_SHA256 = "36990f58521e3986542f5b9b206af93f9fa4a6e6439352b4b11ead7685e4275a";

// Deliberately catalog-only. It emits one fixed state and never includes schema diagnostics.
export const POSTFLIGHT_SQL = String.raw`\set ON_ERROR_STOP on
begin;
set transaction read only;
do $verify$
declare
  present integer;
  mismatch integer;
begin
  select count(*) into present from (values
    (to_regclass('public.chat_character_fans') is not null),
    (exists(select 1 from information_schema.columns where table_schema='public' and table_name='chat_character_conversations' and column_name='fan_id')),
    (exists(select 1 from information_schema.columns where table_schema='public' and table_name='chat_character_messages' and column_name='fan_id')),
    (exists(select 1 from information_schema.columns where table_schema='public' and table_name='chat_character_messages' and column_name='sequence')),
    (exists(select 1 from information_schema.columns where table_schema='public' and table_name='chat_character_messages' and column_name='generation_id')),
    (to_regprocedure('public.create_chat_admin_fan(uuid,uuid,uuid,jsonb)') is not null),
    (to_regprocedure('public.persist_chat_admin_generation(uuid,uuid,uuid,uuid,integer,integer,uuid,uuid[],text,text[])') is not null),
    (to_regprocedure('public.persist_chat_admin_confirmed_reply(uuid,uuid,uuid,uuid,integer,integer,uuid,text)') is not null),
    (to_regprocedure('public.chat_admin_fan_schema_ready()') is not null)
  ) required(ok) where ok;
  if present = 0 then raise notice 'CHAT_ADMIN_FAN_SCHEMA_STATE=ABSENT'; return; end if;
  if present <> 9 then raise exception 'CHAT_ADMIN_FAN_SCHEMA_STATE=PARTIAL'; end if;

  with expected(name) as (values
    ('chat_character_fans_pkey'),('chat_character_fans_workspace_id_character_id_id_key'),
    ('chat_character_fans_workspace_id_character_id_creation_id_key'),
    ('chat_character_fans_workspace_id_character_id_fkey'),
    ('chat_character_conversations_fan_fk'),('chat_character_messages_fan_conversation_fk')
  ), actual(name) as (
    select conname::text from pg_constraint where connamespace='public'::regnamespace
      and conname in (select name from expected)
  ) select count(*) into mismatch from (select * from expected except select * from actual) missing;
  if mismatch <> 0 then raise exception 'CHAT_ADMIN_FAN_SCHEMA_STATE=PARTIAL'; end if;

  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='chat_character_fans' and c.relrowsecurity)
    or (select count(*) from pg_policies where schemaname='public' and tablename='chat_character_fans' and policyname='chat_admin_fans_owner_all' and cmd='ALL' and roles='{authenticated}'::name[]) <> 1
    or (select count(*) from pg_indexes where schemaname='public' and indexname in ('chat_character_conversations_one_per_fan','chat_character_conversations_fan_identity','chat_character_messages_generation_once','chat_character_messages_confirmation_once')) <> 4
    or has_table_privilege('anon','public.chat_character_fans','select,insert,update,delete')
    or has_table_privilege('authenticated','public.chat_character_fans','insert')
    or not has_table_privilege('authenticated','public.chat_character_fans','select,update,delete')
    or has_table_privilege('authenticated','public.chat_character_conversations','insert,update,delete')
    or has_table_privilege('authenticated','public.chat_character_messages','insert,update,delete')
    or has_function_privilege('anon','public.create_chat_admin_fan(uuid,uuid,uuid,jsonb)','execute')
    or has_function_privilege('service_role','public.create_chat_admin_fan(uuid,uuid,uuid,jsonb)','execute')
    or not has_function_privilege('authenticated','public.create_chat_admin_fan(uuid,uuid,uuid,jsonb)','execute')
    or has_function_privilege('anon','public.persist_chat_admin_generation(uuid,uuid,uuid,uuid,integer,integer,uuid,uuid[],text,text[])','execute')
    or has_function_privilege('service_role','public.persist_chat_admin_generation(uuid,uuid,uuid,uuid,integer,integer,uuid,uuid[],text,text[])','execute')
    or not has_function_privilege('authenticated','public.persist_chat_admin_generation(uuid,uuid,uuid,uuid,integer,integer,uuid,uuid[],text,text[])','execute')
    or has_function_privilege('anon','public.persist_chat_admin_confirmed_reply(uuid,uuid,uuid,uuid,integer,integer,uuid,text)','execute')
    or has_function_privilege('service_role','public.persist_chat_admin_confirmed_reply(uuid,uuid,uuid,uuid,integer,integer,uuid,text)','execute')
    or not has_function_privilege('authenticated','public.persist_chat_admin_confirmed_reply(uuid,uuid,uuid,uuid,integer,integer,uuid,text)','execute')
    or has_function_privilege('anon','public.chat_admin_fan_schema_ready()','execute')
    or has_function_privilege('service_role','public.chat_admin_fan_schema_ready()','execute')
    or not has_function_privilege('authenticated','public.chat_admin_fan_schema_ready()','execute')
  then raise exception 'CHAT_ADMIN_FAN_SCHEMA_STATE=PARTIAL'; end if;

  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('create_chat_admin_fan','persist_chat_admin_generation','persist_chat_admin_confirmed_reply') and p.prosecdef and array_to_string(coalesce(p.proconfig,'{}'),',') like '%search_path=%') <> 3
  then raise exception 'CHAT_ADMIN_FAN_SCHEMA_STATE=PARTIAL'; end if;
  raise notice 'CHAT_ADMIN_FAN_SCHEMA_STATE=VERIFIED';
end $verify$;
rollback;`;

function fail(code) { throw new Error(`CHAT_ADMIN_FAN_STAGING_ERROR=${code}`); }
function run(sql, env) {
  return spawnSync("psql", ["--no-password", "--no-psqlrc", "--quiet", "--set=ON_ERROR_STOP=1"], { env, input: sql, encoding: "utf8" });
}
function state(result) {
  const output = `${result.stderr ?? ""}${result.stdout ?? ""}`;
  if (result.status !== 0) fail(output.includes("PARTIAL") ? "schema_partial" : "verify_failed");
  if (output.includes("VERIFIED")) return "VERIFIED";
  if (output.includes("ABSENT")) return "ABSENT";
  fail("schema_state_unknown");
}

export function execute(mode, env = process.env) {
  const policyMode = mode === "apply" ? "migration" : "schema";
  if (!evaluateChatAdminStagingControlEnvironment(env, { mode: policyMode }).ok) fail("environment_invalid");
  const source = readFileSync(SQL_PATH, "utf8");
  if (createHash("sha256").update(source).digest("hex") !== SQL_SHA256) fail("checksum_mismatch");
  if (mode === "apply" && !/^begin;[\s\S]*commit;\s*$/u.test(source.trim().replace(/^--.*$/gmu, "").trim())) fail("transaction_contract");
  const directory = mkdtempSync(join(tmpdir(), "fanmind-chat-admin-fans-"));
  try {
    const passfile = join(directory, "pgpass");
    writeFileSync(passfile, readFileSync(env.PGPASSFILE), { mode: 0o600 });
    chmodSync(passfile, 0o600);
    const safeEnv = { ...env, PGPASSFILE: passfile };
    const before = state(run(POSTFLIGHT_SQL, safeEnv));
    if (mode === "verify") { console.log(`CHAT_ADMIN_FAN_SCHEMA_STATE=${before}`); return; }
    if (before !== "ABSENT") fail(before === "VERIFIED" ? "apply_requires_absent_schema" : "schema_partial");
    if (run(source, safeEnv).status !== 0) fail("apply_failed");
    const after = state(run(POSTFLIGHT_SQL, safeEnv));
    if (after !== "VERIFIED") fail("postflight_failed");
    console.log("CHAT_ADMIN_FAN_SCHEMA_STATE=VERIFIED");
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    const arg = process.argv[2];
    if (!['--verify','--apply'].includes(arg)) fail('argument_invalid');
    execute(arg.slice(2));
  } catch (error) {
    console.error(error.message?.startsWith('CHAT_ADMIN_FAN_STAGING_ERROR=') ? error.message : 'CHAT_ADMIN_FAN_STAGING_ERROR=unexpected_failure');
    process.exitCode = 1;
  }
}
