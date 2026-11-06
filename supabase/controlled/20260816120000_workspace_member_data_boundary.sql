begin;

set local lock_timeout = '5s';
set local statement_timeout = '90s';

-- This control narrows existing RLS. It never silently enables a missing
-- boundary because that would hide rollout-order drift.
do $rls_precondition$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'workspaces',
    'workspace_members',
    'workspace_analysis_settings',
    'contacts',
    'memories',
    'followups',
    'conversations',
    'conversation_messages',
    'conversation_summaries',
    'contact_reply_targets',
    'ai_usage_events',
    'content_sources',
    'fan_analysis_reports',
    'contact_ai_profiles',
    'workspace_voice_profiles',
    'social_connections'
  ]
  loop
    if not coalesce((
      select relation.relrowsecurity
        from pg_class as relation
       where relation.oid = to_regclass(format('public.%I', relation_name))
    ), false) then
      raise exception 'workspace_member_boundary_rls_missing: %', relation_name;
    end if;
  end loop;
end
$rls_precondition$;

-- The member boundary depends on the already-controlled server-owned
-- Workspace column boundary and on the existing member read contract. Prove
-- those facts before changing any policy or function. The same assertions are
-- repeated by the external read-only preflight, but keeping them inside this
-- transaction closes the preflight/apply gap for reviewed executions.
do $boundary_precondition$
declare
  protected_table text;
  workspace_column record;
  owner_editable_columns constant text[] := array[
    'name',
    'organization_name',
    'street_address',
    'postal_code',
    'city',
    'country',
    'vat_id',
    'tax_number',
    'company_register_number',
    'company_register_court'
  ];
  required_workspace_columns constant text[] := array[
    'id',
    'owner_user_id',
    'name',
    'plan_id',
    'workspace_access_mode',
    'subscription_effective_end_at',
    'billing_status',
    'billing_manual_override',
    'billing_grace_until',
    'billing_suspended_at',
    'test_access_flags'
  ];
  existing_control_function_count integer;
  existing_control_policy_count integer;
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise exception 'workspace_member_boundary_migration_ledger_missing';
  end if;
  if exists (
    select 1
      from supabase_migrations.schema_migrations
     where version = '20260816120000'
        or name in (
          '20260816120000_workspace_member_data_boundary',
          'workspace_member_data_boundary'
        )
  ) then
    raise exception 'workspace_member_boundary_in_generic_ledger';
  end if;
  if not exists (
    select 1
      from supabase_migrations.schema_migrations
     where version = '20260809141141'
       and name = 'workspace_server_owned_columns_controlled'
  ) then
    raise exception 'workspace_member_boundary_server_owned_ledger_missing';
  end if;

  if current_user <> 'postgres'
     or to_regrole('authenticated') is null
     or to_regrole('anon') is null
     or to_regrole('service_role') is null then
    raise exception 'workspace_member_boundary_database_role_invalid';
  end if;
  if has_schema_privilege('anon', 'public', 'CREATE')
     or has_schema_privilege('authenticated', 'public', 'CREATE') then
    raise exception 'workspace_member_boundary_public_schema_create_exposed';
  end if;

  if (
    select count(*)
      from pg_attribute as attribute
     where attribute.attrelid = 'public.workspaces'::regclass
       and attribute.attname = any(required_workspace_columns)
       and attribute.attnum > 0
       and not attribute.attisdropped
  ) <> cardinality(required_workspace_columns) then
    raise exception 'workspace_member_boundary_workspace_columns_missing';
  end if;

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

  if (
    select count(*)
      from pg_policies as policy
     where policy.schemaname = 'public'
       and policy.tablename = 'workspaces'
       and policy.policyname = 'workspaces_update_owner_boundary'
       and policy.cmd = 'UPDATE'
       and policy.permissive = 'RESTRICTIVE'
       and 'authenticated' = any(policy.roles)
       and coalesce(policy.qual, '') like '%owner_user_id%auth.uid()%'
       and coalesce(policy.with_check, '') like '%owner_user_id%auth.uid()%'
  ) <> 1
     or exists (
       select 1
         from pg_policies as policy
        where policy.schemaname = 'public'
          and policy.tablename = 'workspaces'
          and policy.policyname = 'workspaces_insert_owner'
     ) then
    raise exception 'workspace_member_boundary_server_owned_policy_invalid';
  end if;

  if not exists (
    select 1
      from pg_policies as policy
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
    'contacts',
    'memories',
    'followups',
    'conversations',
    'conversation_messages',
    'conversation_summaries',
    'contact_reply_targets',
    'ai_usage_events',
    'content_sources',
    'fan_analysis_reports',
    'contact_ai_profiles',
    'workspace_voice_profiles'
  ]
  loop
    if not exists (
      select 1
        from pg_attribute as attribute
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
         select 1
           from pg_policies as policy
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

  select count(*)
    into existing_control_function_count
    from pg_proc as function_definition
   where function_definition.oid in (
     to_regprocedure(
       'public.workspace_processing_allowed_contract(text,text,text,boolean,text,text,jsonb,timestamp with time zone)'
     ),
     to_regprocedure(
       'public.workspace_owner_active_mutation_allowed(uuid)'
     ),
     to_regprocedure(
       'public.get_current_workspace_member_safe_dashboard()'
     )
   );
  if existing_control_function_count not in (0, 3) then
    raise exception 'workspace_member_boundary_partial_function_state';
  end if;
  if exists (
    select 1
      from pg_proc as function_definition
     where function_definition.oid in (
       to_regprocedure(
         'public.workspace_processing_allowed_contract(text,text,text,boolean,text,text,jsonb,timestamp with time zone)'
       ),
       to_regprocedure(
         'public.workspace_owner_active_mutation_allowed(uuid)'
       ),
       to_regprocedure(
         'public.get_current_workspace_member_safe_dashboard()'
       )
     )
       and function_definition.proowner <> to_regrole('postgres')
  ) then
    raise exception 'workspace_member_boundary_function_owner_invalid';
  end if;

  select count(*)
    into existing_control_policy_count
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
           'contacts',
           'memories',
           'followups',
           'conversations',
           'conversation_messages',
           'conversation_summaries',
           'contact_reply_targets',
           'ai_usage_events',
           'content_sources',
           'fan_analysis_reports',
           'contact_ai_profiles',
           'workspace_voice_profiles'
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
$boundary_precondition$;

-- Team members must never read the base workspace row. That row contains
-- billing, Stripe, invoice, legal/tax, address and server-owned test fields.
-- The existing permissive owner-or-member policy may remain for compatibility;
-- this restrictive policy reduces authenticated base-table reads to owners.
drop policy if exists workspaces_select_requires_owner
  on public.workspaces;
create policy workspaces_select_requires_owner
  on public.workspaces
  as restrictive
  for select
  to authenticated
  using (
    owner_user_id = (select auth.uid())
  );

-- Analysis activation includes legal-basis, transparency, DPA, retention,
-- data-subject-rights and confirmer metadata. Members do not need that
-- administrative/legal row for the read-only CRM contract.
drop policy if exists workspace_analysis_settings_select_requires_workspace_owner
  on public.workspace_analysis_settings;
create policy workspace_analysis_settings_select_requires_workspace_owner
  on public.workspace_analysis_settings
  as restrictive
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.workspaces as analysis_settings_owner_boundary
       where analysis_settings_owner_boundary.id =
             workspace_analysis_settings.workspace_id
         and analysis_settings_owner_boundary.owner_user_id =
             (select auth.uid())
    )
  );

