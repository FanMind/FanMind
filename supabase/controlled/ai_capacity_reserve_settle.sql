begin;

alter table public.ai_capacity_ledger_events
  drop constraint if exists ai_capacity_ledger_events_event_type_check;

alter table public.ai_capacity_ledger_events
  add constraint ai_capacity_ledger_events_event_type_check
  check (event_type in (
    'included_period_grant',
    'purchased_credit_grant',
    'reservation_created',
    'reservation_settled',
    'reservation_released',
    'reservation_indeterminate',
    'reservation_reconciliation_required',
    'purchase_reversal',
    'reconciliation_adjustment'
  ));

create or replace function public.ai_capacity_grant_credit(
  p_workspace_id uuid,
  p_grant_kind text,
  p_grant_key text,
  p_package_id text,
  p_billing_period_key text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_expires_at timestamptz,
  p_granted_eur_microcents bigint,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
set row_security = off
as $function$
declare
  v_id uuid;
  v_existing public.ai_capacity_grants%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'ai_capacity_service_role_required';
  end if;
  if p_workspace_id is null
     or p_grant_kind not in ('included_period','purchased')
     or p_grant_key is null
     or btrim(p_grant_key) = ''
     or p_granted_eur_microcents is null
     or p_granted_eur_microcents <= 0 then
    raise exception using errcode = '22023', message = 'ai_capacity_grant_invalid';
  end if;
  if p_grant_kind = 'included_period' then
    if p_package_id not in ('capacity_99','capacity_199','capacity_312')
       or p_billing_period_key is null
       or btrim(p_billing_period_key) = ''
       or p_period_start is null
       or p_period_end is null
       or p_period_end <= p_period_start then
      raise exception using errcode = '22023', message = 'ai_capacity_included_grant_invalid';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text, 41001));

  select *
    into v_existing
    from public.ai_capacity_grants
   where workspace_id = p_workspace_id
     and grant_key = p_grant_key;

  if found then
    if v_existing.grant_kind is distinct from p_grant_kind
       or v_existing.package_id is distinct from p_package_id
       or v_existing.billing_period_key is distinct from p_billing_period_key
       or v_existing.period_start is distinct from p_period_start
       or v_existing.period_end is distinct from p_period_end
       or v_existing.expires_at is distinct from p_expires_at
       or v_existing.granted_eur_microcents is distinct from p_granted_eur_microcents then
      raise exception using errcode = '23505', message = 'ai_capacity_grant_idempotency_conflict';
    end if;
    return v_existing.id;
  end if;

  insert into public.ai_capacity_grants (
    workspace_id, grant_kind, grant_key, package_id, billing_period_key,
    period_start, period_end, expires_at, granted_eur_microcents, metadata
  ) values (
    p_workspace_id, p_grant_kind, p_grant_key, p_package_id, p_billing_period_key,
    p_period_start, p_period_end, p_expires_at, p_granted_eur_microcents,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  insert into public.ai_capacity_ledger_events (
    workspace_id, event_type, bucket_kind, grant_id, amount_eur_microcents, metadata
  ) values (
    p_workspace_id,
    case when p_grant_kind = 'included_period' then 'included_period_grant' else 'purchased_credit_grant' end,
    p_grant_kind,
    v_id,
    p_granted_eur_microcents,
    coalesce(p_metadata, '{}'::jsonb)
  );

  return v_id;
end
$function$;

revoke all on function public.ai_capacity_grant_credit(
  uuid,text,text,text,text,timestamptz,timestamptz,timestamptz,bigint,jsonb
) from public, anon, authenticated;
grant execute on function public.ai_capacity_grant_credit(
  uuid,text,text,text,text,timestamptz,timestamptz,timestamptz,bigint,jsonb
) to service_role;

create or replace function public.ai_capacity_reserve(
  p_workspace_id uuid,
  p_generation_key text,
  p_billing_period_key text,
  p_package_id text,
  p_quality_mode text,
  p_reserved_eur_microcents bigint
)
returns table (
  reservation_id uuid,
  reserved_eur_microcents bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
set row_security = off
as $function$
declare
  v_existing public.ai_capacity_reservations%rowtype;
  v_reservation_id uuid;
  v_remaining bigint;
  v_available bigint;
  v_take bigint;
  v_grant record;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'ai_capacity_service_role_required';
  end if;
  if p_workspace_id is null
     or p_generation_key is null or btrim(p_generation_key) = ''
     or p_billing_period_key is null or btrim(p_billing_period_key) = ''
     or p_package_id not in ('capacity_99','capacity_199','capacity_312')
     or p_quality_mode not in ('fast','balanced','premium')
     or p_reserved_eur_microcents is null
     or p_reserved_eur_microcents <= 0 then
    raise exception using errcode = '22023', message = 'ai_capacity_reservation_invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text, 41001));

  select *
    into v_existing
    from public.ai_capacity_reservations
   where workspace_id = p_workspace_id
     and generation_key = p_generation_key;

  if found then
    if v_existing.billing_period_key is distinct from p_billing_period_key
       or v_existing.package_id is distinct from p_package_id
       or v_existing.quality_mode is distinct from p_quality_mode
       or v_existing.reserved_eur_microcents is distinct from p_reserved_eur_microcents then
      raise exception using errcode = '23505', message = 'ai_capacity_reservation_idempotency_conflict';
    end if;
    return query select v_existing.id, v_existing.reserved_eur_microcents;
    return;
  end if;

  insert into public.ai_capacity_reservations (
    workspace_id, generation_key, billing_period_key, package_id, quality_mode,
    reserved_eur_microcents, state
  ) values (
    p_workspace_id, p_generation_key, p_billing_period_key, p_package_id, p_quality_mode,
    p_reserved_eur_microcents, 'reserved'
  )
  returning id into v_reservation_id;

  v_remaining := p_reserved_eur_microcents;

  for v_grant in
    select
      g.*,
      greatest(
        0::bigint,
        g.granted_eur_microcents
        - g.reversed_eur_microcents
        - coalesce((
            select sum(
              case
                when r.state in ('reserved','indeterminate','reconciliation_required')
                  then a.reserved_eur_microcents
                when r.state = 'settled'
                  then coalesce(a.settled_eur_microcents, a.reserved_eur_microcents)
                else 0
              end
            )
            from public.ai_capacity_reservation_allocations a
            join public.ai_capacity_reservations r on r.id = a.reservation_id
            where a.grant_id = g.id
          ), 0)
      ) as available_eur_microcents
    from public.ai_capacity_grants g
    where g.workspace_id = p_workspace_id
      and g.reversed_eur_microcents < g.granted_eur_microcents
      and (
        (
          g.grant_kind = 'included_period'
          and g.billing_period_key = p_billing_period_key
          and g.package_id = p_package_id
          and (g.expires_at is null or g.expires_at > statement_timestamp())
        )
        or (
          g.grant_kind = 'purchased'
          and (g.expires_at is null or g.expires_at > statement_timestamp())
        )
      )
    order by
      case g.grant_kind when 'included_period' then 0 else 1 end,
      g.created_at,
      g.id
  loop
    exit when v_remaining <= 0;
    v_available := v_grant.available_eur_microcents;
    if v_available <= 0 then
      continue;
    end if;
    v_take := least(v_remaining, v_available);

    insert into public.ai_capacity_reservation_allocations (
      reservation_id, grant_id, reserved_eur_microcents
    ) values (
      v_reservation_id, v_grant.id, v_take
    );

    insert into public.ai_capacity_ledger_events (
      workspace_id, reservation_id, generation_key, event_type,
      bucket_kind, grant_id, amount_eur_microcents
    ) values (
      p_workspace_id, v_reservation_id, p_generation_key, 'reservation_created',
      v_grant.grant_kind, v_grant.id, v_take
    );

    v_remaining := v_remaining - v_take;
  end loop;

  if v_remaining > 0 then
    raise exception using errcode = '23514', message = 'ai_capacity_insufficient_balance';
  end if;

  return query select v_reservation_id, p_reserved_eur_microcents;
end
$function$;

revoke all on function public.ai_capacity_reserve(uuid,text,text,text,text,bigint)
  from public, anon, authenticated;
grant execute on function public.ai_capacity_reserve(uuid,text,text,text,text,bigint)
  to service_role;

create or replace function public.ai_capacity_settle(
  p_reservation_id uuid,
  p_actual_eur_microcents bigint,
  p_provider text,
  p_model text,
  p_input_tokens bigint,
  p_cached_input_tokens bigint,
  p_cache_write_tokens bigint,
  p_output_tokens bigint,
  p_reasoning_tokens bigint,
  p_pricing_version text,
  p_fx_version text,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  reservation_id uuid,
  state text,
  settled_eur_microcents bigint,
  released_eur_microcents bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
set row_security = off
as $function$
declare
  v_reservation public.ai_capacity_reservations%rowtype;
  v_remaining bigint;
  v_settle bigint;
  v_release bigint;
  v_allocation record;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'ai_capacity_service_role_required';
  end if;
  if p_reservation_id is null
     or p_actual_eur_microcents is null or p_actual_eur_microcents < 0
     or p_provider is null or btrim(p_provider) = ''
     or p_model is null or btrim(p_model) = ''
     or p_pricing_version is null or btrim(p_pricing_version) = ''
     or p_fx_version is null or btrim(p_fx_version) = ''
     or p_input_tokens is null or p_input_tokens < 0
     or p_cached_input_tokens is null or p_cached_input_tokens < 0
     or p_cache_write_tokens is null or p_cache_write_tokens < 0
     or p_output_tokens is null or p_output_tokens < 0
     or p_reasoning_tokens is null or p_reasoning_tokens < 0
     or p_cached_input_tokens > p_input_tokens then
    raise exception using errcode = '22023', message = 'ai_capacity_settlement_invalid';
  end if;

  select * into v_reservation
    from public.ai_capacity_reservations
   where id = p_reservation_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'ai_capacity_reservation_missing';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_reservation.workspace_id::text, 41001));

  if v_reservation.state = 'settled' then
    if v_reservation.settled_eur_microcents is distinct from p_actual_eur_microcents then
      raise exception using errcode = '23505', message = 'ai_capacity_settlement_idempotency_conflict';
    end if;
    return query
      select v_reservation.id, v_reservation.state, v_reservation.settled_eur_microcents,
             v_reservation.reserved_eur_microcents - v_reservation.settled_eur_microcents;
    return;
  end if;

  if v_reservation.state not in ('reserved','indeterminate','reconciliation_required') then
    raise exception using errcode = '23514', message = 'ai_capacity_settlement_state_invalid';
  end if;

  if p_actual_eur_microcents > v_reservation.reserved_eur_microcents then
    update public.ai_capacity_reservations
       set state = 'reconciliation_required',
           updated_at = statement_timestamp()
     where id = v_reservation.id;

    insert into public.ai_capacity_ledger_events (
      workspace_id, reservation_id, generation_key, event_type,
      amount_eur_microcents, provider, model, input_tokens, cached_input_tokens,
      cache_write_tokens, output_tokens, reasoning_tokens, pricing_version, fx_version, metadata
    ) values (
      v_reservation.workspace_id, v_reservation.id, v_reservation.generation_key,
      'reservation_reconciliation_required', p_actual_eur_microcents,
      p_provider, p_model, p_input_tokens, p_cached_input_tokens,
      p_cache_write_tokens, p_output_tokens, p_reasoning_tokens,
      p_pricing_version, p_fx_version, coalesce(p_metadata, '{}'::jsonb)
    );

    raise exception using errcode = '23514', message = 'ai_capacity_actual_exceeds_reservation';
  end if;

  v_remaining := p_actual_eur_microcents;

  for v_allocation in
    select
      a.reservation_id,
      a.grant_id,
      a.reserved_eur_microcents,
      g.grant_kind,
      g.created_at
    from public.ai_capacity_reservation_allocations a
    join public.ai_capacity_grants g on g.id = a.grant_id
    where a.reservation_id = v_reservation.id
    order by
      case g.grant_kind when 'included_period' then 0 else 1 end,
      g.created_at,
      g.id
    for update of a
  loop
    v_settle := least(v_remaining, v_allocation.reserved_eur_microcents);
    v_release := v_allocation.reserved_eur_microcents - v_settle;

    update public.ai_capacity_reservation_allocations
       set settled_eur_microcents = v_settle
     where reservation_id = v_reservation.id
       and grant_id = v_allocation.grant_id;

    if v_settle > 0 then
      insert into public.ai_capacity_ledger_events (
        workspace_id, reservation_id, generation_key, event_type,
        bucket_kind, grant_id, amount_eur_microcents, provider, model,
        input_tokens, cached_input_tokens, cache_write_tokens, output_tokens,
        reasoning_tokens, pricing_version, fx_version, metadata
      ) values (
        v_reservation.workspace_id, v_reservation.id, v_reservation.generation_key,
        'reservation_settled', v_allocation.grant_kind, v_allocation.grant_id,
        v_settle, p_provider, p_model, p_input_tokens, p_cached_input_tokens,
        p_cache_write_tokens, p_output_tokens, p_reasoning_tokens,
        p_pricing_version, p_fx_version, coalesce(p_metadata, '{}'::jsonb)
      );
    end if;

    if v_release > 0 then
      insert into public.ai_capacity_ledger_events (
        workspace_id, reservation_id, generation_key, event_type,
        bucket_kind, grant_id, amount_eur_microcents, metadata
      ) values (
        v_reservation.workspace_id, v_reservation.id, v_reservation.generation_key,
        'reservation_released', v_allocation.grant_kind, v_allocation.grant_id,
        v_release, jsonb_build_object('reason','settlement_remainder')
      );
    end if;

    v_remaining := v_remaining - v_settle;
  end loop;

  if v_remaining <> 0 then
    raise exception using errcode = '23514', message = 'ai_capacity_allocation_incomplete';
  end if;

  update public.ai_capacity_reservations
     set state = 'settled',
         settled_eur_microcents = p_actual_eur_microcents,
         updated_at = statement_timestamp()
   where id = v_reservation.id;

  return query
    select v_reservation.id, 'settled'::text, p_actual_eur_microcents,
           v_reservation.reserved_eur_microcents - p_actual_eur_microcents;
end
$function$;

revoke all on function public.ai_capacity_settle(
  uuid,bigint,text,text,bigint,bigint,bigint,bigint,bigint,text,text,jsonb
) from public, anon, authenticated;
grant execute on function public.ai_capacity_settle(
  uuid,bigint,text,text,bigint,bigint,bigint,bigint,bigint,text,text,jsonb
) to service_role;

create or replace function public.ai_capacity_release(
  p_reservation_id uuid,
  p_reason text
)
returns table (
  reservation_id uuid,
  state text,
  released_eur_microcents bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
set row_security = off
as $function$
declare
  v_reservation public.ai_capacity_reservations%rowtype;
  v_allocation record;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'ai_capacity_service_role_required';
  end if;
  if p_reservation_id is null or p_reason is null or btrim(p_reason) = '' then
    raise exception using errcode = '22023', message = 'ai_capacity_release_invalid';
  end if;

  select * into v_reservation
    from public.ai_capacity_reservations
   where id = p_reservation_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'ai_capacity_reservation_missing';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_reservation.workspace_id::text, 41001));

  if v_reservation.state = 'released' then
    return query select v_reservation.id, v_reservation.state, v_reservation.reserved_eur_microcents;
    return;
  end if;

  if v_reservation.state not in ('reserved','indeterminate') then
    raise exception using errcode = '23514', message = 'ai_capacity_release_state_invalid';
  end if;

  for v_allocation in
    select a.grant_id, a.reserved_eur_microcents, g.grant_kind
    from public.ai_capacity_reservation_allocations a
    join public.ai_capacity_grants g on g.id = a.grant_id
    where a.reservation_id = v_reservation.id
  loop
    insert into public.ai_capacity_ledger_events (
      workspace_id, reservation_id, generation_key, event_type,
      bucket_kind, grant_id, amount_eur_microcents, metadata
    ) values (
      v_reservation.workspace_id, v_reservation.id, v_reservation.generation_key,
      'reservation_released', v_allocation.grant_kind, v_allocation.grant_id,
      v_allocation.reserved_eur_microcents,
      jsonb_build_object('reason', left(p_reason, 120))
    );
  end loop;

  update public.ai_capacity_reservations
     set state = 'released',
         settled_eur_microcents = 0,
         updated_at = statement_timestamp()
   where id = v_reservation.id;

  return query select v_reservation.id, 'released'::text, v_reservation.reserved_eur_microcents;
