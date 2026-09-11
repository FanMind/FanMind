import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateCreatorFoundationStagingEnvironment } from "../src/lib/creatorFoundationStagingPolicy.mjs";
import { runCreatorDatabaseMode as runDatabase, creatorStateFromOutput } from "../scripts/operations/creator-foundation-staging-runner.mjs";
import { checkCreatorArtifact } from "../scripts/operations/creator-foundation-sql.mjs";
const sql=readFileSync(new URL("../supabase/controlled/creator_intelligence_foundation.sql",import.meta.url),"utf8");
const conflictFixSql=readFileSync(new URL("../supabase/controlled/creator_revision_conflict_fix.sql",import.meta.url),"utf8");
function runCreatorDatabaseMode(mode, artifact, env, database) { return runDatabase(mode, artifact, env, database, conflictFixSql); }
const sha="a".repeat(40);
function environment(mode="verify") {
 return {
  FANMIND_RUNTIME_ENVIRONMENT:"staging", NEXT_PUBLIC_APP_URL:"https://staging.fanmind.example",
  NEXT_PUBLIC_SUPABASE_URL:"https://stagingref.supabase.co", FANMIND_TARGET_API_ORIGIN:"https://staging.fanmind.example",
  FANMIND_PRODUCTION_API_ORIGIN:"https://fanmind.ch", FANMIND_TARGET_SUPABASE_PROJECT_REF:"stagingref",
  FANMIND_PRODUCTION_SUPABASE_PROJECT_REF:"productionref", FANMIND_ENABLE_NON_PRODUCTION_WRITES:["apply","upgrade"].includes(mode)?"true":"false",
  FANMIND_NON_PRODUCTION_WRITE_ACK:["apply","upgrade"].includes(mode)?"I_UNDERSTAND_NON_PRODUCTION_ONLY":"",
  FANMIND_CREATOR_FOUNDATION_REVIEWED_COMMIT:sha, GITHUB_REF:"refs/heads/main", GITHUB_SHA:sha,
  FANMIND_CREATOR_FOUNDATION_UPGRADE_CONFIRM:"upgrade-creator-foundation", FANMIND_CREATOR_FOUNDATION_APPLY_CONFIRM:"apply-creator-foundation", FANMIND_CREATOR_FOUNDATION_VERIFY_CONFIRM:"verify-creator-foundation",
  PGHOST:"aws-0-eu-central-1.pooler.supabase.com", FANMIND_TARGET_DB_HOST:"aws-0-eu-central-1.pooler.supabase.com",
  FANMIND_PRODUCTION_DB_HOST:"db.productionref.supabase.co", PGPORT:"5432", PGDATABASE:"postgres", PGUSER:"postgres.stagingref",
  PGSSLMODE:"verify-full", PGSSLROOTCERT:"/tmp/creator-ca.crt",
 };
}
const result=stdout=>({status:0,stdout});
test("wrong checkout, production alias, cross-target pooler, TLS and injected libpq routing never reach PostgreSQL",()=>{
 for(const change of [
  {GITHUB_SHA:"b".repeat(40)}, {GITHUB_REF:"refs/heads/feature"}, {FANMIND_CREATOR_FOUNDATION_REVIEWED_COMMIT:""},
  {NEXT_PUBLIC_APP_URL:"https://fanmind.ch"}, {NEXT_PUBLIC_SUPABASE_URL:"https://productionref.supabase.co"},
  {FANMIND_TARGET_SUPABASE_PROJECT_REF:"productionref"}, {PGUSER:"postgres.productionref"}, {PGHOST:"elsewhere.pooler.supabase.com"},
  {PGPORT:"6543"}, {PGSSLMODE:"require"}, {PGHOSTADDR:"127.0.0.1"}, {PGSERVICE:"alias"}, {PGSERVICEFILE:"/tmp/alias"},
  {FANMIND_CREATOR_INTELLIGENCE_ENABLED:"true"}, {FANMIND_ENABLE_NON_PRODUCTION_WRITES:"true"},
 ]) {
  const env={...environment(),...change}; let calls=0;
  assert.equal(evaluateCreatorFoundationStagingEnvironment(env).ok,false);
  assert.throws(()=>runCreatorDatabaseMode("verify",sql,env,()=>{calls++;return result("");}));
  assert.equal(calls,0);
 }
});
test("Apply needs both independent write acknowledgement and selected action confirmation",()=>{
 for(const change of [{FANMIND_ENABLE_NON_PRODUCTION_WRITES:"false"},{FANMIND_NON_PRODUCTION_WRITE_ACK:""},{FANMIND_CREATOR_FOUNDATION_APPLY_CONFIRM:"verify-creator-foundation"}]) {
  assert.equal(evaluateCreatorFoundationStagingEnvironment({...environment("apply"),...change},{mode:"apply"}).ok,false);
 }
});
test("absent Verify reads only once; partial installation cannot trigger a write",()=>{
 const calls=[];
 const verified=runCreatorDatabaseMode("verify",sql,environment(),q=>{calls.push(q);return result("CREATOR_FOUNDATION_STATE=absent\n");});
 assert.ok(verified.includes("CREATOR_FOUNDATION_NEXT=apply")); assert.equal(calls.length,1);
 assert.doesNotMatch(calls[0],/create |alter |grant |insert /iu);
 let count=0;
 assert.throws(()=>runCreatorDatabaseMode("apply",sql,environment("apply"),()=>{count++;return result("CREATOR_FOUNDATION_STATE=partial");}),/partial_schema/u);
 assert.equal(count,1);
});
test("valid existing installation verifies without reapplying, and unknown output never proves completion",()=>{
 const calls=[];
 const markers=runCreatorDatabaseMode("apply",sql,environment("apply"),q=>{calls.push(q);return result(calls.length===1?"CREATOR_FOUNDATION_STATE=present":"CREATOR_FOUNDATION_POSTFLIGHT=PASS");});
 assert.equal(calls.length,2); assert.ok(markers.includes("CREATOR_FOUNDATION_APPLY=not_requested"));
 assert.doesNotMatch(calls[1],/create table public\./iu);
 for(const output of ["CREATOR_FOUNDATION_STATE=absent\nCREATOR_FOUNDATION_STATE=present","unexpected",""]) assert.throws(()=>creatorStateFromOutput(result(output)));
});
test("commit with failed response is indeterminate, never automatically retried",()=>{
 let count=0;
 assert.throws(()=>runCreatorDatabaseMode("apply",sql,environment("apply"),()=>{count++;return count===1?result("CREATOR_FOUNDATION_STATE=absent"):{status:1,stdout:"",stderr:"private diagnostic"};}),/apply_indeterminate_verify_before_retry/u);
 assert.equal(count,2);
 assert.throws(()=>checkCreatorArtifact(sql+"\n"),/artifact_checksum/u);
});

