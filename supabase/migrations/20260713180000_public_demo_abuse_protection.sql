-- Public temporary demo abuse protection.
-- Raw IP addresses and raw browser tokens are never stored; the application
-- passes HMAC hashes generated with a server-only secret.

create table if not exists public.demo_start_sessions (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  browser_hash text not null,
  status text not null default 'reserved',
  auth_user_id uuid references auth.users(id) on delete set null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  started_at timestamptz,
  expires_at timestamptz not null,
  completed_at timestamptz,
  cleanup_started_at timestamptz,
  cleanup_completed_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint demo_start_sessions_status_check check (
    status in (
      'reserved',
      'active',
      'failed',
      'expired',
      'blocked',
      'cleanup_pending',
      'cleanup_failed',
      'deleted'
    )
  )
);

create index if not exists demo_start_sessions_ip_created_idx
  on public.demo_start_sessions (ip_hash, created_at desc);

create index if not exists demo_start_sessions_browser_created_idx
  on public.demo_start_sessions (browser_hash, created_at desc);

create index if not exists demo_start_sessions_status_expiry_idx
  on public.demo_start_sessions (status, expires_at);

alter table public.demo_start_sessions enable row level security;

create or replace function public.set_demo_start_session_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists demo_start_sessions_updated_at on public.demo_start_sessions;
create trigger demo_start_sessions_updated_at
before update on public.demo_start_sessions
for each row execute function public.set_demo_start_session_updated_at();

