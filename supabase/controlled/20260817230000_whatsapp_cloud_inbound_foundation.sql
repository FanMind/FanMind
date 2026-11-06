-- WhatsApp Cloud API inbound-only tenant binding and durable idempotency.
-- Controlled migration: never applied by the normal application deploy path.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '90s';
set local search_path = pg_catalog, public, pg_temp;

do $preflight$
declare
  processing_contract_oid oid := to_regprocedure(
    'public.workspace_processing_allowed_contract(text,text,text,boolean,text,text,jsonb,timestamp with time zone)'
  );
  existing_member_function_count integer;
  existing_member_policy_count integer;
  existing_object_count integer;
  existing_column_count integer;
  existing_constraint_count integer;
  existing_identity_policy_count integer;
  existing_function_name_count integer;
begin
  if current_user <> 'postgres'
     or to_regrole('anon') is null
     or to_regrole('authenticated') is null
     or to_regrole('service_role') is null then
    raise exception 'whatsapp_cloud_database_role_invalid';
  end if;
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise exception 'whatsapp_cloud_migration_ledger_missing';
  end if;
  if exists (
    select 1
      from supabase_migrations.schema_migrations
     where version = '20260817230000'
        or name in (
          '20260817230000_whatsapp_cloud_inbound_foundation',
          'whatsapp_cloud_inbound_foundation'
        )
  ) then
    raise exception 'whatsapp_cloud_in_generic_ledger';
  end if;
  if processing_contract_oid is null
     or not exists (
       select 1
         from pg_proc as function_definition
         join pg_language as function_language
           on function_language.oid = function_definition.prolang
        where function_definition.oid = processing_contract_oid
          and function_definition.proowner = to_regrole('postgres')
          and function_definition.prokind = 'f'
          and function_language.lanname = 'plpgsql'
          and function_definition.provolatile = 's'
          and function_definition.proparallel = 'u'
          and not function_definition.prosecdef
          and not function_definition.proretset
          and not function_definition.proisstrict
          and not function_definition.proleakproof
          and function_definition.procost = 100
          and function_definition.prorows = 0
          and function_definition.prosupport = 0
          and function_definition.provariadic = 0
          and function_definition.protrftypes is null
          and function_definition.probin is null
          and function_definition.prosqlbody is null
          and function_definition.prorettype = 'boolean'::regtype
          and function_definition.proargtypes =
              '25 25 25 16 25 25 3802 1184'::oidvector
          and function_definition.proallargtypes is null
          and function_definition.proargmodes is null
          and function_definition.proargnames = array[
            'p_workspace_access_mode',
            'p_subscription_effective_end_at',
            'p_billing_status',
            'p_billing_manual_override',
            'p_billing_grace_until',
            'p_billing_suspended_at',
            'p_test_access_flags',
            'p_evaluated_at'
          ]::text[]
          and function_definition.pronargs = 8
          and function_definition.pronargdefaults = 0
          and function_definition.proargdefaults is null
          and function_definition.proconfig is not distinct from
              array['search_path=pg_catalog, public, pg_temp']::text[]
          and pg_catalog.encode(
            pg_catalog.sha256(
              pg_catalog.convert_to(function_definition.prosrc, 'UTF8')
            ),
            'hex'
          ) = 'e9e57a8bef3d480de6c932eadb11a7c8123219db0ffa52969641b216c5cfd42d'
     )
     or (
       select count(*)
         from pg_proc as member_overload
         join pg_namespace as member_namespace
           on member_namespace.oid = member_overload.pronamespace
        where member_namespace.nspname = 'public'
          and member_overload.proname =
              'workspace_processing_allowed_contract'
     ) <> 1
     or has_function_privilege(
       'anon', processing_contract_oid, 'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated', processing_contract_oid, 'EXECUTE'
     )
     or not coalesce((
       select count(*) = 2
          and bool_and(function_acl.privilege_type = 'EXECUTE')
          and bool_and(not function_acl.is_grantable)
          and bool_and(function_acl.grantor = to_regrole('postgres'))
          and count(*) filter (
            where function_acl.grantee = to_regrole('postgres')
          ) = 1
          and count(*) filter (
            where function_acl.grantee = to_regrole('authenticated')
          ) = 1
         from aclexplode(
           coalesce(
             (select member_function.proacl
                from pg_proc as member_function
               where member_function.oid = processing_contract_oid),
             acldefault('f', to_regrole('postgres'))
           )
         ) as function_acl
     ), false
     ) then
    raise exception 'whatsapp_cloud_member_control_missing';
  end if;
  if not public.workspace_processing_allowed_contract(
       'active',
       null,
       'demo_free',
       false,
       null,
       null,
       '{"fixed_demo_seed_version":"2026-07-26-v1"}'::jsonb,
       timestamptz '2026-08-17 12:00:00+00'
     )
     or public.workspace_processing_allowed_contract(
       'active',
       null,
       'cancelled',
       true,
       null,
       null,
       '{}',
       timestamptz '2026-08-17 12:00:00+00'
     ) then
    raise exception 'whatsapp_cloud_member_control_behavior_invalid';
  end if;
  select count(*)
    into existing_member_function_count
    from unnest(array[
      processing_contract_oid,
      to_regprocedure(
        'public.workspace_owner_active_mutation_allowed(uuid)'
      ),
      to_regprocedure(
        'public.get_current_workspace_member_safe_dashboard()'
      )
    ]::oid[]) as member_function(function_oid)
   where member_function.function_oid is not null;
  select count(*)
    into existing_member_policy_count
    from pg_policies as policy
   where policy.schemaname = 'public'
     and (
       (
         policy.tablename = 'workspaces'
         and policy.policyname = 'workspaces_select_requires_owner'
       )
       or (
         policy.tablename = 'workspace_analysis_settings'
         and policy.policyname =
             'workspace_analysis_settings_select_requires_workspace_owner'
       )
       or (
         policy.tablename = 'social_connections'
         and policy.policyname in (
           'social_connections_select_requires_workspace_owner',
           'social_connections_insert_requires_workspace_owner',
           'social_connections_update_requires_workspace_owner',
           'social_connections_delete_requires_workspace_owner'
         )
       )
       or (
         policy.tablename = any(array[
           'contacts',
           'memories',
           'followups',
           'conversations',
           'conversation_messages',
           'conversation_summaries',
           'contact_reply_targets',
           'ai_usage_events',
           'content_sources',
           'fan_analysis_reports',
           'contact_ai_profiles',
           'workspace_voice_profiles'
         ]::text[])
         and policy.policyname in (
           policy.tablename || '_insert_requires_workspace_owner',
           policy.tablename || '_update_requires_workspace_owner',
           policy.tablename || '_delete_requires_workspace_owner'
         )
       )
     );
  if existing_member_function_count <> 3
     or existing_member_policy_count <> 42 then
    raise exception 'whatsapp_cloud_member_control_incomplete';
  end if;
  if to_regclass('public.social_connections') is null
     or to_regclass('public.conversation_messages') is null then
    raise exception 'whatsapp_cloud_dependency_missing';
  end if;
  if not exists (
    select 1
      from pg_index as definition
      join pg_class as relation on relation.oid = definition.indexrelid
     where definition.indrelid = 'public.social_connections'::regclass
       and relation.relname = 'social_connections_id_workspace_unique_idx'
       and definition.indisunique
       and definition.indisvalid
       and definition.indisready
  ) then
    raise exception 'whatsapp_cloud_workspace_key_missing';
  end if;
  if exists (
    select 1
      from public.social_connections
     where platform = 'whatsapp'
       and provider = 'meta_whatsapp_cloud'
       and status = 'connected'
       and page_id is not null
     group by page_id
    having count(*) > 1
  ) then
    raise exception 'duplicate_active_whatsapp_phone_binding';
  end if;
  if exists (
    select 1 from public.conversation_messages
     where source_platform is not distinct from 'whatsapp'
  ) then
    raise exception 'whatsapp_cloud_existing_message_requires_identity_review';
  end if;

  select count(*)
    into existing_object_count
    from (
      select to_regclass(
        'public.social_connections_active_whatsapp_phone_unique_idx'
      )::oid as object_oid
      union all
      select to_regclass(
        'public.conversation_messages_id_workspace_unique_idx'
      )::oid
      union all
      select to_regclass(
        'public.conversation_messages_whatsapp_identity_unique_idx'
      )::oid
      union all
      select to_regclass(
        'public.whatsapp_cloud_webhook_receipts_retry_idx'
      )::oid
      union all
      select to_regclass(
        'public.whatsapp_cloud_webhook_receipts_workspace_idx'
      )::oid
      union all
      select to_regclass(
        'public.whatsapp_cloud_webhook_receipts_message_workspace_idx'
      )::oid
      union all
      select to_regclass('public.whatsapp_cloud_webhook_receipts')::oid
      union all
      select to_regprocedure(
        'public.whatsapp_cloud_inbound_schema_state()'
      )::oid
      union all
      select to_regprocedure(
        'public.claim_whatsapp_cloud_inbound_message(uuid,uuid,text,text,text,integer)'
      )::oid
      union all
      select to_regprocedure(
        'public.store_whatsapp_cloud_inbound_message(uuid,uuid,uuid,uuid,text,text,text,text,text,text,timestamptz,text)'
      )::oid
      union all
      select to_regprocedure(
        'public.disconnect_whatsapp_cloud_inbound_connection(uuid,uuid)'
      )::oid
      union all
      select to_regprocedure(
        'public.protect_whatsapp_cloud_message_identity()'
      )::oid
      union all
      select trigger_definition.oid
        from pg_trigger as trigger_definition
       where trigger_definition.tgrelid =
             'public.conversation_messages'::regclass
         and trigger_definition.tgname =
             'conversation_messages_whatsapp_identity_immutable'
         and not trigger_definition.tgisinternal
    ) as controlled_objects
   where controlled_objects.object_oid is not null;
  select count(*) into existing_column_count
    from pg_attribute as attribute
   where attribute.attrelid = 'public.conversation_messages'::regclass
     and attribute.attname like 'whatsapp\_%' escape '\'
     and attribute.attnum > 0
     and not attribute.attisdropped;
  select count(*) into existing_constraint_count
    from pg_constraint as constraint_definition
   where constraint_definition.conrelid =
         'public.conversation_messages'::regclass
     and constraint_definition.conname in (
       'conversation_messages_whatsapp_identity_check',
       'conversation_messages_whatsapp_connection_workspace_fk'
     );
  select count(*) into existing_identity_policy_count
    from pg_policies as policy
   where policy.schemaname = 'public'
     and policy.tablename = 'conversation_messages'
     and policy.policyname like
         'conversation_messages_whatsapp_identity_%';
  select count(*) into existing_function_name_count
    from pg_proc as function_definition
    join pg_namespace as function_namespace
      on function_namespace.oid = function_definition.pronamespace
   where function_namespace.nspname = 'public'
     and function_definition.proname in (
       'whatsapp_cloud_inbound_schema_state',
       'claim_whatsapp_cloud_inbound_message',
       'store_whatsapp_cloud_inbound_message',
       'disconnect_whatsapp_cloud_inbound_connection',
       'protect_whatsapp_cloud_message_identity'
     );
  if existing_object_count <> 0
     or existing_column_count <> 0
     or existing_constraint_count <> 0
     or existing_identity_policy_count <> 0
     or existing_function_name_count <> 0
     or to_regclass(
       'public.conversation_messages_whatsapp_external_message_unique_idx'
     ) is not null then
    raise exception 'whatsapp_cloud_existing_or_partial_state';
  end if;
