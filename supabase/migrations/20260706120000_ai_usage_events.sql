create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  feature text not null,
  model text not null,
  provider text not null default 'openai',
  input_chars integer not null default 0 check (input_chars >= 0),
  output_chars integer not null default 0 check (output_chars >= 0),
  estimated_input_tokens integer not null default 0 check (estimated_input_tokens >= 0),
  estimated_output_tokens integer not null default 0 check (estimated_output_tokens >= 0),
  estimated_total_tokens integer not null default 0 check (estimated_total_tokens >= 0),
  estimated_cost_cents numeric(12, 6) not null default 0 check (estimated_cost_cents >= 0),
  currency text not null default 'USD',
  status text not null check (status in ('ok', 'error', 'skipped')),
  error_code text,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  source_route text,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_workspace_created_idx on public.ai_usage_events (workspace_id, created_at desc);
create index if not exists ai_usage_events_feature_created_idx on public.ai_usage_events (feature, created_at desc);
create index if not exists ai_usage_events_contact_created_idx on public.ai_usage_events (contact_id, created_at desc);

alter table public.ai_usage_events enable row level security;

create policy ai_usage_events_select_workspace_member
  on public.ai_usage_events for select
  using (exists (select 1 from public.workspace_members wm where wm.workspace_id = ai_usage_events.workspace_id and wm.user_id = auth.uid()));

create policy ai_usage_events_insert_workspace_member
  on public.ai_usage_events for insert
  with check (exists (select 1 from public.workspace_members wm where wm.workspace_id = ai_usage_events.workspace_id and wm.user_id = auth.uid()));
