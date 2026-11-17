-- Controlled final privilege boundary for Workspace commercial and internal
-- fields. This file intentionally lives outside supabase/migrations so a
-- generic `supabase db push` cannot collapse the two-stage rollout.
--
-- Apply only after 20260726120000 and the RPC-compatible application release
-- have passed registration, login-backfill and both demo-path verifications.

begin;

-- A Workspace created by the exact missing-column compatibility fallback can
-- legitimately lack the Step-A payment-terms columns. Never close the direct
-- write path until every productive Starter has trusted acceptance evidence.
do $$
begin
  if exists (
    select 1
      from public.workspaces
     where plan_id = 'starter'
       and commercial_option in (
         'starter_paid_setup',
         'starter_no_setup_commitment'
       )
       and (
         payment_terms_version is distinct from '2026-06-v1'
         or payment_terms_accepted_at is null
         or payment_terms_accepted_at <
           timestamptz '2026-06-01 00:00:00+00'
         or payment_terms_accepted_at >
           statement_timestamp() + interval '5 minutes'
         or payment_terms_accepted_by_user_id is distinct from owner_user_id
       )
  ) then
    raise exception
      using
        errcode = '23514',
        message = 'workspace_payment_terms_evidence_missing';
  end if;
end
$$;

alter table public.workspaces enable row level security;

drop policy if exists "workspaces_insert_owner"
  on public.workspaces;

drop policy if exists "workspaces_update_owner"
  on public.workspaces;

drop policy if exists "workspaces_update_owner_boundary"
  on public.workspaces;

create policy "workspaces_update_owner"
  on public.workspaces
  as permissive
  for update
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- A restrictive owner boundary prevents an unknown permissive UPDATE/ALL
-- policy in Production from broadening the tenant row scope.
create policy "workspaces_update_owner_boundary"
  on public.workspaces
  as restrictive
  for update
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

revoke insert, update on table public.workspaces
  from public, anon, authenticated;

-- Table-level REVOKE does not remove old column-level grants. Revoke INSERT
-- and UPDATE from every current column before granting the explicit allowlist.
do $$
declare
  v_all_columns text;
begin
  select string_agg(format('%I', attribute.attname), ', ' order by attribute.attnum)
    into v_all_columns
    from pg_attribute as attribute
   where attribute.attrelid = 'public.workspaces'::regclass
     and attribute.attnum > 0
     and not attribute.attisdropped;

  if v_all_columns is null then
    raise exception
      using
        errcode = '55000',
        message = 'workspace_privilege_no_columns';
  end if;

  execute format(
    'revoke insert (%1$s), update (%1$s) on table public.workspaces from public, anon, authenticated',
    v_all_columns
  );
end
$$;

grant update (
  name,
  organization_name,
  street_address,
  postal_code,
  city,
  country,
  vat_id,
  tax_number,
  company_register_number,
  company_register_court
) on table public.workspaces
  to authenticated;

-- Existing admin, Stripe, cancellation and demo paths use the server-only
-- service role and must retain their protected-field write access.
grant insert, update on table public.workspaces
  to service_role;

-- Fail closed if direct or inherited privileges still expose INSERT or any
-- UPDATE column outside the ten-column allowlist.
do $$
declare
  v_column record;
  v_owner_editable_columns constant text[] := array[
    'name',
    'organization_name',
    'street_address',
    'postal_code',
    'city',
    'country',
    'vat_id',
    'tax_number',
    'company_register_number',
    'company_register_court'
  ];
begin
  if not exists (
    select 1
      from pg_class as relation
     where relation.oid = 'public.workspaces'::regclass
       and relation.relrowsecurity
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'workspace_privilege_rls_boundary_failed';
  end if;

  if has_table_privilege(
       'anon',
       'public.workspaces',
       'INSERT'
     )
     or has_table_privilege(
       'authenticated',
       'public.workspaces',
       'INSERT'
     ) then
    raise exception
      using
        errcode = '42501',
        message = 'workspace_privilege_insert_boundary_failed';
  end if;

  for v_column in
    select attribute.attname::text as column_name
      from pg_attribute as attribute
     where attribute.attrelid = 'public.workspaces'::regclass
       and attribute.attnum > 0
       and not attribute.attisdropped
  loop
    if has_column_privilege(
         'anon',
         'public.workspaces',
         v_column.column_name,
         'INSERT'
       )
       or has_column_privilege(
         'authenticated',
         'public.workspaces',
         v_column.column_name,
         'INSERT'
       )
       or has_column_privilege(
         'anon',
         'public.workspaces',
         v_column.column_name,
         'UPDATE'
       )
       or (
         has_column_privilege(
           'authenticated',
           'public.workspaces',
           v_column.column_name,
           'UPDATE'
         ) is distinct from
           (v_column.column_name = any(v_owner_editable_columns))
       ) then
      raise exception
        using
          errcode = '42501',
          message = 'workspace_privilege_column_boundary_failed',
          detail = format('column=%I', v_column.column_name);
    end if;
  end loop;
end
$$;

commit;
