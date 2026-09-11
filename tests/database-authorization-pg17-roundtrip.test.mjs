import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createDatabase } from "../scripts/operations/backup-worker.mjs";
import {
  analyzeAuthorizationToc,
  assertDatabaseAuthorizationRoles,
  captureDatabaseAuthorizationContract,
  snapshotTargetDatabaseAuthorization,
  validateAuthorizationContract,
} from "../scripts/operations/database-authorization-contract.mjs";

const POSTGRES_BIN = "/usr/lib/postgresql/17/bin";
const SOURCE_CONTAINER_ENV = "FANMIND_PG17_SOURCE_CONTAINER_ID";
const TARGET_CONTAINER_ENV = "FANMIND_PG17_TARGET_CONTAINER_ID";
const REQUIRE_CONTAINERS_ENV =
  "FANMIND_PG17_REQUIRE_SERVICE_CONTAINERS";
const CONTAINER_ID = /^[0-9a-f]{12,64}$/u;
const SOURCE_CONTAINER_ID = process.env[SOURCE_CONTAINER_ENV]?.trim() ?? "";
const TARGET_CONTAINER_ID = process.env[TARGET_CONTAINER_ENV]?.trim() ?? "";
const HAS_SERVICE_CONTAINERS =
  CONTAINER_ID.test(SOURCE_CONTAINER_ID) &&
  CONTAINER_ID.test(TARGET_CONTAINER_ID);
const REQUIRE_SERVICE_CONTAINERS =
  process.env[REQUIRE_CONTAINERS_ENV] === "true";
const MAX_COMMAND_OUTPUT_BYTES = 64 * 1024 * 1024;
const COMMAND_TIMEOUT_MS = 60_000;
const RESTORE_OPERATOR_ROLE = "ci_restore_operator";
const RESTORE_OPERATOR_PASSWORD = "fanmind-ci-restore-operator";
const FIXTURE_EXTENSION_NAME = "fanmind_ci_fixture";
const FIXTURE_EXTENSION_DIRECTORY = "/usr/share/postgresql/17/extension";
const FIXTURE_EXTENSION_CONTROL = `
comment = 'FanMind PostgreSQL 17 dependency-closure fixture'
default_version = '1.1'
relocatable = true
trusted = true
`.trimStart();
const FIXTURE_EXTENSION_SQL = `
create table fanmind_ci_fixture_records (
  id bigint generated always as identity,
  payload text not null,
  constraint fanmind_ci_fixture_records_pkey primary key (id)
);

create index fanmind_ci_fixture_payload_idx
  on fanmind_ci_fixture_records (payload);

create function fanmind_ci_fixture_echo(value text)
returns text
language sql
immutable
strict
parallel safe
as 'select $1';
`.trimStart();

const CORE_TABLES = Object.freeze([
  "contacts",
  "followups",
  "memories",
  "workspace_members",
  "workspaces",
]);

const ROLE_AND_CONTAINER_BASELINE_SQL = String.raw`
begin;

create role anon
  nosuperuser noinherit nocreaterole nocreatedb nologin noreplication
  nobypassrls;
create role authenticated
  nosuperuser noinherit nocreaterole nocreatedb nologin noreplication
  nobypassrls;
create role service_role
  nosuperuser noinherit nocreaterole nocreatedb nologin noreplication
  bypassrls;
create role dashboard_user
  nosuperuser inherit nocreaterole nocreatedb nologin noreplication
  nobypassrls;
create role supabase_etl_admin
  nosuperuser inherit nocreaterole nocreatedb nologin noreplication
  nobypassrls;
create role supabase_storage_admin
  nosuperuser inherit nocreaterole nocreatedb nologin noreplication
  nobypassrls;
create role ci_owner
  nosuperuser inherit nocreaterole nocreatedb nologin noreplication
  nobypassrls;
create role ci_auditor
  nosuperuser inherit nocreaterole nocreatedb nologin noreplication
  nobypassrls;
create role ci_late
  nosuperuser inherit nocreaterole nocreatedb nologin noreplication
  nobypassrls;

revoke all privileges on database postgres from public;
revoke all privileges on database postgres
  from postgres, dashboard_user, supabase_etl_admin, supabase_storage_admin;
grant connect, temporary on database postgres to public;
grant connect, create, temporary on database postgres to postgres;
grant connect, create, temporary on database postgres to dashboard_user;
grant create on database postgres to supabase_etl_admin;
grant create on database postgres to supabase_storage_admin;
alter database postgres set app.settings.jwt_exp to '3600';

set role pg_database_owner;
revoke all privileges on schema public from public;
revoke all privileges on schema public
  from postgres, anon, authenticated, service_role, dashboard_user;
grant all privileges on schema public to pg_database_owner;
grant usage on schema public
  to public, postgres, anon, authenticated, service_role;
reset role;

create schema extensions authorization postgres;
revoke all privileges on schema extensions from public;
revoke all privileges on schema extensions
  from postgres, anon, authenticated, service_role, dashboard_user;
grant all privileges on schema extensions to postgres;
grant usage on schema extensions to anon, authenticated, service_role;
grant usage, create on schema extensions to dashboard_user;
create extension pgcrypto with schema extensions version '1.3';

-- Install the trusted CI extension as a non-bootstrap owner, then return the
-- database and host-schema ACLs to the production-compatible baseline.
grant create on database postgres to ci_owner;
grant usage, create on schema extensions to ci_owner;
set role ci_owner;
create extension fanmind_ci_fixture
  with schema extensions version '1.1';
reset role;
revoke usage, create on schema extensions from ci_owner;
revoke create on database postgres from ci_owner;

commit;
`;

const TARGET_BOOTSTRAP_SQL = String.raw`
create role ci_restore_operator
  superuser inherit createrole createdb login noreplication bypassrls
  connection limit -1
  password 'fanmind-ci-restore-operator';
`;

const RESTRICTED_SECURITY_DEFINERS = Array.from(
  { length: 12 },
  (_, index) => `restricted_sd_${String(index + 1).padStart(2, "0")}`,
);

const RESTRICTED_SECURITY_DEFINER_SQL = RESTRICTED_SECURITY_DEFINERS.map(
  (functionName) => String.raw`
create function public.${functionName}()
returns integer
language sql
security definer
set search_path = pg_catalog
as 'select 1';
revoke all privileges on function public.${functionName}()
  from public, anon, authenticated;
grant execute on function public.${functionName}() to service_role;
`,
).join("\n");

const SOURCE_AUTHORIZATION_SQL = String.raw`
begin;

create table public.contacts (id bigint primary key);
create table public.followups (id bigint primary key);
create table public.memories (id bigint primary key);
create table public.workspace_members (id bigint primary key);
create table public.workspaces (id bigint primary key);

alter table public.contacts enable row level security;
alter table public.followups enable row level security;
alter table public.memories enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspaces enable row level security;

grant select, insert, update, delete, truncate, references, trigger, maintain
  on table
    public.contacts,
    public.followups,
    public.memories,
    public.workspace_members,
    public.workspaces
  to anon, authenticated, service_role;

create schema app_acl authorization ci_owner;
set role ci_owner;
grant usage on schema app_acl to ci_auditor;

create table app_acl.explicit_default_acl (
  id bigint primary key,
  payload text
);
-- Materialize an explicit ACL without rebuilding PostgreSQL 17's complete
-- owner-default privilege set (which includes MAINTAIN).
revoke select on table app_acl.explicit_default_acl from ci_owner;
grant select on table app_acl.explicit_default_acl to ci_owner;

create table app_acl.column_acl (
  id bigint primary key,
  visible text,
  editable text
);
grant select (visible), update (editable)
  on table app_acl.column_acl
  to ci_auditor;

alter default privileges for role ci_owner in schema app_acl
  grant select on tables to ci_auditor;
create table app_acl.defaulted_table (
  id bigint primary key,
  payload text
);
reset role;

${RESTRICTED_SECURITY_DEFINER_SQL}

create function public.trim_conversation_messages_to_latest_50()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as 'begin return new; end';

create table public.conversation_messages (
  id bigint primary key,
  body text
);
alter table public.conversation_messages enable row level security;
create trigger trim_conversation_messages
before insert on public.conversation_messages
for each row
execute function public.trim_conversation_messages_to_latest_50();

commit;
`;