end
$preflight$;

create unique index social_connections_active_whatsapp_phone_unique_idx
  on public.social_connections (page_id)
  where platform = 'whatsapp'
    and provider = 'meta_whatsapp_cloud'
    and status = 'connected'
    and page_id is not null;

alter table public.conversation_messages
  add column whatsapp_social_connection_id uuid,
  add column whatsapp_phone_number_id text,
  add column whatsapp_payload_fingerprint text;

create unique index conversation_messages_id_workspace_unique_idx
  on public.conversation_messages (id, workspace_id);

alter table public.conversation_messages
  add constraint conversation_messages_whatsapp_connection_workspace_fk
    foreign key (whatsapp_social_connection_id, workspace_id)
    references public.social_connections (id, workspace_id)
    on delete no action,
  add constraint conversation_messages_whatsapp_identity_check check (
    case
      when whatsapp_social_connection_id is not null
        or whatsapp_phone_number_id is not null
        or whatsapp_payload_fingerprint is not null then
      source_platform is not distinct from 'whatsapp'
      and source_type is not distinct from 'whatsapp_messages'
      and external_message_id is not null
      and whatsapp_social_connection_id is not null
      and whatsapp_phone_number_id is not null
      and whatsapp_phone_number_id ~ '^[1-9][0-9]{5,31}$'
      and external_message_id = btrim(external_message_id)
      and external_message_id !~ '[[:cntrl:]]'
      and external_message_id ~ '^wamid\.[A-Za-z0-9+/_=-]{1,505}$'
      and whatsapp_payload_fingerprint is not null
      and whatsapp_payload_fingerprint ~ '^[0-9a-f]{64}$'
      else true
    end
  );

create unique index conversation_messages_whatsapp_identity_unique_idx
  on public.conversation_messages (
    whatsapp_social_connection_id,
    whatsapp_phone_number_id,
    external_message_id
  )
  where source_platform = 'whatsapp'
    and whatsapp_social_connection_id is not null
    and whatsapp_phone_number_id is not null
    and external_message_id is not null;

create policy conversation_messages_whatsapp_identity_server_insert
  on public.conversation_messages
  as restrictive
  for insert
  to authenticated
  with check (
    whatsapp_social_connection_id is null
    and whatsapp_phone_number_id is null
    and whatsapp_payload_fingerprint is null
  );

create policy conversation_messages_whatsapp_identity_server_update
  on public.conversation_messages
  as restrictive
  for update
  to authenticated
  using (true)
  with check (true);

create function public.protect_whatsapp_cloud_message_identity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
begin
  if auth.role() is distinct from 'service_role'
     and (
       new.whatsapp_social_connection_id is distinct from
         old.whatsapp_social_connection_id
       or new.whatsapp_phone_number_id is distinct from
         old.whatsapp_phone_number_id
       or new.whatsapp_payload_fingerprint is distinct from
         old.whatsapp_payload_fingerprint
     ) then
    raise exception 'whatsapp_cloud_message_identity_immutable';
  end if;
  return new;
end
$function$;

create trigger conversation_messages_whatsapp_identity_immutable
before update on public.conversation_messages
for each row
execute function public.protect_whatsapp_cloud_message_identity();

create table public.whatsapp_cloud_webhook_receipts (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null,
  social_connection_id uuid not null,
  phone_number_id text not null,
  external_message_id text not null,
  payload_fingerprint text not null,
  status text not null default 'processing',
  attempt_count integer not null default 1,
  lease_token uuid,
  lease_until timestamptz,
  conversation_message_id uuid,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_cloud_webhook_receipts_pkey primary key (id),
  constraint whatsapp_cloud_receipt_workspace_fk
    foreign key (workspace_id)
    references public.workspaces (id)
    on delete cascade,
  constraint whatsapp_cloud_receipt_connection_workspace_fk
    foreign key (social_connection_id, workspace_id)
    references public.social_connections (id, workspace_id)
    on delete cascade,
  constraint whatsapp_cloud_receipt_message_workspace_fk
    foreign key (conversation_message_id, workspace_id)
    references public.conversation_messages (id, workspace_id)
    on delete set null (conversation_message_id),
  constraint whatsapp_cloud_receipt_phone_number_id_check check (
    phone_number_id ~ '^[1-9][0-9]{5,31}$'
  ),
  constraint whatsapp_cloud_receipt_external_message_id_check check (
    char_length(external_message_id) between 1 and 512
    and external_message_id = btrim(external_message_id)
    and external_message_id !~ '[[:cntrl:]]'
    and external_message_id ~ '^wamid\.[A-Za-z0-9+/_=-]{1,505}$'
  ),
  constraint whatsapp_cloud_receipt_payload_fingerprint_check check (
    payload_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  constraint whatsapp_cloud_receipt_status_check check (
    status in ('processing', 'stored', 'retryable_error', 'cancelled')
  ),
  constraint whatsapp_cloud_receipt_attempt_count_check check (
    attempt_count between 1 and 5
  ),
  constraint whatsapp_cloud_receipt_last_error_code_check check (
    last_error_code is null or last_error_code in (
      'connection_lookup_failed',
      'message_persist_failed',
      'processing_blocked',
      'idempotency_conflict'
    )
  ),
  constraint whatsapp_cloud_receipt_state_check check (
    (status = 'processing' and lease_token is not null and lease_until is not null and conversation_message_id is null and last_error_code is null)
    or
    (status = 'stored' and lease_token is null and lease_until is null and last_error_code is null)
    or
    (status = 'retryable_error' and lease_token is null and lease_until is null and conversation_message_id is null and last_error_code is not null)
    or
    (status = 'cancelled' and lease_token is null and lease_until is null and conversation_message_id is null and last_error_code is null)
  ),
  constraint whatsapp_cloud_receipt_identity_unique unique (
    social_connection_id,
    phone_number_id,
    external_message_id
  )
);

create index whatsapp_cloud_webhook_receipts_retry_idx
  on public.whatsapp_cloud_webhook_receipts (updated_at, id)
  where status in ('processing', 'retryable_error');

create index whatsapp_cloud_webhook_receipts_workspace_idx
  on public.whatsapp_cloud_webhook_receipts (workspace_id);

create index whatsapp_cloud_webhook_receipts_message_workspace_idx
  on public.whatsapp_cloud_webhook_receipts (
    conversation_message_id,
    workspace_id
  )
  where conversation_message_id is not null;

-- Bind every controlled constraint, policy and manual index to PostgreSQL's
-- canonical deparser output. A same-name drop/recreate (including CHECK
-- (true)), changed FK action, INCLUDE/opclass or predicate loses or mismatches
-- this attestation and makes both runtime readiness and postflight fail closed.
do $catalog_attestation$
declare
  controlled_record record;
  canonical_definition text;
  attestation text;
begin
  for controlled_record in
    select constraint_definition.oid,
           constraint_definition.conname,
           relation_namespace.nspname,
           relation.relname
      from pg_constraint as constraint_definition
      join pg_class as relation
        on relation.oid = constraint_definition.conrelid
      join pg_namespace as relation_namespace
        on relation_namespace.oid = relation.relnamespace
     where (
       constraint_definition.conrelid =
         'public.whatsapp_cloud_webhook_receipts'::regclass
       and constraint_definition.contype in ('p', 'u', 'f', 'c')
     ) or (
       constraint_definition.conrelid =
         'public.conversation_messages'::regclass
       and constraint_definition.conname in (
         'conversation_messages_whatsapp_connection_workspace_fk',
         'conversation_messages_whatsapp_identity_check'
       )
     )
  loop
    canonical_definition := pg_get_constraintdef(
      controlled_record.oid,
      true
    );
    attestation := 'fanmind-whatsapp:v1:sha256:' || pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(canonical_definition, 'UTF8')
      ),
      'hex'
    );
    execute format(
      'comment on constraint %I on %I.%I is %L',
      controlled_record.conname,
      controlled_record.nspname,
      controlled_record.relname,
      attestation
    );
  end loop;

  for controlled_record in
    select index_relation.oid,
           index_namespace.nspname,
           index_relation.relname
      from pg_class as index_relation
      join pg_namespace as index_namespace
        on index_namespace.oid = index_relation.relnamespace
     where index_namespace.nspname = 'public'
       and index_relation.relname in (
         'social_connections_active_whatsapp_phone_unique_idx',
         'conversation_messages_id_workspace_unique_idx',
         'conversation_messages_whatsapp_identity_unique_idx',
         'whatsapp_cloud_webhook_receipts_retry_idx',
         'whatsapp_cloud_webhook_receipts_workspace_idx',
         'whatsapp_cloud_webhook_receipts_message_workspace_idx'
       )
  loop
    canonical_definition := pg_get_indexdef(controlled_record.oid, 0, true);
    attestation := 'fanmind-whatsapp:v1:sha256:' || pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(canonical_definition, 'UTF8')
      ),
      'hex'
    );
    execute format(
      'comment on index %I.%I is %L',
      controlled_record.nspname,
      controlled_record.relname,
      attestation
    );
  end loop;

  for controlled_record in
    select policy_definition.oid,
           policy_definition.polname,
           relation_namespace.nspname,
           relation.relname,
           policy_definition.polcmd,
           policy_definition.polpermissive,
           policy_definition.polroles,
           pg_get_expr(
             policy_definition.polqual,
             policy_definition.polrelid
           ) as using_expression,
           pg_get_expr(
             policy_definition.polwithcheck,
             policy_definition.polrelid
           ) as check_expression
      from pg_policy as policy_definition
      join pg_class as relation on relation.oid = policy_definition.polrelid
      join pg_namespace as relation_namespace
        on relation_namespace.oid = relation.relnamespace
     where relation_namespace.nspname = 'public'
       and relation.relname = 'conversation_messages'
       and policy_definition.polname in (
         'conversation_messages_whatsapp_identity_server_insert',
         'conversation_messages_whatsapp_identity_server_update'
       )
  loop
    canonical_definition := concat_ws(
      '|',
      controlled_record.polcmd::text,
      controlled_record.polpermissive::text,
      controlled_record.polroles::text,
      coalesce(controlled_record.using_expression, '<null>'),
      coalesce(controlled_record.check_expression, '<null>')
    );
    attestation := 'fanmind-whatsapp:v1:sha256:' || pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(canonical_definition, 'UTF8')
      ),
      'hex'
    );
    execute format(
      'comment on policy %I on %I.%I is %L',
      controlled_record.polname,
      controlled_record.nspname,
      controlled_record.relname,
      attestation
    );
  end loop;
