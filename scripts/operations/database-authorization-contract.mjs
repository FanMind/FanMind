#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

const SCHEMA_VERSION = 2;
const CANONICALIZATION = "postgresql-17-acl-json-array-hex-v2";
const SHA256 = /^[0-9a-f]{64}$/u;
const SNAPSHOT_ID = /^[0-9A-F]{8}-[0-9A-F]{8}-[1-9][0-9]*$/u;
const SAFE_ROLE = /^[^\u0000-\u001f\u007f]{1,63}$/u;
const SAFE_TOC_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_$-]{0,62}$/u;
const SAFE_EXTENSION_VERSION = /^[^\s\u0000-\u001f\u007f]{1,128}$/u;
const MAX_ROLE_BYTES = 63;
const MAX_REQUIRED_ROLES = 4096;
const MAX_REQUIRED_EXTENSIONS = 256;
const MAX_EXTENSION_VERSION_BYTES = 128;
const MAX_RECORD_COUNT = 1_000_000;
const MAX_ROLE_RECORD_COUNT = 100_000;
const MAX_DATABASE_CONTAINER_RECORD_COUNT = 100_000;
const MAX_EXTENSION_RECORD_COUNT = 100_000;
const MAX_GRANT_TUPLE_COUNT = 20_000_000;
const MAX_PROCESS_OUTPUT_BYTES = 256 * 1024;
const INITIAL_QUERY_TIMEOUT_MS = 60_000;
const CLOSE_TIMEOUT_MS = 10_000;
const CORE_TABLE_APP_GRANT_TUPLE_COUNT = 120;
const RESTRICTED_SECURITY_DEFINER_FUNCTION_COUNT = 12;
const MAX_RECEIPT_BYTES = 16 * 1024;
const COMMIT = /^[0-9a-f]{40}$/u;
const FULL_BACKUP_BASENAME = /^fanmind-full-\d{13}\.tar\.gz\.age$/u;
const FULL_RECEIPT_V2_KEYS = Object.freeze([
  "schemaVersion",
  "createdAt",
  "sourceArtifactBasename",
  "outerSha256",
  "productionCommit",
  "databasePartEncryptedSha256",
  "databaseDumpSha256",
  "databaseAuthorizationContractVersion",
  "databaseAuthorizationFingerprintSha256",
  "databaseAuthorizationRecordCount",
  "databaseAuthorizationGrantTupleCount",
  "databaseAuthorizationRequiredRoles",
  "databaseAuthorizationRequiredRolesSha256",
  "databaseAuthorizationRoleFingerprintSha256",
  "databaseAuthorizationRoleRecordCount",
  "databaseAuthorizationContainerFingerprintSha256",
  "databaseAuthorizationContainerRecordCount",
  "databaseAuthorizationRequiredExtensions",
  "databaseAuthorizationRequiredExtensionsSha256",
  "databaseAuthorizationExtensionFingerprintSha256",
  "databaseAuthorizationExtensionRecordCount",
  "databaseCoreTableAppGrantTupleCount",
  "databaseRestrictedSecurityDefinerFunctionCount",
  "databaseAclTocEntryCount",
  "databaseDefaultAclTocEntryCount",
  "databaseAclTocSha256",
  "databasePrivilegesArchived",
  "databaseOwnershipArchived",
  "verifier",
].sort());

const PSQL_ARGS = Object.freeze([
  "--no-psqlrc",
  "--no-align",
  "--tuples-only",
  "--quiet",
  "--set",
  "ON_ERROR_STOP=1",
  "--no-password",
]);
const ALLOWED_LIBPQ_ENVIRONMENT = Object.freeze([
  "PGPASSFILE",
  "PGSSLMODE",
  "PGSSLROOTCERT",
  "PGGSSENCMODE",
  "PGCONNECT_TIMEOUT",
]);

const DATABASE_CONTAINER_CTES_SQL = String.raw`
current_database_definition as (
  select
    database_definition.oid,
    database_definition.datdba,
    database_definition.encoding,
    database_definition.datlocprovider,
    database_definition.datcollate,
    database_definition.datctype,
    database_definition.datlocale,
    database_definition.daticurules,
    database_definition.datcollversion,
    pg_catalog.pg_database_collation_actual_version(
      database_definition.oid
    ) as actual_collversion,
    database_definition.dattablespace,
    database_definition.datconnlimit,
    database_definition.datallowconn,
    database_definition.datistemplate,
    database_definition.datacl
  from pg_catalog.pg_database as database_definition
  where database_definition.datname = pg_catalog.current_database()
),
current_database_acl as (
  select
    privilege.grantee as grantee_oid,
    privilege.grantor as grantor_oid,
    case
      when privilege.grantee = 0 then 'PUBLIC'
      else grantee_role.rolname
    end as grantee_name,
    grantor_role.rolname as grantor_name,
    privilege.privilege_type,
    privilege.is_grantable
  from current_database_definition as database_definition
  cross join lateral pg_catalog.aclexplode(
    nullif(coalesce(
      database_definition.datacl,
      pg_catalog.acldefault('d'::"char", database_definition.datdba)
    ), '{}'::pg_catalog.aclitem[])
  ) as privilege
  left join pg_catalog.pg_roles as grantee_role
    on grantee_role.oid = privilege.grantee
   and privilege.grantee <> 0
  left join pg_catalog.pg_roles as grantor_role
    on grantor_role.oid = privilege.grantor
),
current_database_role_settings as (
  select
    setting.setrole as role_oid,
    case
      when setting.setrole = 0 then 'PUBLIC'
      else setting_role.rolname
    end as role_name,
    coalesce((
      select pg_catalog.jsonb_agg(
        configuration.setting
        order by configuration.setting collate "C"
      )
      from pg_catalog.unnest(setting.setconfig)
        as configuration(setting)
    ), '[]'::pg_catalog.jsonb) as settings
  from pg_catalog.pg_db_role_setting as setting
  join current_database_definition as database_definition
    on database_definition.oid = setting.setdatabase
  left join pg_catalog.pg_roles as setting_role
    on setting_role.oid = setting.setrole
   and setting.setrole <> 0
),
database_container_records as (
  select pg_catalog.encode(
    pg_catalog.convert_to(
      pg_catalog.jsonb_build_array(
        '${CANONICALIZATION}',
        'database_container',
        'profile',
        owner_role.rolname,
        pg_catalog.jsonb_build_array(
          pg_catalog.pg_encoding_to_char(database_definition.encoding),
          database_definition.datlocprovider::text,
          database_definition.datcollate,
          database_definition.datctype,
          database_definition.datlocale,
          database_definition.daticurules,
          database_definition.datcollversion,
          database_definition.actual_collversion,
          tablespace.spcname,
          database_definition.datconnlimit,
          database_definition.datallowconn,
          database_definition.datistemplate
        )
      )::text,
      'UTF8'
    ),
    'hex'
  ) as record_hex
  from current_database_definition as database_definition
  left join pg_catalog.pg_roles as owner_role
    on owner_role.oid = database_definition.datdba
  left join pg_catalog.pg_tablespace as tablespace
    on tablespace.oid = database_definition.dattablespace

  union all

  select pg_catalog.encode(
    pg_catalog.convert_to(
      pg_catalog.jsonb_build_array(
        '${CANONICALIZATION}',
        'database_container',
        'acl',
        database_acl.grantee_name,
        database_acl.grantor_name,
        database_acl.privilege_type,
        database_acl.is_grantable
      )::text,
      'UTF8'
    ),
    'hex'
  ) as record_hex
  from current_database_acl as database_acl

  union all

  select pg_catalog.encode(
    pg_catalog.convert_to(
      pg_catalog.jsonb_build_array(
        '${CANONICALIZATION}',
        'database_container',
        'role_setting',
        role_setting.role_name,
        role_setting.settings
      )::text,
      'UTF8'
    ),
    'hex'
  ) as record_hex
  from current_database_role_settings as role_setting
),
database_container_payload as (
  select
    count(*)::integer as record_count,
    coalesce(
      pg_catalog.string_agg(
        record_hex,
        E'\n'
        order by record_hex collate "C"
      ) || E'\n',
      ''
    ) as payload_text
  from database_container_records
),
database_container_invariants as (
  select count(*)::integer as violation_count
  from current_database_definition as database_definition
  where database_definition.actual_collversion is distinct from
        database_definition.datcollversion
)`;

/*
 * This is the package-level extension contract that can be proved before a
 * restore.  Current ACL deltas remain part of the main authorization
 * fingerprint; this payload binds the installed package baseline that those
 * pg_dump ACL statements assume: exact extension metadata, configuration
 * table addresses/conditions, member identities, member owners and initial
 * privileges from pg_init_privs.
 */
