import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildWorkspaceRecoverySql, recoveryFunctionSql, recoveryPostflightSql, RECOVERY_PATH } from "../scripts/operations/workspace-provisioning-recovery.mjs";

const required = process.env.FANMIND_WORKSPACE_ACL_PG17_REQUIRED === "true";
const container = process.env.FANMIND_CREATOR_PG17_CONTAINER_ID ?? "";
const database = "fanmind_workspace_recovery_ci";
const owner = "10000000-0000-4000-8000-000000000001";
const creator = "20000000-0000-4000-8000-000000000002";
const member = "30000000-0000-4000-8000-000000000003";
const foreign = "40000000-0000-4000-8000-000000000004";
const q = x => `'${String(x).replaceAll("'", "''")}'`;
const contract = readFileSync("supabase/controlled/20260726121000_workspace_server_owned_columns.sql", "utf8");
const recovery = buildWorkspaceRecoverySql();
function sql(input, db = database) {
  assert.match(container, /^[a-f0-9]{12,64}$/u);
  assert.ok([database, "postgres"].includes(db));
  return execFileSync("docker", ["--host=unix:///var/run/docker.sock", "exec", "-i", container,
    "psql", "-X", "-q", "-A", "-t", "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1"],
  { input, encoding: "utf8", timeout: 30000, maxBuffer: 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] }).trim();
}
const as = (role, actor, statement, claim = role) => sql(`begin;set local role ${role};set local "request.jwt.claim.sub"=${q(actor)};set local "request.jwt.claim.role"=${q(claim)};${statement};commit;`);
const rpc = option => `select row_to_json(r) from public.ensure_current_user_workspace('Untrusted name',${q(option)},true) r`;
const denied = (run, code) => assert.throws(run, e => String(e.stderr).includes(code), code);
const data = () => sql("select jsonb_build_object('workspaces',(select jsonb_agg(to_jsonb(w) order by id) from public.workspaces w),'members',(select jsonb_agg(to_jsonb(m) order by workspace_id,user_id) from public.workspace_members m));");
const state = () => JSON.parse(sql(recoveryPostflightSql()));
const ownerIndexCount = () => sql("select count(*) from pg_index i where i.indrelid='public.workspaces'::regclass and i.indisunique and i.indkey::text=(select attnum::text from pg_attribute where attrelid=i.indrelid and attname='owner_user_id');");
const memberIndexCount = () => sql("select count(*) from pg_index where indrelid='public.workspace_members'::regclass;");

test("Workspace structural recovery is deterministic, pinned, existing-only and offline", () => {
  assert.equal(readFileSync(RECOVERY_PATH, "utf8"), recovery);
  assert.equal(recovery, buildWorkspaceRecoverySql());
  const fn = recoveryFunctionSql();
  assert.match(fn, /workspace_provisioning_new_admission_disabled/u);
  assert.doesNotMatch(fn, /insert into public\.workspaces|payment_terms_accepted_at|starter_paid_setup|starter_no_setup_commitment/u);
  assert.match(fn, /v_user_id uuid := auth\.uid\(\)/u);
  assert.match(fn, /security invoker/u);
  assert.match(fn, /workspace_provisioning_owner_membership_required/u);
  assert.doesNotMatch(fn, /\b(?:insert|update|delete)\b/iu);
  assert.doesNotMatch(recovery, /create unique index workspace_members|update public\.workspaces|delete from|insert into supabase_migrations/u);
});