end
$function$;

revoke all on function public.ai_capacity_release(uuid,text)
  from public, anon, authenticated;
grant execute on function public.ai_capacity_release(uuid,text)
  to service_role;

create or replace function public.ai_capacity_mark_indeterminate(
  p_reservation_id uuid,
  p_reason text
)
returns table (
  reservation_id uuid,
  state text
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
set row_security = off
as $function$
declare
  v_reservation public.ai_capacity_reservations%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'ai_capacity_service_role_required';
  end if;
  if p_reservation_id is null or p_reason is null or btrim(p_reason) = '' then
    raise exception using errcode = '22023', message = 'ai_capacity_indeterminate_invalid';
  end if;

  select * into v_reservation
    from public.ai_capacity_reservations
   where id = p_reservation_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'ai_capacity_reservation_missing';
  end if;

  if v_reservation.state = 'indeterminate' then
    return query select v_reservation.id, v_reservation.state;
    return;
  end if;

  if v_reservation.state <> 'reserved' then
    raise exception using errcode = '23514', message = 'ai_capacity_indeterminate_state_invalid';
  end if;

  update public.ai_capacity_reservations
     set state = 'indeterminate',
         updated_at = statement_timestamp()
   where id = v_reservation.id;

  insert into public.ai_capacity_ledger_events (
    workspace_id, reservation_id, generation_key, event_type,
    amount_eur_microcents, metadata
  ) values (
    v_reservation.workspace_id, v_reservation.id, v_reservation.generation_key,
    'reservation_indeterminate', v_reservation.reserved_eur_microcents,
    jsonb_build_object('reason', left(p_reason, 120))
  );

  return query select v_reservation.id, 'indeterminate'::text;
end
$function$;

revoke all on function public.ai_capacity_mark_indeterminate(uuid,text)
  from public, anon, authenticated;
grant execute on function public.ai_capacity_mark_indeterminate(uuid,text)
  to service_role;

commit;
