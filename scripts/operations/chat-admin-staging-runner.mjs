#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { evaluateChatAdminStagingControlEnvironment } from "../../src/lib/chatAdminStagingControlPolicy.mjs";

export const SQL_PATH =
  "supabase/controlled/20260927200000_chat_admin_character_fans.sql";
export const SQL_SHA256 =
  "36990f58521e3986542f5b9b206af93f9fa4a6e6439352b4b11ead7685e4275a";

export const CHAT_ADMIN_POSTFLIGHT_SQL = String.raw`\set ON_ERROR_STOP on
begin;
set transaction read only;
do $verify$
declare
  base_present integer;
  extension_markers integer;
  rls_enabled integer;
  base_policy_count integer;
  base_policy_valid integer;
  policy_count integer;
  policy_valid integer;
  schema_mismatch integer;
  constraint_mismatch integer;
  index_mismatch integer;
  trigger_mismatch integer;
  identity_mismatch integer;
  function_body_mismatch integer;
  base_function_mismatch integer;
  function_privilege_mismatch integer;
  table_privilege_mismatch integer;
  fan_insert_grant_mismatch integer;
  authenticated_conversation_message_write_grant_mismatch integer;
  readiness_mismatch integer;
begin
  select count(*) into base_present
  from (values
    (to_regclass('public.workspace_chat_admin_capabilities') is not null),
    (to_regclass('public.chat_characters') is not null),
    (to_regclass('public.chat_character_conversations') is not null),
    (to_regclass('public.chat_character_messages') is not null),
    (to_regprocedure('public.is_current_chat_admin_workspace(uuid)') is not null)
  ) as required(ok)
  where ok;

  if base_present <> 5 then
    raise exception 'CHAT_ADMIN_SCHEMA_STATE=PARTIAL';
  end if;

  select count(*) into extension_markers
  from (values
    (to_regclass('public.chat_character_fans') is not null),
    (exists(select 1 from information_schema.columns where table_schema='public' and table_name='chat_character_conversations' and column_name='fan_id')),
    (exists(select 1 from information_schema.columns where table_schema='public' and table_name='chat_character_messages' and column_name='fan_id')),
    (exists(select 1 from information_schema.columns where table_schema='public' and table_name='chat_character_messages' and column_name='sequence')),
    (exists(select 1 from information_schema.columns where table_schema='public' and table_name='chat_character_messages' and column_name='generation_id')),
    (to_regprocedure('public.create_chat_admin_fan(uuid,uuid,uuid,jsonb)') is not null),
    (to_regprocedure('public.persist_chat_admin_generation(uuid,uuid,uuid,uuid,integer,integer,uuid,uuid[],text,text[])') is not null),
    (to_regprocedure('public.persist_chat_admin_confirmed_reply(uuid,uuid,uuid,uuid,integer,integer,uuid,text)') is not null),
    (to_regprocedure('public.chat_admin_fan_schema_ready()') is not null)
  ) as required(ok)
  where ok;

  if extension_markers = 0 then
    raise notice 'CHAT_ADMIN_SCHEMA_STATE=ABSENT';
    return;
  end if;

  if extension_markers <> 9 then
    raise exception 'CHAT_ADMIN_SCHEMA_STATE=PARTIAL';
  end if;

  with expected(table_name, column_name, type_name, not_null) as (
    values
      ('chat_character_fans','id','uuid',true),
      ('chat_character_fans','workspace_id','uuid',true),
      ('chat_character_fans','character_id','uuid',true),
      ('chat_character_fans','display_name','text',true),
      ('chat_character_fans','handle','text',false),
      ('chat_character_fans','platform','text',true),
      ('chat_character_fans','language','text',false),
      ('chat_character_fans','status','text',true),
      ('chat_character_fans','summary','text',true),
      ('chat_character_fans','notes','text',true),
      ('chat_character_fans','creation_id','uuid',true),
      ('chat_character_fans','revision','integer',true),
      ('chat_character_fans','created_at','timestamp with time zone',true),
      ('chat_character_fans','updated_at','timestamp with time zone',true),
      ('chat_character_messages','sequence','bigint',true),
      ('chat_character_messages','generation_id','uuid',false)
  ), actual as (
    select
      c.relname::text as table_name,
      a.attname::text as column_name,
      format_type(a.atttypid, a.atttypmod)::text as type_name,
      a.attnotnull as not_null
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public'
      and c.relname in ('chat_character_fans','chat_character_conversations','chat_character_messages')
      and a.attnum > 0
      and not a.attisdropped
      and a.attname in ('id','workspace_id','character_id','display_name','handle','platform','language','status','summary','notes','creation_id','revision','created_at','updated_at','fan_id','sequence','generation_id')
  ), mismatch as (
    (select * from expected except select * from actual)
    union all
    (select * from actual where table_name='chat_character_fans' and column_name in ('id','workspace_id','character_id','display_name','handle','platform','language','status','summary','notes','creation_id','revision','created_at','updated_at') except select * from expected where table_name='chat_character_fans')
  )
  select count(*) into schema_mismatch from mismatch;

  with expected(table_name, contype, definition) as (
    values
      ('chat_character_fans','p','primarykeyid'),
      ('chat_character_fans','u','uniqueworkspace_id,character_id,id'),
      ('chat_character_fans','u','uniqueworkspace_id,character_id,creation_id'),
      ('chat_character_fans','f','foreignkeyworkspace_id,character_idreferenceschat_charactersworkspace_id,idondeletecascade'),
      ('chat_character_fans','c','checkrevision>0'),
      ('chat_character_fans','c','checkstatus=anyarray[''active'',''inactive'']'),
      ('chat_character_conversations','f','foreignkeyworkspace_id,character_id,fan_idreferenceschat_character_fansworkspace_id,character_id,idondeletecascade'),
      ('chat_character_messages','f','foreignkeyworkspace_id,character_id,fan_id,conversation_idreferenceschat_character_conversationsworkspace_id,character_id,fan_id,idondeletecascade')
  ), actual as (
    select
      c.relname::text as table_name,
      con.contype::text as contype,
      regexp_replace(
        replace(replace(lower(pg_get_constraintdef(con.oid, true)), 'public.', ''), '::text', ''),
        '[[:space:]()]',
        '',
        'g'
      ) as definition
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('chat_character_fans','chat_character_conversations','chat_character_messages')
  ), mismatch as (
    select * from expected
    except
    select * from actual
  )
  select count(*) into constraint_mismatch from mismatch;

  with indexes as (
    select
      tablename,
      indexname,
      regexp_replace(lower(indexdef),'[[:space:]]+','','g') as normalized
    from pg_indexes
    where schemaname='public'
      and tablename in ('chat_character_conversations','chat_character_messages')
  )
  select count(*) into index_mismatch
  from (
    select 1 where not exists (
      select 1 from indexes
      where tablename='chat_character_conversations'
        and indexname='chat_character_conversations_one_per_fan'
        and normalized like '%createuniqueindexchat_character_conversations_one_per_fanonpublic.chat_character_conversationsusingbtree(workspace_id,character_id,fan_id)where(fan_idisnotnull)%'
    )
    union all
    select 1 where not exists (
      select 1 from indexes
      where tablename='chat_character_conversations'
        and indexname='chat_character_conversations_fan_identity'
        and normalized like '%createuniqueindexchat_character_conversations_fan_identityonpublic.chat_character_conversationsusingbtree(workspace_id,character_id,fan_id,id)%'
    )
    union all
    select 1 where not exists (
      select 1 from indexes
      where tablename='chat_character_messages'
        and indexname='chat_character_messages_generation_once'
        and normalized like '%createuniqueindexchat_character_messages_generation_onceonpublic.chat_character_messagesusingbtree(workspace_id,character_id,fan_id,conversation_id,generation_id)%'
        and normalized like '%where((direction=''fan_inbound''::text)and(generation_idisnotnull))%'
    )
    union all
    select 1 where not exists (
      select 1 from indexes
      where tablename='chat_character_messages'
        and indexname='chat_character_messages_confirmation_once'
        and normalized like '%createuniqueindexchat_character_messages_confirmation_onceonpublic.chat_character_messagesusingbtree(workspace_id,character_id,fan_id,conversation_id,generation_id)%'
        and normalized like '%where((direction=''confirmed_reply''::text)and(generation_idisnotnull))%'
    )
  ) checks;

  select count(*) into trigger_mismatch
  from (
    select 1 where not exists (select 1 from pg_trigger where tgname='require_chat_admin_conversation_fan' and tgrelid='public.chat_character_conversations'::regclass and not tgisinternal)
    union all
    select 1 where not exists (select 1 from pg_trigger where tgname='require_chat_admin_message_fan' and tgrelid='public.chat_character_messages'::regclass and not tgisinternal)
    union all
    select 1 where not exists (select 1 from pg_trigger where tgname='create_chat_admin_fan_conversation_after_insert' and tgrelid='public.chat_character_fans'::regclass and not tgisinternal)
  ) checks;

  select count(*) into identity_mismatch
  from information_schema.columns
  where table_schema='public' and table_name='chat_character_messages' and column_name='sequence'
    and data_type='bigint' and is_identity='YES' and identity_generation='ALWAYS';
  identity_mismatch := case when identity_mismatch = 1 then 0 else 1 end;

  select count(*) into rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname='public'
    and c.relname in ('chat_character_fans','chat_character_conversations','chat_character_messages')
    and c.relrowsecurity;

  select count(*) into policy_valid
  from (
    select
      policyname,
      tablename,
      cmd,
      roles,
      regexp_replace(replace(lower(coalesce(qual, '')), 'public.', ''), '[[:space:]()]', '', 'g') as q,
      regexp_replace(replace(lower(coalesce(with_check, '')), 'public.', ''), '[[:space:]()]', '', 'g') as wc
    from pg_policies
    where schemaname='public'
      and tablename in ('chat_character_fans','chat_character_conversations','chat_character_messages')
  ) p
  where roles = '{authenticated}'::name[]
    and (
      (tablename='chat_character_fans' and cmd='ALL' and q='is_current_chat_admin_workspaceworkspace_id' and wc='is_current_chat_admin_workspaceworkspace_id')
      or (tablename='chat_character_conversations' and cmd='ALL' and q='is_current_chat_admin_workspaceworkspace_id' and wc like '%fan_idisnotnull%' and wc like '%existsselect1fromchat_character_fansfwheref.workspace_id=chat_character_conversations.workspace_idandf.character_id=chat_character_conversations.character_idandf.id=chat_character_conversations.fan_id%')
      or (tablename='chat_character_messages' and cmd='ALL' and q='is_current_chat_admin_workspaceworkspace_id' and wc like '%fan_idisnotnull%' and wc like '%existsselect1fromchat_character_conversationscwherec.workspace_id=chat_character_messages.workspace_idandc.character_id=chat_character_messages.character_idandc.fan_id=chat_character_messages.fan_idandc.id=chat_character_messages.conversation_id%')
    );

  select count(*) into base_policy_count
  from pg_policies
  where schemaname='public'
    and tablename in ('workspace_chat_admin_capabilities','chat_characters');

  select count(*) into base_policy_valid
  from (
    select
      policyname,
      tablename,
      cmd,
      roles,
      regexp_replace(replace(lower(coalesce(qual, '')), 'public.', ''), '[[:space:]()]', '', 'g') as q,
      regexp_replace(replace(lower(coalesce(with_check, '')), 'public.', ''), '[[:space:]()]', '', 'g') as wc
    from pg_policies
    where schemaname='public'
      and tablename in ('workspace_chat_admin_capabilities','chat_characters')
  ) p
  where roles = '{authenticated}'::name[]
    and (
      (policyname='chat_admin_capability_owner_read' and tablename='workspace_chat_admin_capabilities' and cmd='SELECT' and wc = '' and q like '%chat_admin_multi_character%' and q like '%granted_to_user_id=auth.uid%' and q like '%owner_user_id=auth.uid%')
      or (policyname='chat_admin_characters_owner_all' and tablename='chat_characters' and cmd='ALL' and q like '%is_current_chat_admin_workspaceworkspace_id%' and wc like '%is_current_chat_admin_workspaceworkspace_id%' and wc like '%created_by_user_id=auth.uid%')
    );

  select count(*) into policy_count
  from pg_policies
  where schemaname='public'
    and tablename in ('chat_character_fans','chat_character_conversations','chat_character_messages');

  with expected(grantee, table_name, privilege_type) as (
    values
      ('authenticated', 'chat_character_fans', 'SELECT'),
      ('authenticated', 'chat_character_fans', 'UPDATE'),
      ('authenticated', 'chat_character_fans', 'DELETE'),
      ('authenticated', 'chat_character_conversations', 'SELECT'),
      ('authenticated', 'chat_character_messages', 'SELECT'),
      ('service_role', 'chat_character_fans', 'SELECT'),
      ('service_role', 'chat_character_fans', 'UPDATE'),
      ('service_role', 'chat_character_fans', 'DELETE'),
      ('service_role', 'chat_character_conversations', 'SELECT'),
      ('service_role', 'chat_character_conversations', 'INSERT'),
      ('service_role', 'chat_character_conversations', 'UPDATE'),
      ('service_role', 'chat_character_conversations', 'DELETE'),
      ('service_role', 'chat_character_messages', 'SELECT'),
      ('service_role', 'chat_character_messages', 'INSERT'),
      ('service_role', 'chat_character_messages', 'UPDATE'),
      ('service_role', 'chat_character_messages', 'DELETE')
  ), actual as (
    select grantee, table_name, privilege_type
    from information_schema.table_privileges
    where table_schema='public'
      and table_name in ('chat_character_fans','chat_character_conversations','chat_character_messages')
      and grantee in ('PUBLIC','anon','authenticated','service_role')
  ), mismatch as (
    (select * from expected except select * from actual)
    union all
    (select * from actual except select * from expected)
  )
  select count(*) into table_privilege_mismatch from mismatch;

  select count(*) into fan_insert_grant_mismatch
  from information_schema.table_privileges
  where table_schema='public'
    and table_name='chat_character_fans'
    and grantee in ('PUBLIC','anon','authenticated','service_role')
    and privilege_type='INSERT';

  select count(*) into authenticated_conversation_message_write_grant_mismatch
  from information_schema.table_privileges
  where table_schema='public'
    and table_name in ('chat_character_conversations','chat_character_messages')
    and grantee='authenticated'
    and privilege_type in ('INSERT','UPDATE','DELETE');

  select count(*) into function_body_mismatch
  from (
    select 1 where not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='chat_admin_fan_schema_ready' and pg_get_function_identity_arguments(p.oid)=''
        and regexp_replace(lower(btrim(p.prosrc)), '[[:space:]]+', '', 'g') like '%to_regprocedure(''public.create_chat_admin_fan(uuid,uuid,uuid,jsonb)'')isnotnull%'
        and regexp_replace(lower(btrim(p.prosrc)), '[[:space:]]+', '', 'g') like '%to_regprocedure(''public.persist_chat_admin_generation(uuid,uuid,uuid,uuid,integer,integer,uuid,uuid[],text,text[])'')isnotnull%'
        and regexp_replace(lower(btrim(p.prosrc)), '[[:space:]]+', '', 'g') like '%to_regprocedure(''public.persist_chat_admin_confirmed_reply(uuid,uuid,uuid,uuid,integer,integer,uuid,text)'')isnotnull%'
    )
    union all
    select 1 where not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='create_chat_admin_fan'
        and pg_get_function_identity_arguments(p.oid)='target_workspace_id uuid, target_character_id uuid, target_creation_id uuid, fan_data jsonb'
        and p.prosecdef
        and array_to_string(coalesce(p.proconfig, '{}'::text[]), ',') like '%search_path=%'
    )
    union all
    select 1 where not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='persist_chat_admin_generation'
        and pg_get_function_identity_arguments(p.oid)='target_workspace_id uuid, target_character_id uuid, target_fan_id uuid, target_conversation_id uuid, target_character_revision integer, target_fan_revision integer, target_generation_id uuid, expected_history_ids uuid[], inbound_content text, suggested_contents text[]'
        and p.prosecdef
        and array_to_string(coalesce(p.proconfig, '{}'::text[]), ',') like '%search_path=%'
        and regexp_replace(lower(btrim(p.prosrc)), '[[:space:]]+', '', 'g') like '%direction=''fan_inbound''%'
        and regexp_replace(lower(btrim(p.prosrc)), '[[:space:]]+', '', 'g') like '%direction=''suggested_reply''%'
        and regexp_replace(lower(btrim(p.prosrc)), '[[:space:]]+', '', 'g') like '%chat_admin_generation_id_conflict%'
    )
    union all
    select 1 where not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='persist_chat_admin_confirmed_reply'
        and pg_get_function_identity_arguments(p.oid)='target_workspace_id uuid, target_character_id uuid, target_fan_id uuid, target_conversation_id uuid, target_character_revision integer, target_fan_revision integer, target_confirmation_id uuid, reply_content text'
        and p.prosecdef
        and array_to_string(coalesce(p.proconfig, '{}'::text[]), ',') like '%search_path=%'
        and regexp_replace(lower(btrim(p.prosrc)), '[[:space:]]+', '', 'g') like '%chat_admin_confirmation_id_conflict%'
    )
  ) checks;

  select count(*) into base_function_mismatch
  from (
    select 1 where not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_language l on l.oid = p.prolang
      where n.nspname = 'public'
        and p.proname = 'is_current_chat_admin_workspace'
        and pg_get_function_identity_arguments(p.oid) = 'target_workspace_id uuid'
        and l.lanname = 'sql'
        and p.provolatile = 's'
        and not p.prosecdef
        and array_to_string(coalesce(p.proconfig, '{}'::text[]), ',') like '%search_path=%'
        and regexp_replace(lower(btrim(p.prosrc)), '[[:space:]]+', '', 'g') =
          'selectexists(select1frompublic.workspace_chat_admin_capabilitiescjoinpublic.workspaceswonw.id=c.workspace_idwherec.workspace_id=target_workspace_idandc.chat_admin_multi_characterandc.granted_to_user_id=auth.uid()andw.owner_user_id=auth.uid());'
    )
  ) checks;

  select count(*) into function_privilege_mismatch
  from (
    select 1 where not has_function_privilege('authenticated','public.create_chat_admin_fan(uuid,uuid,uuid,jsonb)','execute')
    union all
    select 1 where has_function_privilege('anon','public.create_chat_admin_fan(uuid,uuid,uuid,jsonb)','execute')
    union all
    select 1 where has_function_privilege('PUBLIC','public.create_chat_admin_fan(uuid,uuid,uuid,jsonb)','execute')
    union all
    select 1 where not has_function_privilege('authenticated','public.persist_chat_admin_generation(uuid,uuid,uuid,uuid,integer,integer,uuid,uuid[],text,text[])','execute')
    union all
    select 1 where has_function_privilege('anon','public.persist_chat_admin_generation(uuid,uuid,uuid,uuid,integer,integer,uuid,uuid[],text,text[])','execute')
    union all
    select 1 where has_function_privilege('PUBLIC','public.persist_chat_admin_generation(uuid,uuid,uuid,uuid,integer,integer,uuid,uuid[],text,text[])','execute')
    union all
    select 1 where not has_function_privilege('authenticated','public.persist_chat_admin_confirmed_reply(uuid,uuid,uuid,uuid,integer,integer,uuid,text)','execute')
    union all
    select 1 where has_function_privilege('anon','public.persist_chat_admin_confirmed_reply(uuid,uuid,uuid,uuid,integer,integer,uuid,text)','execute')
    union all
    select 1 where has_function_privilege('PUBLIC','public.persist_chat_admin_confirmed_reply(uuid,uuid,uuid,uuid,integer,integer,uuid,text)','execute')
    union all
    select 1 where not has_function_privilege('authenticated','public.chat_admin_fan_schema_ready()','execute')
    union all
    select 1 where has_function_privilege('anon','public.chat_admin_fan_schema_ready()','execute')
    union all
    select 1 where has_function_privilege('PUBLIC','public.chat_admin_fan_schema_ready()','execute')
    union all
    select 1 where not has_function_privilege('authenticated','public.is_current_chat_admin_workspace(uuid)','execute')
    union all
    select 1 where has_function_privilege('anon','public.is_current_chat_admin_workspace(uuid)','execute')
    union all
    select 1 where has_function_privilege('PUBLIC','public.is_current_chat_admin_workspace(uuid)','execute')
  ) checks;

  select case when
    to_regprocedure('public.create_chat_admin_fan(uuid,uuid,uuid,jsonb)') is not null
    and to_regprocedure('public.persist_chat_admin_generation(uuid,uuid,uuid,uuid,integer,integer,uuid,uuid[],text,text[])') is not null
    and to_regprocedure('public.persist_chat_admin_confirmed_reply(uuid,uuid,uuid,uuid,integer,integer,uuid,text)') is not null
    and to_regprocedure('public.chat_admin_fan_schema_ready()') is not null
    and has_function_privilege('authenticated','public.chat_admin_fan_schema_ready()','execute')
  then 0 else 1 end into readiness_mismatch;

  if rls_enabled <> 3
    or base_policy_count <> 2
    or base_policy_valid <> 2
    or policy_count <> 3
    or policy_valid <> 3
    or schema_mismatch <> 0
    or constraint_mismatch <> 0
    or index_mismatch <> 0
    or trigger_mismatch <> 0
    or identity_mismatch <> 0
    or function_body_mismatch <> 0
    or base_function_mismatch <> 0
    or function_privilege_mismatch <> 0
    or table_privilege_mismatch <> 0
    or fan_insert_grant_mismatch <> 0
    or authenticated_conversation_message_write_grant_mismatch <> 0
    or readiness_mismatch <> 0
  then
    raise exception 'CHAT_ADMIN_SCHEMA_STATE=PARTIAL';
  end if;

  raise notice 'CHAT_ADMIN_SCHEMA_STATE=VERIFIED';
end $verify$;
rollback;`;

