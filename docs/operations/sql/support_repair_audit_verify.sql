-- Read-only classifier for the support repair audit schema.
-- Run only against the explicitly authorized isolated Staging target.
\set ON_ERROR_STOP on
begin transaction read only;

with
table_state as (
  select to_regclass('public.support_repair_audit') as relation
),
expected_columns(name, data_type, is_nullable) as (
  values
    ('id', 'uuid', 'NO'),
    ('workspace_id', 'uuid', 'NO'),
    ('actor_user_id', 'uuid', 'NO'),
    ('connection_id', 'uuid', 'NO'),
    ('platform', 'text', 'NO'),
    ('action', 'text', 'NO'),
    ('consent_required', 'boolean', 'NO'),
    ('consent_given', 'boolean', 'NO'),
    ('status', 'text', 'NO'),
    ('request_id', 'uuid', 'NO'),
    ('created_at', 'timestamp with time zone', 'NO'),
    ('completed_at', 'timestamp with time zone', 'YES')
),
column_state as (
  select
    count(*) filter (
      where c.column_name = e.name
        and c.data_type = e.data_type
        and c.is_nullable = e.is_nullable
    ) = (select count(*) from expected_columns) as valid,
    array_agg(e.name order by e.name) filter (
      where c.column_name is null
        or c.data_type <> e.data_type
        or c.is_nullable <> e.is_nullable
    ) as mismatches
  from expected_columns e
  left join information_schema.columns c
    on c.table_schema = 'public'
   and c.table_name = 'support_repair_audit'
   and c.column_name = e.name
),
constraint_state as (
  select
    count(*) filter (where conname = 'support_repair_audit_pkey' and contype = 'p') = 1
      and count(*) filter (
        where conname = 'support_repair_audit_request_id_key'
          and contype = 'u'
      ) = 1
      and count(*) filter (
        where conname = 'support_repair_audit_consent'
          and contype = 'c'
      ) = 1
      and count(*) filter (
        where conname = 'support_repair_audit_completion'
          and contype = 'c'
      ) = 1 as valid
  from pg_constraint
  where conrelid = (select relation from table_state)
),
index_state as (
  select count(*) filter (
      where indexname = 'support_repair_audit_workspace_created'
    ) = 1
    and count(*) filter (
      where indexname = 'support_repair_audit_connection_created'
    ) = 1 as valid
  from pg_indexes
  where schemaname = 'public'
    and tablename = 'support_repair_audit'
),
security_state as (
  select
    coalesce(c.relrowsecurity, false) as rls_enabled,
    exists (select 1 from pg_roles where rolname = 'anon') as anon_exists,
    exists (select 1 from pg_roles where rolname = 'authenticated') as authenticated_exists,
    coalesce(not has_table_privilege(
      (select oid from pg_roles where rolname = 'anon'),
      (select relation from table_state),
      'SELECT,INSERT,UPDATE,DELETE'
    ), false) as anon_denied,
    coalesce(not has_table_privilege(
      (select oid from pg_roles where rolname = 'authenticated'),
      (select relation from table_state),
      'SELECT,INSERT,UPDATE,DELETE'
    ), false) as authenticated_denied
  from pg_class c
  where c.oid = (select relation from table_state)
),
classification as (
  select case
    when t.relation is null then 'ABSENT'
    when coalesce(cols.valid, false)
      and coalesce(cons.valid, false)
      and coalesce(idx.valid, false)
      and coalesce(sec.rls_enabled, false)
      and coalesce(sec.anon_exists, false)
      and coalesce(sec.authenticated_exists, false)
      and coalesce(sec.anon_denied, false)
      and coalesce(sec.authenticated_denied, false)
      then 'INSTALLED'
    else 'DRIFT'
  end as schema_state,
  json_build_object(
    'relation', t.relation,
    'columns_valid', coalesce(cols.valid, false),
    'column_mismatches', coalesce(cols.mismatches, array[]::text[]),
    'constraints_valid', coalesce(cons.valid, false),
    'indexes_valid', coalesce(idx.valid, false),
    'rls_enabled', coalesce(sec.rls_enabled, false),
    'anon_denied', coalesce(sec.anon_denied, false),
    'authenticated_denied', coalesce(sec.authenticated_denied, false)
  ) as details
  from table_state t
  left join column_state cols on true
  left join constraint_state cons on true
  left join index_state idx on true
  left join security_state sec on true
)
select
  'SUPPORT_REPAIR_AUDIT_SCHEMA_STATE=' || schema_state
  || ' SUPPORT_REPAIR_AUDIT_SCHEMA_DETAILS=' || details::text
from classification;

rollback;

