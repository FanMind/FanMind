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

import { evaluateWhatsAppCloudInboundStagingEnvironment } from "../../src/lib/whatsappCloudInboundStagingPolicy.mjs";
import {
  CONTROL_PATH as WORKSPACE_MEMBER_CONTROL_PATH,
  materializeWorkspaceMemberDataBoundaryPostflight,
} from "./workspace-member-data-boundary-runner.mjs";

export const CONTROL_ID =
  "20260817230000_whatsapp_cloud_inbound_foundation";
export const CONTROL_PATH = resolve(
  process.cwd(),
  `supabase/controlled/${CONTROL_ID}.sql`,
);
export const EXPECTED_CONTROL_SHA256 =
  "d41e2065b671f32e46f065259ddbe85a142fdea4b0b62769061f8d7421b0b26c";

const MAX_PASSFILE_BYTES = 64 * 1024;
const FUNCTION_SIGNATURES = Object.freeze([
  Object.freeze({
    name: "whatsapp_cloud_inbound_schema_state",
    signature: "public.whatsapp_cloud_inbound_schema_state()",
    placeholder: "__FANMIND_WHATSAPP_SCHEMA_STATE_BODY_HEX__",
  }),
  Object.freeze({
    name: "claim_whatsapp_cloud_inbound_message",
    signature:
      "public.claim_whatsapp_cloud_inbound_message(uuid,uuid,text,text,text,integer)",
    placeholder: "__FANMIND_WHATSAPP_CLAIM_BODY_HEX__",
  }),
  Object.freeze({
    name: "store_whatsapp_cloud_inbound_message",
    signature:
      "public.store_whatsapp_cloud_inbound_message(uuid,uuid,uuid,uuid,text,text,text,text,text,text,timestamp with time zone,text)",
    placeholder: "__FANMIND_WHATSAPP_STORE_BODY_HEX__",
  }),
  Object.freeze({
    name: "disconnect_whatsapp_cloud_inbound_connection",
    signature:
      "public.disconnect_whatsapp_cloud_inbound_connection(uuid,uuid)",
    placeholder: "__FANMIND_WHATSAPP_DISCONNECT_BODY_HEX__",
  }),
]);

export const STATE_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
set local search_path = pg_catalog, public, pg_temp;
with controlled_objects as (
  select to_regclass(
    'public.social_connections_active_whatsapp_phone_unique_idx'
  )::oid as object_oid
  union all
  select to_regclass(
    'public.conversation_messages_id_workspace_unique_idx'
  )::oid
  union all
  select to_regclass(
    'public.conversation_messages_whatsapp_identity_unique_idx'
  )::oid
  union all
  select to_regclass(
    'public.whatsapp_cloud_webhook_receipts_retry_idx'
  )::oid
  union all
  select to_regclass(
    'public.whatsapp_cloud_webhook_receipts_workspace_idx'
  )::oid
  union all
  select to_regclass(
    'public.whatsapp_cloud_webhook_receipts_message_workspace_idx'
  )::oid
  union all
  select to_regclass('public.whatsapp_cloud_webhook_receipts')::oid
  union all
  select to_regprocedure(
    'public.whatsapp_cloud_inbound_schema_state()'
  )::oid
  union all
  select to_regprocedure(
    'public.claim_whatsapp_cloud_inbound_message(uuid,uuid,text,text,text,integer)'
  )::oid
  union all
  select to_regprocedure(
    'public.store_whatsapp_cloud_inbound_message(uuid,uuid,uuid,uuid,text,text,text,text,text,text,timestamp with time zone,text)'
  )::oid
  union all
  select to_regprocedure(
    'public.disconnect_whatsapp_cloud_inbound_connection(uuid,uuid)'
  )::oid
), state as (
  select
    (select count(*) filter (where object_oid is not null)
       from controlled_objects) as object_count,
    (select count(*) from pg_attribute as attribute
      where attribute.attrelid = to_regclass('public.conversation_messages')
        and attribute.attname like 'whatsapp\_%' escape '\'
        and attribute.attnum > 0
        and not attribute.attisdropped) as column_count,
    (select count(*) from pg_constraint as constraint_definition
      where constraint_definition.conrelid =
            to_regclass('public.conversation_messages')
        and constraint_definition.conname in (
          'conversation_messages_whatsapp_identity_check',
          'conversation_messages_whatsapp_connection_workspace_fk'
        )) as constraint_count,
    (select count(*) from pg_policies as policy
      where policy.schemaname = 'public'
        and policy.tablename = 'conversation_messages'
        and policy.policyname like
            'conversation_messages_whatsapp_identity_%') as policy_count,
    (select count(*) from pg_proc as function_definition
      join pg_namespace as function_namespace
        on function_namespace.oid = function_definition.pronamespace
      where function_namespace.nspname = 'public'
        and function_definition.proname in (
          'whatsapp_cloud_inbound_schema_state',
          'claim_whatsapp_cloud_inbound_message',
          'store_whatsapp_cloud_inbound_message',
          'disconnect_whatsapp_cloud_inbound_connection'
        )) as function_name_count,
    case when to_regclass(
      'public.conversation_messages_whatsapp_external_message_unique_idx'
    ) is null then 0 else 1 end as legacy_index_count
)
select 'WHATSAPP_CLOUD_INBOUND_OBJECT_STATE=' ||
  case
    when object_count = 0 and column_count = 0 and constraint_count = 0
         and policy_count = 0 and function_name_count = 0
         and legacy_index_count = 0 then 'absent'
    when object_count = 11 and column_count = 3 and constraint_count = 2
         and policy_count = 2 and function_name_count = 4
         and legacy_index_count = 0 then 'present'
    else 'invalid'
  end
  from state;
rollback;
`;

export const PRECHECK_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
set local search_path = pg_catalog, public, pg_temp;

do $preflight$
begin
  if current_user <> 'postgres'
     or to_regrole('anon') is null
     or to_regrole('authenticated') is null
     or to_regrole('service_role') is null then
    raise exception 'whatsapp_cloud_database_role_invalid';
  end if;
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise exception 'whatsapp_cloud_migration_ledger_missing';
  end if;
  if exists (
    select 1 from supabase_migrations.schema_migrations
     where version = '20260817230000'
        or name in (
          '20260817230000_whatsapp_cloud_inbound_foundation',
          'whatsapp_cloud_inbound_foundation'
        )
  ) then
    raise exception 'whatsapp_cloud_in_generic_ledger';
  end if;
  if to_regclass('public.social_connections') is null
     or to_regclass('public.conversation_messages') is null then
    raise exception 'whatsapp_cloud_dependency_missing';
  end if;
  if exists (
    select 1 from public.social_connections
     where platform = 'whatsapp'
       and provider = 'meta_whatsapp_cloud'
       and status = 'connected'
       and page_id is not null
     group by page_id
    having count(*) > 1
  ) then
    raise exception 'duplicate_active_whatsapp_phone_binding';
  end if;
  if exists (
    select 1 from public.conversation_messages
     where source_platform is not distinct from 'whatsapp'
  ) then
    raise exception 'whatsapp_cloud_existing_message_requires_identity_review';
  end if;
end
$preflight$;

${STATE_SQL.replace(/\\set ON_ERROR_STOP on|begin;|set transaction read only;|set local lock_timeout = '5s';|set local statement_timeout = '30s';|set local search_path = pg_catalog, public, pg_temp;|rollback;/gu, "")}
select 'WHATSAPP_CLOUD_INBOUND_PREFLIGHT=PASS';
rollback;
`;

