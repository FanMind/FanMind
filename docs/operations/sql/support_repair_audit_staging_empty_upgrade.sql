-- Staging only. Preserve every row, policy and grant. Empty legacy table only.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT pg_advisory_xact_lock(1350,20261105);
LOCK TABLE public.support_repair_audit IN ACCESS EXCLUSIVE MODE;
DO $guard$ BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' THEN RAISE EXCEPTION 'audit_identity_rejected'; END IF;
 IF (select md5(jsonb_build_object('relation',(select jsonb_build_array(pg_get_userbyid(relowner),relrowsecurity,relforcerowsecurity,relacl::text) from pg_class where oid='public.support_repair_audit'::regclass),'columns',(select jsonb_agg(jsonb_build_array(attname::text,format_type(atttypid,atttypmod),attnotnull,attidentity,attgenerated,pg_get_expr(d.adbin,d.adrelid),attacl::text) order by attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid='public.support_repair_audit'::regclass and attnum>0 and not attisdropped),'constraints',(select jsonb_agg(jsonb_build_array(conname,pg_get_constraintdef(oid,true),convalidated) order by conname) from pg_constraint where conrelid='public.support_repair_audit'::regclass),'indexes',(select jsonb_agg(indexdef order by indexname) from pg_indexes where schemaname='public' and tablename='support_repair_audit'),'policies',(select jsonb_agg(to_jsonb(p) order by policyname) from pg_policies p where schemaname='public' and tablename='support_repair_audit'),'triggers',(select jsonb_agg(pg_get_triggerdef(oid,true) order by tgname) from pg_trigger where tgrelid='public.support_repair_audit'::regclass and not tgisinternal))::text)) IS DISTINCT FROM '5be8a062a7627b88d5f710b9928fd669' THEN RAISE EXCEPTION 'audit_legacy_catalogue_drift'; END IF;
 IF EXISTS(SELECT 1 FROM public.support_repair_audit) THEN RAISE EXCEPTION 'audit_nonempty_requires_review'; END IF;
 IF (SELECT array_agg(attname::text ORDER BY attnum) FROM pg_attribute WHERE attrelid='public.support_repair_audit'::regclass AND attnum>0 AND NOT attisdropped)
 <>ARRAY['id','workspace_id','actor_user_id','platform','action','consent_required','consent_given','status','request_id','created_at','completed_at'] THEN RAISE EXCEPTION 'audit_legacy_shape_drift'; END IF;
 IF (SELECT relacl::text FROM pg_class WHERE oid='public.support_repair_audit'::regclass)<>'{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'
 OR NOT (SELECT relrowsecurity AND NOT relforcerowsecurity AND relkind='r' AND relpersistence='p' AND reloptions IS NULL AND pg_get_userbyid(relowner)='postgres' FROM pg_class WHERE oid='public.support_repair_audit'::regclass)
 OR EXISTS(SELECT 1 FROM pg_index WHERE indrelid='public.support_repair_audit'::regclass AND (NOT indisvalid OR NOT indisready))
 OR EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='support_repair_audit')
 OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.support_repair_audit'::regclass AND NOT tgisinternal)
 OR (SELECT count(*) FROM pg_constraint WHERE conrelid='public.support_repair_audit'::regclass)<>5
 OR (SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND tablename='support_repair_audit')<>3
 THEN RAISE EXCEPTION 'audit_legacy_security_drift'; END IF;
 IF (SELECT pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid='public.support_repair_audit'::regclass AND conname='support_repair_audit_status_check')
 IS DISTINCT FROM 'CHECK (status = ANY (ARRAY[''requested''::text, ''denied''::text, ''started''::text, ''succeeded''::text, ''failed''::text, ''manual_action_required''::text]))'
 THEN RAISE EXCEPTION 'audit_legacy_status_drift'; END IF;