test("legacy verification requests the separately confirmed upgrade without writing",()=>{
 const calls=[];
 const replies=[result("CREATOR_FOUNDATION_STATE=present"),{status:1,stdout:""},result("CREATOR_FOUNDATION_POSTFLIGHT=PASS")];
 const markers=runCreatorDatabaseMode("verify",sql,environment(),q=>{calls.push(q);return replies.shift();});
 assert.ok(markers.includes("CREATOR_FOUNDATION_NEXT=upgrade"));
 assert.ok(!markers.includes("CREATOR_FOUNDATION_POSTFLIGHT=PASS"));
 assert.equal(calls.length,3);
 assert.ok(calls.every(q=>!q.includes("create or replace function public.")));
});

test("upgrade needs its own confirmation and cannot create an absent foundation",()=>{
 for(const patch of [{FANMIND_CREATOR_FOUNDATION_UPGRADE_CONFIRM:"apply-creator-foundation"},{FANMIND_ENABLE_NON_PRODUCTION_WRITES:"false"},{FANMIND_NON_PRODUCTION_WRITE_ACK:""}]) {
  let calls=0;
  assert.throws(()=>runCreatorDatabaseMode("upgrade",sql,{...environment("upgrade"),...patch},()=>{calls++;}),/environment_invalid/u);
  assert.equal(calls,0);
 }
 let calls=0;
 assert.throws(()=>runCreatorDatabaseMode("upgrade",sql,environment("upgrade"),()=>{calls++;return result("CREATOR_FOUNDATION_STATE=absent");}),/upgrade_requires_installed_foundation/u);
 assert.equal(calls,1);
});

test("only exact legacy state can upgrade; an uncertain commit stops before any retry",()=>{
 for(const uncertain of [false,true]) {
  const calls=[];
  const replies=[result("CREATOR_FOUNDATION_STATE=present"),{status:1,stdout:""},result("CREATOR_FOUNDATION_POSTFLIGHT=PASS"),uncertain?{status:1,stdout:""}:result("CREATOR_FOUNDATION_UPGRADE=COMMITTED"),result("CREATOR_FOUNDATION_POSTFLIGHT=PASS")];
  const run=()=>runCreatorDatabaseMode("upgrade",sql,environment("upgrade"),q=>{calls.push(q);return replies.shift();});
  if(uncertain) assert.throws(run,/upgrade_indeterminate_verify_before_retry/u);
  else assert.ok(run().includes("CREATOR_FOUNDATION_UPGRADE=committed"));
  assert.equal(calls.length,uncertain?4:5);
  assert.match(calls[3],/creator_upgrade_requires_empty_foundation/u);
  assert.equal(calls[3].split("create or replace function public.save_creator_bundle").length-1,1);
  assert.doesNotMatch(calls[3],/drop |create table public\.|delete from /iu);
 }
 const replies=[result("CREATOR_FOUNDATION_STATE=present"),{status:1,stdout:""},{status:1,stdout:""}];
 let calls=0;
 assert.throws(()=>runCreatorDatabaseMode("upgrade",sql,environment("upgrade"),()=>{calls++;return replies.shift();}),/postflight_failed/u);
 assert.equal(calls,3);
});

test("current schema skips upgrade, and the correction checksum is mandatory",()=>{
 let calls=0;
 const markers=runCreatorDatabaseMode("upgrade",sql,environment("upgrade"),()=>result(++calls===1?"CREATOR_FOUNDATION_STATE=present":"CREATOR_FOUNDATION_POSTFLIGHT=PASS"));
 assert.equal(calls,2);
 assert.ok(markers.includes("CREATOR_FOUNDATION_UPGRADE=not_requested"));
 assert.throws(()=>runDatabase("upgrade",sql,environment("upgrade"),()=>{throw new Error("network must not run");},conflictFixSql+"\n"),/conflict_artifact_checksum/u);
});