end
$catalog_attestation$;

alter table public.whatsapp_cloud_webhook_receipts enable row level security;
alter table public.whatsapp_cloud_webhook_receipts force row level security;

revoke all on table public.whatsapp_cloud_webhook_receipts
  from public, anon, authenticated, service_role;

create function public.whatsapp_cloud_inbound_schema_state()
returns table (ready boolean)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
  select
    auth.role() = 'service_role'
    and to_regclass(
      'public.conversation_messages_whatsapp_external_message_unique_idx'
    ) is null
    and (
      select array_agg(
        attribute.attname || '|' ||
        format_type(attribute.atttypid, attribute.atttypmod) || '|' ||
        attribute.attnotnull::text || '|' ||
        coalesce(
          pg_get_expr(default_definition.adbin, default_definition.adrelid),
          '<null>'
        ) || '|' || attribute.attidentity::text || '|' ||
        attribute.attgenerated::text
        order by attribute.attnum
      )
        from pg_attribute as attribute
        left join pg_attrdef as default_definition
          on default_definition.adrelid = attribute.attrelid
         and default_definition.adnum = attribute.attnum
       where attribute.attrelid = 'public.conversation_messages'::regclass
         and attribute.attname = any(array[
           'whatsapp_social_connection_id',
           'whatsapp_phone_number_id',
           'whatsapp_payload_fingerprint'
         ]::text[])
         and attribute.attnum > 0
         and not attribute.attisdropped
    ) = array[
      'whatsapp_social_connection_id|uuid|false|<null>||',
      'whatsapp_phone_number_id|text|false|<null>||',
      'whatsapp_payload_fingerprint|text|false|<null>||'
    ]::text[]
    and not exists (
      select 1 from pg_attribute as attribute
       where attribute.attrelid = 'public.conversation_messages'::regclass
         and attribute.attname like 'whatsapp\_%' escape '\'
         and attribute.attname <> all(array[
           'whatsapp_social_connection_id',
           'whatsapp_phone_number_id',
           'whatsapp_payload_fingerprint'
         ]::text[])
         and attribute.attnum > 0
         and not attribute.attisdropped
    )
    and (
      select array_agg(
        attribute.attname || '|' ||
        format_type(attribute.atttypid, attribute.atttypmod) || '|' ||
        attribute.attnotnull::text || '|' ||
        coalesce(
          pg_get_expr(default_definition.adbin, default_definition.adrelid),
          '<null>'
        ) || '|' || attribute.attidentity::text || '|' ||
        attribute.attgenerated::text
        order by attribute.attnum
      )
        from pg_attribute as attribute
        left join pg_attrdef as default_definition
          on default_definition.adrelid = attribute.attrelid
         and default_definition.adnum = attribute.attnum
       where attribute.attrelid =
             'public.whatsapp_cloud_webhook_receipts'::regclass
         and attribute.attnum > 0
         and not attribute.attisdropped
    ) = array[
      'id|uuid|true|gen_random_uuid()||',
      'workspace_id|uuid|true|<null>||',
      'social_connection_id|uuid|true|<null>||',
      'phone_number_id|text|true|<null>||',
      'external_message_id|text|true|<null>||',
      'payload_fingerprint|text|true|<null>||',
      'status|text|true|''processing''::text||',
      'attempt_count|integer|true|1||',
      'lease_token|uuid|false|<null>||',
      'lease_until|timestamp with time zone|false|<null>||',
      'conversation_message_id|uuid|false|<null>||',
      'last_error_code|text|false|<null>||',
      'created_at|timestamp with time zone|true|now()||',
      'updated_at|timestamp with time zone|true|now()||'
    ]::text[]
    and exists (
      select 1
        from pg_index as definition
        join pg_class as relation on relation.oid = definition.indexrelid
        join pg_am as access_method on access_method.oid = relation.relam
       where definition.indrelid = 'public.social_connections'::regclass
         and relation.relname = 'social_connections_active_whatsapp_phone_unique_idx'
         and relation.relowner = to_regrole('postgres')
         and access_method.amname = 'btree'
         and definition.indisunique
         and definition.indisvalid
         and definition.indisready
         and definition.indislive
         and definition.indimmediate
         and not definition.indisexclusion
         and definition.indexprs is null
         and definition.indpred is not null
         and definition.indnkeyatts = 1
         and definition.indnatts = 1
         and definition.indkey[0] = (
           select attnum from pg_attribute
            where attrelid = 'public.social_connections'::regclass
              and attname = 'page_id'
              and not attisdropped
         )
         and regexp_replace(
           pg_get_expr(definition.indpred, definition.indrelid),
           '[[:space:]]+|::text|[()]',
           '',
           'g'
         ) = 'platform=''whatsapp''ANDprovider=''meta_whatsapp_cloud''ANDstatus=''connected''ANDpage_idISNOTNULL'
    )
    and exists (
      select 1
        from pg_index as definition
        join pg_class as relation on relation.oid = definition.indexrelid
        join pg_am as access_method on access_method.oid = relation.relam
       where definition.indrelid = 'public.conversation_messages'::regclass
         and relation.relname = 'conversation_messages_id_workspace_unique_idx'
         and relation.relowner = to_regrole('postgres')
         and access_method.amname = 'btree'
         and definition.indisunique
         and definition.indisvalid
         and definition.indisready
         and definition.indislive
         and definition.indimmediate
         and not definition.indisexclusion
         and definition.indexprs is null
         and definition.indpred is null
         and definition.indnkeyatts = 2
         and definition.indnatts = 2
         and definition.indkey[0] = (
           select attnum from pg_attribute
            where attrelid = 'public.conversation_messages'::regclass
              and attname = 'id'
              and not attisdropped
         )
         and definition.indkey[1] = (
           select attnum from pg_attribute
            where attrelid = 'public.conversation_messages'::regclass
              and attname = 'workspace_id'
              and not attisdropped
         )
    )
    and exists (
      select 1
        from pg_index as definition
        join pg_class as relation on relation.oid = definition.indexrelid
        join pg_am as access_method on access_method.oid = relation.relam
       where definition.indrelid = 'public.conversation_messages'::regclass
         and relation.relname = 'conversation_messages_whatsapp_identity_unique_idx'
         and relation.relowner = to_regrole('postgres')
         and access_method.amname = 'btree'
         and definition.indisunique
         and definition.indisvalid
         and definition.indisready
         and definition.indislive
         and definition.indimmediate
         and not definition.indisexclusion
         and definition.indexprs is null
         and definition.indpred is not null
         and definition.indnkeyatts = 3
         and definition.indnatts = 3
         and definition.indkey[0] = (
           select attnum from pg_attribute
            where attrelid = 'public.conversation_messages'::regclass
              and attname = 'whatsapp_social_connection_id'
              and not attisdropped
         )
         and definition.indkey[1] = (
           select attnum from pg_attribute
            where attrelid = 'public.conversation_messages'::regclass
              and attname = 'whatsapp_phone_number_id'
              and not attisdropped
         )
         and definition.indkey[2] = (
           select attnum from pg_attribute
            where attrelid = 'public.conversation_messages'::regclass
              and attname = 'external_message_id'
              and not attisdropped
         )
         and regexp_replace(
           pg_get_expr(definition.indpred, definition.indrelid),
           '[[:space:]]+|::text|[()]',
           '',
           'g'
         ) = 'source_platform=''whatsapp''ANDwhatsapp_social_connection_idISNOTNULLANDwhatsapp_phone_number_idISNOTNULLANDexternal_message_idISNOTNULL'
    )
    and exists (
      select 1
        from pg_class
       where oid = 'public.whatsapp_cloud_webhook_receipts'::regclass
         and relkind = 'r'
         and relpersistence = 'p'
         and relrowsecurity
         and relforcerowsecurity
         and relowner = to_regrole('postgres')
    )
    and not exists (
      select 1 from pg_policy as policy_definition
       where policy_definition.polrelid =
             'public.whatsapp_cloud_webhook_receipts'::regclass
    )
    and exists (
      select 1 from pg_trigger as trigger_definition
       where trigger_definition.tgrelid =
             'public.conversation_messages'::regclass
         and trigger_definition.tgname =
             'conversation_messages_whatsapp_identity_immutable'
         and not trigger_definition.tgisinternal
         and trigger_definition.tgenabled = 'O'
         and trigger_definition.tgtype = 19
         and trigger_definition.tgfoid = to_regprocedure(
           'public.protect_whatsapp_cloud_message_identity()'
         )
    )
    and not exists (
      select 1 from pg_trigger as trigger_definition
       where trigger_definition.tgrelid =
             'public.conversation_messages'::regclass
         and not trigger_definition.tgisinternal
         and trigger_definition.tgname like
             'conversation_messages_whatsapp_identity_%'
         and trigger_definition.tgname <>
             'conversation_messages_whatsapp_identity_immutable'
    )
    and exists (
      select 1
        from pg_index as definition
        join pg_class as relation on relation.oid = definition.indexrelid
        join pg_am as access_method on access_method.oid = relation.relam
       where definition.indrelid =
             'public.whatsapp_cloud_webhook_receipts'::regclass
         and relation.relname = 'whatsapp_cloud_webhook_receipts_retry_idx'
         and relation.relowner = to_regrole('postgres')
         and access_method.amname = 'btree'
         and not definition.indisunique
         and definition.indisvalid
         and definition.indisready
         and definition.indislive
         and definition.indimmediate
         and not definition.indisexclusion
         and definition.indexprs is null
         and definition.indpred is not null
         and definition.indnkeyatts = 2
         and definition.indnatts = 2
         and definition.indkey[0] = (
           select attnum from pg_attribute
            where attrelid =
                  'public.whatsapp_cloud_webhook_receipts'::regclass
              and attname = 'updated_at'
              and not attisdropped
         )
         and definition.indkey[1] = (
           select attnum from pg_attribute
            where attrelid =
                  'public.whatsapp_cloud_webhook_receipts'::regclass
              and attname = 'id'
              and not attisdropped
         )
         and regexp_replace(
           pg_get_expr(definition.indpred, definition.indrelid),
           '[[:space:]]+|::text|[()]',
           '',
           'g'
         ) = 'status=ANYARRAY[''processing'',''retryable_error'']'
    )
    and exists (
      select 1
        from pg_index as definition
        join pg_class as relation on relation.oid = definition.indexrelid
        join pg_am as access_method on access_method.oid = relation.relam
       where definition.indrelid =
             'public.whatsapp_cloud_webhook_receipts'::regclass
         and relation.relname = 'whatsapp_cloud_webhook_receipts_workspace_idx'
         and relation.relowner = to_regrole('postgres')
         and access_method.amname = 'btree'
         and not definition.indisunique
         and definition.indisvalid
         and definition.indisready
         and definition.indislive
         and definition.indimmediate
         and not definition.indisexclusion
         and definition.indexprs is null
         and definition.indpred is null
         and definition.indnkeyatts = 1
         and definition.indnatts = 1
         and definition.indkey[0] = (
           select attnum from pg_attribute
            where attrelid =
                  'public.whatsapp_cloud_webhook_receipts'::regclass
              and attname = 'workspace_id'
              and not attisdropped
         )
    )
    and exists (
      select 1
        from pg_index as definition
        join pg_class as relation on relation.oid = definition.indexrelid
        join pg_am as access_method on access_method.oid = relation.relam
       where definition.indrelid =
             'public.whatsapp_cloud_webhook_receipts'::regclass
         and relation.relname =
             'whatsapp_cloud_webhook_receipts_message_workspace_idx'
         and relation.relowner = to_regrole('postgres')
         and access_method.amname = 'btree'
         and not definition.indisunique
         and definition.indisvalid
         and definition.indisready
         and definition.indislive
         and definition.indimmediate
         and not definition.indisexclusion
         and definition.indexprs is null
         and definition.indpred is not null
         and definition.indnkeyatts = 2
         and definition.indnatts = 2
         and definition.indkey[0] = (
           select attnum from pg_attribute
            where attrelid =
                  'public.whatsapp_cloud_webhook_receipts'::regclass
              and attname = 'conversation_message_id'
              and not attisdropped
         )
         and definition.indkey[1] = (
           select attnum from pg_attribute
            where attrelid =
                  'public.whatsapp_cloud_webhook_receipts'::regclass
              and attname = 'workspace_id'
              and not attisdropped
         )
         and regexp_replace(
           pg_get_expr(definition.indpred, definition.indrelid),
           '[[:space:]]+|::text|[()]',
           '',
           'g'
         ) = 'conversation_message_idISNOTNULL'
    )
    and not exists (
      select 1
        from pg_index as definition
        join pg_class as relation on relation.oid = definition.indexrelid
        join pg_namespace as relation_namespace
          on relation_namespace.oid = relation.relnamespace
        join pg_am as access_method on access_method.oid = relation.relam
       where relation_namespace.nspname = 'public'
         and relation.relname in (
           'social_connections_active_whatsapp_phone_unique_idx',
           'conversation_messages_id_workspace_unique_idx',
           'conversation_messages_whatsapp_identity_unique_idx',
           'whatsapp_cloud_webhook_receipts_retry_idx',
           'whatsapp_cloud_webhook_receipts_workspace_idx',
           'whatsapp_cloud_webhook_receipts_message_workspace_idx'
         )
         and (
           relation.relkind <> 'i'
           or relation.relowner <> to_regrole('postgres')
           or access_method.amname <> 'btree'
           or not definition.indisvalid
           or not definition.indisready
           or not definition.indislive
           or not definition.indimmediate
           or definition.indisexclusion
           or definition.indisprimary
           or definition.indnullsnotdistinct
           or definition.indnatts <> definition.indnkeyatts
         )
    )
    and not exists (
      select 1 from pg_class as index_relation
      join pg_namespace as index_namespace
        on index_namespace.oid = index_relation.relnamespace
     where index_namespace.nspname = 'public'
       and index_relation.relname in (
         'social_connections_active_whatsapp_phone_unique_idx',
         'conversation_messages_id_workspace_unique_idx',
         'conversation_messages_whatsapp_identity_unique_idx',
         'whatsapp_cloud_webhook_receipts_retry_idx',
         'whatsapp_cloud_webhook_receipts_workspace_idx',
         'whatsapp_cloud_webhook_receipts_message_workspace_idx'
       )
       and obj_description(index_relation.oid, 'pg_class') is distinct from
         'fanmind-whatsapp:v1:sha256:' || pg_catalog.encode(
           pg_catalog.sha256(
             pg_catalog.convert_to(
               pg_get_indexdef(index_relation.oid, 0, true),
               'UTF8'
             )
           ),
           'hex'
         )
    )
    and (
      select array_agg(constraint_definition.conname order by constraint_definition.conname)
        from pg_constraint as constraint_definition
       where constraint_definition.conrelid =
             'public.whatsapp_cloud_webhook_receipts'::regclass
         and constraint_definition.contype in ('p', 'u', 'f', 'c')
    ) = array[
      'whatsapp_cloud_receipt_attempt_count_check',
      'whatsapp_cloud_receipt_connection_workspace_fk',
      'whatsapp_cloud_receipt_external_message_id_check',
      'whatsapp_cloud_receipt_identity_unique',
      'whatsapp_cloud_receipt_last_error_code_check',
      'whatsapp_cloud_receipt_message_workspace_fk',
      'whatsapp_cloud_receipt_payload_fingerprint_check',
      'whatsapp_cloud_receipt_phone_number_id_check',
      'whatsapp_cloud_receipt_state_check',
      'whatsapp_cloud_receipt_status_check',
      'whatsapp_cloud_receipt_workspace_fk',
      'whatsapp_cloud_webhook_receipts_pkey'
    ]::text[]
    and (
      select array_agg(constraint_definition.conname order by constraint_definition.conname)
        from pg_constraint as constraint_definition
       where constraint_definition.conrelid =
             'public.conversation_messages'::regclass
         and constraint_definition.conname in (
           'conversation_messages_whatsapp_connection_workspace_fk',
           'conversation_messages_whatsapp_identity_check'
         )
         and constraint_definition.convalidated
         and not constraint_definition.connoinherit
    ) = array[
      'conversation_messages_whatsapp_connection_workspace_fk',
      'conversation_messages_whatsapp_identity_check'
    ]::text[]
    and (
      select count(*) from pg_policies as policy
       where policy.schemaname = 'public'
         and policy.tablename = 'conversation_messages'
         and policy.policyname in (
           'conversation_messages_whatsapp_identity_server_insert',
           'conversation_messages_whatsapp_identity_server_update'
         )
         and policy.permissive = 'RESTRICTIVE'
         and policy.roles = array['authenticated']::name[]
         and (
           (
             policy.policyname =
               'conversation_messages_whatsapp_identity_server_insert'
             and policy.cmd = 'INSERT'
             and policy.qual is null
             and coalesce(policy.with_check, '') like
                 '%whatsapp_social_connection_id%IS NULL%'
             and coalesce(policy.with_check, '') like
                 '%whatsapp_phone_number_id%IS NULL%'
             and coalesce(policy.with_check, '') like
                 '%whatsapp_payload_fingerprint%IS NULL%'
           )
           or
           (
             policy.policyname =
               'conversation_messages_whatsapp_identity_server_update'
             and policy.cmd = 'UPDATE'
             and coalesce(policy.qual, '') = 'true'
             and coalesce(policy.with_check, '') = 'true'
           )
         )
    ) = 2
    and not exists (
      select 1 from pg_policy as policy_definition
      join pg_class as relation on relation.oid = policy_definition.polrelid
      join pg_namespace as relation_namespace
        on relation_namespace.oid = relation.relnamespace
     where relation_namespace.nspname = 'public'
       and relation.relname = 'conversation_messages'
       and policy_definition.polname like
           'conversation_messages_whatsapp_identity_%'
       and policy_definition.polname not in (
         'conversation_messages_whatsapp_identity_server_insert',
         'conversation_messages_whatsapp_identity_server_update'
       )
    )
    and not exists (
      select 1 from pg_policy as policy_definition
      join pg_class as relation on relation.oid = policy_definition.polrelid
      join pg_namespace as relation_namespace
        on relation_namespace.oid = relation.relnamespace
     where relation_namespace.nspname = 'public'
       and relation.relname = 'conversation_messages'
       and policy_definition.polname in (
         'conversation_messages_whatsapp_identity_server_insert',
         'conversation_messages_whatsapp_identity_server_update'
       )
       and obj_description(policy_definition.oid, 'pg_policy') is distinct from
         'fanmind-whatsapp:v1:sha256:' || pg_catalog.encode(
           pg_catalog.sha256(
             pg_catalog.convert_to(
               concat_ws(
                 '|',
                 policy_definition.polcmd::text,
                 policy_definition.polpermissive::text,
                 policy_definition.polroles::text,
                 coalesce(pg_get_expr(
                   policy_definition.polqual,
                   policy_definition.polrelid
                 ), '<null>'),
                 coalesce(pg_get_expr(
                   policy_definition.polwithcheck,
                   policy_definition.polrelid
                 ), '<null>')
               ),
               'UTF8'
             )
           ),
           'hex'
         )
    )
    and not exists (
      select 1 from pg_constraint as constraint_definition
       where constraint_definition.conrelid in (
         'public.conversation_messages'::regclass,
         'public.whatsapp_cloud_webhook_receipts'::regclass
       )
         and constraint_definition.conname in (
           'conversation_messages_whatsapp_connection_workspace_fk',
           'conversation_messages_whatsapp_identity_check',
           'whatsapp_cloud_receipt_attempt_count_check',
           'whatsapp_cloud_receipt_connection_workspace_fk',
           'whatsapp_cloud_receipt_external_message_id_check',
           'whatsapp_cloud_receipt_identity_unique',
           'whatsapp_cloud_receipt_last_error_code_check',
           'whatsapp_cloud_receipt_message_workspace_fk',
           'whatsapp_cloud_receipt_payload_fingerprint_check',
           'whatsapp_cloud_receipt_phone_number_id_check',
           'whatsapp_cloud_receipt_state_check',
           'whatsapp_cloud_receipt_status_check',
           'whatsapp_cloud_receipt_workspace_fk',
           'whatsapp_cloud_webhook_receipts_pkey'
         )
         and (
           not constraint_definition.convalidated
           or not constraint_definition.conislocal
           or constraint_definition.coninhcount <> 0
           or constraint_definition.connoinherit
           or constraint_definition.conparentid <> 0
           or constraint_definition.condeferrable
           or constraint_definition.condeferred
         )
    )
    and not exists (
      select 1 from pg_constraint as constraint_definition
       where (
         (
           constraint_definition.conrelid =
             'public.whatsapp_cloud_webhook_receipts'::regclass
           and constraint_definition.contype in ('p', 'u', 'f', 'c')
         ) or (
           constraint_definition.conrelid =
             'public.conversation_messages'::regclass
           and constraint_definition.conname in (
             'conversation_messages_whatsapp_connection_workspace_fk',
             'conversation_messages_whatsapp_identity_check'
           )
         )
       )
       and obj_description(
         constraint_definition.oid,
         'pg_constraint'
       ) is distinct from 'fanmind-whatsapp:v1:sha256:' ||
         pg_catalog.encode(
           pg_catalog.sha256(
             pg_catalog.convert_to(
               pg_get_constraintdef(constraint_definition.oid, true),
               'UTF8'
             )
           ),
           'hex'
         )
    )
    and exists (
      select 1 from pg_constraint as constraint_definition
       where constraint_definition.conrelid =
             'public.whatsapp_cloud_webhook_receipts'::regclass
         and constraint_definition.conname =
             'whatsapp_cloud_receipt_identity_unique'
         and constraint_definition.contype = 'u'
         and constraint_definition.conkey = array[
           (select attnum from pg_attribute where attrelid =
             'public.whatsapp_cloud_webhook_receipts'::regclass
             and attname = 'social_connection_id' and not attisdropped),
           (select attnum from pg_attribute where attrelid =
             'public.whatsapp_cloud_webhook_receipts'::regclass
             and attname = 'phone_number_id' and not attisdropped),
           (select attnum from pg_attribute where attrelid =
             'public.whatsapp_cloud_webhook_receipts'::regclass
             and attname = 'external_message_id' and not attisdropped)
         ]::smallint[]
    )
    and exists (
      select 1 from pg_constraint as constraint_definition
       where constraint_definition.conrelid =
             'public.whatsapp_cloud_webhook_receipts'::regclass
         and constraint_definition.conname =
             'whatsapp_cloud_receipt_message_workspace_fk'
         and constraint_definition.contype = 'f'
         and constraint_definition.confrelid =
             'public.conversation_messages'::regclass
         and constraint_definition.confdeltype = 'n'
         and constraint_definition.confupdtype = 'a'
         and constraint_definition.confmatchtype = 's'
         and constraint_definition.confdelsetcols = array[
           (select attnum from pg_attribute where attrelid =
             'public.whatsapp_cloud_webhook_receipts'::regclass
             and attname = 'conversation_message_id' and not attisdropped)
         ]::smallint[]
    )
    and not exists (
      select 1 from pg_constraint as constraint_definition
       where constraint_definition.conrelid =
             'public.whatsapp_cloud_webhook_receipts'::regclass
         and constraint_definition.contype = 'c'
         and constraint_definition.conname like 'whatsapp_cloud_receipt_%'
         and (
           pg_get_expr(
             constraint_definition.conbin,
             constraint_definition.conrelid
           ) = 'true'::text
           or pg_get_expr(
             constraint_definition.conbin,
             constraint_definition.conrelid
           ) not like '%' || case constraint_definition.conname
             when 'whatsapp_cloud_receipt_phone_number_id_check'
               then 'phone_number_id'
             when 'whatsapp_cloud_receipt_external_message_id_check'
               then 'external_message_id'
             when 'whatsapp_cloud_receipt_payload_fingerprint_check'
               then 'payload_fingerprint'
             when 'whatsapp_cloud_receipt_status_check' then 'status'
             when 'whatsapp_cloud_receipt_attempt_count_check'
               then 'attempt_count'
             when 'whatsapp_cloud_receipt_last_error_code_check'
               then 'last_error_code'
             when 'whatsapp_cloud_receipt_state_check' then 'lease_token'
             else '__unexpected__'
           end || '%'
         )
    )
    and not has_table_privilege(
      'anon', 'public.whatsapp_cloud_webhook_receipts', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
    )
    and not has_table_privilege(
      'authenticated', 'public.whatsapp_cloud_webhook_receipts', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
    )
    and not has_table_privilege(
      'service_role', 'public.whatsapp_cloud_webhook_receipts', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
    )
    and not exists (
      select 1 from pg_attribute as attribute
       where attribute.attrelid =
             'public.whatsapp_cloud_webhook_receipts'::regclass
         and attribute.attnum > 0
         and not attribute.attisdropped
         and attribute.attacl is not null
    )
    and not exists (
      select 1 from pg_trigger as trigger_definition
       where trigger_definition.tgrelid =
             'public.whatsapp_cloud_webhook_receipts'::regclass
         and not trigger_definition.tgisinternal
    )
    and coalesce((
      select count(*) = 7
         and bool_and(table_acl.grantee = to_regrole('postgres'))
         and bool_and(table_acl.grantor = to_regrole('postgres'))
         and bool_and(not table_acl.is_grantable)
         and array_agg(table_acl.privilege_type order by table_acl.privilege_type)
             = array[
               'DELETE', 'INSERT', 'REFERENCES', 'SELECT', 'TRIGGER',
               'TRUNCATE', 'UPDATE'
             ]::text[]
        from pg_class as receipt_table
        cross join lateral aclexplode(
          coalesce(
            receipt_table.relacl,
            acldefault('r', receipt_table.relowner)
          )
        ) as table_acl
       where receipt_table.oid =
             'public.whatsapp_cloud_webhook_receipts'::regclass
    ), false)
    and not exists (
      select 1
        from supabase_migrations.schema_migrations
       where version = '20260817230000'
          or name in (
            '20260817230000_whatsapp_cloud_inbound_foundation',
            'whatsapp_cloud_inbound_foundation'
          )
    )
    and public.workspace_processing_allowed_contract(
      'active',
      null,
      'demo_free',
      false,
      null,
      null,
      '{"fixed_demo_seed_version":"2026-07-26-v1"}'::jsonb,
      timestamptz '2026-08-17 12:00:00+00'
    )
    and not public.workspace_processing_allowed_contract(
      'active',
      null,
      'cancelled',
      true,
      null,
      null,
      '{}',
      timestamptz '2026-08-17 12:00:00+00'
    )
    and exists (
      select 1 from pg_proc as member_function
      join pg_language as member_language
        on member_language.oid = member_function.prolang
     where member_function.oid = to_regprocedure(
       'public.workspace_processing_allowed_contract(text,text,text,boolean,text,text,jsonb,timestamp with time zone)'
     )
       and member_function.proowner = to_regrole('postgres')
       and member_language.lanname = 'plpgsql'
       and member_function.prokind = 'f'
       and member_function.provolatile = 's'
       and member_function.proparallel = 'u'
       and not member_function.prosecdef
       and not member_function.proretset
       and not member_function.proisstrict
       and not member_function.proleakproof
       and member_function.procost = 100
       and member_function.prorows = 0
       and member_function.prosupport = 0
       and member_function.provariadic = 0
       and member_function.protrftypes is null
       and member_function.probin is null
       and member_function.prosqlbody is null
       and member_function.prorettype = 'boolean'::regtype
       and member_function.proargtypes =
           '25 25 25 16 25 25 3802 1184'::oidvector
       and member_function.proallargtypes is null
       and member_function.proargmodes is null
       and member_function.proargnames = array[
         'p_workspace_access_mode',
         'p_subscription_effective_end_at',
         'p_billing_status',
         'p_billing_manual_override',
         'p_billing_grace_until',
         'p_billing_suspended_at',
         'p_test_access_flags',
         'p_evaluated_at'
       ]::text[]
       and member_function.pronargs = 8
       and member_function.pronargdefaults = 0
       and member_function.proargdefaults is null
       and member_function.proconfig is not distinct from
           array['search_path=pg_catalog, public, pg_temp']::text[]
       and pg_catalog.encode(
         pg_catalog.sha256(
           pg_catalog.convert_to(member_function.prosrc, 'UTF8')
         ),
         'hex'
       ) = 'e9e57a8bef3d480de6c932eadb11a7c8123219db0ffa52969641b216c5cfd42d'
       and coalesce((
         select count(*) = 2
            and bool_and(member_acl.privilege_type = 'EXECUTE')
            and bool_and(not member_acl.is_grantable)
            and bool_and(member_acl.grantor = member_function.proowner)
            and count(*) filter (
              where member_acl.grantee = member_function.proowner
            ) = 1
            and count(*) filter (
              where member_acl.grantee = to_regrole('authenticated')
            ) = 1
           from aclexplode(
             coalesce(
               member_function.proacl,
               acldefault('f', member_function.proowner)
             )
           ) as member_acl
       ), false)
    )
    and (
      select count(*)
        from pg_proc as member_overload
        join pg_namespace as member_namespace
          on member_namespace.oid = member_overload.pronamespace
       where member_namespace.nspname = 'public'
         and member_overload.proname =
             'workspace_processing_allowed_contract'
    ) = 1
    and not exists (
      select 1
        from (values
          ('public.whatsapp_cloud_inbound_schema_state()'),
          ('public.claim_whatsapp_cloud_inbound_message(uuid,uuid,text,text,text,integer)'),
          ('public.store_whatsapp_cloud_inbound_message(uuid,uuid,uuid,uuid,text,text,text,text,text,text,timestamp with time zone,text)'),
          ('public.disconnect_whatsapp_cloud_inbound_connection(uuid,uuid)'),
          ('public.protect_whatsapp_cloud_message_identity()')
        ) as required(signature)
        left join pg_proc as function_definition
          on function_definition.oid = to_regprocedure(required.signature)
       where function_definition.oid is null
          or function_definition.proowner <> to_regrole('postgres')
          or not function_definition.prosecdef
          or function_definition.prokind <> 'f'
          or function_definition.proconfig is distinct from
             array['search_path=pg_catalog, public, pg_temp']::text[]
          or not coalesce((
            select count(*) = 2
               and bool_and(function_acl.privilege_type = 'EXECUTE')
               and bool_and(not function_acl.is_grantable)
               and bool_and(
                 function_acl.grantor = function_definition.proowner
               )
               and count(*) filter (
                 where function_acl.grantee = function_definition.proowner
               ) = 1
               and count(*) filter (
                 where function_acl.grantee = to_regrole('service_role')
               ) = 1
              from aclexplode(
                coalesce(
                  function_definition.proacl,
                  acldefault('f', function_definition.proowner)
                )
              ) as function_acl
          ), false)
    )
    and (
      select count(*) from pg_proc as function_definition
      join pg_namespace as function_namespace
        on function_namespace.oid = function_definition.pronamespace
     where function_namespace.nspname = 'public'
       and function_definition.proname in (
         'whatsapp_cloud_inbound_schema_state',
         'claim_whatsapp_cloud_inbound_message',
         'store_whatsapp_cloud_inbound_message',
         'disconnect_whatsapp_cloud_inbound_connection',
         'protect_whatsapp_cloud_message_identity'
       )
    ) = 5
    and not exists (
      select 1 from pg_proc as function_definition
      join pg_namespace as function_namespace
        on function_namespace.oid = function_definition.pronamespace
      join pg_language as function_language
        on function_language.oid = function_definition.prolang
     where function_namespace.nspname = 'public'
       and function_definition.proname in (
         'whatsapp_cloud_inbound_schema_state',
         'claim_whatsapp_cloud_inbound_message',
         'store_whatsapp_cloud_inbound_message',
         'disconnect_whatsapp_cloud_inbound_connection',
         'protect_whatsapp_cloud_message_identity'
       )
       and obj_description(function_definition.oid, 'pg_proc') is distinct from
         'fanmind-whatsapp:v1:sha256:' || pg_catalog.encode(
           pg_catalog.sha256(
             pg_catalog.convert_to(
               concat_ws(
                 '|',
                 format(
                   '%I.%I(%s)',
                   function_namespace.nspname,
                   function_definition.proname,
                   pg_get_function_identity_arguments(function_definition.oid)
                 ),
                 function_language.lanname,
                 function_definition.proowner::text,
                 function_definition.prokind::text,
                 function_definition.provolatile::text,
                 function_definition.proparallel::text,
                 function_definition.prosecdef::text,
                 function_definition.proretset::text,
                 function_definition.proisstrict::text,
                 function_definition.proleakproof::text,
                 function_definition.procost::text,
                 function_definition.prorows::text,
                 function_definition.prosupport::text,
                 function_definition.provariadic::text,
                 coalesce(function_definition.protrftypes::text, '<null>'),
                 coalesce(function_definition.probin, '<null>'),
                 coalesce(function_definition.prosqlbody::text, '<null>'),
                 function_definition.prorettype::text,
                 function_definition.proargtypes::text,
                 coalesce(function_definition.proallargtypes::text, '<null>'),
                 coalesce(function_definition.proargmodes::text, '<null>'),
                 coalesce(function_definition.proargnames::text, '<null>'),
                 function_definition.pronargs::text,
                 function_definition.pronargdefaults::text,
                 coalesce(pg_get_expr(
                   function_definition.proargdefaults,
                   0
                 ), '<null>'),
                 coalesce(function_definition.proconfig::text, '<null>'),
                 function_definition.prosrc,
                 coalesce(function_definition.proacl::text, '<null>')
               ),
               'UTF8'
             )
           ),
           'hex'
         )
    );
