create table if not exists public.social_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  platform text not null default 'facebook',
  provider text not null default 'meta',
  status text not null default 'connected',
  external_account_id text,
  external_account_name text,
  page_id text,
  page_name text,
  page_access_token_encrypted text,
  token_last_four text,
  scopes text[],
  webhook_subscribed boolean not null default false,
  connected_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz not null default now(),
  disconnected_at timestamptz,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists social_connections_workspace_platform_page_idx
  on public.social_connections (workspace_id, platform, page_id)
  where page_id is not null;

create index if not exists social_connections_page_lookup_idx
  on public.social_connections (platform, status, page_id);

alter table public.social_connections enable row level security;

create or replace function public.set_social_connections_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'social_connections_set_updated_at'
      and tgrelid = 'public.social_connections'::regclass
  ) then
    create trigger social_connections_set_updated_at
      before update on public.social_connections
      for each row
      execute function public.set_social_connections_updated_at();
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'social_connections'
      and policyname = 'social_connections_select_workspace_member'
  ) then
    create policy social_connections_select_workspace_member
      on public.social_connections for select
      using (exists (
        select 1 from public.workspace_members wm
        where wm.workspace_id = social_connections.workspace_id
          and wm.user_id = auth.uid()
      ));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'social_connections'
      and policyname = 'social_connections_insert_workspace_member'
  ) then
    create policy social_connections_insert_workspace_member
      on public.social_connections for insert
      with check (exists (
        select 1 from public.workspace_members wm
        where wm.workspace_id = social_connections.workspace_id
          and wm.user_id = auth.uid()
      ));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'social_connections'
      and policyname = 'social_connections_update_workspace_member'
  ) then
    create policy social_connections_update_workspace_member
      on public.social_connections for update
      using (exists (
        select 1 from public.workspace_members wm
        where wm.workspace_id = social_connections.workspace_id
          and wm.user_id = auth.uid()
      ))
      with check (exists (
        select 1 from public.workspace_members wm
        where wm.workspace_id = social_connections.workspace_id
          and wm.user_id = auth.uid()
      ));
  end if;
end;
$$;
