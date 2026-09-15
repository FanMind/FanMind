begin;

create or replace function public.admin_crm_read_allowed(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
set row_security = off
as $function$
  select coalesce((
    select case
      when coalesce(workspace.test_access_flags ->> 'admin_crm_access', 'false') <> 'true'
        then true
      else
        workspace.workspace_access_mode = 'active'
        and workspace.billing_status not in ('manual_suspended', 'suspended')
        and (
          (
            workspace.billing_manual_override is true
            and coalesce(workspace.test_access_flags ->> 'no_expiry', 'false') = 'true'
          )
          or (
            coalesce(workspace.test_access_flags ->> 'temporary_processing_access', 'false') = 'true'
            and nullif(workspace.test_access_flags ->> 'temporary_processing_access_expires_at', '')::timestamptz > statement_timestamp()
          )
        )
    end
      from public.workspaces as workspace
     where workspace.id = p_workspace_id
  ), false)
$function$;

revoke all on function public.admin_crm_read_allowed(uuid)
  from public, anon;
grant execute on function public.admin_crm_read_allowed(uuid)
  to authenticated, service_role;

do $policies$
declare
  target record;
begin
  for target in
    select columns.table_schema, columns.table_name
      from information_schema.columns as columns
      join pg_catalog.pg_namespace as table_namespace
        on table_namespace.nspname = columns.table_schema
      join pg_catalog.pg_class as table_definition
        on table_definition.relnamespace = table_namespace.oid
       and table_definition.relname = columns.table_name
     where columns.table_schema = 'public'
       and columns.column_name = 'workspace_id'
       and table_definition.relkind in ('r', 'p')
       and table_definition.relrowsecurity
     group by columns.table_schema, columns.table_name
  loop
    execute format(
      'drop policy if exists admin_crm_entitlement_boundary on %I.%I',
      target.table_schema,
      target.table_name
    );
    execute format(
      'create policy admin_crm_entitlement_boundary on %I.%I as restrictive for all to authenticated using (public.admin_crm_read_allowed(workspace_id)) with check (public.admin_crm_read_allowed(workspace_id))',
      target.table_schema,
      target.table_name
    );
  end loop;
end
$policies$;

drop policy if exists admin_crm_entitlement_boundary on public.workspaces;
create policy admin_crm_entitlement_boundary
  on public.workspaces
  as restrictive
  for all
  to authenticated
  using (public.admin_crm_read_allowed(id))
  with check (public.admin_crm_read_allowed(id));

create or replace function public.current_admin_crm_access_state()
returns table (access_state text)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
set row_security = off
as $function$
  select 'inactive'::text
   where exists (
    select 1
      from public.workspaces as workspace
     where workspace.owner_user_id = auth.uid()
       and coalesce(workspace.test_access_flags ->> 'admin_crm_access', 'false') = 'true'
       and not public.admin_crm_read_allowed(workspace.id)
  )
$function$;

revoke all on function public.current_admin_crm_access_state()
  from public, anon;
grant execute on function public.current_admin_crm_access_state()
  to authenticated, service_role;

do $creator_rpc_boundary$
begin
  if to_regprocedure('public.save_creator_bundle(uuid,uuid,integer,jsonb,jsonb,jsonb,boolean)') is not null then
    execute 'revoke execute on function public.save_creator_bundle(uuid,uuid,integer,jsonb,jsonb,jsonb,boolean) from public, authenticated';
  end if;
  if to_regprocedure('public.record_creator_fan_review(uuid,uuid,jsonb,jsonb)') is not null then
    execute 'revoke execute on function public.record_creator_fan_review(uuid,uuid,jsonb,jsonb) from public, authenticated';
  end if;
end
$creator_rpc_boundary$;

create or replace function public.admin_set_registered_user_crm_access(
  p_target_user_id uuid,
  p_admin_user_id uuid,
  p_admin_email text,
  p_mode text,
  p_expires_at timestamptz default null
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
  v_workspace public.workspaces%rowtype;
  v_workspace_id uuid;
  v_created boolean := false;
  v_target_email text;
  v_target_name text;
  v_confirmed_at timestamptz;
  v_previous_access text := 'Nicht freigeschaltet';
  v_next_access text;
  v_flags jsonb;
  v_now timestamptz := statement_timestamp();
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'admin_crm_access_service_role_required';
  end if;
  if p_target_user_id is null or p_admin_user_id is null then
    raise exception using errcode = '22023', message = 'admin_crm_access_identity_invalid';
  end if;
  if p_mode not in ('permanent', 'temporary', 'blocked') then
    raise exception using errcode = '22023', message = 'admin_crm_access_mode_invalid';
  end if;
  if p_mode = 'temporary' and (p_expires_at is null or p_expires_at <= v_now) then
    raise exception using errcode = '22023', message = 'admin_crm_access_expiry_invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_target_user_id::text, 0));

  select
    nullif(btrim(auth_user.email), ''),
    coalesce(
      nullif(btrim(auth_user.raw_user_meta_data ->> 'display_name'), ''),
      nullif(btrim(auth_user.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(auth_user.raw_user_meta_data ->> 'organization'), '')
    ),
    auth_user.email_confirmed_at
    into v_target_email, v_target_name, v_confirmed_at
    from auth.users as auth_user
   where auth_user.id = p_target_user_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'admin_crm_access_user_missing';
  end if;
  if v_confirmed_at is null then
    raise exception using errcode = '23514', message = 'admin_crm_access_email_unconfirmed';
  end if;
  if v_target_email is null then
    raise exception using errcode = '23514', message = 'admin_crm_access_email_missing';
  end if;

  select workspace.*
    into v_workspace
    from public.workspaces as workspace
   where workspace.owner_user_id = p_target_user_id;

  if found then
    if coalesce(v_workspace.test_access_flags ->> 'admin_crm_access', 'false') <> 'true' then
      raise exception using errcode = '23514', message = 'admin_crm_access_commercial_workspace';
    end if;
    if v_workspace.plan_id is distinct from 'starter'
       or v_workspace.commercial_option is distinct from 'starter_paid_setup'
       or v_workspace.billing_provider is distinct from 'manual'
       or v_workspace.payment_collection_method is distinct from 'none'
       or v_workspace.stripe_customer_id is not null
       or v_workspace.stripe_subscription_id is not null
       or v_workspace.stripe_checkout_session_id is not null
       or v_workspace.stripe_payment_intent_id is not null
       or v_workspace.stripe_mandate_id is not null
       or v_workspace.last_invoice_id is not null then
      raise exception using errcode = '23514', message = 'admin_crm_access_billing_bound';
    end if;
    v_workspace_id := v_workspace.id;
    if v_workspace.billing_status in ('manual_suspended', 'suspended') then
      v_previous_access := 'Gesperrt';
    elsif coalesce(v_workspace.test_access_flags ->> 'temporary_processing_access', 'false') = 'true' then
      v_previous_access := case
        when nullif(v_workspace.test_access_flags ->> 'temporary_processing_access_expires_at', '')::timestamptz > v_now
          then 'Befristet kostenlos'
        else 'Befristet abgelaufen'
      end;
    elsif v_workspace.billing_manual_override is true
       and coalesce(v_workspace.test_access_flags ->> 'no_expiry', 'false') = 'true' then
      v_previous_access := 'Dauerhaft kostenlos';
    end if;
  elsif p_mode = 'blocked' then
    raise exception using errcode = '23514', message = 'admin_crm_access_workspace_missing';
  end if;

  insert into public.profiles (id, email, display_name)
  values (p_target_user_id, v_target_email, v_target_name)
  on conflict (id) do nothing;

  v_flags := jsonb_build_object(
    'admin', true,
    'demo', true,
    'internal', true,
    'test', true,
    'billing_disabled', true,
    'mail_confirmed', true,
    'ai_maintenance', true,
    'admin_crm_access', true,
    'no_expiry', p_mode = 'permanent',
    'temporary_processing_access', p_mode = 'temporary'
  );
  if p_mode = 'temporary' then
    v_flags := v_flags || jsonb_build_object(
      'temporary_processing_access_expires_at', p_expires_at
    );
  end if;

  if v_workspace_id is null then
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
      billing_suspended_at,
      billing_suspended_reason,
      billing_retry_count,
      billing_admin_note,
      workspace_access_mode,
      test_access_flags,
      billing_updated_at,
      billing_updated_by_user_id
    ) values (
      left(coalesce(v_target_name, split_part(v_target_email, '@', 1), 'FanMind'), 140) || ' Workspace',
      p_target_user_id,
      'starter',
      'starter_paid_setup',
      0,
      0,
      0,
      case when p_mode = 'blocked' then 'manual_suspended' else 'demo_free' end,
      'manual',
      'none',
      p_mode = 'permanent',
      case when p_mode = 'blocked' then v_now else null end,
      case when p_mode = 'blocked' then 'admin_crm_access_blocked' else null end,
      0,
      'Interner Testzugang · Admin CRM · ' ||
        case p_mode when 'permanent' then 'Dauerhaft kostenlos' when 'temporary' then 'Befristet kostenlos' else 'Gesperrt' end,
      'active',
      v_flags,
      v_now,
      p_admin_user_id
    ) returning id into v_workspace_id;
    v_created := true;
  else
    update public.workspaces
       set plan_id = 'starter',
           commercial_option = 'starter_paid_setup',
           setup_fee_cents = 0,
           monthly_fee_cents = 0,
           commitment_months = 0,
           billing_status = case when p_mode = 'blocked' then 'manual_suspended' else 'demo_free' end,
           billing_provider = 'manual',
           payment_collection_method = 'none',
           billing_manual_override = p_mode = 'permanent',
           billing_suspended_at = case when p_mode = 'blocked' then v_now else null end,
           billing_suspended_reason = case when p_mode = 'blocked' then 'admin_crm_access_blocked' else null end,
           billing_last_payment_failed_at = null,
           billing_retry_count = 0,
           billing_next_retry_at = null,
           billing_grace_until = null,
           subscription_effective_end_at = null,
           workspace_access_mode = 'active',
           test_access_flags = v_flags,
           billing_admin_note = 'Interner Testzugang · Admin CRM · ' ||
             case p_mode when 'permanent' then 'Dauerhaft kostenlos' when 'temporary' then 'Befristet kostenlos' else 'Gesperrt' end,
           billing_updated_at = v_now,
           billing_updated_by_user_id = p_admin_user_id
     where id = v_workspace_id;
  end if;

  insert into public.workspace_members as workspace_member (workspace_id, user_id, role)
  values (v_workspace_id, p_target_user_id, 'owner')
  on conflict on constraint workspace_members_workspace_id_user_id_key
  do update set role = excluded.role
  where workspace_member.role is distinct from excluded.role;

  v_next_access := case p_mode
    when 'permanent' then 'Dauerhaft kostenlos'
    when 'temporary' then 'Befristet kostenlos'
    else 'Gesperrt'
  end;

  insert into public.operations_audit_log (
    actor_user_id,
    actor_email,
    action,
    target_table,
    target_id,
    severity,
    outcome,
    metadata
  ) values (
    p_admin_user_id,
    case
      when coalesce(p_admin_email, '') ~* '(secret|token|apikey|api_key|password|bearer)' then null
      else nullif(btrim(p_admin_email), '')
    end,
    'admin_crm_access_change',
    'workspaces',
    v_workspace_id,
    case when p_mode = 'blocked' then 'warning' else 'info' end,
    'success',
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'previous_access', v_previous_access,
      'next_access', v_next_access,
      'expires_at', p_expires_at
    )
  );

  return query select v_workspace_id, v_created;
end
$function$;

revoke all on function public.admin_set_registered_user_crm_access(uuid, uuid, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.admin_set_registered_user_crm_access(uuid, uuid, text, text, timestamptz)
  to service_role;

commit;
