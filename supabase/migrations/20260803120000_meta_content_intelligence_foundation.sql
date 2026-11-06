-- Meta account isolation and content-intelligence foundation.
-- Analysis and metric collection stay disabled until the workspace legal gate
-- is explicitly confirmed through a server-owned workflow.

alter table public.social_connections
  add column if not exists oauth_login_type text,
  add column if not exists external_account_type text,
  add column if not exists token_expires_at timestamptz,
  add column if not exists permissions_verified_at timestamptz,
  add column if not exists analytics_enabled boolean not null default false;

do $$
begin
  if exists (
    select 1
    from public.social_connections
    where status = 'connected'
      and external_account_id is not null
    group by platform, external_account_id
    having count(*) > 1
  ) then
    raise exception using
      message = 'Duplicate active Meta account bindings must be resolved before this migration is applied.',
      errcode = '23505';
  end if;
end;
$$;

create unique index if not exists social_connections_active_external_account_unique_idx
  on public.social_connections (platform, external_account_id)
  where status = 'connected' and external_account_id is not null;

drop policy if exists social_connections_insert_workspace_member
  on public.social_connections;
drop policy if exists social_connections_update_workspace_member
  on public.social_connections;

revoke all on table public.social_connections from anon, authenticated;
grant select (
  id,
  workspace_id,
  platform,
  provider,
  status,
  external_account_id,
  external_account_name,
  page_id,
  page_name,
  token_last_four,
  scopes,
  webhook_subscribed,
  connected_by,
  connected_at,
  disconnected_at,
  last_event_at,
  last_comment_fetch_at,
  last_comment_fetch_count,
  last_comment_fetch_error,
  last_messenger_sync_at,
  last_messenger_sync_checked_count,
  last_messenger_sync_imported_inbound_count,
  last_messenger_sync_imported_outbound_count,
  last_messenger_sync_imported_media_count,
  last_messenger_sync_skipped_count,
  last_messenger_sync_error,
  last_messenger_sync_outbound_at,
  oauth_login_type,
  external_account_type,
  token_expires_at,
  permissions_verified_at,
  analytics_enabled,
  created_at,
  updated_at
) on public.social_connections to authenticated;

create table if not exists public.workspace_analysis_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  fan_analysis_enabled boolean not null default false,
  conversation_analysis_enabled boolean not null default false,
  user_voice_analysis_enabled boolean not null default false,
  content_insights_enabled boolean not null default false,
  legal_basis_status text not null default 'unconfirmed'
    check (legal_basis_status in ('unconfirmed', 'confirmed', 'blocked')),
  transparency_status text not null default 'unconfirmed'
    check (transparency_status in ('unconfirmed', 'confirmed', 'blocked')),
  data_processing_agreement_status text not null default 'unconfirmed'
    check (data_processing_agreement_status in ('unconfirmed', 'confirmed', 'blocked')),
  retention_status text not null default 'unconfirmed'
    check (retention_status in ('unconfirmed', 'confirmed', 'blocked')),
  data_subject_rights_status text not null default 'unconfirmed'
    check (data_subject_rights_status in ('unconfirmed', 'confirmed', 'blocked')),
  message_retention_days integer
    check (message_retention_days is null or message_retention_days between 1 and 3650),
  analysis_retention_days integer
    check (analysis_retention_days is null or analysis_retention_days between 1 and 3650),
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    not (
      fan_analysis_enabled
      or conversation_analysis_enabled
      or user_voice_analysis_enabled
      or content_insights_enabled
    )
    or (
      legal_basis_status = 'confirmed'
      and transparency_status = 'confirmed'
      and data_processing_agreement_status = 'confirmed'
      and retention_status = 'confirmed'
      and data_subject_rights_status = 'confirmed'
      and confirmed_by is not null
      and confirmed_at is not null
    )
  )
);

insert into public.workspace_analysis_settings (workspace_id)
select id from public.workspaces
on conflict (workspace_id) do nothing;

alter table public.workspace_analysis_settings enable row level security;

create policy workspace_analysis_settings_select_workspace_member
  on public.workspace_analysis_settings for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_analysis_settings.workspace_id
        and wm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.workspaces w
      where w.id = workspace_analysis_settings.workspace_id
        and w.owner_user_id = auth.uid()
    )
  );

revoke all on table public.workspace_analysis_settings from anon, authenticated;
grant select on table public.workspace_analysis_settings to authenticated;