const TARGET_BASELINE_FINGERPRINT_SQL = String.raw`
with recursive extension_object_closure(classid, objid, objsubid) as (
  select dependency.classid, dependency.objid, dependency.objsubid
  from pg_catalog.pg_depend as dependency
  where dependency.refclassid =
        'pg_catalog.pg_extension'::pg_catalog.regclass
    and dependency.deptype = 'e'

  union

  select dependency.classid, dependency.objid, dependency.objsubid
  from extension_object_closure as parent
  join pg_catalog.pg_depend as dependency
    on dependency.refclassid = parent.classid
   and dependency.refobjid = parent.objid
   and (
     parent.objsubid = 0
     or dependency.refobjsubid = parent.objsubid
   )
   and dependency.deptype in ('i', 'a', 'P', 'S')
)
select pg_catalog.jsonb_build_object(
  'extensions', (
    select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_array(
        extension.extname,
        extension.extversion,
        namespace.nspname,
        owner_role.rolname
      )
      order by extension.extname collate "C"
    )
    from pg_catalog.pg_extension as extension
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = extension.extnamespace
    join pg_catalog.pg_roles as owner_role
      on owner_role.oid = extension.extowner
  ),
  'container_schemas', (
    select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_array(
        namespace.nspname,
        owner_role.rolname,
        namespace.nspacl::text
      )
      order by namespace.nspname collate "C"
    )
    from pg_catalog.pg_namespace as namespace
    join pg_catalog.pg_roles as owner_role
      on owner_role.oid = namespace.nspowner
    where namespace.nspname in ('extensions', 'public')
  ),
  'application_schema_count', (
    select count(*)
    from pg_catalog.pg_namespace as namespace
    where namespace.nspname !~ '^pg_'
      and namespace.nspname not in (
        'extensions',
        'information_schema',
        'public'
      )
  ),
  'application_relation_count', (
    select count(*)
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname in ('extensions', 'public')
      and not exists (
        select 1
        from extension_object_closure as extension_object
        where extension_object.classid =
              'pg_catalog.pg_class'::pg_catalog.regclass
          and extension_object.objid = relation.oid
          and extension_object.objsubid = 0
      )
  ),
  'application_function_count', (
    select count(*)
    from pg_catalog.pg_proc as function_definition
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = function_definition.pronamespace
    where namespace.nspname in ('extensions', 'public')
      and not exists (
        select 1
        from extension_object_closure as extension_object
        where extension_object.classid =
              'pg_catalog.pg_proc'::pg_catalog.regclass
          and extension_object.objid = function_definition.oid
          and extension_object.objsubid = 0
      )
  ),
  'default_acl_count', (
    select count(*) from pg_catalog.pg_default_acl
  )
)::text;
`;

const DATABASE_COLLATION_PROFILE_SQL = String.raw`
select pg_catalog.jsonb_build_object(
  'provider', database_definition.datlocprovider::text,
  'stored_collversion', database_definition.datcollversion,
  'actual_collversion',
    pg_catalog.pg_database_collation_actual_version(
      database_definition.oid
    ),
  'stored_matches_actual',
    database_definition.datcollversion is not distinct from
      pg_catalog.pg_database_collation_actual_version(
        database_definition.oid
      )
)::text
from pg_catalog.pg_database as database_definition
where database_definition.datname = pg_catalog.current_database();
`;

const FIXTURE_FUNCTION_OWNER_SQL = String.raw`
select owner_role.rolname
from pg_catalog.pg_proc as function_definition
join pg_catalog.pg_namespace as namespace
  on namespace.oid = function_definition.pronamespace
join pg_catalog.pg_roles as owner_role
  on owner_role.oid = function_definition.proowner
where namespace.nspname = 'extensions'
  and function_definition.proname = 'fanmind_ci_fixture_echo'
  and function_definition.oid =
      pg_catalog.to_regprocedure(
        'extensions.fanmind_ci_fixture_echo(text)'
      );
`;

const FIXTURE_EXTENSION_INVENTORY_SQL = String.raw`
with recursive selected_extension as (
  select
    extension.oid,
    extension.extname,
    extension.extversion,
    extension.extrelocatable,
    namespace.nspname as schema_name,
    owner_role.rolname as owner_name
  from pg_catalog.pg_extension as extension
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = extension.extnamespace
  join pg_catalog.pg_roles as owner_role
    on owner_role.oid = extension.extowner
  where extension.extname = 'fanmind_ci_fixture'
), direct_members(classid, objid, objsubid) as (
  select dependency.classid, dependency.objid, dependency.objsubid
  from selected_extension as extension
  join pg_catalog.pg_depend as dependency
    on dependency.refclassid =
       'pg_catalog.pg_extension'::pg_catalog.regclass
   and dependency.refobjid = extension.oid
   and dependency.deptype = 'e'
), dependency_closure(classid, objid, objsubid) as (
  select member.classid, member.objid, member.objsubid
  from direct_members as member

  union

  select dependency.classid, dependency.objid, dependency.objsubid
  from dependency_closure as parent
  join pg_catalog.pg_depend as dependency
    on dependency.refclassid = parent.classid
   and dependency.refobjid = parent.objid
   and (
     parent.objsubid = 0
     or dependency.refobjsubid = parent.objsubid
   )
   and dependency.deptype in ('i', 'a', 'P', 'S')
), closure_inventory as (
  select
    member.classid,
    member.objid,
    member.objsubid,
    identified.type,
    case
      when toast_parent.oid is not null then toast_parent_namespace.nspname
      when toast_index_parent.oid is not null
        then toast_index_parent_namespace.nspname
      else identified.schema
    end as schema,
    case
      when toast_parent.oid is not null then '<toast-table>'
      when toast_index_parent.oid is not null then '<toast-index>'
      else identified.name
    end as name,
    case
      when toast_parent.oid is not null then
        'toast table for ' ||
        pg_catalog.quote_ident(toast_parent_namespace.nspname) || '.' ||
        pg_catalog.quote_ident(toast_parent.relname)
      when toast_index_parent.oid is not null then
        'toast index for ' ||
        pg_catalog.quote_ident(toast_index_parent_namespace.nspname) || '.' ||
        pg_catalog.quote_ident(toast_index_parent.relname)
      else identified.identity
    end as identity,
    case
      when member.classid =
           'pg_catalog.pg_class'::pg_catalog.regclass then (
        select pg_catalog.pg_get_userbyid(object.relowner)
        from pg_catalog.pg_class as object
        where object.oid = member.objid
      )
      when member.classid =
           'pg_catalog.pg_proc'::pg_catalog.regclass then (
        select pg_catalog.pg_get_userbyid(object.proowner)
        from pg_catalog.pg_proc as object
        where object.oid = member.objid
      )
      when member.classid =
           'pg_catalog.pg_type'::pg_catalog.regclass then (
        select pg_catalog.pg_get_userbyid(object.typowner)
        from pg_catalog.pg_type as object
        where object.oid = member.objid
      )
      when member.classid =
           'pg_catalog.pg_language'::pg_catalog.regclass then (
        select pg_catalog.pg_get_userbyid(object.lanowner)
        from pg_catalog.pg_language as object
        where object.oid = member.objid
      )
      else null
    end as owner_name
  from dependency_closure as member
  left join pg_catalog.pg_class as member_relation
    on member.classid = 'pg_catalog.pg_class'::pg_catalog.regclass
   and member_relation.oid = member.objid
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
  cross join lateral pg_catalog.pg_identify_object(
    member.classid,
    member.objid,
    member.objsubid
  ) as identified
), canonical_members as (
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_array(
        member.classid::pg_catalog.regclass::text,
        member.type,
        member.schema,
        member.name,
        member.identity,
        member.owner_name
      )
      order by
        member.classid::pg_catalog.regclass::text collate "C",
        member.type collate "C",
        member.schema collate "C" nulls first,
        member.name collate "C" nulls first,
        member.identity collate "C",
        member.owner_name collate "C" nulls first
    ),
    '[]'::pg_catalog.jsonb
  ) as value
  from closure_inventory as member
), fixture_relations as (
  select
    count(*) filter (where relation.relkind = 'r')::integer as table_count,
    count(*) filter (where relation.relkind = 'S')::integer
      as sequence_count,
    count(*) filter (where relation.relkind = 'i')::integer as index_count
  from pg_catalog.pg_class as relation
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'extensions'
    and relation.relname in (
      'fanmind_ci_fixture_records',
      'fanmind_ci_fixture_records_id_seq',
      'fanmind_ci_fixture_records_pkey',
      'fanmind_ci_fixture_payload_idx'
    )
), fixture_functions as (
  select count(*)::integer as function_count
  from pg_catalog.pg_proc as function_definition
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = function_definition.pronamespace
  where namespace.nspname = 'extensions'
    and function_definition.proname = 'fanmind_ci_fixture_echo'
)
select pg_catalog.jsonb_build_object(
  'extension', pg_catalog.jsonb_build_array(
    extension.extname,
    extension.extversion,
    extension.extrelocatable,
    extension.schema_name,
    extension.owner_name
  ),
  'members', members.value,
  'direct_member_count', (select count(*) from direct_members),
  'closure_member_count', (select count(*) from dependency_closure),
  'derived_member_count', (
    select count(*)
    from dependency_closure as member
    where not exists (
      select 1
      from direct_members as direct
      where direct.classid = member.classid
        and direct.objid = member.objid
        and direct.objsubid = member.objsubid
    )
  ),
  'table_count', relation.table_count,
  'sequence_count', relation.sequence_count,
  'index_count', relation.index_count,
  'function_count', function_definition.function_count
)::text
from selected_extension as extension
cross join canonical_members as members
cross join fixture_relations as relation
cross join fixture_functions as function_definition;
`;

