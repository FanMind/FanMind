begin;

create table if not exists public.ai_capacity_admin_policy (
  singleton_id smallint primary key default 1 check (singleton_id = 1),
  global_capacity_enabled boolean not null default false,
  emergency_spend_freeze boolean not null default true,
  top_up_sales_enabled boolean not null default false,
  package_99_sales_enabled boolean not null default false,
  package_199_sales_enabled boolean not null default false,
  package_312_sales_enabled boolean not null default false,
  fast_enabled boolean not null default false,
  balanced_enabled boolean not null default false,
  premium_enabled boolean not null default false,
  package_99_budget_eur_microcents bigint,
  package_199_budget_eur_microcents bigint,
  package_312_budget_eur_microcents bigint,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default statement_timestamp(),
  updated_by_user_id uuid,
  constraint ai_capacity_budget_99_positive check (package_99_budget_eur_microcents is null or package_99_budget_eur_microcents > 0),
  constraint ai_capacity_budget_199_positive check (package_199_budget_eur_microcents is null or package_199_budget_eur_microcents > 0),
  constraint ai_capacity_budget_312_positive check (package_312_budget_eur_microcents is null or package_312_budget_eur_microcents > 0),
  constraint ai_capacity_enabled_mode_required check (
    not global_capacity_enabled or fast_enabled or balanced_enabled or premium_enabled
  )
);

insert into public.ai_capacity_admin_policy (singleton_id)
values (1)
on conflict (singleton_id) do nothing;

alter table public.ai_capacity_admin_policy enable row level security;
revoke all on table public.ai_capacity_admin_policy from public, anon, authenticated;
grant select on table public.ai_capacity_admin_policy to service_role;

create table if not exists public.ai_capacity_grants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  grant_kind text not null check (grant_kind in ('included_period', 'purchased')),
  grant_key text not null,
  package_id text check (package_id is null or package_id in ('capacity_99', 'capacity_199', 'capacity_312')),
  billing_period_key text,
  period_start timestamptz,
  period_end timestamptz,
  expires_at timestamptz,
  granted_eur_microcents bigint not null check (granted_eur_microcents > 0),
  reversed_eur_microcents bigint not null default 0 check (reversed_eur_microcents >= 0 and reversed_eur_microcents <= granted_eur_microcents),
  created_at timestamptz not null default statement_timestamp(),
  metadata jsonb not null default '{}'::jsonb,
  unique (workspace_id, grant_key),
  constraint ai_capacity_included_period_shape check (
    grant_kind <> 'included_period'
    or (package_id is not null and billing_period_key is not null and period_start is not null and period_end is not null and period_end > period_start)
  )
);

create table if not exists public.ai_capacity_reservations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  generation_key text not null,
  billing_period_key text not null,
  package_id text not null check (package_id in ('capacity_99', 'capacity_199', 'capacity_312')),
  quality_mode text not null check (quality_mode in ('fast', 'balanced', 'premium')),
  reserved_eur_microcents bigint not null check (reserved_eur_microcents > 0),
  settled_eur_microcents bigint check (settled_eur_microcents is null or (settled_eur_microcents >= 0 and settled_eur_microcents <= reserved_eur_microcents)),
  state text not null default 'reserved' check (state in ('reserved', 'settled', 'released', 'indeterminate', 'reconciliation_required')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (workspace_id, generation_key)
);

create table if not exists public.ai_capacity_reservation_allocations (
  reservation_id uuid not null references public.ai_capacity_reservations(id) on delete restrict,
  grant_id uuid not null references public.ai_capacity_grants(id) on delete restrict,
  reserved_eur_microcents bigint not null check (reserved_eur_microcents > 0),
  settled_eur_microcents bigint check (settled_eur_microcents is null or (settled_eur_microcents >= 0 and settled_eur_microcents <= reserved_eur_microcents)),
  primary key (reservation_id, grant_id)
);