const EXTENSION_CONTRACT_CTES_SQL = String.raw`
extension_contract_extensions as (
  select
    extension.oid,
    extension.extname,
    extension.extversion,
    extension.extnamespace,
    namespace.nspname as schema_name,
    namespace.nspowner as schema_owner_oid,
    schema_owner.rolname as schema_owner_name,
    extension.extowner,
    owner_role.rolname as owner_name,
    extension.extrelocatable,
    extension.extconfig,
    extension.extcondition,
    (
      namespace.nspname <> 'public'
      and namespace.nspname <> 'information_schema'
      and namespace.nspname !~ '^pg_'
      and not exists (
        select 1
        from pg_catalog.pg_depend as schema_dependency
        where schema_dependency.classid =
              'pg_catalog.pg_namespace'::pg_catalog.regclass
          and schema_dependency.objid = namespace.oid
          and schema_dependency.objsubid = 0
          and schema_dependency.refclassid =
              'pg_catalog.pg_extension'::pg_catalog.regclass
          and schema_dependency.deptype = 'e'
      )
    ) as schema_definition_archived
  from pg_catalog.pg_extension as extension
  left join pg_catalog.pg_namespace as namespace
    on namespace.oid = extension.extnamespace
  left join pg_catalog.pg_roles as owner_role
    on owner_role.oid = extension.extowner
  left join pg_catalog.pg_roles as schema_owner
    on schema_owner.oid = namespace.nspowner
),
extension_contract_direct_members as (
  select
    extension.extname,
    dependency.classid,
    dependency.objid,
    dependency.objsubid
  from extension_contract_extensions as extension
  join pg_catalog.pg_depend as dependency
    on dependency.refclassid =
       'pg_catalog.pg_extension'::pg_catalog.regclass
   and dependency.refobjid = extension.oid
   and dependency.deptype = 'e'
),
extension_contract_member_addresses(
  extname,
  classid,
  objid,
  objsubid
) as (
  select
    direct_member.extname,
    direct_member.classid,
    direct_member.objid,
    direct_member.objsubid
  from extension_contract_direct_members as direct_member

  union

  select
    parent_member.extname,
    derived_dependency.classid,
    derived_dependency.objid,
    derived_dependency.objsubid
  from extension_contract_member_addresses as parent_member
  join pg_catalog.pg_depend as derived_dependency
    on derived_dependency.refclassid = parent_member.classid
   and derived_dependency.refobjid = parent_member.objid
   and (
     parent_member.objsubid = 0
     or derived_dependency.refobjsubid = parent_member.objsubid
   )
   and derived_dependency.deptype in ('i', 'a', 'P', 'S')
),
extension_contract_members as (
  select
    member_address.extname,
    member_address.classid,
    member_address.objid,
    member_address.objsubid,
    exists (
      select 1
      from extension_contract_direct_members as direct_member
      where direct_member.extname = member_address.extname
        and direct_member.classid = member_address.classid
        and direct_member.objid = member_address.objid
        and direct_member.objsubid = member_address.objsubid
    ) as direct_member,
    class_namespace.nspname as catalog_schema_name,
    class_relation.relname as catalog_name,
    identified.object_type,
    case
      when toast_parent.oid is not null then toast_parent_namespace.nspname
      when toast_index_parent.oid is not null
        then toast_index_parent_namespace.nspname
      else identified.schema_name
    end as schema_name,
    case
      when toast_parent.oid is not null then '<toast-table>'
      when toast_index_parent.oid is not null then '<toast-index>'
      else identified.object_name
    end as object_name,
    case
      when toast_parent.oid is not null then
        'toast table for ' ||
        pg_catalog.quote_ident(toast_parent_namespace.nspname) || '.' ||
        pg_catalog.quote_ident(toast_parent.relname)
      when toast_index_parent.oid is not null then
        'toast index for ' ||
        pg_catalog.quote_ident(toast_index_parent_namespace.nspname) || '.' ||
        pg_catalog.quote_ident(toast_index_parent.relname)
      else identified.object_identity
    end as object_identity,
    case
      when toast_parent.oid is not null then
        pg_catalog.jsonb_build_object(
          'kind', 'toast_table',
          'parentSchema', toast_parent_namespace.nspname,
          'parentName', toast_parent.relname,
          'persistence', member_relation.relpersistence::text,
          'accessMethod', toast_access_method.amname,
          'options', coalesce(pg_catalog.to_jsonb(member_relation.reloptions),
            '[]'::pg_catalog.jsonb),
          'columns', coalesce((
            select pg_catalog.jsonb_agg(
              pg_catalog.jsonb_build_object(
                'number', attribute.attnum,
                'name', attribute.attname,
                'type', pg_catalog.format_type(
                  attribute.atttypid,
                  attribute.atttypmod
                ),
                'notNull', attribute.attnotnull,
                'storage', attribute.attstorage::text,
                'compression', attribute.attcompression::text
              )
              order by attribute.attnum
            )
            from pg_catalog.pg_attribute as attribute
            where attribute.attrelid = member_relation.oid
              and attribute.attnum > 0
              and not attribute.attisdropped
          ), '[]'::pg_catalog.jsonb)
        )
      when toast_index_parent.oid is not null then
        pg_catalog.jsonb_build_object(
          'kind', 'toast_index',
          'parentSchema', toast_index_parent_namespace.nspname,
          'parentName', toast_index_parent.relname,
          'unique', toast_index.indisunique,
          'primary', toast_index.indisprimary,
          'valid', toast_index.indisvalid,
          'ready', toast_index.indisready,
          'live', toast_index.indislive,
          'keyAttributeCount', toast_index.indnkeyatts,
          'attributeCount', toast_index.indnatts,
          'attributeNumbers', toast_index.indkey::text,
          'accessMethod', toast_index_access_method.amname,
          'operatorClasses', coalesce((
            select pg_catalog.jsonb_agg(
              pg_catalog.jsonb_build_array(
                operator_namespace.nspname,
                operator_class.opcname
              )
              order by operator_position.ordinal
            )
            from pg_catalog.unnest(
              toast_index.indclass::pg_catalog.oid[]
            )
              with ordinality as operator_position(opclass_oid, ordinal)
            join pg_catalog.pg_opclass as operator_class
              on operator_class.oid = operator_position.opclass_oid
            join pg_catalog.pg_namespace as operator_namespace
              on operator_namespace.oid = operator_class.opcnamespace
          ), '[]'::pg_catalog.jsonb)
        )
      when member_address.classid =
           'pg_catalog.pg_proc'::pg_catalog.regclass then (
        select pg_catalog.jsonb_build_object(
          'definition', pg_catalog.pg_get_functiondef(object.oid),
          'kind', object.prokind::text,
          'securityDefiner', object.prosecdef,
          'leakproof', object.proleakproof,
          'strict', object.proisstrict,
          'returnsSet', object.proretset,
          'volatility', object.provolatile::text,
          'parallel', object.proparallel::text,
          'argumentCount', object.pronargs,
          'defaultArgumentCount', object.pronargdefaults,
          'returnType', pg_catalog.format_type(object.prorettype, null),
          'source', object.prosrc,
          'binary', object.probin,
          'configuration', coalesce(pg_catalog.to_jsonb(object.proconfig),
            '[]'::pg_catalog.jsonb),
          'cost', object.procost,
          'rows', object.prorows,
          'supportFunction', case
            when object.prosupport = 0 then null
            else object.prosupport::pg_catalog.regprocedure::text
          end
        )
        from pg_catalog.pg_proc as object
        where object.oid = member_address.objid
      )
      when member_address.classid =
           'pg_catalog.pg_class'::pg_catalog.regclass then (
        select pg_catalog.jsonb_build_object(
          'kind', object.relkind::text,
          'persistence', object.relpersistence::text,
          'isPartition', object.relispartition,
          'rowSecurity', object.relrowsecurity,
          'forceRowSecurity', object.relforcerowsecurity,
          'replicaIdentity', object.relreplident::text,
          'accessMethod', access_method.amname,
          'options', coalesce(pg_catalog.to_jsonb(object.reloptions),
            '[]'::pg_catalog.jsonb),
          'hasToast', object.reltoastrelid <> 0,
          'indexDefinition', case
            when object.relkind in ('i', 'I')
              then pg_catalog.pg_get_indexdef(object.oid)
            else null
          end,
          'viewDefinition', case
            when object.relkind in ('v', 'm')
              then pg_catalog.pg_get_viewdef(object.oid, false)
            else null
          end,
          'partitionBound', case
            when object.relispartition
              then pg_catalog.pg_get_expr(object.relpartbound, object.oid, false)
            else null
          end,
          'columns', coalesce((
            select pg_catalog.jsonb_agg(
              pg_catalog.jsonb_build_object(
                'number', attribute.attnum,
                'name', attribute.attname,
                'type', pg_catalog.format_type(
                  attribute.atttypid,
                  attribute.atttypmod
                ),
                'notNull', attribute.attnotnull,
                'hasDefault', attribute.atthasdef,
                'identity', attribute.attidentity::text,
                'generated', attribute.attgenerated::text,
                'collation', case
                  when attribute.attcollation = 0 then null
                  else pg_catalog.concat_ws('.',
                    pg_catalog.quote_ident(collation_namespace.nspname),
                    pg_catalog.quote_ident(collation_definition.collname)
                  )
                end,
                'storage', attribute.attstorage::text,
                'compression', attribute.attcompression::text,
                'statisticsTarget', attribute.attstattarget,
                'options', coalesce(pg_catalog.to_jsonb(attribute.attoptions),
                  '[]'::pg_catalog.jsonb)
              )
              order by attribute.attnum
            )
            from pg_catalog.pg_attribute as attribute
            left join pg_catalog.pg_collation as collation_definition
              on collation_definition.oid = attribute.attcollation
             and attribute.attcollation <> 0
            left join pg_catalog.pg_namespace as collation_namespace
              on collation_namespace.oid =
                 collation_definition.collnamespace
            where attribute.attrelid = object.oid
              and attribute.attnum > 0
              and not attribute.attisdropped
          ), '[]'::pg_catalog.jsonb),
          'sequence', case
            when object.relkind = 'S' then (
              select pg_catalog.jsonb_build_object(
                'type', pg_catalog.format_type(sequence.seqtypid, null),
                'start', sequence.seqstart,
                'increment', sequence.seqincrement,
                'maximum', sequence.seqmax,
                'minimum', sequence.seqmin,
                'cache', sequence.seqcache,
                'cycle', sequence.seqcycle
              )
              from pg_catalog.pg_sequence as sequence
              where sequence.seqrelid = object.oid
            )
            else null
          end
        )
        from pg_catalog.pg_class as object
        left join pg_catalog.pg_am as access_method
          on access_method.oid = object.relam
        where object.oid = member_address.objid
      )
      when member_address.classid =
           'pg_catalog.pg_type'::pg_catalog.regclass then (
        select pg_catalog.jsonb_build_object(
          'kind', object.typtype::text,
          'category', object.typcategory::text,
          'preferred', object.typispreferred,
          'defined', object.typisdefined,
          'delimiter', object.typdelim::text,
          'length', object.typlen,
          'byValue', object.typbyval,
          'alignment', object.typalign::text,
          'storage', object.typstorage::text,
          'notNull', object.typnotnull,
          'baseType', case
            when object.typbasetype = 0 then null
            else pg_catalog.format_type(object.typbasetype, null)
          end,
          'typeModifier', object.typtypmod,
          'dimensions', object.typndims,
          'collation', case
            when object.typcollation = 0 then null
            else pg_catalog.concat_ws('.',
              pg_catalog.quote_ident(type_collation_namespace.nspname),
              pg_catalog.quote_ident(type_collation.collname)
            )
          end,
          'elementType', case
            when object.typelem = 0 then null
            else pg_catalog.format_type(object.typelem, null)
          end,
          'arrayType', case
            when object.typarray = 0 then null
            else pg_catalog.format_type(object.typarray, null)
          end,
          'relation', case
            when object.typrelid = 0 then null
            else type_relation_identity.object_identity
          end,
          'input', object.typinput::pg_catalog.regprocedure::text,
          'output', object.typoutput::pg_catalog.regprocedure::text,
          'receive', case when object.typreceive = 0 then null
            else object.typreceive::pg_catalog.regprocedure::text end,
          'send', case when object.typsend = 0 then null
            else object.typsend::pg_catalog.regprocedure::text end,
          'modifierInput', case when object.typmodin = 0 then null
            else object.typmodin::pg_catalog.regprocedure::text end,
          'modifierOutput', case when object.typmodout = 0 then null
            else object.typmodout::pg_catalog.regprocedure::text end,
          'analyze', case when object.typanalyze = 0 then null
            else object.typanalyze::pg_catalog.regprocedure::text end,
          'subscript', case when object.typsubscript = 0 then null
            else object.typsubscript::pg_catalog.regprocedure::text end,
          'defaultBinary', case
            when object.typdefaultbin is null then null
            else pg_catalog.pg_get_expr(object.typdefaultbin, 0, false)
          end,
          'defaultText', object.typdefault,
          'enumLabels', coalesce((
            select pg_catalog.jsonb_agg(enum.enumlabel order by enum.enumsortorder)
            from pg_catalog.pg_enum as enum
            where enum.enumtypid = object.oid
          ), '[]'::pg_catalog.jsonb),
          'range', (
            select pg_catalog.jsonb_build_object(
              'subtype', pg_catalog.format_type(range.rngsubtype, null),
              'collation', case when range.rngcollation = 0 then null
                else range.rngcollation::pg_catalog.regcollation::text end,
              'operatorClass', pg_catalog.concat_ws('.',
                pg_catalog.quote_ident(range_operator_namespace.nspname),
                pg_catalog.quote_ident(range_operator_class.opcname)
              ),
              'canonical', case when range.rngcanonical = 0 then null
                else range.rngcanonical::pg_catalog.regprocedure::text end,
              'subtypeDifference', case when range.rngsubdiff = 0 then null
                else range.rngsubdiff::pg_catalog.regprocedure::text end,
              'multirangeType', pg_catalog.format_type(
                range.rngmultitypid,
                null
              )
            )
            from pg_catalog.pg_range as range
            join pg_catalog.pg_opclass as range_operator_class
              on range_operator_class.oid = range.rngsubopc
            join pg_catalog.pg_namespace as range_operator_namespace
              on range_operator_namespace.oid =
                 range_operator_class.opcnamespace
            where range.rngtypid = object.oid
          )
        )
        from pg_catalog.pg_type as object
        left join pg_catalog.pg_collation as type_collation
          on type_collation.oid = object.typcollation
         and object.typcollation <> 0
        left join pg_catalog.pg_namespace as type_collation_namespace
          on type_collation_namespace.oid = type_collation.collnamespace
        left join lateral pg_catalog.pg_identify_object(
          'pg_catalog.pg_class'::pg_catalog.regclass,
          object.typrelid,
          0
        ) as type_relation_identity(
          object_type,
          schema_name,
          object_name,
          object_identity
        ) on object.typrelid <> 0
        where object.oid = member_address.objid
      )
      when member_address.classid =
           'pg_catalog.pg_language'::pg_catalog.regclass then (
        select pg_catalog.jsonb_build_object(
          'isProcedural', object.lanispl,
          'trusted', object.lanpltrusted,
          'callHandler', object.lanplcallfoid::pg_catalog.regprocedure::text,
          'inlineHandler', case when object.laninline = 0 then null
            else object.laninline::pg_catalog.regprocedure::text end,
          'validator', case when object.lanvalidator = 0 then null
            else object.lanvalidator::pg_catalog.regprocedure::text end
        )
        from pg_catalog.pg_language as object
        where object.oid = member_address.objid
      )
      when member_address.classid =
           'pg_catalog.pg_attrdef'::pg_catalog.regclass then (
        select pg_catalog.to_jsonb(pg_catalog.pg_get_expr(
          object.adbin,
          object.adrelid,
          false
        ))
        from pg_catalog.pg_attrdef as object
        where object.oid = member_address.objid
      )
      when member_address.classid =
           'pg_catalog.pg_constraint'::pg_catalog.regclass then (
        select pg_catalog.jsonb_build_object(
          'definition', pg_catalog.pg_get_constraintdef(object.oid, false),
          'validated', object.convalidated,
          'deferrable', object.condeferrable,
          'initiallyDeferred', object.condeferred
        )
        from pg_catalog.pg_constraint as object
        where object.oid = member_address.objid
      )
      when member_address.classid =
           'pg_catalog.pg_rewrite'::pg_catalog.regclass then (
        select pg_catalog.to_jsonb(pg_catalog.pg_get_ruledef(object.oid, false))
        from pg_catalog.pg_rewrite as object
        where object.oid = member_address.objid
      )
      when member_address.classid =
           'pg_catalog.pg_trigger'::pg_catalog.regclass then (
        select pg_catalog.to_jsonb(pg_catalog.pg_get_triggerdef(object.oid, false))
        from pg_catalog.pg_trigger as object
        where object.oid = member_address.objid
      )
      else null::pg_catalog.jsonb
    end as object_definition,
    case member_address.classid
      when 'pg_catalog.pg_namespace'::pg_catalog.regclass then (
        select object.nspowner from pg_catalog.pg_namespace as object
        where object.oid = member_address.objid
      )
      when 'pg_catalog.pg_class'::pg_catalog.regclass then (
        select object.relowner from pg_catalog.pg_class as object
        where object.oid = member_address.objid
      )
      when 'pg_catalog.pg_proc'::pg_catalog.regclass then (
        select object.proowner from pg_catalog.pg_proc as object
        where object.oid = member_address.objid
      )
      when 'pg_catalog.pg_type'::pg_catalog.regclass then (
        select object.typowner from pg_catalog.pg_type as object
        where object.oid = member_address.objid
      )
      when 'pg_catalog.pg_collation'::pg_catalog.regclass then (
        select object.collowner from pg_catalog.pg_collation as object
        where object.oid = member_address.objid
      )
      when 'pg_catalog.pg_conversion'::pg_catalog.regclass then (
        select object.conowner from pg_catalog.pg_conversion as object
        where object.oid = member_address.objid
      )
      when 'pg_catalog.pg_operator'::pg_catalog.regclass then (
        select object.oprowner from pg_catalog.pg_operator as object
        where object.oid = member_address.objid
      )
      when 'pg_catalog.pg_opclass'::pg_catalog.regclass then (
        select object.opcowner from pg_catalog.pg_opclass as object
        where object.oid = member_address.objid
      )
      when 'pg_catalog.pg_opfamily'::pg_catalog.regclass then (
        select object.opfowner from pg_catalog.pg_opfamily as object
        where object.oid = member_address.objid
      )
      when 'pg_catalog.pg_statistic_ext'::pg_catalog.regclass then (
        select object.stxowner from pg_catalog.pg_statistic_ext as object
        where object.oid = member_address.objid
      )
      when 'pg_catalog.pg_ts_config'::pg_catalog.regclass then (
        select object.cfgowner from pg_catalog.pg_ts_config as object
        where object.oid = member_address.objid
      )
      when 'pg_catalog.pg_ts_dict'::pg_catalog.regclass then (
        select object.dictowner from pg_catalog.pg_ts_dict as object
        where object.oid = member_address.objid
      )
      when 'pg_catalog.pg_language'::pg_catalog.regclass then (
        select object.lanowner from pg_catalog.pg_language as object
        where object.oid = member_address.objid
      )
      when 'pg_catalog.pg_foreign_data_wrapper'::pg_catalog.regclass then (
        select object.fdwowner from pg_catalog.pg_foreign_data_wrapper as object
        where object.oid = member_address.objid
      )
      when 'pg_catalog.pg_foreign_server'::pg_catalog.regclass then (
        select object.srvowner from pg_catalog.pg_foreign_server as object
        where object.oid = member_address.objid
      )
      when 'pg_catalog.pg_event_trigger'::pg_catalog.regclass then (
        select object.evtowner from pg_catalog.pg_event_trigger as object
        where object.oid = member_address.objid
      )
      when 'pg_catalog.pg_policy'::pg_catalog.regclass then (
        select relation.relowner
        from pg_catalog.pg_policy as object
        join pg_catalog.pg_class as relation
          on relation.oid = object.polrelid
        where object.oid = member_address.objid
      )
      when 'pg_catalog.pg_publication'::pg_catalog.regclass then (
        select object.pubowner from pg_catalog.pg_publication as object
        where object.oid = member_address.objid
      )
      else null::pg_catalog.oid
    end as owner_oid,
    member_address.classid in (
      'pg_catalog.pg_namespace'::pg_catalog.regclass,
      'pg_catalog.pg_class'::pg_catalog.regclass,
      'pg_catalog.pg_proc'::pg_catalog.regclass,
      'pg_catalog.pg_type'::pg_catalog.regclass,
      'pg_catalog.pg_collation'::pg_catalog.regclass,
      'pg_catalog.pg_conversion'::pg_catalog.regclass,
      'pg_catalog.pg_operator'::pg_catalog.regclass,
      'pg_catalog.pg_opclass'::pg_catalog.regclass,
      'pg_catalog.pg_opfamily'::pg_catalog.regclass,
      'pg_catalog.pg_statistic_ext'::pg_catalog.regclass,
      'pg_catalog.pg_ts_config'::pg_catalog.regclass,
      'pg_catalog.pg_ts_dict'::pg_catalog.regclass,
      'pg_catalog.pg_language'::pg_catalog.regclass,
      'pg_catalog.pg_foreign_data_wrapper'::pg_catalog.regclass,
      'pg_catalog.pg_foreign_server'::pg_catalog.regclass,
      'pg_catalog.pg_event_trigger'::pg_catalog.regclass,
      'pg_catalog.pg_policy'::pg_catalog.regclass,
      'pg_catalog.pg_publication'::pg_catalog.regclass
    ) as owner_required,
    member_address.classid in (
      'pg_catalog.pg_namespace'::pg_catalog.regclass,
      'pg_catalog.pg_class'::pg_catalog.regclass,
      'pg_catalog.pg_proc'::pg_catalog.regclass,
      'pg_catalog.pg_type'::pg_catalog.regclass,
      'pg_catalog.pg_cast'::pg_catalog.regclass,
      'pg_catalog.pg_collation'::pg_catalog.regclass,
      'pg_catalog.pg_conversion'::pg_catalog.regclass,
      'pg_catalog.pg_event_trigger'::pg_catalog.regclass,
      'pg_catalog.pg_foreign_data_wrapper'::pg_catalog.regclass,
      'pg_catalog.pg_foreign_server'::pg_catalog.regclass,
      'pg_catalog.pg_language'::pg_catalog.regclass,
      'pg_catalog.pg_operator'::pg_catalog.regclass,
      'pg_catalog.pg_opclass'::pg_catalog.regclass,
      'pg_catalog.pg_opfamily'::pg_catalog.regclass,
      'pg_catalog.pg_statistic_ext'::pg_catalog.regclass,
      'pg_catalog.pg_ts_config'::pg_catalog.regclass,
      'pg_catalog.pg_ts_dict'::pg_catalog.regclass,
      'pg_catalog.pg_ts_parser'::pg_catalog.regclass,
      'pg_catalog.pg_ts_template'::pg_catalog.regclass,
      'pg_catalog.pg_transform'::pg_catalog.regclass,
      'pg_catalog.pg_am'::pg_catalog.regclass,
      'pg_catalog.pg_policy'::pg_catalog.regclass,
      'pg_catalog.pg_publication'::pg_catalog.regclass,
      'pg_catalog.pg_publication_namespace'::pg_catalog.regclass,
      'pg_catalog.pg_publication_rel'::pg_catalog.regclass,
      'pg_catalog.pg_attrdef'::pg_catalog.regclass,
      'pg_catalog.pg_constraint'::pg_catalog.regclass,
      'pg_catalog.pg_rewrite'::pg_catalog.regclass,
      'pg_catalog.pg_trigger'::pg_catalog.regclass
    ) as supported_class,
    member_address.classid in (
      'pg_catalog.pg_proc'::pg_catalog.regclass,
      'pg_catalog.pg_class'::pg_catalog.regclass,
      'pg_catalog.pg_type'::pg_catalog.regclass,
      'pg_catalog.pg_language'::pg_catalog.regclass,
      'pg_catalog.pg_attrdef'::pg_catalog.regclass,
      'pg_catalog.pg_constraint'::pg_catalog.regclass,
      'pg_catalog.pg_rewrite'::pg_catalog.regclass,
      'pg_catalog.pg_trigger'::pg_catalog.regclass
    ) as definition_supported
  from extension_contract_member_addresses as member_address
  join pg_catalog.pg_class as class_relation
    on class_relation.oid = member_address.classid
  join pg_catalog.pg_namespace as class_namespace
    on class_namespace.oid = class_relation.relnamespace
  left join pg_catalog.pg_class as member_relation
    on member_address.classid = 'pg_catalog.pg_class'::pg_catalog.regclass
   and member_relation.oid = member_address.objid
  left join pg_catalog.pg_class as toast_parent
    on member_relation.relkind = 't'
   and toast_parent.reltoastrelid = member_relation.oid
  left join pg_catalog.pg_namespace as toast_parent_namespace
    on toast_parent_namespace.oid = toast_parent.relnamespace
  left join pg_catalog.pg_index as toast_index
    on member_relation.relkind in ('i', 'I')
   and toast_index.indexrelid = member_relation.oid
  left join pg_catalog.pg_class as toast_relation
    on toast_relation.oid = toast_index.indrelid
   and toast_relation.relkind = 't'
  left join pg_catalog.pg_class as toast_index_parent
    on toast_index_parent.reltoastrelid = toast_relation.oid
  left join pg_catalog.pg_namespace as toast_index_parent_namespace
    on toast_index_parent_namespace.oid = toast_index_parent.relnamespace
  left join pg_catalog.pg_am as toast_access_method
    on toast_access_method.oid = member_relation.relam
  left join pg_catalog.pg_am as toast_index_access_method
    on toast_index_access_method.oid = member_relation.relam
  cross join lateral pg_catalog.pg_identify_object(
    member_address.classid,
    member_address.objid,
    member_address.objsubid
  ) as identified(
    object_type,
    schema_name,
    object_name,
    object_identity
  )
),
extension_contract_member_materialized as (
  select
    member.*,
    owner_role.rolname as owner_name
  from extension_contract_members as member
  left join pg_catalog.pg_roles as owner_role
    on owner_role.oid = member.owner_oid
),
extension_contract_member_objects as (
  select distinct
    member.extname,
    member.classid,
    member.objid,
    member.catalog_schema_name,
    member.catalog_name
  from extension_contract_members as member
),
extension_contract_initial_privileges as (
  select
    member.extname,
    member.catalog_schema_name,
    member.catalog_name,
    initial_privileges.classoid,
    initial_privileges.objoid,
    initial_privileges.objsubid,
    initial_privileges.privtype,
    initial_privileges.initprivs,
    identified.object_type,
    identified.schema_name,
    identified.object_name,
    identified.object_identity,
    coalesce(initial_acl.entries, '[]'::pg_catalog.jsonb)
      as initial_acl_entries,
    coalesce(initial_acl.unresolved_role_count, 0)::integer
      as unresolved_initial_acl_role_count
  from extension_contract_member_objects as member
  join pg_catalog.pg_init_privs as initial_privileges
    on initial_privileges.classoid = member.classid
   and initial_privileges.objoid = member.objid
  cross join lateral pg_catalog.pg_identify_object(
    initial_privileges.classoid,
    initial_privileges.objoid,
    initial_privileges.objsubid
  ) as identified(
    object_type,
    schema_name,
    object_name,
    object_identity
  )
  left join lateral (
    select
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_array(
          case
            when privilege.grantee = 0 then 'PUBLIC'
            else grantee_role.rolname
          end,
          grantor_role.rolname,
          privilege.privilege_type,
          privilege.is_grantable
        )
        order by
          (case
            when privilege.grantee = 0 then 'PUBLIC'
            else grantee_role.rolname
          end) collate "C",
          grantor_role.rolname collate "C",
          privilege.privilege_type collate "C",
          privilege.is_grantable
      ) as entries,
      count(*) filter (
        where (privilege.grantee <> 0 and grantee_role.oid is null)
           or grantor_role.oid is null
      ) as unresolved_role_count
    from pg_catalog.aclexplode(
      nullif(initial_privileges.initprivs, '{}'::pg_catalog.aclitem[])
    ) as privilege
    left join pg_catalog.pg_roles as grantee_role
      on grantee_role.oid = privilege.grantee
     and privilege.grantee <> 0
    left join pg_catalog.pg_roles as grantor_role
      on grantor_role.oid = privilege.grantor
  ) as initial_acl on true
),
extension_contract_metadata_records as (
  select pg_catalog.encode(
    pg_catalog.convert_to(
      pg_catalog.jsonb_build_array(
        '${CANONICALIZATION}',
        'extension',
        extension.extname,
        extension.extversion,
        extension.schema_name,
        extension.schema_owner_name,
        extension.schema_definition_archived,
        extension.owner_name,
        extension.extrelocatable,
        extension.extconfig is null,
        extension.extcondition is null,
        coalesce(pg_catalog.cardinality(extension.extconfig), 0),
        coalesce(pg_catalog.cardinality(extension.extcondition), 0)
      )::text,
      'UTF8'
    ),
    'hex'
  ) as record_hex
  from extension_contract_extensions as extension
),
extension_contract_config_records as (
  select pg_catalog.encode(
    pg_catalog.convert_to(
      pg_catalog.jsonb_build_array(
        '${CANONICALIZATION}',
        'extension_config',
        extension.extname,
        configuration.ordinal,
        namespace.nspname,
        relation.relname,
        relation.relkind::text,
        extension.extcondition[configuration.ordinal]
      )::text,
      'UTF8'
    ),
    'hex'
  ) as record_hex,
  (namespace.oid is null or relation.oid is null) as unresolved
  from extension_contract_extensions as extension
  cross join lateral pg_catalog.generate_subscripts(
    extension.extconfig,
    1
  ) as configuration(ordinal)
  left join pg_catalog.pg_class as relation
    on relation.oid = extension.extconfig[configuration.ordinal]
  left join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
),
extension_contract_member_records as (
  select pg_catalog.encode(
    pg_catalog.convert_to(
      pg_catalog.jsonb_build_array(
        '${CANONICALIZATION}',
        'extension_member',
        member.extname,
        member.direct_member,
        member.catalog_schema_name,
        member.catalog_name,
        member.objsubid,
        member.object_type,
        member.schema_name,
        member.object_name,
        member.object_identity,
        member.owner_name,
        member.object_definition
      )::text,
      'UTF8'
    ),
    'hex'
  ) as record_hex
  from extension_contract_member_materialized as member
),
extension_contract_initial_privilege_records as (
  select pg_catalog.encode(
    pg_catalog.convert_to(
      pg_catalog.jsonb_build_array(
        '${CANONICALIZATION}',
        'extension_member_initial_acl',
        initial_privilege.extname,
        initial_privilege.catalog_schema_name,
        initial_privilege.catalog_name,
        initial_privilege.objsubid,
        initial_privilege.object_type,
        initial_privilege.schema_name,
        initial_privilege.object_name,
        initial_privilege.object_identity,
        initial_privilege.privtype::text,
        initial_privilege.initial_acl_entries
      )::text,
      'UTF8'
    ),
    'hex'
  ) as record_hex
  from extension_contract_initial_privileges as initial_privilege
),
extension_contract_records as (
  select record_hex from extension_contract_metadata_records
  union all
  select record_hex from extension_contract_config_records
  union all
  select record_hex from extension_contract_member_records
  union all
  select record_hex from extension_contract_initial_privilege_records
),
extension_contract_payload as (
  select
    count(*)::integer as record_count,
    coalesce(
      pg_catalog.string_agg(
        record_hex,
        E'\n'
        order by record_hex collate "C"
      ) || E'\n',
      ''
    ) as payload_text
  from extension_contract_records
),
required_extensions as (
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'name', extension.extname,
        'version', extension.extversion,
        'schema', extension.schema_name,
        'schemaOwner', extension.schema_owner_name,
        'schemaDefinitionArchived',
          extension.schema_definition_archived,
        'owner', extension.owner_name,
        'relocatable', extension.extrelocatable
      )
      order by extension.extname collate "C"
    ),
    '[]'::pg_catalog.jsonb
  ) as descriptors
  from extension_contract_extensions as extension
),
extension_contract_invariants as (
  select (
    (select count(*) from extension_contract_extensions as extension
      where extension.schema_name is null
         or extension.schema_owner_name is null
         or extension.owner_name is null
         or extension.extversion is null
         or pg_catalog.cardinality(extension.extconfig)
            is distinct from
            pg_catalog.cardinality(extension.extcondition))
    + (select count(*) from extension_contract_member_materialized as member
       where not member.supported_class
          or not member.definition_supported
          or (member.owner_required and member.owner_name is null)
          or member.object_type is null
          or member.object_identity is null
          or member.object_definition is null)
    + (select count(*)
       from (
         select member.classid, member.objid, member.objsubid
         from extension_contract_member_addresses as member
         group by member.classid, member.objid, member.objsubid
         having count(distinct member.extname) <> 1
       ) as multiply_claimed_member)
    + (select count(*) from extension_contract_initial_privileges
         as initial_privilege
       where initial_privilege.unresolved_initial_acl_role_count <> 0)
    + (select count(*) from extension_contract_config_records as configuration
       where configuration.unresolved)
  )::integer as violation_count,
  (
    select count(*)::integer
    from extension_contract_member_materialized as member
    where not member.supported_class
       or not member.definition_supported
  ) as unsupported_class_count
)`;

