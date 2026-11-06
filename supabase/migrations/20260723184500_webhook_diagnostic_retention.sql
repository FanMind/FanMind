-- Privacy-minimized webhook diagnostics and bounded retention.
-- This migration never deletes CRM messages, contacts, memories, follow-ups,
-- billing records or backups. It applies only to technical diagnostic tables.

begin;

create index if not exists meta_webhook_events_created_at_idx
  on public.meta_webhook_events (created_at, id);

-- NOT VALID preserves any historical rows while still enforcing the contract
-- for every new or updated diagnostic record after this migration.
do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'meta_webhook_events_minimized_diagnostic_check'
       and conrelid = 'public.meta_webhook_events'::regclass
  ) then
    alter table public.meta_webhook_events
      add constraint meta_webhook_events_minimized_diagnostic_check
      check (
        page_id is null
        and sender_id is null
        and recipient_id is null
        and text is null
        and message_text is null
        and message_id is null
        and raw_payload is not null
        and jsonb_typeof(raw_payload) = 'object'
        and octet_length(raw_payload::text) <= 16384
        and status ~ '^[a-z][a-z0-9_]{0,63}$'
        and (
          error_reason is null
          or error_reason ~ '^[a-z][a-z0-9_]{0,63}$'
        )
      ) not valid;
  end if;
end
$$;

create or replace function public.manage_meta_webhook_event_retention(
  p_retention_days integer default 30,
  p_limit integer default 500,
  p_execute boolean default false
)
returns table (
  candidate_count integer,
  deleted_count integer,
  has_more boolean,
  cutoff_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cutoff timestamptz;
  v_candidates integer := 0;
  v_deleted integer := 0;
  v_has_more boolean := false;
begin
  if p_retention_days is null
    or p_retention_days < 1
    or p_retention_days > 365 then
    raise exception using
      errcode = '22023',
      message = 'invalid_webhook_retention_days';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 5000 then
    raise exception using
      errcode = '22023',
      message = 'invalid_webhook_retention_limit';
  end if;

  v_cutoff := clock_timestamp() - make_interval(days => p_retention_days);

  select count(*)::integer
    into v_candidates
    from (
      select id
        from public.meta_webhook_events
       where created_at < v_cutoff
       order by created_at asc, id asc
       limit p_limit
    ) candidate_rows;

  if p_execute and v_candidates > 0 then
    with candidates as (
      select id
        from public.meta_webhook_events
       where created_at < v_cutoff
       order by created_at asc, id asc
       limit p_limit
       for update skip locked
    ), deleted as (
      delete from public.meta_webhook_events event
       using candidates candidate
       where event.id = candidate.id
       returning event.id
    )
    select count(*)::integer into v_deleted from deleted;
  end if;

  select exists (
    select 1
      from public.meta_webhook_events
     where created_at < v_cutoff
     limit 1
  ) into v_has_more;

  return query
  select v_candidates, v_deleted, v_has_more, v_cutoff;
end;
$$;

-- Server-error tracking is not currently deployed on every environment. This
-- additive function returns table_present=false without creating or claiming
-- those tables. If they exist later, deletions remain bounded and opt-in.
create or replace function public.manage_server_error_event_retention(
  p_retention_days integer default 30,
  p_limit integer default 500,
  p_execute boolean default false
)
returns table (
  table_present boolean,
  candidate_count integer,
  deleted_count integer,
  has_more boolean,
  cutoff_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cutoff timestamptz;
  v_candidates integer := 0;
  v_deleted integer := 0;
  v_has_more boolean := false;
begin
  if p_retention_days is null
    or p_retention_days < 1
    or p_retention_days > 365 then
    raise exception using
      errcode = '22023',
      message = 'invalid_server_error_retention_days';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 5000 then
    raise exception using
      errcode = '22023',
      message = 'invalid_server_error_retention_limit';
  end if;

  v_cutoff := clock_timestamp() - make_interval(days => p_retention_days);

  if to_regclass('public.server_error_events') is null then
    return query select false, 0, 0, false, v_cutoff;
    return;
  end if;

  execute $query$
    select count(*)::integer
      from (
        select id
          from public.server_error_events
         where created_at < $1
         order by created_at asc, id asc
         limit $2
      ) candidate_rows
  $query$
  using v_cutoff, p_limit
  into v_candidates;

  if p_execute and v_candidates > 0 then
    execute $query$
      with candidates as (
        select id
          from public.server_error_events
         where created_at < $1
         order by created_at asc, id asc
         limit $2
         for update skip locked
      ), deleted as (
        delete from public.server_error_events event
         using candidates candidate
         where event.id = candidate.id
         returning event.id
      )
      select count(*)::integer from deleted
    $query$
    using v_cutoff, p_limit
    into v_deleted;
  end if;

  execute $query$
    select exists (
      select 1
        from public.server_error_events
       where created_at < $1
       limit 1
    )
  $query$
  using v_cutoff
  into v_has_more;

  return query select true, v_candidates, v_deleted, v_has_more, v_cutoff;
end;
$$;

revoke all on function public.manage_meta_webhook_event_retention(integer, integer, boolean)
  from public, anon, authenticated;
revoke all on function public.manage_server_error_event_retention(integer, integer, boolean)
  from public, anon, authenticated;

grant execute on function public.manage_meta_webhook_event_retention(integer, integer, boolean)
  to service_role;
grant execute on function public.manage_server_error_event_retention(integer, integer, boolean)
  to service_role;

comment on function public.manage_meta_webhook_event_retention(integer, integer, boolean) is
  'Plans or executes a bounded deletion of expired Meta webhook diagnostic rows. Service-role only; no CRM or billing data is touched.';

comment on function public.manage_server_error_event_retention(integer, integer, boolean) is
  'Additive bounded retention for server_error_events when that optional table exists. Service-role only.';

commit;