END $guard$;
ALTER TABLE public.support_repair_audit ADD COLUMN connection_id uuid NOT NULL;
ALTER TABLE public.support_repair_audit DROP CONSTRAINT support_repair_audit_status_check;
ALTER TABLE public.support_repair_audit ADD CONSTRAINT support_repair_audit_status_check CHECK(status IN('requested','denied','started','succeeded','failed','partial','manual_action_required'));
ALTER TABLE public.support_repair_audit ADD CONSTRAINT support_repair_audit_completion CHECK(
 (status IN('requested','started') AND completed_at IS NULL) OR
 (status IN('denied','succeeded','failed','partial','manual_action_required') AND completed_at IS NOT NULL));
CREATE INDEX support_repair_audit_connection_created ON public.support_repair_audit(connection_id,created_at DESC);
DO $post$ BEGIN
 IF (with
table_state as (
  select to_regclass('public.support_repair_audit') as relation
),
expected_columns(name, data_type, is_nullable, column_default) as (
  values
    ('id', 'uuid', 'NO', 'gen_random_uuid()'),
    ('workspace_id', 'uuid', 'NO', null),
    ('actor_user_id', 'uuid', 'NO', null),
    ('connection_id', 'uuid', 'NO', null),
    ('platform', 'text', 'NO', null),
    ('action', 'text', 'NO', null),
    ('consent_required', 'boolean', 'NO', null),
    ('consent_given', 'boolean', 'NO', 'false'),
    ('status', 'text', 'NO', null),
    ('request_id', 'uuid', 'NO', null),
    ('created_at', 'timestamp with time zone', 'NO', 'now()'),
    ('completed_at', 'timestamp with time zone', 'YES', null)
),
column_state as (
  select
    count(*) filter (
      where c.column_name = e.name
        and c.data_type = e.data_type
        and c.is_nullable = e.is_nullable
        and c.column_default is not distinct from e.column_default
    ) = (select count(*) from expected_columns)
      and (
        select count(*)
        from information_schema.columns actual
        where actual.table_schema = 'public'
          and actual.table_name = 'support_repair_audit'
      ) = (select count(*) from expected_columns) as valid,
    array_agg(e.name order by e.name) filter (
      where c.column_name is null
        or c.data_type <> e.data_type
        or c.is_nullable <> e.is_nullable
        or c.column_default is distinct from e.column_default
    ) as mismatches
  from expected_columns e
  left join information_schema.columns c
    on c.table_schema = 'public'
   and c.table_name = 'support_repair_audit'
   and c.column_name = e.name
),
expected_constraints(name, constraint_type, definition) as (
  values
    ('support_repair_audit_pkey', 'p', 'PRIMARY KEY (id)'),
    ('support_repair_audit_request_id_key', 'u', 'UNIQUE (request_id)'),
    (
      'support_repair_audit_platform_check',
      'c',
      'CHECK ((platform = ANY (ARRAY[''instagram''::text, ''facebook''::text, ''whatsapp''::text])))'
    ),
    (
      'support_repair_audit_status_check',
      'c',
      'CHECK ((status = ANY (ARRAY[''requested''::text, ''denied''::text, ''started''::text, ''succeeded''::text, ''failed''::text, ''partial''::text, ''manual_action_required''::text])))'
    ),
    (
      'support_repair_audit_consent',
      'c',
      'CHECK (((NOT consent_required) OR consent_given OR (status = ANY (ARRAY[''requested''::text, ''denied''::text]))))'
    ),
    (
      'support_repair_audit_completion',
      'c',
      'CHECK ((((status = ANY (ARRAY[''requested''::text, ''started''::text])) AND (completed_at IS NULL)) OR ((status = ANY (ARRAY[''denied''::text, ''succeeded''::text, ''failed''::text, ''partial''::text, ''manual_action_required''::text])) AND (completed_at IS NOT NULL))))'
    )
),
constraint_state as (
  select
    count(*) = (select count(*) from expected_constraints)
      and bool_and(c.convalidated)
      and count(*) filter (
        where e.name is not null
          and c.contype::text = e.constraint_type
          and pg_get_constraintdef(c.oid) = e.definition
      ) = (select count(*) from expected_constraints) as valid
  from pg_constraint c
  left join expected_constraints e on e.name = c.conname
  where c.conrelid = (select relation from table_state)
),
expected_indexes(name, definition) as (
  values
    (
      'support_repair_audit_pkey',
      'CREATE UNIQUE INDEX support_repair_audit_pkey ON public.support_repair_audit USING btree (id)'
    ),
    (
      'support_repair_audit_request_id_key',
      'CREATE UNIQUE INDEX support_repair_audit_request_id_key ON public.support_repair_audit USING btree (request_id)'
    ),
    (
      'support_repair_audit_workspace_created',
      'CREATE INDEX support_repair_audit_workspace_created ON public.support_repair_audit USING btree (workspace_id, created_at DESC)'
    ),
    (
      'support_repair_audit_connection_created',
      'CREATE INDEX support_repair_audit_connection_created ON public.support_repair_audit USING btree (connection_id, created_at DESC)'
    )
),
index_state as (
  select
    count(*) = (select count(*) from expected_indexes)
      and count(*) filter (
        where e.name is not null and i.indexdef = e.definition
      ) = (select count(*) from expected_indexes) as valid
  from pg_indexes i
  left join expected_indexes e on e.name = i.indexname
  where i.schemaname = 'public'
    and i.tablename = 'support_repair_audit'
),
security_state as (
  select
    coalesce(c.relrowsecurity, false) as rls_enabled,
    not coalesce(c.relforcerowsecurity, false) as force_rls_unchanged,
    not exists (
      select 1 from pg_policy p
      where p.polrelid = (select relation from table_state)
    ) as no_policies,
    exists (select 1 from pg_roles where rolname = 'anon') as anon_exists,
    exists (select 1 from pg_roles where rolname = 'authenticated') as authenticated_exists,
    coalesce(not has_table_privilege(
      (select oid from pg_roles where rolname = 'anon'),
      (select relation from table_state),
      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
    ), false) as anon_denied,
    coalesce(not has_table_privilege(
      (select oid from pg_roles where rolname = 'authenticated'),
      (select relation from table_state),
      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
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
      and coalesce(sec.force_rls_unchanged, false)
      and coalesce(sec.no_policies, false)
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
    'force_rls_unchanged', coalesce(sec.force_rls_unchanged, false),
    'no_policies', coalesce(sec.no_policies, false),
    'anon_denied', coalesce(sec.anon_denied, false),
    'authenticated_denied', coalesce(sec.authenticated_denied, false)
  ) as details
  from table_state t
  left join column_state cols on true
  left join constraint_state cons on true
  left join index_state idx on true
  left join security_state sec on true
)
select schema_state from classification) IS DISTINCT FROM 'INSTALLED' THEN RAISE EXCEPTION 'audit_full_postflight_failed'; END IF;

 IF EXISTS(SELECT 1 FROM public.support_repair_audit) OR (SELECT count(*) FROM pg_attribute WHERE attrelid='public.support_repair_audit'::regclass AND attnum>0 AND NOT attisdropped)<>12
 OR NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.support_repair_audit'::regclass AND attname='connection_id' AND atttypid='uuid'::regtype AND attnotnull)
 OR (SELECT relacl::text FROM pg_class WHERE oid='public.support_repair_audit'::regclass)<>'{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'
 OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.support_repair_audit'::regclass)
 OR (SELECT count(*) FROM pg_constraint WHERE conrelid='public.support_repair_audit'::regclass)<>6
 OR (SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND tablename='support_repair_audit')<>4
 THEN RAISE EXCEPTION 'audit_postflight_failed'; END IF;
END $post$;
COMMIT;