-- One DB-native processing predicate is shared by the member-safe projection
-- and every direct authenticated mutation boundary below. Text timestamp
-- inputs make malformed-value handling explicit and keep the behavior aligned
-- with the application contract instead of relying on implicit casts.
create or replace function public.workspace_processing_allowed_contract(
  p_workspace_access_mode text,
  p_subscription_effective_end_at text,
  p_billing_status text,
  p_billing_manual_override boolean,
  p_billing_grace_until text,
  p_billing_suspended_at text,
  p_test_access_flags jsonb,
  p_evaluated_at timestamptz
)
returns boolean
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  normalized_billing_status text :=
    lower(trim(coalesce(p_billing_status, '')));
  effective_end_at timestamptz;
  grace_until timestamptz;
  temporary_expiry_text text;
  temporary_expiry timestamptz;
begin
  if lower(trim(coalesce(p_workspace_access_mode, ''))) <> 'active' then
    return false;
  end if;

  if nullif(trim(coalesce(p_subscription_effective_end_at, '')), '')
     is not null then
    begin
      effective_end_at := p_subscription_effective_end_at::timestamptz;
    exception
      when invalid_datetime_format or datetime_field_overflow then
        return false;
    end;
    if effective_end_at <= p_evaluated_at then
      return false;
    end if;
  end if;

  -- Terminal billing always wins, including over temporary/manual access.
  if normalized_billing_status in ('cancelled', 'expired', 'refunded') then
    return false;
  end if;

  if p_test_access_flags -> 'temporary_processing_access' = 'true'::jsonb then
    temporary_expiry_text :=
      p_test_access_flags ->> 'temporary_processing_access_expires_at';
    if nullif(trim(coalesce(temporary_expiry_text, '')), '') is null then
      return false;
    end if;
    begin
      temporary_expiry := temporary_expiry_text::timestamptz;
    exception
      when invalid_datetime_format or datetime_field_overflow then
        return false;
    end;
    return temporary_expiry > p_evaluated_at;
  end if;

  -- test_access_flags is protected by the prerequisite server-owned Workspace
  -- control. A bare demo_free billing value is never sufficient.
  if normalized_billing_status = 'demo_free'
     and p_test_access_flags ->> 'fixed_demo_seed_version' =
         '2026-07-26-v1' then
    return true;
  end if;

  if p_billing_manual_override is true then
    return true;
  end if;

  if nullif(trim(coalesce(p_billing_grace_until, '')), '') is not null then
    begin
      grace_until := p_billing_grace_until::timestamptz;
    exception
      when invalid_datetime_format or datetime_field_overflow then
        return false;
    end;
  end if;

  if normalized_billing_status in ('past_due', 'payment_failed', 'suspended')
     and grace_until > p_evaluated_at then
    return true;
  end if;

  if normalized_billing_status = 'suspended'
     or nullif(trim(coalesce(p_billing_suspended_at, '')), '') is not null then
    return false;
  end if;

  return normalized_billing_status = 'active';
