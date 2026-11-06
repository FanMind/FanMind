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

import { evaluateWorkspaceMemberDataBoundaryStagingEnvironment } from "../../src/lib/workspaceMemberDataBoundaryStagingPolicy.mjs";

export const CONTROL_ID = "20260816120000_workspace_member_data_boundary";
export const CONTROL_PATH = resolve(
  process.cwd(),
  `supabase/controlled/${CONTROL_ID}.sql`,
);
export const EXPECTED_CONTROL_SHA256 =
  "ca9adfea6db85a48d75998e060f6b345a882a8b1889d20c7d04c438316985c93";
const MAX_PASSFILE_BYTES = 64 * 1024;
export const PROTECTED_MEMBER_WRITABLE_TABLES = Object.freeze([
  "contacts",
  "memories",
  "followups",
  "conversations",
  "conversation_messages",
  "conversation_summaries",
  "contact_reply_targets",
  "ai_usage_events",
  "content_sources",
  "fan_analysis_reports",
  "contact_ai_profiles",
  "workspace_voice_profiles",
]);
export const SOCIAL_CONNECTION_PUBLIC_COLUMNS = Object.freeze([
  "id",
  "workspace_id",
  "platform",
  "provider",
  "status",
  "external_account_id",
  "external_account_name",
  "page_id",
  "page_name",
  "token_last_four",
  "scopes",
  "webhook_subscribed",
  "connected_by",
  "connected_at",
  "disconnected_at",
  "last_event_at",
  "last_comment_fetch_at",
  "last_comment_fetch_count",
  "last_comment_fetch_error",
  "last_messenger_sync_at",
  "last_messenger_sync_checked_count",
  "last_messenger_sync_imported_inbound_count",
  "last_messenger_sync_imported_outbound_count",
  "last_messenger_sync_imported_media_count",
  "last_messenger_sync_skipped_count",
  "last_messenger_sync_error",
  "last_messenger_sync_outbound_at",
  "created_at",
  "updated_at",
]);

const REQUIRED_RELATIONS = Object.freeze([
  "workspaces",
  "workspace_members",
  "workspace_analysis_settings",
  ...PROTECTED_MEMBER_WRITABLE_TABLES,
  "social_connections",
]);

const PRECHECK_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
declare
  relation_name text;
  protected_table text;
  workspace_column record;
  owner_editable_columns constant text[] := array[
    'name', 'organization_name', 'street_address', 'postal_code', 'city',
    'country', 'vat_id', 'tax_number', 'company_register_number',
    'company_register_court'
  ];
  existing_control_function_count integer;
  existing_control_policy_count integer;
