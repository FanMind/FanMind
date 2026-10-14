import assert from "node:assert/strict";
import test from "node:test";
import { evaluateProductionRelease, REQUIRED_MAIN_CHECKS, REQUIRED_PR_CHECKS } from "../scripts/operations/production-release-preflight.mjs";
const sha="a".repeat(40);
const env={GITHUB_RUN_ID:"42",GITHUB_REPOSITORY:"FanMind/FanMind",GITHUB_REF:"refs/heads/main",GITHUB_EVENT_NAME:"workflow_dispatch",GITHUB_ACTOR_ID:"270165082",REVIEWED_MAIN_COMMIT:sha,GITHUB_SHA:sha,CONFIRMATION:"deploy-reviewed-chatadmin"};
const run={id:42,head_sha:sha,path:".github/workflows/deploy-fanmind.yml",check_suite_id:420};
const branch={protected:true,commit:{sha}};
const pr={merge_commit_sha:sha,merged_at:"2026-10-14T07:00:00Z",base:{ref:"main"},head:{repo:{full_name:"FanMind/FanMind"}}};
const payload=names=>({total_count:names.length,check_runs:names.map((name,i)=>({id:i+1,name,app:{slug:"github-actions"},status:"completed",conclusion:"success"}))});
const checks=payload(REQUIRED_MAIN_CHECKS),prChecks=payload(REQUIRED_PR_CHECKS);
const evaluate=(patch={},head=branch,main=checks,r=run,p=pr,source=prChecks)=>evaluateProductionRelease({...env,...patch},head,main,r,p,source);
test("only owner-dispatched current protected main with complete merge-bound CI is admitted",()=>{
 assert.equal(evaluate(),true);
 for(const patch of [{GITHUB_REF:"refs/heads/feature"},{GITHUB_EVENT_NAME:"push"},{GITHUB_ACTOR_ID:"other"},{REVIEWED_MAIN_COMMIT:"b".repeat(40)},{CONFIRMATION:""}])assert.equal(evaluate(patch),false);
 assert.equal(evaluate({}, {...branch,protected:false}),false);
 for(const name of REQUIRED_PR_CHECKS)assert.equal(evaluate({},branch,checks,run,pr,payload(REQUIRED_PR_CHECKS.filter(n=>n!==name))),false,name);
 for(const name of REQUIRED_MAIN_CHECKS)assert.equal(evaluate({},branch,payload(REQUIRED_MAIN_CHECKS.filter(n=>n!==name))),false,name);
 assert.equal(evaluate({},branch,checks,run,{...pr,merge_commit_sha:"b".repeat(40)}),false);
 assert.equal(evaluate({},branch,checks,run,pr,payload(["god-mode"])),false);
});
test("pending/failing CI and malformed pages cannot be mistaken for success",()=>{
 for(const patch of [{status:"in_progress",conclusion:null},{status:"completed",conclusion:"failure"}]){
 const modified=structuredClone(prChecks);Object.assign(modified.check_runs[0],patch);assert.equal(evaluate({},branch,checks,run,pr,modified),false);
 }
 assert.equal(evaluate({},branch,{total_count:101,check_runs:checks.check_runs}),false);
 assert.equal(evaluate({},branch,checks,run,pr,{...prChecks,total_count:99}),false);
});
test("only the API-bound current workflow suite is excluded, not pending CI",()=>{
 const active={id:999,name:"Validate Owner-authorized exact main release",check_suite:{id:420},app:{slug:"github-actions"},status:"in_progress",conclusion:null};
 assert.equal(evaluate({},branch,{total_count:checks.total_count+1,check_runs:[...checks.check_runs,active]}),true);
 assert.equal(evaluate({},branch,{total_count:checks.total_count+1,check_runs:[...checks.check_runs,{...active,check_suite:{id:421}}]}),false);
 assert.equal(evaluate({},branch,checks,{...run,head_sha:"b".repeat(40)}),false);
});