create or replace function public.create_default_workspace_analysis_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_analysis_settings (workspace_id)
  values (new.id)
  on conflict (workspace_id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_default_workspace_analysis_settings()
  from public, anon, authenticated;

drop trigger if exists workspaces_create_analysis_settings
  on public.workspaces;
create trigger workspaces_create_analysis_settings
  after insert on public.workspaces
  for each row execute function public.create_default_workspace_analysis_settings();

alter table public.content_sources
  add column if not exists social_connection_id uuid
    references public.social_connections(id) on delete set null,
  add column if not exists external_account_id text,
  add column if not exists media_type text,
  add column if not exists content_format text,
  add column if not exists campaign_label text;

drop policy if exists content_sources_workspace_member_all
  on public.content_sources;
create policy content_sources_select_workspace_member
  on public.content_sources for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = content_sources.workspace_id
        and wm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.workspaces w
      where w.id = content_sources.workspace_id
        and w.owner_user_id = auth.uid()
    )
  );

revoke all on table public.content_sources from anon, authenticated;
grant select on table public.content_sources to authenticated;

create unique index if not exists social_connections_id_workspace_unique_idx
  on public.social_connections (id, workspace_id);
create unique index if not exists content_sources_id_workspace_unique_idx
  on public.content_sources (id, workspace_id);
create unique index if not exists conversations_id_workspace_unique_idx
  on public.conversations (id, workspace_id);
create unique index if not exists contacts_id_workspace_unique_idx
  on public.contacts (id, workspace_id);

alter table public.content_sources
  add constraint content_sources_connection_workspace_fk
  foreign key (social_connection_id, workspace_id)
  references public.social_connections (id, workspace_id)
  on delete no action;

create index if not exists content_sources_connection_published_idx
  on public.content_sources (workspace_id, social_connection_id, published_at desc);

create table if not exists public.content_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  social_connection_id uuid,
  content_source_id uuid not null,
  platform text not null check (platform in ('facebook', 'instagram')),
  external_account_id text not null,
  external_content_id text not null,
  measurement_window text not null default 'lifetime',
  reach bigint check (reach is null or reach >= 0),
  impressions bigint check (impressions is null or impressions >= 0),
  views bigint check (views is null or views >= 0),
  plays bigint check (plays is null or plays >= 0),
  likes bigint check (likes is null or likes >= 0),
  comments bigint check (comments is null or comments >= 0),
  shares bigint check (shares is null or shares >= 0),
  saves bigint check (saves is null or saves >= 0),
  link_clicks bigint check (link_clicks is null or link_clicks >= 0),
  profile_visits bigint check (profile_visits is null or profile_visits >= 0),
  follows bigint check (follows is null or follows >= 0),
  direct_messages bigint check (direct_messages is null or direct_messages >= 0),
  new_contacts bigint check (new_contacts is null or new_contacts >= 0),
  paid_reach bigint check (paid_reach is null or paid_reach >= 0),
  paid_impressions bigint check (paid_impressions is null or paid_impressions >= 0),
  source_metric_names jsonb not null default '{}'::jsonb,
  metric_payload_version integer not null default 1,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (workspace_id, content_source_id, measurement_window, captured_at)
);

alter table public.content_metric_snapshots
  add constraint content_metric_snapshots_connection_workspace_fk
  foreign key (social_connection_id, workspace_id)
  references public.social_connections (id, workspace_id)
  on delete cascade,
  add constraint content_metric_snapshots_content_workspace_fk
  foreign key (content_source_id, workspace_id)
  references public.content_sources (id, workspace_id)
  on delete cascade;

create index if not exists content_metric_snapshots_content_time_idx
  on public.content_metric_snapshots (workspace_id, content_source_id, captured_at desc);
create index if not exists content_metric_snapshots_account_time_idx
  on public.content_metric_snapshots (workspace_id, social_connection_id, captured_at desc);

alter table public.content_metric_snapshots enable row level security;

create policy content_metric_snapshots_select_workspace_member
  on public.content_metric_snapshots for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = content_metric_snapshots.workspace_id
        and wm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.workspaces w
      where w.id = content_metric_snapshots.workspace_id
        and w.owner_user_id = auth.uid()
    )
  );

revoke all on table public.content_metric_snapshots from anon, authenticated;
grant select on table public.content_metric_snapshots to authenticated;

