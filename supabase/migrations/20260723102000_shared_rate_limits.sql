-- Atomic shared rate limiting for AI and public inquiry endpoints.
-- Raw IP addresses or user identifiers are never persisted. The application
-- sends only a purpose-scoped HMAC-SHA256 subject hash.

begin;

create table if not exists public.shared_rate_limit_buckets (
  scope text not null,
  subject_hash text not null,
  window_start timestamptz not null,
  window_seconds integer not null,
  request_count integer not null default 1,
  reset_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (scope, subject_hash, window_start, window_seconds),
  constraint shared_rate_limit_scope_check check (
    scope ~ '^[a-z][a-z0-9_.:-]{0,63}$'
  ),
  constraint shared_rate_limit_subject_hash_check check (
    subject_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint shared_rate_limit_window_seconds_check check (
    window_seconds between 1 and 86400
  ),
  constraint shared_rate_limit_request_count_check check (
    request_count >= 1
  ),
  constraint shared_rate_limit_reset_check check (
    reset_at > window_start
  ),
  constraint shared_rate_limit_expiry_check check (
    expires_at >= reset_at
  )
);

create index if not exists shared_rate_limit_buckets_expiry_idx
  on public.shared_rate_limit_buckets (expires_at);

alter table public.shared_rate_limit_buckets enable row level security;

create or replace function public.consume_shared_rate_limit(
  p_scope text,
  p_subject_hash text,
  p_window_seconds integer,
  p_max_requests integer
)
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamptz,
  current_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_reset_at timestamptz;
  v_count integer;
begin
  if p_scope is null
    or p_scope !~ '^[a-z][a-z0-9_.:-]{0,63}$' then
    raise exception using errcode = '22023', message = 'invalid_rate_limit_scope';
  end if;

  if p_subject_hash is null
    or p_subject_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_rate_limit_subject_hash';
  end if;

  if p_window_seconds is null
    or p_window_seconds < 1
    or p_window_seconds > 86400 then
    raise exception using errcode = '22023', message = 'invalid_rate_limit_window';
  end if;

  if p_max_requests is null
    or p_max_requests < 1
    or p_max_requests > 10000 then
    raise exception using errcode = '22023', message = 'invalid_rate_limit_maximum';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );
  v_reset_at := v_window_start + make_interval(secs => p_window_seconds);

  -- Bound cleanup work so every request remains predictable. A separate
  -- cleanup RPC can remove larger batches during maintenance.
  delete from public.shared_rate_limit_buckets
   where ctid in (
     select ctid
       from public.shared_rate_limit_buckets
      where expires_at <= v_now
      order by expires_at asc
      limit 100
   );

  insert into public.shared_rate_limit_buckets as bucket (
    scope,
    subject_hash,
    window_start,
    window_seconds,
    request_count,
    reset_at,
    expires_at,
    created_at,
    updated_at
  ) values (
    p_scope,
    p_subject_hash,
    v_window_start,
    p_window_seconds,
    1,
    v_reset_at,
    v_reset_at + interval '5 minutes',
    v_now,
    v_now
  )
  on conflict (scope, subject_hash, window_start, window_seconds)
  do update set
    request_count = bucket.request_count + 1,
    reset_at = excluded.reset_at,
    expires_at = greatest(bucket.expires_at, excluded.expires_at),
    updated_at = excluded.updated_at
  returning bucket.request_count into v_count;

  return query
  select
    v_count <= p_max_requests,
    greatest(p_max_requests - v_count, 0),
    v_reset_at,
    v_count;
end;
$$;

create or replace function public.cleanup_shared_rate_limit_buckets(
  p_limit integer default 1000
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted integer;
begin
  if p_limit is null or p_limit < 1 or p_limit > 10000 then
    raise exception using errcode = '22023', message = 'invalid_rate_limit_cleanup_limit';
  end if;

  delete from public.shared_rate_limit_buckets
   where ctid in (
     select ctid
       from public.shared_rate_limit_buckets
      where expires_at <= clock_timestamp()
      order by expires_at asc
      limit p_limit
   );

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on table public.shared_rate_limit_buckets
  from public, anon, authenticated;
revoke all on function public.consume_shared_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.cleanup_shared_rate_limit_buckets(integer)
  from public, anon, authenticated;

grant execute on function public.consume_shared_rate_limit(text, text, integer, integer)
  to service_role;
grant execute on function public.cleanup_shared_rate_limit_buckets(integer)
  to service_role;

comment on table public.shared_rate_limit_buckets is
  'Atomic fixed-window counters keyed only by purpose-scoped HMAC-SHA256 subject hashes. Raw IP addresses and user identifiers are never stored.';

comment on function public.consume_shared_rate_limit(text, text, integer, integer) is
  'Atomically increments one fixed-window counter and returns allow/remaining/reset metadata. Service-role only.';

comment on function public.cleanup_shared_rate_limit_buckets(integer) is
  'Deletes a bounded number of expired shared rate-limit buckets. Service-role only.';

commit;
