import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

// Same isolated Docker/psql transport as the existing required PG17 tests.
// No network URL, credentials, Supabase project or host database is accepted.
const required = process.env.FANMIND_CAPACITY_PG17_REQUIRED === "true";
const container = process.env.FANMIND_CREATOR_PG17_CONTAINER_ID ?? "";
const database = "fanmind_capacity_lifecycle_ci";
const dockerArgs = ["--host=unix:///var/run/docker.sock", "exec", "-i", container,
  "psql", "-X", "-q", "-A", "-t", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1"];
const w1 = "10000000-0000-4000-8000-000000000001";
const w2 = "10000000-0000-4000-8000-000000000002";
const missing = "10000000-0000-4000-8000-000000000003";
const B = 1_500_000_000;
const quote = value => value == null ? "null" : `'${String(value).replaceAll("'", "''")}'`;
function sql(statement, db = database) {
  assert.match(container, /^[0-9a-f]{12,64}$/u);
  assert.ok([database, "postgres"].includes(db));
  const args = [...dockerArgs]; args[args.indexOf("-d") + 1] = db;
  return execFileSync("docker", args, {input: statement, stdio: ["pipe", "pipe", "pipe"], encoding: "utf8", timeout: 30000, maxBuffer: 1024 * 1024}).trim();
}
const serviceSql = statement => `begin; set local role service_role; set local "request.jwt.claim.role"='service_role'; ${statement}; commit;`;
const service = statement => sql(serviceSql(statement));
function failure(statement, code) {
  assert.throws(() => service(statement), error => error.stderr?.toString().includes(code), code);
}
function grant({workspace = w1, key = "included", purchased = false, amount = B} = {}) {
  return `select public.ai_capacity_grant_credit(${quote(workspace)},${quote(purchased ? "purchased" : "included_period")},${quote(key)},
    ${purchased ? "null,null,null,null" : `${quote("capacity_99")},'period-1',(select period_start from public.ai_capacity_workspace_entitlements where workspace_id=${quote(workspace)}),(select period_end from public.ai_capacity_workspace_entitlements where workspace_id=${quote(workspace)})`},null,${amount},'{}')`;
}
function reserve({workspace = w1, key = "generation", amount = 100, period = "period-1", packageId = "capacity_99", mode = "fast", policy = 1, entitlement = 1, model = "model-ci", pricing = "price-ci", fx = "fx-ci"} = {}) {
  return `select row_to_json(r) from public.ai_capacity_reserve(${quote(workspace)},${quote(key)},${quote(period)},${quote(packageId)},${quote(mode)},${amount},${policy},${entitlement},'openai',${quote(model)},${quote(pricing)},${quote(fx)},'{}') r`;
}
function settle(id, amount = 60, {input = 100, cached = 20, cacheWrite = 0, output = 30, reasoning = 10, model = "model-ci", fx = "fx-ci"} = {}) {
  return `select row_to_json(r) from public.ai_capacity_settle(${quote(id)},${amount},'openai',${quote(model)},${input},${cached},${cacheWrite},${output},${reasoning},'price-ci',${quote(fx)},'{}') r`;
}
const release = id => `select row_to_json(r) from public.ai_capacity_release(${quote(id)},'definitive_failure') r`;
const hold = id => `select row_to_json(r) from public.ai_capacity_mark_indeterminate(${quote(id)},'provider_timeout') r`;
const row = statement => JSON.parse(service(statement));
const count = () => sql("select count(*) from public.ai_capacity_ledger_events;");
const balance = () => row(`select row_to_json(s) from public.ai_capacity_balance_snapshot('${w1}') s`);
function fresh() {
  sql(`truncate public.ai_capacity_ledger_events,public.ai_capacity_reservation_allocations,public.ai_capacity_reservations,public.ai_capacity_grants,public.ai_capacity_workspace_entitlements;
    update public.ai_capacity_admin_policy set runtime_activation_ready=true,global_capacity_enabled=true,emergency_spend_freeze=false,fast_enabled=true,balanced_enabled=true,premium_enabled=true,revision=1;
    insert into public.ai_capacity_workspace_entitlements(workspace_id,billing_contract_version,package_id,billing_period_key,period_start,period_end,revision,active,source_fingerprint)
    values ('${w1}','capacity_v2','capacity_99','period-1',statement_timestamp()-interval '1 day',statement_timestamp()+interval '1 day',1,true,repeat('a',64)),
           ('${w2}','capacity_v2','capacity_99','period-1',statement_timestamp()-interval '1 day',statement_timestamp()+interval '1 day',1,true,repeat('b',64));`);
}
function asyncSql(statement) {
  assert.match(container, /^[0-9a-f]{12,64}$/u);
  return new Promise((resolve, reject) => {
    const child = spawn("docker", dockerArgs, {stdio: ["pipe", "pipe", "pipe"]});
    let stdout = "", stderr = "";
    const timer = setTimeout(() => {child.kill("SIGKILL"); reject(new Error("capacity_pg17_timeout"));}, 30000);
    child.stdout.on("data", b => {stdout += b;}); child.stderr.on("data", b => {stderr += b;});
    child.on("error", e => {clearTimeout(timer); reject(e);});
    child.on("close", code => {clearTimeout(timer); resolve({code,stdout:stdout.trim(),stderr});});
    child.stdin.end(statement);
  });
}
// Barrier detects an actual server-side wait, never assumes scheduler timing.
async function waitFor(query) {
  const until = Date.now() + 15000;
  while (Date.now() < until) {
    if (sql(query) === "t") return;
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  assert.fail("PostgreSQL concurrency barrier was not reached");
}

test("Capacity lifecycle executes against isolated PostgreSQL 17", {skip: !required}, async t => {
  assert.equal(sql("select current_setting('server_version_num')::int / 10000;", "postgres"), "17");
  sql(`do $$ begin
    if not exists(select from pg_roles where rolname='anon') then create role anon nologin; end if;
    if not exists(select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
    if not exists(select from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
  end $$; create database ${database};`, "postgres");
  try {
    sql(`create schema auth;
      create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role',true) $$;
      grant usage on schema auth,public to anon,authenticated,service_role;
      create table public.workspaces(id uuid primary key);
      insert into public.workspaces values ('${w1}'),('${w2}');`);
    for (const name of ["ai_capacity_billing_v2.sql","ai_capacity_billing_v2_activation_gates.sql","ai_capacity_reserve_settle.sql"]) {
      sql(readFileSync(new URL(`../supabase/controlled/${name}`,import.meta.url),"utf8"));
    }
    await t.test("install compiles real SQL; grants are bound, exact-budget and idempotent", () => {
      fresh(); const id = service(grant()); assert.match(id,/^[0-9a-f-]{36}$/u);
      assert.equal(service(grant()),id); assert.equal(count(),"1");
      failure(grant({amount:B-1}),"ai_capacity_grant_idempotency_conflict");
      failure(grant({key:"other-period-key"}),"ai_capacity_included_period_idempotency_conflict");
      failure(grant({workspace:missing,purchased:true,amount:100}),"ai_capacity_workspace_missing");
      failure(grant({workspace:w2,amount:B-1}),"ai_capacity_grant_budget_mismatch");
      sql(`update public.ai_capacity_workspace_entitlements set active=false where workspace_id='${w2}';`);
      failure(grant({workspace:w2}),"ai_capacity_entitlement_invalid");
      assert.equal(count(),"1");
    });
    await t.test("reserve/settle split consumes included first; exact immutable replay; ledger append-only", () => {
      fresh(); service(grant()); service(grant({purchased:true,key:"purchase",amount:100}));
      const r=row(reserve({amount:B+80})); assert.equal(r.created,true);
      assert.equal(row(reserve({amount:B+80})).created,false);
      assert.equal(sql(`select string_agg(g.grant_kind||':'||a.reserved_eur_microcents,',' order by g.grant_kind) from public.ai_capacity_reservation_allocations a join public.ai_capacity_grants g on g.id=a.grant_id;`),`included_period:${B},purchased:80`);
      const s=row(settle(r.reservation_id,B+20)); assert.equal(s.state,"settled"); assert.equal(s.released_eur_microcents,60);
      const events=count(); assert.deepEqual(row(settle(r.reservation_id,B+20)),s); assert.equal(count(),events);
      failure(settle(r.reservation_id,B+20,{input:101}),"ai_capacity_settlement_idempotency_conflict");
      failure(settle(r.reservation_id,B+20,{fx:"different"}),"ai_capacity_settlement_idempotency_conflict");
      failure(release(r.reservation_id),"ai_capacity_release_state_invalid");
      failure(reserve({amount:B+80}),"ai_capacity_generation_not_replayable");
      assert.equal(balance().available_eur_microcents,80);
      assert.throws(()=>sql("update public.ai_capacity_ledger_events set amount_eur_microcents=0;"),/ai_capacity_ledger_immutable/u);
      assert.throws(()=>sql("delete from public.ai_capacity_ledger_events;"),/ai_capacity_ledger_immutable/u);
    });
    await t.test("definitive failure releases once; missing usage/timeout hold until actual reconciliation", () => {
      fresh(); service(grant({purchased:true,amount:1000}));
      const a=row(reserve()); failure(settle(a.reservation_id,60,{input:"null"}),"ai_capacity_settlement_invalid");
      assert.equal(balance().held_eur_microcents,100);
      assert.equal(row(hold(a.reservation_id)).state,"indeterminate"); const events=count(); row(hold(a.reservation_id)); assert.equal(count(),events);
      assert.equal(row(settle(a.reservation_id)).state,"settled"); // late, billing-grade response reconciles timeout
      const b=row(reserve({key:"failed"})); row(hold(b.reservation_id));
      assert.equal(row(release(b.reservation_id)).state,"released"); const after=count(); row(release(b.reservation_id)); assert.equal(count(),after);
      assert.equal(balance().available_eur_microcents,940);
      const zero=row(reserve({key:"zero"})); row(settle(zero.reservation_id,0));
      failure(settle(zero.reservation_id,0,{input:101}),"ai_capacity_settlement_idempotency_conflict");
    });
    await t.test("actual exceeds reserve persists a durable idempotent reconciliation hold", () => {
      fresh(); service(grant({purchased:true,amount:1000})); const r=row(reserve());
      const over=row(settle(r.reservation_id,101)); assert.equal(over.state,"reconciliation_required");
      const events=count(); assert.deepEqual(row(settle(r.reservation_id,101)),over); assert.equal(count(),events);
      failure(settle(r.reservation_id,102),"ai_capacity_reconciliation_idempotency_conflict");
      failure(release(r.reservation_id),"ai_capacity_release_state_invalid");
      assert.equal(balance().held_eur_microcents,100); assert.equal(balance().available_eur_microcents,900);
    });
    await t.test("freeze/revocation stops admission but cannot strand existing recovery obligations", () => {
      fresh(); service(grant({purchased:true,amount:1000}));
      const a=row(reserve()), b=row(reserve({key:"late"})); row(hold(a.reservation_id)); row(hold(b.reservation_id));
      sql(`update public.ai_capacity_admin_policy set emergency_spend_freeze=true,global_capacity_enabled=false,revision=2;
        update public.ai_capacity_workspace_entitlements set active=false,revision=2 where workspace_id='${w1}';`);
      failure(reserve({key:"blocked"}),"ai_capacity_entitlement_invalid");
      assert.equal(row(settle(a.reservation_id)).state,"settled"); assert.equal(row(release(b.reservation_id)).state,"released");
      assert.equal(balance().available_eur_microcents,940);
    });
    await t.test("removing the real SQL freeze guard makes the admission negative fail", () => {
      fresh(); service(grant({purchased:true,amount:1000}));
      sql("update public.ai_capacity_admin_policy set emergency_spend_freeze=true;");
      failure(reserve(),"ai_capacity_admission_closed");
      const definition=sql("select pg_get_functiondef(oid) from pg_proc where pronamespace='public'::regnamespace and proname='ai_capacity_reserve';");
      const mutated=definition.replace(" or v_policy.emergency_spend_freeze",""); assert.notEqual(mutated,definition);
      try {
        sql(mutated);
        assert.throws(()=>failure(reserve(),"ai_capacity_admission_closed"),assert.AssertionError);
      } finally {sql(definition);}
      failure(reserve({key:"restored"}),"ai_capacity_admission_closed");
    });
    await t.test("policy revision, global/freeze/modes deny atomically without new ledger events", () => {
      fresh(); service(grant({purchased:true,amount:1000})); const before=count();
      failure(reserve({policy:2}),"ai_capacity_policy_revision_conflict");
      for (const change of ["emergency_spend_freeze=true","global_capacity_enabled=false"]) {
        sql(`update public.ai_capacity_admin_policy set ${change};`); failure(reserve(),"ai_capacity_admission_closed");
        sql("update public.ai_capacity_admin_policy set emergency_spend_freeze=false,global_capacity_enabled=true;");
      }
      for (const mode of ["fast","balanced","premium"]) {
        sql(`update public.ai_capacity_admin_policy set ${mode}_enabled=false;`);
        failure(reserve({mode}),"ai_capacity_quality_mode_disabled");
        sql(`update public.ai_capacity_admin_policy set ${mode}_enabled=true;`);
      }
      assert.equal(count(),before); assert.equal(sql("select count(*) from public.ai_capacity_reservations;"),"0");
      // All package sales switches are still false: ongoing entitled use works.
      assert.equal(row(reserve()).created,true);
    });
    await t.test("workspace, entitlement revision/package/period, future/expired/revoked bindings fail closed", () => {
      fresh(); service(grant({purchased:true,amount:1000})); const before=count();
      for (const [options,error] of [[{workspace:missing},"ai_capacity_entitlement_invalid"],[{workspace:w2},"ai_capacity_insufficient_balance"],[{packageId:"capacity_199"},"ai_capacity_entitlement_invalid"],[{period:"foreign"},"ai_capacity_entitlement_invalid"],[{entitlement:2},"ai_capacity_entitlement_revision_conflict"]]) failure(reserve(options),error);
      for (const mutation of ["active=false","period_start=clock_timestamp()+interval '1 hour'","period_end=clock_timestamp()-interval '1 hour',period_start=clock_timestamp()-interval '1 day'"]) {
        sql(`update public.ai_capacity_workspace_entitlements set ${mutation} where workspace_id='${w1}';`);
        failure(reserve(),"ai_capacity_entitlement_invalid"); fresh(); service(grant({purchased:true,amount:1000}));
      }
      sql(`delete from public.ai_capacity_workspace_entitlements where workspace_id='${w1}';`); failure(reserve(),"ai_capacity_entitlement_invalid"); assert.equal(count(),before);
    });
    await t.test("period rollover never charges the next included grant; purchased capacity survives", () => {
      fresh(); service(grant()); service(grant({purchased:true,key:"purchase",amount:100}));
      const r=row(reserve({amount:80}));
      sql(`update public.ai_capacity_workspace_entitlements set billing_period_key='period-2',revision=2,period_start=clock_timestamp()-interval '1 second',period_end=clock_timestamp()+interval '2 days' where workspace_id='${w1}';
        update public.ai_capacity_grants set period_start=clock_timestamp()-interval '2 days',period_end=clock_timestamp()-interval '1 second' where grant_kind='included_period';`);
      service(grant({key:"included-2"}).replace("'period-1'","'period-2'"));
      row(settle(r.reservation_id,60));
      const next=row(reserve({key:"next",period:"period-2",entitlement:2,amount:B+100}));
      assert.equal(next.created,true); failure(reserve({key:"old",amount:1}),"ai_capacity_entitlement_invalid");
      assert.equal(sql(`select count(*) from public.ai_capacity_reservation_allocations a join public.ai_capacity_grants g on g.id=a.grant_id where a.reservation_id='${r.reservation_id}' and g.billing_period_key='period-2';`),"0");
    });
    await t.test("browser roles and spoofed claims cannot read or execute monetary RPCs", () => {
      fresh(); service(grant({purchased:true,amount:1000})); const r=row(reserve());
      for (const role of ["anon","authenticated"]) {
        for (const statement of [reserve(),grant(),settle(r.reservation_id),release(r.reservation_id),hold(r.reservation_id),`select * from public.ai_capacity_balance_snapshot('${w1}')`,"select * from public.ai_capacity_workspace_entitlements","select * from public.ai_capacity_grants","select * from public.ai_capacity_reservations"]) {
          assert.throws(()=>sql(`begin; set local role ${role}; set local "request.jwt.claim.role"='service_role'; ${statement}; commit;`),/permission denied/u);
        }
      }
      assert.throws(()=>sql(`begin; set local role service_role; set local "request.jwt.claim.role"='authenticated'; ${reserve()}; commit;`),/ai_capacity_service_role_required/u);
      assert.throws(()=>service(`update public.ai_capacity_workspace_entitlements set active=true`),/permission denied/u);
      for (const value of ["p_grant_kind", "p_package_id", "p_quality_mode"]) {
        const call=value==="p_grant_kind" ? grant({purchased:true}).replace("'purchased'","null") : reserve().replace(quote(value==="p_package_id"?"capacity_99":"fast"),"null");
        failure(call,value==="p_grant_kind"?"ai_capacity_grant_invalid":"ai_capacity_reservation_invalid");
      }
    });
    await t.test("different immutable reserve parameters conflict, including model/FX provenance", () => {
      fresh(); service(grant({purchased:true,amount:1000})); row(reserve());
      for (const patch of [{model:"other"},{pricing:"other"},{fx:"other"},{amount:101},{mode:"balanced"}]) failure(reserve(patch),"ai_capacity_reservation_idempotency_conflict");
    });
    await t.test("concurrent duplicate grants append one authoritative credit", async () => {
      fresh();
      const results=await Promise.all([1,2].map(()=>asyncSql(serviceSql(grant()))));
      assert.ok(results.every(x=>x.code===0)); assert.equal(results[0].stdout,results[1].stdout);
      assert.equal(count(),"1"); assert.equal(sql("select count(*) from public.ai_capacity_grants;"),"1");
    });
    await t.test("same period key cannot substitute different entitlement time bounds", () => {
      fresh(); service(grant()); service(grant({purchased:true,key:"purchase",amount:1000}));
      sql(`update public.ai_capacity_workspace_entitlements set period_end=period_end+interval '1 hour',revision=2 where workspace_id='${w1}';`);
      failure(reserve({entitlement:2}),"ai_capacity_entitlement_invalid");
      assert.equal(sql("select count(*) from public.ai_capacity_reservations;"),"0");
    });
    await t.test("future included credit is neither spendable nor displayed as current balance", () => {
      fresh();
      sql(`update public.ai_capacity_workspace_entitlements set period_start=clock_timestamp()+interval '1 hour' where workspace_id='${w1}';`);
      service(grant()); assert.equal(balance().available_eur_microcents,0);
      failure(reserve(),"ai_capacity_entitlement_invalid");
    });
    await t.test("oversized request rolls back an attempted partial included/purchased allocation", () => {
      fresh(); service(grant()); service(grant({purchased:true,key:"purchase",amount:50})); const before=count();
      failure(reserve({amount:B+51}),"ai_capacity_insufficient_balance");
      assert.equal(count(),before); assert.equal(sql("select count(*) from public.ai_capacity_reservation_allocations;"),"0");
      assert.equal(balance().available_eur_microcents,B+50);
    });
    await t.test("concurrent reserves cannot overspend or duplicate; failed reservation fully rolls back", async () => {
      fresh(); service(grant({purchased:true,amount:100}));
      const results=await Promise.all(["a","b"].map(key=>asyncSql(serviceSql(reserve({key,amount:80})))));
      assert.equal(results.filter(x=>x.code===0).length,1); assert.match(results.find(x=>x.code!==0).stderr,/ai_capacity_insufficient_balance/u);
      assert.equal(sql("select count(*) from public.ai_capacity_reservations;"),"1"); assert.equal(balance().held_eur_microcents,80);
      fresh(); service(grant({purchased:true,amount:100}));
      const same=await Promise.all([1,2].map(()=>asyncSql(serviceSql(reserve({amount:80})))));
      assert.ok(same.every(x=>x.code===0)); assert.deepEqual(same.map(x=>JSON.parse(x.stdout).created).sort(),[false,true]);
      assert.equal(sql("select count(*) from public.ai_capacity_reservation_allocations;"),"1");
    });
    await t.test("policy change committed while reserve waits is checked after the lock", async () => {
      fresh(); service(grant({purchased:true,amount:1000}));
      const blocker=asyncSql(`begin; set local application_name='capacity_policy_barrier'; update public.ai_capacity_admin_policy set emergency_spend_freeze=true,revision=2; select pg_sleep(1.5); commit;`);
      await waitFor("select exists(select from pg_stat_activity where application_name='capacity_policy_barrier' and wait_event='PgSleep');");
      const r=await asyncSql(serviceSql(reserve())); await blocker;
      assert.notEqual(r.code,0); assert.match(r.stderr,/ai_capacity_policy_revision_conflict/u); assert.equal(sql("select count(*) from public.ai_capacity_reservations;"),"0");
    });
    await t.test("entitlement expiry during policy lock wait denies admission after acquiring both rows", async () => {
      fresh(); service(grant({purchased:true,amount:1000}));
      sql(`update public.ai_capacity_workspace_entitlements set period_end=clock_timestamp()+interval '1 second' where workspace_id='${w1}';`);
      const blocker=asyncSql("begin; set local application_name='capacity_expiry_barrier'; update public.ai_capacity_admin_policy set revision=revision; select pg_sleep(1.5); commit;");
      await waitFor("select exists(select from pg_stat_activity where application_name='capacity_expiry_barrier' and wait_event='PgSleep');");
      const r=await asyncSql(serviceSql(reserve())); await blocker;
      assert.notEqual(r.code,0); assert.match(r.stderr,/ai_capacity_entitlement_invalid/u);
      assert.equal(sql("select count(*) from public.ai_capacity_reservations;"),"0");
    });
    await t.test("purchased credit expiring during workspace lock wait is not spendable", async () => {
      fresh(); service(grant({purchased:true,amount:1000}));
      sql("update public.ai_capacity_grants set expires_at=clock_timestamp()+interval '1 second';");
      const blocker=asyncSql(`begin; set local application_name='capacity_purchase_expiry_barrier'; select pg_advisory_xact_lock(hashtextextended('${w1}',41001)); select pg_sleep(1.5); commit;`);
      await waitFor("select exists(select from pg_stat_activity where application_name='capacity_purchase_expiry_barrier' and wait_event='PgSleep');");
      const r=await asyncSql(serviceSql(reserve())); await blocker;
      assert.notEqual(r.code,0); assert.match(r.stderr,/ai_capacity_insufficient_balance/u);
      assert.equal(sql("select count(*) from public.ai_capacity_reservations;"),"0");
    });
    await t.test("entitlement revocation committed during reserve wait cannot be bypassed", async () => {
      fresh(); service(grant({purchased:true,amount:1000}));
      const blocker=asyncSql(`begin; set local application_name='capacity_entitlement_barrier'; update public.ai_capacity_workspace_entitlements set active=false,revision=2 where workspace_id='${w1}'; select pg_sleep(1.5); commit;`);
      await waitFor("select exists(select from pg_stat_activity where application_name='capacity_entitlement_barrier' and wait_event='PgSleep');");
      const r=await asyncSql(serviceSql(reserve())); await blocker;
      assert.notEqual(r.code,0); assert.match(r.stderr,/ai_capacity_entitlement_invalid/u);
    });
    await t.test("concurrent settle/release terminalizes once without duplicate monetary events", async () => {
      fresh(); service(grant({purchased:true,amount:1000})); const r=row(reserve());
      const results=await Promise.all([settle(r.reservation_id),release(r.reservation_id)].map(x=>asyncSql(serviceSql(x))));
      assert.equal(results.filter(x=>x.code===0).length,1);
      assert.ok(!results.some(x=>/deadlock detected/u.test(x.stderr)));
      assert.ok([940,1000].includes(balance().available_eur_microcents));
    });
  } finally {
    sql(`drop database ${database} with (force);`,"postgres");
    assert.equal(sql(`select count(*) from pg_database where datname='${database}';`,"postgres"),"0");
  }
});
