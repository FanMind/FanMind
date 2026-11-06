-- Controlled server-owned provisioning boundary for the exceptional public
-- internal_daily_test registration window. The authenticated Starter RPC
-- deliberately remains Starter-only: only FanMind's service role may bind a
-- verified Auth user to the fixed Daily terms below.

begin;

-- Keep generic Supabase migration discovery/history separate from this
-- controlled transaction, including while the SQL is being applied.
do $control$
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise exception 'controlled_migration_ledger_missing';
  end if;

  execute
    'lock table supabase_migrations.schema_migrations in share mode';

  if exists (
    select 1
      from supabase_migrations.schema_migrations
     where version = '20260808230102'
  ) then
    raise exception 'controlled_sql_found_in_generic_ledger';
  end if;
end
$control$;

-- Expand the two canonical Workspace checks before the RPC can write its
-- fixed values. NOT VALID starts enforcing the wider contract for new writes
-- immediately; validation proves all existing rows before the old checks are
-- removed in the same transaction.
alter table public.workspaces
  add constraint workspaces_commercial_option_daily_check
  check (
    commercial_option in (
      'pilot_only',
      'starter_paid_setup',
      'starter_no_setup_commitment',
      'internal_daily_test'
    )
  ) not valid;

alter table public.workspaces
  validate constraint workspaces_commercial_option_daily_check;

alter table public.workspaces
  drop constraint if exists workspaces_commercial_option_check;

alter table public.workspaces
  rename constraint workspaces_commercial_option_daily_check
  to workspaces_commercial_option_check;

alter table public.workspaces
  add constraint workspaces_payment_collection_method_daily_check
  check (
    payment_collection_method is null
    or payment_collection_method in (
      'none',
      'manual_invoice',
      'sepa_direct_debit',
      'card'
    )
  ) not valid;

alter table public.workspaces
  validate constraint workspaces_payment_collection_method_daily_check;

alter table public.workspaces
  drop constraint if exists workspaces_payment_collection_method_check;

alter table public.workspaces
  rename constraint workspaces_payment_collection_method_daily_check
  to workspaces_payment_collection_method_check;