test("structural recovery executes against existing contracts in isolated PostgreSQL 17", { skip: !required }, async t => {
  assert.equal(sql("select current_setting('server_version_num')::int/10000;", "postgres"), "17");
  sql(`create database ${database};`, "postgres");
  try {
    sql(`create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.role() returns text language sql stable as $$select current_setting('request.jwt.claim.role',true)$$;
      grant usage on schema auth,public to anon,authenticated,service_role;
      revoke create on schema public from public;
      create table public.workspaces(id uuid primary key default gen_random_uuid(),owner_user_id uuid,
        name text,organization_name text,street_address text,postal_code text,city text,country text,vat_id text,tax_number text,company_register_number text,company_register_court text,
        billing_status text,billing_provider text,payment_collection_method text,plan_id text,commercial_option text,
        stripe_customer_id text,stripe_subscription_id text,payment_terms_version text,payment_terms_accepted_at timestamptz,payment_terms_accepted_by_user_id uuid);
      create table public.workspace_members(id uuid primary key default gen_random_uuid(),workspace_id uuid,user_id uuid,role text,
        constraint workspace_members_workspace_id_user_id_key unique(workspace_id,user_id));
      alter table public.workspaces enable row level security;alter table public.workspace_members enable row level security;
      grant all on public.workspaces,public.workspace_members to anon,authenticated,service_role;
      create policy workspaces_select_owner_or_member on public.workspaces for select using(owner_user_id=auth.uid() or exists(select 1 from public.workspace_members m where m.workspace_id=workspaces.id and m.user_id=auth.uid()));
      create policy workspaces_update_owner on public.workspaces for update using(owner_user_id=auth.uid()) with check(owner_user_id=auth.uid());
      create policy fixture_visibility on public.workspaces as restrictive for select to authenticated using(coalesce(current_setting('fixture.visibility',true),'true')='true');
      create policy members_read on public.workspace_members for select using(user_id=auth.uid());
      insert into public.workspaces(id,owner_user_id,name,plan_id,commercial_option,billing_status,billing_provider,payment_collection_method) values
        ('${owner}','${owner}','Owner','starter','starter_paid_setup',null,null,null),
        ('${creator}','${creator}','Creator','starter','starter_paid_setup','active','stripe','sepa_direct_debit');
      insert into public.workspace_members(workspace_id,user_id,role) values('${owner}','${owner}','owner'),('${creator}','${creator}','owner'),('${owner}','${member}','member');`);
    const baseline = data();
    const memberIndexes = memberIndexCount();
    assert.deepEqual(state(), { owner_unique: false, membership_unique: true, rpc_exact: false });
    await t.test("duplicate or null owner identity aborts before any structural change", () => {
      sql(`insert into public.workspaces(id,owner_user_id) values('${foreign}','${owner}');`);
      try { denied(() => sql(recovery), "workspace_recovery_owner_identity_invalid"); }
      finally { sql(`delete from public.workspaces where id='${foreign}';`); }
      sql(`insert into public.workspaces(id,owner_user_id) values('${foreign}',null);`);
      try { denied(() => sql(recovery), "workspace_recovery_owner_identity_invalid"); }
      finally { sql(`delete from public.workspaces where id='${foreign}';`); }
      assert.equal(ownerIndexCount(), "0");assert.equal(state().rpc_exact,false);assert.equal(data(),baseline);
    });
    await t.test("unknown RPC overload or mismatched named Membership constraint blocks", () => {
      sql("create function public.ensure_current_user_workspace(integer) returns integer language sql as 'select $1';");
      try { denied(() => sql(recovery), "workspace_recovery_rpc_already_present"); }
      finally { sql("drop function public.ensure_current_user_workspace(integer);"); }
      sql("alter table public.workspace_members rename constraint workspace_members_workspace_id_user_id_key to fixture_other_name;");
      try { denied(() => sql(recovery), "workspace_recovery_membership_constraint_invalid"); }
      finally { sql("alter table public.workspace_members rename constraint fixture_other_name to workspace_members_workspace_id_user_id_key;"); }
      assert.equal(ownerIndexCount(),"0");assert.equal(data(),baseline);
    });
    await t.test("index-name collisions block; read-only recovery does not require membership INSERT defaults", () => {
      sql("create index workspaces_owner_user_id_uidx on public.workspaces(name);");
      try { denied(() => sql(recovery),"workspace_recovery_owner_index_collision"); }
      finally { sql("drop index public.workspaces_owner_user_id_uidx;"); }
      sql("alter table public.workspace_members alter column id drop default;");
      try { sql(recovery.replace(/commit;\s*$/u,"rollback;")); }
      finally { sql("alter table public.workspace_members alter column id set default gen_random_uuid();"); }
      assert.equal(state().rpc_exact,false);assert.equal(ownerIndexCount(),"0");assert.equal(data(),baseline);
    });
    await t.test("transaction rollback and postflight mutation restore original schema and all rows", () => {
      sql(recovery.replace(/commit;\s*$/u,"rollback;"));
      assert.equal(ownerIndexCount(),"0");assert.equal(state().rpc_exact,false);assert.equal(data(),baseline);
      const mutation = recovery.replace("-- POSTFLIGHT:","grant execute on function public.ensure_current_user_workspace(text,text,boolean) to anon;\n-- POSTFLIGHT:");
      denied(() => sql(mutation),"workspace_recovery_postflight_failed");
      assert.equal(ownerIndexCount(),"0");assert.equal(state().rpc_exact,false);assert.equal(memberIndexCount(),memberIndexes);assert.equal(data(),baseline);
    });
    await t.test("existing equivalent Owner index and Membership constraint are reused without duplicates", () => {
      sql("create unique index fixture_existing_owner_unique on public.workspaces(owner_user_id);");
      sql(recovery.replace(/commit;\s*$/u,"rollback;"));
      assert.equal(ownerIndexCount(),"1");assert.equal(memberIndexCount(),memberIndexes);
      assert.equal(sql("select to_regclass('public.workspaces_owner_user_id_uidx') is null;"),"t");
      sql("drop index public.fixture_existing_owner_unique;");
    });
    await t.test("actual recovery changes only schema, preserves incomplete evidence and is verified exactly", () => {
      sql(recovery);assert.equal(data(),baseline);assert.equal(ownerIndexCount(),"1");assert.equal(memberIndexCount(),memberIndexes);
      assert.equal(sql("select count(*) from pg_proc where pronamespace='public'::regnamespace and prosecdef;"),"0");
      assert.deepEqual(state(),{owner_unique:true,membership_unique:true,rpc_exact:true});
      denied(() => sql(recovery),"workspace_recovery_rpc_already_present");assert.equal(data(),baseline);
      denied(() => sql(contract),"workspace_payment_terms_evidence_missing");assert.equal(data(),baseline);
    });
    await t.test("owning Owner/Creator get only their existing Workspace and no supplied commercial mutation", () => {
      for (const actor of [owner,creator]) {
        const first=JSON.parse(as("authenticated",actor,rpc("capacity_312")));
        assert.deepEqual(first,{workspace_id:actor,created:false});
        assert.deepEqual(JSON.parse(as("authenticated",actor,rpc("starter_paid_setup"))),first);
      }
      assert.equal(data(),baseline);
    });
    await t.test("member/foreign user cannot gain an owning Workspace or admit any retired/current package", () => {
      for(const actor of [member,foreign]) for(const option of ["starter_paid_setup","starter_no_setup_commitment","capacity_99","capacity_199","capacity_312","internal_daily_test","unknown"])
        denied(() => as("authenticated",actor,rpc(option)),"workspace_provisioning_new_admission_disabled");
      denied(() => as("authenticated","",rpc("capacity_99")),"workspace_provisioning_auth_required");
      denied(() => as("authenticated",owner,rpc("capacity_99"),"service_role"),"workspace_provisioning_auth_required");
      denied(() => as("anon",owner,rpc("capacity_99")),"permission denied");
      denied(() => as("service_role",owner,rpc("capacity_99")),"permission denied");
      assert.equal(data(),baseline);
    });
    await t.test("SECURITY INVOKER preserves a restrictive caller RLS denial", () => {
      denied(() => as("authenticated",owner,`set local "fixture.visibility"='false';${rpc("capacity_99")}`),"workspace_provisioning_new_admission_disabled");
      assert.equal(data(),baseline);
    });
    await t.test("missing Owner membership is denied without repair or role escalation", () => {
      sql(`delete from public.workspace_members where workspace_id='${owner}' and user_id='${owner}';`);
      denied(() => as("authenticated",owner,rpc("capacity_99")),"workspace_provisioning_owner_membership_required");
      assert.equal(sql(`select count(*) from public.workspace_members where workspace_id='${owner}' and user_id='${owner}';`),"0");
      assert.equal(sql(`select count(*) from public.workspace_members where workspace_id='${creator}' and user_id='${creator}' and role='owner';`),"1");
      sql(`insert into public.workspace_members(workspace_id,user_id,role) values('${owner}','${owner}','owner');`);
    });
    await t.test("unique Owner identity prevents direct duplicate insertion; body and ACL drift are detected", () => {
      denied(() => sql(`insert into public.workspaces(id,owner_user_id) values('${foreign}','${owner}');`),"duplicate key");
      sql("grant execute on function public.ensure_current_user_workspace(text,text,boolean) to anon;");
      assert.equal(state().rpc_exact,false);
      sql("revoke execute on function public.ensure_current_user_workspace(text,text,boolean) from anon;");assert.equal(state().rpc_exact,true);
      sql("alter function public.ensure_current_user_workspace(text,text,boolean) set search_path=public;");
      assert.equal(state().rpc_exact,false);
      sql("alter function public.ensure_current_user_workspace(text,text,boolean) set search_path=pg_catalog,public,pg_temp;");assert.equal(state().rpc_exact,true);
    });
    await t.test("unmodified Billing Contract works only after explicit synthetic evidence; server writes survive", () => {
      // Isolated synthetic fixture only, never a repair recipe for real consent.
      sql("update public.workspaces set payment_terms_version='2026-06-v1',payment_terms_accepted_at=statement_timestamp(),payment_terms_accepted_by_user_id=owner_user_id;");
      sql(contract);
      assert.deepEqual(JSON.parse(as("authenticated",owner,rpc("capacity_99"))),{workspace_id:owner,created:false});
      denied(() => as("authenticated",owner,"update public.workspaces set billing_status='active'"),"permission denied");
      assert.equal(as("authenticated",owner,`with changed as(update public.workspaces set name='Allowed' where id='${owner}' returning id) select count(*) from changed`),"1");
      assert.equal(as("service_role",owner,`with changed as(update public.workspaces set billing_status='active' where id='${owner}' returning id) select count(*) from changed`),"1");
      assert.deepEqual(state(),{owner_unique:true,membership_unique:true,rpc_exact:true});
    });
  } finally { sql(`drop database ${database} with(force);`,"postgres"); }
  assert.equal(sql(`select count(*) from pg_database where datname='${database}';`,"postgres"),"0");
});
