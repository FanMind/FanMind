begin;

-- Apply separately after the existing Capacity writer. Never seed admission here.
create table public.workspace_capacity_checkout_contracts (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  owner_user_id uuid not null,
  billing_contract_version text not null check (billing_contract_version = 'capacity_v2'),
  package_id text not null check (package_id in ('capacity_99','capacity_199','capacity_312')),
  price_id text not null references fanmind_capacity_private.package_prices(price_id),
  admitted_at timestamptz not null default statement_timestamp(),
  admitted_until timestamptz not null,
  check (admitted_until > admitted_at and admitted_until <= admitted_at + interval '12 hours')
);
alter table public.workspace_capacity_checkout_contracts enable row level security;
revoke all on public.workspace_capacity_checkout_contracts from public, anon, authenticated, service_role;

create function public.read_ai_capacity_checkout_contract(p_workspace_id uuid, p_owner_user_id uuid)
returns table (package_id text, price_id text, eligible boolean)
language sql stable security definer set search_path='' as $contract$
  select c.package_id, c.price_id,
    coalesce(c.owner_user_id = w.owner_user_id
      and w.plan_id::text = 'pilot' and w.commercial_option::text = 'pilot_only'
      and w.billing_status::text = 'pending_payment_setup'
      and w.billing_suspended_at is null
      and w.stripe_customer_id is null
      and w.stripe_subscription_id is null
      and w.stripe_checkout_session_id is null
      and c.admitted_until > statement_timestamp()
      and c.admitted_at <= statement_timestamp()
      and m.active and m.package_id = c.package_id, false)
  from public.workspace_capacity_checkout_contracts c
  join public.workspaces w on w.id = c.workspace_id and w.owner_user_id = p_owner_user_id
  left join fanmind_capacity_private.package_prices m on m.price_id = c.price_id
  where auth.role() = 'service_role' and c.workspace_id = p_workspace_id
$contract$;
revoke all on function public.read_ai_capacity_checkout_contract(uuid,uuid) from public, anon, authenticated;
grant execute on function public.read_ai_capacity_checkout_contract(uuid,uuid) to service_role;

commit;
