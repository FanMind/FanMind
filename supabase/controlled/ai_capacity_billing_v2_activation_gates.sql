begin;

alter table public.ai_capacity_admin_policy
  add column if not exists runtime_activation_ready boolean not null default false,
  add column if not exists package_sales_activation_ready boolean not null default false,
  add column if not exists top_up_activation_ready boolean not null default false;

create or replace function public.ai_capacity_admin_activation_guard()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $function$
begin
  if new.global_capacity_enabled and not new.runtime_activation_ready then
    raise exception using errcode = '23514', message = 'ai_capacity_runtime_activation_not_ready';
  end if;
  if (new.package_99_sales_enabled or new.package_199_sales_enabled or new.package_312_sales_enabled)
     and not new.package_sales_activation_ready then
    raise exception using errcode = '23514', message = 'ai_capacity_package_sales_activation_not_ready';
  end if;
  if new.top_up_sales_enabled and not new.top_up_activation_ready then
    raise exception using errcode = '23514', message = 'ai_capacity_top_up_activation_not_ready';
  end if;
  if new.global_capacity_enabled
     and (
       new.package_99_budget_eur_microcents is null
       or new.package_199_budget_eur_microcents is null
       or new.package_312_budget_eur_microcents is null
     ) then
    raise exception using errcode = '23514', message = 'ai_capacity_budget_approval_required';
  end if;
  return new;
end
$function$;

drop trigger if exists ai_capacity_admin_activation_guard on public.ai_capacity_admin_policy;
create trigger ai_capacity_admin_activation_guard
before insert or update on public.ai_capacity_admin_policy
for each row execute function public.ai_capacity_admin_activation_guard();

revoke all on function public.ai_capacity_admin_activation_guard() from public, anon, authenticated;

commit;