export const POSTFLIGHT_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
set local search_path = pg_catalog, public, pg_temp;

do $verify$
declare
  function_record record;
  expected_body_hex text;
begin
  if current_user <> 'postgres'
     or to_regclass('supabase_migrations.schema_migrations') is null
     or exists (
       select 1 from supabase_migrations.schema_migrations
        where version = '20260817230000'
           or name in (
             '20260817230000_whatsapp_cloud_inbound_foundation',
             'whatsapp_cloud_inbound_foundation'
           )
     ) then
    raise exception 'whatsapp_cloud_ledger_postflight_failed';
  end if;
  if to_regprocedure(
       'public.workspace_processing_allowed_contract(text,text,text,boolean,text,text,jsonb,timestamp with time zone)'
     ) is null
     or not exists (
       select 1 from pg_proc as member_function
       join pg_language as member_language
         on member_language.oid = member_function.prolang
      where member_function.oid = to_regprocedure(
        'public.workspace_processing_allowed_contract(text,text,text,boolean,text,text,jsonb,timestamp with time zone)'
      )
        and member_function.proowner = to_regrole('postgres')
        and member_language.lanname = 'plpgsql'
        and member_function.prokind = 'f'
        and member_function.provolatile = 's'
        and not member_function.prosecdef
        and not member_function.proretset
        and not member_function.proisstrict
        and not member_function.proleakproof
        and member_function.proparallel = 'u'
        and member_function.procost = 100
        and member_function.prorows = 0
        and member_function.prosupport = 0
        and member_function.provariadic = 0
        and member_function.protrftypes is null
        and member_function.probin is null
        and member_function.prosqlbody is null
        and member_function.prorettype = 'boolean'::regtype
        and member_function.proargtypes =
            '25 25 25 16 25 25 3802 1184'::oidvector
        and member_function.proallargtypes is null
        and member_function.proargmodes is null
        and member_function.proargnames = array[
          'p_workspace_access_mode',
          'p_subscription_effective_end_at',
          'p_billing_status',
          'p_billing_manual_override',
          'p_billing_grace_until',
          'p_billing_suspended_at',
          'p_test_access_flags',
          'p_evaluated_at'
        ]::text[]
        and member_function.pronargs = 8
        and member_function.pronargdefaults = 0
        and member_function.proargdefaults is null
        and member_function.proconfig is not distinct from
            array['search_path=pg_catalog, public, pg_temp']::text[]
        and member_function.prosrc = pg_catalog.convert_from(
          pg_catalog.decode('__FANMIND_MEMBER_PROCESSING_BODY_HEX__', 'hex'),
          'UTF8'
        )
        and coalesce((
          select count(*) = 2
             and bool_and(member_acl.privilege_type = 'EXECUTE')
             and bool_and(not member_acl.is_grantable)
             and bool_and(member_acl.grantor = member_function.proowner)
             and count(*) filter (
               where member_acl.grantee = member_function.proowner
             ) = 1
             and count(*) filter (
               where member_acl.grantee = to_regrole('authenticated')
             ) = 1
            from aclexplode(
              coalesce(
                member_function.proacl,
                acldefault('f', member_function.proowner)
              )
            ) as member_acl
        ), false)
     )
     or (
       select count(*)
         from pg_proc as member_overload
         join pg_namespace as member_namespace
           on member_namespace.oid = member_overload.pronamespace
        where member_namespace.nspname = 'public'
          and member_overload.proname =
              'workspace_processing_allowed_contract'
     ) <> 1
     or not public.workspace_processing_allowed_contract(
       'active', null, 'demo_free', false, null, null,
       '{"fixed_demo_seed_version":"2026-07-26-v1"}'::jsonb,
       timestamptz '2026-08-17 12:00:00+00'
     )
     or public.workspace_processing_allowed_contract(
       'active', null, 'cancelled', true, null, null, '{}',
       timestamptz '2026-08-17 12:00:00+00'
     ) then
    raise exception 'whatsapp_cloud_member_control_postflight_failed';
  end if;

  if (
    select count(*)
      from pg_index as definition
      join pg_class as relation on relation.oid = definition.indexrelid
     where (
       definition.indrelid = 'public.social_connections'::regclass
       and relation.relname =
           'social_connections_active_whatsapp_phone_unique_idx'
       and definition.indisunique
       and definition.indisvalid
       and definition.indisready
       and definition.indpred is not null
       and definition.indnkeyatts = 1
       and definition.indkey[0] = (
         select attnum from pg_attribute
          where attrelid = 'public.social_connections'::regclass
            and attname = 'page_id'
            and not attisdropped
       )
       and regexp_replace(
         pg_get_expr(definition.indpred, definition.indrelid),
         '[[:space:]]+|::text|[()]', '', 'g'
       ) = 'platform=''whatsapp''ANDprovider=''meta_whatsapp_cloud''ANDstatus=''connected''ANDpage_idISNOTNULL'
     ) or (
       definition.indrelid = 'public.conversation_messages'::regclass
       and relation.relname =
           'conversation_messages_whatsapp_identity_unique_idx'
       and definition.indisunique
       and definition.indisvalid
       and definition.indisready
       and definition.indpred is not null
       and definition.indnkeyatts = 3
       and definition.indkey[0] = (
         select attnum from pg_attribute
          where attrelid = 'public.conversation_messages'::regclass
            and attname = 'whatsapp_social_connection_id'
            and not attisdropped
       )
       and definition.indkey[1] = (
         select attnum from pg_attribute
          where attrelid = 'public.conversation_messages'::regclass
            and attname = 'whatsapp_phone_number_id'
            and not attisdropped
       )
       and definition.indkey[2] = (
         select attnum from pg_attribute
          where attrelid = 'public.conversation_messages'::regclass
            and attname = 'external_message_id'
            and not attisdropped
       )
       and regexp_replace(
         pg_get_expr(definition.indpred, definition.indrelid),
         '[[:space:]]+|::text|[()]', '', 'g'
       ) = 'source_platform=''whatsapp''ANDwhatsapp_social_connection_idISNOTNULLANDwhatsapp_phone_number_idISNOTNULLANDexternal_message_idISNOTNULL'
     ) or (
       definition.indrelid =
         'public.whatsapp_cloud_webhook_receipts'::regclass
       and relation.relname = 'whatsapp_cloud_webhook_receipts_retry_idx'
       and not definition.indisunique
       and definition.indisvalid
       and definition.indisready
       and definition.indpred is not null
       and definition.indnkeyatts = 2
       and definition.indkey[0] = (
         select attnum from pg_attribute
          where attrelid =
                'public.whatsapp_cloud_webhook_receipts'::regclass
            and attname = 'updated_at'
            and not attisdropped
       )
       and definition.indkey[1] = (
         select attnum from pg_attribute
          where attrelid =
                'public.whatsapp_cloud_webhook_receipts'::regclass
            and attname = 'id'
            and not attisdropped
       )
       and regexp_replace(
         pg_get_expr(definition.indpred, definition.indrelid),
         '[[:space:]]+|::text|[()]', '', 'g'
       ) = 'status=ANYARRAY[''processing'',''retryable_error'']'
     )
  ) <> 3 then
    raise exception 'whatsapp_cloud_index_postflight_failed';
  end if;

  if to_regclass(
       'public.conversation_messages_whatsapp_external_message_unique_idx'
     ) is not null
     or not exists (
       select 1 from pg_index as definition
       join pg_class as relation on relation.oid = definition.indexrelid
       join pg_am as access_method on access_method.oid = relation.relam
       where definition.indrelid = 'public.conversation_messages'::regclass
         and relation.relname =
             'conversation_messages_id_workspace_unique_idx'
         and relation.relowner = to_regrole('postgres')
         and relation.relkind = 'i'
         and access_method.amname = 'btree'
         and definition.indisunique
         and not definition.indisprimary
         and definition.indisvalid and definition.indisready
         and definition.indislive and definition.indimmediate
         and not definition.indisexclusion
         and not definition.indnullsnotdistinct
         and definition.indnkeyatts = 2 and definition.indnatts = 2
         and definition.indexprs is null and definition.indpred is null
         and definition.indkey[0] = (
           select attnum from pg_attribute where attrelid =
             'public.conversation_messages'::regclass
             and attname = 'id' and not attisdropped
         )
         and definition.indkey[1] = (
           select attnum from pg_attribute where attrelid =
             'public.conversation_messages'::regclass
             and attname = 'workspace_id' and not attisdropped
         )
     )
     or not exists (
       select 1 from pg_index as definition
       join pg_class as relation on relation.oid = definition.indexrelid
       join pg_am as access_method on access_method.oid = relation.relam
       where definition.indrelid =
             'public.whatsapp_cloud_webhook_receipts'::regclass
         and relation.relname =
             'whatsapp_cloud_webhook_receipts_workspace_idx'
         and relation.relowner = to_regrole('postgres')
         and relation.relkind = 'i'
         and access_method.amname = 'btree'
         and not definition.indisunique
         and definition.indisvalid and definition.indisready
         and definition.indislive and definition.indimmediate
         and not definition.indisexclusion
         and not definition.indnullsnotdistinct
         and definition.indnkeyatts = 1 and definition.indnatts = 1
         and definition.indexprs is null and definition.indpred is null
         and definition.indkey[0] = (
           select attnum from pg_attribute where attrelid =
             'public.whatsapp_cloud_webhook_receipts'::regclass
             and attname = 'workspace_id' and not attisdropped
         )
     )
     or not exists (
       select 1 from pg_index as definition
       join pg_class as relation on relation.oid = definition.indexrelid
       join pg_am as access_method on access_method.oid = relation.relam
       where definition.indrelid =
             'public.whatsapp_cloud_webhook_receipts'::regclass
         and relation.relname =
             'whatsapp_cloud_webhook_receipts_message_workspace_idx'
         and relation.relowner = to_regrole('postgres')
         and relation.relkind = 'i'
         and access_method.amname = 'btree'
         and not definition.indisunique
         and definition.indisvalid and definition.indisready
         and definition.indislive and definition.indimmediate
         and not definition.indisexclusion
         and not definition.indnullsnotdistinct
         and definition.indnkeyatts = 2 and definition.indnatts = 2
         and definition.indexprs is null and definition.indpred is not null
         and definition.indkey[0] = (
           select attnum from pg_attribute where attrelid =
             'public.whatsapp_cloud_webhook_receipts'::regclass
             and attname = 'conversation_message_id' and not attisdropped
         )
         and definition.indkey[1] = (
           select attnum from pg_attribute where attrelid =
             'public.whatsapp_cloud_webhook_receipts'::regclass
             and attname = 'workspace_id' and not attisdropped
         )
         and pg_get_expr(definition.indpred, definition.indrelid) =
             '(conversation_message_id IS NOT NULL)'
     ) then
    raise exception 'whatsapp_cloud_index_postflight_failed';
  end if;

  if not exists (
    select 1 from pg_class as relation
     where relation.oid = 'public.whatsapp_cloud_webhook_receipts'::regclass
       and relation.relkind = 'r'
       and relation.relowner = to_regrole('postgres')
       and relation.relrowsecurity
       and relation.relforcerowsecurity
  )
     or (
       select count(*) from pg_attribute as attribute
        where attribute.attrelid =
              'public.whatsapp_cloud_webhook_receipts'::regclass
          and attribute.attnum > 0
          and not attribute.attisdropped
     ) <> 14
     or (
       select count(*) from pg_policies as policy
        where policy.schemaname = 'public'
          and policy.tablename = 'whatsapp_cloud_webhook_receipts'
     ) <> 0
     or has_table_privilege(
       'anon', 'public.whatsapp_cloud_webhook_receipts',
       'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
     )
     or has_table_privilege(
       'authenticated', 'public.whatsapp_cloud_webhook_receipts',
       'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
     )
     or has_table_privilege(
       'service_role', 'public.whatsapp_cloud_webhook_receipts',
       'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
     )
     or exists (
       select 1 from pg_attribute as attribute
        where attribute.attrelid =
              'public.whatsapp_cloud_webhook_receipts'::regclass
          and attribute.attnum > 0 and not attribute.attisdropped
          and attribute.attacl is not null
     )
     or exists (
       select 1 from pg_trigger as trigger_definition
        where trigger_definition.tgrelid =
              'public.whatsapp_cloud_webhook_receipts'::regclass
          and not trigger_definition.tgisinternal
     )
     or not coalesce((
       select count(*) = 7
          and bool_and(table_acl.grantee = receipt_table.relowner)
          and bool_and(table_acl.grantor = receipt_table.relowner)
          and bool_and(not table_acl.is_grantable)
          and array_agg(table_acl.privilege_type order by table_acl.privilege_type)
              = array[
                'DELETE', 'INSERT', 'REFERENCES', 'SELECT', 'TRIGGER',
                'TRUNCATE', 'UPDATE'
              ]::text[]
         from pg_class as receipt_table
         cross join lateral aclexplode(
           coalesce(
             receipt_table.relacl,
             acldefault('r', receipt_table.relowner)
           )
         ) as table_acl
        where receipt_table.oid =
              'public.whatsapp_cloud_webhook_receipts'::regclass
     ), false
     ) then
    raise exception 'whatsapp_cloud_receipt_boundary_postflight_failed';
  end if;
  if (
    select array_agg(
      attribute.attname || '|' ||
      format_type(attribute.atttypid, attribute.atttypmod) || '|' ||
      attribute.attnotnull::text || '|' ||
      coalesce(
        pg_get_expr(default_definition.adbin, default_definition.adrelid),
        '<null>'
      ) || '|' || attribute.attidentity::text || '|' ||
      attribute.attgenerated::text
      order by attribute.attnum
    )
      from pg_attribute as attribute
      left join pg_attrdef as default_definition
        on default_definition.adrelid = attribute.attrelid
       and default_definition.adnum = attribute.attnum
     where attribute.attrelid =
           'public.whatsapp_cloud_webhook_receipts'::regclass
       and attribute.attnum > 0 and not attribute.attisdropped
  ) is distinct from array[
    'id|uuid|true|gen_random_uuid()||',
    'workspace_id|uuid|true|<null>||',
    'social_connection_id|uuid|true|<null>||',
    'phone_number_id|text|true|<null>||',
    'external_message_id|text|true|<null>||',
    'payload_fingerprint|text|true|<null>||',
    'status|text|true|''processing''::text||',
    'attempt_count|integer|true|1||',
    'lease_token|uuid|false|<null>||',
    'lease_until|timestamp with time zone|false|<null>||',
    'conversation_message_id|uuid|false|<null>||',
    'last_error_code|text|false|<null>||',
    'created_at|timestamp with time zone|true|now()||',
    'updated_at|timestamp with time zone|true|now()||'
  ]::text[]
  or (
    select array_agg(
      attribute.attname || '|' ||
      format_type(attribute.atttypid, attribute.atttypmod) || '|' ||
      attribute.attnotnull::text || '|' ||
      coalesce(
        pg_get_expr(default_definition.adbin, default_definition.adrelid),
        '<null>'
      ) || '|' || attribute.attidentity::text || '|' ||
      attribute.attgenerated::text
      order by attribute.attnum
    )
      from pg_attribute as attribute
      left join pg_attrdef as default_definition
        on default_definition.adrelid = attribute.attrelid
       and default_definition.adnum = attribute.attnum
     where attribute.attrelid = 'public.conversation_messages'::regclass
       and attribute.attname like 'whatsapp\_%' escape '\'
       and attribute.attnum > 0 and not attribute.attisdropped
  ) is distinct from array[
    'whatsapp_social_connection_id|uuid|false|<null>||',
    'whatsapp_phone_number_id|text|false|<null>||',
    'whatsapp_payload_fingerprint|text|false|<null>||'
  ]::text[] then
    raise exception 'whatsapp_cloud_column_postflight_failed';
  end if;
  if (
    select array_agg(
      constraint_definition.conname order by constraint_definition.conname
    )
      from pg_constraint as constraint_definition
     where constraint_definition.conrelid =
           'public.whatsapp_cloud_webhook_receipts'::regclass
       and constraint_definition.contype in ('p', 'u', 'f', 'c')
  ) is distinct from array[
    'whatsapp_cloud_receipt_attempt_count_check',
    'whatsapp_cloud_receipt_connection_workspace_fk',
    'whatsapp_cloud_receipt_external_message_id_check',
    'whatsapp_cloud_receipt_identity_unique',
    'whatsapp_cloud_receipt_last_error_code_check',
    'whatsapp_cloud_receipt_message_workspace_fk',
    'whatsapp_cloud_receipt_payload_fingerprint_check',
    'whatsapp_cloud_receipt_phone_number_id_check',
    'whatsapp_cloud_receipt_state_check',
    'whatsapp_cloud_receipt_status_check',
    'whatsapp_cloud_receipt_workspace_fk',
    'whatsapp_cloud_webhook_receipts_pkey'
  ]::text[]
  or exists (
    select 1 from pg_constraint as constraint_definition
     where constraint_definition.conrelid in (
       'public.whatsapp_cloud_webhook_receipts'::regclass,
       'public.conversation_messages'::regclass
     )
       and (
         constraint_definition.conname like 'whatsapp_cloud_receipt_%'
         or constraint_definition.conname in (
           'whatsapp_cloud_webhook_receipts_pkey',
           'conversation_messages_whatsapp_connection_workspace_fk',
           'conversation_messages_whatsapp_identity_check'
         )
       )
       and (
         not constraint_definition.convalidated
         or constraint_definition.connoinherit
         or constraint_definition.condeferrable
         or constraint_definition.condeferred
         or constraint_definition.conparentid <> 0
       )
  )
  or not exists (
    select 1 from pg_constraint as constraint_definition
     where constraint_definition.conrelid =
           'public.whatsapp_cloud_webhook_receipts'::regclass
       and constraint_definition.conname =
           'whatsapp_cloud_receipt_identity_unique'
       and constraint_definition.contype = 'u'
       and constraint_definition.conkey = array[
         (select attnum from pg_attribute where attrelid =
           'public.whatsapp_cloud_webhook_receipts'::regclass
           and attname = 'social_connection_id' and not attisdropped),
         (select attnum from pg_attribute where attrelid =
           'public.whatsapp_cloud_webhook_receipts'::regclass
           and attname = 'phone_number_id' and not attisdropped),
         (select attnum from pg_attribute where attrelid =
           'public.whatsapp_cloud_webhook_receipts'::regclass
           and attname = 'external_message_id' and not attisdropped)
       ]::smallint[]
       and constraint_definition.conindid = to_regclass(
         'public.whatsapp_cloud_receipt_identity_unique'
       )
  )
  or not exists (
    select 1 from pg_constraint as constraint_definition
     where constraint_definition.conrelid =
           'public.whatsapp_cloud_webhook_receipts'::regclass
       and constraint_definition.conname =
           'whatsapp_cloud_receipt_message_workspace_fk'
       and constraint_definition.contype = 'f'
       and constraint_definition.confrelid =
           'public.conversation_messages'::regclass
       and constraint_definition.confdeltype = 'n'
       and constraint_definition.confupdtype = 'a'
       and constraint_definition.confmatchtype = 's'
       and constraint_definition.confdelsetcols = array[
         (select attnum from pg_attribute where attrelid =
           'public.whatsapp_cloud_webhook_receipts'::regclass
           and attname = 'conversation_message_id' and not attisdropped)
       ]::smallint[]
  )
  or (
    select count(*) from pg_constraint as constraint_definition
     where constraint_definition.conrelid =
           'public.conversation_messages'::regclass
       and constraint_definition.conname in (
         'conversation_messages_whatsapp_connection_workspace_fk',
         'conversation_messages_whatsapp_identity_check'
       )
       and constraint_definition.convalidated
       and not constraint_definition.connoinherit
       and not constraint_definition.condeferrable
       and not constraint_definition.condeferred
       and constraint_definition.conparentid = 0
  ) <> 2
  or exists (
    select 1 from pg_constraint as constraint_definition
     where constraint_definition.conrelid in (
       'public.whatsapp_cloud_webhook_receipts'::regclass,
       'public.conversation_messages'::regclass
     )
       and constraint_definition.contype = 'c'
       and constraint_definition.conname in (
         'conversation_messages_whatsapp_identity_check',
         'whatsapp_cloud_receipt_phone_number_id_check',
         'whatsapp_cloud_receipt_external_message_id_check',
         'whatsapp_cloud_receipt_payload_fingerprint_check',
         'whatsapp_cloud_receipt_status_check',
         'whatsapp_cloud_receipt_attempt_count_check',
         'whatsapp_cloud_receipt_last_error_code_check',
         'whatsapp_cloud_receipt_state_check'
       )
       and (
         lower(pg_get_expr(
           constraint_definition.conbin,
           constraint_definition.conrelid
         )) in ('true', '(true)')
         or position(' or true' in lower(pg_get_expr(
           constraint_definition.conbin,
           constraint_definition.conrelid
         ))) > 0
         or pg_get_expr(
           constraint_definition.conbin,
           constraint_definition.conrelid
         ) not like '%' || case constraint_definition.conname
           when 'conversation_messages_whatsapp_identity_check'
             then 'whatsapp_payload_fingerprint'
           when 'whatsapp_cloud_receipt_phone_number_id_check'
             then 'phone_number_id'
           when 'whatsapp_cloud_receipt_external_message_id_check'
             then 'external_message_id'
           when 'whatsapp_cloud_receipt_payload_fingerprint_check'
             then 'payload_fingerprint'
           when 'whatsapp_cloud_receipt_status_check' then 'status'
           when 'whatsapp_cloud_receipt_attempt_count_check'
             then 'attempt_count'
           when 'whatsapp_cloud_receipt_last_error_code_check'
             then 'last_error_code'
           when 'whatsapp_cloud_receipt_state_check'
             then 'conversation_message_id'
           else '__unexpected__'
         end || '%'
       )
  ) then
    raise exception 'whatsapp_cloud_receipt_constraint_postflight_failed';
  end if;

  if (
    select count(*) from pg_policies as policy
     where policy.schemaname = 'public'
       and policy.tablename = 'conversation_messages'
       and policy.policyname like
           'conversation_messages_whatsapp_identity_%'
       and policy.permissive = 'RESTRICTIVE'
       and policy.roles = array['authenticated']::name[]
       and policy.cmd in ('INSERT', 'UPDATE')
       and position(' OR ' in upper(coalesce(policy.qual, ''))) = 0
       and position(' OR ' in upper(coalesce(policy.with_check, ''))) = 0
       and coalesce(policy.with_check, '') like
           '%whatsapp_social_connection_id%IS NULL%'
       and coalesce(policy.with_check, '') like
           '%whatsapp_phone_number_id%IS NULL%'
       and coalesce(policy.with_check, '') like
           '%whatsapp_payload_fingerprint%IS NULL%'
  ) <> 2 then
    raise exception 'whatsapp_cloud_identity_policy_postflight_failed';
  end if;

  if exists (
    select 1 from pg_class as index_relation
    join pg_namespace as index_namespace
      on index_namespace.oid = index_relation.relnamespace
   where index_namespace.nspname = 'public'
     and index_relation.relname in (
       'social_connections_active_whatsapp_phone_unique_idx',
       'conversation_messages_id_workspace_unique_idx',
       'conversation_messages_whatsapp_identity_unique_idx',
       'whatsapp_cloud_webhook_receipts_retry_idx',
       'whatsapp_cloud_webhook_receipts_workspace_idx',
       'whatsapp_cloud_webhook_receipts_message_workspace_idx'
     )
     and obj_description(index_relation.oid, 'pg_class') is distinct from
       'fanmind-whatsapp:v1:sha256:' || pg_catalog.encode(
         pg_catalog.sha256(pg_catalog.convert_to(
           pg_get_indexdef(index_relation.oid, 0, true), 'UTF8'
         )), 'hex'
       )
  ) then
    raise exception 'whatsapp_cloud_index_attestation_postflight_failed';
  end if;

  if exists (
    select 1 from pg_constraint as constraint_definition
     where (
       (
         constraint_definition.conrelid =
           'public.whatsapp_cloud_webhook_receipts'::regclass
         and constraint_definition.contype in ('p', 'u', 'f', 'c')
       ) or (
         constraint_definition.conrelid =
           'public.conversation_messages'::regclass
         and constraint_definition.conname in (
           'conversation_messages_whatsapp_connection_workspace_fk',
           'conversation_messages_whatsapp_identity_check'
         )
       )
     )
       and obj_description(
         constraint_definition.oid, 'pg_constraint'
       ) is distinct from 'fanmind-whatsapp:v1:sha256:' ||
         pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
           pg_get_constraintdef(constraint_definition.oid, true), 'UTF8'
         )), 'hex')
  ) then
    raise exception 'whatsapp_cloud_constraint_attestation_postflight_failed';
  end if;

  if exists (
    select 1 from pg_policy as policy_definition
    join pg_class as relation on relation.oid = policy_definition.polrelid
    join pg_namespace as relation_namespace
      on relation_namespace.oid = relation.relnamespace
   where relation_namespace.nspname = 'public'
     and relation.relname = 'conversation_messages'
     and policy_definition.polname in (
       'conversation_messages_whatsapp_identity_server_insert',
       'conversation_messages_whatsapp_identity_server_update'
     )
     and obj_description(policy_definition.oid, 'pg_policy') is distinct from
       'fanmind-whatsapp:v1:sha256:' || pg_catalog.encode(
         pg_catalog.sha256(pg_catalog.convert_to(concat_ws(
           '|',
           policy_definition.polcmd::text,
           policy_definition.polpermissive::text,
           policy_definition.polroles::text,
           coalesce(pg_get_expr(
             policy_definition.polqual, policy_definition.polrelid
           ), '<null>'),
           coalesce(pg_get_expr(
             policy_definition.polwithcheck, policy_definition.polrelid
           ), '<null>')
         ), 'UTF8')), 'hex'
       )
  ) then
    raise exception 'whatsapp_cloud_policy_attestation_postflight_failed';
  end if;

  if (
    select count(*) from pg_proc as function_definition
    join pg_namespace as function_namespace
      on function_namespace.oid = function_definition.pronamespace
   where function_namespace.nspname = 'public'
     and function_definition.proname in (
       'whatsapp_cloud_inbound_schema_state',
       'claim_whatsapp_cloud_inbound_message',
       'store_whatsapp_cloud_inbound_message',
       'disconnect_whatsapp_cloud_inbound_connection'
     )
  ) <> 4 then
    raise exception 'whatsapp_cloud_function_overload_postflight_failed';
  end if;

  for function_record in
    select required.signature,
           required.expected_body_hex,
           required.expected_language,
           required.expected_volatility,
           required.expected_arguments,
           required.expected_defaults,
           required.expected_argtypes,
           required.expected_allargtypes,
           required.expected_argmodes,
           required.expected_argnames,
           function_definition.oid,
           function_definition.proowner,
           function_definition.prokind,
           function_definition.prolang,
           function_definition.provolatile,
           function_definition.pronargs,
           function_definition.pronargdefaults,
           function_definition.proargdefaults,
           function_definition.proargtypes,
           function_definition.proallargtypes,
           function_definition.proargmodes,
           function_definition.proargnames,
           function_definition.prorettype,
           function_definition.proretset,
           function_definition.prosecdef,
           function_definition.proisstrict,
           function_definition.proleakproof,
           function_definition.proparallel,
           function_definition.proconfig,
           function_definition.prosrc
      from (values
        ('public.whatsapp_cloud_inbound_schema_state()',
         '__FANMIND_WHATSAPP_SCHEMA_STATE_BODY_HEX__', 'sql', 's', 0, 0, '',
         array['boolean'::regtype]::oid[],
         array['t']::"char"[], array['ready']::text[]),
        ('public.claim_whatsapp_cloud_inbound_message(uuid,uuid,text,text,text,integer)',
         '__FANMIND_WHATSAPP_CLAIM_BODY_HEX__', 'plpgsql', 'v', 6, 1,
         '2950 2950 25 25 25 23',
         array[
           'uuid'::regtype, 'uuid'::regtype, 'text'::regtype,
           'text'::regtype, 'text'::regtype, 'integer'::regtype,
           'uuid'::regtype, 'uuid'::regtype, 'text'::regtype
         ]::oid[],
         array['i','i','i','i','i','i','t','t','t']::"char"[],
         array[
           'p_workspace_id', 'p_social_connection_id', 'p_phone_number_id',
           'p_external_message_id', 'p_payload_fingerprint',
           'p_lease_seconds', 'receipt_id', 'lease_token', 'outcome'
         ]::text[]),
        ('public.store_whatsapp_cloud_inbound_message(uuid,uuid,uuid,uuid,text,text,text,text,text,text,timestamp with time zone,text)',
         '__FANMIND_WHATSAPP_STORE_BODY_HEX__', 'plpgsql', 'v', 12, 0,
         '2950 2950 2950 2950 25 25 25 25 25 25 1184 25',
         array[
           'uuid'::regtype, 'uuid'::regtype, 'uuid'::regtype,
           'uuid'::regtype, 'text'::regtype, 'text'::regtype,
           'text'::regtype, 'text'::regtype, 'text'::regtype,
           'text'::regtype, 'timestamptz'::regtype, 'text'::regtype,
           'uuid'::regtype, 'text'::regtype
         ]::oid[],
         array[
           'i','i','i','i','i','i','i','i','i','i','i','i','t','t'
         ]::"char"[],
         array[
           'p_workspace_id', 'p_social_connection_id', 'p_receipt_id',
           'p_lease_token', 'p_phone_number_id', 'p_sender_id',
           'p_external_message_id', 'p_external_thread_id',
           'p_author_label', 'p_content', 'p_received_at',
           'p_payload_fingerprint', 'conversation_message_id', 'outcome'
         ]::text[]),
        ('public.disconnect_whatsapp_cloud_inbound_connection(uuid,uuid)',
         '__FANMIND_WHATSAPP_DISCONNECT_BODY_HEX__', 'plpgsql', 'v', 2, 0,
         '2950 2950',
         array['uuid'::regtype, 'uuid'::regtype, 'boolean'::regtype]::oid[],
         array['i','i','t']::"char"[],
         array['p_workspace_id', 'p_social_connection_id', 'disconnected']::text[])
      ) as required(
        signature,
        expected_body_hex,
        expected_language,
        expected_volatility,
        expected_arguments,
        expected_defaults,
        expected_argtypes,
        expected_allargtypes,
        expected_argmodes,
        expected_argnames
      )
      left join pg_proc as function_definition
        on function_definition.oid = to_regprocedure(required.signature)
  loop
    expected_body_hex := function_record.expected_body_hex;
    if function_record.oid is null
       or function_record.proowner <> to_regrole('postgres')
       or function_record.prokind::text <> 'f'
       or function_record.prolang <> (
         select language_definition.oid
           from pg_language as language_definition
          where language_definition.lanname =
                function_record.expected_language
       )
       or function_record.provolatile::text <>
          function_record.expected_volatility
       or function_record.pronargs <> function_record.expected_arguments
       or function_record.pronargdefaults <>
          function_record.expected_defaults
       or function_record.proargtypes::text <>
          function_record.expected_argtypes
       or function_record.proallargtypes is distinct from
          function_record.expected_allargtypes
       or function_record.proargmodes is distinct from
          function_record.expected_argmodes
       or function_record.proargnames is distinct from
          function_record.expected_argnames
       or (
         function_record.expected_defaults = 1
         and pg_get_expr(function_record.proargdefaults, 0) <> '120'
       )
       or (
         function_record.expected_defaults = 0
         and function_record.proargdefaults is not null
       )
       or function_record.prorettype <> 'record'::regtype
       or not function_record.proretset
       or not function_record.prosecdef
       or function_record.proisstrict
       or function_record.proleakproof
       or function_record.proparallel::text <> 'u'
       or function_record.proconfig is distinct from
          array['search_path=pg_catalog, public, pg_temp']::text[]
       or encode(convert_to(function_record.prosrc, 'UTF8'), 'hex') <>
          expected_body_hex
       or not has_function_privilege(
         'service_role', function_record.oid, 'EXECUTE'
       )
       or has_function_privilege('anon', function_record.oid, 'EXECUTE')
       or has_function_privilege(
         'authenticated', function_record.oid, 'EXECUTE'
       )
       or not coalesce((
         select count(*) = 2
            and bool_and(function_acl.privilege_type = 'EXECUTE')
            and bool_and(not function_acl.is_grantable)
            and bool_and(function_acl.grantor = function_record.proowner)
            and count(*) filter (
              where function_acl.grantee = function_record.proowner
            ) = 1
            and count(*) filter (
              where function_acl.grantee = to_regrole('service_role')
            ) = 1
           from aclexplode(
             coalesce(
               (select checked_function.proacl from pg_proc as checked_function
                 where checked_function.oid = function_record.oid),
               acldefault('f', function_record.proowner)
             )
           ) as function_acl
       ), false
       ) then
      raise exception 'whatsapp_cloud_function_postflight_failed';
    end if;
  end loop;

  perform set_config('request.jwt.claim.role', 'service_role', true);
  if not exists (
    select 1 from public.whatsapp_cloud_inbound_schema_state()
     where ready
  ) then
    raise exception 'whatsapp_cloud_runtime_state_postflight_failed';
  end if;
