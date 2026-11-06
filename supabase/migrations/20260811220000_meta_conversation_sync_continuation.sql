-- Server-only continuation state for bounded Meta conversation pagination.
-- A normal Web deploy must not apply this migration automatically.

alter table public.social_connections
  add column if not exists messenger_sync_continuation_after text,
  add column if not exists messenger_sync_continuation_started_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.social_connections'::regclass
      and conname = 'social_connections_messenger_sync_continuation_check'
  ) then
    alter table public.social_connections
      add constraint social_connections_messenger_sync_continuation_check
      check (
        (
          messenger_sync_continuation_after is null
          and messenger_sync_continuation_started_at is null
        )
        or (
          messenger_sync_continuation_after is not null
          and messenger_sync_continuation_started_at is not null
          and length(messenger_sync_continuation_after) between 1 and 2048
          and messenger_sync_continuation_after ~ '^[A-Za-z0-9._~+/=-]+$'
        )
      );
  end if;
end;
$$;

revoke select (
  messenger_sync_continuation_after,
  messenger_sync_continuation_started_at
) on table public.social_connections from public, anon, authenticated;

revoke insert (
  messenger_sync_continuation_after,
  messenger_sync_continuation_started_at
) on table public.social_connections from public, anon, authenticated;

revoke update (
  messenger_sync_continuation_after,
  messenger_sync_continuation_started_at
) on table public.social_connections from public, anon, authenticated;

revoke references (
  messenger_sync_continuation_after,
  messenger_sync_continuation_started_at
) on table public.social_connections from public, anon, authenticated;
