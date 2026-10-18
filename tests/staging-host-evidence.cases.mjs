import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const script="scripts/operations/staging-host-evidence-preflight.mjs";
const workflow=".github/workflows/staging-host-evidence.yml";
const sourceSha="f36e630c73d3820a61aef593a705d241600e7f47";
const base={GITHUB_REPOSITORY:"FanMind/FanMind",GITHUB_REPOSITORY_ID:"1259448985",GITHUB_EVENT_NAME:"workflow_dispatch",GITHUB_REF:"refs/heads/main",GITHUB_SHA:sourceSha,GITHUB_WORKFLOW_REF:"FanMind/FanMind/.github/workflows/staging-host-evidence.yml@refs/heads/main",GITHUB_RUN_ATTEMPT:"1",GITHUB_RUN_ID:"12345",RUNNER_ENVIRONMENT:"self-hosted",RUNNER_NAME:"fanmind-staging-01-exoscale",RUNNER_OS:"Linux",RUNNER_ARCH:"X64",FANMIND_EVIDENCE_ENVIRONMENT:"staging",FANMIND_EVIDENCE_CONFIRMATION:"collect-staging-host-evidence-readonly",FANMIND_EVIDENCE_REVIEWED_COMMIT:sourceSha};
function run(overrides={},extra=[]){return spawnSync(process.execPath,[script,...extra],{env:{...base,...overrides},encoding:"utf8",timeout:5000});}
function expectBlocked(result,code){assert.equal(result.error,undefined);assert.equal(result.status,1);assert.equal(result.stderr,"");assert.equal(result.stdout,`STAGING_HOST_EVIDENCE=BLOCKED\nSTAGING_HOST_EVIDENCE_REASON=${code}\nSTAGING_HOST_ACCESS=not_attempted\n`);}

test("host evidence entrypoint remains blocked before collection without approved private evidence transport",()=>{
 expectBlocked(run(),"private_channel_unverified");
});

test("host evidence rejects wrong event/repository/commit/environment/runner before channel checks",()=>{
 for(const [name,value] of [["GITHUB_REPOSITORY","attacker/FanMind"],["GITHUB_REPOSITORY_ID","1"],["GITHUB_EVENT_NAME","push"],["GITHUB_REF","refs/heads/feature"],["GITHUB_SHA","a".repeat(40)],["GITHUB_WORKFLOW_REF","FanMind/FanMind/.github/workflows/other.yml@refs/heads/main"],["GITHUB_RUN_ID","../../tmp"],["GITHUB_RUN_ATTEMPT","0"],["RUNNER_ENVIRONMENT","github-hosted"],["RUNNER_NAME","fanmind-prod-01-exoscale"],["RUNNER_OS","Windows"],["RUNNER_ARCH","ARM64"],["FANMIND_EVIDENCE_ENVIRONMENT","production"],["FANMIND_EVIDENCE_CONFIRMATION","deploy"],["FANMIND_EVIDENCE_REVIEWED_COMMIT","a".repeat(39)]]){
  expectBlocked(run({[name]:value}),"binding_invalid");
 }
});

test("caller variables and command arguments cannot enable host collection or replace trusted policy",()=>{
 for(const env of [{FANMIND_EVIDENCE_CHANNEL_APPROVED:"true"},{FANMIND_EVIDENCE_CHANNEL:"https://attacker.invalid"},{FANMIND_EVIDENCE_POLICY:"/tmp/approved.json"},{FANMIND_HOST_EVIDENCE_ALLOW_READ:"true"}])expectBlocked(run(env),"private_channel_unverified");
 expectBlocked(run({},["--approve-channel","--policy=/tmp/approved.json"]),"binding_invalid");
});

test("untrusted values, credentials and command injection never reach stdout/stderr",()=>{
 for(const value of ["::warning::synthetic-secret", "$(touch /tmp/fanmind-should-never-exist)","https://name:synthetic-password@private.invalid", "\nGITHUB_ENV=bad", "sk_test_SYNTHETIC_SECRET"]){
  expectBlocked(run({FANMIND_EVIDENCE_CONFIRMATION:value}),"binding_invalid");
  expectBlocked(run({UNTRUSTED_ENV:value,SUPABASE_SERVICE_ROLE_KEY:value,PGPASSWORD:value}),"private_channel_unverified");
 }
});

test("workflow is dispatch-only with exact protected target and no collection/upload/install/deploy step",()=>{
 const text=readFileSync(workflow,"utf8");
 assert.match(text,/on:\n  workflow_dispatch:/u);
 assert.doesNotMatch(text,/\n  (push|pull_request|schedule|workflow_call|issue_comment|repository_dispatch):/u);
 assert.match(text,/environment: staging/u);
 assert.match(text,/runs-on: \[self-hosted, fanmind-staging, exoscale, linux, x64\]/u);
 assert.match(text,/github\.repository == 'FanMind\/FanMind'/u);
 assert.match(text,/github\.repository_id == '1259448985'/u);
 assert.match(text,/github\.event_name == 'workflow_dispatch'/u);
 assert.match(text,/github\.ref == 'refs\/heads\/main'/u);
 assert.match(text,/inputs\.reviewed_commit == github\.sha/u);
 assert.match(text,/cancel-in-progress: false/u);
 assert.match(text,/group: fanmind-staging-deploy/u);
 assert.match(text,/persist-credentials: false/u);
 assert.match(text,/ref: \$\{\{ github\.sha \}\}/u);
 assert.match(text,/permissions:\n  contents: read/u);
 assert.doesNotMatch(text,/secrets\.|upload-artifact|npm |sudo |ssh |curl |psql|pg_dump|pg_restore|systemctl|pm2|cron|age |rclone|aws |docker |actions\/setup-/u);
 assert.equal((text.match(/\buses:/gu)??[]).length,1);
 assert.doesNotMatch(text,/always\(\)|GITHUB_STEP_SUMMARY|GITHUB_OUTPUT/u);
 const runBlock=text.split("run: |\n")[1];
 assert.ok(runBlock);assert.doesNotMatch(runBlock,/\$\{\{/u,"no expression interpolation into shell");
 assert.match(runBlock,/env -i/u);
 assert.match(runBlock,/\/usr\/bin\/node scripts\/operations\/staging-host-evidence-preflight\.mjs/u);
});

test("policy is fixed, checksum-bound and cannot claim environment/runner/channel acceptance",async()=>{
 const {HOST_EVIDENCE_POLICY_SHA256,loadHostEvidencePolicy}=await import("../scripts/operations/staging-host-evidence-policy.mjs");
 const bytes=readFileSync("docs/operations/staging-host-evidence-policy.json");
 assert.equal(createHash("sha256").update(bytes).digest("hex"),HOST_EVIDENCE_POLICY_SHA256);
 const policy=loadHostEvidencePolicy();assert.equal(policy.status,"BLOCKED");assert.equal(policy.privateChannel,null);assert.equal(policy.environmentProtectionVerified,false);assert.equal(policy.runnerScopeVerified,false);
 assert.throws(()=>loadHostEvidencePolicy(()=>Buffer.from(JSON.stringify({...policy,status:"APPROVED"}))),/policy_checksum/u);
});
