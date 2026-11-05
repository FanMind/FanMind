-- PROPOSAL ONLY: NOT AUTHORIZED FOR EXECUTION. No normal deployment may run this.
-- Separate Owner approval must bind exact SHA and Production drqkpdvtbbrrdwmtrodz.
-- Run full read-only target/backup/classifier preflight first; ABSENT only.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT pg_advisory_xact_lock(1350,20261105);
DO $absence$ BEGIN
 IF to_regclass('public.support_repair_audit') IS NOT NULL THEN RAISE EXCEPTION 'audit_not_absent'; END IF;
END $absence$;
-- FanMind support repair audit foundation (#1350).
-- Schema only: do not apply until staging review and RLS verification.
create table if not exists public.support_repair_audit (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  actor_user_id uuid not null,
  connection_id uuid not null,
  platform text not null check (platform in ('instagram', 'facebook', 'whatsapp')),
  action text not null,
  consent_required boolean not null,
  consent_given boolean not null default false,
  status text not null check (
    status in (
      'requested',
      'denied',
      'started',
      'succeeded',
      'failed',
      'partial',
      'manual_action_required'
    )
  ),
  request_id uuid not null unique,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint support_repair_audit_consent check (
    not consent_required or consent_given or status in ('requested', 'denied')
  ),
  constraint support_repair_audit_completion check (
    (status in ('requested', 'started') and completed_at is null)
    or
    (status in ('denied', 'succeeded', 'failed', 'partial', 'manual_action_required')
      and completed_at is not null)
  )
);
create index if not exists support_repair_audit_workspace_created
  on public.support_repair_audit (workspace_id, created_at desc);
create index if not exists support_repair_audit_connection_created
  on public.support_repair_audit (connection_id, created_at desc);
alter table public.support_repair_audit enable row level security;
-- No user-facing RLS policies: service-role-only writes/reads until a
-- reviewed tenant-scoped read policy and audited write path are implemented.
revoke all on public.support_repair_audit from anon, authenticated;
comment on table public.support_repair_audit is
  'Server-only support repair audit; never store OAuth tokens or secrets.';

REVOKE ALL ON public.support_repair_audit FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.support_repair_audit TO service_role;
-- Execution controller must embed the full classifier and grant postflight here
-- before COMMIT. This review template deliberately ends in ROLLBACK.
ROLLBACK;