export const DATABASE_AUTHORIZATION_CONTRACT_SQL = String.raw`
with recursive
last_builtin as (
  /* PostgreSQL 17 FirstNormalObjectId is 16384, as used by pg_dump. */
  select 16383::pg_catalog.oid as last_builtin_oid
),
extension_members as (
  select dependency.classid, dependency.objid, dependency.objsubid
    from pg_catalog.pg_depend as dependency
   where dependency.refclassid = 'pg_catalog.pg_extension'::pg_catalog.regclass
     and dependency.deptype = 'e'
),
schema_scope as (
  select
    namespace.oid,
    namespace.nspname,
    (
      namespace.nspname !~ '^pg_'
      and namespace.nspname <> 'information_schema'
    ) as dump_all
    from pg_catalog.pg_namespace as namespace
   where namespace.nspname <> 'pg_toast'
     and namespace.nspname !~ '^pg_(temp|toast_temp)_[0-9]+$'
),
${DATABASE_CONTAINER_CTES_SQL},
${EXTENSION_CONTRACT_CTES_SQL},
raw_acl_objects (
  object_kind,
  schema_name,
  object_name,
  subidentity,
  owner_oid,
  raw_acl,
  hard_default_acl,
  init_acl,
  include_complete
) as (
  select
    'schema',
    namespace.nspname,
    '',
    '',
    namespace.nspowner,
    namespace.nspacl,
    pg_catalog.acldefault('n'::"char", namespace.nspowner),
    initial_privileges.initprivs,
    scope.dump_all and extension_member.objid is null
  from pg_catalog.pg_namespace as namespace
  join schema_scope as scope on scope.oid = namespace.oid
  left join pg_catalog.pg_init_privs as initial_privileges
    on initial_privileges.classoid =
       'pg_catalog.pg_namespace'::pg_catalog.regclass
   and initial_privileges.objoid = namespace.oid
   and initial_privileges.objsubid = 0
  left join extension_members as extension_member
    on extension_member.classid =
       'pg_catalog.pg_namespace'::pg_catalog.regclass
   and extension_member.objid = namespace.oid
   and extension_member.objsubid = 0
  where scope.dump_all
     or namespace.nspname = 'pg_catalog'
     or extension_member.objid is not null

  union all

  select
    case relation.relkind
      when 'S' then 'sequence'
      when 'r' then 'relation:table'
      when 'p' then 'relation:partitioned_table'
      when 'v' then 'relation:view'
      when 'm' then 'relation:materialized_view'
      when 'f' then 'relation:foreign_table'
    end,
    namespace.nspname,
    relation.relname,
    '',
    relation.relowner,
    relation.relacl,
    pg_catalog.acldefault(
      case
        when relation.relkind = 'S' then 's'::"char"
        else 'r'::"char"
      end,
      relation.relowner
    ),
    initial_privileges.initprivs,
    scope.dump_all and extension_member.objid is null
  from pg_catalog.pg_class as relation
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  join schema_scope as scope on scope.oid = namespace.oid
  left join pg_catalog.pg_init_privs as initial_privileges
    on initial_privileges.classoid = 'pg_catalog.pg_class'::pg_catalog.regclass
   and initial_privileges.objoid = relation.oid
   and initial_privileges.objsubid = 0
  left join extension_members as extension_member
    on extension_member.classid = 'pg_catalog.pg_class'::pg_catalog.regclass
   and extension_member.objid = relation.oid
   and extension_member.objsubid = 0
  where relation.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
    and (
      scope.dump_all
      or namespace.nspname = 'pg_catalog'
      or extension_member.objid is not null
    )

  union all

  select
    case function_definition.prokind
      when 'p' then 'procedure'
      when 'a' then 'aggregate'
      when 'w' then 'window_function'
      else 'function'
    end,
    namespace.nspname,
    function_definition.proname,
    pg_catalog.pg_get_function_identity_arguments(function_definition.oid),
    function_definition.proowner,
    function_definition.proacl,
    pg_catalog.acldefault('f'::"char", function_definition.proowner),
    initial_privileges.initprivs,
    scope.dump_all and extension_member.objid is null
  from pg_catalog.pg_proc as function_definition
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = function_definition.pronamespace
  join schema_scope as scope on scope.oid = namespace.oid
  left join pg_catalog.pg_init_privs as initial_privileges
    on initial_privileges.classoid = 'pg_catalog.pg_proc'::pg_catalog.regclass
   and initial_privileges.objoid = function_definition.oid
   and initial_privileges.objsubid = 0
  left join extension_members as extension_member
    on extension_member.classid = 'pg_catalog.pg_proc'::pg_catalog.regclass
   and extension_member.objid = function_definition.oid
   and extension_member.objsubid = 0
  where not exists (
    select 1
      from pg_catalog.pg_depend as internal_dependency
     where internal_dependency.classid =
           'pg_catalog.pg_proc'::pg_catalog.regclass
       and internal_dependency.objid = function_definition.oid
       and internal_dependency.deptype = 'i'
  )
    and (
      scope.dump_all
      or namespace.nspname = 'pg_catalog'
      or extension_member.objid is not null
    )

  union all

  select
    'type',
    namespace.nspname,
    type_definition.typname,
    type_definition.typtype::text,
    type_definition.typowner,
    type_definition.typacl,
    pg_catalog.acldefault('T'::"char", type_definition.typowner),
    initial_privileges.initprivs,
    scope.dump_all and extension_member.objid is null
  from pg_catalog.pg_type as type_definition
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = type_definition.typnamespace
  join schema_scope as scope on scope.oid = namespace.oid
  left join pg_catalog.pg_class as type_relation
    on type_relation.oid = type_definition.typrelid
  left join pg_catalog.pg_init_privs as initial_privileges
    on initial_privileges.classoid = 'pg_catalog.pg_type'::pg_catalog.regclass
   and initial_privileges.objoid = type_definition.oid
   and initial_privileges.objsubid = 0
  left join extension_members as extension_member
    on extension_member.classid = 'pg_catalog.pg_type'::pg_catalog.regclass
   and extension_member.objid = type_definition.oid
   and extension_member.objsubid = 0
  where not (
    type_definition.typrelid <> 0
    and coalesce(type_relation.relkind, ' ') <> 'c'
  )
    and not exists (
      select 1
        from pg_catalog.pg_type as base_type
       where base_type.typarray = type_definition.oid
    )
    and not exists (
      select 1
        from pg_catalog.pg_range as range_definition
       where range_definition.rngmultitypid = type_definition.oid
    )
    and (
      scope.dump_all
      or namespace.nspname = 'pg_catalog'
      or extension_member.objid is not null
    )

  union all

  select
    'column',
    namespace.nspname,
    relation.relname,
    attribute.attname,
    relation.relowner,
    attribute.attacl,
    pg_catalog.acldefault('c'::"char", relation.relowner),
    initial_privileges.initprivs,
    scope.dump_all and extension_member.objid is null
  from pg_catalog.pg_attribute as attribute
  join pg_catalog.pg_class as relation on relation.oid = attribute.attrelid
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  join schema_scope as scope on scope.oid = namespace.oid
  left join pg_catalog.pg_init_privs as initial_privileges
    on initial_privileges.classoid = 'pg_catalog.pg_class'::pg_catalog.regclass
   and initial_privileges.objoid = relation.oid
   and initial_privileges.objsubid = attribute.attnum
  left join extension_members as extension_member
    on extension_member.classid = 'pg_catalog.pg_class'::pg_catalog.regclass
   and extension_member.objid = relation.oid
   and extension_member.objsubid = 0
  where relation.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
    and attribute.attnum <> 0
    and not attribute.attisdropped
    and (
      scope.dump_all
      or namespace.nspname = 'pg_catalog'
      or extension_member.objid is not null
    )

  union all

  select
    'default_acl',
    coalesce(namespace.nspname, ''),
    case default_privileges.defaclobjtype
      when 'r' then 'relations'
      when 'S' then 'sequences'
      when 'f' then 'functions'
      when 'T' then 'types'
      when 'n' then 'schemas'
      else 'unsupported:' || default_privileges.defaclobjtype::text
    end,
    '',
    default_privileges.defaclrole,
    default_privileges.defaclacl,
    case
      when default_privileges.defaclnamespace <> 0
        then '{}'::pg_catalog.aclitem[]
      when default_privileges.defaclobjtype = 'S'
        then pg_catalog.acldefault(
          's'::"char",
          default_privileges.defaclrole
        )
      when default_privileges.defaclobjtype in ('r', 'f', 'T', 'n')
        then pg_catalog.acldefault(
          default_privileges.defaclobjtype,
          default_privileges.defaclrole
        )
      else '{}'::pg_catalog.aclitem[]
    end,
    null::pg_catalog.aclitem[],
    true
  from pg_catalog.pg_default_acl as default_privileges
  left join pg_catalog.pg_namespace as namespace
    on namespace.oid = default_privileges.defaclnamespace
  where default_privileges.defaclnamespace = 0
     or exists (
       select 1
         from schema_scope as scope
        where scope.oid = default_privileges.defaclnamespace
          and (
            scope.dump_all
            or scope.nspname = 'pg_catalog'
          )
     )

  union all

  select
    'language',
    '',
    language_definition.lanname,
    '',
    language_definition.lanowner,
    language_definition.lanacl,
    pg_catalog.acldefault('l'::"char", language_definition.lanowner),
    initial_privileges.initprivs,
    language_definition.oid > last_builtin.last_builtin_oid
      and extension_member.objid is null
  from pg_catalog.pg_language as language_definition
  cross join last_builtin
  left join pg_catalog.pg_init_privs as initial_privileges
    on initial_privileges.classoid =
       'pg_catalog.pg_language'::pg_catalog.regclass
   and initial_privileges.objoid = language_definition.oid
   and initial_privileges.objsubid = 0
  left join extension_members as extension_member
    on extension_member.classid =
       'pg_catalog.pg_language'::pg_catalog.regclass
   and extension_member.objid = language_definition.oid
   and extension_member.objsubid = 0
  where language_definition.lanispl

  union all

  select
    'foreign_data_wrapper',
    '',
    wrapper.fdwname,
    '',
    wrapper.fdwowner,
    wrapper.fdwacl,
    pg_catalog.acldefault('F'::"char", wrapper.fdwowner),
    initial_privileges.initprivs,
    extension_member.objid is null
  from pg_catalog.pg_foreign_data_wrapper as wrapper
  left join pg_catalog.pg_init_privs as initial_privileges
    on initial_privileges.classoid =
       'pg_catalog.pg_foreign_data_wrapper'::pg_catalog.regclass
   and initial_privileges.objoid = wrapper.oid
   and initial_privileges.objsubid = 0
  left join extension_members as extension_member
    on extension_member.classid =
       'pg_catalog.pg_foreign_data_wrapper'::pg_catalog.regclass
   and extension_member.objid = wrapper.oid
   and extension_member.objsubid = 0

  union all

  select
    'foreign_server',
    '',
    server_definition.srvname,
    '',
    server_definition.srvowner,
    server_definition.srvacl,
    pg_catalog.acldefault('S'::"char", server_definition.srvowner),
    initial_privileges.initprivs,
    extension_member.objid is null
  from pg_catalog.pg_foreign_server as server_definition
  left join pg_catalog.pg_init_privs as initial_privileges
    on initial_privileges.classoid =
       'pg_catalog.pg_foreign_server'::pg_catalog.regclass
   and initial_privileges.objoid = server_definition.oid
   and initial_privileges.objsubid = 0
  left join extension_members as extension_member
    on extension_member.classid =
       'pg_catalog.pg_foreign_server'::pg_catalog.regclass
   and extension_member.objid = server_definition.oid
   and extension_member.objsubid = 0

  union all

  select
    'large_object',
    '',
    large_object.oid::text,
    '',
    large_object.lomowner,
    large_object.lomacl,
    pg_catalog.acldefault('L'::"char", large_object.lomowner),
    null::pg_catalog.aclitem[],
    true
  from pg_catalog.pg_largeobject_metadata as large_object
),
filtered_acl_objects (
  object_kind,
  schema_name,
  object_name,
  subidentity,
  owner_oid,
  raw_acl,
  hard_default_acl,
  init_acl
) as (
  select
    candidate.object_kind,
    candidate.schema_name,
    candidate.object_name,
    candidate.subidentity,
    case
      when candidate.include_complete then candidate.owner_oid
      else null::pg_catalog.oid
    end,
    candidate.raw_acl,
    candidate.hard_default_acl,
    candidate.init_acl
  from raw_acl_objects as candidate
  where (
       candidate.include_complete
       and candidate.object_kind <> 'default_acl'
     )
     or exists (
       select
         current_privilege.grantee,
         current_privilege.grantor,
         current_privilege.privilege_type,
         current_privilege.is_grantable
       from pg_catalog.aclexplode(
         nullif(coalesce(
           candidate.raw_acl,
           candidate.hard_default_acl,
           '{}'::pg_catalog.aclitem[]
         ), '{}'::pg_catalog.aclitem[])
       ) as current_privilege
       except
       select
         baseline_privilege.grantee,
         baseline_privilege.grantor,
         baseline_privilege.privilege_type,
         baseline_privilege.is_grantable
       from pg_catalog.aclexplode(
         nullif(coalesce(
           candidate.init_acl,
           candidate.hard_default_acl,
           '{}'::pg_catalog.aclitem[]
         ), '{}'::pg_catalog.aclitem[])
       ) as baseline_privilege
     )
     or exists (
       select
         baseline_privilege.grantee,
         baseline_privilege.grantor,
         baseline_privilege.privilege_type,
         baseline_privilege.is_grantable
       from pg_catalog.aclexplode(
         nullif(coalesce(
           candidate.init_acl,
           candidate.hard_default_acl,
           '{}'::pg_catalog.aclitem[]
         ), '{}'::pg_catalog.aclitem[])
       ) as baseline_privilege
       except
       select
         current_privilege.grantee,
         current_privilege.grantor,
         current_privilege.privilege_type,
         current_privilege.is_grantable
       from pg_catalog.aclexplode(
         nullif(coalesce(
           candidate.raw_acl,
           candidate.hard_default_acl,
           '{}'::pg_catalog.aclitem[]
         ), '{}'::pg_catalog.aclitem[])
       ) as current_privilege
     )
),
owner_only_objects (
  object_kind,
  schema_name,
  object_name,
  subidentity,
  owner_oid,
  raw_acl,
  hard_default_acl,
  init_acl
) as (
  select
    'collation',
    namespace.nspname,
    collation_definition.collname,
    collation_definition.collencoding::text,
    collation_definition.collowner,
    null::pg_catalog.aclitem[],
    null::pg_catalog.aclitem[],
    null::pg_catalog.aclitem[]
  from pg_catalog.pg_collation as collation_definition
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = collation_definition.collnamespace
  join schema_scope as scope on scope.oid = namespace.oid
  left join extension_members as extension_member
    on extension_member.classid =
       'pg_catalog.pg_collation'::pg_catalog.regclass
   and extension_member.objid = collation_definition.oid
   and extension_member.objsubid = 0
  where scope.dump_all
    and extension_member.objid is null

  union all

  select
    'conversion',
    namespace.nspname,
    conversion.conname,
    '',
    conversion.conowner,
    null::pg_catalog.aclitem[],
    null::pg_catalog.aclitem[],
    null::pg_catalog.aclitem[]
  from pg_catalog.pg_conversion as conversion
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = conversion.connamespace
  join schema_scope as scope on scope.oid = namespace.oid
  left join extension_members as extension_member
    on extension_member.classid =
       'pg_catalog.pg_conversion'::pg_catalog.regclass
   and extension_member.objid = conversion.oid
   and extension_member.objsubid = 0
  where scope.dump_all
    and extension_member.objid is null

  union all

  select
    'operator',
    namespace.nspname,
    operator_definition.oprname,
    case
      when operator_definition.oprleft = 0 then ''
      else pg_catalog.format_type(operator_definition.oprleft, null)
    end || ',' || case
      when operator_definition.oprright = 0 then ''
      else pg_catalog.format_type(operator_definition.oprright, null)
    end,
    operator_definition.oprowner,
    null::pg_catalog.aclitem[],
    null::pg_catalog.aclitem[],
    null::pg_catalog.aclitem[]
  from pg_catalog.pg_operator as operator_definition
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = operator_definition.oprnamespace
  join schema_scope as scope on scope.oid = namespace.oid
  left join extension_members as extension_member
    on extension_member.classid =
       'pg_catalog.pg_operator'::pg_catalog.regclass
   and extension_member.objid = operator_definition.oid
   and extension_member.objsubid = 0
  where scope.dump_all
    and extension_member.objid is null

  union all

  select
    'operator_class',
    namespace.nspname,
    operator_class.opcname,
    access_method.amname,
    operator_class.opcowner,
    null::pg_catalog.aclitem[],
    null::pg_catalog.aclitem[],
    null::pg_catalog.aclitem[]
  from pg_catalog.pg_opclass as operator_class
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = operator_class.opcnamespace
  join schema_scope as scope on scope.oid = namespace.oid
  join pg_catalog.pg_am as access_method
    on access_method.oid = operator_class.opcmethod
  left join extension_members as extension_member
    on extension_member.classid =
       'pg_catalog.pg_opclass'::pg_catalog.regclass
   and extension_member.objid = operator_class.oid
   and extension_member.objsubid = 0
  where scope.dump_all
    and extension_member.objid is null

  union all

  select
    'operator_family',
    namespace.nspname,
    operator_family.opfname,
    access_method.amname,
    operator_family.opfowner,
    null::pg_catalog.aclitem[],
    null::pg_catalog.aclitem[],
    null::pg_catalog.aclitem[]
  from pg_catalog.pg_opfamily as operator_family
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = operator_family.opfnamespace
  join schema_scope as scope on scope.oid = namespace.oid
  join pg_catalog.pg_am as access_method
    on access_method.oid = operator_family.opfmethod
  left join extension_members as extension_member
    on extension_member.classid =
       'pg_catalog.pg_opfamily'::pg_catalog.regclass
   and extension_member.objid = operator_family.oid
   and extension_member.objsubid = 0
  where scope.dump_all
    and extension_member.objid is null

  union all

  select
    'extended_statistics',
    namespace.nspname,
    statistics.stxname,
    '',
    statistics.stxowner,
    null::pg_catalog.aclitem[],
    null::pg_catalog.aclitem[],
    null::pg_catalog.aclitem[]
  from pg_catalog.pg_statistic_ext as statistics
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = statistics.stxnamespace
  join schema_scope as scope on scope.oid = namespace.oid
  join pg_catalog.pg_class as statistics_relation
    on statistics_relation.oid = statistics.stxrelid
  join schema_scope as relation_scope
    on relation_scope.oid = statistics_relation.relnamespace
  left join extension_members as extension_member
    on extension_member.classid =
       'pg_catalog.pg_statistic_ext'::pg_catalog.regclass
   and extension_member.objid = statistics.oid
   and extension_member.objsubid = 0
  left join extension_members as relation_extension_member
    on relation_extension_member.classid =
       'pg_catalog.pg_class'::pg_catalog.regclass
   and relation_extension_member.objid = statistics_relation.oid
   and relation_extension_member.objsubid = 0
  where scope.dump_all
    and relation_scope.dump_all
    and extension_member.objid is null
    and relation_extension_member.objid is null

  union all

  select
    'text_search_configuration',
    namespace.nspname,
    configuration.cfgname,
    '',
    configuration.cfgowner,
    null::pg_catalog.aclitem[],
    null::pg_catalog.aclitem[],
    null::pg_catalog.aclitem[]
  from pg_catalog.pg_ts_config as configuration
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = configuration.cfgnamespace
  join schema_scope as scope on scope.oid = namespace.oid
  left join extension_members as extension_member
    on extension_member.classid =
       'pg_catalog.pg_ts_config'::pg_catalog.regclass
   and extension_member.objid = configuration.oid
   and extension_member.objsubid = 0
  where scope.dump_all
    and extension_member.objid is null

  union all

  select
    'text_search_dictionary',
    namespace.nspname,
    dictionary.dictname,
    '',
    dictionary.dictowner,
    null::pg_catalog.aclitem[],
    null::pg_catalog.aclitem[],
    null::pg_catalog.aclitem[]
  from pg_catalog.pg_ts_dict as dictionary
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = dictionary.dictnamespace
  join schema_scope as scope on scope.oid = namespace.oid
  left join extension_members as extension_member
    on extension_member.classid =
       'pg_catalog.pg_ts_dict'::pg_catalog.regclass
   and extension_member.objid = dictionary.oid
   and extension_member.objsubid = 0
  where scope.dump_all
    and extension_member.objid is null

  union all

  select
    'text_search_parser',
    namespace.nspname,
    parser.prsname,
    '',
    null::pg_catalog.oid,
    null::pg_catalog.aclitem[],
    null::pg_catalog.aclitem[],
    null::pg_catalog.aclitem[]
  from pg_catalog.pg_ts_parser as parser
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = parser.prsnamespace
  join schema_scope as scope on scope.oid = namespace.oid
  left join extension_members as extension_member
    on extension_member.classid =
       'pg_catalog.pg_ts_parser'::pg_catalog.regclass
   and extension_member.objid = parser.oid
   and extension_member.objsubid = 0
  where scope.dump_all
    and extension_member.objid is null

  union all

  select
    'text_search_template',
    namespace.nspname,
    template.tmplname,
    '',
    null::pg_catalog.oid,
    null::pg_catalog.aclitem[],
    null::pg_catalog.aclitem[],
    null::pg_catalog.aclitem[]
  from pg_catalog.pg_ts_template as template
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = template.tmplnamespace
  join schema_scope as scope on scope.oid = namespace.oid
  left join extension_members as extension_member
    on extension_member.classid =
       'pg_catalog.pg_ts_template'::pg_catalog.regclass
   and extension_member.objid = template.oid
   and extension_member.objsubid = 0
  where scope.dump_all
    and extension_member.objid is null

  union all

  select
    'cast',
    '',
    pg_catalog.format_type(cast_definition.castsource, null),
    pg_catalog.format_type(cast_definition.casttarget, null),
    null::pg_catalog.oid,
    null::pg_catalog.aclitem[],
    null::pg_catalog.aclitem[],
    null::pg_catalog.aclitem[]
  from pg_catalog.pg_cast as cast_definition
  left join extension_members as extension_member
    on extension_member.classid = 'pg_catalog.pg_cast'::pg_catalog.regclass
   and extension_member.objid = cast_definition.oid
   and extension_member.objsubid = 0
  where extension_member.objid is null
    and cast_definition.oid > (select last_builtin_oid from last_builtin)

  union all

  select
    'transform',
    '',
    pg_catalog.format_type(transform.trftype, null),
    language_definition.lanname,
    null::pg_catalog.oid,
    null::pg_catalog.aclitem[],
    null::pg_catalog.aclitem[],
    null::pg_catalog.aclitem[]
  from pg_catalog.pg_transform as transform
  join pg_catalog.pg_language as language_definition
    on language_definition.oid = transform.trflang
  left join extension_members as extension_member
    on extension_member.classid =
       'pg_catalog.pg_transform'::pg_catalog.regclass
   and extension_member.objid = transform.oid
   and extension_member.objsubid = 0
  where extension_member.objid is null
    and transform.oid > (select last_builtin_oid from last_builtin)

  union all

  select
    'event_trigger',
    '',
    event_trigger.evtname,
    '',
    event_trigger.evtowner,
    null::pg_catalog.aclitem[],
    null::pg_catalog.aclitem[],
    null::pg_catalog.aclitem[]
  from pg_catalog.pg_event_trigger as event_trigger
  left join extension_members as extension_member
    on extension_member.classid =
       'pg_catalog.pg_event_trigger'::pg_catalog.regclass
   and extension_member.objid = event_trigger.oid
   and extension_member.objsubid = 0
  where extension_member.objid is null

  union all

  select
    'publication',
    '',
    publication.pubname,
    '',
    publication.pubowner,
    null::pg_catalog.aclitem[],
    null::pg_catalog.aclitem[],
    null::pg_catalog.aclitem[]
  from pg_catalog.pg_publication as publication

  union all

  select
    'subscription',
    '',
    subscription.subname,
    '',
    subscription.subowner,
    null::pg_catalog.aclitem[],
    null::pg_catalog.aclitem[],
    null::pg_catalog.aclitem[]
  from pg_catalog.pg_subscription as subscription
  where subscription.subdbid = (
    select database_definition.oid
    from pg_catalog.pg_database as database_definition
    where database_definition.datname = current_database()
  )

  union all

  select
    'user_mapping_role',
    '',
    server_definition.srvname,
    case
      when user_mapping.umuser = 0 then 'PUBLIC'
      else mapped_role.rolname
    end,
    nullif(user_mapping.umuser, 0),
    null::pg_catalog.aclitem[],
    null::pg_catalog.aclitem[],
    null::pg_catalog.aclitem[]
  from pg_catalog.pg_user_mapping as user_mapping
  join pg_catalog.pg_foreign_server as server_definition
    on server_definition.oid = user_mapping.umserver
  left join extension_members as server_extension_member
    on server_extension_member.classid =
       'pg_catalog.pg_foreign_server'::pg_catalog.regclass
   and server_extension_member.objid = server_definition.oid
   and server_extension_member.objsubid = 0
  left join pg_catalog.pg_roles as mapped_role
    on mapped_role.oid = user_mapping.umuser
   and user_mapping.umuser <> 0
  where server_extension_member.objid is null
),
authorization_objects as (
  select * from filtered_acl_objects
  union all
  select * from owner_only_objects
),
materialized_objects as (
  select
    object_definition.*,
    owner_role.rolname as owner_name,
    coalesce(privileges.entries, '[]'::pg_catalog.jsonb) as acl_entries
  from authorization_objects as object_definition
  left join pg_catalog.pg_roles as owner_role
    on owner_role.oid = object_definition.owner_oid
  left join lateral (
    select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_array(
        case
          when privilege.grantee = 0 then 'PUBLIC'
          else grantee_role.rolname
        end,
        grantor_role.rolname,
        privilege.privilege_type,
        privilege.is_grantable
      )
      order by
        (
          case
            when privilege.grantee = 0 then 'PUBLIC'
            else grantee_role.rolname
          end
        ) collate "C",
        grantor_role.rolname collate "C",
        privilege.privilege_type collate "C",
        privilege.is_grantable
    ) as entries
    from pg_catalog.aclexplode(
      nullif(coalesce(
        object_definition.raw_acl,
        object_definition.hard_default_acl
      ), '{}'::pg_catalog.aclitem[])
    ) as privilege
    left join pg_catalog.pg_roles as grantee_role
      on grantee_role.oid = privilege.grantee
     and privilege.grantee <> 0
    left join pg_catalog.pg_roles as grantor_role
      on grantor_role.oid = privilege.grantor
  ) as privileges on true
),
canonical_object_records as (
  select pg_catalog.encode(
    pg_catalog.convert_to(
      pg_catalog.jsonb_build_array(
        '${CANONICALIZATION}',
        object_kind,
        schema_name,
        object_name,
        subidentity,
        owner_name,
        acl_entries
      )::text,
      'UTF8'
    ),
    'hex'
  ) as record_hex,
  pg_catalog.jsonb_array_length(acl_entries)::bigint as grant_tuple_count
  from materialized_objects
),
role_oid_references as (
  select owner_oid as role_oid from authorization_objects

  union

  select database_definition.datdba
  from current_database_definition as database_definition

  union

  select database_acl.grantee_oid
  from current_database_acl as database_acl
  where database_acl.grantee_oid <> 0

  union

  select database_acl.grantor_oid
  from current_database_acl as database_acl
  where database_acl.grantor_oid <> 0

  union

  select role_setting.role_oid
  from current_database_role_settings as role_setting
  where role_setting.role_oid <> 0

  union

  select extension.extowner
  from extension_contract_extensions as extension

  union

  select extension.schema_owner_oid
  from extension_contract_extensions as extension

  union

  select member.owner_oid
  from extension_contract_member_materialized as member
  where member.owner_oid is not null

  union

  select privilege.grantee
  from extension_contract_initial_privileges as initial_privileges
  cross join lateral pg_catalog.aclexplode(
    nullif(initial_privileges.initprivs, '{}'::pg_catalog.aclitem[])
  ) as privilege
  where privilege.grantee <> 0

  union

  select privilege.grantor
  from extension_contract_initial_privileges as initial_privileges
  cross join lateral pg_catalog.aclexplode(
    nullif(initial_privileges.initprivs, '{}'::pg_catalog.aclitem[])
  ) as privilege
  where privilege.grantor <> 0

  union

  select login_role.oid
  from pg_catalog.pg_roles as login_role
  where login_role.rolcanlogin

  union

  select privilege.grantee
  from authorization_objects as object_definition
  cross join lateral pg_catalog.aclexplode(
    nullif(coalesce(
      object_definition.raw_acl,
      object_definition.hard_default_acl
    ), '{}'::pg_catalog.aclitem[])
  ) as privilege
  where privilege.grantee <> 0

  union

  select privilege.grantor
  from authorization_objects as object_definition
  cross join lateral pg_catalog.aclexplode(
    nullif(coalesce(
      object_definition.raw_acl,
      object_definition.hard_default_acl
    ), '{}'::pg_catalog.aclitem[])
  ) as privilege
  where privilege.grantor <> 0

  union

  select privilege.grantee
  from authorization_objects as object_definition
  cross join lateral pg_catalog.aclexplode(
    nullif(object_definition.init_acl, '{}'::pg_catalog.aclitem[])
  )
    as privilege
  where privilege.grantee <> 0

  union

  select privilege.grantor
  from authorization_objects as object_definition
  cross join lateral pg_catalog.aclexplode(
    nullif(object_definition.init_acl, '{}'::pg_catalog.aclitem[])
  )
    as privilege
  where privilege.grantor <> 0

  union

  select policy_role.role_oid
  from pg_catalog.pg_policy as policy
  join pg_catalog.pg_class as relation on relation.oid = policy.polrelid
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  join schema_scope as scope on scope.oid = namespace.oid
  left join extension_members as extension_member
    on extension_member.classid = 'pg_catalog.pg_policy'::pg_catalog.regclass
   and extension_member.objid = policy.oid
   and extension_member.objsubid = 0
  cross join lateral pg_catalog.unnest(policy.polroles)
    as policy_role(role_oid)
  where scope.dump_all
    and extension_member.objid is null
    and policy_role.role_oid <> 0
),
role_component(role_oid) as (
  select reference.role_oid
  from role_oid_references as reference
  where reference.role_oid is not null

  union

  select membership_endpoint.role_oid
  from pg_catalog.pg_auth_members as membership
  join role_component as connected_role
    on connected_role.role_oid in (
      membership.member,
      membership.roleid,
      membership.grantor
    )
  cross join lateral (
    values
      (membership.member),
      (membership.roleid),
      (membership.grantor)
  ) as membership_endpoint(role_oid)
),
required_role_names as (
  select role_definition.rolname
  from role_component as reference
  join pg_catalog.pg_roles as role_definition
    on role_definition.oid = reference.role_oid
),
required_roles as (
  select coalesce(
    pg_catalog.jsonb_agg(
      role_name.rolname
      order by role_name.rolname collate "C"
    ),
    '[]'::pg_catalog.jsonb
  ) as role_names
  from required_role_names as role_name
),
canonical_role_records as (
  select pg_catalog.encode(
    pg_catalog.convert_to(
      pg_catalog.jsonb_build_array(
        '${CANONICALIZATION}',
        'role',
        '',
        role_definition.rolname,
        '',
        null,
        'attributes',
        pg_catalog.jsonb_build_array(
          role_definition.rolsuper,
          role_definition.rolinherit,
          role_definition.rolcreaterole,
          role_definition.rolcreatedb,
          role_definition.rolcanlogin,
          role_definition.rolreplication,
          role_definition.rolbypassrls,
          role_definition.rolconnlimit,
          case
            when role_definition.rolvaliduntil is null then null
            when role_definition.rolvaliduntil =
                 'infinity'::pg_catalog.timestamptz
              then 'infinity'
            when role_definition.rolvaliduntil =
                 '-infinity'::pg_catalog.timestamptz
              then '-infinity'
            else pg_catalog.to_char(
              role_definition.rolvaliduntil at time zone 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
            )
          end,
          coalesce((
            select pg_catalog.jsonb_agg(
              role_setting.setting
              order by role_setting.setting collate "C"
            )
            from pg_catalog.unnest(role_definition.rolconfig)
              as role_setting(setting)
          ), '[]'::pg_catalog.jsonb)
        )
      )::text,
      'UTF8'
    ),
    'hex'
  ) as record_hex,
  0::bigint as grant_tuple_count
  from role_component as required_role
  join pg_catalog.pg_roles as role_definition
    on role_definition.oid = required_role.role_oid

  union all

  select pg_catalog.encode(
    pg_catalog.convert_to(
      pg_catalog.jsonb_build_array(
        '${CANONICALIZATION}',
        'role_membership',
        '',
        member_role.rolname,
        parent_role.rolname,
        null,
        'membership',
        pg_catalog.jsonb_build_array(
          grantor_role.rolname,
          membership.admin_option,
          membership.inherit_option,
          membership.set_option
        )
      )::text,
      'UTF8'
    ),
    'hex'
  ) as record_hex,
  0::bigint as grant_tuple_count
  from pg_catalog.pg_auth_members as membership
  join role_component as required_member
    on required_member.role_oid = membership.member
  join pg_catalog.pg_roles as member_role
    on member_role.oid = membership.member
  join pg_catalog.pg_roles as parent_role
    on parent_role.oid = membership.roleid
  join pg_catalog.pg_roles as grantor_role
    on grantor_role.oid = membership.grantor
),
canonical_payload as (
  select
    count(*)::bigint as record_count,
    coalesce(sum(grant_tuple_count), 0)::bigint as grant_tuple_count,
    coalesce(
      pg_catalog.string_agg(
        record_hex,
        E'\n'
        order by record_hex collate "C"
      ) || E'\n',
      ''
    ) as payload_text
  from canonical_object_records
),
canonical_role_payload as (
  select
    count(*)::bigint as record_count,
    coalesce(
      pg_catalog.string_agg(
        record_hex,
        E'\n'
        order by record_hex collate "C"
      ) || E'\n',
      ''
    ) as payload_text
  from canonical_role_records
),
unresolved_roles as (
  select count(distinct reference.role_oid)::integer as unresolved_count
  from role_oid_references as reference
  left join pg_catalog.pg_roles as role_definition
    on role_definition.oid = reference.role_oid
  where role_definition.oid is null
),
app_roles as (
  select oid, rolname
  from pg_catalog.pg_roles
  where rolname in ('anon', 'authenticated', 'service_role')
),
core_relation_names(relation_name) as (
  values
    ('contacts'),
    ('followups'),
    ('memories'),
    ('workspace_members'),
    ('workspaces')
),
core_privilege_names(privilege_name) as (
  values
    ('SELECT'),
    ('INSERT'),
    ('UPDATE'),
    ('DELETE'),
    ('TRUNCATE'),
    ('REFERENCES'),
    ('TRIGGER'),
    ('MAINTAIN')
),
core_table_app_grants as (
  select count(*)::integer as grant_count
  from core_relation_names as expected_relation
  cross join app_roles as expected_role
  cross join core_privilege_names as expected_privilege
  where exists (
    select 1
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    cross join lateral pg_catalog.aclexplode(
      nullif(coalesce(
        relation.relacl,
        pg_catalog.acldefault('r'::"char", relation.relowner)
      ), '{}'::pg_catalog.aclitem[])
    ) as privilege
    where namespace.nspname = 'public'
      and relation.relname = expected_relation.relation_name
      and relation.relkind in ('r', 'p')
      and privilege.grantee = expected_role.oid
      and privilege.privilege_type = expected_privilege.privilege_name
      and not privilege.is_grantable
  )
),
core_table_app_grant_stats as (
  select
    count(*)::integer as row_count,
    count(*) filter (where privilege.is_grantable)::integer
      as grant_option_count
  from pg_catalog.pg_class as relation
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  cross join lateral pg_catalog.aclexplode(
    nullif(coalesce(
      relation.relacl,
      pg_catalog.acldefault('r'::"char", relation.relowner)
    ), '{}'::pg_catalog.aclitem[])
  ) as privilege
  where namespace.nspname = 'public'
    and relation.relname in (select relation_name from core_relation_names)
    and relation.relkind in ('r', 'p')
    and privilege.grantee in (select oid from app_roles)
    and privilege.privilege_type in (
      select privilege_name from core_privilege_names
    )
),
expected_recovery_extensions(
  extname,
  extversion,
  relocatable,
  schema_name,
  member_count
) as (
  values
    ('plpgsql', '1.0', false, 'pg_catalog', 4),
    ('pgcrypto', '1.3', true, 'extensions', 36)
),
resolved_recovery_extensions as (
  select
    extension.oid,
    extension.extname,
    extension.extnamespace,
    expected.member_count
  from expected_recovery_extensions as expected
  join pg_catalog.pg_extension as extension
    on extension.extname = expected.extname
   and extension.extversion = expected.extversion
   and extension.extrelocatable = expected.relocatable
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = extension.extnamespace
   and namespace.nspname = expected.schema_name
  where extension.extconfig is null
    and extension.extcondition is null
),
actual_recovery_extension_members as (
  select
    extension.extname,
    dependency.classid,
    dependency.objid,
    dependency.objsubid
  from resolved_recovery_extensions as extension
  join pg_catalog.pg_depend as dependency
    on dependency.refclassid =
       'pg_catalog.pg_extension'::pg_catalog.regclass
   and dependency.refobjid = extension.oid
   and dependency.deptype = 'e'
),
recovery_extension_inventory_records as (
  select pg_catalog.encode(
    pg_catalog.convert_to(
      pg_catalog.jsonb_build_array(
        'function',
        member.extname,
        function_definition.proname,
        pg_catalog.pg_get_function_identity_arguments(
          function_definition.oid
        ),
        function_definition.probin,
        function_definition.prosrc,
        pg_catalog.pg_get_function_result(function_definition.oid),
        function_definition.prokind,
        language.lanname,
        function_definition.proisstrict,
        function_definition.provolatile,
        function_definition.proparallel,
        function_definition.prosecdef,
        function_definition.proleakproof,
        function_definition.proconfig is null,
        function_definition.protrftypes is null,
        function_definition.prosupport = 0,
        function_definition.provariadic = 0,
        function_definition.pronargdefaults,
        function_definition.proargdefaults is null,
        function_definition.procost,
        function_definition.prorows
      )::text,
      'UTF8'
    ),
    'hex'
  ) as record_hex
  from actual_recovery_extension_members as member
  join pg_catalog.pg_proc as function_definition
    on member.classid = 'pg_catalog.pg_proc'::pg_catalog.regclass
   and function_definition.oid = member.objid
   and member.objsubid = 0
  join pg_catalog.pg_language as language
    on language.oid = function_definition.prolang

  union all

  select pg_catalog.encode(
    pg_catalog.convert_to(
      pg_catalog.jsonb_build_array(
        'language',
        member.extname,
        language.lanname,
        language.lanispl,
        language.lanpltrusted,
        call_handler.proname,
        pg_catalog.pg_get_function_identity_arguments(call_handler.oid),
        inline_handler.proname,
        pg_catalog.pg_get_function_identity_arguments(inline_handler.oid),
        validator.proname,
        pg_catalog.pg_get_function_identity_arguments(validator.oid),
        language.lanacl is null
      )::text,
      'UTF8'
    ),
    'hex'
  ) as record_hex
  from actual_recovery_extension_members as member
  join pg_catalog.pg_language as language
    on member.classid = 'pg_catalog.pg_language'::pg_catalog.regclass
   and language.oid = member.objid
   and member.objsubid = 0
  join pg_catalog.pg_proc as call_handler
    on call_handler.oid = language.lanplcallfoid
  join pg_catalog.pg_proc as inline_handler
    on inline_handler.oid = language.laninline
  join pg_catalog.pg_proc as validator
    on validator.oid = language.lanvalidator
),
recovery_extension_inventory_payload as (
  select
    count(*)::integer as record_count,
    coalesce(
      pg_catalog.string_agg(
        record_hex,
        E'\n'
        order by record_hex collate "C"
      ) || E'\n',
      ''
    ) as payload_text
  from recovery_extension_inventory_records
),
recovery_extension_member_stats as (
  select
    count(*)::integer as member_count,
    count(*) filter (where extname = 'plpgsql')::integer
      as plpgsql_member_count,
    count(*) filter (where extname = 'pgcrypto')::integer
      as pgcrypto_member_count
  from actual_recovery_extension_members
),
recovery_extension_member_namespace_violations as (
  select count(*)::integer as violation_count
  from actual_recovery_extension_members as member
  join resolved_recovery_extensions as extension
    on extension.extname = member.extname
  join pg_catalog.pg_proc as function_definition
    on member.classid = 'pg_catalog.pg_proc'::pg_catalog.regclass
   and function_definition.oid = member.objid
   and member.objsubid = 0
  where function_definition.pronamespace <> extension.extnamespace
),
extension_recovery_invariants as (
  select (
    case
      when (select count(*) from resolved_recovery_extensions) = 2 then 0
      else 1
    end
    + case
      when member_stats.member_count = 40
       and member_stats.plpgsql_member_count = 4
       and member_stats.pgcrypto_member_count = 36
        then 0
      else 1
    end
    + case
      when inventory.record_count = 40 then 0
      else 1
    end
    + namespace_violations.violation_count
    + case
      when pg_catalog.encode(
        pg_catalog.sha256(
          pg_catalog.convert_to(inventory.payload_text, 'UTF8')
        ),
        'hex'
      ) = '1e2296ca95301c346504d97552fff0d38cf81755653ce24687a261a8e97b7a9e'
        then 0
      else 1
    end
  )::integer as violation_count
  from recovery_extension_inventory_payload as inventory
  cross join recovery_extension_member_stats as member_stats
  cross join recovery_extension_member_namespace_violations
    as namespace_violations
),
allowed_container_schemas as (
  select namespace.nspname
  from pg_catalog.pg_namespace as namespace
  where (
    namespace.nspname = 'extensions'
    and namespace.nspowner = 'postgres'::pg_catalog.regrole
    and pg_catalog.cardinality(namespace.nspacl) = 5
    and namespace.nspacl @> array[
      'postgres=UC/postgres'::pg_catalog.aclitem,
      'anon=U/postgres'::pg_catalog.aclitem,
      'authenticated=U/postgres'::pg_catalog.aclitem,
      'service_role=U/postgres'::pg_catalog.aclitem,
      'dashboard_user=UC/postgres'::pg_catalog.aclitem
    ]
  ) or (
    namespace.nspname = 'public'
    and namespace.nspowner = 'pg_database_owner'::pg_catalog.regrole
    and pg_catalog.cardinality(namespace.nspacl) = 6
    and namespace.nspacl @> array[
      'pg_database_owner=UC/pg_database_owner'::pg_catalog.aclitem,
      '=U/pg_database_owner'::pg_catalog.aclitem,
      'postgres=U/pg_database_owner'::pg_catalog.aclitem,
      'anon=U/pg_database_owner'::pg_catalog.aclitem,
      'authenticated=U/pg_database_owner'::pg_catalog.aclitem,
      'service_role=U/pg_database_owner'::pg_catalog.aclitem
    ]
  )
),
container_recovery_invariants as (
  select (
    count(*) + (select violation_count from database_container_invariants)
  )::integer as violation_count
  from (values ('extensions'), ('public')) as expected(schema_name)
  where not exists (
    select 1
    from allowed_container_schemas as allowed
    where allowed.nspname = expected.schema_name
  )
),
public_security_definer_totals as (
  select count(*)::integer as function_count
  from pg_catalog.pg_proc as function_definition
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = function_definition.pronamespace
  where namespace.nspname = 'public'
    and function_definition.prosecdef
),
restricted_security_definers as (
  select count(*)::integer as function_count
  from pg_catalog.pg_proc as function_definition
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = function_definition.pronamespace
  where namespace.nspname = 'public'
    and function_definition.prosecdef
    and pg_catalog.pg_get_function_result(function_definition.oid) <> 'trigger'
    and not coalesce(
      pg_catalog.has_function_privilege(
        (select oid from app_roles where rolname = 'anon'),
        function_definition.oid,
        'EXECUTE'
      ),
      false
    )
    and not coalesce(
      pg_catalog.has_function_privilege(
        (select oid from app_roles where rolname = 'authenticated'),
        function_definition.oid,
        'EXECUTE'
      ),
      false
    )
    and coalesce(
      pg_catalog.has_function_privilege(
        (select oid from app_roles where rolname = 'service_role'),
        function_definition.oid,
        'EXECUTE'
      ),
      false
    )
),
exposed_security_definer_exception as (
  select count(*)::integer as function_count
  from pg_catalog.pg_proc as function_definition
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = function_definition.pronamespace
  where namespace.nspname = 'public'
    and function_definition.prosecdef
    and function_definition.proname =
        'trim_conversation_messages_to_latest_50'
    and pg_catalog.pg_get_function_identity_arguments(
      function_definition.oid
    ) = ''
    and pg_catalog.pg_get_function_result(function_definition.oid) = 'trigger'
    and coalesce(
      pg_catalog.has_function_privilege(
        (select oid from app_roles where rolname = 'anon'),
        function_definition.oid,
        'EXECUTE'
      ),
      false
    )
    and coalesce(
      pg_catalog.has_function_privilege(
        (select oid from app_roles where rolname = 'authenticated'),
        function_definition.oid,
        'EXECUTE'
      ),
      false
    )
    and coalesce(
      pg_catalog.has_function_privilege(
        (select oid from app_roles where rolname = 'service_role'),
        function_definition.oid,
        'EXECUTE'
      ),
      false
    )
),
hardened_security_definer_exception as (
  select count(*)::integer as function_count
  from pg_catalog.pg_proc as function_definition
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = function_definition.pronamespace
  where namespace.nspname = 'public'
    and function_definition.prosecdef
    and function_definition.proname =
        'trim_conversation_messages_to_latest_50'
    and pg_catalog.pg_get_function_identity_arguments(
      function_definition.oid
    ) = ''
    and pg_catalog.pg_get_function_result(function_definition.oid) = 'trigger'
    and function_definition.proconfig =
        array['search_path=pg_catalog, pg_temp']::text[]
    and not coalesce(
      pg_catalog.has_function_privilege(
        (select oid from app_roles where rolname = 'anon'),
        function_definition.oid, 'EXECUTE'
      ), false
    )
    and not coalesce(
      pg_catalog.has_function_privilege(
        (select oid from app_roles where rolname = 'authenticated'),
        function_definition.oid, 'EXECUTE'
      ), false
    )
    and coalesce(
      pg_catalog.has_function_privilege(
        (select oid from app_roles where rolname = 'service_role'),
        function_definition.oid, 'EXECUTE'
      ), false
    )
),
unsupported_default_acl_types as (
  select count(*)::integer as unsupported_count
  from pg_catalog.pg_default_acl
  where defaclobjtype not in ('r', 'S', 'f', 'T', 'n')
),
authorization_result as (
  select pg_catalog.jsonb_build_object(
    'server_version_num',
      current_setting('server_version_num')::integer,
    'fingerprint_sha256',
      pg_catalog.encode(
        pg_catalog.sha256(
          pg_catalog.convert_to(payload.payload_text, 'UTF8')
        ),
        'hex'
      ),
    'record_count', payload.record_count,
    'grant_tuple_count', payload.grant_tuple_count,
    'required_roles', required.role_names,
    'role_fingerprint_sha256',
      pg_catalog.encode(
        pg_catalog.sha256(
          pg_catalog.convert_to(role_payload.payload_text, 'UTF8')
        ),
        'hex'
      ),
    'role_record_count', role_payload.record_count,
    'database_container_fingerprint_sha256',
      pg_catalog.encode(
        pg_catalog.sha256(
          pg_catalog.convert_to(
            database_container.payload_text,
            'UTF8'
          )
        ),
        'hex'
      ),
    'database_container_record_count',
      database_container.record_count,
    'required_extensions', required_extension.descriptors,
    'extension_fingerprint_sha256',
      pg_catalog.encode(
        pg_catalog.sha256(
          pg_catalog.convert_to(
            extension_contract.payload_text,
            'UTF8'
          )
        ),
        'hex'
      ),
    'extension_record_count', extension_contract.record_count,
    'extension_contract_invariant_violation_count',
      extension_contract_invariants.violation_count,
    'extension_contract_unsupported_class_count',
      extension_contract_invariants.unsupported_class_count,
    'core_table_app_grant_tuple_count', core_grants.grant_count,
    'core_table_app_grant_option_count',
      core_grant_stats.grant_option_count,
    'core_table_app_grant_row_count', core_grant_stats.row_count,
    'container_recovery_invariant_violation_count',
      container_invariants.violation_count,
    'extension_recovery_invariant_violation_count',
      extension_invariants.violation_count,
    'public_security_definer_function_count',
      security_definer_totals.function_count,
    'restricted_security_definer_function_count',
      restricted_functions.function_count,
    'exposed_security_definer_exception_count',
      exposed_exception.function_count,
    'hardened_security_definer_exception_count',
      hardened_exception.function_count,
    'unsupported_default_acl_type_count', unsupported.unsupported_count,
    'unresolved_role_oid_count', unresolved.unresolved_count
  ) as value
  from canonical_payload as payload
  cross join canonical_role_payload as role_payload
  cross join database_container_payload as database_container
  cross join extension_contract_payload as extension_contract
  cross join required_extensions as required_extension
  cross join extension_contract_invariants as extension_contract_invariants
  cross join required_roles as required
  cross join core_table_app_grants as core_grants
  cross join core_table_app_grant_stats as core_grant_stats
  cross join container_recovery_invariants as container_invariants
  cross join extension_recovery_invariants as extension_invariants
  cross join public_security_definer_totals as security_definer_totals
  cross join restricted_security_definers as restricted_functions
  cross join exposed_security_definer_exception as exposed_exception
  cross join hardened_security_definer_exception as hardened_exception
  cross join unsupported_default_acl_types as unsupported
  cross join unresolved_roles as unresolved
)
select 'FANMIND_AUTHORIZATION|' || pg_catalog.encode(
  pg_catalog.convert_to(value::text, 'UTF8'),
  'hex'
)
from authorization_result;
`;

function fixedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function sha256Utf8(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function assertNoDuplicateJsonMembers(text) {
  const stack = [];
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === "{") {
      stack.push({ type: "object", keys: new Set() });
      continue;
    }
    if (character === "[") {
      stack.push({ type: "array" });
      continue;
    }
    if (character === "}" || character === "]") {
      stack.pop();
      continue;
    }
    if (character !== '"') continue;
    const start = index;
    let escaped = false;
    for (index += 1; index < text.length; index += 1) {
      if (escaped) {
        escaped = false;
      } else if (text[index] === "\\") {
        escaped = true;
      } else if (text[index] === '"') {
        break;
      }
    }
    let lookahead = index + 1;
    while (/\s/u.test(text[lookahead] ?? "")) lookahead += 1;
    const frame = stack.at(-1);
    if (text[lookahead] !== ":" || frame?.type !== "object") continue;
    let key;
    try {
      key = JSON.parse(text.slice(start, index + 1));
    } catch {
      throw fixedError("authorization_receipt_json_invalid");
    }
    if (frame.keys.has(key)) {
      throw fixedError("authorization_receipt_duplicate_member");
    }
    frame.keys.add(key);
  }
}

function isIsoUtc(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function receiptPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

async function readStablePrivateReceipt(path) {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    if (error?.code === "ELOOP") {
      throw fixedError("authorization_receipt_not_regular");
    }
    throw fixedError("authorization_receipt_read_failed");
  }

  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || before.nlink !== 1n) {
      throw fixedError("authorization_receipt_not_regular");
    }
    if (
      typeof process.getuid !== "function" ||
      before.uid !== BigInt(process.getuid())
    ) {
      throw fixedError("authorization_receipt_owner_mismatch");
    }
    if ((before.mode & 0o777n) !== 0o600n) {
      throw fixedError("authorization_receipt_permissions_invalid");
    }
    if (before.size <= 0n || before.size > BigInt(MAX_RECEIPT_BYTES)) {
      throw fixedError("authorization_receipt_size_invalid");
    }
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.size !== before.size ||
      after.mtimeNs !== before.mtimeNs ||
      after.ctimeNs !== before.ctimeNs ||
      BigInt(bytes.length) !== before.size
    ) {
      bytes.fill(0);
      throw fixedError("authorization_receipt_changed_during_read");
    }
    return bytes;
  } finally {
    await handle.close();
  }
}