$function$;

create function public.claim_whatsapp_cloud_inbound_message(
  p_workspace_id uuid,
  p_social_connection_id uuid,
  p_phone_number_id text,
  p_external_message_id text,
  p_payload_fingerprint text,
  p_lease_seconds integer default 120
)
returns table (receipt_id uuid, lease_token uuid, outcome text)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  normalized_phone_number_id text := btrim(coalesce(p_phone_number_id, ''));
  normalized_message_id text := btrim(coalesce(p_external_message_id, ''));
  normalized_payload_fingerprint text :=
    btrim(coalesce(p_payload_fingerprint, ''));
  claimed_receipt public.whatsapp_cloud_webhook_receipts%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if normalized_phone_number_id !~ '^[1-9][0-9]{5,31}$'
     or char_length(normalized_message_id) not between 1 and 512
     or normalized_message_id ~ '[[:cntrl:]]'
     or normalized_message_id !~ '^wamid\.[A-Za-z0-9+/_=-]{1,505}$'
     or normalized_payload_fingerprint !~ '^[0-9a-f]{64}$'
     or p_lease_seconds not between 30 and 300 then
    raise exception 'whatsapp_cloud_claim_input_invalid' using errcode = '22023';
  end if;
  perform 1
    from public.social_connections as connection
   where connection.id = p_social_connection_id
     and connection.workspace_id = p_workspace_id
     and connection.platform = 'whatsapp'
     and connection.provider = 'meta_whatsapp_cloud'
     and connection.status = 'connected'
     and connection.webhook_subscribed
     and connection.page_id = normalized_phone_number_id
   for update;
  if not found then
    raise exception 'whatsapp_cloud_connection_unavailable' using errcode = '23503';
  end if;

  insert into public.whatsapp_cloud_webhook_receipts (
    workspace_id,
    social_connection_id,
    phone_number_id,
    external_message_id,
    payload_fingerprint,
    status,
    attempt_count,
    lease_token,
    lease_until
  ) values (
    p_workspace_id,
    p_social_connection_id,
    normalized_phone_number_id,
    normalized_message_id,
    normalized_payload_fingerprint,
    'processing',
    1,
    gen_random_uuid(),
    now() + make_interval(secs => p_lease_seconds)
  )
  on conflict (
    social_connection_id,
    phone_number_id,
    external_message_id
  ) do nothing
  returning * into claimed_receipt;

  if found then
    return query select claimed_receipt.id, claimed_receipt.lease_token, 'claimed'::text;
    return;
  end if;

  select receipt.*
    into claimed_receipt
    from public.whatsapp_cloud_webhook_receipts as receipt
   where receipt.social_connection_id = p_social_connection_id
     and receipt.phone_number_id = normalized_phone_number_id
     and receipt.external_message_id = normalized_message_id
   for update;

  if not found then
    raise exception 'whatsapp_cloud_receipt_identity_missing'
      using errcode = '23503';
  end if;
  if claimed_receipt.workspace_id is distinct from p_workspace_id
     or claimed_receipt.payload_fingerprint is distinct from
        normalized_payload_fingerprint then
    return query select claimed_receipt.id, null::uuid, 'conflict'::text;
    return;
  end if;

  if claimed_receipt.status = 'stored' then
    return query select claimed_receipt.id, null::uuid, 'duplicate'::text;
    return;
  end if;
  if claimed_receipt.status = 'cancelled' then
    return query select claimed_receipt.id, null::uuid, 'cancelled'::text;
    return;
  end if;
  if claimed_receipt.status = 'processing'
     and claimed_receipt.lease_until >= now() then
    return query select claimed_receipt.id, null::uuid, 'in_progress'::text;
    return;
  end if;
  if claimed_receipt.attempt_count >= 5 then
    return query select claimed_receipt.id, null::uuid, 'exhausted'::text;
    return;
  end if;

  update public.whatsapp_cloud_webhook_receipts as receipt
     set status = 'processing',
         attempt_count = receipt.attempt_count + 1,
         lease_token = gen_random_uuid(),
         lease_until = now() + make_interval(secs => p_lease_seconds),
         conversation_message_id = null,
         last_error_code = null,
         updated_at = now()
   where receipt.id = claimed_receipt.id
  returning receipt.* into claimed_receipt;

  return query select claimed_receipt.id, claimed_receipt.lease_token, 'claimed'::text;
