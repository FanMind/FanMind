-- FanMind Referral Growth Window: admin-only Datenmodell und RLS-Grundlage.
-- Keine automatische Billing-Verrechnung und keine öffentliche Nutzerfunktion aktivieren.

create table if not exists public.referral_program_state (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'open',
  active_paid_workspace_cap integer not null default 2000 check (active_paid_workspace_cap > 0),
  active_paid_workspace_count integer not null default 0 check (active_paid_workspace_count >= 0),
  active_paid_workspace_count_snapshot integer not null default 0 check (active_paid_workspace_count_snapshot >= 0),
  closed_at timestamptz,
  reopened_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid references auth.users(id) on delete set null,
  admin_note text,
  constraint referral_program_state_status_check check (status in ('open','closing','closed','reopened'))
);

create unique index if not exists referral_program_state_singleton_idx on public.referral_program_state ((true));

insert into public.referral_program_state (status, active_paid_workspace_cap, active_paid_workspace_count, active_paid_workspace_count_snapshot, admin_note)
select 'open', 2000, 0, 0, 'Admin-only Referral Growth Window foundation. Billing-Verrechnung ist nicht aktiv.'
where not exists (select 1 from public.referral_program_state);

create table if not exists public.referral_program_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  referral_code text not null,
  eligible boolean not null default false,
  status text not null default 'pending',
  override_active_referral_count integer check (override_active_referral_count is null or override_active_referral_count >= 0),
  override_discount_percent integer check (override_discount_percent is null or (override_discount_percent >= 0 and override_discount_percent <= 100)),
  override_reason text,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid references auth.users(id) on delete set null,
  admin_note text,
  constraint referral_program_members_status_check check (status in ('pending','qualified','active','inactive','rejected','locked_after_window_closed'))
);

create unique index if not exists referral_program_members_referral_code_idx on public.referral_program_members (lower(referral_code));
create index if not exists referral_program_members_workspace_idx on public.referral_program_members (workspace_id);
create index if not exists referral_program_members_status_idx on public.referral_program_members (status);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_workspace_id uuid not null references public.workspaces(id) on delete cascade,
  referrer_user_id uuid references auth.users(id) on delete set null,
  referred_workspace_id uuid references public.workspaces(id) on delete set null,
  referred_user_id uuid references auth.users(id) on delete set null,
  referral_code text not null,
  status text not null default 'pending',
  created_during_program_status text not null,
  first_seen_at timestamptz not null default now(),
  qualified_at timestamptz,
  activated_at timestamptz,
  deactivated_at timestamptz,
  deactivation_reason text,
  billing_status_snapshot text,
  locked_reason text,
  admin_override boolean not null default false,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid references auth.users(id) on delete set null,
  constraint referrals_status_check check (status in ('pending','qualified','active','inactive','rejected','locked_after_window_closed')),
  constraint referrals_program_status_check check (created_during_program_status in ('open','closing','closed','reopened')),
  constraint referrals_no_self_workspace_check check (referred_workspace_id is null or referred_workspace_id <> referrer_workspace_id)
);

create index if not exists referrals_referrer_workspace_status_idx on public.referrals (referrer_workspace_id, status);
create index if not exists referrals_referred_workspace_idx on public.referrals (referred_workspace_id);
create index if not exists referrals_referral_code_idx on public.referrals (lower(referral_code));

create table if not exists public.referral_discount_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  active_referral_count integer not null default 0 check (active_referral_count >= 0),
  discount_percent integer not null default 0 check (discount_percent >= 0 and discount_percent <= 100),
  monthly_fee_cents_before_discount integer check (monthly_fee_cents_before_discount is null or monthly_fee_cents_before_discount >= 0),
  monthly_discount_cents integer check (monthly_discount_cents is null or monthly_discount_cents >= 0),
  monthly_fee_cents_after_discount integer check (monthly_fee_cents_after_discount is null or monthly_fee_cents_after_discount >= 0),
  program_status_snapshot text not null,
  calculated_at timestamptz not null default now(),
  calculated_by_user_id uuid references auth.users(id) on delete set null,
  admin_note text,
  constraint referral_discount_snapshots_program_status_check check (program_status_snapshot in ('open','closing','closed','reopened'))
);

create index if not exists referral_discount_snapshots_workspace_calculated_idx on public.referral_discount_snapshots (workspace_id, calculated_at desc);

alter table public.referral_program_state enable row level security;
alter table public.referral_program_members enable row level security;
alter table public.referrals enable row level security;
alter table public.referral_discount_snapshots enable row level security;

-- Admin-only MVP: keine authenticated Policies. Admin UI nutzt serverseitig die Service Role nach requirePlatformAdmin().
-- Öffentliche Signup-/Checkout-Attribution und Nutzer-Dashboard werden erst in separaten, geprüften Schritten freigeschaltet.
