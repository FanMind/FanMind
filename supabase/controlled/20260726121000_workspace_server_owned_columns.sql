-- Controlled final privilege boundary for Workspace commercial and internal
-- fields. This file intentionally lives outside supabase/migrations so a
-- generic `supabase db push` cannot collapse the two-stage rollout.
--
-- Apply only with an exactly reviewed compatible application and the existing
-- protected SQL approval. This field-protection step does not enable admission.

begin;

-- This transaction closes browser privileges only. Historical consent is not
-- repaired, inferred or required to restrict writes. Free Admin-CRM accounts
-- and incomplete inactive accounts must not keep writable commercial fields.
-- Paid activation remains separately guarded by the existing server-side
-- hasCurrentWorkspacePaymentTermsEvidence check at every public Checkout
-- entry point. This SQL grants no entitlement and changes no customer row.
-- Apply only with the reviewed app that rejects new legacy Starter admission;
-- Daily and both demo paths retain their existing service-only writers.
set local lock_timeout = '5s';
set local statement_timeout = '60s';
select pg_advisory_xact_lock(hashtextextended('fanmind-workspace-field-protection-v1', 0));
lock table public.workspaces in share row exclusive mode;

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
