#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluateChatAdminStagingControlEnvironment } from "../../src/lib/chatAdminStagingControlPolicy.mjs";

export const SQL_PATH = "supabase/controlled/20260920230000_chat_admin_multi_character.sql";
export const SQL_SHA256 = "9dd3674a3848303cd707aa89ad4b808c5bd9a12bfe3ff4b367e2c99121ad1e7b";
export const CHAT_ADMIN_POSTFLIGHT_SQL = String.raw`\set ON_ERROR_STOP on
begin; set transaction read only;
do $verify$ declare total int; valid int; begin
 select count(*) into total from (values
  (to_regclass('public.workspace_chat_admin_capabilities') is not null),
  (to_regclass('public.chat_characters') is not null),
  (to_regclass('public.chat_character_conversations') is not null),
  (to_regclass('public.chat_character_messages') is not null),
  (to_regprocedure('public.is_current_chat_admin_workspace(uuid)') is not null),
  (exists(select 1 from pg_indexes where schemaname='public' and indexname='one_chat_admin_workspace_global'))
 ) s(ok) where ok;
 if total=0 then raise notice 'CHAT_ADMIN_SCHEMA_STATE=ABSENT'; return; end if;
 select count(*) into valid from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('workspace_chat_admin_capabilities','chat_characters','chat_character_conversations','chat_character_messages') and c.relrowsecurity;
 if total<>6 or valid<>4
  or (select count(*) from pg_constraint where conrelid in (to_regclass('public.workspace_chat_admin_capabilities'),to_regclass('public.chat_characters'),to_regclass('public.chat_character_conversations'),to_regclass('public.chat_character_messages')) and contype in ('f','c')) < 14
  or (select count(*) from pg_policies where schemaname='public' and tablename like 'chat_%' or schemaname='public' and tablename='workspace_chat_admin_capabilities') <> 4
  or has_table_privilege('anon','public.chat_characters','select,insert,update,delete')
  or not has_table_privilege('authenticated','public.chat_characters','select,insert,update,delete')
  or has_function_privilege('anon','public.is_current_chat_admin_workspace(uuid)','execute')
  or not has_function_privilege('authenticated','public.is_current_chat_admin_workspace(uuid)','execute')
 then raise exception 'CHAT_ADMIN_SCHEMA_STATE=PARTIAL'; end if;
 raise notice 'CHAT_ADMIN_SCHEMA_STATE=VERIFIED';
end $verify$; rollback;`;

function fail(code){ throw new Error(`CHAT_ADMIN_STAGING_ERROR=${code}`); }
function run(sql, env){ return spawnSync("psql",["--no-password","--no-psqlrc","--quiet","--set=ON_ERROR_STOP=1"],{env,input:sql,encoding:"utf8"}); }
export function execute(mode, env=process.env){
 const policyMode=mode==="apply"?"migration":"schema";
 if(!evaluateChatAdminStagingControlEnvironment(env,{mode:policyMode}).ok) fail("environment_invalid");
 const source=readFileSync(SQL_PATH,"utf8");
 if(createHash("sha256").update(source).digest("hex")!==SQL_SHA256) fail("checksum_mismatch");
 if(mode==="apply" && !/^begin;[\s\S]*commit;\s*$/u.test(source.trim().replace(/^--.*$/gmu,"").trim())) fail("transaction_contract");
 const dir=mkdtempSync(join(tmpdir(),"fanmind-chat-admin-")); const pass=join(dir,"pgpass");
 try { const raw=readFileSync(env.PGPASSFILE); writeFileSync(pass,raw,{mode:0o600}); chmodSync(pass,0o600); const safe={...env,PGPASSFILE:pass};
  if(mode==="apply" && run(source,safe).status!==0) fail("apply_failed");
  const result=run(CHAT_ADMIN_POSTFLIGHT_SQL,safe); if(result.status!==0) fail(result.stderr.includes("PARTIAL")?"schema_partial":"verify_failed");
  const output=result.stderr+result.stdout; const state=output.includes("VERIFIED")?"VERIFIED":output.includes("ABSENT")?"ABSENT":"PARTIAL";
  console.log(`CHAT_ADMIN_SCHEMA_STATE=${state}`); if(mode==="apply"&&state!=="VERIFIED") fail("postflight_failed");
 } finally { rmSync(dir,{recursive:true,force:true}); }
}
if(import.meta.url===new URL(`file://${process.argv[1]}`).href){try{const arg=process.argv[2]; if(!["--verify","--apply"].includes(arg))fail("argument_invalid"); execute(arg.slice(2));}catch(e){console.error(e.message?.startsWith("CHAT_ADMIN_STAGING_ERROR=")?e.message:"CHAT_ADMIN_STAGING_ERROR=unexpected_failure");process.exitCode=1;}}
