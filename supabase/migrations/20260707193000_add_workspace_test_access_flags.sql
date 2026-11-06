-- FanMind internal test access flags for admin/billing safeguards.
-- Adds the column expected by admin and setup code after Referral Phase 2.

alter table public.workspaces
  add column if not exists test_access_flags jsonb not null default '{}'::jsonb;

comment on column public.workspaces.test_access_flags is
  'Internal admin/test access flags. No public billing automation or payout logic.';
