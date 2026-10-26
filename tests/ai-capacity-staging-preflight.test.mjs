import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { evaluateObservation, evaluatePreparationEnvironment, verifyPreparation }
  from "../scripts/operations/ai-capacity-staging-preflight-preparation.mjs";

const root = resolve(import.meta.dirname, "..");
const control = JSON.parse(readFileSync(resolve(root,"docs/operations/ai-capacity-staging-preparation.json")));
const query = readFileSync(resolve(root,control.sqlPath),"utf8");
const head = "a".repeat(40);
function environment() {
  return {
    GITHUB_REF:"refs/heads/main", GITHUB_SHA:head,
    FANMIND_RUNTIME_ENVIRONMENT:"staging",
    FANMIND_TARGET_SUPABASE_PROJECT_REF:control.targetProject,
    FANMIND_PRODUCTION_SUPABASE_PROJECT_REF:control.productionProject,
    NEXT_PUBLIC_SUPABASE_URL:`https://${control.targetProject}.supabase.co`,
    NEXT_PUBLIC_APP_URL:"https://staging.example.test",
    FANMIND_TARGET_API_ORIGIN:"https://staging.example.test",
    FANMIND_PRODUCTION_API_ORIGIN:"https://fanmind.ch",
    FANMIND_ENABLE_NON_PRODUCTION_WRITES:"false", FANMIND_NON_PRODUCTION_WRITE_ACK:"",
    FANMIND_STAGING_DATABASE_ROLLOUT_REVIEWED_COMMIT:head,
    FANMIND_STAGING_DATABASE_ROLLOUT_STATE_CONFIRM:"verify-staging-database-rollout-state",
    FANMIND_CAPACITY_PREFLIGHT_CONFIRM:"prepare-readonly-capacity-preflight",
    PGHOST:"aws-0-eu-west-1.pooler.supabase.com",
    FANMIND_TARGET_DB_HOST:"aws-0-eu-west-1.pooler.supabase.com",
    FANMIND_PRODUCTION_DB_HOST:`db.${control.productionProject}.supabase.co`,
    PGPORT:"5432", PGDATABASE:"postgres", PGUSER:`postgres.${control.targetProject}`,
    PGSSLMODE:"verify-full", PGSSLROOTCERT:resolve(root,"config/certificates/supabase-root-2021-ca.crt"),
  };
}

