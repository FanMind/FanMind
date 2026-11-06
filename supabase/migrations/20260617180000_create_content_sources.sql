create table if not exists public.content_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_platform text,
  source_type text,
  external_source_id text,
  external_post_id text,
  external_video_id text,
  title text,
  summary text,
  caption_excerpt text,
  permalink_url text,
  published_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists content_sources_workspace_source_unique_idx
  on public.content_sources (workspace_id, source_platform, source_type, external_source_id)
  where external_source_id is not null;

create index if not exists content_sources_workspace_post_idx
  on public.content_sources (workspace_id, source_platform, external_post_id)
  where external_post_id is not null;

create index if not exists content_sources_workspace_video_idx
  on public.content_sources (workspace_id, source_platform, external_video_id)
  where external_video_id is not null;

alter table public.content_sources enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'content_sources' and policyname = 'content_sources_workspace_member_all') then
    create policy content_sources_workspace_member_all
      on public.content_sources for all
      using (exists (select 1 from public.workspace_members wm where wm.workspace_id = content_sources.workspace_id and wm.user_id = auth.uid()))
      with check (exists (select 1 from public.workspace_members wm where wm.workspace_id = content_sources.workspace_id and wm.user_id = auth.uid()));
  end if;
end $$;
