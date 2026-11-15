import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

// Only the existing disposable CI PostgreSQL service is accepted. No URL,
// Supabase credential, host database or target write is supported here.
const required = process.env.FANMIND_WORKSPACE_ACL_PG17_REQUIRED === "true";
const container = process.env.FANMIND_CREATOR_PG17_CONTAINER_ID ?? "";
const database = "fanmind_workspace_acl_ci";
const owner = "10000000-0000-4000-8000-000000000001";
const creator = "20000000-0000-4000-8000-000000000002";
const member = "30000000-0000-4000-8000-000000000003";
const stranger = "40000000-0000-4000-8000-000000000004";
const fields = {
  billing_status: "'active'", stripe_customer_id: "'cus_Synthetic'",
  stripe_subscription_id: "'sub_Synthetic'", plan_id: "'capacity_199'",
  commercial_option: "'capacity_199'", payment_terms_accepted_at: "statement_timestamp()",
};
const editable = ["name", "organization_name", "street_address", "postal_code", "city", "country", "vat_id", "tax_number", "company_register_number", "company_register_court"];
const contract = readFileSync(new URL("../supabase/controlled/20260726121000_workspace_server_owned_columns.sql", import.meta.url), "utf8");
const contractBody = contract.replace(/^begin;\s*$/mu, "").replace(/^commit;\s*$/mu, "");
function sql(input, db = database) {
  assert.match(container, /^[a-f0-9]{12,64}$/u);
  assert.ok([database, "postgres"].includes(db));
  return execFileSync("docker", ["--host=unix:///var/run/docker.sock", "exec", "-i", container,
    "psql", "-X", "-q", "-A", "-t", "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1"],
  { input, encoding: "utf8", timeout: 30000, maxBuffer: 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] }).trim();
}
function as(role, actor, statement, gate = true) {
  assert.ok(["anon", "authenticated", "service_role"].includes(role));
  return sql(`begin;set local role ${role};set local "request.jwt.claim.sub"='${actor}';set local "fixture.crm_allowed"='${gate}';${statement};commit;`);
}
function denied(role, actor, statement) {
  assert.throws(() => as(role, actor, statement), e => /permission denied/u.test(String(e.stderr)), statement);
}
const snapshot = () => sql(`select jsonb_build_object('acl',c.relacl::text,'rls',c.relrowsecurity,
  'columns',(select jsonb_agg(jsonb_build_array(attname,attacl::text) order by attnum) from pg_attribute where attrelid=c.oid and attnum>0 and not attisdropped),
  'policies',(select jsonb_agg(jsonb_build_array(polname,polcmd,polpermissive,polroles::text,pg_get_expr(polqual,polrelid),pg_get_expr(polwithcheck,polrelid)) order by polname) from pg_policy where polrelid=c.oid)) from pg_class c where c.oid='public.workspaces'::regclass;`);

