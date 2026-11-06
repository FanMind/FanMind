begin;

-- Server-owned source of truth for the optional KI Plus / KI Ultra add-on.
-- A missing row deliberately means KI Standard. Browser clients must never
-- read or mutate the Stripe references stored here.
create table public.workspace_ai_tier_entitlements (
  workspace_id uuid primary key
    references public.workspaces(id) on delete cascade,
  tier_id text not null,
  status text not null default 'pending',
  source text not null default 'stripe',
  stripe_subscription_id text not null,
  stripe_subscription_item_id text not null,
  stripe_price_id text not null,
  effective_at timestamptz not null,
  expires_at timestamptz,
  last_stripe_event_id text not null,
  last_stripe_event_created_at bigint not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint workspace_ai_tier_entitlements_tier_check
    check (tier_id in ('plus', 'ultra')),
  constraint workspace_ai_tier_entitlements_status_check
    check (status in ('active', 'pending', 'paused', 'canceled', 'expired')),
  constraint workspace_ai_tier_entitlements_source_check
    check (source = 'stripe'),
  constraint workspace_ai_tier_entitlements_subscription_check
    check (stripe_subscription_id ~ '^sub_[A-Za-z0-9_]+$'),
  constraint workspace_ai_tier_entitlements_item_check
    check (stripe_subscription_item_id ~ '^si_[A-Za-z0-9_]+$'),
  constraint workspace_ai_tier_entitlements_price_check
    check (stripe_price_id ~ '^price_[A-Za-z0-9_]+$'),
  constraint workspace_ai_tier_entitlements_event_check
    check (last_stripe_event_id ~ '^evt_[A-Za-z0-9_]+$'),
  constraint workspace_ai_tier_entitlements_event_created_check
    check (last_stripe_event_created_at >= 0),
  constraint workspace_ai_tier_entitlements_period_check
    check (expires_at is null or expires_at > effective_at),
  constraint workspace_ai_tier_entitlements_item_unique
    unique (stripe_subscription_item_id)
);

create index workspace_ai_tier_entitlements_subscription_idx
  on public.workspace_ai_tier_entitlements (stripe_subscription_id);

create index workspace_ai_tier_entitlements_lifecycle_idx
  on public.workspace_ai_tier_entitlements (status, expires_at);

alter table public.workspace_ai_tier_entitlements enable row level security;
alter table public.workspace_ai_tier_entitlements force row level security;

-- The service role is the only data path. Do not add an authenticated policy:
-- settings pages and AI routes must receive a redacted server response.
revoke all on table public.workspace_ai_tier_entitlements
  from public, anon, authenticated, service_role;

-- Table-level REVOKE does not clear a pre-existing column grant. The migration
-- is new, but remove column privileges explicitly so restored/drifted schemas
-- also fail closed.
do $$
declare
  v_all_columns text;
begin
  select string_agg(format('%I', attribute.attname), ', ' order by attribute.attnum)
    into v_all_columns
    from pg_attribute as attribute
   where attribute.attrelid =
         'public.workspace_ai_tier_entitlements'::regclass
     and attribute.attnum > 0
     and not attribute.attisdropped;

  if v_all_columns is null then
    raise exception
      using
        errcode = '55000',
        message = 'workspace_ai_tier_entitlement_no_columns';
  end if;

  execute format(
    'revoke select (%1$s), insert (%1$s), update (%1$s), references (%1$s) on table public.workspace_ai_tier_entitlements from public, anon, authenticated',
    v_all_columns
  );
end
$$;

grant select, insert, update, delete
  on table public.workspace_ai_tier_entitlements
  to service_role;

create function public.touch_workspace_ai_tier_entitlement()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $function$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception
      using
        errcode = '23514',
        message = 'workspace_ai_tier_entitlement_workspace_immutable';
  end if;

  new.updated_at := statement_timestamp();
  return new;
end
$function$;

revoke all
  on function public.touch_workspace_ai_tier_entitlement()
  from public, anon, authenticated;

grant execute
  on function public.touch_workspace_ai_tier_entitlement()
  to service_role;

create trigger workspace_ai_tier_entitlements_touch
before update on public.workspace_ai_tier_entitlements
for each row
execute function public.touch_workspace_ai_tier_entitlement();

-- Transactional postcondition: no browser role may retain direct or inherited
-- table/column access, no RLS policy may expose rows, and the service role must
-- retain the four operations needed by the later Stripe lifecycle.
do $$
declare
  v_column record;
begin
  if not exists (
    select 1
      from pg_class as relation
     where relation.oid =
           'public.workspace_ai_tier_entitlements'::regclass
       and relation.relrowsecurity
       and relation.relforcerowsecurity
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'workspace_ai_tier_entitlement_rls_boundary_failed';
  end if;

  if exists (
    select 1
      from pg_policies
     where schemaname = 'public'
       and tablename = 'workspace_ai_tier_entitlements'
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'workspace_ai_tier_entitlement_policy_boundary_failed';
  end if;

  if has_table_privilege(
       'anon',
       'public.workspace_ai_tier_entitlements',
       'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
     )
     or has_table_privilege(
       'authenticated',
       'public.workspace_ai_tier_entitlements',
       'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
     ) then
    raise exception
      using
        errcode = '42501',
        message = 'workspace_ai_tier_entitlement_table_privilege_failed';
  end if;

  for v_column in
    select attribute.attname::text as column_name
      from pg_attribute as attribute
     where attribute.attrelid =
           'public.workspace_ai_tier_entitlements'::regclass
       and attribute.attnum > 0
       and not attribute.attisdropped
  loop
    if has_column_privilege(
         'anon',
         'public.workspace_ai_tier_entitlements',
         v_column.column_name,
         'SELECT,INSERT,UPDATE,REFERENCES'
       )
       or has_column_privilege(
         'authenticated',
         'public.workspace_ai_tier_entitlements',
         v_column.column_name,
         'SELECT,INSERT,UPDATE,REFERENCES'
       ) then
      raise exception
        using
          errcode = '42501',
          message = 'workspace_ai_tier_entitlement_column_privilege_failed',
          detail = format('column=%I', v_column.column_name);
    end if;
  end loop;

  if not has_table_privilege(
       'service_role',
       'public.workspace_ai_tier_entitlements',
       'SELECT'
     )
     or not has_table_privilege(
       'service_role',
       'public.workspace_ai_tier_entitlements',
       'INSERT'
     )
     or not has_table_privilege(
       'service_role',
       'public.workspace_ai_tier_entitlements',
       'UPDATE'
     )
     or not has_table_privilege(
       'service_role',
       'public.workspace_ai_tier_entitlements',
       'DELETE'
     )
     or has_table_privilege(
       'service_role',
       'public.workspace_ai_tier_entitlements',
       'TRUNCATE'
     )
     or has_table_privilege(
       'service_role',
       'public.workspace_ai_tier_entitlements',
       'REFERENCES'
     )
     or has_table_privilege(
       'service_role',
       'public.workspace_ai_tier_entitlements',
       'TRIGGER'
     ) then
    raise exception
      using
        errcode = '42501',
        message = 'workspace_ai_tier_entitlement_service_role_failed';
  end if;
end
$$;

commit;