begin
  if current_user <> 'postgres'
     or to_regrole('authenticated') is null
     or to_regrole('anon') is null
     or to_regrole('service_role') is null then
    raise exception 'workspace_member_boundary_database_role_invalid';
  end if;
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise exception 'workspace_member_boundary_migration_ledger_missing';
  end if;
  if exists (
    select 1 from supabase_migrations.schema_migrations
     where version = '20260816120000'
        or name in (
          '20260816120000_workspace_member_data_boundary',
          'workspace_member_data_boundary'
        )
  ) then
    raise exception 'workspace_member_boundary_in_generic_ledger';
  end if;
  if not exists (
    select 1 from supabase_migrations.schema_migrations
     where version = '20260809141141'
       and name = 'workspace_server_owned_columns_controlled'
  ) then
    raise exception 'workspace_member_boundary_server_owned_ledger_missing';
  end if;
  if has_schema_privilege('anon', 'public', 'CREATE')
     or has_schema_privilege('authenticated', 'public', 'CREATE') then
    raise exception 'workspace_member_boundary_public_schema_create_exposed';
  end if;

  foreach relation_name in array array[
    ${REQUIRED_RELATIONS.map((relation) => `'${relation}'`).join(",\n    ")}
  ]
  loop
    if not coalesce((
      select relation.relrowsecurity
        from pg_class as relation
       where relation.oid = to_regclass(format('public.%I', relation_name))
         and relation.relkind in ('r', 'p')
    ), false) then
      raise exception 'workspace_member_boundary_rls_missing';
    end if;
  end loop;

  if has_table_privilege('anon', 'public.workspaces', 'INSERT')
     or has_table_privilege('authenticated', 'public.workspaces', 'INSERT')
     or has_any_column_privilege('anon', 'public.workspaces', 'INSERT')
     or has_any_column_privilege(
       'authenticated', 'public.workspaces', 'INSERT'
     )
     or not has_table_privilege(
       'service_role', 'public.workspaces', 'INSERT'
     )
     or not has_table_privilege(
       'service_role', 'public.workspaces', 'UPDATE'
     ) then
    raise exception 'workspace_member_boundary_server_owned_acl_invalid';
  end if;
  for workspace_column in
    select attribute.attname::text as column_name
      from pg_attribute as attribute
     where attribute.attrelid = 'public.workspaces'::regclass
       and attribute.attnum > 0
       and not attribute.attisdropped
  loop
    if has_column_privilege(
         'anon', 'public.workspaces', workspace_column.column_name, 'UPDATE'
       )
       or has_column_privilege(
         'authenticated',
         'public.workspaces',
         workspace_column.column_name,
         'UPDATE'
       ) is distinct from
          (workspace_column.column_name = any(owner_editable_columns)) then
      raise exception 'workspace_member_boundary_server_owned_columns_invalid';
    end if;
  end loop;

  if not exists (
    select 1 from pg_policies as policy
     where policy.schemaname = 'public'
       and policy.tablename = 'workspace_members'
       and policy.cmd in ('SELECT', 'ALL')
       and policy.permissive = 'PERMISSIVE'
       and policy.roles && array['public', 'authenticated']::name[]
       and coalesce(policy.qual, '') like '%auth.uid()%'
  ) then
    raise exception 'workspace_member_boundary_membership_read_missing';
  end if;

  foreach protected_table in array array[
    ${PROTECTED_MEMBER_WRITABLE_TABLES.map((table) => `'${table}'`).join(",\n    ")}
  ]
  loop
    if not exists (
      select 1 from pg_attribute as attribute
       where attribute.attrelid = to_regclass(
               format('public.%I', protected_table)
             )
         and attribute.attname = 'workspace_id'
         and attribute.atttypid = 'uuid'::regtype
         and attribute.attnum > 0
         and not attribute.attisdropped
    )
       or not exists (
         select 1 from pg_policies as policy
          where policy.schemaname = 'public'
            and policy.tablename = protected_table
            and policy.cmd in ('SELECT', 'ALL')
            and policy.permissive = 'PERMISSIVE'
            and policy.roles && array['public', 'authenticated']::name[]
            and coalesce(policy.qual, '') like '%workspace_members%'
            and coalesce(policy.qual, '') like '%auth.uid()%'
       ) then
      raise exception 'workspace_member_boundary_member_read_invalid';
    end if;
  end loop;

  if (
    select count(*) from pg_attribute as attribute
     where attribute.attrelid = 'public.social_connections'::regclass
       and attribute.attname = any(array[
         ${[...SOCIAL_CONNECTION_PUBLIC_COLUMNS, "page_access_token_encrypted"]
           .map((column) => `'${column}'`)
           .join(",\n         ")}
       ]::text[])
       and attribute.attnum > 0
       and not attribute.attisdropped
  ) <> ${SOCIAL_CONNECTION_PUBLIC_COLUMNS.length + 1} then
    raise exception 'workspace_member_boundary_social_columns_missing';
  end if;

  select count(*) into existing_control_function_count
    from pg_proc as function_definition
   where function_definition.oid in (
     to_regprocedure(
       'public.workspace_processing_allowed_contract(text,text,text,boolean,text,text,jsonb,timestamp with time zone)'
     ),
     to_regprocedure('public.workspace_owner_active_mutation_allowed(uuid)'),
     to_regprocedure('public.get_current_workspace_member_safe_dashboard()')
   );
  if existing_control_function_count not in (0, 3) then
    raise exception 'workspace_member_boundary_partial_function_state';
  end if;
  if exists (
    select 1 from pg_proc as function_definition
     where function_definition.oid in (
       to_regprocedure(
         'public.workspace_processing_allowed_contract(text,text,text,boolean,text,text,jsonb,timestamp with time zone)'
       ),
       to_regprocedure('public.workspace_owner_active_mutation_allowed(uuid)'),
       to_regprocedure('public.get_current_workspace_member_safe_dashboard()')
     )
       and function_definition.proowner <> to_regrole('postgres')
  ) then
    raise exception 'workspace_member_boundary_function_owner_invalid';
  end if;

  select count(*) into existing_control_policy_count
    from pg_policies as policy
   where policy.schemaname = 'public'
     and (
       (
         policy.tablename = 'workspaces'
         and policy.policyname = 'workspaces_select_requires_owner'
       )
       or (
         policy.tablename = 'workspace_analysis_settings'
         and policy.policyname =
             'workspace_analysis_settings_select_requires_workspace_owner'
       )
       or (
         policy.tablename = 'social_connections'
         and policy.policyname in (
           'social_connections_select_requires_workspace_owner',
           'social_connections_insert_requires_workspace_owner',
           'social_connections_update_requires_workspace_owner',
           'social_connections_delete_requires_workspace_owner'
         )
       )
       or (
         policy.tablename = any(array[
           ${PROTECTED_MEMBER_WRITABLE_TABLES.map((table) => `'${table}'`).join(",\n           ")}
         ]::text[])
         and policy.policyname in (
           policy.tablename || '_insert_requires_workspace_owner',
           policy.tablename || '_update_requires_workspace_owner',
           policy.tablename || '_delete_requires_workspace_owner'
         )
       )
     );
  if not (
    (
      existing_control_function_count = 0
      and existing_control_policy_count = 0
    )
    or (
      existing_control_function_count = 3
      and existing_control_policy_count = 42
    )
  ) then
    raise exception 'workspace_member_boundary_partial_control_state';
  end if;
end
$preflight$;

select 'WORKSPACE_MEMBER_DATA_BOUNDARY_PREFLIGHT_STATE=' ||
  case
    when to_regprocedure(
      'public.workspace_processing_allowed_contract(text,text,text,boolean,text,text,jsonb,timestamp with time zone)'
    ) is null then 'absent'
    else 'present'
  end;