function parseFullReceiptV2(bytes) {
  let receipt;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    assertNoDuplicateJsonMembers(text);
    receipt = JSON.parse(text);
  } catch (error) {
    if (error?.code === "authorization_receipt_duplicate_member") throw error;
    throw fixedError("authorization_receipt_json_invalid");
  }
  if (!isRecord(receipt)) {
    throw fixedError("authorization_receipt_record_invalid");
  }
  const keys = Object.keys(receipt).sort();
  if (
    keys.length !== FULL_RECEIPT_V2_KEYS.length ||
    keys.some((key, index) => key !== FULL_RECEIPT_V2_KEYS[index])
  ) {
    throw fixedError("authorization_receipt_keys_invalid");
  }
  if (receipt.schemaVersion !== 2) {
    throw fixedError("authorization_receipt_schema_invalid");
  }
  if (!isIsoUtc(receipt.createdAt)) {
    throw fixedError("authorization_receipt_timestamp_invalid");
  }
  if (!FULL_BACKUP_BASENAME.test(receipt.sourceArtifactBasename)) {
    throw fixedError("authorization_receipt_artifact_invalid");
  }
  if (
    !SHA256.test(receipt.outerSha256) ||
    !SHA256.test(receipt.databasePartEncryptedSha256) ||
    !SHA256.test(receipt.databaseDumpSha256)
  ) {
    throw fixedError("authorization_receipt_hash_invalid");
  }
  if (!COMMIT.test(receipt.productionCommit)) {
    throw fixedError("authorization_receipt_commit_invalid");
  }
  if (
    !receiptPositiveInteger(receipt.databaseAclTocEntryCount) ||
    !receiptPositiveInteger(receipt.databaseDefaultAclTocEntryCount) ||
    !SHA256.test(receipt.databaseAclTocSha256)
  ) {
    throw fixedError("authorization_receipt_toc_invalid");
  }
  if (
    receipt.databasePrivilegesArchived !== true ||
    receipt.databaseOwnershipArchived !== true
  ) {
    throw fixedError("authorization_receipt_archive_invalid");
  }
  if (receipt.verifier !== "passed") {
    throw fixedError("authorization_receipt_verifier_invalid");
  }
  validateAuthorizationContract(receipt);
  return receipt;
}

