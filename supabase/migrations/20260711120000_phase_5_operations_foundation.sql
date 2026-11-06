-- FanMind Phase 5 operations foundation: admin-only operational data.
-- Stores only technical, privacy-sparing metadata. No secrets, prompts, fan messages or external platform credentials.

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  category text not null check (category in ('critical', 'warning', 'info', 'resolved')),
  severity text not null check (severity in ('critical', 'warning', 'info', 'resolved')),
  status text not null default 'open' check (status in ('open', 'read', 'acknowledged', 'resolved', 'dismissed')),
  title text not null check (length(trim(title)) > 0 and length(title) <= 160),
  message text not null check (length(trim(message)) > 0 and length(message) <= 1200),
  source text,
  technical_reference text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  read_by_user_id uuid,
  acknowledged_at timestamptz,
  acknowledged_by_user_id uuid,
  resolved_at timestamptz,
  constraint admin_notifications_no_secret_words check (
    title !~* '(secret|token|apikey|api_key|password|bearer)' and
    message !~* '(secret|token|apikey|api_key|password|bearer)'
  )
);

create table if not exists public.system_health_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  component text not null check (component in ('application','supabase_config','supabase_database','supabase_storage','stripe_config','openai_config','email_config','backup','deployment','nginx','pm2')),
  status text not null check (status in ('healthy','degraded','unavailable','unknown')),
  severity text not null default 'info' check (severity in ('critical','warning','info','resolved')),
  summary text not null check (length(trim(summary)) > 0 and length(summary) <= 500),
  technical_reference text,
  latency_ms integer,
  checked_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.admin_operation_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  job_type text not null check (job_type in ('health_check','backup_check','backup_snapshot','deployment_check','maintenance_note','manual_review')),
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled','blocked')),
  severity text not null default 'info' check (severity in ('critical','warning','info','resolved')),
  requested_by_user_id uuid,
  completed_at timestamptz,
  title text not null check (length(trim(title)) > 0 and length(title) <= 180),
  summary text,
  technical_reference text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  backup_type text not null check (backup_type in ('database','storage','configuration','full','verification')),
  environment text not null default 'production' check (environment in ('production','staging','test','development','unknown')),
  status text not null check (status in ('running','completed','failed','skipped','unknown')),
  severity text not null default 'info' check (severity in ('critical','warning','info','resolved')),
  provider text,
  storage_reference text,
  checksum_reference text,
  size_bytes bigint,
  technical_reference text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.operations_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_user_id uuid,
  actor_email text,
  action text not null check (length(trim(action)) > 0 and length(action) <= 160),
  target_table text,
  target_id uuid,
  severity text not null default 'info' check (severity in ('critical','warning','info','resolved')),
  outcome text not null check (outcome in ('success','failure','blocked','noop')),
  technical_reference text,
  metadata jsonb not null default '{}'::jsonb,
  constraint operations_audit_log_no_secret_words check (
    coalesce(actor_email, '') !~* '(secret|token|apikey|api_key|password|bearer)' and
    action !~* '(secret|token|apikey|api_key|password|bearer)'
  )
);

create index if not exists admin_notifications_created_at_idx on public.admin_notifications (created_at desc);
create index if not exists admin_notifications_unread_idx on public.admin_notifications (read_at) where read_at is null;
create index if not exists system_health_events_created_at_idx on public.system_health_events (created_at desc);
create index if not exists admin_operation_jobs_created_at_idx on public.admin_operation_jobs (created_at desc);
create index if not exists backup_runs_started_at_idx on public.backup_runs (started_at desc);
create index if not exists operations_audit_log_created_at_idx on public.operations_audit_log (created_at desc);

alter table public.admin_notifications enable row level security;
alter table public.system_health_events enable row level security;
alter table public.admin_operation_jobs enable row level security;
alter table public.backup_runs enable row level security;
alter table public.operations_audit_log enable row level security;

-- No authenticated policies are created deliberately: browser/client users cannot read or write these tables.
-- Platform-admin access is enforced in server routes via FANMIND_ADMIN_EMAILS and the Supabase service role.
revoke all on table public.admin_notifications from anon, authenticated;
revoke all on table public.system_health_events from anon, authenticated;
revoke all on table public.admin_operation_jobs from anon, authenticated;
revoke all on table public.backup_runs from anon, authenticated;
revoke all on table public.operations_audit_log from anon, authenticated;
