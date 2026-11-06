begin;

-- Supabase default privileges can grant service_role every table privilege at
-- CREATE TABLE time. The feature migrations require only CRUD. Revoke the
-- inherited-at-creation table ACL before restoring the exact server contract.
do $repair$
begin
  if to_regclass('public.workspace_ai_tier_entitlements') is not null then
    revoke all on table public.workspace_ai_tier_entitlements
      from service_role;
    grant select, insert, update, delete
      on table public.workspace_ai_tier_entitlements
      to service_role;
  end if;

  if to_regclass('public.mobile_push_registrations') is not null then
    revoke all on table public.mobile_push_registrations
      from service_role;
    grant select, insert, update, delete
      on table public.mobile_push_registrations
      to service_role;
  end if;
end
$repair$;

do $verify$
declare
  managed_table regclass;
begin
  foreach managed_table in array array[
    to_regclass('public.workspace_ai_tier_entitlements'),
    to_regclass('public.mobile_push_registrations')
  ]
  loop
    if managed_table is null then
      continue;
    end if;

    if not has_table_privilege('service_role', managed_table, 'SELECT')
       or not has_table_privilege('service_role', managed_table, 'INSERT')
       or not has_table_privilege('service_role', managed_table, 'UPDATE')
       or not has_table_privilege('service_role', managed_table, 'DELETE')
       or has_table_privilege('service_role', managed_table, 'TRUNCATE')
       or has_table_privilege('service_role', managed_table, 'REFERENCES')
       or has_table_privilege('service_role', managed_table, 'TRIGGER') then
      raise exception
        using
          errcode = '42501',
          message = 'service_role_table_privilege_contract_failed';
    end if;
  end loop;
end
$verify$;

commit;
