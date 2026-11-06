-- FanMind legacy Auth-/Workspace-Baseline für Supabase/Postgres
-- Stand: historischer MVP-Basisstand, nicht mehr vollständige Datenbank-Source-of-Truth.
--
-- Aktueller Reader:
-- - docs/database/fanmind_current_schema.md
-- - supabase/migrations/
-- - src/lib/supabase/server.ts
--
-- Zweck dieser Datei:
-- - Auth-/Workspace-Grundstein dokumentieren.
-- - Mindesttabellen profiles, workspaces und workspace_members zeigen.
-- - Commercial-Basiswerte für Pilot/Starter festhalten.
--
-- Nicht mehr korrekt als Vollschema:
-- - contacts, conversations, conversation_messages, memories, followups,
--   summaries, AI/Profile-Tabellen, Meta/Webhook-Tabellen, Reply Targets,
--   Billing-Erweiterungen und AI-Usage-Ausbau sind inzwischen separate
--   Migrationen bzw. aktuelle Reader-Themen.
--
-- Dieses Schema setzt keine Service-Role im Browser voraus; Inserts laufen über auth.uid() + RLS.
-- Vor Pilotkundendaten immer docs/SECURITY_RLS_SECRETS_CHECK.md prüfen.
--
-- Plan-/Paket-Regeln im aktuellen Reader:
-- - FanMind kennt vier plan_id-Werte: pilot, starter, growth, agency.
-- - Produktiv aktiv: Pilot / Setup und Starter.
-- - Growth und Agency bleiben Coming Soon / Roadmap, bis sie explizit freigegeben sind.
-- - Keine alten 299-Euro-Preise wieder einführen.
-- - Aktuelle Commercial-Werte:
--   pilot_only = 99000 Setup-Cents, 0 Monats-Cents, 0 Monate Bindung.
--   starter_paid_setup = 99000 Setup-Cents, 31200 Monats-Cents, 0 Monate Bindung.
--   starter_no_setup_commitment = 0 Setup-Cents, 31200 Monats-Cents, 12 Monate Bindung.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null default 'starter' check (plan_id in ('pilot', 'starter', 'growth', 'agency')),
  commercial_option text not null default 'starter_no_setup_commitment' check (commercial_option in ('pilot_only', 'starter_paid_setup', 'starter_no_setup_commitment')),
  setup_fee_cents integer not null default 0 check (setup_fee_cents >= 0),
  monthly_fee_cents integer not null default 31200 check (monthly_fee_cents >= 0),
  commitment_months integer not null default 12 check (commitment_months in (0, 12)),
  created_at timestamptz not null default now()
);

-- Migration für bereits bestehende Supabase-Tabellen:
-- 1) Neue Commercial-Spalten ergänzen. Defaults entsprechen der empfohlenen Starter-Option.
-- alter table public.workspaces add column if not exists commercial_option text not null default 'starter_no_setup_commitment';
-- alter table public.workspaces add column if not exists setup_fee_cents integer not null default 0;
-- alter table public.workspaces add column if not exists monthly_fee_cents integer not null default 31200;
-- alter table public.workspaces add column if not exists commitment_months integer not null default 12;
--
-- 2) Check Constraints ergänzen. Falls ein Constraint-Name in der bestehenden Tabelle schon
--    existiert, die jeweilige add-constraint-Zeile überspringen oder zuerst gezielt droppen.
-- alter table public.workspaces add constraint workspaces_plan_id_check check (plan_id in ('pilot', 'starter', 'growth', 'agency'));
-- alter table public.workspaces add constraint workspaces_commercial_option_check check (commercial_option in ('pilot_only', 'starter_paid_setup', 'starter_no_setup_commitment'));
-- alter table public.workspaces add constraint workspaces_commitment_months_check check (commitment_months in (0, 12));
-- alter table public.workspaces add constraint workspaces_setup_fee_cents_check check (setup_fee_cents >= 0);
-- alter table public.workspaces add constraint workspaces_monthly_fee_cents_check check (monthly_fee_cents >= 0);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "workspaces_select_owner_or_member"
  on public.workspaces for select
  using (
    owner_user_id = auth.uid()
    or exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = workspaces.id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspaces_insert_owner"
  on public.workspaces for insert
  with check (owner_user_id = auth.uid());

create policy "workspaces_update_owner"
  on public.workspaces for update
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "workspace_members_select_own"
  on public.workspace_members for select
  using (user_id = auth.uid());

create policy "workspace_members_insert_workspace_owner"
  on public.workspace_members for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.workspaces w
      where w.id = workspace_members.workspace_id
        and w.owner_user_id = auth.uid()
    )
  );

-- Aktuelle CRM-/KI-/Integrations-/Billing-Tabellen stehen nicht mehr in dieser Legacy-Datei.
-- Bitte die aktuelle Übersicht in docs/database/fanmind_current_schema.md und die Migrationen
-- unter supabase/migrations/ verwenden.