select 'WORKSPACE_MEMBER_DATA_BOUNDARY_PREFLIGHT=PASS';
rollback;
`;

const POSTFLIGHT_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $verify$
declare
  relation_name text;
  protected_table text;
  policy_record record;
  column_record record;
  workspace_column record;
  function_record record;
  processing_oid oid := to_regprocedure(
    'public.workspace_processing_allowed_contract(text,text,text,boolean,text,text,jsonb,timestamp with time zone)'
  );
  mutation_oid oid := to_regprocedure(
    'public.workspace_owner_active_mutation_allowed(uuid)'
  );
  dashboard_oid oid := to_regprocedure(
    'public.get_current_workspace_member_safe_dashboard()'
  );
  public_select_columns constant text[] := array[
    ${SOCIAL_CONNECTION_PUBLIC_COLUMNS.map((column) => `'${column}'`).join(",\n    ")}
  ];
  owner_editable_columns constant text[] := array[
    'name', 'organization_name', 'street_address', 'postal_code', 'city',
    'country', 'vat_id', 'tax_number', 'company_register_number',
    'company_register_court'
  ];
  required_workspace_columns constant text[] := array[
    'id', 'owner_user_id', 'name', 'plan_id', 'workspace_access_mode',
    'subscription_effective_end_at', 'billing_status',
    'billing_manual_override', 'billing_grace_until', 'billing_suspended_at',
    'test_access_flags'
  ];
begin
  if current_user <> 'postgres'
     or to_regclass('supabase_migrations.schema_migrations') is null
     or exists (
       select 1 from supabase_migrations.schema_migrations
        where version = '20260816120000'
           or name in (
             '20260816120000_workspace_member_data_boundary',
             'workspace_member_data_boundary'
           )
     )
     or not exists (
       select 1 from supabase_migrations.schema_migrations
        where version = '20260809141141'
          and name = 'workspace_server_owned_columns_controlled'
     ) then
    raise exception 'workspace_member_boundary_ledger_postflight_failed';
  end if;
  if has_schema_privilege('anon', 'public', 'CREATE')
     or has_schema_privilege('authenticated', 'public', 'CREATE') then
    raise exception 'workspace_member_boundary_schema_postflight_failed';
  end if;

  foreach relation_name in array array[
    ${REQUIRED_RELATIONS.map((relation) => `'${relation}'`).join(",\n    ")}
  ]
  loop
    if not coalesce((
      select relation.relrowsecurity
        from pg_class as relation
       where relation.oid = to_regclass(format('public.%I', relation_name))
         and relation.relkind in ('r', 'p')
    ), false) then
      raise exception 'workspace_member_boundary_rls_postflight_failed';
    end if;
  end loop;

  if (
    select count(*) from pg_attribute as attribute
     where attribute.attrelid = 'public.workspaces'::regclass
       and attribute.attname = any(required_workspace_columns)
       and attribute.attnum > 0
       and not attribute.attisdropped
  ) <> cardinality(required_workspace_columns)
     or has_table_privilege('anon', 'public.workspaces', 'INSERT')
     or has_table_privilege('authenticated', 'public.workspaces', 'INSERT')
     or has_any_column_privilege('anon', 'public.workspaces', 'INSERT')
     or has_any_column_privilege(
       'authenticated', 'public.workspaces', 'INSERT'
     )
     or not has_table_privilege(
       'service_role', 'public.workspaces', 'INSERT'
     )
     or not has_table_privilege(
       'service_role', 'public.workspaces', 'UPDATE'
     ) then
    raise exception 'workspace_member_boundary_workspace_acl_postflight_failed';
  end if;
  for workspace_column in
    select attribute.attname::text as column_name
      from pg_attribute as attribute
     where attribute.attrelid = 'public.workspaces'::regclass
       and attribute.attnum > 0
       and not attribute.attisdropped
  loop
    if has_column_privilege(
         'anon', 'public.workspaces', workspace_column.column_name, 'UPDATE'
       )
       or has_column_privilege(
         'authenticated',
         'public.workspaces',
         workspace_column.column_name,
         'UPDATE'
       ) is distinct from
          (workspace_column.column_name = any(owner_editable_columns)) then
      raise exception 'workspace_member_boundary_workspace_column_postflight_failed';
    end if;
  end loop;

  if not exists (
    select 1 from pg_policies as policy
     where policy.schemaname = 'public'
       and policy.tablename = 'workspaces'
       and policy.policyname = 'workspaces_update_owner_boundary'
       and policy.cmd = 'UPDATE'
       and policy.permissive = 'RESTRICTIVE'
       and policy.roles = array['authenticated']::name[]
       and coalesce(policy.qual, '') like '%owner_user_id%auth.uid()%'
       and coalesce(policy.with_check, '') like '%owner_user_id%auth.uid()%'
  )
     or exists (
       select 1 from pg_policies as policy
        where policy.schemaname = 'public'
          and policy.tablename = 'workspaces'
          and policy.policyname = 'workspaces_insert_owner'
     )
     or not exists (
       select 1 from pg_policies as policy
        where policy.schemaname = 'public'
          and policy.tablename = 'workspace_members'
          and policy.cmd in ('SELECT', 'ALL')
          and policy.permissive = 'PERMISSIVE'
          and policy.roles && array['public', 'authenticated']::name[]
          and coalesce(policy.qual, '') like '%auth.uid()%'
     ) then
    raise exception 'workspace_member_boundary_foundation_postflight_failed';
  end if;

  if (
    select count(*) from pg_policies as policy
     where policy.schemaname = 'public'
       and policy.tablename = 'workspaces'
       and policy.policyname = 'workspaces_select_requires_owner'
       and policy.cmd = 'SELECT'
       and policy.permissive = 'RESTRICTIVE'
       and policy.roles = array['authenticated']::name[]
       and coalesce(policy.qual, '') like '%owner_user_id%auth.uid()%'
  ) <> 1
     or (
       select count(*) from pg_policies as policy
        where policy.schemaname = 'public'
          and policy.tablename = 'workspace_analysis_settings'
          and policy.policyname =
              'workspace_analysis_settings_select_requires_workspace_owner'
          and policy.cmd = 'SELECT'
          and policy.permissive = 'RESTRICTIVE'
          and policy.roles = array['authenticated']::name[]
          and coalesce(policy.qual, '') like
              '%analysis_settings_owner_boundary.owner_user_id%auth.uid()%'
     ) <> 1 then
    raise exception 'workspace_member_boundary_admin_policy_postflight_failed';
  end if;

  foreach protected_table in array array[
    ${PROTECTED_MEMBER_WRITABLE_TABLES.map((table) => `'${table}'`).join(",\n    ")}
  ]
  loop
    if not exists (
      select 1 from pg_attribute as attribute
       where attribute.attrelid = to_regclass(
               format('public.%I', protected_table)
             )
         and attribute.attname = 'workspace_id'
         and attribute.atttypid = 'uuid'::regtype
         and attribute.attnum > 0
         and not attribute.attisdropped
    )
       or not (
         has_table_privilege(
           'authenticated', format('public.%I', protected_table), 'SELECT'
         )
         or has_any_column_privilege(
           'authenticated', format('public.%I', protected_table), 'SELECT'
         )
       )
       or not exists (
         select 1 from pg_policies as policy
          where policy.schemaname = 'public'
            and policy.tablename = protected_table
            and policy.cmd in ('SELECT', 'ALL')
            and policy.permissive = 'PERMISSIVE'
            and policy.roles && array['public', 'authenticated']::name[]
            and coalesce(policy.qual, '') like '%workspace_members%'
            and coalesce(policy.qual, '') like '%auth.uid()%'
       ) then
      raise exception 'workspace_member_boundary_read_postflight_failed';
    end if;

    for policy_record in
      select policy.cmd, policy.qual, policy.with_check
        from pg_policies as policy
       where policy.schemaname = 'public'
         and policy.tablename = protected_table
         and policy.policyname in (
           protected_table || '_insert_requires_workspace_owner',
           protected_table || '_update_requires_workspace_owner',
           protected_table || '_delete_requires_workspace_owner'
         )
         and policy.permissive = 'RESTRICTIVE'
         and policy.roles = array['authenticated']::name[]
    loop
      if policy_record.cmd = 'INSERT'
         and coalesce(policy_record.with_check, '') not like
             '%workspace_owner_active_mutation_allowed(workspace_id)%' then
        raise exception 'workspace_member_boundary_insert_policy_invalid';
      elsif policy_record.cmd = 'UPDATE'
         and (
           coalesce(policy_record.qual, '') not like
             '%workspace_owner_active_mutation_allowed(workspace_id)%'
           or coalesce(policy_record.with_check, '') not like
             '%workspace_owner_active_mutation_allowed(workspace_id)%'
         ) then
        raise exception 'workspace_member_boundary_update_policy_invalid';
      elsif policy_record.cmd = 'DELETE'
         and coalesce(policy_record.qual, '') not like
             '%workspace_owner_active_mutation_allowed(workspace_id)%' then
        raise exception 'workspace_member_boundary_delete_policy_invalid';
      end if;
    end loop;
    if (
      select count(*) from pg_policies as policy
       where policy.schemaname = 'public'
         and policy.tablename = protected_table
         and policy.policyname in (
           protected_table || '_insert_requires_workspace_owner',
           protected_table || '_update_requires_workspace_owner',
           protected_table || '_delete_requires_workspace_owner'
         )
         and policy.permissive = 'RESTRICTIVE'
         and policy.roles = array['authenticated']::name[]
    ) <> 3 then
      raise exception 'workspace_member_boundary_policy_count_invalid';
    end if;
  end loop;

  if (
    select count(*) from pg_policies as policy
     where policy.schemaname = 'public'
       and policy.tablename = 'social_connections'
       and policy.policyname in (
         'social_connections_select_requires_workspace_owner',
         'social_connections_insert_requires_workspace_owner',
         'social_connections_update_requires_workspace_owner',
         'social_connections_delete_requires_workspace_owner'
       )
       and policy.permissive = 'RESTRICTIVE'
       and policy.roles = array['authenticated']::name[]
  ) <> 4
     or not exists (
       select 1 from pg_policies as policy
        where policy.schemaname = 'public'
          and policy.tablename = 'social_connections'
          and policy.policyname =
              'social_connections_select_requires_workspace_owner'
          and policy.cmd = 'SELECT'
          and coalesce(policy.qual, '') like
              '%workspace_owner_boundary.owner_user_id%auth.uid()%'
     )
     or not exists (
       select 1 from pg_policies as policy
        where policy.schemaname = 'public'
          and policy.tablename = 'social_connections'
          and policy.policyname =
              'social_connections_insert_requires_workspace_owner'
          and policy.cmd = 'INSERT'
          and coalesce(policy.with_check, '') like
              '%workspace_owner_active_mutation_allowed(workspace_id)%'
     )
     or not exists (
       select 1 from pg_policies as policy
        where policy.schemaname = 'public'
          and policy.tablename = 'social_connections'
          and policy.policyname =
              'social_connections_update_requires_workspace_owner'
          and policy.cmd = 'UPDATE'
          and coalesce(policy.qual, '') like
              '%workspace_owner_active_mutation_allowed(workspace_id)%'
          and coalesce(policy.with_check, '') like
              '%workspace_owner_active_mutation_allowed(workspace_id)%'
     )
     or not exists (
       select 1 from pg_policies as policy
        where policy.schemaname = 'public'
          and policy.tablename = 'social_connections'
          and policy.policyname =
              'social_connections_delete_requires_workspace_owner'
          and policy.cmd = 'DELETE'
          and coalesce(policy.qual, '') like
              '%workspace_owner_active_mutation_allowed(workspace_id)%'
     ) then
    raise exception 'workspace_member_boundary_social_policy_invalid';
  end if;

  if has_table_privilege('anon', 'public.social_connections', 'SELECT')
     or has_table_privilege(
       'authenticated', 'public.social_connections', 'SELECT'
     )
     or has_table_privilege('anon', 'public.social_connections', 'INSERT')
     or has_table_privilege(
       'authenticated', 'public.social_connections', 'INSERT'
     )
     or has_table_privilege('anon', 'public.social_connections', 'UPDATE')
     or has_table_privilege(
       'authenticated', 'public.social_connections', 'UPDATE'
     )
     or has_table_privilege('anon', 'public.social_connections', 'DELETE')
     or has_table_privilege(
       'authenticated', 'public.social_connections', 'DELETE'
     )
     or has_any_column_privilege('anon', 'public.social_connections', 'SELECT')
     or has_any_column_privilege('anon', 'public.social_connections', 'INSERT')
     or has_any_column_privilege(
       'authenticated', 'public.social_connections', 'INSERT'
     )
     or has_any_column_privilege('anon', 'public.social_connections', 'UPDATE')
     or has_any_column_privilege(
       'authenticated', 'public.social_connections', 'UPDATE'
     )
     or has_any_column_privilege(
       'anon', 'public.social_connections', 'REFERENCES'
     )
     or has_any_column_privilege(
       'authenticated', 'public.social_connections', 'REFERENCES'
     )
     or not has_any_column_privilege(
       'authenticated', 'public.social_connections', 'SELECT'
     ) then
    raise exception 'workspace_member_boundary_social_acl_invalid';
  end if;
  if (
    select count(*) from pg_attribute as attribute
     where attribute.attrelid = 'public.social_connections'::regclass
       and attribute.attname = any(array[
         ${[...SOCIAL_CONNECTION_PUBLIC_COLUMNS, "page_access_token_encrypted"]
           .map((column) => `'${column}'`)
           .join(",\n         ")}
       ]::text[])
       and attribute.attnum > 0
       and not attribute.attisdropped
  ) <> ${SOCIAL_CONNECTION_PUBLIC_COLUMNS.length + 1} then
    raise exception 'workspace_member_boundary_social_columns_missing';
  end if;
  for column_record in
    select attribute.attname::text as column_name
      from pg_attribute as attribute
     where attribute.attrelid = 'public.social_connections'::regclass
       and attribute.attnum > 0
       and not attribute.attisdropped
  loop
    if has_column_privilege(
         'anon', 'public.social_connections', column_record.column_name, 'SELECT'
       )
       or has_column_privilege(
         'authenticated',
         'public.social_connections',
         column_record.column_name,
         'SELECT'
       ) is distinct from
          (column_record.column_name = any(public_select_columns))
       or has_column_privilege(
         'authenticated',
         'public.social_connections',
         column_record.column_name,
         'INSERT'
       )
       or has_column_privilege(
         'authenticated',
         'public.social_connections',
         column_record.column_name,
         'UPDATE'
       )
       or has_column_privilege(
         'authenticated',
         'public.social_connections',
         column_record.column_name,
         'REFERENCES'
       ) then
      raise exception 'workspace_member_boundary_social_column_acl_invalid';
    end if;
  end loop;
  if not has_table_privilege(
       'service_role', 'public.social_connections', 'SELECT'
     )
     or not has_table_privilege(
       'service_role', 'public.social_connections', 'INSERT'
     )
     or not has_table_privilege(
       'service_role', 'public.social_connections', 'UPDATE'
     )
     or not has_table_privilege(
       'service_role', 'public.social_connections', 'DELETE'
     ) then
    raise exception 'workspace_member_boundary_service_role_acl_invalid';
  end if;

  if processing_oid is null or mutation_oid is null or dashboard_oid is null then
    raise exception 'workspace_member_boundary_function_missing';
  end if;
  if not exists (
    select 1 from pg_proc as function_definition
    join pg_language as function_language
      on function_language.oid = function_definition.prolang
    where function_definition.oid = processing_oid
      and function_definition.proowner = to_regrole('postgres')
      and function_language.lanname = 'plpgsql'
      and function_definition.prokind = 'f'
      and function_definition.provolatile = 's'
      and not function_definition.prosecdef
      and not function_definition.proretset
      and function_definition.prorettype = 'boolean'::regtype
      and function_definition.proargtypes =
          '25 25 25 16 25 25 3802 1184'::oidvector
      and function_definition.proconfig =
          array['search_path=pg_catalog, public, pg_temp']::text[]
      and function_definition.prosrc = convert_from(
        decode('__FANMIND_PROCESSING_BODY_HEX__', 'hex'), 'UTF8'
      )
  ) then
    raise exception 'workspace_member_boundary_processing_function_invalid';
  end if;
  if not exists (
    select 1 from pg_proc as function_definition
    join pg_language as function_language
      on function_language.oid = function_definition.prolang
    where function_definition.oid = mutation_oid
      and function_definition.proowner = to_regrole('postgres')
      and function_language.lanname = 'sql'
      and function_definition.prokind = 'f'
      and function_definition.provolatile = 's'
      and not function_definition.prosecdef
      and not function_definition.proretset
      and function_definition.prorettype = 'boolean'::regtype
      and function_definition.proargtypes = '2950'::oidvector
      and function_definition.proconfig = array[
        'search_path=pg_catalog, public, pg_temp', 'row_security=on'
      ]::text[]
      and function_definition.prosrc = convert_from(
        decode('__FANMIND_MUTATION_BODY_HEX__', 'hex'), 'UTF8'
      )
  ) then
    raise exception 'workspace_member_boundary_mutation_function_invalid';
  end if;
  if not exists (
    select 1 from pg_proc as function_definition
    join pg_language as function_language
      on function_language.oid = function_definition.prolang
    where function_definition.oid = dashboard_oid
      and function_definition.proowner = to_regrole('postgres')
      and function_language.lanname = 'plpgsql'
      and function_definition.prokind = 'f'
      and function_definition.provolatile = 's'
      and function_definition.prosecdef
      and function_definition.proretset
      and function_definition.prorettype = 'record'::regtype
      and function_definition.pronargs = 0
      and function_definition.proallargtypes = array[
        'uuid'::regtype, 'text'::regtype, 'text'::regtype, 'text'::regtype,
        'boolean'::regtype
      ]::oid[]
      and function_definition.proargmodes =
          array['t', 't', 't', 't', 't']::"char"[]
      and function_definition.proargnames = array[
        'workspace_id', 'workspace_name', 'plan_id', 'membership_role',
        'member_processing_allowed'
      ]::text[]
      and function_definition.proconfig = array[
        'search_path=pg_catalog, public, pg_temp', 'row_security=on'
      ]::text[]
      and function_definition.prosrc = convert_from(
        decode('__FANMIND_DASHBOARD_BODY_HEX__', 'hex'), 'UTF8'
      )
  ) then
    raise exception 'workspace_member_boundary_dashboard_function_invalid';
  end if;

  for function_record in
    select function_definition.oid, function_definition.proowner
      from pg_proc as function_definition
     where function_definition.oid in (processing_oid, mutation_oid, dashboard_oid)
  loop
    if has_function_privilege('anon', function_record.oid, 'EXECUTE')
       or not has_function_privilege(
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
              where function_acl.grantee = to_regrole('authenticated')
            ) = 1
           from aclexplode(
             coalesce(
               (select checked_function.proacl from pg_proc as checked_function
                 where checked_function.oid = function_record.oid),
               acldefault('f', function_record.proowner)
             )
           ) as function_acl
       ), false) then
      raise exception 'workspace_member_boundary_function_acl_invalid';
    end if;
  end loop;

  if public.workspace_processing_allowed_contract(
       'active', null, 'cancelled', true, null, null, '{}'::jsonb,
       timestamptz '2026-08-16 12:00:00+00'
     )
     or not public.workspace_processing_allowed_contract(
       'active', null, 'active', false, null, null, '{}'::jsonb,
       timestamptz '2026-08-16 12:00:00+00'
     )
     or public.workspace_processing_allowed_contract(
       'active', null, 'active', false, 'not-a-timestamp', null, '{}'::jsonb,
       timestamptz '2026-08-16 12:00:00+00'
     ) then
    raise exception 'workspace_member_boundary_processing_behavior_invalid';
  end if;
end
$verify$;

select 'WORKSPACE_MEMBER_DATA_BOUNDARY_POSTFLIGHT=PASS';
rollback;
`;