create table if not exists public.communication_analysis_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid not null,
  contact_id uuid not null,
  report_json jsonb not null default '{}'::jsonb,
  source_message_count integer not null default 0 check (source_message_count >= 0),
  source_from_at timestamptz,
  source_to_at timestamptz,
  confidence_score integer not null default 0 check (confidence_score between 0 and 100),
  review_status text not null default 'unreviewed'
    check (review_status in ('unreviewed', 'confirmed', 'corrected', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  model text,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, conversation_id)
);

alter table public.communication_analysis_reports
  add constraint communication_analysis_conversation_workspace_fk
  foreign key (conversation_id, workspace_id)
  references public.conversations (id, workspace_id)
  on delete cascade,
  add constraint communication_analysis_contact_workspace_fk
  foreign key (contact_id, workspace_id)
  references public.contacts (id, workspace_id)
  on delete cascade;

create index if not exists communication_analysis_reports_contact_idx
  on public.communication_analysis_reports (workspace_id, contact_id, updated_at desc);

alter table public.communication_analysis_reports enable row level security;

create policy communication_analysis_reports_select_workspace_member
  on public.communication_analysis_reports for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = communication_analysis_reports.workspace_id
        and wm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.workspaces w
      where w.id = communication_analysis_reports.workspace_id
        and w.owner_user_id = auth.uid()
    )
  );

revoke all on table public.communication_analysis_reports from anon, authenticated;
grant select on table public.communication_analysis_reports to authenticated;

alter table public.fan_analysis_reports
  add column if not exists source_from_at timestamptz,
  add column if not exists source_to_at timestamptz,
  add column if not exists confidence_score integer not null default 0
    check (confidence_score between 0 and 100),
  add column if not exists review_status text not null default 'unreviewed'
    check (review_status in ('unreviewed', 'confirmed', 'corrected', 'rejected')),
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

alter table public.contact_ai_profiles
  add column if not exists source_from_at timestamptz,
  add column if not exists source_to_at timestamptz,
  add column if not exists review_status text not null default 'unreviewed'
    check (review_status in ('unreviewed', 'confirmed', 'corrected', 'rejected')),
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

alter table public.workspace_voice_profiles
  add column if not exists source_from_at timestamptz,
  add column if not exists source_to_at timestamptz,
  add column if not exists source_scope text not null default 'confirmed_manual_outbound',
  add column if not exists review_status text not null default 'unreviewed'
    check (review_status in ('unreviewed', 'confirmed', 'corrected', 'rejected')),
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add constraint workspace_voice_profiles_confirmed_manual_source_check
    check (source_scope = 'confirmed_manual_outbound');

drop policy if exists fan_analysis_reports_insert_workspace_member
  on public.fan_analysis_reports;
drop policy if exists fan_analysis_reports_update_workspace_member
  on public.fan_analysis_reports;
revoke all on table public.fan_analysis_reports from anon, authenticated;
grant select on table public.fan_analysis_reports to authenticated;

drop policy if exists contact_ai_profiles_workspace_member_all
  on public.contact_ai_profiles;
create policy contact_ai_profiles_select_workspace_member
  on public.contact_ai_profiles for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = contact_ai_profiles.workspace_id
        and wm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.workspaces w
      where w.id = contact_ai_profiles.workspace_id
        and w.owner_user_id = auth.uid()
    )
  );
revoke all on table public.contact_ai_profiles from anon, authenticated;
grant select on table public.contact_ai_profiles to authenticated;

drop policy if exists workspace_voice_profiles_workspace_member_all
  on public.workspace_voice_profiles;
create policy workspace_voice_profiles_select_workspace_member
  on public.workspace_voice_profiles for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_voice_profiles.workspace_id
        and wm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.workspaces w
      where w.id = workspace_voice_profiles.workspace_id
        and w.owner_user_id = auth.uid()
    )
  );
revoke all on table public.workspace_voice_profiles from anon, authenticated;
grant select on table public.workspace_voice_profiles to authenticated;

create or replace function public.set_meta_content_intelligence_updated_at()
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

revoke all on function public.set_meta_content_intelligence_updated_at()
  from public, anon, authenticated;

drop trigger if exists workspace_analysis_settings_set_updated_at
  on public.workspace_analysis_settings;
create trigger workspace_analysis_settings_set_updated_at
  before update on public.workspace_analysis_settings
  for each row execute function public.set_meta_content_intelligence_updated_at();

drop trigger if exists communication_analysis_reports_set_updated_at
  on public.communication_analysis_reports;
create trigger communication_analysis_reports_set_updated_at
  before update on public.communication_analysis_reports
  for each row execute function public.set_meta_content_intelligence_updated_at();
