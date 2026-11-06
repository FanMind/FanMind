-- Repair the authenticated Workspace provisioning RPC after Staging exposed an
-- ambiguous PL/pgSQL conflict target. Bind the UPSERT to the existing named
-- unique constraint so output-column variables cannot shadow table columns.

begin;

create or replace function public.ensure_current_user_workspace(
  p_workspace_name text,
  p_commercial_option text,
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
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_workspace_name text;
  v_setup_fee_cents integer;
  v_commitment_months integer;
  v_created boolean := false;
begin
  if v_user_id is null
    or auth.role() is distinct from 'authenticated' then
    raise exception
      using
        errcode = '42501',
        message = 'workspace_provisioning_auth_required';
  end if;

  -- Serialize provisioning attempts for one authenticated identity. The
  -- unique owner index remains the final concurrency invariant.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select workspace.id
    into v_workspace_id
    from public.workspaces as workspace
   where workspace.owner_user_id = v_user_id;

  if v_workspace_id is null then
    v_workspace_name :=
      coalesce(nullif(btrim(p_workspace_name), ''), 'FanMind Workspace');

    if char_length(v_workspace_name) > 160 then
      raise exception
        using
          errcode = '22023',
          message = 'workspace_provisioning_invalid_name';
    end if;

    if p_commercial_option = 'starter_paid_setup' then
      v_setup_fee_cents := 99000;
      v_commitment_months := 0;
    elsif p_commercial_option = 'starter_no_setup_commitment' then
      v_setup_fee_cents := 0;
      v_commitment_months := 12;
    else
      raise exception
        using
          errcode = '22023',
          message = 'workspace_provisioning_invalid_commercial_option';
    end if;

    if p_payment_terms_accepted is distinct from true then
      raise exception
        using
          errcode = '23514',
          message = 'workspace_provisioning_terms_required';
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
      payment_terms_version,
      payment_terms_accepted_at,
      payment_terms_accepted_by_user_id,
      billing_updated_at,
      billing_updated_by_user_id
    )
    values (
      v_workspace_name,
      v_user_id,
      'starter',
      p_commercial_option,
      v_setup_fee_cents,
      31200,
      v_commitment_months,
      'pending_payment_setup',
      'stripe',
      'sepa_direct_debit',
      '2026-06-v1',
      statement_timestamp(),
      v_user_id,
      statement_timestamp(),
      v_user_id
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
    v_user_id,
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

revoke all on function public.ensure_current_user_workspace(text, text, boolean)
  from public, anon, authenticated;

grant execute on function public.ensure_current_user_workspace(text, text, boolean)
  to authenticated;

comment on function public.ensure_current_user_workspace(text, text, boolean) is
  'Atomically returns or creates the authenticated users single Starter workspace and owner membership. Commercial terms are derived server-side.';

commit;