test("preparation binds original reviewed SQL and exposes no apply or target-execution mode", () => {
  assert.equal(verifyPreparation(root).applyMode,"disabled");
  for (const mode of ["--apply","--run","--emit-readonly-sql"]) {
    const r=spawnSync(process.execPath,["scripts/operations/ai-capacity-staging-preflight-preparation.mjs",mode],
      {cwd:root,encoding:"utf8",env:{PATH:process.env.PATH}});
    assert.notEqual(r.status,0); assert.equal(r.stdout,"");
    assert.doesNotMatch(r.stderr,/postgresql:\/\//u);
  }
});

test("prepared emission reuses the existing Staging boundary and denies wrong target, TLS, commit or writes", () => {
  assert.deepEqual(evaluatePreparationEnvironment(environment(),head,head),{ok:true,errors:[]});
  for (const change of [
    {GITHUB_REF:"refs/heads/feature"},{GITHUB_SHA:"b".repeat(40)},
    {FANMIND_TARGET_SUPABASE_PROJECT_REF:control.productionProject},
    {FANMIND_PRODUCTION_SUPABASE_PROJECT_REF:"differentproduction"},
    {PGUSER:`postgres.${control.productionProject}`},{PGPORT:"6543"},
    {PGSSLMODE:"require"},{PGHOSTADDR:"127.0.0.1"},{DATABASE_URL:"postgres://redirect"},
    {NEXT_PUBLIC_APP_URL:"https://fanmind.ch"},{FANMIND_ENABLE_NON_PRODUCTION_WRITES:"true"},
    {FANMIND_NON_PRODUCTION_WRITE_ACK:"I_UNDERSTAND_NON_PRODUCTION_ONLY"},
    {FANMIND_CAPACITY_PREFLIGHT_CONFIRM:""},
  ]) assert.equal(evaluatePreparationEnvironment({...environment(),...change},head,head).ok,false);
  assert.equal(evaluatePreparationEnvironment(environment(),head,"b".repeat(40)).ok,false);
});

const required=process.env.FANMIND_CAPACITY_PG17_REQUIRED==="true";
const container=process.env.FANMIND_CREATOR_PG17_CONTAINER_ID??"";
const db="fanmind_capacity_preflight_ci";
function sql(input,database=db) {
  assert.match(container,/^[0-9a-f]{12,64}$/u);
  assert.ok([db,"postgres"].includes(database));
  return execFileSync("docker",["--host=unix:///var/run/docker.sock","exec","-i",container,
    "psql","-XqAt","-U","postgres","-d",database,"-v","ON_ERROR_STOP=1"],
    {input,encoding:"utf8",timeout:30000,stdio:["pipe","pipe","pipe"]}).trim();
}
function fresh() {
  sql(`drop database if exists ${db}; create database ${db};`,"postgres");
  sql("create schema auth; create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role',true) $$; create table public.workspaces(id uuid primary key); alter table public.workspaces enable row level security;");
  sql("create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[]);");
  for (const name of ["ai_capacity_billing_v2.sql","ai_capacity_billing_v2_activation_gates.sql"]) {
    sql(readFileSync(resolve(root,"supabase/controlled",name),"utf8"));
  }
  sql("update public.ai_capacity_admin_policy set revision=2;");
}
const observe=()=>JSON.parse(sql(query));
const evaluate=()=>evaluateObservation(observe(),control);
test("prepared read-only Capacity verifier executes on PostgreSQL 17 and rejects real drift",{skip:!required},async t=>{
  assert.equal(sql("select current_setting('server_version_num')::int/10000;","postgres"),"17");
  sql("do $$ begin if not exists(select from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if; end $$;","postgres");
  try {
    await t.test("source-defined baseline matches, repeated observation remains read-only and unchanged",()=>{
      fresh(); const a=observe(),b=observe(); assert.deepEqual(a,b);
      assert.deepEqual(evaluateObservation(a,control),{state:"READONLY_BASELINE_MATCH",apply:"disabled",failures:[]});
      assert.equal(a.read_only,true);
      for (const field of ["schema_matches_after_budget_default_normalization",
        "table_structure_safety_matches","function_security_matches",
        "function_owner_boundary_matches","function_attribute_boundary_matches",
        "function_explicit_acl_matches","function_effective_execute_matches",
        "rls_acl_security_matches","rls_policy_boundary_matches","table_explicit_acl_matches",
        "column_acl_boundary_matches","effective_table_privileges_match",
        "effective_column_privileges_match","other_security_matches"]) assert.equal(a[field],true,field);
      for (const field of ["capacity_migration_marker_count","capacity_known_migration_marker_count",
        "capacity_unknown_migration_marker_count","capacity_unknown_marker_name_only_count",
        "capacity_unknown_marker_version_only_count","capacity_unknown_marker_name_and_version_count",
        "capacity_unknown_marker_with_statements_count"]) assert.equal(a[field],0,field);
    });
    await t.test("only the three historical missing defaults normalize to the canonical fingerprint",()=>{
      fresh();
      sql("alter table public.ai_capacity_admin_policy alter column package_99_budget_eur_microcents drop default, alter column package_199_budget_eur_microcents drop default, alter column package_312_budget_eur_microcents drop default;");
      const observation=observe(),result=evaluateObservation(observation,control);
      assert.equal(result.state,"BLOCK");
      assert.notEqual(observation.schema_md5,control.expectedObservation.schema_md5);
      assert.equal(observation.schema_matches_after_budget_default_normalization,true);
      assert.equal(observation.table_structure_safety_matches,true);
      assert.equal(observation.function_security_matches,true);
      assert.equal(observation.function_owner_boundary_matches,true);
      assert.equal(observation.function_attribute_boundary_matches,true);
      assert.equal(observation.function_explicit_acl_matches,true);
      assert.equal(observation.function_effective_execute_matches,true);
      assert.equal(observation.rls_acl_security_matches,true);
      assert.equal(observation.rls_policy_boundary_matches,true);
      assert.equal(observation.table_explicit_acl_matches,true);
      assert.equal(observation.column_acl_boundary_matches,true);
      assert.equal(observation.effective_table_privileges_match,true);
      assert.equal(observation.effective_column_privileges_match,true);
      assert.equal(observation.other_security_matches,true);
      for (const field of ["policy_package_99_budget_default_matches",
        "policy_package_199_budget_default_matches","policy_package_312_budget_default_matches"])
        assert.ok(result.failures.includes(field),field);
    });
    for (const [name,mutation,field] of [
      ["table shape","alter table public.ai_capacity_grants add column unreviewed integer;","table_structure_safety_matches"],
      ["same-count column type","alter table public.ai_capacity_grants alter column metadata drop default, alter column metadata type text using metadata::text;","table_structure_safety_matches"],
      ["constraint definition","alter table public.ai_capacity_admin_policy drop constraint ai_capacity_budget_99_positive, add constraint ai_capacity_budget_99_positive check (package_99_budget_eur_microcents is null or package_99_budget_eur_microcents >= 0);","table_structure_safety_matches"],
      ["index definition","drop index public.ai_capacity_grants_workspace_idx; create index ai_capacity_grants_workspace_idx on public.ai_capacity_grants(workspace_id,id);","table_structure_safety_matches"],
      ["function definer boundary","alter function public.ai_capacity_ledger_immutable() security definer;","function_security_matches"],
      ["function body","create or replace function public.ai_capacity_ledger_immutable() returns trigger language plpgsql set search_path=pg_catalog,public,pg_temp as $$ begin return new; end $$;","function_security_matches"],
      ["function owner","create role capacity_function_owner nologin; alter function public.ai_capacity_ledger_immutable() owner to capacity_function_owner;","function_security_matches"],
      ["function ACL","grant execute on function public.ai_capacity_ledger_immutable() to authenticated;","function_security_matches"],
      ["function config","alter function public.ai_capacity_ledger_immutable() set work_mem='64kB';","function_security_matches"],
      ["table RLS","alter table public.ai_capacity_grants disable row level security;","rls_acl_security_matches"],
      ["table policy","create policy component_drift on public.ai_capacity_grants for select to authenticated using(true);","rls_acl_security_matches"],
      ["column ACL","grant select(grant_key) on public.ai_capacity_grants to authenticated;","rls_acl_security_matches"],
      ["trigger security","alter table public.ai_capacity_ledger_events disable trigger ai_capacity_ledger_immutable_update_delete;","other_security_matches"],
      ["trigger definition","drop trigger ai_capacity_ledger_immutable_update_delete on public.ai_capacity_ledger_events; create trigger ai_capacity_ledger_immutable_update_delete before update on public.ai_capacity_ledger_events for each row execute function public.ai_capacity_ledger_immutable();","other_security_matches"],
      ["table owner","create role capacity_table_owner nologin; alter table public.ai_capacity_grants owner to capacity_table_owner;","other_security_matches"],
    ]) await t.test(`separately classifies ${name} drift`,()=>{
      fresh();sql(mutation);const observation=observe();
      assert.equal(observation.schema_matches_after_budget_default_normalization,false);
      assert.equal(observation[field],false);
    });
    for (const [name,mutation,fields] of [
      ["function SECURITY attribute","alter function public.ai_capacity_ledger_immutable() security definer;",["function_attribute_boundary_matches"]],
      ["function owner","create role capacity_function_owner nologin; alter function public.ai_capacity_ledger_immutable() owner to capacity_function_owner;",["function_owner_boundary_matches"]],
      ["all function owners","create role capacity_function_owner nologin; alter function public.ai_capacity_ledger_immutable() owner to capacity_function_owner; alter function public.ai_capacity_admin_activation_guard() owner to capacity_function_owner; alter function public.admin_get_ai_capacity_policy() owner to capacity_function_owner; alter function public.admin_update_ai_capacity_policy(uuid,text,bigint,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,bigint,bigint,bigint) owner to capacity_function_owner;",["function_owner_boundary_matches"]],
      ["function ACL","grant execute on function public.ai_capacity_admin_activation_guard() to authenticated;",["function_explicit_acl_matches","function_effective_execute_matches"]],
      ["function grant option","grant execute on function public.admin_get_ai_capacity_policy() to service_role with grant option;",["function_explicit_acl_matches"]],
      ["RLS flag","alter table public.ai_capacity_grants disable row level security;",["rls_policy_boundary_matches"]],
      ["RLS policy","create policy component_detail on public.ai_capacity_grants for select to authenticated using(true);",["rls_policy_boundary_matches"]],
      ["table ACL","grant update on public.ai_capacity_grants to service_role;",["table_explicit_acl_matches","effective_table_privileges_match","effective_column_privileges_match"]],
      ["table grant option","grant select on public.ai_capacity_grants to service_role with grant option;",["table_explicit_acl_matches"]],
      ["column ACL","grant select(grant_key) on public.ai_capacity_grants to authenticated;",["column_acl_boundary_matches","effective_column_privileges_match"]],
      ["inherited service ACL","create role capacity_inherited_writer nologin; grant update on public.ai_capacity_grants to capacity_inherited_writer; grant capacity_inherited_writer to service_role;",["table_explicit_acl_matches","effective_table_privileges_match","effective_column_privileges_match"]],
    ]) await t.test(`subclassifies ${name} without emitting catalog contents`,()=>{
      fresh();sql(mutation);const observation=observe();
      for(const field of fields) assert.equal(observation[field],false,field);
      assert.equal(JSON.stringify(observation).includes("capacity_inherited_writer"),false);
    });
    for (const [name,mutation,expected] of [
      ["known marker","insert into supabase_migrations.schema_migrations(version,name) values('20990101000000','ai_capacity_billing_v2');",{capacity_migration_marker_count:1,capacity_known_migration_marker_count:1,capacity_unknown_migration_marker_count:0}],
      ["unknown name-only marker","insert into supabase_migrations.schema_migrations(version,name) values('20990101000001','capacity_v2_unreviewed');",{capacity_migration_marker_count:1,capacity_unknown_migration_marker_count:1,capacity_unknown_marker_name_only_count:1}],
      ["unknown version-only marker","insert into supabase_migrations.schema_migrations(version,name) values('ai_capacity_v2_unreviewed','ai_capacity_billing_v2');",{capacity_migration_marker_count:1,capacity_known_migration_marker_count:1,capacity_unknown_migration_marker_count:1,capacity_unknown_marker_version_only_count:1}],
      ["unknown name-and-version marker with statements","insert into supabase_migrations.schema_migrations(version,name,statements) values('ai_capacity_v2_unreviewed','capacity_v2_unreviewed',array['protected']);",{capacity_migration_marker_count:1,capacity_unknown_migration_marker_count:1,capacity_unknown_marker_name_and_version_count:1,capacity_unknown_marker_with_statements_count:1}],
    ]) await t.test(`reports protected counts for ${name}`,()=>{
      fresh();sql(mutation);const observation=observe();
      for (const [field,value] of Object.entries(expected)) assert.equal(observation[field],value,field);
      assert.equal(JSON.stringify(observation).includes("unreviewed"),false);
      assert.equal(JSON.stringify(observation).includes("protected"),false);
    });
    for (const [name,mutation,key] of [
      ["browser table ACL","grant select on public.ai_capacity_grants to authenticated;","schema_md5"],
      ["browser column ACL","grant select(grant_key) on public.ai_capacity_grants to authenticated;","schema_md5"],
      ["service writer ACL","grant update on public.ai_capacity_grants to service_role;","schema_md5"],
      ["RLS disabled","alter table public.ai_capacity_grants disable row level security;","schema_md5"],
      ["unexpected policy","create policy leaked on public.ai_capacity_grants for select to authenticated using(true);","schema_md5"],
      ["missing immutable trigger","drop trigger ai_capacity_ledger_immutable_update_delete on public.ai_capacity_ledger_events;","schema_md5"],
      ["function body drift","create or replace function public.ai_capacity_ledger_immutable() returns trigger language plpgsql as $$ begin return new; end $$;","schema_md5"],
      ["package 99 default drift","alter table public.ai_capacity_admin_policy alter column package_99_budget_eur_microcents drop default;","policy_package_99_budget_default_matches"],
      ["package 199 default drift","alter table public.ai_capacity_admin_policy alter column package_199_budget_eur_microcents drop default;","policy_package_199_budget_default_matches"],
      ["package 312 default drift","alter table public.ai_capacity_admin_policy alter column package_312_budget_eur_microcents drop default;","policy_package_312_budget_default_matches"],
      ["legacy Reserve overload","create function public.ai_capacity_reserve(uuid,text) returns boolean language sql as $$ select true $$;","lifecycle_functions_absent"],
      ["partial projection","create table public.ai_capacity_workspace_entitlements(workspace_id uuid);","projection_absent"],
      ["unexpected Capacity relation","create table public.ai_capacity_unknown(id integer);","unexpected_capacity_relations_absent"],
      ["partial new column","alter table public.ai_capacity_reservations add column policy_revision bigint;","lifecycle_columns_absent"],
      ["nonempty monetary state","insert into public.ai_capacity_grants(workspace_id,grant_kind,grant_key,granted_eur_microcents) values('10000000-0000-4000-8000-000000000001','purchased','synthetic',1);","grants_empty"],
      ["changed policy revision","update public.ai_capacity_admin_policy set revision=3;","policy_revision"],
      ["disabled freeze","update public.ai_capacity_admin_policy set emergency_spend_freeze=false;","policy_emergency_spend_freeze"],
      ["activation readiness enabled","update public.ai_capacity_admin_policy set runtime_activation_ready=true;","policy_runtime_activation_ready"],
      ["budget drift","update public.ai_capacity_admin_policy set package_99_budget_eur_microcents=1;","policy_package_99_budget_eur_microcents"],
      ["workspace parent drift","alter table public.workspaces disable row level security;","workspace_parent_valid"],
      ["browser CREATE","grant create on schema public to authenticated;","browser_schema_create_denied"],
      ["known foundation migration marker","insert into supabase_migrations.schema_migrations(version,name) values('20990101000000','ai_capacity_billing_v2');","capacity_foundation_migration_marker_absent"],
      ["known activation-gate migration marker","insert into supabase_migrations.schema_migrations(version,name) values('20990101000001','ai_capacity_billing_v2_activation_gates');","capacity_activation_gate_migration_marker_absent"],
      ["known lifecycle migration marker","insert into supabase_migrations.schema_migrations(version,name) values('20990101000002','ai_capacity_reserve_settle');","capacity_lifecycle_migration_marker_absent"],
      ["unknown generic migration marker","insert into supabase_migrations.schema_migrations(version,name) values('20990101000003','capacity_v2_unreviewed');","capacity_unknown_migration_marker_absent"],
      ["unknown foundation-prefix marker","insert into supabase_migrations.schema_migrations(version,name) values('20990101000004','ai_capacity_billing_v2_unreviewed');","capacity_unknown_migration_marker_absent"],
      ["unknown activation-prefix marker","insert into supabase_migrations.schema_migrations(version,name) values('20990101000005','ai_capacity_billing_v2_activation_gates_unreviewed');","capacity_unknown_migration_marker_absent"],
      ["unknown lifecycle-prefix marker","insert into supabase_migrations.schema_migrations(version,name) values('20990101000006','ai_capacity_reserve_settle_unreviewed');","capacity_unknown_migration_marker_absent"],
      ["unknown version beside known name","insert into supabase_migrations.schema_migrations(version,name) values('ai_capacity_v2_unreviewed','ai_capacity_billing_v2');","capacity_unknown_migration_marker_absent"],
      ["unknown name beside known version","insert into supabase_migrations.schema_migrations(version,name) values('ai_capacity_billing_v2','ai_capacity_v2_unreviewed');","capacity_unknown_migration_marker_absent"],
    ]) await t.test(`blocks ${name}`,()=>{
      fresh(); sql(mutation); const result=evaluate(); assert.equal(result.state,"BLOCK"); assert.ok(result.failures.includes(key),JSON.stringify(result));
    });
    await t.test("missing foundation errors; no partial schema can be accepted",()=>{
      fresh();sql("drop table public.ai_capacity_ledger_events;");assert.throws(observe);
    });
    await t.test("read-only transaction rejects an injected write and preserves monetary state",()=>{
      fresh(); const before=observe();
      const injected=query.replace("with table_profiles as (", "insert into public.ai_capacity_grants(workspace_id,grant_kind,grant_key,granted_eur_microcents) values('10000000-0000-4000-8000-000000000001','purchased','must-not-write',1);\nwith table_profiles as (");
      assert.throws(()=>sql(injected),/read-only transaction/u); assert.deepEqual(observe(),before);
    });
    await t.test("non-bypass observer errors instead of asserting RLS-filtered empty monetary tables",()=>{
      fresh();
      sql("create role fanmind_capacity_preflight_observer_ci nologin; grant service_role to fanmind_capacity_preflight_observer_ci;", "postgres");
      try {
        sql("grant usage on schema supabase_migrations to fanmind_capacity_preflight_observer_ci; grant select on supabase_migrations.schema_migrations to fanmind_capacity_preflight_observer_ci;");
        sql("insert into public.ai_capacity_grants(workspace_id,grant_kind,grant_key,granted_eur_microcents) values('10000000-0000-4000-8000-000000000001','purchased','hidden',1);");
        assert.throws(()=>sql(`set role fanmind_capacity_preflight_observer_ci;\n${query}`),/row-level security/u);
      } finally {
        sql("revoke all on schema supabase_migrations from fanmind_capacity_preflight_observer_ci; revoke all on supabase_migrations.schema_migrations from fanmind_capacity_preflight_observer_ci;");
        sql("revoke service_role from fanmind_capacity_preflight_observer_ci; drop role fanmind_capacity_preflight_observer_ci;", "postgres");
      }
    });
    await t.test("outer transaction rollback of exact lifecycle body restores complete baseline",()=>{
      fresh(); const before=observe();
      const source=readFileSync(resolve(root,"supabase/controlled/ai_capacity_reserve_settle.sql"),"utf8");
      assert.match(source,/^begin;\n[\s\S]*\ncommit;\s*$/u);
      const body=source.replace(/^begin;\n/u,"").replace(/\ncommit;\s*$/u,"");
      sql(`begin;\n${body}\nrollback;`);
      assert.deepEqual(observe(),before);
    });
    await t.test("already installed lifecycle is a block, never inferred apply or skip",()=>{
      fresh();sql(readFileSync(resolve(root,"supabase/controlled/ai_capacity_reserve_settle.sql"),"utf8"));
      assert.equal(evaluate().state,"BLOCK");
    });
  } finally {
    sql(`drop database if exists ${db};`,"postgres");
    assert.equal(sql(`select count(*) from pg_database where datname='${db}';`,"postgres"),"0");
  }
});