const EXPLICIT_DEFAULT_ACL_SQL = String.raw`
with relation as (
  select definition.relowner, definition.relacl
  from pg_catalog.pg_class as definition
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = definition.relnamespace
  where namespace.nspname = 'app_acl'
    and definition.relname = 'explicit_default_acl'
    and definition.relkind = 'r'
), current_acl as (
  select privilege.*
  from relation
  cross join lateral pg_catalog.aclexplode(
    coalesce(
      relation.relacl,
      pg_catalog.acldefault('r'::"char", relation.relowner)
    )
  ) as privilege
), hard_default_acl as (
  select privilege.*
  from relation
  cross join lateral pg_catalog.aclexplode(
    pg_catalog.acldefault('r'::"char", relation.relowner)
  ) as privilege
)
select pg_catalog.jsonb_build_object(
  'raw_acl_is_explicit', (select relacl is not null from relation),
  'raw_acl', (select relacl::text from relation),
  'hard_default_acl', (
    select pg_catalog.acldefault('r'::"char", relowner)::text
    from relation
  ),
  'semantically_default',
    not exists (
      select * from current_acl
      except
      select * from hard_default_acl
    )
    and not exists (
      select * from hard_default_acl
      except
      select * from current_acl
    )
)::text;
`;

const COLUMN_ACL_SQL = String.raw`
select coalesce(
  pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_array(
      attribute.attname,
      grantee_role.rolname,
      grantor_role.rolname,
      privilege.privilege_type,
      privilege.is_grantable
    )
    order by
      attribute.attname collate "C",
      privilege.privilege_type collate "C"
  ),
  '[]'::pg_catalog.jsonb
)::text
from pg_catalog.pg_attribute as attribute
join pg_catalog.pg_class as relation on relation.oid = attribute.attrelid
join pg_catalog.pg_namespace as namespace
  on namespace.oid = relation.relnamespace
cross join lateral pg_catalog.aclexplode(attribute.attacl) as privilege
join pg_catalog.pg_roles as grantee_role
  on grantee_role.oid = privilege.grantee
join pg_catalog.pg_roles as grantor_role
  on grantor_role.oid = privilege.grantor
where namespace.nspname = 'app_acl'
  and relation.relname = 'column_acl';
`;

const DEFAULT_ACL_SQL = String.raw`
select coalesce(
  pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_array(
      owner_role.rolname,
      namespace.nspname,
      default_acl.defaclobjtype,
      grantee_role.rolname,
      grantor_role.rolname,
      privilege.privilege_type,
      privilege.is_grantable
    )
    order by
      owner_role.rolname collate "C",
      namespace.nspname collate "C",
      default_acl.defaclobjtype,
      grantee_role.rolname collate "C",
      privilege.privilege_type collate "C"
  ),
  '[]'::pg_catalog.jsonb
)::text
from pg_catalog.pg_default_acl as default_acl
join pg_catalog.pg_roles as owner_role
  on owner_role.oid = default_acl.defaclrole
join pg_catalog.pg_namespace as namespace
  on namespace.oid = default_acl.defaclnamespace
cross join lateral pg_catalog.aclexplode(default_acl.defaclacl) as privilege
join pg_catalog.pg_roles as grantee_role
  on grantee_role.oid = privilege.grantee
join pg_catalog.pg_roles as grantor_role
  on grantor_role.oid = privilege.grantor
where owner_role.rolname = 'ci_owner'
  and namespace.nspname = 'app_acl';
`;

function runCommand(command, args, { input, env } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...env },
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    let timeout;

    function finish(error, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolvePromise(value);
    }

    timeout = setTimeout(() => {
      child.kill("SIGTERM");
      finish(new Error(`pg17_roundtrip_command_timeout:${command}`));
    }, COMMAND_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_COMMAND_OUTPUT_BYTES) {
        child.kill("SIGTERM");
        finish(new Error("pg17_roundtrip_stdout_too_large"));
        return;
      }
      stdout.push(Buffer.from(chunk));
    });
    child.stderr.on("data", (chunk) => {
      stderrBytes += chunk.length;
      if (stderrBytes > MAX_COMMAND_OUTPUT_BYTES) {
        child.kill("SIGTERM");
        finish(new Error("pg17_roundtrip_stderr_too_large"));
        return;
      }
      stderr.push(Buffer.from(chunk));
    });
    child.once("error", finish);
    child.once("close", (code) => {
      if (settled) return;
      const output = Buffer.concat(stdout, stdoutBytes).toString("utf8");
      const diagnostic = Buffer.concat(stderr, stderrBytes).toString("utf8");
      if (code !== 0) {
        finish(
          new Error(
            `pg17_roundtrip_command_failed:${command}:${code}:` +
              diagnostic.slice(0, 4096),
          ),
        );
        return;
      }
      finish(null, { stdout: output, stderr: diagnostic });
    });

    child.stdin.end(input);
  });
}

async function dockerPsql(containerId, password, sql) {
  await runCommand(
    "docker",
    [
      "exec",
      "-i",
      "--user",
      "0",
      "-e",
      `PGPASSWORD=${password}`,
      containerId,
      `${POSTGRES_BIN}/psql`,
      "--no-psqlrc",
      "--no-password",
      "--set",
      "ON_ERROR_STOP=1",
      "--username",
      "postgres",
      "--dbname",
      "postgres",
    ],
    { input: sql },
  );
}

async function dockerPsqlScalar(
  containerId,
  password,
  sql,
  { readOnly = false } = {},
) {
  const result = await runCommand(
    "docker",
    [
      "exec",
      "-i",
      "--user",
      "0",
      "-e",
      `PGPASSWORD=${password}`,
      ...(readOnly
        ? [
            "-e",
            "PGOPTIONS=-c default_transaction_read_only=on " +
              "-c search_path=pg_catalog,pg_temp",
          ]
        : []),
      containerId,
      `${POSTGRES_BIN}/psql`,
      "--no-psqlrc",
      "--no-password",
      "--no-align",
      "--tuples-only",
      "--quiet",
      "--set",
      "ON_ERROR_STOP=1",
      "--username",
      "postgres",
      "--dbname",
      "postgres",
    ],
    { input: sql },
  );
  return result.stdout.trim();
}

async function writeExecutable(path, lines) {
  await writeFile(path, `${lines.join("\n")}\n`, {
    flag: "wx",
    mode: 0o700,
  });
}

function psqlWrapperLines(containerId, password) {
  return [
    "#!/usr/bin/env bash",
    "set -Eeuo pipefail",
    `container_id=\"${containerId}\"`,
    `password=\"${password}\"`,
    "exec docker exec -i --user 0 " +
      '-e "PGPASSWORD=$password" ' +
      '-e "PGOPTIONS=${PGOPTIONS:-}" ' +
      '-e "PGAPPNAME=${PGAPPNAME:-}" ' +
      `\"$container_id\" ${POSTGRES_BIN}/psql \"$@\"`,
  ];
}