end
$verify$;

select 'WHATSAPP_CLOUD_INBOUND_POSTFLIGHT=PASS';
rollback;
`;

function fail(code) {
  throw new Error(`WHATSAPP_CLOUD_INBOUND_ERROR=${code}`);
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

function controlledFunctionBody(sql, functionName) {
  const declaration = `create function public.${functionName}`;
  const declarationStart = sql.indexOf(declaration);
  const bodyDelimiter = "as $function$";
  const bodyStart = sql.indexOf(bodyDelimiter, declarationStart);
  const bodyEnd = sql.indexOf("$function$;", bodyStart + bodyDelimiter.length);
  if (
    declarationStart < 0 ||
    bodyStart < 0 ||
    bodyEnd < 0 ||
    sql.indexOf(declaration, declarationStart + declaration.length) >= 0
  ) {
    fail("control_contract_invalid");
  }
  return sql.slice(bodyStart + bodyDelimiter.length, bodyEnd);
}

function controlledMemberProcessingBody(sql) {
  const declaration =
    "create or replace function public.workspace_processing_allowed_contract";
  const declarationStart = sql.indexOf(declaration);
  const bodyDelimiter = "as $function$";
  const bodyStart = sql.indexOf(bodyDelimiter, declarationStart);
  const bodyEnd = sql.indexOf("$function$;", bodyStart + bodyDelimiter.length);
  if (
    declarationStart < 0 ||
    bodyStart < 0 ||
    bodyEnd < 0 ||
    sql.indexOf(declaration, declarationStart + declaration.length) >= 0
  ) {
    fail("member_control_unavailable");
  }
  return sql.slice(bodyStart + bodyDelimiter.length, bodyEnd);
}

export function evaluateWhatsAppCloudInboundSql(sql) {
  if (typeof sql !== "string" || !sql.trim()) fail("control_unreadable");
  const digest = createHash("sha256").update(sql).digest("hex");
  if (digest !== EXPECTED_CONTROL_SHA256) fail("control_checksum_mismatch");

  const required = [
    /^begin;/imu,
    /set local lock_timeout = '5s';[\s\S]*set local statement_timeout = '90s';[\s\S]*set local search_path = pg_catalog, public, pg_temp;/iu,
    /current_user <> 'postgres'/iu,
    /where version = '20260817230000'[\s\S]*whatsapp_cloud_inbound_foundation/iu,
    /whatsapp_cloud_member_control_incomplete/iu,
    /workspace_processing_allowed_contract\([\s\S]*fixed_demo_seed_version/iu,
    /whatsapp_cloud_existing_or_partial_state/iu,
    /create unique index social_connections_active_whatsapp_phone_unique_idx/iu,
    /create unique index conversation_messages_whatsapp_identity_unique_idx[\s\S]*whatsapp_social_connection_id[\s\S]*whatsapp_phone_number_id[\s\S]*external_message_id/iu,
    /add column whatsapp_payload_fingerprint text/iu,
    /create table public\.whatsapp_cloud_webhook_receipts/iu,
    /create index whatsapp_cloud_webhook_receipts_retry_idx[\s\S]*where status in \('processing', 'retryable_error'\)/iu,
    /whatsapp_cloud_webhook_receipts_message_workspace_idx[\s\S]*conversation_message_id is not null/iu,
    /fanmind-whatsapp:v1:sha256/iu,
    /p_payload_fingerprint[\s\S]*expected_payload_fingerprint/iu,
    /force row level security/iu,
    /revoke all on table public\.whatsapp_cloud_webhook_receipts[\s\S]*service_role/iu,
    /create function public\.claim_whatsapp_cloud_inbound_message[\s\S]*security definer[\s\S]*set search_path = pg_catalog, public, pg_temp/iu,
    /create function public\.store_whatsapp_cloud_inbound_message[\s\S]*workspace_allowed := public\.workspace_processing_allowed_contract/iu,
    /create function public\.disconnect_whatsapp_cloud_inbound_connection/iu,
    /grant execute on function public\.whatsapp_cloud_inbound_schema_state\(\)[\s\S]*to service_role/iu,
    /commit;\s*$/iu,
  ];
  const forbidden = [
    /grant (?:select|insert|update|delete|truncate|references|trigger|all)[\s\S]*whatsapp_cloud_webhook_receipts[\s\S]*to (?:public|anon|authenticated|service_role)/iu,
    /finish_whatsapp_cloud_inbound_message/iu,
    /(?:graph\.facebook|api\.whatsapp|fetch\s*\(|curl\s)/iu,
    /\bwhen others\b/iu,
    /\btruncate\s+table\b/iu,
    /create unique index conversation_messages_whatsapp_external_message_unique_idx/iu,
  ];
  if (
    required.some((contract) => !contract.test(sql)) ||
    forbidden.some((contract) => contract.test(sql))
  ) {
    fail("control_contract_invalid");
  }
  return Object.freeze({ controlId: CONTROL_ID, digest });
}

export function materializeWhatsAppCloudInboundPostflight(sql) {
  evaluateWhatsAppCloudInboundSql(sql);
  let materialized = POSTFLIGHT_SQL;
  for (const contract of FUNCTION_SIGNATURES) {
    const bodyHex = Buffer.from(
      controlledFunctionBody(sql, contract.name),
      "utf8",
    ).toString("hex");
    materialized = materialized.replace(contract.placeholder, bodyHex);
  }
  let memberControlSql;
  try {
    memberControlSql = readFileSync(WORKSPACE_MEMBER_CONTROL_PATH, "utf8");
  } catch {
    fail("member_control_unavailable");
  }
  materialized = materialized.replace(
    "__FANMIND_MEMBER_PROCESSING_BODY_HEX__",
    Buffer.from(
      controlledMemberProcessingBody(memberControlSql),
      "utf8",
    ).toString("hex"),
  );
  if (/__FANMIND_[A-Z_]+__/u.test(materialized)) {
    fail("postflight_materialization_failed");
  }
  return materialized;
}

function readAndVerifyControl() {
  let sql;
  try {
    sql = readFileSync(CONTROL_PATH, "utf8");
  } catch {
    fail("control_unreadable");
  }
  const evaluation = evaluateWhatsAppCloudInboundSql(sql);
  console.log(`WHATSAPP_CLOUD_INBOUND_CONTROL_ID=${evaluation.controlId}`);
  console.log("WHATSAPP_CLOUD_INBOUND_CHECKSUM=verified");
  console.log("WHATSAPP_CLOUD_INBOUND_CONTRACT=verified");
  return sql;
}

function memberPostflightSql() {
  try {
    return materializeWorkspaceMemberDataBoundaryPostflight(
      readFileSync(WORKSPACE_MEMBER_CONTROL_PATH, "utf8"),
    );
  } catch {
    fail("member_control_unavailable");
  }
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
      join(tmpdir(), "fanmind-whatsapp-cloud-inbound-"),
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
      error.message.startsWith("WHATSAPP_CLOUD_INBOUND_ERROR=")
    ) {
      throw error;
    }
    if (error && typeof error === "object" && error.code === "ELOOP") {
      fail("passfile_invalid");
    }
    fail("passfile_read_failed");
  } finally {
    content?.fill(0);
    if (sourceDescriptor !== undefined) closeSync(sourceDescriptor);
  }
}

function psqlEnvironment(environment, passfilePath) {
  return {
    PATH: environment.PATH ?? process.env.PATH ?? "/usr/bin:/bin",
    LANG: "C",
    LC_ALL: "C",
    PGHOST: environment.PGHOST,
    PGPORT: environment.PGPORT,
    PGDATABASE: environment.PGDATABASE,
    PGUSER: environment.PGUSER,
    PGSSLMODE: "verify-full",
    PGSSLROOTCERT: environment.PGSSLROOTCERT,
    PGPASSFILE: passfilePath,
    PGCONNECT_TIMEOUT: "10",
    PGAPPNAME: "fanmind-whatsapp-cloud-inbound-control",
  };
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
      "--set=VERBOSITY=terse",
      "--set=SHOW_CONTEXT=never",
    ],
    {
      env: psqlEnvironment(environment, passfilePath),
      input,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 120_000,
    },
  );
}

function ensurePsqlAvailable(environment) {
  const result = spawnSync("psql", ["--version"], {
    encoding: "utf8",
    env: {
      PATH: environment.PATH ?? process.env.PATH ?? "/usr/bin:/bin",
      LANG: "C",
      LC_ALL: "C",
    },
    stdio: ["ignore", "ignore", "ignore"],
    timeout: 10_000,
  });
  if (result.error || result.status !== 0) fail("psql_unavailable");
  console.log("WHATSAPP_CLOUD_INBOUND_PSQL=available");
}

function successfulPsql(result, marker) {
  return Boolean(
    !result.error && result.status === 0 && result.stdout.includes(marker),
  );
}

function preflightState(output) {
  const matches = [
    ...String(output).matchAll(
      /WHATSAPP_CLOUD_INBOUND_OBJECT_STATE=(absent|present|invalid)/gu,
    ),
  ];
  if (matches.length !== 1) fail("preflight_failed");
  return matches[0][1];
}

export function applySql(controlSql) {
  return String.raw`\set ON_ERROR_STOP on