end
$function$;

revoke all on function public.workspace_processing_allowed_contract(
  text,
  text,
  text,
  boolean,
  text,
  text,
  jsonb,
  timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.workspace_processing_allowed_contract(
  text,
  text,
  text,
  boolean,
  text,
  text,
  jsonb,
  timestamptz
) to authenticated;

-- Fail the controlled transaction if the canonical predicate drifts from the
-- application order or from its fail-closed malformed timestamp behavior.
do $processing_contract$
declare
  evaluated_at constant timestamptz := timestamptz '2026-08-16 12:00:00+00';
begin
  if public.workspace_processing_allowed_contract(
       'active', null, 'cancelled', true, null, null, '{}'::jsonb, evaluated_at
     ) then
    raise exception 'processing_contract_terminal_override_failed';
  end if;
  if public.workspace_processing_allowed_contract(
       'active',
       null,
       'refunded',
       false,
       null,
       null,
       '{"temporary_processing_access":true,"temporary_processing_access_expires_at":"2099-01-01T00:00:00Z"}'::jsonb,
       evaluated_at
     ) then
    raise exception 'processing_contract_terminal_temporary_failed';
  end if;
  if public.workspace_processing_allowed_contract(
       'active',
       null,
       'active',
       false,
       null,
       null,
       '{"temporary_processing_access":true,"temporary_processing_access_expires_at":"not-a-timestamp"}'::jsonb,
       evaluated_at
     ) then
    raise exception 'processing_contract_invalid_temporary_expiry_failed';
  end if;
  if public.workspace_processing_allowed_contract(
       'active', null, 'payment_failed', false, 'not-a-timestamp', null,
       '{}'::jsonb, evaluated_at
     ) then
    raise exception 'processing_contract_invalid_grace_failed';
  end if;
  if not public.workspace_processing_allowed_contract(
       'active', null, 'suspended', false, '2026-08-17T12:00:00Z', null,
       '{}'::jsonb, evaluated_at
     ) then
    raise exception 'processing_contract_suspended_grace_failed';
  end if;
  if not public.workspace_processing_allowed_contract(
       'active', null, 'active', false, null, null, '{}'::jsonb, evaluated_at
     ) then
    raise exception 'processing_contract_active_failed';
  end if;
  if not public.workspace_processing_allowed_contract(
       'active', null, 'demo_free', false, null, null,
       '{"fixed_demo_seed_version":"2026-07-26-v1"}'::jsonb, evaluated_at
     ) then
    raise exception 'processing_contract_fixed_demo_failed';
  end if;
  if public.workspace_processing_allowed_contract(
       'active', null, 'demo_free', false, null, null,
       '{"temporary_demo":true}'::jsonb, evaluated_at
     ) then
    raise exception 'processing_contract_temporary_demo_without_db_expiry_failed';
  end if;
  if not public.workspace_processing_allowed_contract(
       'active',
       null,
       'demo_free',
       false,
       null,
       null,
       '{"temporary_demo":true,"temporary_processing_access":true,"temporary_processing_access_expires_at":"2026-08-16T13:00:00Z"}'::jsonb,
       evaluated_at
     ) then
    raise exception 'processing_contract_temporary_demo_with_db_expiry_failed';
  end if;
  if public.workspace_processing_allowed_contract(
       'active', null, 'demo_free', false, null, null, '{}'::jsonb, evaluated_at
     ) then
    raise exception 'processing_contract_untrusted_demo_failed';
  end if;
end
$processing_contract$;

-- Browser mutations require both real Workspace ownership and the canonical
-- DB processing entitlement. Members always receive false. Server service-role
-- flows intentionally do not use this helper and remain a separately audited
-- pre-existing TOCTOU boundary until mutations move to atomic DB RPCs.
create or replace function public.workspace_owner_active_mutation_allowed(
  p_workspace_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public, pg_temp
set row_security = on
as $function$
  select exists (
    select 1
      from public.workspaces as owned_workspace
     where owned_workspace.id = p_workspace_id
       and owned_workspace.owner_user_id = (select auth.uid())
       and public.workspace_processing_allowed_contract(
         owned_workspace.workspace_access_mode,
         owned_workspace.subscription_effective_end_at::text,
         owned_workspace.billing_status,
         owned_workspace.billing_manual_override,
         owned_workspace.billing_grace_until::text,
         owned_workspace.billing_suspended_at::text,
         owned_workspace.test_access_flags,
         statement_timestamp()
       )
  );
$function$;

revoke all on function public.workspace_owner_active_mutation_allowed(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.workspace_owner_active_mutation_allowed(uuid)
  to authenticated;

-- This is the only browser-callable member projection. It accepts no caller
-- supplied Workspace ID, resolves exactly one membership from auth.uid(), and
-- returns only the fields needed to route a member through the read-only CRM.
create or replace function public.get_current_workspace_member_safe_dashboard()
returns table (
  workspace_id uuid,
  workspace_name text,
  plan_id text,
  membership_role text,
  member_processing_allowed boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
set row_security = on
as $function$
declare
  current_user_id uuid := auth.uid();
  membership_count integer;
  selected_workspace_id uuid;
  selected_workspace_name text;
  selected_plan_id text;
  selected_membership_role text;
  processing_allowed boolean := false;
begin
  if current_user_id is null then
    return;
  end if;

  select count(*)::integer
    into membership_count
    from public.workspace_members as member
   where member.user_id = current_user_id;

  if membership_count <> 1 then
    return;
  end if;

  select
    workspace.id,
    workspace.name,
    workspace.plan_id::text,
    case
      when lower(trim(coalesce(member.role, ''))) = 'owner' then null
      else 'member'
    end,
    public.workspace_processing_allowed_contract(
      workspace.workspace_access_mode,
      workspace.subscription_effective_end_at::text,
      workspace.billing_status,
      workspace.billing_manual_override,
      workspace.billing_grace_until::text,
      workspace.billing_suspended_at::text,
      workspace.test_access_flags,
      statement_timestamp()
    )
  into
    selected_workspace_id,
    selected_workspace_name,
    selected_plan_id,
    selected_membership_role,
    processing_allowed
  from public.workspace_members as member
  join public.workspaces as workspace
    on workspace.id = member.workspace_id
  where member.user_id = current_user_id;

  if selected_workspace_id is null or selected_membership_role is null then
    return;
  end if;

  return query
  select
    selected_workspace_id,
    selected_workspace_name,
    selected_plan_id,
    selected_membership_role,
    processing_allowed;
end
$function$;

revoke all on function public.get_current_workspace_member_safe_dashboard()
  from public, anon, authenticated, service_role;
grant execute on function public.get_current_workspace_member_safe_dashboard()
  to authenticated;

-- Existing permissive membership policies continue to provide CRM reads.
-- These restrictive command-specific policies leave SELECT untouched while
-- denying every direct authenticated mutation unless the JWT user owns an
-- actively entitled Workspace. A future member-write rollout must use a separately
-- reviewed atomic RPC; a successful RLS postflight alone is not activation.
do $policies$
declare
  protected_table text;
  insert_policy text;
  update_policy text;
  delete_policy text;
begin
  foreach protected_table in array array[
    'contacts',
    'memories',
    'followups',
    'conversations',
    'conversation_messages',
    'conversation_summaries',
    'contact_reply_targets',
    'ai_usage_events',
    'content_sources',
    'fan_analysis_reports',
    'contact_ai_profiles',
    'workspace_voice_profiles'
  ]
  loop
    if to_regclass(format('public.%I', protected_table)) is null then
      raise exception 'required_member_writable_table_missing';
    end if;

    insert_policy := protected_table || '_insert_requires_workspace_owner';
    update_policy := protected_table || '_update_requires_workspace_owner';
    delete_policy := protected_table || '_delete_requires_workspace_owner';

    execute format(
      'drop policy if exists %I on public.%I',
      insert_policy,
      protected_table
    );
    execute format(
      'create policy %I on public.%I as restrictive for insert to authenticated with check (public.workspace_owner_active_mutation_allowed(workspace_id))',
      insert_policy,
      protected_table
    );

    execute format(
      'drop policy if exists %I on public.%I',
      update_policy,
      protected_table
    );
    execute format(
      'create policy %I on public.%I as restrictive for update to authenticated using (public.workspace_owner_active_mutation_allowed(workspace_id)) with check (public.workspace_owner_active_mutation_allowed(workspace_id))',
      update_policy,
      protected_table
    );

    execute format(
      'drop policy if exists %I on public.%I',
      delete_policy,
      protected_table
    );
    execute format(
      'create policy %I on public.%I as restrictive for delete to authenticated using (public.workspace_owner_active_mutation_allowed(workspace_id))',
      delete_policy,
      protected_table
    );
  end loop;
end
$policies$;

-- Connector bindings and status are administrative data. The historical
-- permissive policies and column grants are reduced by restrictive policies;
-- service_role continues to bypass RLS for reviewed server-side flows.
revoke all on table public.social_connections
  from public, anon, authenticated;

-- Table-level REVOKE does not clear historical per-column grants. Remove all
-- browser column privileges dynamically before restoring the exact public
-- read projection used by SOCIAL_CONNECTION_PUBLIC_COLUMNS in server.ts.
do $social_column_revoke$
declare
  all_columns text;
begin
  select string_agg(format('%I', attribute.attname), ', ' order by attribute.attnum)
    into all_columns
    from pg_attribute as attribute
   where attribute.attrelid = 'public.social_connections'::regclass
     and attribute.attnum > 0
     and not attribute.attisdropped;

  if all_columns is null then
    raise exception 'social_connections_privilege_no_columns';
  end if;

  execute format(
    'revoke select (%1$s), insert (%1$s), update (%1$s), references (%1$s) on table public.social_connections from public, anon, authenticated',
    all_columns
  );
end
$social_column_revoke$;

grant select (
  id,
  workspace_id,
  platform,
  provider,
  status,
  external_account_id,
  external_account_name,
  page_id,
  page_name,
  token_last_four,
  scopes,
  webhook_subscribed,
  connected_by,
  connected_at,
  disconnected_at,
  last_event_at,
  last_comment_fetch_at,
  last_comment_fetch_count,
  last_comment_fetch_error,
  last_messenger_sync_at,
  last_messenger_sync_checked_count,
  last_messenger_sync_imported_inbound_count,
  last_messenger_sync_imported_outbound_count,
  last_messenger_sync_imported_media_count,
  last_messenger_sync_skipped_count,
  last_messenger_sync_error,
  last_messenger_sync_outbound_at,
  created_at,
  updated_at
) on table public.social_connections
  to authenticated;

-- All secret/mutation paths already use service_role. State that contract
-- explicitly so this boundary cannot accidentally remove server access.
grant select, insert, update, delete on table public.social_connections
  to service_role;

drop policy if exists social_connections_select_requires_workspace_owner
  on public.social_connections;
create policy social_connections_select_requires_workspace_owner
  on public.social_connections
  as restrictive
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.workspaces as workspace_owner_boundary
       where workspace_owner_boundary.id = social_connections.workspace_id
         and workspace_owner_boundary.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists social_connections_insert_requires_workspace_owner
  on public.social_connections;
create policy social_connections_insert_requires_workspace_owner
  on public.social_connections
  as restrictive
  for insert
  to authenticated
  with check (
    public.workspace_owner_active_mutation_allowed(
      workspace_id
    )
  );

drop policy if exists social_connections_update_requires_workspace_owner
  on public.social_connections;
create policy social_connections_update_requires_workspace_owner
  on public.social_connections
  as restrictive
  for update
  to authenticated
  using (
    public.workspace_owner_active_mutation_allowed(
      workspace_id
    )
  )
  with check (
    public.workspace_owner_active_mutation_allowed(
      workspace_id
    )
  );

drop policy if exists social_connections_delete_requires_workspace_owner
  on public.social_connections;
create policy social_connections_delete_requires_workspace_owner
  on public.social_connections
  as restrictive
  for delete
  to authenticated
  using (
    public.workspace_owner_active_mutation_allowed(
      workspace_id
    )
  );

do $policy_postflight$
declare
  protected_table text;
  policy_record record;
begin
  foreach protected_table in array array[
    'contacts',
    'memories',
    'followups',
    'conversations',
    'conversation_messages',
    'conversation_summaries',
    'contact_reply_targets',
    'ai_usage_events',
    'content_sources',
    'fan_analysis_reports',
    'contact_ai_profiles',
    'workspace_voice_profiles'
  ]
  loop
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
         and 'authenticated' = any(policy.roles)
    loop
      if policy_record.cmd = 'INSERT'
         and coalesce(policy_record.with_check, '') not like
           '%workspace_owner_active_mutation_allowed(workspace_id)%' then
        raise exception 'workspace_member_insert_policy_postflight_failed: %',
          protected_table;
      elsif policy_record.cmd = 'UPDATE'
         and (
           coalesce(policy_record.qual, '') not like
             '%workspace_owner_active_mutation_allowed(workspace_id)%'
           or coalesce(policy_record.with_check, '') not like
             '%workspace_owner_active_mutation_allowed(workspace_id)%'
         ) then
        raise exception 'workspace_member_update_policy_postflight_failed: %',
          protected_table;
      elsif policy_record.cmd = 'DELETE'
         and coalesce(policy_record.qual, '') not like
           '%workspace_owner_active_mutation_allowed(workspace_id)%' then
        raise exception 'workspace_member_delete_policy_postflight_failed: %',
          protected_table;
      end if;
    end loop;

    if (
      select count(*)
        from pg_policies as policy
       where policy.schemaname = 'public'
         and policy.tablename = protected_table
         and policy.policyname in (
           protected_table || '_insert_requires_workspace_owner',
           protected_table || '_update_requires_workspace_owner',
           protected_table || '_delete_requires_workspace_owner'
         )
         and policy.permissive = 'RESTRICTIVE'
         and 'authenticated' = any(policy.roles)
    ) <> 3 then
      raise exception 'workspace_member_policy_count_postflight_failed: %',
        protected_table;
    end if;
  end loop;

  if (
    select count(*)
      from pg_policies as policy
     where policy.schemaname = 'public'
       and policy.tablename = 'social_connections'
       and policy.policyname in (
         'social_connections_select_requires_workspace_owner',
         'social_connections_insert_requires_workspace_owner',
         'social_connections_update_requires_workspace_owner',
         'social_connections_delete_requires_workspace_owner'
       )
       and policy.permissive = 'RESTRICTIVE'
       and 'authenticated' = any(policy.roles)
  ) <> 4 then
    raise exception 'social_connections_policy_count_postflight_failed';
  end if;

  if (
    select count(*)
      from pg_policies as policy
     where policy.schemaname = 'public'
       and policy.tablename = 'workspace_analysis_settings'
       and policy.policyname =
           'workspace_analysis_settings_select_requires_workspace_owner'
       and policy.cmd = 'SELECT'
       and policy.permissive = 'RESTRICTIVE'
       and 'authenticated' = any(policy.roles)
       and coalesce(policy.qual, '') like
           '%analysis_settings_owner_boundary.owner_user_id%'
       and coalesce(policy.qual, '') like '%auth.uid()%'
  ) <> 1 then
    raise exception 'workspace_analysis_settings_policy_postflight_failed';
  end if;
end
$policy_postflight$;

-- Transaction-local postflight: prove the exact inherited ACL result before
-- commit. This catches stale PUBLIC column grants as well as future columns.
do $social_privilege_postflight$
declare
  column_record record;
  public_select_columns constant text[] := array[
    'id',
    'workspace_id',
    'platform',
    'provider',
    'status',
    'external_account_id',
    'external_account_name',
    'page_id',
    'page_name',
    'token_last_four',
    'scopes',
    'webhook_subscribed',
    'connected_by',
    'connected_at',
    'disconnected_at',
    'last_event_at',
    'last_comment_fetch_at',
    'last_comment_fetch_count',
    'last_comment_fetch_error',
    'last_messenger_sync_at',
    'last_messenger_sync_checked_count',
    'last_messenger_sync_imported_inbound_count',
    'last_messenger_sync_imported_outbound_count',
    'last_messenger_sync_imported_media_count',
    'last_messenger_sync_skipped_count',
    'last_messenger_sync_error',
    'last_messenger_sync_outbound_at',
    'created_at',
    'updated_at'
  ];
begin
  if has_table_privilege('anon', 'public.social_connections', 'SELECT')
     or has_table_privilege('authenticated', 'public.social_connections', 'SELECT')
     or has_table_privilege('anon', 'public.social_connections', 'INSERT')
     or has_table_privilege('authenticated', 'public.social_connections', 'INSERT')
     or has_table_privilege('anon', 'public.social_connections', 'UPDATE')
     or has_table_privilege('authenticated', 'public.social_connections', 'UPDATE')
     or has_table_privilege('anon', 'public.social_connections', 'DELETE')
     or has_table_privilege('authenticated', 'public.social_connections', 'DELETE')
     or has_any_column_privilege('anon', 'public.social_connections', 'SELECT')
     or has_any_column_privilege('anon', 'public.social_connections', 'INSERT')
     or has_any_column_privilege('authenticated', 'public.social_connections', 'INSERT')
     or has_any_column_privilege('anon', 'public.social_connections', 'UPDATE')
     or has_any_column_privilege('authenticated', 'public.social_connections', 'UPDATE')
     or has_any_column_privilege('anon', 'public.social_connections', 'REFERENCES')
     or has_any_column_privilege('authenticated', 'public.social_connections', 'REFERENCES')
     or not has_any_column_privilege(
       'authenticated', 'public.social_connections', 'SELECT'
     ) then
    raise exception 'social_connections_table_acl_boundary_failed';
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
         'anon', 'public.social_connections', column_record.column_name, 'INSERT'
       )
       or has_column_privilege(
         'authenticated', 'public.social_connections', column_record.column_name, 'INSERT'
       )
       or has_column_privilege(
         'anon', 'public.social_connections', column_record.column_name, 'UPDATE'
       )
       or has_column_privilege(
         'authenticated', 'public.social_connections', column_record.column_name, 'UPDATE'
       )
       or has_column_privilege(
         'anon', 'public.social_connections', column_record.column_name, 'REFERENCES'
       )
       or has_column_privilege(
         'authenticated', 'public.social_connections', column_record.column_name, 'REFERENCES'
       )
       or has_column_privilege(
         'authenticated',
         'public.social_connections',
         column_record.column_name,
         'SELECT'
       ) is distinct from
          (column_record.column_name = any(public_select_columns)) then
      raise exception 'social_connections_column_acl_boundary_failed: %',
        column_record.column_name;
    end if;
  end loop;

  if not has_table_privilege('service_role', 'public.social_connections', 'SELECT')
     or not has_table_privilege('service_role', 'public.social_connections', 'INSERT')
     or not has_table_privilege('service_role', 'public.social_connections', 'UPDATE')
     or not has_table_privilege('service_role', 'public.social_connections', 'DELETE') then
    raise exception 'social_connections_service_role_boundary_failed';
  end if;

  if has_column_privilege(
       'authenticated',
       'public.social_connections',
       'page_access_token_encrypted',
       'SELECT'
     ) then
    raise exception 'social_connections_token_ciphertext_exposed';
  end if;
end
$social_privilege_postflight$;

-- Complete the transaction-local proof. CREATE OR REPLACE deliberately keeps
-- an existing function owner and ACL, so those facts must be checked rather
-- than inferred from the reviewed source text.
do $control_postflight$
declare
  processing_oid oid := to_regprocedure(
    'public.workspace_processing_allowed_contract(text,text,text,boolean,text,text,jsonb,timestamp with time zone)'
  );
  mutation_oid oid := to_regprocedure(
    'public.workspace_owner_active_mutation_allowed(uuid)'
  );
  dashboard_oid oid := to_regprocedure(
    'public.get_current_workspace_member_safe_dashboard()'
  );
  function_record record;
  relation_name text;
begin
  if current_user <> 'postgres'
     or to_regclass('supabase_migrations.schema_migrations') is null
     or not exists (
       select 1
         from supabase_migrations.schema_migrations
        where version = '20260809141141'
          and name = 'workspace_server_owned_columns_controlled'
     )
     or has_schema_privilege('anon', 'public', 'CREATE')
     or has_schema_privilege('authenticated', 'public', 'CREATE') then
    raise exception 'workspace_member_boundary_foundation_postflight_failed';
  end if;

  if exists (
    select 1
      from supabase_migrations.schema_migrations
     where version = '20260816120000'
        or name in (
          '20260816120000_workspace_member_data_boundary',
          'workspace_member_data_boundary'
        )
  ) then
    raise exception 'workspace_member_boundary_generic_ledger_postflight_failed';
  end if;

  foreach relation_name in array array[
    'workspaces',
    'workspace_members',
    'workspace_analysis_settings',
    'contacts',
    'memories',
    'followups',
    'conversations',
    'conversation_messages',
    'conversation_summaries',
    'contact_reply_targets',
    'ai_usage_events',
    'content_sources',
    'fan_analysis_reports',
    'contact_ai_profiles',
    'workspace_voice_profiles',
    'social_connections'
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
    select count(*)
      from pg_policies as policy
     where policy.schemaname = 'public'
       and policy.tablename = 'workspaces'
       and policy.policyname = 'workspaces_select_requires_owner'
       and policy.cmd = 'SELECT'
       and policy.permissive = 'RESTRICTIVE'
       and policy.roles = array['authenticated']::name[]
       and coalesce(policy.qual, '') like '%owner_user_id%auth.uid()%'
  ) <> 1 then
    raise exception 'workspace_member_boundary_workspace_select_postflight_failed';
  end if;

  if (
    select count(*)
      from pg_policies as policy
     where policy.schemaname = 'public'
       and policy.tablename = 'social_connections'
       and policy.policyname =
           'social_connections_select_requires_workspace_owner'
       and policy.cmd = 'SELECT'
       and policy.permissive = 'RESTRICTIVE'
       and policy.roles = array['authenticated']::name[]
       and coalesce(policy.qual, '') like
           '%workspace_owner_boundary.owner_user_id%auth.uid()%'
  ) <> 1
     or (
       select count(*)
         from pg_policies as policy
        where policy.schemaname = 'public'
          and policy.tablename = 'social_connections'
          and policy.policyname =
              'social_connections_insert_requires_workspace_owner'
          and policy.cmd = 'INSERT'
          and policy.permissive = 'RESTRICTIVE'
          and policy.roles = array['authenticated']::name[]
          and coalesce(policy.with_check, '') like
              '%workspace_owner_active_mutation_allowed(workspace_id)%'
     ) <> 1
     or (
       select count(*)
         from pg_policies as policy
        where policy.schemaname = 'public'
          and policy.tablename = 'social_connections'
          and policy.policyname =
              'social_connections_update_requires_workspace_owner'
          and policy.cmd = 'UPDATE'
          and policy.permissive = 'RESTRICTIVE'
          and policy.roles = array['authenticated']::name[]
          and coalesce(policy.qual, '') like
              '%workspace_owner_active_mutation_allowed(workspace_id)%'
          and coalesce(policy.with_check, '') like
              '%workspace_owner_active_mutation_allowed(workspace_id)%'
     ) <> 1
     or (
       select count(*)
         from pg_policies as policy
        where policy.schemaname = 'public'
          and policy.tablename = 'social_connections'
          and policy.policyname =
              'social_connections_delete_requires_workspace_owner'
          and policy.cmd = 'DELETE'
          and policy.permissive = 'RESTRICTIVE'
          and policy.roles = array['authenticated']::name[]
          and coalesce(policy.qual, '') like
              '%workspace_owner_active_mutation_allowed(workspace_id)%'
     ) <> 1 then
    raise exception 'workspace_member_boundary_social_policy_postflight_failed';
  end if;

  if processing_oid is null
     or mutation_oid is null
     or dashboard_oid is null then
    raise exception 'workspace_member_boundary_function_missing';
  end if;

  if not exists (
    select 1
      from pg_proc as function_definition
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
       and position(
         'normalized_billing_status in (''cancelled'', ''expired'', ''refunded'')'
         in function_definition.prosrc
       ) > 0
       and position(
         'temporary_processing_access_expires_at'
         in function_definition.prosrc
       ) > 0
  ) then
    raise exception 'workspace_member_boundary_processing_function_invalid';
  end if;

  if not exists (
    select 1
      from pg_proc as function_definition
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
         'search_path=pg_catalog, public, pg_temp',
         'row_security=on'
       ]::text[]
       and position('owned_workspace.owner_user_id' in function_definition.prosrc) > 0
       and position(
         'workspace_processing_allowed_contract'
         in function_definition.prosrc
       ) > 0
  ) then
    raise exception 'workspace_member_boundary_mutation_function_invalid';
  end if;

  if not exists (
    select 1
      from pg_proc as function_definition
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
         'uuid'::regtype,
         'text'::regtype,
         'text'::regtype,
         'text'::regtype,
         'boolean'::regtype
       ]::oid[]
       and function_definition.proargmodes =
           array['t', 't', 't', 't', 't']::"char"[]
       and function_definition.proargnames = array[
         'workspace_id',
         'workspace_name',
         'plan_id',
         'membership_role',
         'member_processing_allowed'
       ]::text[]
       and function_definition.proconfig = array[
         'search_path=pg_catalog, public, pg_temp',
         'row_security=on'
       ]::text[]
       and position('current_user_id uuid := auth.uid()' in function_definition.prosrc) > 0
       and position('membership_count <> 1' in function_definition.prosrc) > 0
  ) then
    raise exception 'workspace_member_boundary_dashboard_function_invalid';
  end if;

  for function_record in
    select function_definition.oid, function_definition.proowner
      from pg_proc as function_definition
     where function_definition.oid in (
       processing_oid,
       mutation_oid,
       dashboard_oid
     )
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
               (select checked_function.proacl
                  from pg_proc as checked_function
                 where checked_function.oid = function_record.oid),
               acldefault('f', function_record.proowner)
             )
           ) as function_acl
       ), false) then
      raise exception 'workspace_member_boundary_function_acl_invalid';
    end if;
  end loop;
end
$control_postflight$;

commit;