create table if not exists public.ai_capacity_ledger_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  reservation_id uuid,
  generation_key text,
  event_type text not null check (event_type in (
    'included_period_grant',
    'purchased_credit_grant',
    'reservation_created',
    'reservation_settled',
    'reservation_released',
    'reservation_indeterminate',
    'purchase_reversal',
    'reconciliation_adjustment'
  )),
  bucket_kind text check (bucket_kind is null or bucket_kind in ('included_period', 'purchased')),
  grant_id uuid,
  amount_eur_microcents bigint not null check (amount_eur_microcents >= 0),
  provider text,
  model text,
  input_tokens bigint check (input_tokens is null or input_tokens >= 0),
  cached_input_tokens bigint check (cached_input_tokens is null or cached_input_tokens >= 0),
  cache_write_tokens bigint check (cache_write_tokens is null or cache_write_tokens >= 0),
  output_tokens bigint check (output_tokens is null or output_tokens >= 0),
  reasoning_tokens bigint check (reasoning_tokens is null or reasoning_tokens >= 0),
  pricing_version text,
  fx_version text,
  occurred_at timestamptz not null default statement_timestamp(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ai_capacity_grants_workspace_idx
  on public.ai_capacity_grants (workspace_id, created_at);
create index if not exists ai_capacity_reservations_workspace_state_idx
  on public.ai_capacity_reservations (workspace_id, state, created_at);
create index if not exists ai_capacity_ledger_workspace_time_idx
  on public.ai_capacity_ledger_events (workspace_id, occurred_at desc);

alter table public.ai_capacity_grants enable row level security;
alter table public.ai_capacity_reservations enable row level security;
alter table public.ai_capacity_reservation_allocations enable row level security;
alter table public.ai_capacity_ledger_events enable row level security;

revoke all on table public.ai_capacity_grants from public, anon, authenticated;
revoke all on table public.ai_capacity_reservations from public, anon, authenticated;
revoke all on table public.ai_capacity_reservation_allocations from public, anon, authenticated;
revoke all on table public.ai_capacity_ledger_events from public, anon, authenticated;

grant select on table public.ai_capacity_grants to service_role;
grant select on table public.ai_capacity_reservations to service_role;
grant select on table public.ai_capacity_reservation_allocations to service_role;
grant select on table public.ai_capacity_ledger_events to service_role;

create or replace function public.ai_capacity_ledger_immutable()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $function$
begin
  raise exception using errcode = '42501', message = 'ai_capacity_ledger_immutable';
end
$function$;

drop trigger if exists ai_capacity_ledger_immutable_update_delete on public.ai_capacity_ledger_events;
create trigger ai_capacity_ledger_immutable_update_delete
before update or delete on public.ai_capacity_ledger_events
for each row execute function public.ai_capacity_ledger_immutable();

create or replace function public.admin_get_ai_capacity_policy()
returns table (
  global_capacity_enabled boolean,
  emergency_spend_freeze boolean,
  top_up_sales_enabled boolean,
  package_99_sales_enabled boolean,
  package_199_sales_enabled boolean,
  package_312_sales_enabled boolean,
  fast_enabled boolean,
  balanced_enabled boolean,
  premium_enabled boolean,
  package_99_budget_eur_microcents bigint,
  package_199_budget_eur_microcents bigint,
  package_312_budget_eur_microcents bigint,
  revision bigint,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
set row_security = off
as $function$
  select
    p.global_capacity_enabled,
    p.emergency_spend_freeze,
    p.top_up_sales_enabled,
    p.package_99_sales_enabled,
    p.package_199_sales_enabled,
    p.package_312_sales_enabled,
    p.fast_enabled,
    p.balanced_enabled,
    p.premium_enabled,
    p.package_99_budget_eur_microcents,
    p.package_199_budget_eur_microcents,
    p.package_312_budget_eur_microcents,
    p.revision,
    p.updated_at
  from public.ai_capacity_admin_policy as p
  where p.singleton_id = 1
$function$;

revoke all on function public.admin_get_ai_capacity_policy() from public, anon, authenticated;
grant execute on function public.admin_get_ai_capacity_policy() to service_role;

create or replace function public.admin_update_ai_capacity_policy(
  p_admin_user_id uuid,
  p_admin_email text,
  p_expected_revision bigint,
  p_global_capacity_enabled boolean,
  p_emergency_spend_freeze boolean,
  p_top_up_sales_enabled boolean,
  p_package_99_sales_enabled boolean,
  p_package_199_sales_enabled boolean,
  p_package_312_sales_enabled boolean,
  p_fast_enabled boolean,
  p_balanced_enabled boolean,
  p_premium_enabled boolean,
  p_package_99_budget_eur_microcents bigint,
  p_package_199_budget_eur_microcents bigint,
  p_package_312_budget_eur_microcents bigint
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
set row_security = off
as $function$
declare
  v_next_revision bigint;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'ai_capacity_admin_service_role_required';
  end if;
  if p_admin_user_id is null or p_expected_revision is null or p_expected_revision < 1 then
    raise exception using errcode = '22023', message = 'ai_capacity_admin_identity_or_revision_invalid';
  end if;
  if p_global_capacity_enabled and not (p_fast_enabled or p_balanced_enabled or p_premium_enabled) then
    raise exception using errcode = '23514', message = 'ai_capacity_admin_quality_mode_required';
  end if;
  if p_package_99_budget_eur_microcents is not null and p_package_99_budget_eur_microcents <= 0
     or p_package_199_budget_eur_microcents is not null and p_package_199_budget_eur_microcents <= 0
     or p_package_312_budget_eur_microcents is not null and p_package_312_budget_eur_microcents <= 0 then
    raise exception using errcode = '23514', message = 'ai_capacity_admin_budget_invalid';
  end if;

  update public.ai_capacity_admin_policy
     set global_capacity_enabled = p_global_capacity_enabled,
         emergency_spend_freeze = p_emergency_spend_freeze,
         top_up_sales_enabled = p_top_up_sales_enabled,
         package_99_sales_enabled = p_package_99_sales_enabled,
         package_199_sales_enabled = p_package_199_sales_enabled,
         package_312_sales_enabled = p_package_312_sales_enabled,
         fast_enabled = p_fast_enabled,
         balanced_enabled = p_balanced_enabled,
         premium_enabled = p_premium_enabled,
         package_99_budget_eur_microcents = p_package_99_budget_eur_microcents,
         package_199_budget_eur_microcents = p_package_199_budget_eur_microcents,
         package_312_budget_eur_microcents = p_package_312_budget_eur_microcents,
         revision = revision + 1,
         updated_at = statement_timestamp(),
         updated_by_user_id = p_admin_user_id
   where singleton_id = 1
     and revision = p_expected_revision
  returning revision into v_next_revision;

  if v_next_revision is null then
    raise exception using errcode = '40001', message = 'ai_capacity_admin_revision_conflict';
  end if;

  insert into public.operations_audit_log (
    actor_user_id, actor_email, action, target_table, target_id, severity, outcome, metadata
  ) values (
    p_admin_user_id,
    case when coalesce(p_admin_email, '') ~* '(secret|token|apikey|api_key|password|bearer)' then null else nullif(btrim(p_admin_email), '') end,
    'ai_capacity_admin_policy_change',
    'ai_capacity_admin_policy',
    null,
    case when p_emergency_spend_freeze then 'warning' else 'info' end,
    'success',
    jsonb_build_object(
      'revision', v_next_revision,
      'global_capacity_enabled', p_global_capacity_enabled,
      'emergency_spend_freeze', p_emergency_spend_freeze,
      'top_up_sales_enabled', p_top_up_sales_enabled,
      'package_sales', jsonb_build_object('capacity_99', p_package_99_sales_enabled, 'capacity_199', p_package_199_sales_enabled, 'capacity_312', p_package_312_sales_enabled),
      'quality_modes', jsonb_build_object('fast', p_fast_enabled, 'balanced', p_balanced_enabled, 'premium', p_premium_enabled)
    )
  );

  return v_next_revision;
end
$function$;

revoke all on function public.admin_update_ai_capacity_policy(
  uuid, text, bigint, boolean, boolean, boolean, boolean, boolean, boolean,
  boolean, boolean, boolean, bigint, bigint, bigint
) from public, anon, authenticated;
grant execute on function public.admin_update_ai_capacity_policy(
  uuid, text, bigint, boolean, boolean, boolean, boolean, boolean, boolean,
  boolean, boolean, boolean, bigint, bigint, bigint
) to service_role;

commit;
