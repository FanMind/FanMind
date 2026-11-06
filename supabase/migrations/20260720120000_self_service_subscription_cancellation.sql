-- Self-service cancellation state. Account/login are preserved; ended workspaces become archived/read-only.
alter table public.workspaces
  add column if not exists billing_contract_started_at timestamptz,
  add column if not exists billing_current_period_end_at timestamptz,
  add column if not exists billing_next_invoice_at timestamptz,
  add column if not exists billing_minimum_term_ends_at timestamptz,
  add column if not exists subscription_cancel_requested_at timestamptz,
  add column if not exists subscription_cancel_requested_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists subscription_cancel_at_period_end boolean not null default false,
  add column if not exists subscription_effective_end_at timestamptz,
  add column if not exists subscription_cancellation_revoked_at timestamptz,
  add column if not exists workspace_access_mode text not null default 'active';

alter table public.workspaces
  drop constraint if exists workspaces_workspace_access_mode_check;
alter table public.workspaces
  add constraint workspaces_workspace_access_mode_check check (workspace_access_mode in ('active','archived_readonly'));

create index if not exists workspaces_subscription_effective_end_idx on public.workspaces (subscription_effective_end_at);
create index if not exists workspaces_access_mode_idx on public.workspaces (workspace_access_mode);