async function readReceiptAuthorizationContract(receiptPath) {
  const path = clean(receiptPath);
  if (!isAbsolute(path) || /[\u0000\r\n]/u.test(path)) {
    throw fixedError("authorization_receipt_path_invalid");
  }
  const bytes = await readStablePrivateReceipt(path);
  try {
    return validateAuthorizationContract(parseFullReceiptV2(bytes));
  } finally {
    bytes.fill(0);
  }
}

function validateConnectionOptions(options) {
  if (!isRecord(options)) throw fixedError("authorization_options_invalid");
  const psqlBin = clean(options.psqlBin);
  const host = clean(options.host);
  const port = clean(options.port);
  const username = clean(options.username);
  const database = clean(options.database);
  if (!isAbsolute(psqlBin)) throw fixedError("authorization_psql_bin_invalid");
  if (!host || host.length > 255 || /[\u0000\r\n]/u.test(host)) {
    throw fixedError("authorization_host_invalid");
  }
  if (!/^\d{1,5}$/u.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw fixedError("authorization_port_invalid");
  }
  for (const [value, code] of [
    [username, "authorization_username_invalid"],
    [database, "authorization_database_invalid"],
  ]) {
    if (!value || Buffer.byteLength(value, "utf8") > 63 || /[\u0000\r\n]/u.test(value)) {
      throw fixedError(code);
    }
  }
  if (options.env !== undefined && !isRecord(options.env)) {
    throw fixedError("authorization_environment_invalid");
  }
  return Object.freeze({
    psqlBin,
    host,
    port,
    username,
    database,
    env: options.env ?? {},
  });
}

function psqlArguments(options) {
  return [
    ...PSQL_ARGS,
    "--host",
    options.host,
    "--port",
    options.port,
    "--username",
    options.username,
    "--dbname",
    options.database,
  ];
}

function psqlEnvironment(environment, applicationName) {
  const safeEnvironment = Object.fromEntries(
    Object.entries(environment).filter(([name]) => !name.startsWith("PG")),
  );
  for (const name of ALLOWED_LIBPQ_ENVIRONMENT) {
    if (Object.hasOwn(environment, name)) {
      safeEnvironment[name] = environment[name];
    }
  }
  return {
    ...safeEnvironment,
    LANG: "C",
    LC_ALL: "C",
    PGAPPNAME: applicationName,
    PGOPTIONS:
      "-c default_transaction_read_only=on " +
      "-c search_path=pg_catalog,pg_temp",
  };
}

function decodeHexJson(value, code) {
  if (!/^(?:[0-9a-f]{2})+$/u.test(value) || value.length > MAX_PROCESS_OUTPUT_BYTES) {
    throw fixedError(code);
  }
  try {
    const bytes = Buffer.from(value, "hex");
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(text);
  } catch {
    throw fixedError(code);
  }
}

function normalizeContractSource(value) {
  if (!isRecord(value)) throw fixedError("authorization_contract_invalid");
  if (isRecord(value.authorization_contract)) return value.authorization_contract;
  if (isRecord(value.authorizationContract)) return value.authorizationContract;
  if (isRecord(value.database_authorization_contract)) {
    return value.database_authorization_contract;
  }
  if (isRecord(value.databaseAuthorizationContract)) {
    return value.databaseAuthorizationContract;
  }
  if (isRecord(value.manifest)) return normalizeContractSource(value.manifest);
  return value;
}

function camelOrSnake(value, camelName, snakeName) {
  return value[camelName] ?? value[snakeName];
}

function validateRoleList(value) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MAX_REQUIRED_ROLES
  ) {
    throw fixedError("authorization_contract_roles_invalid");
  }
  const roles = value.map((role) => {
    const roleBytes = typeof role === "string"
      ? Buffer.from(role, "utf8")
      : Buffer.alloc(0);
    if (
      typeof role !== "string" ||
      !SAFE_ROLE.test(role) ||
      roleBytes.length > MAX_ROLE_BYTES ||
      new TextDecoder("utf-8", { fatal: true }).decode(roleBytes) !== role
    ) {
      throw fixedError("authorization_contract_roles_invalid");
    }
    return role;
  });
  const sorted = [...roles].sort((left, right) =>
    Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8")),
  );
  if (
    roles.some((role, index) => role !== sorted[index]) ||
    new Set(roles).size !== roles.length
  ) {
    throw fixedError("authorization_contract_roles_invalid");
  }
  return Object.freeze(roles);
}

function validateExtensionList(value) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MAX_REQUIRED_EXTENSIONS
  ) {
    throw fixedError("authorization_contract_extensions_invalid");
  }
  const descriptors = value.map((descriptor) => {
    if (!isRecord(descriptor)) {
      throw fixedError("authorization_contract_extensions_invalid");
    }
    const keys = Object.keys(descriptor).sort();
    const expectedKeys = [
      "name",
      "owner",
      "relocatable",
      "schema",
      "schemaDefinitionArchived",
      "schemaOwner",
      "version",
    ].sort();
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key, index) => key !== expectedKeys[index]) ||
      !SAFE_TOC_IDENTIFIER.test(descriptor.name) ||
      !SAFE_TOC_IDENTIFIER.test(descriptor.schema) ||
      !SAFE_TOC_IDENTIFIER.test(descriptor.owner) ||
      !SAFE_TOC_IDENTIFIER.test(descriptor.schemaOwner) ||
      typeof descriptor.version !== "string" ||
      Buffer.byteLength(descriptor.version, "utf8") >
        MAX_EXTENSION_VERSION_BYTES ||
      !SAFE_EXTENSION_VERSION.test(descriptor.version) ||
      typeof descriptor.relocatable !== "boolean" ||
      typeof descriptor.schemaDefinitionArchived !== "boolean"
    ) {
      throw fixedError("authorization_contract_extensions_invalid");
    }
    return Object.freeze({
      name: descriptor.name,
      version: descriptor.version,
      schema: descriptor.schema,
      owner: descriptor.owner,
      relocatable: descriptor.relocatable,
      schemaOwner: descriptor.schemaOwner,
      schemaDefinitionArchived: descriptor.schemaDefinitionArchived,
    });
  });
  const sorted = [...descriptors].sort((left, right) =>
    Buffer.compare(Buffer.from(left.name, "utf8"), Buffer.from(right.name, "utf8")),
  );
  if (
    descriptors.some((descriptor, index) => descriptor.name !== sorted[index].name) ||
    new Set(descriptors.map((descriptor) => descriptor.name)).size !==
      descriptors.length
  ) {
    throw fixedError("authorization_contract_extensions_invalid");
  }
  return Object.freeze(descriptors);
}

