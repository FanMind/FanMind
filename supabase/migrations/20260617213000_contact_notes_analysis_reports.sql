alter table public.contacts
  add column if not exists internal_notes text;

create table if not exists public.fan_analysis_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  report_json jsonb not null default '{}'::jsonb,
  summary text,
  model text,
  source_message_count integer not null default 0,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, contact_id)
);

create index if not exists fan_analysis_reports_workspace_contact_idx
  on public.fan_analysis_reports (workspace_id, contact_id);

alter table public.fan_analysis_reports enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'fan_analysis_reports'
      and policyname = 'fan_analysis_reports_select_workspace_member'
  ) then
    create policy fan_analysis_reports_select_workspace_member
      on public.fan_analysis_reports for select
      using (exists (
        select 1 from public.workspace_members wm
        where wm.workspace_id = fan_analysis_reports.workspace_id
          and wm.user_id = auth.uid()
      ));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'fan_analysis_reports'
      and policyname = 'fan_analysis_reports_insert_workspace_member'
  ) then
    create policy fan_analysis_reports_insert_workspace_member
      on public.fan_analysis_reports for insert
      with check (exists (
        select 1 from public.workspace_members wm
        where wm.workspace_id = fan_analysis_reports.workspace_id
          and wm.user_id = auth.uid()
      ));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'fan_analysis_reports'
      and policyname = 'fan_analysis_reports_update_workspace_member'
  ) then
    create policy fan_analysis_reports_update_workspace_member
      on public.fan_analysis_reports for update
      using (exists (
        select 1 from public.workspace_members wm
        where wm.workspace_id = fan_analysis_reports.workspace_id
          and wm.user_id = auth.uid()
      ))
      with check (exists (
        select 1 from public.workspace_members wm
        where wm.workspace_id = fan_analysis_reports.workspace_id
          and wm.user_id = auth.uid()
      ));
  end if;
end $$;