function pgDumpWrapperLines({
  containerId,
  password,
  noPrivileges,
  injectLateGrant,
}) {
  const lines = [
    "#!/usr/bin/env bash",
    "set -Eeuo pipefail",
    `source_id=\"${containerId}\"`,
    `password=\"${password}\"`,
    'output=""',
    "args=()",
    "while (($# > 0)); do",
    '  case "$1" in',
    "    --file)",
    "      (($# >= 2)) || exit 64",
    '      output="$2"',
    "      shift 2",
    "      ;;",
    "    --file=*)",
    '      output="${1#--file=}"',
    "      shift",
    "      ;;",
    "    *)",
    '      args+=("$1")',
    "      shift",
    "      ;;",
    "  esac",
    "done",
    '[[ -n "$output" && "$output" == /* ]] || exit 64',
    '[[ "${#args[@]}" -eq 10 ]] || exit 64',
    '[[ "${args[0]}" == "--format=custom" ]] || exit 64',
    '[[ "${args[1]}" =~ ^--snapshot=[0-9A-F]{8}-[0-9A-F]{8}-[1-9][0-9]*$ ]] || exit 64',
    '[[ "${args[2]}" == "--no-password" ]] || exit 64',
    '[[ "${args[3]}" == "--host" ]] || exit 64',
    '[[ "${args[4]}" == "127.0.0.1" ]] || exit 64',
    '[[ "${args[5]}" == "--port" ]] || exit 64',
    '[[ "${args[6]}" == "5432" ]] || exit 64',
    '[[ "${args[7]}" == "--username" ]] || exit 64',
    '[[ "${args[8]}" == "postgres" ]] || exit 64',
    '[[ "${args[9]}" == "postgres" ]] || exit 64',
    'container_dump="/tmp/fanmind-pg17-dump-$$.dump"',
    "cleanup() {",
    '  docker exec --user 0 "$source_id" rm -f -- "$container_dump"',
    "}",
    "trap cleanup EXIT",
  ];
  if (injectLateGrant) {
    lines.push(
      "docker exec --user 0 " +
        '-e "PGPASSWORD=$password" ' +
        `\"$source_id\" ${POSTGRES_BIN}/psql ` +
        "--no-psqlrc --no-password --set ON_ERROR_STOP=1 " +
        "--username postgres --dbname postgres " +
        ' --command "grant select on table ' +
        'app_acl.explicit_default_acl to ci_late;"',
    );
  }
  if (noPrivileges) lines.push('args=("-x" "${args[@]}")');
  lines.push(
    "docker exec --user 0 " +
      '-e "PGPASSWORD=$password" ' +
      `\"$source_id\" ${POSTGRES_BIN}/pg_dump ` +
      '"${args[@]}" --file "$container_dump"',
    'docker cp "${source_id}:${container_dump}" "$output"',
    'chmod 0600 "$output"',
  );
  return lines;
}

function pgRestoreListWrapperLines(containerId) {
  return [
    "#!/usr/bin/env bash",
    "set -Eeuo pipefail",
    `source_id=\"${containerId}\"`,
    '[[ "$#" -eq 2 && "$1" == "--list" ]] || exit 64',
    'archive="$2"',
    '[[ -f "$archive" ]] || exit 66',
    'container_archive="/tmp/fanmind-pg17-list-$$.dump"',
    "cleanup() {",
    '  docker exec --user 0 "$source_id" rm -f -- "$container_archive"',
    "}",
    "trap cleanup EXIT",
    'docker cp "$archive" "${source_id}:${container_archive}"',
    "docker exec --user 0 " +
      `\"$source_id\" ${POSTGRES_BIN}/pg_restore ` +
      '--list "$container_archive"',
  ];
}

function fakeAgeWrapperLines() {
  return [
    "#!/usr/bin/env bash",
    "set -Eeuo pipefail",
    '[[ "${FANMIND_PG17_FORBID_AGE:-false}" != "true" ]] || exit 90',
    'output=""',
    'input=""',
    "while (($# > 0)); do",
    '  case "$1" in',
    "    -R)",
    "      (($# >= 2)) || exit 64",
    "      shift 2",
    "      ;;",
    "    -o)",
    "      (($# >= 2)) || exit 64",
    '      output="$2"',
    "      shift 2",
    "      ;;",
    "    *)",
    '      input="$1"',
    "      shift",
    "      ;;",
    "  esac",
    "done",
    '[[ -n "$input" && -n "$output" ]] || exit 64',
    'install -m 0600 -- "$input" "$output"',
  ];
}

function filterExtensionsSchemaToc(toc) {
  const schemaEntry =
    /^[1-9][0-9]*; 2615 [1-9][0-9]* SCHEMA - extensions postgres$/u;
  const lines = toc.split("\n");
  const matches = lines.filter((line) => schemaEntry.test(line));
  assert.equal(matches.length, 1, "one exact extensions schema TOC entry");
  let changed = 0;
  const filtered = lines.map((line) => {
    if (line !== matches[0]) return line;
    changed += 1;
    return `;${line}`;
  }).join("\n");
  assert.equal(changed, 1, "only the extensions schema entry is filtered");
  return filtered;
}

function authorizationReceipt(result) {
  const contract = result.manifest.authorization_contract;
  return {
    schemaVersion: 2,
    createdAt: new Date().toISOString(),
    sourceArtifactBasename: "fanmind-full-1720000000000.tar.gz.age",
    outerSha256: "a".repeat(64),
    productionCommit: "b".repeat(40),
    databasePartEncryptedSha256: result.sha256,
    databaseDumpSha256: result.sha256,
    databaseAuthorizationContractVersion: contract.schema_version,
    databaseAuthorizationFingerprintSha256: contract.fingerprint_sha256,
    databaseAuthorizationRecordCount: contract.record_count,
    databaseAuthorizationGrantTupleCount: contract.grant_tuple_count,
    databaseAuthorizationRequiredRoles: contract.required_roles,
    databaseAuthorizationRequiredRolesSha256:
      contract.required_roles_sha256,
    databaseAuthorizationRoleFingerprintSha256:
      contract.role_fingerprint_sha256,
    databaseAuthorizationRoleRecordCount: contract.role_record_count,
    databaseAuthorizationContainerFingerprintSha256:
      contract.database_container_fingerprint_sha256,
    databaseAuthorizationContainerRecordCount:
      contract.database_container_record_count,
    databaseAuthorizationRequiredExtensions: contract.required_extensions,
    databaseAuthorizationRequiredExtensionsSha256:
      contract.required_extensions_sha256,
    databaseAuthorizationExtensionFingerprintSha256:
      contract.extension_fingerprint_sha256,
    databaseAuthorizationExtensionRecordCount:
      contract.extension_record_count,
    databaseCoreTableAppGrantTupleCount:
      contract.core_table_app_grant_tuple_count,
    databaseRestrictedSecurityDefinerFunctionCount:
      contract.restricted_security_definer_function_count,
    databaseAclTocEntryCount: contract.archive_acl_toc_entry_count,
    databaseDefaultAclTocEntryCount:
      contract.archive_default_acl_toc_entry_count,
    databaseAclTocSha256: contract.archive_acl_toc_sha256,
    databasePrivilegesArchived: true,
    databaseOwnershipArchived: true,
    verifier: "passed",
  };
}

function setEnvironment(values) {
  const previous = new Map();
  for (const [name, value] of Object.entries(values)) {
    previous.set(name, process.env[name]);
    process.env[name] = value;
  }
  return () => {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  };
}

async function captureContract(psqlBin, pgpassFile, username = "postgres") {
  return captureDatabaseAuthorizationContract({
    psqlBin,
    host: "127.0.0.1",
    port: "5432",
    username,
    database: "postgres",
    env: {
      PATH: process.env.PATH ?? "/usr/bin:/bin",
      PGPASSFILE: pgpassFile,
    },
  });
}

function fixtureExtensionCreateSql(ownerName, version) {
  assert.match(ownerName, /^(?:ci_owner|postgres)$/u);
  assert.match(version, /^1\.[01]$/u);
  if (ownerName === "postgres") {
    return String.raw`
begin;
drop extension if exists fanmind_ci_fixture;
create extension fanmind_ci_fixture
  with schema extensions version '${version}';
commit;
`;
  }
  return String.raw`
begin;
drop extension if exists fanmind_ci_fixture;
grant create on database postgres to ci_owner;
grant usage, create on schema extensions to ci_owner;
set role ci_owner;
create extension fanmind_ci_fixture
  with schema extensions version '${version}';
reset role;
revoke usage, create on schema extensions from ci_owner;
revoke create on database postgres from ci_owner;
commit;
`;
}

function alterFixtureFunctionOwnerSql(ownerName) {
  assert.match(ownerName, /^(?:ci_owner|postgres)$/u);
  if (ownerName === "postgres") {
    return "alter function extensions.fanmind_ci_fixture_echo(text) " +
      "owner to postgres;";
  }
  return String.raw`
begin;
grant usage, create on schema extensions to ci_owner;
alter function extensions.fanmind_ci_fixture_echo(text) owner to ci_owner;
revoke usage, create on schema extensions from ci_owner;
commit;
`;
}

async function fixtureExtensionInventory(containerId, password) {
  return JSON.parse(
    await dockerPsqlScalar(
      containerId,
      password,
      FIXTURE_EXTENSION_INVENTORY_SQL,
    ),
  );
}

async function productionEmptyTargetSql() {
  const runner = await readFile(
    new URL(
      "../scripts/operations/run-database-restore-drill.sh",
      import.meta.url,
    ),
    "utf8",
  );
  const match = runner.match(
    /empty_target_sql="\n([\s\S]*?)\n"\n\nif ! empty_target_result=/u,
  );
  assert.ok(match, "extract the exact production empty-target SQL");
  return match[1].replaceAll("\\$", "$");
}