set lock_timeout = '5s';
set statement_timeout = '120s';
select pg_advisory_lock(20260817, 230000);
${controlSql}
select 'WHATSAPP_CLOUD_INBOUND_APPLY_COMMIT=PASS';
select pg_advisory_unlock(20260817, 230000);
`;
}

function requireMemberControl(environment, snapshotPath) {
  const result = runPsql(memberPostflightSql(), environment, snapshotPath);
  if (
    !successfulPsql(
      result,
      "WORKSPACE_MEMBER_DATA_BOUNDARY_POSTFLIGHT=PASS",
    )
  ) {
    fail("member_control_failed");
  }
  console.log("WHATSAPP_CLOUD_INBOUND_MEMBER_CONTROL=verified");
}

function runDatabaseMode(mode, controlSql, environment) {
  const policyMode = mode === "--apply" ? "apply" : "verify";
  const evaluation = evaluateWhatsAppCloudInboundStagingEnvironment(
    environment,
    { mode: policyMode },
  );
  if (!evaluation.ok) fail("environment_invalid");

  ensurePsqlAvailable(environment);
  const postflightSql = materializeWhatsAppCloudInboundPostflight(controlSql);
  const { snapshotDirectory, snapshotPath } =
    privatePassfileSnapshot(environment);
  try {
    requireMemberControl(environment, snapshotPath);
    if (mode === "--apply") {
      const preflight = runPsql(PRECHECK_SQL, environment, snapshotPath);
      if (!successfulPsql(preflight, "WHATSAPP_CLOUD_INBOUND_PREFLIGHT=PASS")) {
        fail("preflight_failed");
      }
      const state = preflightState(preflight.stdout);
      if (state === "invalid") fail("partial_state");
      console.log("WHATSAPP_CLOUD_INBOUND_PREFLIGHT=PASS");
      if (state === "present") {
        const currentVerification = runPsql(
          postflightSql,
          environment,
          snapshotPath,
        );
        if (
          !successfulPsql(
            currentVerification,
            "WHATSAPP_CLOUD_INBOUND_POSTFLIGHT=PASS",
          )
        ) {
          fail("preflight_failed");
        }
        console.log("WHATSAPP_CLOUD_INBOUND_APPLY=already_current");
      } else {
        const apply = runPsql(applySql(controlSql), environment, snapshotPath);
        if (
          !successfulPsql(apply, "WHATSAPP_CLOUD_INBOUND_APPLY_COMMIT=PASS")
        ) {
          fail("apply_outcome_indeterminate");
        }
        console.log("WHATSAPP_CLOUD_INBOUND_APPLY=completed");
      }
    } else {
      console.log("WHATSAPP_CLOUD_INBOUND_APPLY=not_requested");
    }

    const verification = runPsql(postflightSql, environment, snapshotPath);
    if (
      !successfulPsql(
        verification,
        "WHATSAPP_CLOUD_INBOUND_POSTFLIGHT=PASS",
      )
    ) {
      fail(mode === "--apply" ? "applied_unverified" : "postflight_failed");
    }
    console.log("WHATSAPP_CLOUD_INBOUND_POSTFLIGHT=PASS");
    console.log("WHATSAPP_CLOUD_INBOUND_POSTFLIGHT_TRANSACTION=ROLLED_BACK");
    console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
  } finally {
    rmSync(snapshotDirectory, { recursive: true, force: true });
  }
}

function main() {
  const mode = modeFromArguments(process.argv.slice(2));
  const sql = readAndVerifyControl();
  if (mode === "--check") {
    console.log("WHATSAPP_CLOUD_INBOUND_MODE=check");
    console.log("WHATSAPP_CLOUD_INBOUND_DATABASE_WRITE=not_performed");
    console.log("WHATSAPP_CLOUD_INBOUND_READY=CHECKED_NOT_APPLIED");
    return;
  }
  console.log(
    `WHATSAPP_CLOUD_INBOUND_MODE=${mode === "--apply" ? "apply" : "verify"}`,
  );
  runDatabaseMode(mode, sql, process.env);
  console.log(
    `WHATSAPP_CLOUD_INBOUND_READY=${
      mode === "--apply" ? "APPLIED_AND_VERIFIED" : "VERIFIED_APPLIED"
    }`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    main();
  } catch (error) {
    if (
      error instanceof Error &&
      /^WHATSAPP_CLOUD_INBOUND_ERROR=[a-z0-9_]+$/u.test(error.message)
    ) {
      console.error(error.message);
    } else {
      console.error("WHATSAPP_CLOUD_INBOUND_ERROR=unexpected_failure");
    }
    console.error("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
    process.exitCode = 1;
  }
}
