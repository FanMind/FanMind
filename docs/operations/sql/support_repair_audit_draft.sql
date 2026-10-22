-- FanMind support repair audit foundation (#1350).
-- Schema only: do not apply until staging review and RLS verification.
create table if not exists public.support_repair_audit (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  actor_user_id uuid not null,
  platform text not null check (platform in ('instagram', 'facebook', 'whatsapp')),
  action text not null,
  consent_required boolean not null,
  consent_given boolean not null default false,
  status text not null check (status in ('requested', 'denied', 'started', 'succeeded', 'failed', 'manual_action_required')),
  request_id uuid not null unique,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint support_repair_audit_consent check (not consent_required or consent_given or status in ('requested', 'denied'))
);
create index if not exists support_repair_audit_workspace_created
  on public.support_repair_audit (workspace_id, created_at desc);
alter table public.support_repair_audit enable row level security;
-- No user-facing RLS policies: service-role-only writes/reads until a
-- reviewed tenant-scoped read policy and audited write path are implemented.
revoke all on public.support_repair_audit from anon, authenticated;
comment on table public.support_repair_audit is
  'Server-only support repair audit; never store OAuth tokens or secrets.';