async function assertAuthorizationPreflightRejectsWithoutWrite({
  containerId,
  password,
  receiptPath,
  targetPsql,
  pgpassFile,
}) {
  const [beforeExtensionInventory, beforeTargetBaseline] = await Promise.all([
    dockerPsqlScalar(
      containerId,
      password,
      FIXTURE_EXTENSION_INVENTORY_SQL,
    ),
    dockerPsqlScalar(
      containerId,
      password,
      TARGET_BASELINE_FINGERPRINT_SQL,
    ),
  ]);
  await assert.rejects(
    assertDatabaseAuthorizationRoles({
      receiptPath,
      psqlBin: targetPsql,
      host: "127.0.0.1",
      port: "5432",
      username: RESTORE_OPERATOR_ROLE,
      database: "postgres",
      env: {
        PATH: process.env.PATH ?? "/usr/bin:/bin",
        PGPASSFILE: pgpassFile,
      },
    }),
    (error) => error?.message === "authorization_extension_contract_mismatch",
  );
  const [afterExtensionInventory, afterTargetBaseline] = await Promise.all([
    dockerPsqlScalar(
      containerId,
      password,
      FIXTURE_EXTENSION_INVENTORY_SQL,
    ),
    dockerPsqlScalar(
      containerId,
      password,
      TARGET_BASELINE_FINGERPRINT_SQL,
    ),
  ]);
  assert.equal(
    afterExtensionInventory,
    beforeExtensionInventory,
    "authorization preflight rejects extension drift without a target write",
  );
  assert.equal(afterTargetBaseline, beforeTargetBaseline);
}

test("PostgreSQL 17 Docker tool shims are valid Bash", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "fanmind-pg17-shims-"));
  context.after(async () => {
    await rm(directory, { force: true, recursive: true });
  });
  const placeholderContainer = "0".repeat(64);
  const placeholderPassword = "synthetic-ci-password";
  const fixtures = [
    ["source-psql", psqlWrapperLines(placeholderContainer, placeholderPassword)],
    ["target-psql", psqlWrapperLines(placeholderContainer, placeholderPassword)],
    [
      "pg-dump-no-privileges",
      pgDumpWrapperLines({
        containerId: placeholderContainer,
        password: placeholderPassword,
        noPrivileges: true,
        injectLateGrant: false,
      }),
    ],
    [
      "pg-dump-snapshot",
      pgDumpWrapperLines({
        containerId: placeholderContainer,
        password: placeholderPassword,
        noPrivileges: false,
        injectLateGrant: true,
      }),
    ],
    ["source-pg-restore", pgRestoreListWrapperLines(placeholderContainer)],
    ["fake-age", fakeAgeWrapperLines()],
  ];

  await Promise.all(fixtures.map(async ([name, lines]) => {
    const path = join(directory, name);
    await writeExecutable(path, lines);
    await runCommand("bash", ["-n", path]);
  }));

  const emptyTargetSql = await productionEmptyTargetSql();
  assert.match(emptyTargetSql, /select count\(\*\)::text from user_objects;/iu);
});