function positiveInteger(value, maximum, code) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw fixedError(code);
  }
  return value;
}

export function validateAuthorizationContract(value) {
  const source = normalizeContractSource(value);
  const flatReceipt = source.databaseAuthorizationContractVersion !== undefined;
  const schemaVersion = flatReceipt
    ? source.databaseAuthorizationContractVersion
    : camelOrSnake(source, "schemaVersion", "schema_version");
  const canonicalization = flatReceipt
    ? CANONICALIZATION
    : camelOrSnake(source, "canonicalization", "canonicalization");
  const fingerprintSha256 = flatReceipt
    ? source.databaseAuthorizationFingerprintSha256
    : camelOrSnake(source, "fingerprintSha256", "fingerprint_sha256");
  const recordCount = flatReceipt
    ? source.databaseAuthorizationRecordCount
    : camelOrSnake(source, "recordCount", "record_count");
  const grantTupleCount = flatReceipt
    ? source.databaseAuthorizationGrantTupleCount
    : camelOrSnake(source, "grantTupleCount", "grant_tuple_count");
  const requiredRoles = validateRoleList(
    flatReceipt
      ? source.databaseAuthorizationRequiredRoles
      : camelOrSnake(source, "requiredRoles", "required_roles"),
  );
  const requiredRolesSha256 = flatReceipt
    ? source.databaseAuthorizationRequiredRolesSha256
    : camelOrSnake(source, "requiredRolesSha256", "required_roles_sha256");
  const roleFingerprintSha256 = flatReceipt
    ? source.databaseAuthorizationRoleFingerprintSha256
    : camelOrSnake(
      source,
      "roleFingerprintSha256",
      "role_fingerprint_sha256",
    );
  const roleRecordCount = flatReceipt
    ? source.databaseAuthorizationRoleRecordCount
    : camelOrSnake(source, "roleRecordCount", "role_record_count");
  const databaseContainerFingerprintSha256 = flatReceipt
    ? source.databaseAuthorizationContainerFingerprintSha256
    : camelOrSnake(
      source,
      "databaseContainerFingerprintSha256",
      "database_container_fingerprint_sha256",
    );
  const databaseContainerRecordCount = flatReceipt
    ? source.databaseAuthorizationContainerRecordCount
    : camelOrSnake(
      source,
      "databaseContainerRecordCount",
      "database_container_record_count",
    );
  const requiredExtensions = validateExtensionList(
    flatReceipt
      ? source.databaseAuthorizationRequiredExtensions
      : camelOrSnake(source, "requiredExtensions", "required_extensions"),
  );
  const requiredExtensionsSha256 = flatReceipt
    ? source.databaseAuthorizationRequiredExtensionsSha256
    : camelOrSnake(
      source,
      "requiredExtensionsSha256",
      "required_extensions_sha256",
    );
  const extensionFingerprintSha256 = flatReceipt
    ? source.databaseAuthorizationExtensionFingerprintSha256
    : camelOrSnake(
      source,
      "extensionFingerprintSha256",
      "extension_fingerprint_sha256",
    );
  const extensionRecordCount = flatReceipt
    ? source.databaseAuthorizationExtensionRecordCount
    : camelOrSnake(
      source,
      "extensionRecordCount",
      "extension_record_count",
    );
  const coreTableAppGrantTupleCount = flatReceipt
    ? source.databaseCoreTableAppGrantTupleCount
    : camelOrSnake(
      source,
      "coreTableAppGrantTupleCount",
      "core_table_app_grant_tuple_count",
    );
  const restrictedSecurityDefinerFunctionCount = flatReceipt
    ? source.databaseRestrictedSecurityDefinerFunctionCount
    : camelOrSnake(
      source,
      "restrictedSecurityDefinerFunctionCount",
      "restricted_security_definer_function_count",
    );

  if (schemaVersion !== SCHEMA_VERSION) {
    throw fixedError("authorization_contract_schema_invalid");
  }
  if (canonicalization !== CANONICALIZATION) {
    throw fixedError("authorization_contract_canonicalization_invalid");
  }
  if (typeof fingerprintSha256 !== "string" || !SHA256.test(fingerprintSha256)) {
    throw fixedError("authorization_contract_fingerprint_invalid");
  }
  positiveInteger(
    recordCount,
    MAX_RECORD_COUNT,
    "authorization_contract_record_count_invalid",
  );
  positiveInteger(
    grantTupleCount,
    MAX_GRANT_TUPLE_COUNT,
    "authorization_contract_grant_count_invalid",
  );
  if (
    typeof requiredRolesSha256 !== "string" ||
    !SHA256.test(requiredRolesSha256) ||
    requiredRolesSha256 !== sha256Utf8(JSON.stringify(requiredRoles))
  ) {
    throw fixedError("authorization_contract_roles_sha_invalid");
  }
  if (typeof roleFingerprintSha256 !== "string" || !SHA256.test(roleFingerprintSha256)) {
    throw fixedError("authorization_contract_role_fingerprint_invalid");
  }
  positiveInteger(
    roleRecordCount,
    MAX_ROLE_RECORD_COUNT,
    "authorization_contract_role_record_count_invalid",
  );
  if (
    typeof databaseContainerFingerprintSha256 !== "string" ||
    !SHA256.test(databaseContainerFingerprintSha256)
  ) {
    throw fixedError("authorization_contract_database_container_fingerprint_invalid");
  }
  positiveInteger(
    databaseContainerRecordCount,
    MAX_DATABASE_CONTAINER_RECORD_COUNT,
    "authorization_contract_database_container_record_count_invalid",
  );
  if (
    typeof requiredExtensionsSha256 !== "string" ||
    !SHA256.test(requiredExtensionsSha256) ||
    requiredExtensionsSha256 !== sha256Utf8(JSON.stringify(requiredExtensions))
  ) {
    throw fixedError("authorization_contract_extensions_sha_invalid");
  }
  if (
    typeof extensionFingerprintSha256 !== "string" ||
    !SHA256.test(extensionFingerprintSha256)
  ) {
    throw fixedError("authorization_contract_extension_fingerprint_invalid");
  }
  positiveInteger(
    extensionRecordCount,
    MAX_EXTENSION_RECORD_COUNT,
    "authorization_contract_extension_record_count_invalid",
  );
  if (coreTableAppGrantTupleCount !== CORE_TABLE_APP_GRANT_TUPLE_COUNT) {
    throw fixedError("authorization_contract_core_grants_invalid");
  }
  if (
    restrictedSecurityDefinerFunctionCount !==
    RESTRICTED_SECURITY_DEFINER_FUNCTION_COUNT
  ) {
    throw fixedError("authorization_contract_security_definers_invalid");
  }

  return Object.freeze({
    schemaVersion,
    canonicalization,
    fingerprintSha256,
    recordCount,
    grantTupleCount,
    requiredRoles,
    requiredRolesSha256,
    roleFingerprintSha256,
    roleRecordCount,
    databaseContainerFingerprintSha256,
    databaseContainerRecordCount,
    requiredExtensions,
    requiredExtensionsSha256,
    extensionFingerprintSha256,
    extensionRecordCount,
    coreTableAppGrantTupleCount,
    restrictedSecurityDefinerFunctionCount,
  });
}

function contractFromDatabasePayload(value) {
  if (!isRecord(value)) throw fixedError("authorization_query_result_invalid");
  if (
    !Number.isSafeInteger(value.server_version_num) ||
    value.server_version_num < 170000 ||
    value.server_version_num >= 180000
  ) {
    throw fixedError("authorization_server_version_invalid");
  }
  if (value.unsupported_default_acl_type_count !== 0) {
    throw fixedError("authorization_default_acl_type_unsupported");
  }
  if (value.unresolved_role_oid_count !== 0) {
    throw fixedError("authorization_role_oid_unresolved");
  }
  if (value.core_table_app_grant_option_count !== 0) {
    throw fixedError("authorization_core_grant_option_unsupported");
  }
  if (value.core_table_app_grant_row_count !== CORE_TABLE_APP_GRANT_TUPLE_COUNT) {
    throw fixedError("authorization_core_grant_matrix_invalid");
  }
  if (value.container_recovery_invariant_violation_count !== 0) {
    throw fixedError("authorization_container_recovery_invariant_invalid");
  }
  if (value.extension_recovery_invariant_violation_count !== 0) {
    throw fixedError("authorization_extension_recovery_invariant_invalid");
  }
  if (value.extension_contract_unsupported_class_count !== 0) {
    throw fixedError("authorization_extension_class_unsupported");
  }
  if (value.extension_contract_invariant_violation_count !== 0) {
    throw fixedError("authorization_extension_contract_invariant_invalid");
  }
  if (
    value.public_security_definer_function_count !== 13 ||
    !(
      (value.exposed_security_definer_exception_count === 1 &&
        value.hardened_security_definer_exception_count === 0) ||
      (value.exposed_security_definer_exception_count === 0 &&
        value.hardened_security_definer_exception_count === 1)
    )
  ) {
    throw fixedError("authorization_security_definer_boundary_invalid");
  }
  const requiredRoles = value.required_roles;
  if (!Array.isArray(requiredRoles)) {
    throw fixedError("authorization_query_result_invalid");
  }
  return validateAuthorizationContract({
    schemaVersion: SCHEMA_VERSION,
    canonicalization: CANONICALIZATION,
    fingerprintSha256: value.fingerprint_sha256,
    recordCount: Number(value.record_count),
    grantTupleCount: Number(value.grant_tuple_count),
    requiredRoles,
    requiredRolesSha256: sha256Utf8(JSON.stringify(requiredRoles)),
    roleFingerprintSha256: value.role_fingerprint_sha256,
    roleRecordCount: Number(value.role_record_count),
    databaseContainerFingerprintSha256:
      value.database_container_fingerprint_sha256,
    databaseContainerRecordCount:
      Number(value.database_container_record_count),
    requiredExtensions: value.required_extensions,
    requiredExtensionsSha256: sha256Utf8(
      JSON.stringify(validateExtensionList(value.required_extensions)),
    ),
    extensionFingerprintSha256: value.extension_fingerprint_sha256,
    extensionRecordCount: Number(value.extension_record_count),
    coreTableAppGrantTupleCount: value.core_table_app_grant_tuple_count,
    restrictedSecurityDefinerFunctionCount:
      value.restricted_security_definer_function_count,
  });
}

function transactionPrefix() {
  return String.raw`begin isolation level repeatable read, read only;
set local search_path = pg_catalog, pg_temp;
set local standard_conforming_strings = on;
`;
}

function initialSnapshotSql() {
  return `${transactionPrefix()}select 'FANMIND_SNAPSHOT|' || pg_catalog.pg_export_snapshot();
-- FANMIND_AUTHORIZATION_FRAME
${DATABASE_AUTHORIZATION_CONTRACT_SQL}
select 'FANMIND_READY';
`;
}

function oneShotAuthorizationSql(
  authorizationSql = DATABASE_AUTHORIZATION_CONTRACT_SQL,
) {
  return `${transactionPrefix()}-- FANMIND_AUTHORIZATION_FRAME
${authorizationSql}
rollback;
`;
}

export function authorizationContractSqlExcludingTargetLogin(targetLoginRole) {
  const role = clean(targetLoginRole);
  if (
    !role ||
    Buffer.byteLength(role, "utf8") > 63 ||
    /[\u0000\r\n]/u.test(role)
  ) {
    throw fixedError("authorization_target_projection_role_invalid");
  }
  const loginSeed = `  select login_role.oid
  from pg_catalog.pg_roles as login_role
  where login_role.rolcanlogin`;
  const projectedLoginSeed = `${loginSeed}
    and login_role.rolname <> ${encodedRoleSql(role)}`;
  const segments = DATABASE_AUTHORIZATION_CONTRACT_SQL.split(loginSeed);
  if (segments.length !== 2) {
    throw fixedError("authorization_target_projection_sql_invalid");
  }
  return segments.join(projectedLoginSeed);
}

function spawnPsql(options, applicationName) {
  let child;
  try {
    child = spawn(options.psqlBin, psqlArguments(options), {
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      env: psqlEnvironment(options.env, applicationName),
    });
  } catch {
    throw fixedError("authorization_psql_start_failed");
  }
  return child;
}

function collectProcess(child, input, expectedFrame) {
  return new Promise((resolvePromise, reject) => {
    let stdout = Buffer.alloc(0);
    let stderrBytes = 0;
    let settled = false;
    const timeout = setTimeout(() => {
      finish(fixedError("authorization_query_timeout"));
      child.kill("SIGTERM");
    }, INITIAL_QUERY_TIMEOUT_MS);

    function finish(error, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolvePromise(value);
    }

    child.once("error", () => {
      finish(fixedError("authorization_psql_start_failed"));
    });
    child.stdin.once("error", () => {
      finish(fixedError("authorization_query_failed"));
    });
    child.stdout.on("data", (chunk) => {
      if (stdout.length + chunk.length > MAX_PROCESS_OUTPUT_BYTES) {
        finish(fixedError("authorization_query_output_invalid"));
        child.kill("SIGTERM");
        return;
      }
      stdout = Buffer.concat([stdout, chunk]);
    });
    child.stderr.on("data", (chunk) => {
      stderrBytes += chunk.length;
      if (stderrBytes > MAX_PROCESS_OUTPUT_BYTES) {
        finish(fixedError("authorization_query_output_invalid"));
        child.kill("SIGTERM");
      }
    });
    child.once("close", (code) => {
      if (settled) return;
      if (code !== 0) {
        finish(fixedError("authorization_query_failed"));
        return;
      }
      let text;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(stdout);
      } catch {
        finish(fixedError("authorization_query_output_invalid"));
        return;
      }
      const lines = text.split(/\r?\n/u).filter(Boolean);
      if (lines.length !== 1 || !lines[0].startsWith(`${expectedFrame}|`)) {
        finish(fixedError("authorization_query_output_invalid"));
        return;
      }
      finish(null, lines[0].slice(expectedFrame.length + 1));
    });

    child.stdin.end(input);
  });
}

export async function captureDatabaseAuthorizationContract(options) {
  const connection = validateConnectionOptions(options);
  const child = spawnPsql(connection, "fanmind-authorization-target-snapshot");
  const frame = await collectProcess(
    child,
    oneShotAuthorizationSql(),
    "FANMIND_AUTHORIZATION",
  );
  return contractFromDatabasePayload(
    decodeHexJson(frame, "authorization_query_output_invalid"),
  );
}

export async function captureProjectedTargetAuthorizationContract(options) {
  const connection = validateConnectionOptions(options);
  const child = spawnPsql(
    connection,
    "fanmind-authorization-target-projected-snapshot",
  );
  const frame = await collectProcess(
    child,
    oneShotAuthorizationSql(
      authorizationContractSqlExcludingTargetLogin(connection.username),
    ),
    "FANMIND_AUTHORIZATION",
  );
  return contractFromDatabasePayload(
    decodeHexJson(frame, "authorization_query_output_invalid"),
  );
}

function waitForSnapshotFrames(child) {
  return new Promise((resolvePromise, reject) => {
    let pending = Buffer.alloc(0);
    let outputBytes = 0;
    let stderrBytes = 0;
    let snapshotId;
    let contract;
    let settled = false;
    const timeout = setTimeout(() => {
      fail(fixedError("authorization_query_timeout"));
    }, INITIAL_QUERY_TIMEOUT_MS);

    function fail(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.kill("SIGTERM");
      reject(error);
    }

    function succeed() {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolvePromise({ snapshotId, contract });
    }

    function processLine(lineBytes) {
      let line;
      try {
        line = new TextDecoder("utf-8", { fatal: true }).decode(lineBytes);
      } catch {
        fail(fixedError("authorization_query_output_invalid"));
        return;
      }
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line) return;
      if (line.startsWith("FANMIND_SNAPSHOT|")) {
        if (snapshotId !== undefined) {
          fail(fixedError("authorization_query_output_invalid"));
          return;
        }
        const candidate = line.slice("FANMIND_SNAPSHOT|".length);
        if (!SNAPSHOT_ID.test(candidate)) {
          fail(fixedError("authorization_snapshot_id_invalid"));
          return;
        }
        snapshotId = candidate;
        return;
      }
      if (line.startsWith("FANMIND_AUTHORIZATION|")) {
        if (contract !== undefined) {
          fail(fixedError("authorization_query_output_invalid"));
          return;
        }
        try {
          contract = contractFromDatabasePayload(
            decodeHexJson(
              line.slice("FANMIND_AUTHORIZATION|".length),
              "authorization_query_output_invalid",
            ),
          );
        } catch (error) {
          fail(error);
        }
        return;
      }
      if (line === "FANMIND_READY") {
        if (!snapshotId || !contract) {
          fail(fixedError("authorization_query_output_invalid"));
          return;
        }
        succeed();
        return;
      }
      fail(fixedError("authorization_query_output_invalid"));
    }

    child.once("error", () => {
      fail(fixedError("authorization_psql_start_failed"));
    });
    child.stdin.once("error", () => {
      fail(fixedError("authorization_query_failed"));
    });
    child.stdout.on("data", (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_PROCESS_OUTPUT_BYTES) {
        fail(fixedError("authorization_query_output_invalid"));
        return;
      }
      pending = Buffer.concat([pending, chunk]);
      let newline;
      while ((newline = pending.indexOf(0x0a)) >= 0) {
        const line = pending.subarray(0, newline);
        pending = pending.subarray(newline + 1);
        processLine(line);
        if (settled) return;
      }
    });
    child.stderr.on("data", (chunk) => {
      stderrBytes += chunk.length;
      if (stderrBytes > MAX_PROCESS_OUTPUT_BYTES) {
        fail(fixedError("authorization_query_output_invalid"));
      }
    });
    child.once("close", () => {
      if (!settled) fail(fixedError("authorization_snapshot_closed"));
    });
  });
}

