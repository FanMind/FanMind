import assert from "node:assert/strict";
import { execFileSync, execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
const container = process.env.FANMIND_PG17_SOURCE_CONTAINER_ID ?? "";
const required = process.env.FANMIND_PG17_REQUIRE_SERVICE_CONTAINERS === "true";
const database = `fanmind_support_centre_ci_${process.pid}`;
const args = db => ["exec", "-i", "-e", `PGPASSWORD=${process.env.FANMIND_PG17_PASSWORD ?? ""}`, container, "psql", "-X", "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1", "-Atq"];
const sql = (query, db = database) => execFileSync("docker",args(db),{input:query,encoding:"utf8",timeout:30000,stdio:["pipe","pipe","pipe"]}).trim();
const id = n => `10000000-0000-4000-8000-${String(n).padStart(12,"0")}`;

test("support centre native PG17: ACL, tenant, expiry, atomic concurrent claim, audit and retention", {skip:!required}, async()=>{
  assert.match(container,/^[0-9a-f]{12,64}$/u);
  assert.match(sql("show server_version_num;","postgres"),/^17\d{4}$/u);
  // Parent Authorization proof owns existing roles; this suite must not mutate them.
  assert.equal(sql("select count(*) from pg_roles where rolname in ('anon','authenticated','service_role');","postgres"),"3");
  sql(`create database ${database};`,"postgres");
  try {
    sql(`create schema auth; create table auth.users(id uuid primary key);
      create table public.workspaces(id uuid primary key);
      create table public.social_connections(id uuid primary key,workspace_id uuid,platform text,status text,last_messenger_sync_error text);
      grant usage on schema public to anon,authenticated,service_role;
      insert into auth.users values('${id(1)}'),('${id(2)}');
      insert into public.workspaces values('${id(10)}'),('${id(11)}');
      insert into public.social_connections values('${id(20)}','${id(10)}','facebook','expired',null),('${id(21)}','${id(11)}','instagram','connected',null);`);
    sql(readFileSync(new URL("../../supabase/controlled/support_centre.sql",import.meta.url),"utf8"));
    sql(`insert into public.support_centre_owners values('${id(1)}');`);
    for (const role of ["anon","authenticated","service_role"]) {
      for(const table of ["owners","cases","events"]) {
        for(const privilege of ["INSERT","UPDATE","DELETE","TRUNCATE"]) assert.equal(sql(`select has_table_privilege('${role}','public.support_centre_${table}','${privilege}');`),"f");
        assert.equal(sql(`select relrowsecurity from pg_class where oid='public.support_centre_${table}'::regclass;`),"t");
      }
    }
    for(const role of ["anon","authenticated"]) assert.equal(sql(`select has_function_privilege('${role}','public.support_centre_decide(uuid,uuid,uuid,text)','EXECUTE');`),"f");
    assert.equal(sql("select has_function_privilege('service_role','public.support_centre_purge()','EXECUTE');"),"f");
    assert.throws(()=>sql(`set role service_role; select public.support_centre_report('${id(11)}','${id(20)}','facebook','connection_attention');`));
    const report = `set role service_role; select public.support_centre_report('${id(10)}','${id(20)}','facebook','connection_attention');`;
    const caseId = sql(report);
    assert.match(caseId,/^[0-9a-f-]{36}$/);
    assert.equal(sql(report),caseId);
    assert.equal(sql("select count(*) from public.support_centre_events;"),"1");
    assert.throws(()=>sql(`set role service_role; select public.support_centre_decide('${id(2)}','${id(10)}','${caseId}','approve');`));
    assert.throws(()=>sql(`set role service_role; select public.support_centre_decide('${id(1)}','${id(11)}','${caseId}','approve');`));
    const claim = `set role service_role; select public.support_centre_decide('${id(1)}','${id(10)}','${caseId}','approve');`;
    // Two independent psql sessions race the same pending row: exactly one wins.
    const concurrent = () => new Promise((resolve,reject)=>{
      const child = execFile("docker",args(database),{timeout:30000},(error,stdout)=>error?reject(error):resolve(stdout));
      child.stdin.end(claim);
    });
    const results = await Promise.allSettled([concurrent(),concurrent()]);
    assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
    assert.equal(sql("select count(*) from public.support_centre_events where event='approved';"),"1");
    const check = `set role service_role; select public.support_centre_check('${id(1)}','${id(10)}','${caseId}');`;
    assert.equal(sql(check),"f");
    sql(`update public.social_connections set status='connected' where id='${id(20)}';`);
    assert.equal(sql(check),"t");
    assert.equal(sql(check),"t");
    const finish = `set role service_role; select public.support_centre_finish('${id(1)}','${id(10)}','${caseId}',true);`;
    assert.equal(sql(finish),"t"); assert.equal(sql(finish),"t");
    assert.equal(sql("select count(*) from public.support_centre_events where event='succeeded';"),"1");
    assert.throws(()=>sql(claim)); assert.throws(()=>sql(check));
    const second = sql(report);
    sql(`update public.support_centre_cases set created_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '90 minutes' where id='${second}';`);
    assert.throws(()=>sql(`set role service_role; select public.support_centre_decide('${id(1)}','${id(10)}','${second}','approve');`));
    const third = sql(report); assert.notEqual(third,second);
    assert.equal(sql(`select status from public.support_centre_cases where id='${second}';`),"expired");
    assert.equal(sql(`set role service_role; select public.support_centre_decide('${id(1)}','${id(10)}','${third}','reject')->>'status';`),"rejected");
    assert.throws(()=>sql(`set role service_role; select public.support_centre_finish('${id(1)}','${id(10)}','${third}',true);`));
    sql(`update public.support_centre_cases set completed_at=clock_timestamp()-interval '31 days' where id='${caseId}';`);
    assert.equal(sql("select public.support_centre_purge();"),"1");
    assert.equal(sql(`select count(*) from public.support_centre_events where case_id='${caseId}';`),"0");
    assert.equal(sql(`select count(*) from public.support_centre_cases where id='${third}';`),"1");
    // Global alerts require Owner; acknowledged rows cannot hide open incidents.
    assert.throws(()=>sql(`set role service_role; select public.support_centre_inbox('${id(2)}');`));
    sql(`set role service_role; select public.support_centre_notify('${id(11)}','security_boundary','${id(21)}');`);
    const inbox=JSON.parse(sql(`set role service_role; select public.support_centre_inbox('${id(1)}');`));
    assert.ok(inbox.some(n=>n.workspace_id===id(11)&&n.code==='security_boundary'));
    const notification=inbox.find(n=>n.code==='security_boundary').id;
    sql(`set role service_role; select public.support_centre_ack('${id(1)}','${notification}');`);
    assert.ok(!JSON.parse(sql(`set role service_role; select public.support_centre_inbox('${id(1)}');`)).some(n=>n.id===notification));
    sql(`set role service_role; select public.support_centre_notify('${id(11)}','security_boundary','${id(21)}');`);
    assert.ok(JSON.parse(sql(`set role service_role; select public.support_centre_inbox('${id(1)}');`)).some(n=>n.id===notification));
    // Same request survives retries without a second turn; actor/Workspace reads are isolated.
    const send=`set role service_role; select public.support_chat_send('${id(2)}','${id(10)}','${id(30)}','question','answer','support',false);`;
    assert.equal(JSON.parse(sql(send)).question,'question');assert.equal(JSON.parse(sql(send)).question,'question');
    assert.equal(sql("select count(*) from public.support_chat_turns;"),'1');
    assert.equal(sql(`set role service_role; select public.support_chat_read('${id(1)}','${id(10)}');`),'[]');
    assert.equal(sql(`set role service_role; select public.support_chat_read('${id(2)}','${id(11)}');`),'[]');
    const thread=sql("select id from public.support_chat_threads;");
    assert.throws(()=>sql(`set role service_role; select public.support_chat_review('${id(10)}','${thread}');`));
    sql(`set role service_role; select public.support_chat_handoff('${id(2)}','${id(10)}');`);
    sql(`set role service_role; select public.support_chat_send('${id(2)}','${id(10)}','${id(31)}','later private question','answer','support',false);`);
    const shared=JSON.parse(sql(`set role service_role; select public.support_chat_review('${id(10)}','${thread}');`));
    assert.equal(shared.length,1);assert.equal(shared[0].question,'question');
    assert.throws(()=>sql(`set role service_role; select public.support_chat_send('${id(2)}','${id(10)}','${id(30)}','changed question','answer','support',false);`));
    // Metadata recovery consumes no provider action and is idempotent.
    const recoveryId=sql(report);
    sql(`set role service_role; select public.support_centre_decide('${id(1)}','${id(10)}','${recoveryId}','approve');`);
    sql(`update public.support_centre_cases set decided_at=clock_timestamp()-interval '3 minutes' where id='${recoveryId}';`);
    assert.equal(sql(`set role service_role; select public.support_centre_recover('${id(1)}');`),'1');
    assert.equal(sql(`set role service_role; select public.support_centre_recover('${id(1)}');`),'0');
    assert.equal(sql(`select status from public.support_centre_cases where id='${recoveryId}';`),'failed');
    for(const table of ['support_chat_threads','support_chat_turns','support_centre_notifications'])for(const role of ['anon','authenticated','service_role'])assert.equal(sql(`select has_table_privilege('${role}','public.${table}','SELECT,INSERT,UPDATE,DELETE');`),'f');
    sql(`delete from public.workspaces where id='${id(10)}';`);
    assert.equal(sql("select count(*) from public.support_centre_cases;"),"0");
    assert.equal(sql("select count(*) from public.support_centre_events;"),"0");
  } finally { sql(`drop database ${database} with (force);`,"postgres"); }
});
