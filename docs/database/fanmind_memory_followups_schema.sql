-- FanMind Runtime MVP: workspace-scoped memories and manual follow-ups.
-- Apply after docs/database/fanmind_mvp_schema.sql and
-- docs/database/fanmind_contacts_schema.sql so public.workspaces,
-- public.workspace_members, and public.contacts already exist.
--
-- This file is intentionally not executed by the app. Paste/run it manually in
-- the Supabase SQL editor when you want to enable memory/follow-up persistence.

create extension if not exists pgcrypto;

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  type text default 'note',
  content text not null,
  importance text default 'normal',
  created_at timestamptz default now()
);

create table if not exists public.followups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  due_date date,
  priority text default 'normal',
  reason text not null,
  status text default 'open',
  created_at timestamptz default now()
);

create index if not exists memories_workspace_contact_created_at_idx
  on public.memories (workspace_id, contact_id, created_at desc);

create index if not exists followups_workspace_contact_status_due_idx
  on public.followups (workspace_id, contact_id, status, due_date);

alter table public.memories enable row level security;
alter table public.followups enable row level security;

-- Membership is the workspace boundary: a user may read memories only for
-- workspaces where public.workspace_members contains their auth.uid().
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'memories'
      and policyname = 'memories_select_workspace_member'
  ) then
    create policy "memories_select_workspace_member"
      on public.memories for select
      using (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = memories.workspace_id
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
      and tablename = 'memories'
      and policyname = 'memories_insert_workspace_member'
  ) then
    create policy "memories_insert_workspace_member"
      on public.memories for insert
      with check (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = memories.workspace_id
            and wm.user_id = auth.uid()
        )
      );
  end if;
end
$$;

-- Updates are allowed only within a workspace where the current user is a member.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'memories'
      and policyname = 'memories_update_workspace_member'
  ) then
    create policy "memories_update_workspace_member"
      on public.memories for update
      using (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = memories.workspace_id
            and wm.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = memories.workspace_id
            and wm.user_id = auth.uid()
        )
      );
  end if;
end
$$;

-- Membership is the workspace boundary: a user may read follow-ups only for
-- workspaces where public.workspace_members contains their auth.uid().
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'followups'
      and policyname = 'followups_select_workspace_member'
  ) then
    create policy "followups_select_workspace_member"
      on public.followups for select
      using (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = followups.workspace_id
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
      and tablename = 'followups'
      and policyname = 'followups_insert_workspace_member'
  ) then
    create policy "followups_insert_workspace_member"
      on public.followups for insert
      with check (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = followups.workspace_id
            and wm.user_id = auth.uid()
        )
      );
  end if;
end
$$;

-- Updates are allowed only within a workspace where the current user is a member.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'followups'
      and policyname = 'followups_update_workspace_member'
  ) then
    create policy "followups_update_workspace_member"
      on public.followups for update
      using (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = followups.workspace_id
            and wm.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = followups.workspace_id
            and wm.user_id = auth.uid()
        )
      );
  end if;
end
$$;