function fail(code) {
  throw new Error(`CHAT_ADMIN_STAGING_ERROR=${code}`);
}

function run(sql, env) {
  return spawnSync(
    "psql",
    ["--no-password", "--no-psqlrc", "--quiet", "--set=ON_ERROR_STOP=1"],
    { env, input: sql, encoding: "utf8" },
  );
}

function readSchemaState(result) {
  const output = `${result.stderr ?? ""}${result.stdout ?? ""}`;
  if (result.status !== 0) {
    fail(output.includes("PARTIAL") ? "schema_partial" : "verify_failed");
  }
  if (output.includes("VERIFIED")) return "VERIFIED";
  if (output.includes("ABSENT")) return "ABSENT";
  fail("schema_state_unknown");
}

export function execute(mode, env = process.env) {
  const policyMode = mode === "apply" ? "migration" : "schema";
  if (!evaluateChatAdminStagingControlEnvironment(env, { mode: policyMode }).ok) {
    fail("environment_invalid");
  }

  const source = readFileSync(SQL_PATH, "utf8");
  if (createHash("sha256").update(source).digest("hex") !== SQL_SHA256) {
    fail("checksum_mismatch");
  }
  if (
    mode === "apply" &&
    !/^begin;[\s\S]*commit;\s*$/u.test(
      source.trim().replace(/^--.*$/gmu, "").trim(),
    )
  ) {
    fail("transaction_contract");
  }

  const directory = mkdtempSync(join(tmpdir(), "fanmind-chat-admin-"));
  const passfile = join(directory, "pgpass");
  try {
    const raw = readFileSync(env.PGPASSFILE);
    writeFileSync(passfile, raw, { mode: 0o600 });
    chmodSync(passfile, 0o600);
    const safeEnvironment = { ...env, PGPASSFILE: passfile };

    const preflightState = readSchemaState(
      run(CHAT_ADMIN_POSTFLIGHT_SQL, safeEnvironment),
    );
    if (mode === "verify") {
      console.log(`CHAT_ADMIN_SCHEMA_STATE=${preflightState}`);
      return;
    }
    if (preflightState !== "ABSENT") {
      fail(
        preflightState === "VERIFIED"
          ? "apply_requires_absent_schema"
          : "schema_partial",
      );
    }

    if (run(source, safeEnvironment).status !== 0) {
      fail("apply_failed");
    }

    const postflightState = readSchemaState(
      run(CHAT_ADMIN_POSTFLIGHT_SQL, safeEnvironment),
    );
    console.log(`CHAT_ADMIN_SCHEMA_STATE=${postflightState}`);
    if (postflightState !== "VERIFIED") {
      fail("postflight_failed");
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    const argument = process.argv[2];
    if (!["--verify", "--apply"].includes(argument)) {
      fail("argument_invalid");
    }
    execute(argument.slice(2));
  } catch (error) {
    console.error(
      error.message?.startsWith("CHAT_ADMIN_STAGING_ERROR=")
        ? error.message
        : "CHAT_ADMIN_STAGING_ERROR=unexpected_failure",
    );
    process.exitCode = 1;
  }
}