test(
  "PostgreSQL 17 preserves the FanMind ownership and ACL contract",
  {
    skip:
      HAS_SERVICE_CONTAINERS || REQUIRE_SERVICE_CONTAINERS
        ? false
        : `set ${SOURCE_CONTAINER_ENV} and ${TARGET_CONTAINER_ENV}`,
    timeout: 300_000,
  },
  async (context) => {
    assert.match(SOURCE_CONTAINER_ID, CONTAINER_ID, SOURCE_CONTAINER_ENV);
    assert.match(TARGET_CONTAINER_ID, CONTAINER_ID, TARGET_CONTAINER_ENV);
    assert.notEqual(
      SOURCE_CONTAINER_ID,
      TARGET_CONTAINER_ID,
      "source and target must be independent disposable clusters",
    );
    const password = process.env.FANMIND_PG17_PASSWORD?.trim() ?? "";
    assert.match(password, /^[A-Za-z0-9_-]{16,128}$/u);

    const temporaryRoot = await mkdtemp(
      join(tmpdir(), "fanmind-pg17-authorization-"),
    );
    context.after(async () => {
      await rm(temporaryRoot, { force: true, recursive: true });
    });

    const toolsDirectory = join(temporaryRoot, "tools");
    const legacyDirectory = join(temporaryRoot, "legacy");
    const goodDirectory = join(temporaryRoot, "good");
    await Promise.all([
      mkdir(toolsDirectory, { mode: 0o700 }),
      mkdir(legacyDirectory, { mode: 0o700 }),
      mkdir(goodDirectory, { mode: 0o700 }),
    ]);

    const sourcePsql = join(toolsDirectory, "source-psql");
    const targetPsql = join(toolsDirectory, "target-psql");
    const legacyPgDump = join(toolsDirectory, "pg-dump-no-privileges");
    const snapshotPgDump = join(toolsDirectory, "pg-dump-snapshot");
    const sourcePgRestore = join(toolsDirectory, "source-pg-restore");
    const fakeAge = join(toolsDirectory, "fake-age");
    const pgpassFile = join(temporaryRoot, "pgpass");
    const caCertificate = join(temporaryRoot, "database-ca.pem");
    const recipientFile = join(temporaryRoot, "recipient.txt");
    const fixtureControlFile = join(
      temporaryRoot,
      `${FIXTURE_EXTENSION_NAME}.control`,
    );
    const fixtureSqlV10File = join(
      temporaryRoot,
      `${FIXTURE_EXTENSION_NAME}--1.0.sql`,
    );
    const fixtureSqlV11File = join(
      temporaryRoot,
      `${FIXTURE_EXTENSION_NAME}--1.1.sql`,
    );
    await Promise.all([
      writeExecutable(
        sourcePsql,
        psqlWrapperLines(SOURCE_CONTAINER_ID, password),
      ),
      writeExecutable(
        targetPsql,
        psqlWrapperLines(TARGET_CONTAINER_ID, RESTORE_OPERATOR_PASSWORD),
      ),
      writeExecutable(
        legacyPgDump,
        pgDumpWrapperLines({
          containerId: SOURCE_CONTAINER_ID,
          password,
          noPrivileges: true,
          injectLateGrant: false,
        }),
      ),
      writeExecutable(
        snapshotPgDump,
        pgDumpWrapperLines({
          containerId: SOURCE_CONTAINER_ID,
          password,
          noPrivileges: false,
          injectLateGrant: true,
        }),
      ),
      writeExecutable(
        sourcePgRestore,
        pgRestoreListWrapperLines(SOURCE_CONTAINER_ID),
      ),
      writeExecutable(fakeAge, fakeAgeWrapperLines()),
      writeFile(
        pgpassFile,
        `127.0.0.1:5432:postgres:postgres:${password}\n`,
        { flag: "wx", mode: 0o600 },
      ),
      writeFile(caCertificate, "synthetic-ci-ca-certificate\n", {
        flag: "wx",
        mode: 0o644,
      }),
      writeFile(recipientFile, "synthetic-ci-recipient\n", {
        flag: "wx",
        mode: 0o600,
      }),
      writeFile(fixtureControlFile, FIXTURE_EXTENSION_CONTROL, {
        flag: "wx",
        mode: 0o644,
      }),
      writeFile(fixtureSqlV10File, FIXTURE_EXTENSION_SQL, {
        flag: "wx",
        mode: 0o644,
      }),
      writeFile(fixtureSqlV11File, FIXTURE_EXTENSION_SQL, {
        flag: "wx",
        mode: 0o644,
      }),
    ]);

    const fixtureContainerFiles = [
      `${FIXTURE_EXTENSION_DIRECTORY}/${FIXTURE_EXTENSION_NAME}.control`,
      `${FIXTURE_EXTENSION_DIRECTORY}/${FIXTURE_EXTENSION_NAME}--1.0.sql`,
      `${FIXTURE_EXTENSION_DIRECTORY}/${FIXTURE_EXTENSION_NAME}--1.1.sql`,
    ];
    const fixtureLocalFiles = [
      fixtureControlFile,
      fixtureSqlV10File,
      fixtureSqlV11File,
    ];
    await Promise.all(
      [SOURCE_CONTAINER_ID, TARGET_CONTAINER_ID].flatMap((containerId) =>
        fixtureLocalFiles.map((file, index) =>
          runCommand("docker", [
            "cp",
            file,
            `${containerId}:${fixtureContainerFiles[index]}`,
          ]),
        ),
      ),
    );
    await Promise.all(
      [SOURCE_CONTAINER_ID, TARGET_CONTAINER_ID].map((containerId) =>
        runCommand("docker", [
          "exec",
          "--user",
          "0",
          containerId,
          "chmod",
          "0644",
          "--",
          ...fixtureContainerFiles,
        ]),
      ),
    );
    context.after(async () => {
      await Promise.all(
        [SOURCE_CONTAINER_ID, TARGET_CONTAINER_ID].map((containerId) =>
          runCommand("docker", [
            "exec",
            "--user",
            "0",
            containerId,
            "rm",
            "-f",
            "--",
            ...fixtureContainerFiles,
          ]).catch(() => {}),
        ),
      );
    });

    const restoreEnvironment = setEnvironment({
      FANMIND_BACKUP_PGPASSFILE: pgpassFile,
      FANMIND_BACKUP_DB_CA_CERT_PATH: caCertificate,
      FANMIND_BACKUP_DB_HOST: "127.0.0.1",
      FANMIND_BACKUP_DB_PORT: "5432",
      FANMIND_BACKUP_DB_USER: "postgres",
      FANMIND_BACKUP_DB_NAME: "postgres",
      FANMIND_PSQL_BIN: sourcePsql,
      FANMIND_PG_DUMP_BIN: legacyPgDump,
      FANMIND_PG_RESTORE_BIN: sourcePgRestore,
      FANMIND_AGE_BIN: fakeAge,
      FANMIND_BACKUP_PUBLIC_KEY_FILE: recipientFile,
      FANMIND_PG17_PASSWORD: password,
      FANMIND_PG17_FORBID_AGE: "true",
    });
    context.after(restoreEnvironment);

    await Promise.all([
      dockerPsql(
        SOURCE_CONTAINER_ID,
        password,
        ROLE_AND_CONTAINER_BASELINE_SQL + SOURCE_AUTHORIZATION_SQL,
      ),
      dockerPsql(
        TARGET_CONTAINER_ID,
        password,
        ROLE_AND_CONTAINER_BASELINE_SQL + TARGET_BOOTSTRAP_SQL,
      ),
    ]);

    const [sourceCollationProfileText, targetCollationProfileText] =
      await Promise.all([
        dockerPsqlScalar(
          SOURCE_CONTAINER_ID,
          password,
          DATABASE_COLLATION_PROFILE_SQL,
        ),
        dockerPsqlScalar(
          TARGET_CONTAINER_ID,
          password,
          DATABASE_COLLATION_PROFILE_SQL,
        ),
      ]);
    const sourceCollationProfile = JSON.parse(sourceCollationProfileText);
    const targetCollationProfile = JSON.parse(targetCollationProfileText);
    assert.deepEqual(targetCollationProfile, sourceCollationProfile);
    assert.equal(sourceCollationProfile.provider, "i");
    assert.equal(sourceCollationProfile.stored_matches_actual, true);
    assert.equal(
      sourceCollationProfile.stored_collversion,
      sourceCollationProfile.actual_collversion,
    );
    assert.equal(
      await dockerPsqlScalar(
        SOURCE_CONTAINER_ID,
        password,
        `select count(*) from pg_catalog.pg_roles where rolname = '${RESTORE_OPERATOR_ROLE}';`,
      ),
      "0",
    );
    assert.deepEqual(
      JSON.parse(
        await dockerPsqlScalar(
          TARGET_CONTAINER_ID,
          password,
          `select pg_catalog.jsonb_build_array(rolcanlogin, rolsuper)::text
             from pg_catalog.pg_roles
            where rolname = '${RESTORE_OPERATOR_ROLE}';`,
        ),
      ),
      [true, true],
    );

    const [sourceFixtureInventory, targetFixtureInventory] =
      await Promise.all([
        fixtureExtensionInventory(SOURCE_CONTAINER_ID, password),
        fixtureExtensionInventory(TARGET_CONTAINER_ID, password),
      ]);
    assert.deepEqual(targetFixtureInventory, sourceFixtureInventory);
    assert.deepEqual(sourceFixtureInventory.extension, [
      FIXTURE_EXTENSION_NAME,
      "1.1",
      true,
      "extensions",
      "ci_owner",
    ]);
    assert.ok(
      sourceFixtureInventory.members.length > 0,
      "the fixture exposes a non-empty dependency-closure inventory",
    );
    const fixtureMemberOwners = new Set(
      sourceFixtureInventory.members
        .map((member) => member[5])
        .filter((ownerName) => ownerName !== null),
    );
    assert.ok(fixtureMemberOwners.size > 0);
    assert.equal(
      fixtureMemberOwners.has(RESTORE_OPERATOR_ROLE),
      false,
      "the restore bootstrap never owns source extension members",
    );
    const sourceFixtureFunctionOwner = await dockerPsqlScalar(
      SOURCE_CONTAINER_ID,
      password,
      FIXTURE_FUNCTION_OWNER_SQL,
    );
    assert.match(sourceFixtureFunctionOwner, /^(?:ci_owner|postgres)$/u);
    assert.deepEqual(
      {
        table_count: sourceFixtureInventory.table_count,
        sequence_count: sourceFixtureInventory.sequence_count,
        index_count: sourceFixtureInventory.index_count,
        function_count: sourceFixtureInventory.function_count,
      },
      {
        table_count: 1,
        sequence_count: 1,
        index_count: 2,
        function_count: 1,
      },
    );
    assert.ok(
      sourceFixtureInventory.closure_member_count >
        sourceFixtureInventory.direct_member_count,
      "the fixture has internally derived objects beyond direct extension members",
    );
    assert.ok(sourceFixtureInventory.derived_member_count > 0);

    const emptyTargetBeforeLegacy = await dockerPsqlScalar(
      TARGET_CONTAINER_ID,
      password,
      TARGET_BASELINE_FINGERPRINT_SQL,
    );
    const parsedEmptyTarget = JSON.parse(emptyTargetBeforeLegacy);
    assert.equal(parsedEmptyTarget.application_schema_count, 0);
    assert.equal(parsedEmptyTarget.application_relation_count, 0);
    assert.equal(parsedEmptyTarget.application_function_count, 0);
    assert.equal(parsedEmptyTarget.default_acl_count, 0);
    const emptyTargetSql = await productionEmptyTargetSql();
    assert.equal(
      await dockerPsqlScalar(
        TARGET_CONTAINER_ID,
        password,
        emptyTargetSql,
        { readOnly: true },
      ),
      "0",
      "the production empty-target query accepts extension dependency closure",
    );

    await dockerPsql(
      TARGET_CONTAINER_ID,
      password,
      String.raw`
create table extensions.fanmind_ci_unexpected (id bigint not null);
create index fanmind_ci_unexpected_idx
  on extensions.fanmind_ci_unexpected (id);
`,
    );
    assert.notEqual(
      await dockerPsqlScalar(
        TARGET_CONTAINER_ID,
        password,
        emptyTargetSql,
        { readOnly: true },
      ),
      "0",
      "the production empty-target query rejects post-install objects",
    );
    await dockerPsql(
      TARGET_CONTAINER_ID,
      password,
      "drop table extensions.fanmind_ci_unexpected;",
    );
    assert.equal(
      await dockerPsqlScalar(
        TARGET_CONTAINER_ID,
        password,
        emptyTargetSql,
        { readOnly: true },
      ),
      "0",
      "removing the out-of-contract objects restores the empty baseline",
    );

    await assert.rejects(
      createDatabase(legacyDirectory),
      (error) => error?.message === "database_authorization_toc_missing",
    );
    const legacyFiles = await readdir(legacyDirectory);
    const legacyDumps = legacyFiles.filter((file) => file.endsWith(".dump"));
    assert.equal(legacyDumps.length, 1);
    assert.equal(legacyFiles.some((file) => file.endsWith(".age")), false);
    const legacyTocResult = await runCommand(sourcePgRestore, [
      "--list",
      join(legacyDirectory, legacyDumps[0]),
    ]);
    const legacyAuthorizationToc = analyzeAuthorizationToc(
      legacyTocResult.stdout,
    );
    assert.equal(legacyAuthorizationToc.aclEntryCount, 0);
    assert.equal(legacyAuthorizationToc.defaultAclEntryCount, 0);
    assert.equal(
      await dockerPsqlScalar(
        TARGET_CONTAINER_ID,
        password,
        TARGET_BASELINE_FINGERPRINT_SQL,
      ),
      emptyTargetBeforeLegacy,
      "the -x archive is rejected before the first target write",
    );

    process.env.FANMIND_PG17_FORBID_AGE = "false";
    process.env.FANMIND_PG_DUMP_BIN = snapshotPgDump;
    const result = await createDatabase(goodDirectory);
    assert.equal(result.manifest.privileges_archived, true);
    assert.equal(result.manifest.ownership_archived, true);
    assert.equal(result.manifest.format_version, 2);
    const expectedContract = validateAuthorizationContract(
      result.manifest.authorization_contract,
    );
    assert.match(expectedContract.extensionFingerprintSha256, /^[0-9a-f]{64}$/u);
    assert.ok(expectedContract.extensionRecordCount > 0);
    assert.deepEqual(
      expectedContract.requiredExtensions.find(
        (extension) => extension.name === FIXTURE_EXTENSION_NAME,
      ),
      {
        name: FIXTURE_EXTENSION_NAME,
        version: "1.1",
        schema: "extensions",
        schemaOwner: "postgres",
        schemaDefinitionArchived: true,
        owner: "ci_owner",
        relocatable: true,
      },
    );
    assert.equal(expectedContract.requiredRoles.includes("ci_late"), false);
    assert.equal(
      expectedContract.requiredRoles.includes(RESTORE_OPERATOR_ROLE),
      false,
    );

    const currentSourceContract = await captureContract(
      sourcePsql,
      pgpassFile,
    );
    assert.notEqual(
      currentSourceContract.fingerprintSha256,
      expectedContract.fingerprintSha256,
      "the exported snapshot excludes the grant committed after export",
    );
    assert.notEqual(
      currentSourceContract.roleFingerprintSha256,
      expectedContract.roleFingerprintSha256,
    );
    assert.equal(
      currentSourceContract.databaseContainerFingerprintSha256,
      expectedContract.databaseContainerFingerprintSha256,
    );
    assert.equal(
      currentSourceContract.extensionFingerprintSha256,
      expectedContract.extensionFingerprintSha256,
      "the late ACL write does not change the extension inventory",
    );
    assert.equal(
      currentSourceContract.extensionRecordCount,
      expectedContract.extensionRecordCount,
    );
    assert.equal(currentSourceContract.requiredRoles.includes("ci_late"), true);

    const archiveTocResult = await runCommand(sourcePgRestore, [
      "--list",
      result.path,
    ]);
    const archiveAuthorizationToc = analyzeAuthorizationToc(
      archiveTocResult.stdout,
    );
    const fixtureExtensionTocEntries = archiveTocResult.stdout
      .split("\n")
      .filter((line) =>
        new RegExp(
          `^[1-9][0-9]*; 3079 [1-9][0-9]* EXTENSION - ${FIXTURE_EXTENSION_NAME}(?: |$)`,
          "u",
        ).test(line),
      );
    assert.equal(fixtureExtensionTocEntries.length, 1);
    assert.deepEqual(archiveAuthorizationToc, {
      aclEntryCount:
        result.manifest.authorization_contract.archive_acl_toc_entry_count,
      defaultAclEntryCount:
        result.manifest.authorization_contract
          .archive_default_acl_toc_entry_count,
      sha256: result.manifest.authorization_contract.archive_acl_toc_sha256,
    });

    const restoreToc = filterExtensionsSchemaToc(archiveTocResult.stdout);
    assert.equal(
      restoreToc.split("\n").includes(fixtureExtensionTocEntries[0]),
      true,
      "the dependency-closure fixture entry stays active for restore",
    );
    assert.deepEqual(
      analyzeAuthorizationToc(restoreToc),
      archiveAuthorizationToc,
      "all ACL and DEFAULT ACL entries stay active",
    );
    const restoreTocPath = join(temporaryRoot, "restore.toc");
    const receiptPath = join(temporaryRoot, "full-backup-receipt.json");
    await Promise.all([
      writeFile(restoreTocPath, restoreToc, { flag: "wx", mode: 0o600 }),
      writeFile(
        receiptPath,
        `${JSON.stringify(authorizationReceipt(result))}\n`,
        { flag: "wx", mode: 0o600 },
      ),
    ]);

    const driftFixtureFunctionOwner = sourceFixtureFunctionOwner === "postgres"
      ? "ci_owner"
      : "postgres";
    await dockerPsql(
      TARGET_CONTAINER_ID,
      password,
      alterFixtureFunctionOwnerSql(driftFixtureFunctionOwner),
    );
    await assertAuthorizationPreflightRejectsWithoutWrite({
      containerId: TARGET_CONTAINER_ID,
      password,
      receiptPath,
      targetPsql,
      pgpassFile,
    });
    await dockerPsql(
      TARGET_CONTAINER_ID,
      password,
      alterFixtureFunctionOwnerSql(sourceFixtureFunctionOwner),
    );

    await dockerPsql(
      TARGET_CONTAINER_ID,
      password,
      "alter extension fanmind_ci_fixture set schema public;",
    );
    await assertAuthorizationPreflightRejectsWithoutWrite({
      containerId: TARGET_CONTAINER_ID,
      password,
      receiptPath,
      targetPsql,
      pgpassFile,
    });
    await dockerPsql(
      TARGET_CONTAINER_ID,
      password,
      "alter extension fanmind_ci_fixture set schema extensions;",
    );

    await dockerPsql(
      TARGET_CONTAINER_ID,
      password,
      fixtureExtensionCreateSql("postgres", "1.1"),
    );
    await assertAuthorizationPreflightRejectsWithoutWrite({
      containerId: TARGET_CONTAINER_ID,
      password,
      receiptPath,
      targetPsql,
      pgpassFile,
    });
    await dockerPsql(
      TARGET_CONTAINER_ID,
      password,
      fixtureExtensionCreateSql("ci_owner", "1.1"),
    );

    await dockerPsql(
      TARGET_CONTAINER_ID,
      password,
      "drop extension fanmind_ci_fixture;",
    );
    await assertAuthorizationPreflightRejectsWithoutWrite({
      containerId: TARGET_CONTAINER_ID,
      password,
      receiptPath,
      targetPsql,
      pgpassFile,
    });
    await dockerPsql(
      TARGET_CONTAINER_ID,
      password,
      fixtureExtensionCreateSql("ci_owner", "1.1"),
    );

    await dockerPsql(
      TARGET_CONTAINER_ID,
      password,
      fixtureExtensionCreateSql("ci_owner", "1.0"),
    );
    await assertAuthorizationPreflightRejectsWithoutWrite({
      containerId: TARGET_CONTAINER_ID,
      password,
      receiptPath,
      targetPsql,
      pgpassFile,
    });
    await dockerPsql(
      TARGET_CONTAINER_ID,
      password,
      fixtureExtensionCreateSql("ci_owner", "1.1"),
    );

    assert.deepEqual(
      await fixtureExtensionInventory(TARGET_CONTAINER_ID, password),
      sourceFixtureInventory,
      "extension drift fixtures return to the exact source inventory",
    );
    assert.equal(
      await dockerPsqlScalar(
        TARGET_CONTAINER_ID,
        password,
        TARGET_BASELINE_FINGERPRINT_SQL,
      ),
      emptyTargetBeforeLegacy,
      "extension drift fixtures leave the disposable target empty",
    );

    const rolePreflight = await assertDatabaseAuthorizationRoles({
      receiptPath,
      psqlBin: targetPsql,
      host: "127.0.0.1",
      port: "5432",
      username: RESTORE_OPERATOR_ROLE,
      database: "postgres",
      env: {
        PATH: process.env.PATH ?? "/usr/bin:/bin",
        PGPASSFILE: pgpassFile,
      },
    });
    assert.deepEqual(rolePreflight, {
      requiredRoleCount: expectedContract.requiredRoles.length,
      verified: true,
    });
    assert.equal(
      await dockerPsqlScalar(
        TARGET_CONTAINER_ID,
        password,
        TARGET_BASELINE_FINGERPRINT_SQL,
      ),
      emptyTargetBeforeLegacy,
      "role preflight and TOC filtering are read-only",
    );

    const containerDump = "/tmp/fanmind-pg17-roundtrip.dump";
    const containerToc = "/tmp/fanmind-pg17-roundtrip.toc";
    context.after(async () => {
      await runCommand("docker", [
        "exec",
        "--user",
        "0",
        TARGET_CONTAINER_ID,
        "rm",
        "-f",
        "--",
        containerDump,
        containerToc,
      ]).catch(() => {});
    });
    await Promise.all([
      runCommand("docker", [
        "cp",
        result.path,
        `${TARGET_CONTAINER_ID}:${containerDump}`,
      ]),
      runCommand("docker", [
        "cp",
        restoreTocPath,
        `${TARGET_CONTAINER_ID}:${containerToc}`,
      ]),
    ]);
    await runCommand("docker", [
      "exec",
      "--user",
      "0",
      "-e",
      `PGPASSWORD=${RESTORE_OPERATOR_PASSWORD}`,
      TARGET_CONTAINER_ID,
      `${POSTGRES_BIN}/pg_restore`,
      "--exit-on-error",
      "--single-transaction",
      "--use-list",
      containerToc,
      "--no-password",
      "--host",
      "127.0.0.1",
      "--port",
      "5432",
      "--username",
      RESTORE_OPERATOR_ROLE,
      "--dbname",
      "postgres",
      containerDump,
    ]);

    // The public preflight recomputes the target role graph from the receipt
    // and rejects unless its role fingerprint exactly matches the source.
    const targetContract = await snapshotTargetDatabaseAuthorization({
      receiptPath,
      psqlBin: targetPsql,
      host: "127.0.0.1",
      port: "5432",
      username: RESTORE_OPERATOR_ROLE,
      database: "postgres",
      env: {
        PATH: process.env.PATH ?? "/usr/bin:/bin",
        PGPASSFILE: pgpassFile,
      },
    });
    assert.equal(
      targetContract.fingerprintSha256,
      expectedContract.fingerprintSha256,
    );
    assert.equal(
      targetContract.databaseContainerFingerprintSha256,
      expectedContract.databaseContainerFingerprintSha256,
    );
    assert.equal(
      targetContract.databaseContainerRecordCount,
      expectedContract.databaseContainerRecordCount,
    );
    assert.equal(
      targetContract.extensionFingerprintSha256,
      expectedContract.extensionFingerprintSha256,
    );
    assert.equal(
      targetContract.extensionRecordCount,
      expectedContract.extensionRecordCount,
    );
    assert.equal(targetContract.recordCount, expectedContract.recordCount);
    assert.equal(
      targetContract.grantTupleCount,
      expectedContract.grantTupleCount,
    );
    assert.equal(
      targetContract.coreTableAppGrantTupleCount,
      expectedContract.coreTableAppGrantTupleCount,
    );
    assert.equal(
      targetContract.restrictedSecurityDefinerFunctionCount,
      expectedContract.restrictedSecurityDefinerFunctionCount,
    );
    assert.equal(
      targetContract.requiredRoles.includes(RESTORE_OPERATOR_ROLE),
      true,
      "a fresh source-style capture sees the isolated target operator",
    );
    assert.deepEqual(
      await fixtureExtensionInventory(TARGET_CONTAINER_ID, password),
      sourceFixtureInventory,
      "extension metadata, member owners and dependency closure survive restore",
    );

    const [sourceExplicitAcl, targetExplicitAcl] = await Promise.all([
      dockerPsqlScalar(
        SOURCE_CONTAINER_ID,
        password,
        EXPLICIT_DEFAULT_ACL_SQL,
      ),
      dockerPsqlScalar(
        TARGET_CONTAINER_ID,
        password,
        EXPLICIT_DEFAULT_ACL_SQL,
      ),
    ]);
    const sourceExplicitAclState = JSON.parse(sourceExplicitAcl);
    const targetExplicitAclState = JSON.parse(targetExplicitAcl);
    assert.equal(sourceExplicitAclState.raw_acl_is_explicit, true);
    assert.equal(
      sourceExplicitAclState.semantically_default,
      false,
      "the live source contains the deliberately injected post-snapshot grant",
    );
    assert.match(
      sourceExplicitAclState.raw_acl,
      /ci_late=r\/ci_owner/u,
      "the live source exposes the post-snapshot grant",
    );
    assert.equal(
      targetExplicitAclState.semantically_default,
      true,
      `target explicit-default ACL differs: ${JSON.stringify(
        targetExplicitAclState,
      )}`,
    );
    assert.doesNotMatch(
      targetExplicitAclState.raw_acl ?? "",
      /ci_late/u,
      "the frozen snapshot excludes the later source grant",
    );

    const targetColumnAcl = JSON.parse(
      await dockerPsqlScalar(TARGET_CONTAINER_ID, password, COLUMN_ACL_SQL),
    );
    assert.deepEqual(targetColumnAcl, [
      ["editable", "ci_auditor", "ci_owner", "UPDATE", false],
      ["visible", "ci_auditor", "ci_owner", "SELECT", false],
    ]);
    const targetDefaultAcl = JSON.parse(
      await dockerPsqlScalar(TARGET_CONTAINER_ID, password, DEFAULT_ACL_SQL),
    );
    assert.deepEqual(targetDefaultAcl, [
      [
        "ci_owner",
        "app_acl",
        "r",
        "ci_auditor",
        "ci_owner",
        "SELECT",
        false,
      ],
    ]);

    assert.equal(
      await dockerPsqlScalar(
        TARGET_CONTAINER_ID,
        password,
        String.raw`
select count(*)
from pg_catalog.pg_class as relation
join pg_catalog.pg_namespace as namespace
  on namespace.oid = relation.relnamespace
where namespace.nspname = 'public'
  and relation.relname in (
    'contacts',
    'followups',
    'memories',
    'workspace_members',
    'workspaces'
  )
  and relation.relrowsecurity;
`,
      ),
      String(CORE_TABLES.length),
    );
    assert.equal(
      await dockerPsqlScalar(
        TARGET_CONTAINER_ID,
        password,
        String.raw`
select owner_role.rolname
from pg_catalog.pg_class as relation
join pg_catalog.pg_namespace as namespace
  on namespace.oid = relation.relnamespace
join pg_catalog.pg_roles as owner_role on owner_role.oid = relation.relowner
where namespace.nspname = 'app_acl'
  and relation.relname = 'explicit_default_acl';
`,
      ),
      "ci_owner",
    );

    const checksum = (await readFile(result.checksum_path, "utf8")).trim();
    assert.match(checksum, new RegExp(`^${result.sha256}\\s+`, "u"));

    // The complete legacy restore above remains the immutable compatibility proof.
    // Exercise the already approved Production hardening only in this CI source.
    const beforeHardening = await captureContract(sourcePsql, pgpassFile);
    await dockerPsql(SOURCE_CONTAINER_ID, password, String.raw`
alter function public.trim_conversation_messages_to_latest_50()
  set search_path = pg_catalog, pg_temp;
revoke execute on function public.trim_conversation_messages_to_latest_50()
  from public, anon, authenticated;
grant execute on function public.trim_conversation_messages_to_latest_50()
  to service_role;
`);
    const hardenedContract = await captureContract(sourcePsql, pgpassFile);
    assert.notEqual(hardenedContract.fingerprintSha256, beforeHardening.fingerprintSha256);
    assert.equal(hardenedContract.restrictedSecurityDefinerFunctionCount, 12);
    assert.equal(hardenedContract.coreTableAppGrantTupleCount, 120);
    assert.equal(validateAuthorizationContract(result.manifest.authorization_contract).fingerprintSha256,
      expectedContract.fingerprintSha256, "the old backup contract is not rewritten");

    const hardenedPgDump = join(toolsDirectory, "pg-dump-hardened");
    await writeExecutable(hardenedPgDump, pgDumpWrapperLines({
      containerId: SOURCE_CONTAINER_ID, password, noPrivileges: false, injectLateGrant: false,
    }));
    const hardenedDirectory = join(temporaryRoot, "hardened-backup");
    await mkdir(hardenedDirectory, { mode: 0o700 });
    process.env.FANMIND_PG_DUMP_BIN = hardenedPgDump;
    const hardenedBackup = await createDatabase(hardenedDirectory);
    assert.equal(hardenedBackup.manifest.privileges_archived, true);
    assert.equal(hardenedBackup.manifest.ownership_archived, true);
    assert.deepEqual(validateAuthorizationContract(hardenedBackup.manifest.authorization_contract),
      hardenedContract, "real pg_dump and held snapshot retain the hardened ACL fingerprint");

    const trigger = "public.trim_conversation_messages_to_latest_50()";
    for (const [bad, repair] of [
      [`grant execute on function ${trigger} to anon;`, `revoke execute on function ${trigger} from anon;`],
      [`alter function ${trigger} set search_path = public;`, `alter function ${trigger} set search_path = pg_catalog, pg_temp;`],
      [`revoke execute on function ${trigger} from service_role;`, `grant execute on function ${trigger} to service_role;`],
    ]) {
      await dockerPsql(SOURCE_CONTAINER_ID, password, bad);
      try {
        await assert.rejects(captureContract(sourcePsql, pgpassFile), /authorization_security_definer_boundary_invalid/u);
      } finally {
        await dockerPsql(SOURCE_CONTAINER_ID, password, repair);
      }
      assert.deepEqual(await captureContract(sourcePsql, pgpassFile), hardenedContract);
    }
  },
);
