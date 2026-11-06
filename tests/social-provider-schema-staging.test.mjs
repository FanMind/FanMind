import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateSocialProviderSchemaStagingEnvironment } from "../src/lib/socialProviderSchemaStagingPolicy.mjs";
import { runSocialDatabaseMode, socialStateFromOutput } from "../scripts/operations/social-provider-schema-staging-runner.mjs";
import { checkSocialArtifact } from "../scripts/operations/social-provider-schema-sql.mjs";
const sql=readFileSync(new URL("../supabase/controlled/social_provider_connections.sql",import.meta.url),"utf8");
const sha="a".repeat(40);
function environment(mode="verify") {
 return {
  FANMIND_RUNTIME_ENVIRONMENT:"staging", NEXT_PUBLIC_APP_URL:"https://staging.fanmind.example",
  NEXT_PUBLIC_SUPABASE_URL:"https://ssssssssssssssssssss.supabase.co", FANMIND_TARGET_API_ORIGIN:"https://staging.fanmind.example",
  FANMIND_PRODUCTION_API_ORIGIN:"https://fanmind.ch", FANMIND_TARGET_SUPABASE_PROJECT_REF:"ssssssssssssssssssss",
  FANMIND_PRODUCTION_SUPABASE_PROJECT_REF:"pppppppppppppppppppp", FANMIND_ENABLE_NON_PRODUCTION_WRITES:mode==="apply"?"true":"false",
  FANMIND_NON_PRODUCTION_WRITE_ACK:mode==="apply"?"I_UNDERSTAND_NON_PRODUCTION_ONLY":"",
  FANMIND_SOCIAL_PROVIDER_SCHEMA_REVIEWED_COMMIT:sha, GITHUB_REF:"refs/heads/main", GITHUB_SHA:sha,
  FANMIND_SOCIAL_PROVIDER_SCHEMA_APPLY_CONFIRM:"apply-social-provider-schema", FANMIND_SOCIAL_PROVIDER_SCHEMA_VERIFY_CONFIRM:"verify-social-provider-schema",
  PGHOST:"aws-0-eu-central-1.pooler.supabase.com", FANMIND_TARGET_DB_HOST:"aws-0-eu-central-1.pooler.supabase.com",
  FANMIND_PRODUCTION_DB_HOST:"db.pppppppppppppppppppp.supabase.co", PGPORT:"5432", PGDATABASE:"postgres", PGUSER:"postgres.ssssssssssssssssssss",
  PGSSLMODE:"verify-full", PGSSLROOTCERT:"/tmp/creator-ca.crt",
 };
}
const result=stdout=>({status:0,stdout});
test("wrong checkout, production alias, cross-target pooler, TLS and injected libpq routing never reach PostgreSQL",()=>{
 for(const change of [
  {GITHUB_SHA:"b".repeat(40)}, {GITHUB_REF:"refs/heads/feature"}, {FANMIND_SOCIAL_PROVIDER_SCHEMA_REVIEWED_COMMIT:""},
  {NEXT_PUBLIC_APP_URL:"https://fanmind.ch"}, {NEXT_PUBLIC_SUPABASE_URL:"https://pppppppppppppppppppp.supabase.co"},
  {FANMIND_TARGET_SUPABASE_PROJECT_REF:"pppppppppppppppppppp"}, {PGUSER:"postgres.pppppppppppppppppppp"}, {PGHOST:"elsewhere.pooler.supabase.com"},
  {PGPORT:"6543"}, {PGSSLMODE:"require"}, {PGHOSTADDR:"127.0.0.1"}, {PGSERVICE:"alias"}, {PGSERVICEFILE:"/tmp/alias"},
  {FANMIND_SOCIAL_PILOT_ENABLED:"true"}, {FANMIND_ENABLE_NON_PRODUCTION_WRITES:"true"},
 ]) {
  const env={...environment(),...change}; let calls=0;
  assert.equal(evaluateSocialProviderSchemaStagingEnvironment(env).ok,false);
  assert.throws(()=>runSocialDatabaseMode("verify",sql,env,()=>{calls++;return result("");}));
  assert.equal(calls,0);
 }
});
test("Apply needs both independent write acknowledgement and selected action confirmation",()=>{
 for(const change of [{FANMIND_ENABLE_NON_PRODUCTION_WRITES:"false"},{FANMIND_NON_PRODUCTION_WRITE_ACK:""},{FANMIND_SOCIAL_PROVIDER_SCHEMA_APPLY_CONFIRM:"verify-social-provider-schema"}]) {
  assert.equal(evaluateSocialProviderSchemaStagingEnvironment({...environment("apply"),...change},{mode:"apply"}).ok,false);
 }
});
test("absent Verify reads only once; partial installation cannot trigger a write",()=>{
 const calls=[];
 const verified=runSocialDatabaseMode("verify",sql,environment(),q=>{calls.push(q);return result("SOCIAL_PROVIDER_SCHEMA_STATE=absent\n");});
 assert.ok(verified.includes("SOCIAL_PROVIDER_SCHEMA_NEXT=apply")); assert.equal(calls.length,1);
 assert.doesNotMatch(calls[0],/create |alter |grant |insert /iu);
 let count=0;
 assert.throws(()=>runSocialDatabaseMode("apply",sql,environment("apply"),()=>{count++;return result("SOCIAL_PROVIDER_SCHEMA_STATE=partial");}),/partial_schema/u);
 assert.equal(count,1);
});
test("valid existing installation verifies without reapplying, and unknown output never proves completion",()=>{
 const calls=[];
 const markers=runSocialDatabaseMode("apply",sql,environment("apply"),q=>{calls.push(q);return result(calls.length===1?"SOCIAL_PROVIDER_SCHEMA_STATE=present":"SOCIAL_PROVIDER_SCHEMA_POSTFLIGHT=PASS");});
 assert.equal(calls.length,2); assert.ok(markers.includes("SOCIAL_PROVIDER_SCHEMA_APPLY=not_requested"));
 assert.doesNotMatch(calls[1],/create table public\./iu);
 for(const output of ["SOCIAL_PROVIDER_SCHEMA_STATE=absent\nSOCIAL_PROVIDER_SCHEMA_STATE=present","unexpected",""]) assert.throws(()=>socialStateFromOutput(result(output)));
});
test("commit with failed response is indeterminate, never automatically retried",()=>{
 let count=0;
 assert.throws(()=>runSocialDatabaseMode("apply",sql,environment("apply"),()=>{count++;return count===1?result("SOCIAL_PROVIDER_SCHEMA_STATE=absent"):{status:1,stdout:"",stderr:"private diagnostic"};}),/apply_indeterminate_verify_before_retry/u);
 assert.equal(count,2);
 assert.throws(()=>checkSocialArtifact(sql+"\n"),/artifact_checksum/u);
});
