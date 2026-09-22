-- Controlled account-deletion resume inventory contract.
-- Repository-only preparation: never applied by the normal Web deploy path.

begin;

alter table public.account_deletion_requests
  add column if not exists owned_workspace_ids uuid[];

alter table public.account_deletion_requests
  drop constraint if exists account_deletion_owned_workspace_ids_check;

alter table public.account_deletion_requests
  add constraint account_deletion_owned_workspace_ids_check check (
    owned_workspace_ids is null
    or (
      cardinality(owned_workspace_ids) <= 100
      and array_position(owned_workspace_ids, null) is null
    )
  );

comment on column public.account_deletion_requests.owned_workspace_ids is
  'Service-role-only snapshot of Workspace IDs owned at the atomic destructive-start transition; used only for crash-safe deletion completeness verification and cleared on completion.';

create or replace function public.begin_account_deletion_processing(
  p_request_id uuid,
  p_user_id uuid
)
returns table (
  request_id uuid,
  status text,
  processing_started_at timestamptz,
  owned_workspace_ids uuid[],
  requires_ownership_transfer boolean,
  requires_subscription_resolution boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.account_deletion_requests%rowtype;
  v_owned_workspace_ids uuid[];
  v_requires_ownership_transfer boolean;
  v_requires_subscription_resolution boolean;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'service_role_required';
  end if;

  select *
  into v_request
  from public.account_deletion_requests
  where id = p_request_id
    and user_id = p_user_id
    and status in ('pending', 'blocked', 'processing')
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'request_not_processable';
  end if;

  -- A processing request has already crossed the destructive-start boundary.
  -- Never recapture ownership for it: a concurrent invocation may have observed
  -- Auth before the first worker deleted it, then arrive here after cascades.
  if v_request.status = 'processing' then
    if v_request.owned_workspace_ids is null then
      raise exception using
        errcode = 'P0001',
        message = 'workspace_inventory_missing';
    end if;
    if v_request.requires_ownership_transfer
      or v_request.requires_subscription_resolution
    then
      raise exception using
        errcode = 'P0001',
        message = 'processing_blocker_state_invalid';
    end if;

    request_id := v_request.id;
    status := v_request.status;
    processing_started_at := v_request.processing_started_at;
    owned_workspace_ids := v_request.owned_workspace_ids;
    requires_ownership_transfer := false;
    requires_subscription_resolution := false;
    return next;
    return;
  end if;

  -- Account deletion is rare. A brief SHARE lock makes the ownership,
  -- membership and billing snapshot authoritative for this transition instead
  -- of racing separate REST reads against the state change.
  lock table public.workspaces in share mode;
  lock table public.workspace_members in share mode;

  select coalesce(array_agg(w.id order by w.id), array[]::uuid[])
  into v_owned_workspace_ids
  from public.workspaces w
  where w.owner_user_id = p_user_id;

  if cardinality(v_owned_workspace_ids) > 100 then
    raise exception using
      errcode = 'P0001',
      message = 'workspace_inventory_too_large';
  end if;

  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = any(v_owned_workspace_ids)
      and wm.user_id <> p_user_id
  )
  into v_requires_ownership_transfer;

  select exists (
    select 1
    from public.workspaces w
    where w.id = any(v_owned_workspace_ids)
      and w.stripe_subscription_id is not null
      and (
        (
          w.subscription_effective_end_at is not null
          and w.subscription_effective_end_at > now()
        )
        or (
          w.subscription_effective_end_at is null
          and lower(coalesce(w.billing_status, '')) not in (
            'cancelled',
            'canceled',
            'ended',
            'expired',
            'demo_free'
          )
        )
      )
  )
  into v_requires_subscription_resolution;

  -- Blockers discovered by this authoritative transaction are durable public
  -- request state. Do not raise here: an exception would roll the flags back.
  if v_requires_ownership_transfer or v_requires_subscription_resolution then
    update public.account_deletion_requests r
    set status = 'blocked',
        requires_ownership_transfer = v_requires_ownership_transfer,
        requires_subscription_resolution = v_requires_subscription_resolution,
        last_error_code = null
    where r.id = p_request_id
      and r.user_id = p_user_id
    returning
      r.id,
      r.status,
      r.processing_started_at,
      r.owned_workspace_ids,
      r.requires_ownership_transfer,
      r.requires_subscription_resolution
    into
      request_id,
      status,
      processing_started_at,
      owned_workspace_ids,
      requires_ownership_transfer,
      requires_subscription_resolution;

    return next;
    return;
  end if;

  update public.account_deletion_requests r
  set status = 'processing',
      processing_started_at = coalesce(r.processing_started_at, now()),
      owned_workspace_ids = v_owned_workspace_ids,
      requires_ownership_transfer = false,
      requires_subscription_resolution = false,
      last_error_code = null
  where r.id = p_request_id
    and r.user_id = p_user_id
  returning
    r.id,
    r.status,
    r.processing_started_at,
    r.owned_workspace_ids,
    r.requires_ownership_transfer,
    r.requires_subscription_resolution
  into
    request_id,
    status,
    processing_started_at,
    owned_workspace_ids,
    requires_ownership_transfer,
    requires_subscription_resolution;

  return next;
end;
$$;

revoke all on function public.begin_account_deletion_processing(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.begin_account_deletion_processing(uuid, uuid)
  to service_role;

commit;