create or replace function public.claim_public_demo_start(
  p_ip_hash text,
  p_browser_hash text,
  p_duration_minutes integer default 60,
  p_max_per_ip_10_min integer default 1,
  p_max_per_ip_day integer default 5,
  p_max_per_browser_day integer default 2,
  p_max_active integer default 50
)
returns table (
  decision text,
  reservation_id uuid,
  retry_after_seconds integer,
  active_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.demo_start_sessions%rowtype;
  v_ip_10_min integer;
  v_ip_day integer;
  v_browser_day integer;
  v_active integer;
  v_reservation public.demo_start_sessions%rowtype;
begin
  if coalesce(length(trim(p_ip_hash)), 0) < 16
    or coalesce(length(trim(p_browser_hash)), 0) < 16 then
    return query select 'invalid', null::uuid, 600, 0;
    return;
  end if;

  -- Release abandoned reservations. Active sessions remain available for
  -- cleanup until the cleanup worker removes their user/workspace data.
  update public.demo_start_sessions
     set status = 'expired',
         error_code = coalesce(error_code, 'reservation_expired')
   where status = 'reserved'
     and expires_at <= now();

  select *
    into v_existing
  from public.demo_start_sessions s
  where s.browser_hash = p_browser_hash
    and s.status = 'active'
    and s.expires_at > now()
  order by s.created_at desc
  limit 1;

  if v_existing.id is not null then
    select count(*)::integer
      into v_active
    from public.demo_start_sessions s
    where s.status in ('reserved', 'active')
      and s.expires_at > now();

    return query select
      'existing',
      v_existing.id,
      greatest(extract(epoch from (v_existing.expires_at - now()))::integer, 60),
      v_active;
    return;
  end if;

  select count(*)::integer into v_ip_10_min
  from public.demo_start_sessions s
  where s.ip_hash = p_ip_hash
    and s.created_at >= now() - interval '10 minutes'
    and s.status <> 'blocked';

  select count(*)::integer into v_ip_day
  from public.demo_start_sessions s
  where s.ip_hash = p_ip_hash
    and s.created_at >= now() - interval '24 hours'
    and s.status <> 'blocked';

  select count(*)::integer into v_browser_day
  from public.demo_start_sessions s
  where s.browser_hash = p_browser_hash
    and s.created_at >= now() - interval '24 hours'
    and s.status <> 'blocked';

  select count(*)::integer into v_active
  from public.demo_start_sessions s
  where s.status in ('reserved', 'active')
    and s.expires_at > now();

  if v_ip_10_min >= greatest(p_max_per_ip_10_min, 1) then
    insert into public.demo_start_sessions (
      ip_hash, browser_hash, status, expires_at, error_code
    ) values (
      p_ip_hash, p_browser_hash, 'blocked', now() + interval '10 minutes', 'ip_10_min_limit'
    );
    return query select 'blocked_ip_short', null::uuid, 600, v_active;
    return;
  end if;

  if v_ip_day >= greatest(p_max_per_ip_day, 1) then
    insert into public.demo_start_sessions (
      ip_hash, browser_hash, status, expires_at, error_code
    ) values (
      p_ip_hash, p_browser_hash, 'blocked', now() + interval '24 hours', 'ip_day_limit'
    );
    return query select 'blocked_ip_day', null::uuid, 86400, v_active;
    return;
  end if;

  if v_browser_day >= greatest(p_max_per_browser_day, 1) then
    insert into public.demo_start_sessions (
      ip_hash, browser_hash, status, expires_at, error_code
    ) values (
      p_ip_hash, p_browser_hash, 'blocked', now() + interval '24 hours', 'browser_day_limit'
    );
    return query select 'blocked_browser_day', null::uuid, 86400, v_active;
    return;
  end if;

  if v_active >= greatest(p_max_active, 1) then
    return query select 'capacity', null::uuid, 900, v_active;
    return;
  end if;

  insert into public.demo_start_sessions (
    ip_hash,
    browser_hash,
    status,
    expires_at
  ) values (
    p_ip_hash,
    p_browser_hash,
    'reserved',
    now() + interval '10 minutes'
  ) returning * into v_reservation;

  return query select 'reserved', v_reservation.id, 0, v_active + 1;
end;
$$;

create or replace function public.activate_public_demo_start(
  p_reservation_id uuid,
  p_auth_user_id uuid,
  p_workspace_id uuid,
  p_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.demo_start_sessions
     set status = 'active',
         auth_user_id = p_auth_user_id,
         workspace_id = p_workspace_id,
         started_at = now(),
         expires_at = p_expires_at,
         error_code = null
   where id = p_reservation_id
     and status = 'reserved';
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.fail_public_demo_start(
  p_reservation_id uuid,
  p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.demo_start_sessions
     set status = 'failed',
         completed_at = now(),
         error_code = left(coalesce(p_error_code, 'unknown'), 200)
   where id = p_reservation_id
     and status in ('reserved', 'active');
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

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
set search_path = public
as $$
begin
  return query
  with candidates as (
    select s.id
    from public.demo_start_sessions s
    where s.status in ('active', 'expired', 'cleanup_failed')
      and s.expires_at <= now()
    order by s.expires_at asc
    limit least(greatest(p_limit, 1), 100)
    for update skip locked
  ), updated as (
    update public.demo_start_sessions s
       set status = 'cleanup_pending',
           cleanup_started_at = now(),
           error_code = null
      from candidates c
     where s.id = c.id
     returning s.id, s.auth_user_id, s.workspace_id
  )
  select u.id, u.auth_user_id, u.workspace_id from updated u;
end;
$$;

create or replace function public.complete_demo_cleanup(
  p_session_id uuid,
  p_success boolean,
  p_error_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.demo_start_sessions
     set status = case when p_success then 'deleted' else 'cleanup_failed' end,
         cleanup_completed_at = case when p_success then now() else cleanup_completed_at end,
         completed_at = case when p_success then now() else completed_at end,
         error_code = case
           when p_success then null
           else left(coalesce(p_error_code, 'cleanup_failed'), 200)
         end
   where id = p_session_id
     and status = 'cleanup_pending';
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on table public.demo_start_sessions from public, anon, authenticated;
revoke all on function public.claim_public_demo_start(text, text, integer, integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.activate_public_demo_start(uuid, uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.fail_public_demo_start(uuid, text) from public, anon, authenticated;
revoke all on function public.claim_expired_demo_cleanup(integer) from public, anon, authenticated;
revoke all on function public.complete_demo_cleanup(uuid, boolean, text) from public, anon, authenticated;

grant execute on function public.claim_public_demo_start(text, text, integer, integer, integer, integer, integer) to service_role;
grant execute on function public.activate_public_demo_start(uuid, uuid, uuid, timestamptz) to service_role;
grant execute on function public.fail_public_demo_start(uuid, text) to service_role;
grant execute on function public.claim_expired_demo_cleanup(integer) to service_role;
grant execute on function public.complete_demo_cleanup(uuid, boolean, text) to service_role;

comment on table public.demo_start_sessions is
  'HMAC-pseudonymized public demo reservations, active sessions, rate-limit decisions and cleanup audit. Raw IP addresses and browser tokens are not stored.';