function closeSnapshotProcess(child) {
  return new Promise((resolvePromise, reject) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      if (child.exitCode === 0) resolvePromise();
      else reject(fixedError("authorization_snapshot_close_failed"));
      return;
    }
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      reject(fixedError("authorization_snapshot_close_failed"));
    }, CLOSE_TIMEOUT_MS);
    child.once("error", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(fixedError("authorization_snapshot_close_failed"));
    });
    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code === 0) resolvePromise();
      else reject(fixedError("authorization_snapshot_close_failed"));
    });
    child.stdin.end("rollback;\n\\q\n");
  });
}

export async function openDatabaseAuthorizationSnapshot(options) {
  const connection = validateConnectionOptions(options);
  const child = spawnPsql(connection, "fanmind-authorization-source-snapshot");
  const framesPromise = waitForSnapshotFrames(child);
  child.stdin.write(initialSnapshotSql());
  const frames = await framesPromise;
  let closed = false;
  return Object.freeze({
    snapshotId: frames.snapshotId,
    contract: frames.contract,
    close: async () => {
      if (closed) return;
      closed = true;
      await closeSnapshotProcess(child);
    },
  });
}

function encodedRoleSql(role) {
  const hex = Buffer.from(role, "utf8").toString("hex");
  return "pg_catalog.convert_from(" +
    `pg_catalog.decode('${hex}', 'hex'), ` +
    "'UTF8')";
}

function targetRoleQuery(requiredRoles) {
  const rows = requiredRoles
    .map((role) => `(${encodedRoleSql(role)})`)
    .join(",\n");
  return String.raw`${transactionPrefix()}with recursive required_roles(role_name) as (
  values ${rows}
), present_roles as (
  select role_definition.oid, role_definition.rolname
  from required_roles as required
  join pg_catalog.pg_roles as role_definition
    on role_definition.rolname = required.role_name
),
${DATABASE_CONTAINER_CTES_SQL},
${EXTENSION_CONTRACT_CTES_SQL},
role_component(role_oid) as (
  select present.oid from present_roles as present

  union

  select membership_endpoint.role_oid
  from pg_catalog.pg_auth_members as membership
  join role_component as connected_role
    on connected_role.role_oid in (
      membership.member,
      membership.roleid,
      membership.grantor
    )
  cross join lateral (
    values
      (membership.member),
      (membership.roleid),
      (membership.grantor)
  ) as membership_endpoint(role_oid)
), canonical_role_records as (
  select pg_catalog.encode(
    pg_catalog.convert_to(
      pg_catalog.jsonb_build_array(
        '${CANONICALIZATION}',
        'role',
        '',
        role_definition.rolname,
        '',
        null,
        'attributes',
        pg_catalog.jsonb_build_array(
          role_definition.rolsuper,
          role_definition.rolinherit,
          role_definition.rolcreaterole,
          role_definition.rolcreatedb,
          role_definition.rolcanlogin,
          role_definition.rolreplication,
          role_definition.rolbypassrls,
          role_definition.rolconnlimit,
          case
            when role_definition.rolvaliduntil is null then null
            when role_definition.rolvaliduntil =
                 'infinity'::pg_catalog.timestamptz
              then 'infinity'
            when role_definition.rolvaliduntil =
                 '-infinity'::pg_catalog.timestamptz
              then '-infinity'
            else pg_catalog.to_char(
              role_definition.rolvaliduntil at time zone 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
            )
          end,
          coalesce((
            select pg_catalog.jsonb_agg(
              role_setting.setting
              order by role_setting.setting collate "C"
            )
            from pg_catalog.unnest(role_definition.rolconfig)
              as role_setting(setting)
          ), '[]'::pg_catalog.jsonb)
        )
      )::text,
      'UTF8'
    ),
    'hex'
  ) as record_hex
  from role_component as connected_role
  join pg_catalog.pg_roles as role_definition
    on role_definition.oid = connected_role.role_oid

  union all

  select pg_catalog.encode(
    pg_catalog.convert_to(
      pg_catalog.jsonb_build_array(
        '${CANONICALIZATION}',
        'role_membership',
        '',
        member_role.rolname,
        parent_role.rolname,
        null,
        'membership',
        pg_catalog.jsonb_build_array(
          grantor_role.rolname,
          membership.admin_option,
          membership.inherit_option,
          membership.set_option
        )
      )::text,
      'UTF8'
    ),
    'hex'
  ) as record_hex
  from pg_catalog.pg_auth_members as membership
  join role_component as connected_member
    on connected_member.role_oid = membership.member
  join pg_catalog.pg_roles as member_role
    on member_role.oid = membership.member
  join pg_catalog.pg_roles as parent_role
    on parent_role.oid = membership.roleid
  join pg_catalog.pg_roles as grantor_role
    on grantor_role.oid = membership.grantor
), role_payload as (
  select
    count(*)::integer as record_count,
    pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(
          coalesce(
            pg_catalog.string_agg(
              record_hex,
              E'\n'
              order by record_hex collate "C"
            ) || E'\n',
            ''
          ),
          'UTF8'
        )
      ),
      'hex'
    ) as fingerprint_sha256
  from canonical_role_records
), component_roles as (
  select coalesce(
    pg_catalog.jsonb_agg(
      role_definition.rolname
      order by role_definition.rolname collate "C"
    ),
    '[]'::pg_catalog.jsonb
  ) as role_names
  from role_component as connected_role
  join pg_catalog.pg_roles as role_definition
    on role_definition.oid = connected_role.role_oid
), role_result as (
  select pg_catalog.jsonb_build_object(
    'server_version_num', current_setting('server_version_num')::integer,
    'required_role_count', (select count(*) from required_roles),
    'present_role_count', (
      select count(*)
      from present_roles
    ),
    'component_roles', component.role_names,
    'role_fingerprint_sha256', role_payload.fingerprint_sha256,
    'role_record_count', role_payload.record_count,
    'database_container_fingerprint_sha256',
      pg_catalog.encode(
        pg_catalog.sha256(
          pg_catalog.convert_to(
            database_container.payload_text,
            'UTF8'
          )
        ),
        'hex'
      ),
    'database_container_record_count',
      database_container.record_count,
    'database_container_invariant_violation_count',
      database_container_invariants.violation_count,
    'extension_fingerprint_sha256',
      pg_catalog.encode(
        pg_catalog.sha256(
          pg_catalog.convert_to(
            extension_contract.payload_text,
            'UTF8'
          )
        ),
        'hex'
      ),
    'extension_record_count', extension_contract.record_count,
    'required_extensions', required_extension.descriptors,
    'extension_contract_invariant_violation_count',
      extension_contract_invariants.violation_count,
    'extension_contract_unsupported_class_count',
      extension_contract_invariants.unsupported_class_count,
    'restore_user_superuser', coalesce((
      select role_definition.rolsuper
      from pg_catalog.pg_roles as role_definition
      where role_definition.rolname = current_user
    ), false),
    'restore_user_login', coalesce((
      select role_definition.rolcanlogin
      from pg_catalog.pg_roles as role_definition
      where role_definition.rolname = current_user
    ), false),
    'restore_user_outside_component', not exists (
      select 1
      from role_component as connected_role
      join pg_catalog.pg_roles as role_definition
        on role_definition.oid = connected_role.role_oid
      where role_definition.rolname = current_user
    ),
    'outside_component_login_role_count', (
      select count(*)
      from pg_catalog.pg_roles as role_definition
      where role_definition.rolcanlogin
        and not exists (
          select 1
          from role_component as connected_role
          where connected_role.role_oid = role_definition.oid
        )
    ),
    'outside_component_superuser_role_count', (
      select count(*)
      from pg_catalog.pg_roles as role_definition
      where role_definition.rolsuper
        and not exists (
          select 1
          from role_component as connected_role
          where connected_role.role_oid = role_definition.oid
        )
    )
  ) as value
  from role_payload
  cross join component_roles as component
  cross join database_container_payload as database_container
  cross join database_container_invariants as database_container_invariants
  cross join extension_contract_payload as extension_contract
  cross join required_extensions as required_extension
  cross join extension_contract_invariants as extension_contract_invariants
)
select 'FANMIND_ROLE_CHECK|' || pg_catalog.encode(
  pg_catalog.convert_to(value::text, 'UTF8'),
  'hex'
)
from role_result;
rollback;
`;
}

export async function assertDatabaseAuthorizationRoles(options) {
  if (!isRecord(options)) {
    throw fixedError("authorization_receipt_path_invalid");
  }
  const contract = await readReceiptAuthorizationContract(options.receiptPath);
  const connection = validateConnectionOptions(options);
  const child = spawnPsql(connection, "fanmind-authorization-role-preflight");
  const frame = await collectProcess(
    child,
    targetRoleQuery(contract.requiredRoles),
    "FANMIND_ROLE_CHECK",
  );
  const result = decodeHexJson(frame, "authorization_role_query_output_invalid");
  if (
    !isRecord(result) ||
    !Number.isSafeInteger(result.server_version_num) ||
    result.server_version_num < 170000 ||
    result.server_version_num >= 180000
  ) {
    throw fixedError("authorization_server_version_invalid");
  }
  if (
    result.required_role_count !== contract.requiredRoles.length ||
    result.present_role_count !== contract.requiredRoles.length
  ) {
    throw fixedError("authorization_required_roles_missing");
  }
  if (
    !Array.isArray(result.component_roles) ||
    result.component_roles.length !== contract.requiredRoles.length ||
    result.component_roles.some(
      (role, index) => role !== contract.requiredRoles[index],
    ) ||
    result.role_fingerprint_sha256 !== contract.roleFingerprintSha256 ||
    result.role_record_count !== contract.roleRecordCount
  ) {
    throw fixedError("authorization_role_contract_mismatch");
  }
  if (
    result.database_container_fingerprint_sha256 !==
      contract.databaseContainerFingerprintSha256 ||
    result.database_container_record_count !==
      contract.databaseContainerRecordCount
  ) {
    throw fixedError("authorization_database_container_contract_mismatch");
  }
  if (result.database_container_invariant_violation_count !== 0) {
    throw fixedError("authorization_database_container_invariant_invalid");
  }
  let targetExtensions;
  try {
    targetExtensions = validateExtensionList(result.required_extensions);
  } catch {
    throw fixedError("authorization_extension_contract_mismatch");
  }
  if (
    result.extension_contract_unsupported_class_count !== 0
  ) {
    throw fixedError("authorization_extension_class_unsupported");
  }
  if (
    result.extension_contract_invariant_violation_count !== 0 ||
    result.extension_fingerprint_sha256 !==
      contract.extensionFingerprintSha256 ||
    result.extension_record_count !== contract.extensionRecordCount ||
    JSON.stringify(targetExtensions) !== JSON.stringify(contract.requiredExtensions)
  ) {
    throw fixedError("authorization_extension_contract_mismatch");
  }
  if (result.restore_user_superuser !== true) {
    throw fixedError("authorization_restore_user_not_superuser");
  }
  if (
    result.restore_user_login !== true ||
    result.restore_user_outside_component !== true ||
    result.outside_component_login_role_count !== 1 ||
    result.outside_component_superuser_role_count !== 1
  ) {
    throw fixedError("authorization_target_principal_boundary_invalid");
  }
  return Object.freeze({
    requiredRoleCount: contract.requiredRoles.length,
    verified: true,
  });
}

export function analyzeAuthorizationToc(text) {
  if (
    typeof text !== "string" ||
    text.length === 0 ||
    Buffer.byteLength(text, "utf8") > 32 * 1024 * 1024 ||
    text.includes("\u0000")
  ) {
    throw fixedError("authorization_toc_invalid");
  }
  const activeAuthorizationLines = [];
  const seenDumpIds = new Set();
  let aclEntryCount = 0;
  let defaultAclEntryCount = 0;
  for (const rawLine of text.split(/\n/u)) {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    if (!line || line.startsWith(";")) continue;
    const match = line.match(
      /^([1-9]\d*); [0-9]+ [0-9]+ (DEFAULT ACL|ACL) .+$/u,
    );
    if (!match) {
      if (
        /^[1-9]\d*;\s+\d+\s+\d+\s+(?:DEFAULT ACL|ACL)(?:\s|$)/u.test(line)
      ) {
        throw fixedError("authorization_toc_invalid");
      }
      continue;
    }
    if (seenDumpIds.has(match[1])) {
      throw fixedError("authorization_toc_duplicate_entry");
    }
    seenDumpIds.add(match[1]);
    activeAuthorizationLines.push(line);
    if (match[2] === "DEFAULT ACL") defaultAclEntryCount += 1;
    else aclEntryCount += 1;
  }
  const canonical = activeAuthorizationLines.length > 0
    ? `${activeAuthorizationLines.join("\n")}\n`
    : "";
  return Object.freeze({
    aclEntryCount,
    defaultAclEntryCount,
    sha256: sha256Utf8(canonical),
  });
}

function parseCli(argv) {
  const command = argv[2];
  if (!new Set(["verify-target-roles", "snapshot-target"]).has(command)) {
    throw fixedError("authorization_cli_invalid");
  }
  const values = {};
  const allowed = new Map([
    ["--receipt", "receiptPath"],
    ["--psql-bin", "psqlBin"],
    ["--host", "host"],
    ["--port", "port"],
    ["--username", "username"],
    ["--dbname", "database"],
  ]);
  for (let index = 3; index < argv.length; index += 2) {
    const name = argv[index];
    const key = allowed.get(name);
    const value = argv[index + 1];
    if (!key || value === undefined || values[key] !== undefined) {
      throw fixedError("authorization_cli_invalid");
    }
    values[key] = value;
  }
  const required = [
    "receiptPath",
    "psqlBin",
    "host",
    "port",
    "username",
    "database",
  ];
  if (required.some((key) => values[key] === undefined)) {
    throw fixedError("authorization_cli_invalid");
  }
  return Object.freeze({ command, values });
}

function authorizationDatabaseStateEqual(left, right) {
  return (
    left.schemaVersion === right.schemaVersion &&
    left.canonicalization === right.canonicalization &&
    left.fingerprintSha256 === right.fingerprintSha256 &&
    left.recordCount === right.recordCount &&
    left.grantTupleCount === right.grantTupleCount &&
    left.databaseContainerFingerprintSha256 ===
      right.databaseContainerFingerprintSha256 &&
    left.databaseContainerRecordCount === right.databaseContainerRecordCount &&
    left.requiredExtensionsSha256 === right.requiredExtensionsSha256 &&
    left.extensionFingerprintSha256 === right.extensionFingerprintSha256 &&
    left.extensionRecordCount === right.extensionRecordCount &&
    left.coreTableAppGrantTupleCount === right.coreTableAppGrantTupleCount &&
    left.restrictedSecurityDefinerFunctionCount ===
      right.restrictedSecurityDefinerFunctionCount
  );
}

export async function snapshotTargetDatabaseAuthorization(options) {
  if (!isRecord(options)) {
    throw fixedError("authorization_receipt_path_invalid");
  }
  const expectedContract = await readReceiptAuthorizationContract(
    options.receiptPath,
  );
  await assertDatabaseAuthorizationRoles(options);
  const contract = await captureDatabaseAuthorizationContract(options);
  if (!authorizationDatabaseStateEqual(contract, expectedContract)) {
    throw fixedError("authorization_target_contract_mismatch");
  }
  return contract;
}

async function main() {
  const cli = parseCli(process.argv);
  if (cli.command === "verify-target-roles") {
    await assertDatabaseAuthorizationRoles({ ...cli.values, env: process.env });
    process.stdout.write("AUTHORIZATION_TARGET_ROLES=PASS\n");
    return;
  }
  const contract = await snapshotTargetDatabaseAuthorization({
    ...cli.values,
    env: process.env,
  });
  process.stdout.write(
    `authorization|${contract.fingerprintSha256}|${contract.recordCount}|` +
    `${contract.grantTupleCount}|${contract.coreTableAppGrantTupleCount}|` +
    `${contract.restrictedSecurityDefinerFunctionCount}|` +
    `${contract.requiredExtensionsSha256}|` +
    `${contract.requiredExtensions.length}|` +
    `${contract.extensionFingerprintSha256}|` +
    `${contract.extensionRecordCount}\n`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch(() => {
    process.stderr.write("AUTHORIZATION=ERROR\n");
    process.exitCode = 1;
  });
}
