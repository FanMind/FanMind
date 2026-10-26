-- PREPARATION ONLY. Catalog/aggregate reads; never install a target helper.
-- The protected transport must independently bind project, TLS and merged main.
begin transaction isolation level repeatable read read only;
set local search_path = pg_catalog, public;
-- Fail instead of accepting RLS-filtered zero-row observations.
set local row_security = off;
set local statement_timeout = '10s';
set local lock_timeout = '2s';
set local idle_in_transaction_session_timeout = '15s';

with table_profiles as (
  select c.relname, jsonb_build_object(
    'name', c.relname, 'kind', c.relkind, 'owner', pg_get_userbyid(c.relowner),
    'rls', c.relrowsecurity, 'force_rls', c.relforcerowsecurity,
    'columns', (select jsonb_agg(jsonb_build_array(a.attname,
      format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attidentity,a.attgenerated,
      pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)
      from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
      where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
    'constraints', (select jsonb_agg(jsonb_build_array(k.conname,k.convalidated,
      pg_get_constraintdef(k.oid)) order by k.conname) from pg_constraint k where k.conrelid=c.oid),
    'indexes', (select jsonb_agg(jsonb_build_array(i.relname,x.indisvalid,x.indisready,
      pg_get_indexdef(x.indexrelid)) order by i.relname) from pg_index x
      join pg_class i on i.oid=x.indexrelid where x.indrelid=c.oid),
    'triggers', (select jsonb_agg(jsonb_build_array(t.tgname,t.tgenabled,
      pg_get_triggerdef(t.oid)) order by t.tgname) from pg_trigger t
      where t.tgrelid=c.oid and not t.tgisinternal),
    'policies', (select jsonb_agg(jsonb_build_array(p.polname,p.polcmd,p.polpermissive,
      p.polroles::text,pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid))
      order by p.polname) from pg_policy p where p.polrelid=c.oid),
    'acl', (select jsonb_agg(jsonb_build_array(case when x.grantee=0 then 'PUBLIC'
      else pg_get_userbyid(x.grantee) end,x.privilege_type,x.is_grantable)
      order by x.grantee::regrole::text,x.privilege_type,x.is_grantable)
      from aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) x),
    'column_acl', (select jsonb_agg(jsonb_build_array(a.attname,
      case when x.grantee=0 then 'PUBLIC' else pg_get_userbyid(x.grantee) end,
      x.privilege_type,x.is_grantable) order by a.attname,x.grantee::regrole::text,x.privilege_type)
      from pg_attribute a cross join lateral aclexplode(a.attacl) x
      where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
    'effective', (select jsonb_agg(jsonb_build_array(r,p,has_table_privilege(r,c.oid,p))
      order by r,p) from unnest(array['anon','authenticated','service_role']) r
      cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p),
    'effective_columns', (select jsonb_agg(jsonb_build_array(r,a.attname,p,
      has_column_privilege(r,c.oid,a.attnum,p)) order by r,a.attname,p)
      from pg_attribute a cross join unnest(array['anon','authenticated','service_role']) r
      cross join unnest(array['SELECT','INSERT','UPDATE','REFERENCES']) p
      where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped)
  ) profile from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname=any(array[
    'ai_capacity_admin_policy','ai_capacity_grants','ai_capacity_reservations',
    'ai_capacity_reservation_allocations','ai_capacity_ledger_events'])
), function_profiles as (
  select p.proname, pg_get_function_identity_arguments(p.oid) args,
    jsonb_build_object('name',p.proname,'args',pg_get_function_identity_arguments(p.oid),
      'owner',pg_get_userbyid(p.proowner),'definition',md5(pg_get_functiondef(p.oid)),
      'acl',(select jsonb_agg(jsonb_build_array(case when x.grantee=0 then 'PUBLIC'
        else pg_get_userbyid(x.grantee) end,x.privilege_type,x.is_grantable)
        order by x.grantee::regrole::text,x.privilege_type,x.is_grantable)
        from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x),
      'effective',(select jsonb_agg(jsonb_build_array(r,has_function_privilege(r,p.oid,'EXECUTE'))
        order by r) from unnest(array['anon','authenticated','service_role']) r)) profile
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and (p.proname like 'ai\_capacity\_%' escape '\'
    or p.proname in ('admin_get_ai_capacity_policy','admin_update_ai_capacity_policy'))
), schema_profile as (
  select jsonb_build_object(
    'tables',(select jsonb_agg(profile order by relname) from table_profiles),
    'functions',(select jsonb_agg(profile order by proname,args) from function_profiles)) profile
), normalized_table_profiles as (
  select relname, case when relname<>'ai_capacity_admin_policy' then profile else
    jsonb_set(profile,'{columns}',(select jsonb_agg(case column_value->>0
      when 'package_99_budget_eur_microcents' then jsonb_set(column_value,'{5}',to_jsonb('1500000000'::text))
      when 'package_199_budget_eur_microcents' then jsonb_set(column_value,'{5}',to_jsonb('''3000000000''::bigint'::text))
      when 'package_312_budget_eur_microcents' then jsonb_set(column_value,'{5}',to_jsonb('''5000000000''::bigint'::text))
      else column_value end order by ordinal)
      from jsonb_array_elements(profile->'columns') with ordinality columns(column_value,ordinal))) end profile
  from table_profiles
), normalized_schema_profile as (
  select jsonb_build_object(
    'tables',(select jsonb_agg(profile order by relname) from normalized_table_profiles),
    'functions',(select jsonb_agg(profile order by proname,args) from function_profiles)) profile
), capacity_migration_markers as (
  select
    regexp_replace(regexp_replace(lower(coalesce(name,'')),'^[0-9]{14}[_ -]*',''),'[ -]+','_','g') marker_name,
    regexp_replace(regexp_replace(lower(coalesce(version,'')),'^[0-9]{14}[_ -]*',''),'[ -]+','_','g') marker_version,
    coalesce(name,'') ~* 'ai[_ -]?capacity|capacity[_ -]?(billing|reserve|v2)' marker_name_is_capacity,
    version ~* 'ai[_ -]?capacity|capacity[_ -]?(billing|reserve|v2)' marker_version_is_capacity,
    cardinality(coalesce(statements,array[]::text[]))>0 marker_has_statements
  from supabase_migrations.schema_migrations
  where coalesce(name,'') ~* 'ai[_ -]?capacity|capacity[_ -]?(billing|reserve|v2)'
     or version ~* 'ai[_ -]?capacity|capacity[_ -]?(billing|reserve|v2)'
), classified_capacity_migration_markers as (
  select *,
    marker_name in ('ai_capacity_billing_v2','ai_capacity_billing_v2_activation_gates',
      'ai_capacity_reserve_settle') marker_name_is_known,
    marker_version in ('ai_capacity_billing_v2','ai_capacity_billing_v2_activation_gates',
      'ai_capacity_reserve_settle') marker_version_is_known,
    (marker_name_is_capacity and marker_name not in ('ai_capacity_billing_v2',
      'ai_capacity_billing_v2_activation_gates','ai_capacity_reserve_settle')) marker_name_is_unknown,
    (marker_version_is_capacity and marker_version not in ('ai_capacity_billing_v2',
      'ai_capacity_billing_v2_activation_gates','ai_capacity_reserve_settle')) marker_version_is_unknown
  from capacity_migration_markers
)
select jsonb_build_object(
  'version',1,
  'read_only',current_setting('transaction_read_only')='on',
  'rls_filtering_disabled',current_setting('row_security')='off',
  'postgres_major',current_setting('server_version_num')::integer/10000,
  'schema_md5',(select md5(profile::text) from schema_profile),
  'schema_matches_after_budget_default_normalization',(select md5(profile::text) from normalized_schema_profile)
    ='e3b71e6b343c161ebabf1fc34739a837',
  'table_structure_safety_matches',(select count(*)=5
      and bool_and(c.relkind='r')
      and bool_and((select count(*) from pg_attribute a where a.attrelid=c.oid
        and a.attnum>0 and not a.attisdropped)=case c.relname
          when 'ai_capacity_admin_policy' then 19 when 'ai_capacity_grants' then 13
          when 'ai_capacity_reservations' then 11 when 'ai_capacity_reservation_allocations' then 4
          when 'ai_capacity_ledger_events' then 19 end)
      and bool_and(not exists(select 1 from pg_constraint k where k.conrelid=c.oid and not k.convalidated))
      and bool_and(not exists(select 1 from pg_index i where i.indrelid=c.oid and (not i.indisvalid or not i.indisready)))
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
      and c.relname=any(array['ai_capacity_admin_policy','ai_capacity_grants','ai_capacity_reservations',
        'ai_capacity_reservation_allocations','ai_capacity_ledger_events'])),
  'function_security_matches',(select count(*)=4
      and count(*) filter(where p.proname='ai_capacity_ledger_immutable')=1
      and count(*) filter(where p.proname='ai_capacity_admin_activation_guard')=1
      and count(*) filter(where p.proname='admin_get_ai_capacity_policy')=1
      and count(*) filter(where p.proname='admin_update_ai_capacity_policy')=1
      and bool_and(not has_function_privilege('anon',p.oid,'EXECUTE')
        and not has_function_privilege('authenticated',p.oid,'EXECUTE')
        and has_function_privilege('service_role',p.oid,'EXECUTE')=(p.proname like 'admin\_%' escape '\'))
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and (p.proname like 'ai\_capacity\_%' escape '\'
      or p.proname in ('admin_get_ai_capacity_policy','admin_update_ai_capacity_policy'))),
  'rls_acl_security_matches',(select count(*)=5 and bool_and(c.relrowsecurity and not c.relforcerowsecurity)
      and bool_and(not exists(select 1 from pg_policy p where p.polrelid=c.oid))
      and bool_and(not has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        and not has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        and has_table_privilege('service_role',c.oid,'SELECT')
        and not has_table_privilege('service_role',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
      and bool_and(not exists(select 1 from pg_attribute a where a.attrelid=c.oid and a.attnum>0
        and not a.attisdropped and a.attacl is not null))
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
      and c.relname=any(array['ai_capacity_admin_policy','ai_capacity_grants','ai_capacity_reservations',
        'ai_capacity_reservation_allocations','ai_capacity_ledger_events'])),
  'other_security_matches',(select count(*)=5 and count(distinct c.relowner)=1
      and bool_and(pg_get_userbyid(c.relowner) not in ('anon','authenticated','service_role'))
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
      and c.relname=any(array['ai_capacity_admin_policy','ai_capacity_grants','ai_capacity_reservations',
        'ai_capacity_reservation_allocations','ai_capacity_ledger_events']))
    and (select count(*)=2 and count(*) filter(where t.tgname='ai_capacity_admin_activation_guard'
        and c.relname='ai_capacity_admin_policy' and t.tgenabled='O')=1
      and count(*) filter(where t.tgname='ai_capacity_ledger_immutable_update_delete'
        and c.relname='ai_capacity_ledger_events' and t.tgenabled='O')=1
      from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and not t.tgisinternal and c.relname=any(array[
        'ai_capacity_admin_policy','ai_capacity_grants','ai_capacity_reservations',
        'ai_capacity_reservation_allocations','ai_capacity_ledger_events']))
    and not has_schema_privilege('anon','public','CREATE')
    and not has_schema_privilege('authenticated','public','CREATE')
    and not exists(select 1 from pg_roles where rolname in ('anon','authenticated')
      and (rolsuper or rolbypassrls)),
  'policy_package_99_budget_default_matches',exists(
    select 1 from pg_attribute a join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where a.attrelid='public.ai_capacity_admin_policy'::regclass and a.attnum>0 and not a.attisdropped
      and a.attname='package_99_budget_eur_microcents'
      and pg_get_expr(d.adbin,d.adrelid)='1500000000'),
  'policy_package_199_budget_default_matches',exists(
    select 1 from pg_attribute a join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where a.attrelid='public.ai_capacity_admin_policy'::regclass and a.attnum>0 and not a.attisdropped
      and a.attname='package_199_budget_eur_microcents'
      and pg_get_expr(d.adbin,d.adrelid)='''3000000000''::bigint'),
  'policy_package_312_budget_default_matches',exists(
    select 1 from pg_attribute a join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where a.attrelid='public.ai_capacity_admin_policy'::regclass and a.attnum>0 and not a.attisdropped
      and a.attname='package_312_budget_eur_microcents'
      and pg_get_expr(d.adbin,d.adrelid)='''5000000000''::bigint'),
  'foundation_table_count',(select count(*) from table_profiles),
  'unexpected_capacity_relations_absent',not exists(select 1 from pg_class c
    join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
    and c.relkind in ('r','p','v','m','f','S')
    and c.relname like 'ai\_capacity\_%' escape '\'
    and c.relname<>all(array['ai_capacity_admin_policy','ai_capacity_grants','ai_capacity_reservations',
      'ai_capacity_reservation_allocations','ai_capacity_ledger_events'])),
  'function_count',(select count(*) from function_profiles),
  'workspace_parent_valid',exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    join pg_attribute a on a.attrelid=c.oid and a.attname='id' and a.attnum>0 and not a.attisdropped
    where n.nspname='public' and c.relname='workspaces' and c.relkind='r' and c.relrowsecurity
      and a.atttypid='uuid'::regtype and a.attnotnull
      and exists(select 1 from pg_index i where i.indrelid=c.oid and i.indisprimary
        and i.indisvalid and i.indnkeyatts=1 and a.attnum=any(i.indkey))),
  'browser_schema_create_denied',not has_schema_privilege('anon','public','CREATE')
    and not has_schema_privilege('authenticated','public','CREATE'),
  'browser_role_boundary',not exists(select 1 from pg_roles where rolname in ('anon','authenticated')
    and (rolsuper or rolbypassrls))
    and not pg_has_role('anon','service_role','MEMBER')
    and not pg_has_role('authenticated','service_role','MEMBER'),
  'projection_absent',to_regclass('public.ai_capacity_workspace_entitlements') is null,
  'lifecycle_columns_absent',not exists(select 1 from pg_attribute
    where attrelid='public.ai_capacity_reservations'::regclass and attnum>0 and not attisdropped
    and attname=any(array['policy_revision','entitlement_revision','provider','model',
      'pricing_version','fx_version','settlement_evidence'])),
  'lifecycle_functions_absent',not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=any(array['ai_capacity_grant_credit','ai_capacity_reserve',
      'ai_capacity_settle','ai_capacity_release','ai_capacity_mark_indeterminate',
      'ai_capacity_reverse_purchase','ai_capacity_balance_snapshot'])),
  'lifecycle_index_absent',to_regclass('public.ai_capacity_grants_workspace_period_unique') is null,
  'grants_empty',not exists(select 1 from public.ai_capacity_grants),
  'reservations_empty',not exists(select 1 from public.ai_capacity_reservations),
  'allocations_empty',not exists(select 1 from public.ai_capacity_reservation_allocations),
  'ledger_empty',not exists(select 1 from public.ai_capacity_ledger_events),
  'capacity_generic_migration_marker_absent',not exists(
    select 1 from supabase_migrations.schema_migrations
    where coalesce(name,'') ~* 'ai[_ -]?capacity|capacity[_ -]?(billing|reserve|v2)'
       or version ~* 'ai[_ -]?capacity|capacity[_ -]?(billing|reserve|v2)'),
  'capacity_foundation_migration_marker_absent',not exists(
    select 1 from capacity_migration_markers
    where marker_name='ai_capacity_billing_v2' or marker_version='ai_capacity_billing_v2'),
  'capacity_activation_gate_migration_marker_absent',not exists(
    select 1 from capacity_migration_markers
    where marker_name='ai_capacity_billing_v2_activation_gates'
       or marker_version='ai_capacity_billing_v2_activation_gates'),
  'capacity_lifecycle_migration_marker_absent',not exists(
    select 1 from capacity_migration_markers
    where marker_name='ai_capacity_reserve_settle' or marker_version='ai_capacity_reserve_settle'),
  'capacity_unknown_migration_marker_absent',not exists(
    select 1 from classified_capacity_migration_markers
    where marker_name_is_unknown or marker_version_is_unknown),
  'capacity_migration_marker_count',(select count(*) from classified_capacity_migration_markers),
  'capacity_known_migration_marker_count',(select count(*) from classified_capacity_migration_markers
    where marker_name_is_known or marker_version_is_known),
  'capacity_unknown_migration_marker_count',(select count(*) from classified_capacity_migration_markers
    where marker_name_is_unknown or marker_version_is_unknown),
  'capacity_unknown_marker_name_only_count',(select count(*) from classified_capacity_migration_markers
    where marker_name_is_unknown and not marker_version_is_unknown),
  'capacity_unknown_marker_version_only_count',(select count(*) from classified_capacity_migration_markers
    where marker_version_is_unknown and not marker_name_is_unknown),
  'capacity_unknown_marker_name_and_version_count',(select count(*) from classified_capacity_migration_markers
    where marker_name_is_unknown and marker_version_is_unknown),
  'capacity_unknown_marker_with_statements_count',(select count(*) from classified_capacity_migration_markers
    where (marker_name_is_unknown or marker_version_is_unknown) and marker_has_statements),
  'policy_row_count',(select count(*) from public.ai_capacity_admin_policy),
  'policy',(select jsonb_build_object('singleton_id',singleton_id,'revision',revision,
    'package_99_budget_eur_microcents',package_99_budget_eur_microcents,
    'package_199_budget_eur_microcents',package_199_budget_eur_microcents,
    'package_312_budget_eur_microcents',package_312_budget_eur_microcents,
    'global_capacity_enabled',global_capacity_enabled,'emergency_spend_freeze',emergency_spend_freeze,
    'top_up_sales_enabled',top_up_sales_enabled,'package_99_sales_enabled',package_99_sales_enabled,
    'package_199_sales_enabled',package_199_sales_enabled,'package_312_sales_enabled',package_312_sales_enabled,
    'fast_enabled',fast_enabled,'balanced_enabled',balanced_enabled,'premium_enabled',premium_enabled,
    'runtime_activation_ready',runtime_activation_ready,
    'package_sales_activation_ready',package_sales_activation_ready,'top_up_activation_ready',top_up_activation_ready)
    from public.ai_capacity_admin_policy where singleton_id=1)
);
rollback;
