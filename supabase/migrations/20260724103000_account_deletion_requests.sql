begin;

create extension if not exists pgcrypto;

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  workspace_id uuid,
  notification_email text,
  user_reference_hash text,
  request_source text not null check (request_source in ('web', 'mobile')),
  confirmation_version text not null default 'v1' check (confirmation_version = 'v1'),
  status text not null default 'pending' check (
    status in (
      'pending',
      'blocked',
      'processing',
      'completed',
      'completed_notification_pending',
      'cancelled',
      'failed'
    )
  ),
  requires_ownership_transfer boolean not null default false,
  requires_subscription_resolution boolean not null default false,
  requested_at timestamptz not null default now(),
  processing_deadline_at timestamptz not null default (now() + interval '30 days'),
  cancelled_at timestamptz,
  processing_started_at timestamptz,
  completed_at timestamptz,
  acknowledgement_sent_at timestamptz,
  completion_notification_sent_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_deletion_user_or_completed_reference_check check (
    user_id is not null
    or (
      status in ('completed', 'completed_notification_pending')
      and user_reference_hash is not null
    )
  ),
  constraint account_deletion_notification_email_check check (
    notification_email is null
    or (
      char_length(notification_email) between 3 and 320
      and notification_email = lower(notification_email)
      and notification_email !~ '[[:space:]]'
      and position('@' in notification_email) > 1
    )
  ),
  constraint account_deletion_reference_hash_check check (
    user_reference_hash is null
    or user_reference_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint account_deletion_error_code_check check (
    last_error_code is null
    or last_error_code ~ '^[a-z0-9_]{3,80}$'
  ),
  constraint account_deletion_deadline_check check (
    processing_deadline_at >= requested_at
    and processing_deadline_at <= requested_at + interval '31 days'
  )
);

create unique index if not exists account_deletion_requests_one_active_per_user_idx
  on public.account_deletion_requests (user_id)
  where user_id is not null and status in ('pending', 'blocked', 'processing');

create index if not exists account_deletion_requests_status_deadline_idx
  on public.account_deletion_requests (status, processing_deadline_at, requested_at);

create index if not exists account_deletion_requests_workspace_idx
  on public.account_deletion_requests (workspace_id)
  where workspace_id is not null;

create or replace function public.set_account_deletion_request_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_account_deletion_request_updated_at() from public;

create or replace trigger account_deletion_requests_set_updated_at
before update on public.account_deletion_requests
for each row execute function public.set_account_deletion_request_updated_at();

alter table public.account_deletion_requests enable row level security;

revoke all on table public.account_deletion_requests from public, anon, authenticated;
grant select, insert, update, delete on table public.account_deletion_requests to service_role;

comment on table public.account_deletion_requests is
  'Service-role-only queue for authenticated full-account deletion requests. No client role receives direct access.';
comment on column public.account_deletion_requests.notification_email is
  'Account email used only for request/completion notices; cleared after cancellation or successful completion notification.';
comment on column public.account_deletion_requests.user_reference_hash is
  'Pseudonymous SHA-256/HMAC reference retained after auth-user deletion; never exposed to clients.';
comment on column public.account_deletion_requests.processing_deadline_at is
  'Transparent maximum manual processing target, normally 30 days from request.';

commit;
