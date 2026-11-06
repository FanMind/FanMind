-- FanMind Runtime MVP: workspace-scoped contacts/fans foundation.
-- Apply after docs/database/fanmind_mvp_schema.sql so public.workspaces and
-- public.workspace_members already exist.

create extension if not exists pgcrypto;

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  display_name text not null,
  handle text,
  source_platform text default 'manual',
  language text default 'de',
  status text default 'new',
  tags text[] default '{}',
  summary text,
  internal_notes text,
  is_top_fan boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists contacts_workspace_id_created_at_idx
  on public.contacts (workspace_id, created_at desc);

alter table public.contacts enable row level security;

-- Membership is the workspace boundary: a user may read contacts only for
-- workspaces where public.workspace_members contains their auth.uid().
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'contacts'
      and policyname = 'contacts_select_workspace_member'
  ) then
    create policy "contacts_select_workspace_member"
      on public.contacts for select
      using (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = contacts.workspace_id
            and wm.user_id = auth.uid()
        )
      );
  end if;
end
$$;

-- Inserts are allowed only into a workspace where the current user is a member.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'contacts'
      and policyname = 'contacts_insert_workspace_member'
  ) then
    create policy "contacts_insert_workspace_member"
      on public.contacts for insert
      with check (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = contacts.workspace_id
            and wm.user_id = auth.uid()
        )
      );
  end if;
end
$$;
