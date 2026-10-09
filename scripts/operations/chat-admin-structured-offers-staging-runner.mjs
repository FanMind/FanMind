#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { evaluateChatAdminStagingControlEnvironment } from "../../src/lib/chatAdminStagingControlPolicy.mjs";

export const SQL_PATH = "supabase/controlled/20261007190000_chat_admin_structured_offers.sql";
export const SQL_SHA256 = "01104f6e1e2a4edfda8ec2c50af784fad89f234ed3f0a9bfaf827eacb9803421";

export const POSTFLIGHT_SQL = String.raw`\set ON_ERROR_STOP on
begin;
set transaction read only;
do $verify$
declare
  marker_count integer;
  column_valid integer;
  constraint_valid integer;
  parent_valid integer;
  bad_rows integer;
  comment_valid integer;
  column_acl_count integer;
  default_expression text;
  default_valid boolean := false;
  expected_default jsonb := '{
    "positioning":"",
    "offers":[],
    "minimumHoursBetweenOffers":48,
    "aftercareHours":48,
    "contentBoundaries":[],
    "confirmationRequired":[],
    "noGos":[]
  }'::jsonb;
begin
  if to_regclass('public.chat_characters') is null then
    raise exception 'CHAT_ADMIN_STRUCTURED_OFFERS_SCHEMA_STATE=PARTIAL';
  end if;

  select count(*) into parent_valid
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relname='chat_characters'
    and c.relrowsecurity
    and c.relowner=(select oid from pg_roles where rolname='postgres')
    and exists (
      select 1
      from (
        select policyname,permissive,cmd,roles,
          regexp_replace(replace(lower(coalesce(qual,'')), 'public.', ''), '[[:space:]()]', '', 'g') as q,
          regexp_replace(replace(lower(coalesce(with_check,'')), 'public.', ''), '[[:space:]()]', '', 'g') as wc
        from pg_policies
        where schemaname='public' and tablename='chat_characters'
      ) p
      where p.policyname='chat_admin_characters_owner_all'
        and p.permissive='PERMISSIVE'
        and p.cmd='ALL'
        and p.roles='{authenticated}'::name[]
        and p.q='is_current_chat_admin_workspaceworkspace_id'
        and p.wc='is_current_chat_admin_workspaceworkspace_idandcreated_by_user_id=auth.uid'
    );

  if parent_valid<>1 then
    raise exception 'CHAT_ADMIN_STRUCTURED_OFFERS_SCHEMA_STATE=PARTIAL';
  end if;

  select
    (case when exists(
      select 1 from information_schema.columns
      where table_schema='public' and table_name='chat_characters' and column_name='sales_playbook'
    ) then 1 else 0 end)
    + (case when exists(
      select 1 from pg_constraint
      where conrelid='public.chat_characters'::regclass
        and conname='chat_characters_sales_playbook_object'
    ) then 1 else 0 end)
  into marker_count;

  if marker_count=0 then
    raise notice 'CHAT_ADMIN_STRUCTURED_OFFERS_SCHEMA_STATE=ABSENT';
    return;
  end if;
  if marker_count<>2 then
    raise exception 'CHAT_ADMIN_STRUCTURED_OFFERS_SCHEMA_STATE=PARTIAL';
  end if;

  select count(*) into column_valid
  from information_schema.columns
  where table_schema='public'
    and table_name='chat_characters'
    and column_name='sales_playbook'
    and data_type='jsonb'
    and is_nullable='NO';

  select pg_get_expr(d.adbin,d.adrelid) into default_expression
  from pg_attribute a
  join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
  where a.attrelid='public.chat_characters'::regclass
    and a.attname='sales_playbook'
    and not a.attisdropped;

  if default_expression is not null then
    execute 'select (' || default_expression || ') = $1::jsonb'
      into default_valid using expected_default;
  end if;

  select count(*) into constraint_valid
  from pg_constraint
  where conrelid='public.chat_characters'::regclass
    and conname='chat_characters_sales_playbook_object'
    and contype='c'
    and convalidated
    and lower(pg_get_constraintdef(oid,true)) like '%jsonb_typeof(sales_playbook) = ''object''%'
    and lower(pg_get_constraintdef(oid,true)) like '%octet_length(sales_playbook::text) <= 18000%';

  select count(*) into bad_rows
  from public.chat_characters
  where jsonb_typeof(sales_playbook)<>'object'
    or octet_length(sales_playbook::text)>18000;

  select count(*) into comment_valid
  from pg_description d
  join pg_attribute a on a.attrelid=d.objoid and a.attnum=d.objsubid
  where a.attrelid='public.chat_characters'::regclass
    and a.attname='sales_playbook'
    and d.description='Character-bound CreatorPlaybook shape from creator_sales_playbooks.rules; sales_rules remains supplemental free text.';

  select count(*) into column_acl_count
  from pg_attribute a
  cross join lateral aclexplode(a.attacl) acl
  where a.attrelid='public.chat_characters'::regclass
    and a.attname='sales_playbook'
    and acl.grantee<>(
      select relowner from pg_class where oid='public.chat_characters'::regclass
    );

  if column_valid<>1
    or not default_valid
    or constraint_valid<>1
    or bad_rows<>0
    or comment_valid<>1
    or column_acl_count<>0
  then
    raise exception 'CHAT_ADMIN_STRUCTURED_OFFERS_SCHEMA_STATE=PARTIAL';
  end if;

  raise notice 'CHAT_ADMIN_STRUCTURED_OFFERS_SCHEMA_STATE=VERIFIED';
end $verify$;
rollback;`;