end
$function$;

create function public.store_whatsapp_cloud_inbound_message(
  p_workspace_id uuid,
  p_social_connection_id uuid,
  p_receipt_id uuid,
  p_lease_token uuid,
  p_phone_number_id text,
  p_sender_id text,
  p_external_message_id text,
  p_external_thread_id text,
  p_author_label text,
  p_content text,
  p_received_at timestamptz,
  p_payload_fingerprint text
)
returns table (conversation_message_id uuid, outcome text)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  claimed_receipt public.whatsapp_cloud_webhook_receipts%rowtype;
  connection_record public.social_connections%rowtype;
  workspace_record public.workspaces%rowtype;
  normalized_phone_number_id text := btrim(coalesce(p_phone_number_id, ''));
  normalized_sender_id text := btrim(coalesce(p_sender_id, ''));
  normalized_message_id text := btrim(coalesce(p_external_message_id, ''));
  normalized_thread_id text := btrim(coalesce(p_external_thread_id, ''));
  normalized_author_label text := btrim(coalesce(p_author_label, ''));
  normalized_content text := btrim(coalesce(p_content, ''));
  normalized_payload_fingerprint text :=
    btrim(coalesce(p_payload_fingerprint, ''));
  normalized_received_at text;
  fingerprint_material text;
  expected_payload_fingerprint text;
  connection_bound_thread_id text;
  connection_bound_contact_handle text;
  workspace_allowed boolean := false;
  target_contact_id uuid;
  target_conversation_id uuid;
  stored_message_id uuid;
  stored_message_fingerprint text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if normalized_phone_number_id !~ '^[1-9][0-9]{5,31}$'
     or normalized_sender_id !~ '^[1-9][0-9]{5,31}$'
     or char_length(normalized_message_id) not between 1 and 512
     or normalized_message_id ~ '[[:cntrl:]]'
     or normalized_message_id !~ '^wamid\.[A-Za-z0-9+/_=-]{1,505}$'
     or normalized_thread_id <> (normalized_phone_number_id || ':' || normalized_sender_id)
     or char_length(normalized_author_label) not between 1 and 160
     or normalized_author_label ~ '[[:cntrl:]]'
     or char_length(normalized_content) not between 1 and 4096
     or normalized_payload_fingerprint !~ '^[0-9a-f]{64}$'
     or p_received_at is null
     or p_received_at is distinct from date_trunc('second', p_received_at)
     or p_received_at < timestamptz '2000-01-01 00:00:00+00'
     or p_received_at > now() + interval '1 day' then
    raise exception 'whatsapp_cloud_store_input_invalid' using errcode = '22023';
  end if;

  normalized_received_at := to_char(
    p_received_at at time zone 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  );
  select string_agg(
           octet_length(normalized_value)::text || ':' || normalized_value,
           '' order by ordinal
         )
    into fingerprint_material
    from unnest(array[
      'whatsapp',
      'whatsapp_messages',
      'dm',
      'text',
      'inbound',
      normalized_content,
      normalized_message_id,
      normalized_thread_id,
      normalized_author_label,
      normalized_phone_number_id,
      normalized_sender_id,
      normalized_received_at
    ]::text[]) with ordinality as normalized(normalized_value, ordinal);
  expected_payload_fingerprint := pg_catalog.encode(
    pg_catalog.sha256(
      pg_catalog.convert_to(fingerprint_material, 'UTF8')
    ),
    'hex'
  );
  if expected_payload_fingerprint is distinct from
     normalized_payload_fingerprint then
    return query select null::uuid, 'conflict'::text;
    return;
  end if;
  connection_bound_thread_id :=
    p_social_connection_id::text || ':' || normalized_thread_id;
  connection_bound_contact_handle :=
    p_social_connection_id::text || ':' || normalized_sender_id;

  select connection.*
    into connection_record
    from public.social_connections as connection
   where connection.id = p_social_connection_id
     and connection.workspace_id = p_workspace_id
   for update;
  if not found then
    return query select null::uuid, 'connection_unavailable'::text;
    return;
  end if;

  if connection_record.platform is distinct from 'whatsapp'
     or connection_record.provider is distinct from 'meta_whatsapp_cloud'
     or connection_record.status is distinct from 'connected'
     or connection_record.webhook_subscribed is distinct from true
     or connection_record.page_id is distinct from normalized_phone_number_id then
    return query select null::uuid, 'connection_unavailable'::text;
    return;
  end if;

  select receipt.*
    into claimed_receipt
    from public.whatsapp_cloud_webhook_receipts as receipt
   where receipt.id = p_receipt_id
     and receipt.workspace_id = p_workspace_id
     and receipt.social_connection_id = p_social_connection_id
     and receipt.phone_number_id = normalized_phone_number_id
     and receipt.status = 'processing'
     and receipt.lease_token = p_lease_token
     and receipt.lease_until >= now()
     and receipt.external_message_id = normalized_message_id
   for update;
  if not found then
    return query select null::uuid, 'stale_lease'::text;
    return;
  end if;
  if claimed_receipt.payload_fingerprint is distinct from
     normalized_payload_fingerprint then
    return query select null::uuid, 'conflict'::text;
    return;
  end if;

  select workspace.*
    into workspace_record
    from public.workspaces as workspace
   where workspace.id = p_workspace_id
   for share;
  if not found then
    return query select null::uuid, 'processing_blocked'::text;
    return;
  end if;

  workspace_allowed := public.workspace_processing_allowed_contract(
    workspace_record.workspace_access_mode,
    workspace_record.subscription_effective_end_at::text,
    workspace_record.billing_status,
    workspace_record.billing_manual_override,
    workspace_record.billing_grace_until::text,
    workspace_record.billing_suspended_at::text,
    coalesce(workspace_record.test_access_flags, '{}'::jsonb),
    now()
  );

  if not workspace_allowed then
    update public.whatsapp_cloud_webhook_receipts as receipt
       set status = 'cancelled',
           lease_token = null,
           lease_until = null,
           conversation_message_id = null,
           last_error_code = null,
           updated_at = now()
     where receipt.id = p_receipt_id
       and receipt.workspace_id = p_workspace_id
       and receipt.social_connection_id = p_social_connection_id
       and receipt.status = 'processing'
       and receipt.lease_token = p_lease_token;
    return query select null::uuid, 'processing_blocked'::text;
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_social_connection_id::text || ':whatsapp-message:' ||
      normalized_phone_number_id || ':' || normalized_message_id,
      0
    )
  );

  select message.id, message.whatsapp_payload_fingerprint
    into stored_message_id, stored_message_fingerprint
    from public.conversation_messages as message
   where message.workspace_id = p_workspace_id
     and message.source_platform = 'whatsapp'
     and message.whatsapp_social_connection_id = p_social_connection_id
     and message.whatsapp_phone_number_id = normalized_phone_number_id
     and message.external_message_id = normalized_message_id
   order by message.created_at asc, message.id asc
   limit 1;
  if stored_message_id is not null then
    if stored_message_fingerprint is distinct from
       normalized_payload_fingerprint then
      return query select null::uuid, 'conflict'::text;
      return;
    end if;
    update public.whatsapp_cloud_webhook_receipts as receipt
       set status = 'stored',
           lease_token = null,
           lease_until = null,
           conversation_message_id = stored_message_id,
           last_error_code = null,
           updated_at = now()
     where receipt.id = claimed_receipt.id;
    return query select stored_message_id, 'duplicate'::text;
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_social_connection_id::text || ':whatsapp-thread:' ||
      connection_bound_thread_id,
      0
    )
  );

  select conversation.contact_id, conversation.id
    into target_contact_id, target_conversation_id
    from public.conversations as conversation
     where conversation.workspace_id = p_workspace_id
       and conversation.source_platform = 'whatsapp'
       and conversation.external_thread_id = connection_bound_thread_id
   order by conversation.updated_at desc, conversation.id asc
   limit 1;

  if target_contact_id is null then
    select contact.id
      into target_contact_id
      from public.contacts as contact
     where contact.workspace_id = p_workspace_id
       and contact.source_platform = 'whatsapp'
       and contact.handle = connection_bound_contact_handle
     order by contact.updated_at desc, contact.id asc
     limit 1;
  end if;

  if target_contact_id is null then
    insert into public.contacts (
      workspace_id,
      display_name,
      handle,
      source_platform,
      language,
      status,
      tags,
      summary
    ) values (
      p_workspace_id,
      normalized_author_label,
      connection_bound_contact_handle,
      'whatsapp',
      'de',
      'new',
      array['whatsapp']::text[],
      'Automatisch aus einem eingehenden WhatsApp-Cloud-Webhook angelegt.'
    )
    returning id into target_contact_id;
  end if;

  if target_conversation_id is null then
    select conversation.id
      into target_conversation_id
      from public.conversations as conversation
     where conversation.workspace_id = p_workspace_id
       and conversation.contact_id = target_contact_id
       and conversation.source_platform = 'whatsapp'
       and conversation.external_thread_id = connection_bound_thread_id
     order by conversation.updated_at desc, conversation.id asc
     limit 1;
  end if;

  if target_conversation_id is null then
    insert into public.conversations (
      workspace_id,
      contact_id,
      status,
      priority,
      source_platform,
      source_type,
      external_thread_id,
      external_message_id,
      last_inbound_at,
      last_message_preview,
      ai_status,
      next_step
    ) values (
      p_workspace_id,
      target_contact_id,
      'open',
      'normal',
      'whatsapp',
      'whatsapp_messages',
      connection_bound_thread_id,
      normalized_message_id,
      p_received_at,
      left(normalized_content, 240),
      'partial',
      'Antwort vorbereiten'
    )
    returning id into target_conversation_id;
  end if;

  insert into public.conversation_messages (
    workspace_id,
    conversation_id,
    contact_id,
    direction,
    message_type,
    source_platform,
    source_type,
    external_thread_id,
    external_message_id,
    original_author_label,
    original_text_excerpt,
    author_label,
    content,
    attachments,
    message_kind,
    whatsapp_social_connection_id,
    whatsapp_phone_number_id,
    whatsapp_payload_fingerprint,
    created_at,
    seen_at
  ) values (
    p_workspace_id,
    target_conversation_id,
    target_contact_id,
    'inbound',
    'dm',
    'whatsapp',
    'whatsapp_messages',
    connection_bound_thread_id,
    normalized_message_id,
    normalized_author_label,
    left(normalized_content, 500),
    normalized_author_label,
    normalized_content,
    null,
    'text',
    p_social_connection_id,
    normalized_phone_number_id,
    normalized_payload_fingerprint,
    p_received_at,
    null
  )
  returning id into stored_message_id;

  update public.conversations as conversation
     set status = 'open',
         source_platform = 'whatsapp',
         source_type = 'whatsapp_messages',
         external_thread_id = connection_bound_thread_id,
         external_message_id = case
           when conversation.last_inbound_at is null
             or p_received_at >= conversation.last_inbound_at
           then normalized_message_id
           else conversation.external_message_id
         end,
         last_inbound_at = greatest(
           coalesce(conversation.last_inbound_at, p_received_at),
           p_received_at
         ),
         last_message_preview = case
           when conversation.last_inbound_at is null
             or p_received_at >= conversation.last_inbound_at
           then left(normalized_content, 240)
           else conversation.last_message_preview
         end,
         ai_status = 'partial',
         next_step = 'Antwort vorbereiten',
         updated_at = case
           when conversation.last_inbound_at is null
             or p_received_at >= conversation.last_inbound_at
           then now()
           else conversation.updated_at
         end
   where conversation.id = target_conversation_id
     and conversation.workspace_id = p_workspace_id;

  update public.social_connections as connection
     set last_event_at = now(),
         updated_at = now()
   where connection.id = p_social_connection_id
     and connection.workspace_id = p_workspace_id;

  update public.whatsapp_cloud_webhook_receipts as receipt
     set status = 'stored',
         lease_token = null,
         lease_until = null,
         conversation_message_id = stored_message_id,
         last_error_code = null,
         updated_at = now()
   where receipt.id = claimed_receipt.id;

  return query select stored_message_id, 'stored'::text;
