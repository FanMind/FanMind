-- Additive first rollout step for server-owned Workspace commercial fields.
-- Apply this migration only after the RPC-compatible application commit is
-- deployed. The application bridge does not require migration-only columns:
-- an exact missing-column response retries with the older commercial core.
-- The following controlled privilege migration closes direct writes separately.

begin;

alter table public.workspaces
  add column if not exists payment_terms_version text,
  add column if not exists payment_terms_accepted_at timestamptz,
  add column if not exists payment_terms_accepted_by_user_id uuid,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists stripe_mandate_id text,
  add column if not exists billing_note text;

-- Backfill only Workspaces whose identity is anchored in the server-only demo
-- reservation table. The display name is deliberately not an identity signal.
do $$
begin
  if to_regclass('public.demo_start_sessions') is not null then
    update public.workspaces as workspace
       set name = 'FanMind Demo Workspace',
           plan_id = 'pilot',
           commercial_option = 'pilot_only',
           setup_fee_cents = 0,
           monthly_fee_cents = 0,
           commitment_months = 0,
           billing_status = 'demo_free',
           billing_provider = 'manual',
           payment_collection_method = 'none',
           billing_manual_override = false,
           billing_suspended_at = null,
           billing_suspended_reason = null,
           billing_last_payment_failed_at = null,
           billing_last_payment_at = null,
           billing_retry_count = 0,
           billing_next_retry_at = null,
           billing_grace_until = null,
           billing_admin_note = null,
           billing_contract_started_at = null,
           billing_current_period_end_at = null,
           billing_next_invoice_at = null,
           billing_minimum_term_ends_at = null,
           subscription_cancel_requested_at = null,
           subscription_cancel_requested_by_user_id = null,
           subscription_cancel_at_period_end = false,
           subscription_effective_end_at = null,
           subscription_cancellation_revoked_at = null,
           stripe_customer_id = null,
           stripe_subscription_id = null,
           stripe_checkout_session_id = null,
           stripe_payment_intent_id = null,
           stripe_mandate_id = null,
           billing_note = null,
           last_invoice_id = null,
           last_invoice_status = null,
           last_invoice_amount_due_cents = null,
           last_invoice_amount_paid_cents = null,
           last_invoice_hosted_url = null,
           last_invoice_pdf_url = null,
           payment_terms_version = null,
           payment_terms_accepted_at = null,
           payment_terms_accepted_by_user_id = null,
           test_access_flags = jsonb_build_object('temporary_demo', true),
           workspace_access_mode = 'active',
           billing_updated_at = statement_timestamp(),
           billing_updated_by_user_id = workspace.owner_user_id
      from public.demo_start_sessions as demo_session
     where demo_session.workspace_id = workspace.id
       and demo_session.auth_user_id = workspace.owner_user_id
       and demo_session.status in (
         'reserved',
         'active',
         'expired',
         'failed',
         'cleanup_pending',
         'cleanup_failed'
       );
  end if;
end
$$;

-- The fixed Sandra demo has no demo_start_sessions row. Its immutable
-- server-side identity is the dedicated Auth email used by the application.
-- Clear migration-only Stripe references here so a historical payment intent
-- can never route a later webhook into the fixed demo Workspace.
update public.workspaces as workspace
   set stripe_customer_id = null,
       stripe_subscription_id = null,
       stripe_checkout_session_id = null,
       stripe_payment_intent_id = null,
       stripe_mandate_id = null,
       billing_note = null,
       payment_terms_version = null,
       payment_terms_accepted_at = null,
       payment_terms_accepted_by_user_id = null,
       billing_updated_at = statement_timestamp(),
       billing_updated_by_user_id = workspace.owner_user_id
  from auth.users as auth_user
 where auth_user.id = workspace.owner_user_id
   and lower(btrim(coalesce(auth_user.email, ''))) = 'sandra.m@fanmind.ch';

do $$
begin
  if exists (
    select 1
      from public.workspaces
     group by owner_user_id
    having count(*) > 1
  ) then
    raise exception
      using
        errcode = '23505',
        message = 'workspace_provisioning_duplicate_owner';
  end if;

  if exists (
    select 1
      from public.workspace_members
     group by workspace_id, user_id
    having count(*) > 1
  ) then
    raise exception
      using
        errcode = '23505',
        message = 'workspace_provisioning_duplicate_membership';
  end if;
