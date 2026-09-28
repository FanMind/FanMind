#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { evaluateChatAdminStagingControlEnvironment } from "../../src/lib/chatAdminStagingControlPolicy.mjs";

export const SQL_PATH = "supabase/controlled/20260927200000_chat_admin_character_fans.sql";
export const SQL_SHA256 = "36990f58521e3986542f5b9b206af93f9fa4a6e6439352b4b11ead7685e4275a";

// Bind expected routine bodies to the checksum-pinned SQL source.
const controlledSql = readFileSync(SQL_PATH, "utf8");
function expectedFunctionSource(name) {
  const pattern = "create function public\\." + name + "\\([\\s\\S]*? as \\$\\$([\\s\\S]*?)\\$\\$;";
  const match = controlledSql.match(new RegExp(pattern, "u"));
  if (!match) throw new Error("missing controlled function: " + name);
  return "'" + match[1].replaceAll("'", "''") + "'";
}

// Deliberately catalog-only. It emits one fixed state and never includes schema diagnostics.
export const POSTFLIGHT_SQL = String.raw`\set ON_ERROR_STOP on
begin;
set transaction read only;
do $verify$
declare
  base_present integer;
  extension_markers integer;
  rls_enabled integer;
  base_policy_count integer;
  base_policy_valid integer;
  base_persistence_policy_count integer;
  base_persistence_policy_valid integer;
  policy_count integer;
  policy_valid integer;
  schema_mismatch integer;
  column_default_mismatch integer;
  rpc_contract_mismatch integer;
  constraint_mismatch integer;
  foreign_key_trigger_mismatch integer;
  index_mismatch integer;
  trigger_mismatch integer;
  identity_mismatch integer;
  function_body_mismatch integer;
  exact_function_mismatch integer;
  base_function_mismatch integer;
  function_privilege_mismatch integer;
  table_privilege_mismatch integer;
  base_table_privilege_mismatch integer;
  protected_column_privilege_mismatch integer;
  definer_owner_mismatch integer;
  fan_insert_grant_mismatch integer;
  authenticated_conversation_message_write_grant_mismatch integer;
  readiness_mismatch integer;
  base_rls_enabled integer;
  base_workspace_index_mismatch integer;
  unique_message_index_mismatch integer;
  binding_default_mismatch integer;
  table_owner_mismatch integer;
  persistence_mismatch integer;
  conversation_unique_index_mismatch integer;
  persistence_constraint_mismatch integer;
  persistence_default_mismatch integer;
  routine_acl_mismatch integer;
  fan_unique_index_mismatch integer;
  role_security_mismatch integer;
  rewrite_rule_mismatch integer;
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
    raise exception 'CHAT_ADMIN_FAN_SCHEMA_STATE=PARTIAL';
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
    (to_regprocedure('public.chat_admin_fan_schema_ready()') is not null),
    (to_regprocedure('public.require_chat_admin_fan_binding()') is not null),
    (to_regprocedure('public.create_chat_admin_fan_conversation()') is not null),
    (exists(select 1 from pg_trigger where tgname='require_chat_admin_conversation_fan' and tgrelid='public.chat_character_conversations'::regclass and not tgisinternal)),
    (exists(select 1 from pg_trigger where tgname='require_chat_admin_message_fan' and tgrelid='public.chat_character_messages'::regclass and not tgisinternal)),
    (exists(select 1 from pg_trigger where tgname='create_chat_admin_fan_conversation_after_insert' and tgrelid=to_regclass('public.chat_character_fans') and not tgisinternal))
  ) as required(ok)
  where ok;

  -- The parent ChatAdmin authority must be intact even when the fan extension is ABSENT.
  select count(*) into base_rls_enabled
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relname in ('workspace_chat_admin_capabilities','chat_characters','chat_character_conversations','chat_character_messages')
    and c.relrowsecurity;

  select count(*) into base_policy_count from pg_policies
  where schemaname='public' and tablename in ('workspace_chat_admin_capabilities','chat_characters');

  select count(*) into base_policy_valid
  from (
    select policyname,permissive,tablename,cmd,roles,
      regexp_replace(replace(lower(coalesce(qual,'')), 'public.', ''), '[[:space:]()]', '', 'g') as q,
      regexp_replace(replace(lower(coalesce(with_check,'')), 'public.', ''), '[[:space:]()]', '', 'g') as wc
    from pg_policies where schemaname='public'
      and tablename in ('workspace_chat_admin_capabilities','chat_characters')
  ) p
  where roles='{authenticated}'::name[]
    and (
      (policyname='chat_admin_capability_owner_read' and permissive='PERMISSIVE' and tablename='workspace_chat_admin_capabilities' and cmd='SELECT' and wc=''
       and q in ('chat_admin_multi_characterandgranted_to_user_id=auth.uidandexistsselect1fromworkspaceswwherew.id=workspace_idandw.owner_user_id=auth.uid','chat_admin_multi_characterandgranted_to_user_id=auth.uidandexistsselect1fromworkspaceswwherew.id=workspace_chat_admin_capabilities.workspace_idandw.owner_user_id=auth.uid'))
      or (policyname='chat_admin_characters_owner_all' and permissive='PERMISSIVE' and tablename='chat_characters' and cmd='ALL'
       and q='is_current_chat_admin_workspaceworkspace_id'
       and wc='is_current_chat_admin_workspaceworkspace_idandcreated_by_user_id=auth.uid')
    );

  select count(*) into base_persistence_policy_count
  from pg_policies
  where schemaname='public' and tablename in ('chat_character_conversations','chat_character_messages');

  select count(*) into base_persistence_policy_valid
  from (
    select policyname,permissive,tablename,cmd,roles,
      regexp_replace(replace(lower(coalesce(qual,'')), 'public.', ''), '[[:space:]()]', '', 'g') as q,
      regexp_replace(replace(lower(coalesce(with_check,'')), 'public.', ''), '[[:space:]()]', '', 'g') as wc
    from pg_policies where schemaname='public'
      and tablename in ('chat_character_conversations','chat_character_messages')
  ) p
  where roles='{authenticated}'::name[] and permissive='PERMISSIVE' and cmd='ALL'
    and q='is_current_chat_admin_workspaceworkspace_id'
    and wc='is_current_chat_admin_workspaceworkspace_id'
    and ((tablename='chat_character_conversations' and policyname='chat_admin_conversations_owner_all')
      or (tablename='chat_character_messages' and policyname='chat_admin_messages_owner_all'));

  select count(*) into table_owner_mismatch
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relname in ('workspace_chat_admin_capabilities','chat_characters','chat_character_conversations','chat_character_messages')
    and c.relowner<>(select oid from pg_roles where rolname='postgres');

  select count(*) into base_function_mismatch from (
    select 1 where not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
      where n.nspname='public' and p.proname='is_current_chat_admin_workspace'
        and pg_get_function_identity_arguments(p.oid)='target_workspace_id uuid'
        and pg_get_function_result(p.oid)='boolean' and l.lanname='sql' and p.provolatile='s'
        and not p.prosecdef and coalesce(p.proconfig,'{}')=array['search_path=""']::text[]
        and regexp_replace(lower(btrim(p.prosrc)), '[[:space:]]+', '', 'g')=
          'selectexists(select1frompublic.workspace_chat_admin_capabilitiescjoinpublic.workspaceswonw.id=c.workspace_idwherec.workspace_id=target_workspace_idandc.chat_admin_multi_characterandc.granted_to_user_id=auth.uid()andw.owner_user_id=auth.uid());'
    )
  ) checks;

  if base_rls_enabled<>4 or base_policy_count<>2 or base_policy_valid<>2 or base_function_mismatch<>0
    or not has_function_privilege('authenticated','public.is_current_chat_admin_workspace(uuid)','execute')
    or has_function_privilege('anon','public.is_current_chat_admin_workspace(uuid)','execute')
    or has_function_privilege('service_role','public.is_current_chat_admin_workspace(uuid)','execute')
  then raise exception 'CHAT_ADMIN_FAN_SCHEMA_STATE=PARTIAL'; end if;
  if table_owner_mismatch<>0 then raise exception 'CHAT_ADMIN_FAN_SCHEMA_STATE=PARTIAL'; end if;
  select count(*) into role_security_mismatch
  from pg_roles where rolname='authenticated' and (rolsuper or rolbypassrls);
  if role_security_mismatch<>0 then raise exception 'CHAT_ADMIN_FAN_SCHEMA_STATE=PARTIAL'; end if;
  if extension_markers=0 and (base_persistence_policy_count<>2 or base_persistence_policy_valid<>2)
  then raise exception 'CHAT_ADMIN_FAN_SCHEMA_STATE=PARTIAL'; end if;

  select case when exists (
    select 1 from pg_index ix
    join pg_class i on i.oid=ix.indexrelid
    join pg_namespace ns on ns.oid=i.relnamespace
    join pg_am am on am.oid=i.relam
    where ns.nspname='public' and i.relname='one_chat_admin_workspace_global'
      and ix.indrelid='public.workspace_chat_admin_capabilities'::regclass
      and ix.indisunique and ix.indisvalid and ix.indisready and ix.indislive and am.amname='btree'
      and right(regexp_replace(lower(pg_get_indexdef(i.oid,0,true)), '[[:space:]()]', '', 'g'),
        length('usingbtreechat_admin_multi_characterwherechat_admin_multi_character'))
        ='usingbtreechat_admin_multi_characterwherechat_admin_multi_character'
  )
    then 0 else 1 end into base_workspace_index_mismatch;
  if base_workspace_index_mismatch<>0 then raise exception 'CHAT_ADMIN_FAN_SCHEMA_STATE=PARTIAL'; end if;

  with expected(grantee, table_name, privilege_type, fan_absent_only) as (values
    ('authenticated','workspace_chat_admin_capabilities','SELECT',false),
    ('authenticated','chat_characters','SELECT',false),('authenticated','chat_characters','INSERT',false),
    ('authenticated','chat_characters','UPDATE',false),('authenticated','chat_characters','DELETE',false),
    ('authenticated','chat_character_conversations','SELECT',false),('authenticated','chat_character_conversations','INSERT',true),
    ('authenticated','chat_character_conversations','UPDATE',true),('authenticated','chat_character_conversations','DELETE',true),
    ('authenticated','chat_character_messages','SELECT',false),('authenticated','chat_character_messages','INSERT',true),
    ('authenticated','chat_character_messages','UPDATE',true),('authenticated','chat_character_messages','DELETE',true),
    ('service_role','workspace_chat_admin_capabilities','SELECT',false),('service_role','workspace_chat_admin_capabilities','INSERT',false),
    ('service_role','workspace_chat_admin_capabilities','UPDATE',false),('service_role','workspace_chat_admin_capabilities','DELETE',false),
    ('service_role','chat_characters','SELECT',false),('service_role','chat_characters','INSERT',false),
    ('service_role','chat_characters','UPDATE',false),('service_role','chat_characters','DELETE',false),
    ('service_role','chat_character_conversations','SELECT',false),('service_role','chat_character_conversations','INSERT',false),
    ('service_role','chat_character_conversations','UPDATE',false),('service_role','chat_character_conversations','DELETE',false),
    ('service_role','chat_character_messages','SELECT',false),('service_role','chat_character_messages','INSERT',false),
    ('service_role','chat_character_messages','UPDATE',false),('service_role','chat_character_messages','DELETE',false)
  ), actual as (
    select grantee, table_name, privilege_type from information_schema.table_privileges
    where table_schema='public'
      and table_name in ('workspace_chat_admin_capabilities','chat_characters','chat_character_conversations','chat_character_messages')
      and grantee in ('PUBLIC','anon','authenticated','service_role')
  ), mismatch as (
    (select grantee,table_name,privilege_type from expected where not fan_absent_only or extension_markers=0 except select * from actual)
    union all (select * from actual except select grantee,table_name,privilege_type from expected where not fan_absent_only or extension_markers=0)
  ) select count(*) into base_table_privilege_mismatch from mismatch;

  select count(*) into protected_column_privilege_mismatch
  from pg_attribute a
  join pg_class c on c.oid=a.attrelid
  join pg_namespace n on n.oid=c.relnamespace
  cross join lateral aclexplode(a.attacl) column_acl
  where n.nspname='public' and a.attnum>0 and not a.attisdropped
    and c.relname in ('workspace_chat_admin_capabilities','chat_characters','chat_character_fans','chat_character_conversations','chat_character_messages')
    and (column_acl.grantee=0 or column_acl.grantee in (select oid from pg_roles where rolname in ('anon','authenticated','service_role')));

  if base_table_privilege_mismatch<>0 or protected_column_privilege_mismatch<>0
  then raise exception 'CHAT_ADMIN_FAN_SCHEMA_STATE=PARTIAL'; end if;

  if extension_markers = 0 then
    raise notice 'CHAT_ADMIN_FAN_SCHEMA_STATE=ABSENT';
    return;
  end if;

  if extension_markers <> 14 then
    raise exception 'CHAT_ADMIN_FAN_SCHEMA_STATE=PARTIAL';
  end if;

  select count(*) into table_owner_mismatch
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relname in ('workspace_chat_admin_capabilities','chat_characters','chat_character_fans','chat_character_conversations','chat_character_messages')
    and c.relowner<>(select oid from pg_roles where rolname='postgres');
  select count(*) into persistence_mismatch
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relname in ('chat_character_fans','chat_character_conversations','chat_character_messages')
    and c.relpersistence<>'p';
  persistence_mismatch := persistence_mismatch + case when exists (
    select 1 from pg_class t join pg_namespace n on n.oid=t.relnamespace
    join pg_attribute a on a.attrelid=t.oid and a.attname='sequence'
    join pg_depend d on d.refobjid=t.oid and d.refobjsubid=a.attnum and d.classid='pg_class'::regclass and d.refclassid='pg_class'::regclass and d.deptype='i'
    join pg_class seq on seq.oid=d.objid and seq.relkind='S'
    where n.nspname='public' and t.relname='chat_character_messages' and seq.relpersistence<>'p'
  ) then 1 else 0 end;
  if table_owner_mismatch<>0 or persistence_mismatch<>0
  then raise exception 'CHAT_ADMIN_FAN_SCHEMA_STATE=PARTIAL'; end if;

  with expected(table_name, column_name, type_name, not_null) as (
    values
      ('chat_character_conversations','id','uuid',true),
      ('chat_character_conversations','workspace_id','uuid',true),
      ('chat_character_conversations','character_id','uuid',true),
      ('chat_character_conversations','fan_reference','text',true),
      ('chat_character_conversations','created_at','timestamp with time zone',true),
      ('chat_character_conversations','updated_at','timestamp with time zone',true),
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
      ('chat_character_conversations','fan_id','uuid',false),
      ('chat_character_messages','id','uuid',true),
      ('chat_character_messages','workspace_id','uuid',true),
      ('chat_character_messages','character_id','uuid',true),
      ('chat_character_messages','conversation_id','uuid',true),
      ('chat_character_messages','direction','text',true),
      ('chat_character_messages','content','text',true),
      ('chat_character_messages','character_revision','integer',true),
      ('chat_character_messages','created_at','timestamp with time zone',true),
      ('chat_character_messages','fan_id','uuid',false),
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
  ), mismatch as (
    (select * from expected except select * from actual)
    union all (select * from actual except select * from expected)
  )
  select count(*) into schema_mismatch from mismatch;

  with expected(column_name, default_expression) as (values
    ('id','gen_random_uuid()'),('workspace_id',''),('character_id',''),
    ('display_name',''),('handle',''),('platform',''),('language',''),
    ('status',$expr$'active'::text$expr$),('summary',$expr$''::text$expr$),('notes',$expr$''::text$expr$),
    ('creation_id',''),('revision','1'),('created_at','now()'),('updated_at','now()')
  ), actual as (
    select a.attname::text,
      coalesce(regexp_replace(lower(pg_get_expr(d.adbin,d.adrelid)), '[[:space:]()]', '', 'g'),'') as default_expression
    from pg_attribute a
    join pg_class c on c.oid=a.attrelid
    join pg_namespace n on n.oid=c.relnamespace
    left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where n.nspname='public' and c.relname='chat_character_fans'
      and a.attnum>0 and not a.attisdropped
  ), mismatch as (
    (select column_name, regexp_replace(lower(default_expression), '[[:space:]()]', '', 'g') from expected
     except select attname, default_expression from actual)
    union all
    (select attname, default_expression from actual
     except select column_name, regexp_replace(lower(default_expression), '[[:space:]()]', '', 'g') from expected)
  ) select count(*) into column_default_mismatch from mismatch;
  column_default_mismatch := column_default_mismatch + abs(
    (select count(*) from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relname='chat_character_fans' and a.attnum>0 and not a.attisdropped) - 14
  );
  select count(*) into binding_default_mismatch
  from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
  left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
  where n.nspname='public'
    and ((c.relname='chat_character_conversations' and a.attname='fan_id')
      or (c.relname='chat_character_messages' and a.attname='fan_id'))
    and (d.oid is not null or a.attgenerated<>'');

  with expected(table_name,column_name,default_expression) as (values
    ('chat_character_conversations','id','gen_random_uuid()'),
    ('chat_character_conversations','workspace_id',''),
    ('chat_character_conversations','character_id',''),
    ('chat_character_conversations','fan_reference',''),
    ('chat_character_conversations','created_at','now()'),
    ('chat_character_conversations','updated_at','now()'),
    ('chat_character_conversations','fan_id',''),
    ('chat_character_messages','id','gen_random_uuid()'),
    ('chat_character_messages','workspace_id',''),
    ('chat_character_messages','character_id',''),
    ('chat_character_messages','conversation_id',''),
    ('chat_character_messages','direction',''),
    ('chat_character_messages','content',''),
    ('chat_character_messages','character_revision',''),
    ('chat_character_messages','created_at','now()'),
    ('chat_character_messages','fan_id',''),
    ('chat_character_messages','sequence',''),
    ('chat_character_messages','generation_id','')
  ), actual as (
    select c.relname::text,a.attname::text,
      coalesce(regexp_replace(lower(pg_get_expr(d.adbin,d.adrelid)), '[[:space:]()]', '', 'g'),'')
    from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
    left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where n.nspname='public' and c.relname in ('chat_character_conversations','chat_character_messages')
      and a.attnum>0 and not a.attisdropped
  ), mismatch as (
    (select table_name,column_name,regexp_replace(lower(default_expression), '[[:space:]()]', '', 'g') from expected
      except select * from actual)
    union all
    (select * from actual except select table_name,column_name,regexp_replace(lower(default_expression), '[[:space:]()]', '', 'g') from expected)
  ) select count(*) into persistence_default_mismatch from mismatch;

  with expected(table_name, contype, definition) as (
    values
      ('chat_character_fans','p','primarykeyid'),
      ('chat_character_fans','u','uniqueworkspace_id,character_id,id'),
      ('chat_character_fans','u','uniqueworkspace_id,character_id,creation_id'),
      ('chat_character_fans','f','foreignkeyworkspace_id,character_idreferenceschat_charactersworkspace_id,idondeletecascade'),
      ('chat_character_fans','c','checkchar_lengthbtrimdisplay_name>=1andchar_lengthbtrimdisplay_name<=120'),
      ('chat_character_fans','c','checkhandleisnullorchar_lengthbtrimhandle>=1andchar_lengthbtrimhandle<=120'),
      ('chat_character_fans','c','checkchar_lengthbtrimplatform>=1andchar_lengthbtrimplatform<=40'),
      ('chat_character_fans','c','checklanguageisnullorchar_lengthbtrimlanguage>=1andchar_lengthbtrimlanguage<=40'),
      ('chat_character_fans','c','checkrevision>0'),
      ('chat_character_fans','c','checkstatus=anyarray[''active'',''inactive'']'),
      ('chat_character_fans','c','checkchar_lengthsummary<=4000'),
      ('chat_character_fans','c','checkchar_lengthnotes<=4000'),
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
      and con.convalidated and not con.condeferrable and not con.condeferred
  ), mismatch as (
    select * from expected
    except
    select * from actual
  )
  select count(*) into constraint_mismatch from mismatch;
  constraint_mismatch := constraint_mismatch + case
    when (select count(*) from pg_constraint
      where conrelid='public.chat_character_fans'::regclass
        and contype in ('p','u','f','c')
        and convalidated and not condeferrable and not condeferred)=12
    then 0 else 1 end;
  with expected(table_name,constraint_name,contype,definition) as (values
    ('chat_character_conversations','chat_character_conversations_pkey','p','primarykeyid'),
    ('chat_character_conversations','chat_character_conversations_workspace_id_character_id_id_key','u','uniqueworkspace_id,character_id,id'),
    ('chat_character_conversations','chat_character_conversations_workspace_id_character_id_fkey','f','foreignkeyworkspace_id,character_idreferenceschat_charactersworkspace_id,idondeletecascade'),
    ('chat_character_conversations','chat_character_conversations_fan_fk','f','foreignkeyworkspace_id,character_id,fan_idreferenceschat_character_fansworkspace_id,character_id,idondeletecascade'),
    ('chat_character_messages','chat_character_messages_pkey','p','primarykeyid'),
    ('chat_character_messages','chat_character_messages_direction_check','c','checkdirection=anyarray[''fan_inbound'',''suggested_reply'',''confirmed_reply'']'),
    ('chat_character_messages','chat_character_messages_content_check','c','checkchar_lengthcontent>=1andchar_lengthcontent<=4000'),
    ('chat_character_messages','chat_character_messages_character_revision_check','c','checkcharacter_revision>0'),
    ('chat_character_messages','chat_character_messages_workspace_id_character_id_conversation_','f','foreignkeyworkspace_id,character_id,conversation_idreferenceschat_character_conversationsworkspace_id,character_id,idondeletecascade'),
    ('chat_character_messages','chat_character_messages_fan_conversation_fk','f','foreignkeyworkspace_id,character_id,fan_id,conversation_idreferenceschat_character_conversationsworkspace_id,character_id,fan_id,idondeletecascade')
  ), actual as (
    select c.relname::text,con.conname::text,con.contype::text,
      regexp_replace(replace(replace(lower(pg_get_constraintdef(con.oid,true)),'public.',''),'::text',''),'[[:space:]()]','','g')
    from pg_constraint con join pg_class c on c.oid=con.conrelid
    where con.conrelid in ('public.chat_character_conversations'::regclass,'public.chat_character_messages'::regclass)
  ), mismatch as (
    (select * from expected except select * from actual)
    union all (select * from actual except select * from expected)
  ) select count(*) into persistence_constraint_mismatch from mismatch;
  persistence_constraint_mismatch := persistence_constraint_mismatch + (
    select count(*) from pg_constraint con
    where con.conrelid in ('public.chat_character_conversations'::regclass,'public.chat_character_messages'::regclass)
      and (not con.convalidated or con.condeferrable or con.condeferred)
  );
  select count(*) into rewrite_rule_mismatch
  from pg_rewrite r join pg_class c on c.oid=r.ev_class
  where c.oid in ('public.chat_character_conversations'::regclass,'public.chat_character_messages'::regclass)
    and r.rulename<>'_RETURN';

  select count(*) into foreign_key_trigger_mismatch
  from (values
    ('chat_character_fans_workspace_id_character_id_fkey'::text),
    ('chat_character_conversations_fan_fk'::text),
    ('chat_character_messages_fan_conversation_fk'::text)
  ) as required(constraint_name)
  where not exists (
    select 1 from pg_constraint c
    where c.conname=required.constraint_name and c.contype='f' and c.convalidated
      and (select count(*) from pg_trigger t where t.tgconstraint=c.oid and t.tgisinternal)=4
      and not exists (select 1 from pg_trigger t where t.tgconstraint=c.oid and t.tgisinternal and t.tgenabled<>'O')
  );

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
        and exists(select 1 from pg_class ic join pg_namespace ns on ns.oid=ic.relnamespace join pg_index ix on ix.indexrelid=ic.oid where ns.nspname='public' and ic.relname=indexname and ix.indisvalid and ix.indisready)
        and normalized = 'createuniqueindexchat_character_conversations_one_per_fanonpublic.chat_character_conversationsusingbtree(workspace_id,character_id,fan_id)where(fan_idisnotnull)'
    )
    union all
    select 1 where not exists (
      select 1 from indexes
      where tablename='chat_character_conversations'
        and indexname='chat_character_conversations_fan_identity'
        and exists(select 1 from pg_class ic join pg_namespace ns on ns.oid=ic.relnamespace join pg_index ix on ix.indexrelid=ic.oid where ns.nspname='public' and ic.relname=indexname and ix.indisvalid and ix.indisready)
        and normalized = 'createuniqueindexchat_character_conversations_fan_identityonpublic.chat_character_conversationsusingbtree(workspace_id,character_id,fan_id,id)'
    )
    union all
    select 1 where not exists (
      select 1 from indexes
      where tablename='chat_character_messages'
        and indexname='chat_character_messages_generation_once'
        and exists(select 1 from pg_class ic join pg_namespace ns on ns.oid=ic.relnamespace join pg_index ix on ix.indexrelid=ic.oid where ns.nspname='public' and ic.relname=indexname and ix.indisvalid and ix.indisready)
        and normalized = 'createuniqueindexchat_character_messages_generation_onceonpublic.chat_character_messagesusingbtree(workspace_id,character_id,fan_id,conversation_id,generation_id)where((direction=''fan_inbound''::text)and(generation_idisnotnull))'
    )
    union all
    select 1 where not exists (
      select 1 from indexes
      where tablename='chat_character_messages'
        and indexname='chat_character_messages_confirmation_once'
        and exists(select 1 from pg_class ic join pg_namespace ns on ns.oid=ic.relnamespace join pg_index ix on ix.indexrelid=ic.oid where ns.nspname='public' and ic.relname=indexname and ix.indisvalid and ix.indisready)
        and normalized = 'createuniqueindexchat_character_messages_confirmation_onceonpublic.chat_character_messagesusingbtree(workspace_id,character_id,fan_id,conversation_id,generation_id)where((direction=''confirmed_reply''::text)and(generation_idisnotnull))'
    )
  ) checks;
  select count(*) into unique_message_index_mismatch
  from pg_index ix join pg_class idx on idx.oid=ix.indexrelid
  join pg_namespace ns on ns.oid=idx.relnamespace
  where ns.nspname='public' and ix.indrelid='public.chat_character_messages'::regclass and ix.indisunique
    and idx.relname not in ('chat_character_messages_pkey','chat_character_messages_generation_once','chat_character_messages_confirmation_once');
  index_mismatch := index_mismatch + unique_message_index_mismatch;
  select count(*) into conversation_unique_index_mismatch
  from pg_index ix join pg_class idx on idx.oid=ix.indexrelid
  where ix.indrelid='public.chat_character_conversations'::regclass and ix.indisunique
    and idx.relname not in ('chat_character_conversations_pkey','chat_character_conversations_workspace_id_character_id_id_key','chat_character_conversations_one_per_fan','chat_character_conversations_fan_identity');
  index_mismatch := index_mismatch + conversation_unique_index_mismatch;
  select count(*) into fan_unique_index_mismatch
  from pg_index ix join pg_class idx on idx.oid=ix.indexrelid
  where ix.indrelid='public.chat_character_fans'::regclass and ix.indisunique
    and idx.relname not in ('chat_character_fans_pkey','chat_character_fans_workspace_id_character_id_id_key','chat_character_fans_workspace_id_character_id_creation_id_key');
  index_mismatch := index_mismatch + fan_unique_index_mismatch;

  select count(*) into trigger_mismatch
  from (
    select 1 where not exists (select 1 from pg_trigger where tgname='require_chat_admin_conversation_fan' and tgrelid='public.chat_character_conversations'::regclass and not tgisinternal and tgenabled='O' and tgtype=23 and tgattr::text='0' and tgfoid=to_regprocedure('public.require_chat_admin_fan_binding()') and tgqual is null)
    union all
    select 1 where not exists (select 1 from pg_trigger where tgname='require_chat_admin_message_fan' and tgrelid='public.chat_character_messages'::regclass and not tgisinternal and tgenabled='O' and tgtype=23 and tgattr::text='0' and tgfoid=to_regprocedure('public.require_chat_admin_fan_binding()') and tgqual is null)
    union all
    select 1 where not exists (select 1 from pg_trigger where tgname='create_chat_admin_fan_conversation_after_insert' and tgrelid='public.chat_character_fans'::regclass and not tgisinternal and tgenabled='O' and tgtype=5 and tgfoid=to_regprocedure('public.create_chat_admin_fan_conversation()') and tgqual is null)
    union all
    select 1 where (select count(*) from pg_trigger where tgrelid in ('public.chat_character_fans'::regclass,'public.chat_character_conversations'::regclass,'public.chat_character_messages'::regclass) and not tgisinternal) <> 3
  ) checks;

  select count(*) into identity_mismatch
  from information_schema.columns
  where table_schema='public' and table_name='chat_character_messages' and column_name='sequence'
    and data_type='bigint' and is_identity='YES' and identity_generation='ALWAYS';
  identity_mismatch := case when identity_mismatch = 1 then 0 else 1 end;
  identity_mismatch := identity_mismatch + case when exists (
    select 1 from pg_class t join pg_namespace n on n.oid=t.relnamespace
    join pg_attribute a on a.attrelid=t.oid and a.attname='sequence'
    join pg_depend d on d.refobjid=t.oid and d.refobjsubid=a.attnum and d.classid='pg_class'::regclass and d.refclassid='pg_class'::regclass and d.deptype='i'
    join pg_class seq on seq.oid=d.objid and seq.relkind='S'
    join pg_sequence s on s.seqrelid=seq.oid
    where n.nspname='public' and t.relname='chat_character_messages'
      and s.seqincrement=1 and s.seqstart=1 and s.seqmin=1 and s.seqmax=9223372036854775807 and s.seqcache=1 and not s.seqcycle
      and pg_get_serial_sequence('public.chat_character_messages','sequence')::regclass=seq.oid
  ) then 0 else 1 end;

  select count(*) into rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname='public'
    and c.relname in ('workspace_chat_admin_capabilities','chat_characters','chat_character_fans','chat_character_conversations','chat_character_messages')
    and c.relrowsecurity;

  select count(*) into policy_valid
  from (
    select
      policyname,
      permissive,
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
      (policyname='chat_admin_fans_owner_all' and permissive='PERMISSIVE' and tablename='chat_character_fans' and cmd='ALL' and q='is_current_chat_admin_workspaceworkspace_id' and wc='is_current_chat_admin_workspaceworkspace_id')
      or (policyname='chat_admin_conversations_owner_all' and permissive='PERMISSIVE' and tablename='chat_character_conversations' and cmd='ALL' and q='is_current_chat_admin_workspaceworkspace_id' and wc='fan_idisnotnullandis_current_chat_admin_workspaceworkspace_idandexistsselect1fromchat_character_fansfwheref.workspace_id=chat_character_conversations.workspace_idandf.character_id=chat_character_conversations.character_idandf.id=chat_character_conversations.fan_id')
      or (policyname='chat_admin_messages_owner_all' and permissive='PERMISSIVE' and tablename='chat_character_messages' and cmd='ALL' and q='is_current_chat_admin_workspaceworkspace_id' and wc='fan_idisnotnullandis_current_chat_admin_workspaceworkspace_idandexistsselect1fromchat_character_conversationscwherec.workspace_id=chat_character_messages.workspace_idandc.character_id=chat_character_messages.character_idandc.fan_id=chat_character_messages.fan_idandc.id=chat_character_messages.conversation_id')
    );

  select count(*) into base_policy_count
  from pg_policies
  where schemaname='public'
    and tablename in ('workspace_chat_admin_capabilities','chat_characters');

  select count(*) into base_policy_valid
  from (
    select
      policyname,
      permissive,
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
      (policyname='chat_admin_capability_owner_read' and permissive='PERMISSIVE' and tablename='workspace_chat_admin_capabilities' and cmd='SELECT' and wc = '' and q in ('chat_admin_multi_characterandgranted_to_user_id=auth.uidandexistsselect1fromworkspaceswwherew.id=workspace_idandw.owner_user_id=auth.uid','chat_admin_multi_characterandgranted_to_user_id=auth.uidandexistsselect1fromworkspaceswwherew.id=workspace_chat_admin_capabilities.workspace_idandw.owner_user_id=auth.uid'))
      or (policyname='chat_admin_characters_owner_all' and permissive='PERMISSIVE' and tablename='chat_characters' and cmd='ALL' and q='is_current_chat_admin_workspaceworkspace_id' and wc='is_current_chat_admin_workspaceworkspace_idandcreated_by_user_id=auth.uid')
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
  fan_insert_grant_mismatch := fan_insert_grant_mismatch + case
    when has_table_privilege('authenticated','public.chat_character_fans','INSERT')
      or has_any_column_privilege('authenticated','public.chat_character_fans','INSERT')
    then 1 else 0 end;

  select count(*) into authenticated_conversation_message_write_grant_mismatch
  from information_schema.table_privileges
  where table_schema='public'
    and table_name in ('chat_character_conversations','chat_character_messages')
    and grantee='authenticated'
    and privilege_type in ('INSERT','UPDATE','DELETE');
  authenticated_conversation_message_write_grant_mismatch := authenticated_conversation_message_write_grant_mismatch + (
    select count(*) from (values
      ('public.chat_character_conversations'::regclass),
      ('public.chat_character_messages'::regclass)
    ) as t(relid)
    where has_table_privilege('authenticated',relid,'INSERT')
       or has_table_privilege('authenticated',relid,'UPDATE')
       or has_table_privilege('authenticated',relid,'DELETE')
       or has_any_column_privilege('authenticated',relid,'INSERT')
       or has_any_column_privilege('authenticated',relid,'UPDATE')
       or has_any_column_privilege('authenticated',relid,'REFERENCES')
  );

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

  with expected(name, body) as (values
    ('require_chat_admin_fan_binding', ${expectedFunctionSource("require_chat_admin_fan_binding")}),
    ('create_chat_admin_fan_conversation', ${expectedFunctionSource("create_chat_admin_fan_conversation")}),
    ('create_chat_admin_fan', ${expectedFunctionSource("create_chat_admin_fan")}),
    ('persist_chat_admin_generation', ${expectedFunctionSource("persist_chat_admin_generation")}),
    ('persist_chat_admin_confirmed_reply', ${expectedFunctionSource("persist_chat_admin_confirmed_reply")}),
    ('chat_admin_fan_schema_ready', ${expectedFunctionSource("chat_admin_fan_schema_ready")})
  )
  select count(*) into exact_function_mismatch
  from expected e
  where not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname=e.name and p.prosrc=e.body
  );

  with expected(name, args, result_type, language_name, volatility, security_definer) as (values
    ('require_chat_admin_fan_binding','', 'trigger','plpgsql','v',false),
    ('create_chat_admin_fan_conversation','', 'trigger','plpgsql','v',true),
    ('create_chat_admin_fan','target_workspace_id uuid, target_character_id uuid, target_creation_id uuid, fan_data jsonb','SETOF chat_character_fans','plpgsql','v',true),
    ('persist_chat_admin_generation','target_workspace_id uuid, target_character_id uuid, target_fan_id uuid, target_conversation_id uuid, target_character_revision integer, target_fan_revision integer, target_generation_id uuid, expected_history_ids uuid[], inbound_content text, suggested_contents text[]','text[]','plpgsql','v',true),
    ('persist_chat_admin_confirmed_reply','target_workspace_id uuid, target_character_id uuid, target_fan_id uuid, target_conversation_id uuid, target_character_revision integer, target_fan_revision integer, target_confirmation_id uuid, reply_content text','SETOF chat_character_messages','plpgsql','v',true),
    ('chat_admin_fan_schema_ready','','boolean','sql','s',false)
  ), actual as (
    select p.proname::text as name, pg_get_function_identity_arguments(p.oid) as args,
      replace(pg_get_function_result(p.oid),'public.','') as result_type,
      l.lanname::text as language_name, p.provolatile::text as volatility, p.prosecdef as security_definer,
      coalesce(p.proconfig,'{}')=array['search_path=""']::text[] as empty_search_path
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
    where n.nspname='public' and p.proname in ('require_chat_admin_fan_binding','create_chat_admin_fan_conversation','create_chat_admin_fan','persist_chat_admin_generation','persist_chat_admin_confirmed_reply','chat_admin_fan_schema_ready')
  )
  select count(*) into rpc_contract_mismatch
  from expected e left join actual a on a.name=e.name
  where a.name is null or a.args<>e.args or a.result_type<>e.result_type
    or a.language_name<>e.language_name or a.volatility<>e.volatility
    or a.security_definer<>e.security_definer or not a.empty_search_path;

  select count(*) into definer_owner_mismatch
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname in ('create_chat_admin_fan_conversation','create_chat_admin_fan','persist_chat_admin_generation','persist_chat_admin_confirmed_reply')
    and (not p.prosecdef or pg_get_userbyid(p.proowner)<>'postgres');
  definer_owner_mismatch := definer_owner_mismatch + case
    when (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public'
        and p.proname in ('create_chat_admin_fan_conversation','create_chat_admin_fan','persist_chat_admin_generation','persist_chat_admin_confirmed_reply')
        and p.prosecdef)=4 then 0 else 1 end;

  select count(*) into function_privilege_mismatch
  from (
    select 1 where not has_function_privilege('authenticated','public.create_chat_admin_fan(uuid,uuid,uuid,jsonb)','execute')
    union all
    select 1 where has_function_privilege('anon','public.create_chat_admin_fan(uuid,uuid,uuid,jsonb)','execute')
    union all
    select 1 where has_function_privilege('service_role','public.create_chat_admin_fan(uuid,uuid,uuid,jsonb)','execute')
    union all
    select 1 where not has_function_privilege('authenticated','public.persist_chat_admin_generation(uuid,uuid,uuid,uuid,integer,integer,uuid,uuid[],text,text[])','execute')
    union all
    select 1 where has_function_privilege('anon','public.persist_chat_admin_generation(uuid,uuid,uuid,uuid,integer,integer,uuid,uuid[],text,text[])','execute')
    union all
    select 1 where has_function_privilege('service_role','public.persist_chat_admin_generation(uuid,uuid,uuid,uuid,integer,integer,uuid,uuid[],text,text[])','execute')
    union all
    select 1 where not has_function_privilege('authenticated','public.persist_chat_admin_confirmed_reply(uuid,uuid,uuid,uuid,integer,integer,uuid,text)','execute')
    union all
    select 1 where has_function_privilege('anon','public.persist_chat_admin_confirmed_reply(uuid,uuid,uuid,uuid,integer,integer,uuid,text)','execute')
    union all
    select 1 where has_function_privilege('service_role','public.persist_chat_admin_confirmed_reply(uuid,uuid,uuid,uuid,integer,integer,uuid,text)','execute')
    union all
    select 1 where not has_function_privilege('authenticated','public.chat_admin_fan_schema_ready()','execute')
    union all
    select 1 where has_function_privilege('anon','public.chat_admin_fan_schema_ready()','execute')
    union all
    select 1 where has_function_privilege('service_role','public.chat_admin_fan_schema_ready()','execute')
    union all
    select 1 where not has_function_privilege('authenticated','public.is_current_chat_admin_workspace(uuid)','execute')
    union all
    select 1 where has_function_privilege('anon','public.is_current_chat_admin_workspace(uuid)','execute')
  ) checks;

  with expected(signature,grantee) as (values
    ('public.create_chat_admin_fan(uuid,uuid,uuid,jsonb)','postgres'),
    ('public.create_chat_admin_fan(uuid,uuid,uuid,jsonb)','authenticated'),
    ('public.persist_chat_admin_generation(uuid,uuid,uuid,uuid,integer,integer,uuid,uuid[],text,text[])','postgres'),
    ('public.persist_chat_admin_generation(uuid,uuid,uuid,uuid,integer,integer,uuid,uuid[],text,text[])','authenticated'),
    ('public.persist_chat_admin_confirmed_reply(uuid,uuid,uuid,uuid,integer,integer,uuid,text)','postgres'),
    ('public.persist_chat_admin_confirmed_reply(uuid,uuid,uuid,uuid,integer,integer,uuid,text)','authenticated'),
    ('public.chat_admin_fan_schema_ready()','postgres'),
    ('public.chat_admin_fan_schema_ready()','authenticated'),
    ('public.create_chat_admin_fan_conversation()','postgres'),
    ('public.require_chat_admin_fan_binding()','postgres'),
    ('public.is_current_chat_admin_workspace(uuid)','postgres'),
    ('public.is_current_chat_admin_workspace(uuid)','authenticated')
  ), actual as (
    select e.signature,case when acl.grantee=0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end
    from expected e join pg_proc p on p.oid=to_regprocedure(e.signature)
    cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
    where acl.privilege_type='EXECUTE'
  ), mismatch as (
    (select * from expected except select * from actual)
    union all (select * from actual except select * from expected)
  ) select count(*) into routine_acl_mismatch from mismatch;

  select case when
    to_regprocedure('public.create_chat_admin_fan(uuid,uuid,uuid,jsonb)') is not null
    and to_regprocedure('public.persist_chat_admin_generation(uuid,uuid,uuid,uuid,integer,integer,uuid,uuid[],text,text[])') is not null
    and to_regprocedure('public.persist_chat_admin_confirmed_reply(uuid,uuid,uuid,uuid,integer,integer,uuid,text)') is not null
    and to_regprocedure('public.chat_admin_fan_schema_ready()') is not null
    and has_function_privilege('authenticated','public.chat_admin_fan_schema_ready()','execute')
  then 0 else 1 end into readiness_mismatch;

  if rls_enabled <> 5
    or base_policy_count <> 2
    or base_policy_valid <> 2
    or policy_count <> 3
    or policy_valid <> 3
    or schema_mismatch <> 0
    or column_default_mismatch <> 0
    or binding_default_mismatch <> 0
    or persistence_default_mismatch <> 0
    or constraint_mismatch <> 0
    or persistence_constraint_mismatch <> 0
    or rewrite_rule_mismatch <> 0
    or foreign_key_trigger_mismatch <> 0
    or index_mismatch <> 0
    or trigger_mismatch <> 0
    or identity_mismatch <> 0
    or function_body_mismatch <> 0
    or exact_function_mismatch <> 0
    or rpc_contract_mismatch <> 0
    or base_function_mismatch <> 0
    or function_privilege_mismatch <> 0
    or routine_acl_mismatch <> 0
    or table_privilege_mismatch <> 0
    or base_table_privilege_mismatch <> 0
    or protected_column_privilege_mismatch <> 0
    or definer_owner_mismatch <> 0
    or fan_insert_grant_mismatch <> 0
    or authenticated_conversation_message_write_grant_mismatch <> 0
    or readiness_mismatch <> 0
  then
    raise exception 'CHAT_ADMIN_FAN_SCHEMA_STATE=PARTIAL';
  end if;

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
