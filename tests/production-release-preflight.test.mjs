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
test("only the exact API-bound manual Staging media inspection is independent of Production",()=>{
 const diagnostic={id:900,name:"inspect-staging-application-context",check_suite:{id:901},app:{slug:"github-actions"},status:"completed",conclusion:"failure"};
 const evidence={id:902,check_suite_id:901,head_sha:sha,head_branch:"main",repository:{full_name:"FanMind/FanMind"},event:"workflow_dispatch",path:".github/workflows/chat-admin-media-host-readiness.yml"};
 const main={total_count:checks.total_count+1,check_runs:[...checks.check_runs,diagnostic]};
 const verify=(check=diagnostic,proof=evidence,source=prChecks)=>evaluateProductionRelease(env,branch,{...main,check_runs:[...checks.check_runs,check]},run,pr,source,[proof]);
 assert.equal(evaluateProductionRelease(env,branch,main,run,pr,prChecks),false);
 assert.equal(verify(),true);
 for(const patch of [{check_suite_id:99},{head_sha:"b".repeat(40)},{head_branch:"feature"},{repository:{full_name:"other/repo"}},{event:"push"},{event:"pull_request"},{path:".github/workflows/ci-fanmind.yml"}]) assert.equal(verify(diagnostic,{...evidence,...patch}),false,JSON.stringify(patch));
 for(const patch of [{name:"god-mode"},{app:{slug:"other-app"}},{check_suite:{id:903}}]) assert.equal(verify({...diagnostic,...patch}),false,JSON.stringify(patch));
 const failed=structuredClone(prChecks);failed.check_runs[0].conclusion="failure";assert.equal(verify(diagnostic,evidence,failed),false);
 const other={...diagnostic,id:910,name:"another-failed-operation",check_suite:{id:911}};
 assert.equal(evaluateProductionRelease(env,branch,{total_count:main.total_count+1,check_runs:[...main.check_runs,other]},run,pr,prChecks,[evidence]),false);
 const missing={total_count:main.total_count-1,check_runs:main.check_runs.filter(c=>c.name!==REQUIRED_MAIN_CHECKS[0])};
 assert.equal(evaluateProductionRelease(env,branch,missing,run,pr,prChecks,[evidence]),false);
 const sameNamedSource={...diagnostic,check_suite:{id:912}};
 assert.equal(evaluateProductionRelease(env,branch,{total_count:main.total_count+1,check_runs:[...main.check_runs,sameNamedSource]},run,pr,prChecks,[evidence]),false);
});