test("existing Workspace contract closes Billing ACLs on isolated PostgreSQL 17", { skip: !required }, async t => {
  assert.equal(sql("select current_setting('server_version_num')::int/10000;", "postgres"), "17");
  // Roles are supplied by the preceding existing authorization-roundtrip job.
  assert.equal(sql("select count(*) from pg_roles where rolname in ('anon','authenticated','service_role');", "postgres"), "3");
  sql(`create database ${database};`, "postgres");
  try {
    sql(`create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth,public to anon,authenticated,service_role;
      create table public.workspace_members(workspace_id uuid,user_id uuid);
      create table public.workspaces(id uuid primary key,owner_user_id uuid,${editable.map(c => `${c} text`).join(",")},
        billing_status text,stripe_customer_id text,stripe_subscription_id text,plan_id text,commercial_option text,
        payment_terms_version text,payment_terms_accepted_at timestamptz,payment_terms_accepted_by_user_id uuid);
      insert into public.workspaces(id,owner_user_id,name,plan_id,commercial_option) values
        ('${owner}','${owner}','Owner','capacity_99','capacity_99'),('${creator}','${creator}','Creator','capacity_99','capacity_99');
      insert into public.workspace_members values('${owner}','${member}');
      grant select on public.workspace_members to authenticated;
      grant all on public.workspaces to anon,authenticated,service_role;
      grant insert(billing_status),update(stripe_customer_id) on public.workspaces to authenticated;
      alter table public.workspaces enable row level security;
      create policy workspaces_select_owner_or_member on public.workspaces for select using(owner_user_id=auth.uid() or exists(select 1 from public.workspace_members wm where wm.workspace_id=workspaces.id and wm.user_id=auth.uid()));
      create policy workspaces_insert_owner on public.workspaces for insert with check(owner_user_id=auth.uid());
      create policy workspaces_insert_own on public.workspaces for insert to authenticated with check(owner_user_id=auth.uid());
      create policy workspaces_update_owner on public.workspaces for update using(owner_user_id=auth.uid()) with check(owner_user_id=auth.uid());
      -- Explicit gate double: tests exercise the real restrictive policy
      -- combination, not the complete Adminchat entitlement implementation.
      create function public.admin_crm_read_allowed(uuid) returns boolean language sql stable as $$select coalesce(current_setting('fixture.crm_allowed',true),'true')='true'$$;
      create policy admin_crm_entitlement_boundary on public.workspaces as restrictive for all to authenticated using(admin_crm_read_allowed(id)) with check(admin_crm_read_allowed(id));`);
    await t.test("observed pre-contract rights permit all six own-Workspace writes", () => {
      for (const [field,value] of Object.entries(fields)) assert.equal(as("authenticated",owner,`with changed as(update public.workspaces set ${field}=${value} where id='${owner}' returning id) select count(*) from changed`),"1");
    });
    const before = snapshot();
    await t.test("missing legacy acceptance evidence aborts before any privilege change", () => {
      sql(`update public.workspaces set plan_id='starter',commercial_option='starter_paid_setup',payment_terms_version=null where id='${owner}';`);
      try {
        assert.throws(() => sql(contract), e => /workspace_payment_terms_evidence_missing/u.test(String(e.stderr)));
        assert.equal(snapshot(),before);
      } finally {
        sql(`update public.workspaces set plan_id='capacity_199',commercial_option='capacity_199' where id='${owner}';`);
      }
    });
    await t.test("rollback rehearsal restores exact ACLs, column grants and policies", () => {
      sql(`begin;${contractBody}rollback;`);
      assert.equal(snapshot(), before);
    });
    sql(contract); // Actual existing controlled SQL, unchanged, disposable DB only.
    const secured = snapshot();
    await t.test("Owner and owning Creator retain all ten master-data updates", () => {
      for (const actor of [owner,creator]) for (const field of editable)
        assert.equal(as("authenticated",actor,`with changed as(update public.workspaces set ${field}='Synthetic' where id='${actor}' returning id) select count(*) from changed`),"1");
    });
    await t.test("Owner, Creator, member, stranger and anonymous cannot write any Billing field", () => {
      for (const actor of [owner,creator,member,stranger]) for (const [field,value] of Object.entries(fields))
        denied("authenticated",actor,`update public.workspaces set ${field}=${value} where id='${owner}'`);
      for (const [field,value] of Object.entries(fields)) denied("anon",owner,`update public.workspaces set ${field}=${value} where id='${owner}'`);
      denied("authenticated",owner,`insert into public.workspaces(id,owner_user_id) values('${stranger}','${owner}')`);
      denied("anon",owner,`insert into public.workspaces(id,owner_user_id) values('${stranger}','${owner}')`);
    });
    await t.test("foreign/member master-data updates touch zero rows; owning Creator stays isolated", () => {
      for (const actor of [creator,member,stranger]) assert.equal(as("authenticated",actor,`with changed as(update public.workspaces set name='forbidden' where id='${owner}' returning id) select count(*) from changed`),"0");
      assert.equal(as("authenticated",member,"select count(*) from public.workspaces"),"1");
      assert.equal(as("authenticated",stranger,"select count(*) from public.workspaces"),"0");
      assert.equal(as("authenticated",owner,`with changed as(update public.workspaces set name='forbidden' where id='${owner}' returning id) select count(*) from changed`,false),"0");
    });
    await t.test("service process retains INSERT and all six protected updates", () => {
      for (const [field,value] of Object.entries(fields)) assert.equal(as("service_role",owner,`with changed as(update public.workspaces set ${field}=${value} where id='${owner}' returning id) select count(*) from changed`),"1");
      assert.equal(as("service_role",owner,`with changed as(insert into public.workspaces(id,owner_user_id) values('${stranger}','${stranger}') returning id) select count(*) from changed`),"1");
      sql(`delete from public.workspaces where id='${stranger}';`);
    });
    await t.test("extra permissive UPDATE policy cannot broaden the restrictive Owner boundary", () => {
      sql("create policy fixture_allow_all on public.workspaces for update to authenticated using(true) with check(true);");
      try { assert.equal(as("authenticated",member,`with changed as(update public.workspaces set name='forbidden' where id='${owner}' returning id) select count(*) from changed`),"0"); }
      finally { sql("drop policy fixture_allow_all on public.workspaces;"); }
    });
    await t.test("permission-widening mutation is detected, then original protection restored", () => {
      sql("grant update(billing_status) on public.workspaces to authenticated;");
      try { assert.throws(() => denied("authenticated",owner,`update public.workspaces set billing_status='mutated' where id='${owner}'`),assert.AssertionError); }
      finally { sql("revoke update(billing_status) on public.workspaces from authenticated;"); }
      denied("authenticated",owner,`update public.workspaces set billing_status='mutated' where id='${owner}'`);
      assert.equal(snapshot(),secured);
    });
  } finally {
    sql(`drop database ${database} with(force);`,"postgres");
  }
  assert.equal(sql(`select count(*) from pg_database where datname='${database}';`,"postgres"),"0");
});
