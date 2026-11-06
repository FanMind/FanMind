-- FanMind privacy-sparing server error tracking.
-- Stores no error message, stack, headers, query parameters, request body, customer content or credentials.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table if not exists public.server_error_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  digest text check (digest is null or digest ~ '^[A-Za-z0-9_-]{1,128}$'),
  route_path text not null check (length(route_path) between 1 and 180 and route_path not like '%?%' and route_path not like '%#%'),
  route_type text not null check (route_type in ('render','route','action','proxy','unknown')),
  router_kind text not null check (router_kind in ('App Router','Pages Router','unknown')),
  http_method text not null check (http_method in ('GET','POST','PUT','PATCH','DELETE','OPTIONS','HEAD','UNKNOWN')),
  environment text not null check (environment in ('production','staging','test','development','unknown')),
  release_commit text check (release_commit is null or release_commit ~ '^[a-f0-9]{40}$')
);

create table if not exists public.server_error_groups (
  fingerprint text primary key check (fingerprint ~ '^[a-f0-9]{64}$'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  occurrence_count bigint not null default 1 check (occurrence_count > 0),
  digest text check (digest is null or digest ~ '^[A-Za-z0-9_-]{1,128}$'),
  route_path text not null check (length(route_path) between 1 and 180 and route_path not like '%?%' and route_path not like '%#%'),
  route_type text not null check (route_type in ('render','route','action','proxy','unknown')),
  router_kind text not null check (router_kind in ('App Router','Pages Router','unknown')),
  http_method text not null check (http_method in ('GET','POST','PUT','PATCH','DELETE','OPTIONS','HEAD','UNKNOWN')),
  environment text not null check (environment in ('production','staging','test','development','unknown')),
  latest_release_commit text check (latest_release_commit is null or latest_release_commit ~ '^[a-f0-9]{40}$'),
  status text not null default 'open' check (status in ('open','resolved')),
  resolved_at timestamptz,
  last_notified_at timestamptz,
  last_notified_severity text check (last_notified_severity is null or last_notified_severity in ('warning','critical'))
);

create index if not exists server_error_events_fingerprint_created_idx
  on public.server_error_events (fingerprint, created_at desc);
create index if not exists server_error_events_created_idx
  on public.server_error_events (created_at desc);
create index if not exists server_error_groups_last_seen_idx
  on public.server_error_groups (last_seen_at desc);
create index if not exists server_error_groups_open_idx
  on public.server_error_groups (last_seen_at desc)
  where status = 'open';

alter table public.server_error_events enable row level security;
alter table public.server_error_groups enable row level security;
revoke all on table public.server_error_events from public, anon, authenticated;
revoke all on table public.server_error_groups from public, anon, authenticated;

create or replace function public.record_server_error_event(
  p_fingerprint text,
  p_digest text,
  p_route_path text,
  p_route_type text,
  p_router_kind text,
  p_http_method text,
  p_environment text,
  p_release_commit text,
  p_alert_threshold integer default 5,
  p_cooldown_minutes integer default 30
)
returns table (
  fingerprint text,
  is_new boolean,
  recent_count integer,
  should_notify boolean,
  severity text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_new boolean;
  v_recent_count integer;
  v_should_notify boolean;
  v_severity text;
  v_last_notified_at timestamptz;
  v_last_notified_severity text;
  v_notification_id uuid;
  v_reference text;
  v_title text;
  v_message text;
begin
  if p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_error_fingerprint';
  end if;
  if p_digest is not null and p_digest !~ '^[A-Za-z0-9_-]{1,128}$' then
    raise exception 'invalid_error_digest';
  end if;
  if p_route_path is null or length(p_route_path) not between 1 and 180 or p_route_path like '%?%' or p_route_path like '%#%' then
    raise exception 'invalid_error_route_path';
  end if;
  if p_route_type not in ('render','route','action','proxy','unknown') then
    raise exception 'invalid_error_route_type';
  end if;
  if p_router_kind not in ('App Router','Pages Router','unknown') then
    raise exception 'invalid_error_router_kind';
  end if;
  if p_http_method not in ('GET','POST','PUT','PATCH','DELETE','OPTIONS','HEAD','UNKNOWN') then
    raise exception 'invalid_error_method';
  end if;
  if p_environment not in ('production','staging','test','development','unknown') then
    raise exception 'invalid_error_environment';
  end if;
  if p_release_commit is not null and p_release_commit !~ '^[a-f0-9]{40}$' then
    raise exception 'invalid_error_release_commit';
  end if;

  p_alert_threshold := greatest(2, least(coalesce(p_alert_threshold, 5), 100));
  p_cooldown_minutes := greatest(5, least(coalesce(p_cooldown_minutes, 30), 1440));

  select not exists (
    select 1 from public.server_error_groups g where g.fingerprint = p_fingerprint
  ) into v_is_new;

  insert into public.server_error_events (
    fingerprint, digest, route_path, route_type, router_kind, http_method, environment, release_commit
  ) values (
    p_fingerprint, p_digest, p_route_path, p_route_type, p_router_kind, p_http_method, p_environment, p_release_commit
  );

  insert into public.server_error_groups (
    fingerprint, digest, route_path, route_type, router_kind, http_method, environment, latest_release_commit,
    first_seen_at, last_seen_at, occurrence_count, status, resolved_at
  ) values (
    p_fingerprint, p_digest, p_route_path, p_route_type, p_router_kind, p_http_method, p_environment, p_release_commit,
    now(), now(), 1, 'open', null
  )
  on conflict on constraint server_error_groups_pkey do update set
    last_seen_at = now(),
    occurrence_count = public.server_error_groups.occurrence_count + 1,
    digest = excluded.digest,
    route_path = excluded.route_path,
    route_type = excluded.route_type,
    router_kind = excluded.router_kind,
    http_method = excluded.http_method,
    environment = excluded.environment,
    latest_release_commit = excluded.latest_release_commit,
    status = 'open',
    resolved_at = null;

  select count(*)::integer
  into v_recent_count
  from public.server_error_events e
  where e.fingerprint = p_fingerprint
    and e.created_at >= now() - interval '10 minutes';

  select g.last_notified_at, g.last_notified_severity
  into v_last_notified_at, v_last_notified_severity
  from public.server_error_groups g
  where g.fingerprint = p_fingerprint;

  v_severity := case when v_recent_count >= p_alert_threshold then 'critical' else 'warning' end;
  v_should_notify := v_is_new
    or (v_severity = 'critical' and coalesce(v_last_notified_severity, '') <> 'critical')
    or v_last_notified_at is null
    or v_last_notified_at <= now() - make_interval(mins => p_cooldown_minutes);

  if v_should_notify then
    v_reference := 'server_error:' || p_fingerprint;
    v_title := case when v_severity = 'critical' then 'Serverfehler häufen sich' else 'Neuer Serverfehler erkannt' end;
    v_message := case
      when v_severity = 'critical' then 'Mehrere serverseitige Fehler wurden derselben Gruppe zugeordnet. Referenz ' || substr(p_fingerprint, 1, 12) || '.'
      else 'Ein serverseitiger Fehler wurde datensparsam gruppiert. Referenz ' || substr(p_fingerprint, 1, 12) || '.'
    end;

    select n.id
    into v_notification_id
    from public.admin_notifications n
    where n.source = 'server_error_tracking'
      and n.technical_reference = v_reference
      and n.status in ('open','read','acknowledged')
    order by n.created_at desc
    limit 1
    for update;

    if v_notification_id is null then
      insert into public.admin_notifications (
        category, severity, status, title, message, source, technical_reference, metadata
      ) values (
        v_severity, v_severity, 'open', v_title, v_message, 'server_error_tracking', v_reference,
        jsonb_build_object('fingerprint', p_fingerprint, 'recent_count', v_recent_count)
      );
    else
      update public.admin_notifications
      set category = v_severity,
          severity = v_severity,
          status = 'open',
          title = v_title,
          message = v_message,
          read_at = null,
          read_by_user_id = null,
          acknowledged_at = null,
          acknowledged_by_user_id = null,
          resolved_at = null,
          metadata = jsonb_build_object('fingerprint', p_fingerprint, 'recent_count', v_recent_count),
          updated_at = now()
      where id = v_notification_id;
    end if;

    update public.server_error_groups
    set last_notified_at = now(),
        last_notified_severity = v_severity
    where server_error_groups.fingerprint = p_fingerprint;
  end if;

  return query select p_fingerprint, v_is_new, v_recent_count, v_should_notify, v_severity;
end;
$$;

revoke all on function public.record_server_error_event(text,text,text,text,text,text,text,text,integer,integer)
  from public, anon, authenticated;
grant execute on function public.record_server_error_event(text,text,text,text,text,text,text,text,integer,integer)
  to service_role;

create or replace function public.cleanup_server_error_events(p_retention_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  p_retention_days := greatest(7, least(coalesce(p_retention_days, 30), 365));
  delete from public.server_error_events
  where created_at < now() - make_interval(days => p_retention_days);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.cleanup_server_error_events(integer) from public, anon, authenticated;
grant execute on function public.cleanup_server_error_events(integer) to service_role;

commit;
