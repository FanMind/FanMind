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
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists contacts_workspace_created_at_idx
  on public.contacts (workspace_id, created_at desc);

alter table public.contacts enable row level security;

create or replace function public.set_contacts_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'contacts_set_updated_at'
      and tgrelid = 'public.contacts'::regclass
  ) then
    create trigger contacts_set_updated_at
      before update on public.contacts
      for each row
      execute function public.set_contacts_updated_at();
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'contacts'
      and policyname = 'contacts_select_workspace_member'
  ) then
    create policy contacts_select_workspace_member
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
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'contacts'
      and policyname = 'contacts_insert_workspace_member'
  ) then
    create policy contacts_insert_workspace_member
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
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'contacts'
      and policyname = 'contacts_update_workspace_member'
  ) then
    create policy contacts_update_workspace_member
      on public.contacts for update
      using (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = contacts.workspace_id
            and wm.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = contacts.workspace_id
            and wm.user_id = auth.uid()
        )
      );
  end if;
end;
$$;