function fail(code) {
  throw new Error(`CHAT_ADMIN_STRUCTURED_OFFERS_STAGING_ERROR=${code}`);
}

function run(sql, env, extraArguments = []) {
  return spawnSync(
    "psql",
    [
      "--no-password",
      "--no-psqlrc",
      "--quiet",
      "--set=ON_ERROR_STOP=1",
      ...extraArguments,
    ],
    { env, input: sql, encoding: "utf8" },
  );
}

function state(result) {
  const output = `${result.stderr ?? ""}${result.stdout ?? ""}`;
  if (result.status !== 0) fail(output.includes("PARTIAL") ? "schema_partial" : "verify_failed");
  if (output.includes("VERIFIED")) return "VERIFIED";
  if (output.includes("ABSENT")) return "ABSENT";
  fail("schema_state_unknown");
}

export function parseCharacterCount(output) {
  const count = String(output ?? "").trim();
  if (!/^\d+$/u.test(count)) fail("row_count_invalid");
  return count;
}

export function validateSqlSource(source, mode) {
  if(createHash("sha256").update(source).digest("hex")!==SQL_SHA256)fail("checksum_mismatch");
  if(mode==="apply"&&!/^begin;[\s\S]*commit;\s*$/u.test(source.trim().replace(/^--.*$/gmu,"").trim()))fail("transaction_contract");
}

export function validateApplyStartState(before) {
  if(before!=="ABSENT")fail(before==="VERIFIED"?"apply_requires_absent_schema":"schema_partial");
}

function characterCount(env) {
  const result=run(
    "\\set ON_ERROR_STOP on\nbegin;\nset transaction read only;\nselect count(*) from public.chat_characters;\nrollback;",
    env,
    ["--tuples-only", "--no-align"],
  );
  if(result.status!==0)fail("row_count_failed");
  return parseCharacterCount(result.stdout);
}

export function execute(mode, env=process.env) {
  const policyMode=mode==="apply"?"migration":"schema";
  if(!evaluateChatAdminStagingControlEnvironment(env,{mode:policyMode}).ok)fail("environment_invalid");
  const source=readFileSync(SQL_PATH,"utf8");
  validateSqlSource(source,mode);

  const directory=mkdtempSync(join(tmpdir(),"fanmind-chat-admin-structured-offers-"));
  try{
    const passfile=join(directory,"pgpass");
    writeFileSync(passfile,readFileSync(env.PGPASSFILE),{mode:0o600});
    chmodSync(passfile,0o600);
    const safeEnv={...env,PGPASSFILE:passfile};
    const before=state(run(POSTFLIGHT_SQL,safeEnv));
    if(mode==="verify"){
      console.log(`CHAT_ADMIN_STRUCTURED_OFFERS_SCHEMA_STATE=${before}`);
      console.log(`CHAT_ADMIN_STRUCTURED_OFFERS_ROW_COUNT=${characterCount(safeEnv)}`);
      return;
    }
    validateApplyStartState(before);
    const rowsBefore=characterCount(safeEnv);
    if(run(source,safeEnv).status!==0)fail("apply_failed");
    const after=state(run(POSTFLIGHT_SQL,safeEnv));
    if(after!=="VERIFIED")fail("postflight_failed");
    if(characterCount(safeEnv)!==rowsBefore)fail("row_count_changed");
    console.log("CHAT_ADMIN_STRUCTURED_OFFERS_SCHEMA_STATE=VERIFIED");
  }finally{
    rmSync(directory,{recursive:true,force:true});
  }
}

if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href){
  try{
    const arg=process.argv[2];
    if(!["--verify","--apply"].includes(arg))fail("argument_invalid");
    execute(arg.slice(2));
  }catch(error){
    console.error(error.message?.startsWith("CHAT_ADMIN_STRUCTURED_OFFERS_STAGING_ERROR=")
      ?error.message
      :"CHAT_ADMIN_STRUCTURED_OFFERS_STAGING_ERROR=unexpected_failure");
    process.exitCode=1;
  }
}