function fail(code) {
  throw new Error(`WORKSPACE_MEMBER_DATA_BOUNDARY_ERROR=${code}`);
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

function safeProjectionContract(sql) {
  const match = sql.match(
    /returns table\s*\(([\s\S]*?)\)\s*language plpgsql/iu,
  );
  if (!match) fail("safe_projection_missing");
  const resultShape = match[1];
  const expectedColumns = [
    "workspace_id uuid",
    "workspace_name text",
    "plan_id text",
    "membership_role text",
    "member_processing_allowed boolean",
  ];
  for (const column of expectedColumns) {
    if (!resultShape.includes(column)) fail("safe_projection_shape_invalid");
  }
  for (const sensitiveName of [
    "owner_user_id",
    "commercial_option",
    "setup_fee_cents",
    "monthly_fee_cents",
    "commitment_months",
    "billing_status",
    "billing_provider",
    "stripe_",
    "last_invoice_",
    "organization_name",
    "street_address",
    "postal_code",
    "city",
    "country",
    "vat_id",
    "tax_number",
    "company_register_",
    "test_access_flags",
  ]) {
    if (resultShape.includes(sensitiveName)) {
      fail("safe_projection_shape_invalid");
    }
  }
}

function socialConnectionProjectionContract(sql) {
  const match = sql.match(
    /grant select\s*\(([\s\S]*?)\)\s*on table public\.social_connections\s*to authenticated;/iu,
  );
  if (!match) fail("social_connection_projection_missing");
  const actualColumns = match[1]
    .split(",")
    .map((column) => column.trim().toLowerCase())
    .filter(Boolean);
  if (
    actualColumns.length !== SOCIAL_CONNECTION_PUBLIC_COLUMNS.length ||
    actualColumns.some(
      (column, index) => column !== SOCIAL_CONNECTION_PUBLIC_COLUMNS[index],
    )
  ) {
    fail("social_connection_projection_invalid");
  }
}

function sqlStringArray(block, marker) {
  const match = block.match(/array\s*\[([\s\S]*?)\]/iu);
  if (!match) fail(`${marker}_array_missing`);
  return [...match[1].matchAll(/'([^']+)'/gu)].map((entry) => entry[1]);
}

function protectedTableCoverageContract(sql) {
  const preconditionBlock = sql.match(
    /do \$rls_precondition\$([\s\S]*?)\$rls_precondition\$;/iu,
  )?.[1];
  const policyBlock = sql.match(
    /do \$policies\$([\s\S]*?)\$policies\$;/iu,
  )?.[1];
  const postflightBlock = sql.match(
    /do \$policy_postflight\$([\s\S]*?)\$policy_postflight\$;/iu,
  )?.[1];
  if (!preconditionBlock || !policyBlock || !postflightBlock) {
    fail("protected_table_block_missing");
  }

  const preconditionTables = sqlStringArray(
    preconditionBlock,
    "rls_precondition",
  );
  const policyTables = sqlStringArray(policyBlock, "policy");
  const postflightTables = sqlStringArray(postflightBlock, "postflight");
  const expected = [...PROTECTED_MEMBER_WRITABLE_TABLES];

  if (
    !expected.every((table) => preconditionTables.includes(table)) ||
    !preconditionTables.includes("workspace_analysis_settings") ||
    policyTables.length !== expected.length ||
    postflightTables.length !== expected.length ||
    policyTables.some((table, index) => table !== expected[index]) ||
    postflightTables.some((table, index) => table !== expected[index])
  ) {
    fail("protected_table_coverage_invalid");
  }
}

export function evaluateWorkspaceMemberDataBoundarySql(sql) {
  if (typeof sql !== "string") fail("control_unreadable");
  const digest = createHash("sha256").update(sql).digest("hex");
  if (digest !== EXPECTED_CONTROL_SHA256) fail("control_checksum_mismatch");

  safeProjectionContract(sql);
  socialConnectionProjectionContract(sql);
  protectedTableCoverageContract(sql);

  const requiredContracts = [
    /^begin;/iu,
    /set local lock_timeout = '5s';[\s\S]*set local statement_timeout = '90s';/iu,
    /where version = '20260809141141'\s+and name = 'workspace_server_owned_columns_controlled'/iu,
    /do \$boundary_precondition\$[\s\S]*workspace_server_owned_columns_controlled[\s\S]*current_user <> 'postgres'[\s\S]*workspace_member_boundary_member_read_invalid/iu,
    /workspace_member_boundary_partial_control_state/iu,
    /workspace_member_boundary_function_owner_invalid/iu,
    /create policy workspaces_select_requires_owner[\s\S]*as restrictive[\s\S]*for select[\s\S]*to authenticated[\s\S]*owner_user_id = \(select auth\.uid\(\)\)/iu,
    /create policy workspace_analysis_settings_select_requires_workspace_owner[\s\S]*as restrictive[\s\S]*for select[\s\S]*to authenticated[\s\S]*analysis_settings_owner_boundary\.owner_user_id/iu,
    /workspace_analysis_settings_policy_postflight_failed/iu,
    /create or replace function public\.get_current_workspace_member_safe_dashboard\(\)/iu,
    /create or replace function public\.workspace_processing_allowed_contract\([\s\S]*returns boolean[\s\S]*security invoker/iu,
    /normalized_billing_status in \('cancelled', 'expired', 'refunded'\)[\s\S]*temporary_processing_access[\s\S]*billing_manual_override/iu,
    /processing_contract_terminal_override_failed/iu,
    /processing_contract_terminal_temporary_failed/iu,
    /processing_contract_invalid_temporary_expiry_failed/iu,
    /processing_contract_invalid_grace_failed/iu,
    /processing_contract_suspended_grace_failed/iu,
    /processing_contract_active_failed/iu,
    /processing_contract_fixed_demo_failed/iu,
    /processing_contract_temporary_demo_without_db_expiry_failed/iu,
    /processing_contract_temporary_demo_with_db_expiry_failed/iu,
    /processing_contract_untrusted_demo_failed/iu,
    /create or replace function public\.workspace_owner_active_mutation_allowed\([\s\S]*owned_workspace\.owner_user_id = \(select auth\.uid\(\)\)[\s\S]*workspace_processing_allowed_contract/iu,
    /grant execute on function public\.workspace_owner_active_mutation_allowed\(uuid\)[\s\S]*to authenticated/iu,
    /security definer[\s\S]*set search_path = pg_catalog, public, pg_temp[\s\S]*set row_security = on/iu,
    /current_user_id uuid := auth\.uid\(\)/iu,
    /if membership_count <> 1 then[\s\S]*return;/iu,
    /when lower\(trim\(coalesce\(member\.role, ''\)\)\) = 'owner' then null[\s\S]*else 'member'/iu,
    /revoke all on function public\.get_current_workspace_member_safe_dashboard\(\)[\s\S]*from public, anon, authenticated, service_role/iu,
    /grant execute on function public\.get_current_workspace_member_safe_dashboard\(\)[\s\S]*to authenticated/iu,
    /as restrictive for insert to authenticated with check/iu,
    /as restrictive for update to authenticated using[\s\S]*with check/iu,
    /as restrictive for delete to authenticated using/iu,
    /public\.workspace_owner_active_mutation_allowed\(workspace_id\)/iu,
    /create policy social_connections_select_requires_workspace_owner[\s\S]*as restrictive[\s\S]*for select[\s\S]*to authenticated/iu,
    /create policy social_connections_insert_requires_workspace_owner[\s\S]*as restrictive[\s\S]*for insert[\s\S]*to authenticated/iu,
    /create policy social_connections_update_requires_workspace_owner[\s\S]*as restrictive[\s\S]*for update[\s\S]*to authenticated/iu,
    /create policy social_connections_delete_requires_workspace_owner[\s\S]*as restrictive[\s\S]*for delete[\s\S]*to authenticated/iu,
    /revoke all on table public\.social_connections[\s\S]*from public, anon, authenticated/iu,
    /revoke select \(%1\$s\), insert \(%1\$s\), update \(%1\$s\), references \(%1\$s\)[\s\S]*from public, anon, authenticated/iu,
    /grant select, insert, update, delete on table public\.social_connections[\s\S]*to service_role/iu,
    /has_any_column_privilege\('authenticated', 'public\.social_connections', 'INSERT'\)/iu,
    /has_column_privilege\([\s\S]*'page_access_token_encrypted'[\s\S]*'SELECT'/iu,
    /social_connections_service_role_boundary_failed/iu,
    /do \$control_postflight\$[\s\S]*workspace_member_boundary_workspace_select_postflight_failed[\s\S]*workspace_member_boundary_function_acl_invalid/iu,
    /commit;\s*$/iu,
  ];
  if (requiredContracts.some((contract) => !contract.test(sql))) {
    fail("control_contract_invalid");
  }

  const forbiddenContracts = [
    /\bcreate\s+table\b/iu,
    /\balter\s+table\b/iu,
    /\btruncate\b/iu,
    /\b(?:insert\s+into|update\s+public\.|delete\s+from)\b/iu,
    /\brevoke\b[\s\S]{0,200}\bon\s+table\b[\s\S]{0,200}\bfrom\s+service_role\b/iu,
    /\bgrant\s+all\b/iu,
    /\bfor\s+all\b/iu,
    /when\s+others/iu,
    /\bstable\s+stable\b/iu,
  ];
  if (forbiddenContracts.some((contract) => contract.test(sql))) {
    fail("control_contract_invalid");
  }

  return Object.freeze({ controlId: CONTROL_ID, digest });
}

function controlledFunctionBody(sql, functionName) {
  const declaration = `create or replace function public.${functionName}`;
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

export function materializeWorkspaceMemberDataBoundaryPostflight(sql) {
  evaluateWorkspaceMemberDataBoundarySql(sql);
  const replacements = [
    [
      "__FANMIND_PROCESSING_BODY_HEX__",
      "workspace_processing_allowed_contract",
    ],
    [
      "__FANMIND_MUTATION_BODY_HEX__",
      "workspace_owner_active_mutation_allowed",
    ],
    [
      "__FANMIND_DASHBOARD_BODY_HEX__",
      "get_current_workspace_member_safe_dashboard",
    ],
  ];
  let materialized = POSTFLIGHT_SQL;
  for (const [placeholder, functionName] of replacements) {
    const bodyHex = Buffer.from(
      controlledFunctionBody(sql, functionName),
      "utf8",
    ).toString("hex");
    materialized = materialized.replace(placeholder, bodyHex);
  }
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
  const evaluation = evaluateWorkspaceMemberDataBoundarySql(sql);
  console.log(
    `WORKSPACE_MEMBER_DATA_BOUNDARY_CONTROL_ID=${evaluation.controlId}`,
  );
  console.log("WORKSPACE_MEMBER_DATA_BOUNDARY_CHECKSUM=verified");
  console.log("WORKSPACE_MEMBER_DATA_BOUNDARY_CONTRACT=verified");
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
      join(tmpdir(), "fanmind-workspace-member-boundary-"),
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
      error.message.startsWith("WORKSPACE_MEMBER_DATA_BOUNDARY_ERROR=")
    ) {
      throw error;
    }
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ELOOP"
    ) {
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
    PGAPPNAME: "fanmind-workspace-member-boundary-control",
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
  console.log("WORKSPACE_MEMBER_DATA_BOUNDARY_PSQL=available");
}

function successfulPsql(result, marker) {
  return Boolean(
    !result.error && result.status === 0 && result.stdout.includes(marker),
  );
}

function preflightControlState(output) {
  const matches = [
    ...String(output).matchAll(
      /WORKSPACE_MEMBER_DATA_BOUNDARY_PREFLIGHT_STATE=(absent|present)/gu,
    ),
  ];
  if (matches.length !== 1) fail("preflight_failed");
  return matches[0][1];
}

function applySql(controlSql) {
  return String.raw`\set ON_ERROR_STOP on
set lock_timeout = '5s';
set statement_timeout = '120s';
select pg_advisory_lock(20260816, 120000);
${controlSql}
select 'WORKSPACE_MEMBER_DATA_BOUNDARY_APPLY_COMMIT=PASS';
select pg_advisory_unlock(20260816, 120000);
`;
}

function runDatabaseMode(mode, controlSql, environment) {
  const policyMode = mode === "--apply" ? "apply" : "verify";
  const evaluation = evaluateWorkspaceMemberDataBoundaryStagingEnvironment(
    environment,
    { mode: policyMode },
  );
  if (!evaluation.ok) fail("environment_invalid");

  ensurePsqlAvailable(environment);
  const postflightSql = materializeWorkspaceMemberDataBoundaryPostflight(
    controlSql,
  );
  const { snapshotDirectory, snapshotPath } =
    privatePassfileSnapshot(environment);
  try {
    if (mode === "--apply") {
      const preflight = runPsql(PRECHECK_SQL, environment, snapshotPath);
      if (
        !successfulPsql(
          preflight,
          "WORKSPACE_MEMBER_DATA_BOUNDARY_PREFLIGHT=PASS",
        )
      ) {
        fail("preflight_failed");
      }
      const controlState = preflightControlState(preflight.stdout);
      if (controlState === "present") {
        const currentVerification = runPsql(
          postflightSql,
          environment,
          snapshotPath,
        );
        if (
          !successfulPsql(
            currentVerification,
            "WORKSPACE_MEMBER_DATA_BOUNDARY_POSTFLIGHT=PASS",
          )
        ) {
          fail("preflight_failed");
        }
        console.log(
          "WORKSPACE_MEMBER_DATA_BOUNDARY_PREFLIGHT_CURRENT_STATE=verified",
        );
      }
      console.log("WORKSPACE_MEMBER_DATA_BOUNDARY_PREFLIGHT=PASS");

      const apply = runPsql(applySql(controlSql), environment, snapshotPath);
      if (
        !successfulPsql(
          apply,
          "WORKSPACE_MEMBER_DATA_BOUNDARY_APPLY_COMMIT=PASS",
        )
      ) {
        fail("apply_outcome_indeterminate");
      }
    } else {
      console.log("WORKSPACE_MEMBER_DATA_BOUNDARY_APPLY=not_requested");
    }

    const verification = runPsql(postflightSql, environment, snapshotPath);
    if (
      !successfulPsql(
        verification,
        "WORKSPACE_MEMBER_DATA_BOUNDARY_POSTFLIGHT=PASS",
      )
    ) {
      fail(mode === "--apply" ? "applied_unverified" : "postflight_failed");
    }
    if (mode === "--apply") {
      console.log("WORKSPACE_MEMBER_DATA_BOUNDARY_APPLY=completed");
    }
    console.log("WORKSPACE_MEMBER_DATA_BOUNDARY_POSTFLIGHT=PASS");
    console.log("WORKSPACE_MEMBER_DATA_BOUNDARY_POSTFLIGHT_TRANSACTION=ROLLED_BACK");
    console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
  } finally {
    rmSync(snapshotDirectory, { recursive: true, force: true });
  }
}

function main() {
  const mode = modeFromArguments(process.argv.slice(2));
  const sql = readAndVerifyControl();
  if (mode === "--check") {
    console.log("WORKSPACE_MEMBER_DATA_BOUNDARY_MODE=check");
    console.log("WORKSPACE_MEMBER_DATA_BOUNDARY_DATABASE_WRITE=not_performed");
    console.log("WORKSPACE_MEMBER_DATA_BOUNDARY_READY=CHECKED_NOT_APPLIED");
    return;
  }

  console.log(
    `WORKSPACE_MEMBER_DATA_BOUNDARY_MODE=${
      mode === "--apply" ? "apply" : "verify"
    }`,
  );
  runDatabaseMode(mode, sql, process.env);
  console.log(
    `WORKSPACE_MEMBER_DATA_BOUNDARY_READY=${
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
      /^WORKSPACE_MEMBER_DATA_BOUNDARY_ERROR=[a-z0-9_]+$/u.test(error.message)
    ) {
      console.error(error.message);
    } else {
      console.error("WORKSPACE_MEMBER_DATA_BOUNDARY_ERROR=unexpected_failure");
    }
    console.error("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
    process.exitCode = 1;
  }
}

export {
  POSTFLIGHT_SQL,
  PRECHECK_SQL,
  applySql,
};