end
$function$;

create function public.disconnect_whatsapp_cloud_inbound_connection(
  p_workspace_id uuid,
  p_social_connection_id uuid
)
returns table (disconnected boolean)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  affected integer := 0;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  update public.social_connections as connection
     set status = 'disconnected',
         disconnected_at = now(),
         page_access_token_encrypted = null,
         token_last_four = null,
         webhook_subscribed = false,
         analytics_enabled = false,
         updated_at = now()
   where connection.id = p_social_connection_id
     and connection.workspace_id = p_workspace_id
     and connection.platform = 'whatsapp'
     and connection.provider = 'meta_whatsapp_cloud'
     and connection.status = 'connected';
  get diagnostics affected = row_count;

  if affected = 1 then
    update public.whatsapp_cloud_webhook_receipts as receipt
       set status = 'cancelled',
           lease_token = null,
           lease_until = null,
           conversation_message_id = null,
           last_error_code = null,
           updated_at = now()
     where receipt.workspace_id = p_workspace_id
       and receipt.social_connection_id = p_social_connection_id
       and receipt.status in ('processing', 'retryable_error');
  end if;

  return query select affected = 1;
end
$function$;

revoke all on function public.whatsapp_cloud_inbound_schema_state()
  from public, anon, authenticated, service_role;