end
$$;

do $$
begin
  if to_regclass('public.workspaces_owner_user_id_uidx') is null then
    create unique index workspaces_owner_user_id_uidx
      on public.workspaces (owner_user_id);
  elsif not exists (
    select 1
      from pg_index as index_record
     where index_record.indexrelid =
             'public.workspaces_owner_user_id_uidx'::regclass
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
  ) then
    raise exception
      using
        errcode = '55000',
        message = 'workspace_provisioning_owner_index_mismatch';
  end if;

  if to_regclass('public.workspace_members_workspace_user_uidx') is null then
    create unique index workspace_members_workspace_user_uidx
      on public.workspace_members (workspace_id, user_id);
  elsif not exists (
    select 1
      from pg_index as index_record
     where index_record.indexrelid =
             'public.workspace_members_workspace_user_uidx'::regclass
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
  ) then
    raise exception
      using
        errcode = '55000',
        message = 'workspace_provisioning_membership_index_mismatch';
  end if;
end
$$;

-- Preserve recoverability when a pre-activation cleanup cannot remove every
-- external resource. Rows without remaining resource IDs stay ordinary failed
-- audit rows; rows with either ID become immediately claimable cleanup work.
create or replace function public.fail_public_demo_start(
  p_reservation_id uuid,
  p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  v_updated integer;
begin
  update public.demo_start_sessions
     set status = case
           when auth_user_id is not null or workspace_id is not null
             then 'cleanup_failed'
           else 'failed'
         end,
         expires_at = case
           when auth_user_id is not null or workspace_id is not null
             then least(expires_at, statement_timestamp())
           else expires_at
         end,
         completed_at = case
           when auth_user_id is null and workspace_id is null
             then statement_timestamp()
           else completed_at
         end,
         cleanup_started_at = case
           when auth_user_id is not null or workspace_id is not null
             then null
           else cleanup_started_at
         end,
         error_code = left(coalesce(p_error_code, 'unknown'), 200)
   where id = p_reservation_id
     and status in ('reserved', 'active');
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end
$function$;

-- A reserved row may already own an Auth user before activation. Failed rows
-- may retain one resource half, and a crashed cleanup worker may leave a stale
-- lease. All three cases must re-enter the idempotent cleanup path.
create or replace function public.claim_expired_demo_cleanup(
  p_limit integer default 25
)
returns table (
  session_id uuid,
  auth_user_id uuid,
  workspace_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
begin
  return query
  with candidates as (
    select session.id
      from public.demo_start_sessions as session
     where (
       session.status in (
         'reserved',
         'active',
         'expired',
         'cleanup_failed'
       )
       and session.expires_at <= statement_timestamp()
     ) or (
       session.status = 'failed'
       and (
         session.auth_user_id is not null
         or session.workspace_id is not null
       )
       and session.expires_at <= statement_timestamp()
     ) or (
       session.status = 'cleanup_pending'
       and session.cleanup_started_at <=
         statement_timestamp() - interval '15 minutes'
     )
     order by
       coalesce(session.cleanup_started_at, session.expires_at) asc
     limit least(greatest(coalesce(p_limit, 25), 1), 100)
     for update skip locked
  ), updated as (
    update public.demo_start_sessions as session
       set status = 'cleanup_pending',
           cleanup_started_at = statement_timestamp(),
           error_code = null
      from candidates
     where session.id = candidates.id
     returning
       session.id,
       session.auth_user_id,
       session.workspace_id
  )
  select updated.id, updated.auth_user_id, updated.workspace_id
    from updated;
end
$function$;

revoke all on function public.fail_public_demo_start(uuid, text)
  from public, anon, authenticated;

revoke all on function public.claim_expired_demo_cleanup(integer)
  from public, anon, authenticated;

grant execute on function public.fail_public_demo_start(uuid, text)
  to service_role;

grant execute on function public.claim_expired_demo_cleanup(integer)
  to service_role;

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

  select w.id
    into v_workspace_id
    from public.workspaces w
   where w.owner_user_id = v_user_id;

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
  on conflict (workspace_id, user_id)
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