create or replace function public.ensure_internal_daily_test_workspace(
  p_user_id uuid,
  p_workspace_name text,
  p_payment_terms_accepted boolean
)
returns table (
  workspace_id uuid,
  created boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  v_workspace_id uuid;
  v_workspace_name text;
  v_created boolean := false;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception
      using
        errcode = '42501',
        message = 'daily_test_provisioning_service_role_required';
  end if;

  if p_user_id is null or not exists (
    select 1
      from auth.users as auth_user
     where auth_user.id = p_user_id
  ) then
    raise exception
      using
        errcode = '22023',
        message = 'daily_test_provisioning_invalid_user';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select workspace.id
    into v_workspace_id
    from public.workspaces as workspace
   where workspace.owner_user_id = p_user_id;

  if v_workspace_id is null then
    v_workspace_name :=
      coalesce(nullif(btrim(p_workspace_name), ''), 'FanMind Workspace');

    if char_length(v_workspace_name) > 160 then
      raise exception
        using
          errcode = '22023',
          message = 'daily_test_provisioning_invalid_name';
    end if;

    if p_payment_terms_accepted is distinct from true then
      raise exception
        using
          errcode = '23514',
          message = 'daily_test_provisioning_terms_required';
    end if;

    insert into public.workspaces (
      name,
      owner_user_id,
      plan_id,
      commercial_option,
      setup_fee_cents,
      monthly_fee_cents,
      commitment_months,
      billing_status,
      billing_provider,
      payment_collection_method,
      billing_manual_override,
      payment_terms_version,
      payment_terms_accepted_at,
      payment_terms_accepted_by_user_id,
      test_access_flags,
      workspace_access_mode,
      billing_updated_at,
      billing_updated_by_user_id
    )
    values (
      v_workspace_name,
      p_user_id,
      'pilot',
      'internal_daily_test',
      0,
      0,
      0,
      'pending_payment_setup',
      'stripe',
      'card',
      false,
      '2026-06-v1',
      statement_timestamp(),
      p_user_id,
      '{}'::jsonb,
      'active',
      statement_timestamp(),
      p_user_id
    )
    returning id into v_workspace_id;

    v_created := true;
  end if;

  insert into public.workspace_members as workspace_member (
    workspace_id,
    user_id,
    role
  )
  values (
    v_workspace_id,
    p_user_id,
    'owner'
  )
  on conflict on constraint workspace_members_workspace_id_user_id_key
  do update
    set role = excluded.role
  where workspace_member.role is distinct from excluded.role;

  return query
    select v_workspace_id, v_created;
end
$function$;

revoke all on function public.ensure_internal_daily_test_workspace(
  uuid,
  text,
  boolean
) from public, anon, authenticated;

grant execute on function public.ensure_internal_daily_test_workspace(
  uuid,
  text,
  boolean
) to service_role;

comment on function public.ensure_internal_daily_test_workspace(
  uuid,
  text,
  boolean
) is
  'Atomically returns or creates one fixed internal_daily_test workspace and owner membership for a server-verified Auth user. Callable only by service_role.';

-- The application must not expose or enable the public Daily window merely
-- because the RPC exists. Readiness becomes true only after the separate
-- Workspace contract has also removed every browser INSERT capability.
create or replace function public.internal_daily_test_workspace_provisioning_ready()
returns table (ready boolean)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
  select
    auth.role() = 'service_role'
    and to_regprocedure(
      'public.ensure_internal_daily_test_workspace(uuid,text,boolean)'
    ) is not null
    and has_function_privilege(
      'service_role',
      'public.ensure_internal_daily_test_workspace(uuid,text,boolean)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.ensure_internal_daily_test_workspace(uuid,text,boolean)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.ensure_internal_daily_test_workspace(uuid,text,boolean)',
      'EXECUTE'
    )
    -- Full-definition equality is intentionally fail-closed: merely finding
    -- the Daily literal would also accept a widened or otherwise weakened
    -- CHECK contract.
    and exists (
      select 1
        from pg_constraint as constraint_record
       where constraint_record.conrelid = 'public.workspaces'::regclass
         and constraint_record.conname =
               'workspaces_commercial_option_check'
         and constraint_record.contype = 'c'
         and constraint_record.convalidated
         and pg_get_constraintdef(constraint_record.oid, true) =
           $commercial_option_contract$CHECK (commercial_option = ANY (ARRAY['pilot_only'::text, 'starter_paid_setup'::text, 'starter_no_setup_commitment'::text, 'internal_daily_test'::text]))$commercial_option_contract$
    )
    and exists (
      select 1
        from pg_constraint as constraint_record
       where constraint_record.conrelid = 'public.workspaces'::regclass
         and constraint_record.conname =
               'workspaces_payment_collection_method_check'
         and constraint_record.contype = 'c'
         and constraint_record.convalidated
         and pg_get_constraintdef(constraint_record.oid, true) =
           $payment_collection_contract$CHECK (payment_collection_method IS NULL OR (payment_collection_method = ANY (ARRAY['none'::text, 'manual_invoice'::text, 'sepa_direct_debit'::text, 'card'::text])))$payment_collection_contract$
    )
    and exists (
      select 1
        from pg_index as index_record
       where index_record.indexrelid =
               to_regclass('public.workspaces_owner_user_id_uidx')
         and index_record.indrelid = 'public.workspaces'::regclass
         and index_record.indisunique
         and index_record.indisvalid
         and index_record.indisready
         and index_record.indislive
         and index_record.indimmediate
         and index_record.indpred is null
         and index_record.indexprs is null
         and index_record.indnkeyatts = 1
         and index_record.indnatts = 1
         and (
           select array_agg(attribute.attname::text order by key.ordinality)
             from unnest(index_record.indkey)
               with ordinality as key(attnum, ordinality)
             join pg_attribute as attribute
               on attribute.attrelid = index_record.indrelid
              and attribute.attnum = key.attnum
         ) = array['owner_user_id']::text[]
    )
    and exists (
      select 1
        from pg_index as index_record
       where index_record.indexrelid =
               to_regclass('public.workspace_members_workspace_user_uidx')
         and index_record.indrelid = 'public.workspace_members'::regclass
         and index_record.indisunique
         and index_record.indisvalid
         and index_record.indisready
         and index_record.indislive
         and index_record.indimmediate
         and index_record.indpred is null
         and index_record.indexprs is null
         and index_record.indnkeyatts = 2
         and index_record.indnatts = 2
         and (
           select array_agg(attribute.attname::text order by key.ordinality)
             from unnest(index_record.indkey)
               with ordinality as key(attnum, ordinality)
             join pg_attribute as attribute
               on attribute.attrelid = index_record.indrelid
              and attribute.attnum = key.attnum
         ) = array['workspace_id', 'user_id']::text[]
    )
    and not has_table_privilege(
      'anon',
      'public.workspaces',
      'INSERT'
    )
    and not has_table_privilege(
      'authenticated',
      'public.workspaces',
      'INSERT'
    )
    and not has_any_column_privilege(
      'anon',
      'public.workspaces',
      'INSERT'
    )
    and not has_any_column_privilege(
      'authenticated',
      'public.workspaces',
      'INSERT'
    );
$function$;

revoke all on function public.internal_daily_test_workspace_provisioning_ready()
  from public, anon, authenticated;

grant execute on function public.internal_daily_test_workspace_provisioning_ready()
  to service_role;

comment on function public.internal_daily_test_workspace_provisioning_ready() is
  'Returns true only to service_role and only after the Daily RPC and browser INSERT-denial contract are both effective.';

commit;