revoke all on function public.claim_whatsapp_cloud_inbound_message(uuid, uuid, text, text, text, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.store_whatsapp_cloud_inbound_message(uuid, uuid, uuid, uuid, text, text, text, text, text, text, timestamptz, text)
  from public, anon, authenticated, service_role;
revoke all on function public.disconnect_whatsapp_cloud_inbound_connection(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.protect_whatsapp_cloud_message_identity()
  from public, anon, authenticated, service_role;

grant execute on function public.whatsapp_cloud_inbound_schema_state()
  to service_role;
grant execute on function public.claim_whatsapp_cloud_inbound_message(uuid, uuid, text, text, text, integer)
  to service_role;
grant execute on function public.store_whatsapp_cloud_inbound_message(uuid, uuid, uuid, uuid, text, text, text, text, text, text, timestamptz, text)
  to service_role;
grant execute on function public.disconnect_whatsapp_cloud_inbound_connection(uuid, uuid)
  to service_role;
grant execute on function public.protect_whatsapp_cloud_message_identity()
  to service_role;

do $function_attestation$
declare
  function_record record;
  canonical_definition text;
  attestation text;
begin
  for function_record in
    select function_definition.*,
           function_language.lanname,
           format(
             '%I.%I(%s)',
             function_namespace.nspname,
             function_definition.proname,
             pg_get_function_identity_arguments(function_definition.oid)
           ) as signature
      from pg_proc as function_definition
      join pg_namespace as function_namespace
        on function_namespace.oid = function_definition.pronamespace
      join pg_language as function_language
        on function_language.oid = function_definition.prolang
     where function_namespace.nspname = 'public'
       and function_definition.proname in (
         'whatsapp_cloud_inbound_schema_state',
       'claim_whatsapp_cloud_inbound_message',
       'store_whatsapp_cloud_inbound_message',
       'disconnect_whatsapp_cloud_inbound_connection',
       'protect_whatsapp_cloud_message_identity'
       )
  loop
    canonical_definition := concat_ws(
      '|',
      function_record.signature,
      function_record.lanname,
      function_record.proowner::text,
      function_record.prokind::text,
      function_record.provolatile::text,
      function_record.proparallel::text,
      function_record.prosecdef::text,
      function_record.proretset::text,
      function_record.proisstrict::text,
      function_record.proleakproof::text,
      function_record.procost::text,
      function_record.prorows::text,
      function_record.prosupport::text,
      function_record.provariadic::text,
      coalesce(function_record.protrftypes::text, '<null>'),
      coalesce(function_record.probin, '<null>'),
      coalesce(function_record.prosqlbody::text, '<null>'),
      function_record.prorettype::text,
      function_record.proargtypes::text,
      coalesce(function_record.proallargtypes::text, '<null>'),
      coalesce(function_record.proargmodes::text, '<null>'),
      coalesce(function_record.proargnames::text, '<null>'),
      function_record.pronargs::text,
      function_record.pronargdefaults::text,
      coalesce(pg_get_expr(function_record.proargdefaults, 0), '<null>'),
      coalesce(function_record.proconfig::text, '<null>'),
      function_record.prosrc,
      coalesce(function_record.proacl::text, '<null>')
    );
    attestation := 'fanmind-whatsapp:v1:sha256:' || pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(canonical_definition, 'UTF8')
      ),
      'hex'
    );
    execute format(
      'comment on function %s is %L',
      function_record.signature,
      attestation
    );
  end loop;
end
$function_attestation$;

commit;
