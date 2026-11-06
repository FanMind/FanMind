begin;

create extension if not exists pgcrypto;

create table if not exists public.mobile_push_registrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  expo_token_ciphertext text not null check (
    char_length(expo_token_ciphertext) between 48 and 512
    and expo_token_ciphertext ~ '^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$'
  ),
  expo_token_hash text not null unique check (
    expo_token_hash ~ '^[0-9a-f]{64}$'
  ),
  expo_project_id uuid not null,
  platform text not null check (platform in ('android', 'ios')),
  status text not null default 'active' check (status = 'active'),
  registered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobile_push_registrations_one_device_per_user unique (user_id),
  constraint mobile_push_registrations_expiry_check check (
    expires_at > last_seen_at
    and expires_at <= last_seen_at + interval '31 days'
  )
);

create index if not exists mobile_push_registrations_active_expiry_idx
  on public.mobile_push_registrations (expires_at)
  where status = 'active';

create or replace function public.set_mobile_push_registration_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_mobile_push_registration_updated_at()
  from public;

create or replace trigger mobile_push_registrations_set_updated_at
before update on public.mobile_push_registrations
for each row execute function public.set_mobile_push_registration_updated_at();

alter table public.mobile_push_registrations enable row level security;

revoke all on table public.mobile_push_registrations
  from public, anon, authenticated, service_role;
grant select, insert, update, delete
  on table public.mobile_push_registrations
  to service_role;

comment on table public.mobile_push_registrations is
  'Service-role-only encrypted Expo push registrations. One active beta device per auth user; no delivery job is enabled by this migration.';
comment on column public.mobile_push_registrations.expo_token_ciphertext is
  'AES-256-GCM ciphertext only. Plain Expo tokens must never be persisted or logged.';
comment on column public.mobile_push_registrations.expo_token_hash is
  'Keyed HMAC used for uniqueness and conflict detection without exposing the Expo token.';

commit;
