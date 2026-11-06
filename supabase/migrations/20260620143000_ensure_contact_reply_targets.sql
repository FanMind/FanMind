create table if not exists public.contact_reply_targets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  source_platform text not null,
  source_type text not null,
  label text,
  url text not null,
  quality text not null default 'manual_exact_thread',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_reply_targets_unique_workspace_contact_source unique (workspace_id, contact_id, source_type),
  constraint contact_reply_targets_https_url check (url ~* '^https://'),
  constraint contact_reply_targets_facebook_domain check (
    source_platform <> 'facebook'
    or lower(split_part(replace(url, 'https://', ''), '/', 1)) in (
      'business.facebook.com',
      'facebook.com',
      'www.facebook.com'
    )
  )
);

create index if not exists contact_reply_targets_workspace_contact_idx
  on public.contact_reply_targets (workspace_id, contact_id);

alter table public.contact_reply_targets enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contact_reply_targets'
      and policyname = 'contact_reply_targets_select_workspace_member'
  ) then
    create policy contact_reply_targets_select_workspace_member
      on public.contact_reply_targets for select
      using (exists (
        select 1 from public.workspace_members wm
        where wm.workspace_id = contact_reply_targets.workspace_id
          and wm.user_id = auth.uid()
      ));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contact_reply_targets'
      and policyname = 'contact_reply_targets_insert_workspace_member'
  ) then
    create policy contact_reply_targets_insert_workspace_member
      on public.contact_reply_targets for insert
      with check (exists (
        select 1 from public.workspace_members wm
        where wm.workspace_id = contact_reply_targets.workspace_id
          and wm.user_id = auth.uid()
      ));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contact_reply_targets'
      and policyname = 'contact_reply_targets_update_workspace_member'
  ) then
    create policy contact_reply_targets_update_workspace_member
      on public.contact_reply_targets for update
      using (exists (
        select 1 from public.workspace_members wm
        where wm.workspace_id = contact_reply_targets.workspace_id
          and wm.user_id = auth.uid()
      ))
      with check (exists (
        select 1 from public.workspace_members wm
        where wm.workspace_id = contact_reply_targets.workspace_id
          and wm.user_id = auth.uid()
      ));
  end if;
end $$;
