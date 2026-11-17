import "./monthly-release-control.cases.mjs";
import "./monthly-release-package.cases.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { evaluateProductionRelease, readCompleteCheckRuns, REQUIRED_MAIN_CHECKS, REQUIRED_PR_CHECKS } from "../scripts/operations/production-release-preflight.mjs";
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

function manyChecks(count = 296) {
 const required = payload(REQUIRED_MAIN_CHECKS).check_runs;
 return [...required, ...Array.from({length: count - required.length}, (_,i) => ({
  id: i + 100, name: `additional-${i}`, app:{slug:"github-actions"}, status:"completed", conclusion:"success"
 }))];
}
function pagedGet(all, mutate = value => value) {
 return async path => {
  assert.match(path, new RegExp(`^commits/${sha}/check-runs\\?per_page=100&page=[1-9][0-9]*$`));
  const page = Number(new URLSearchParams(path.split("?")[1]).get("page"));
  return mutate({total_count: all.length, check_runs: structuredClone(all.slice((page-1)*100,page*100))},page);
 };
}
test("complete multi-page inventories preserve required checks and failures beyond page one", async()=>{
 const all = manyChecks();
 const calls=[]; const get=pagedGet(all);
 const result=await readCompleteCheckRuns(async path=>{calls.push(path);return get(path);},sha);
 assert.equal(result.total_count,296); assert.equal(result.check_runs.length,296);
 assert.equal(evaluate({},branch,result),true);
 assert.deepEqual(calls.map(path=>path.split("page=").at(-1)),["1","2","3","1"]);
 for(const index of [100,295]) {
  const broken=structuredClone(all); broken[index].conclusion="failure";
  assert.equal(evaluate({},branch,await readCompleteCheckRuns(pagedGet(broken),sha)),false);
 }
});
test("incomplete, duplicate, drifting and oversized check inventories fail closed", async()=>{
 const all=manyChecks();
 for(const mutate of [
  (p,n)=>n===2?{...p,check_runs:p.check_runs.slice(1)}:p,
  (p,n)=>n===2?{...p,total_count:297}:p,
  (p,n)=>n===2?{...p,check_runs:[all[0],...p.check_runs.slice(1)]}:p,
  (p,n)=>n===3?{...p,check_runs:[]}:p,
  (p,n)=>n===2?{...p,check_runs:[{...p.check_runs[0],id:0},...p.check_runs.slice(1)]}:p,
 ]) await assert.rejects(readCompleteCheckRuns(pagedGet(all,mutate),sha));
 let firstReads=0;
 await assert.rejects(readCompleteCheckRuns(pagedGet(all,(p,n)=>{
  if(n===1 && ++firstReads===2) p.check_runs[0].conclusion="failure";
  return p;
 }),sha));
 for(const count of [0,1001,1.5]) await assert.rejects(readCompleteCheckRuns(async()=>({total_count:count,check_runs:[]}),sha));
 await assert.rejects(readCompleteCheckRuns(pagedGet(all),"main"));
 await assert.rejects(readCompleteCheckRuns(async()=>{throw Error("api_unavailable");},sha));
});
test("required checks on the last page are mandatory and must succeed", async()=>{
 const all=manyChecks();
 const required=all.splice(0,REQUIRED_MAIN_CHECKS.length); all.push(...required);
 assert.equal(evaluate({},branch,await readCompleteCheckRuns(pagedGet(all),sha)),true);
 const failed=structuredClone(all); failed.at(-1).conclusion="failure";
 assert.equal(evaluate({},branch,await readCompleteCheckRuns(pagedGet(failed),sha)),false);
 assert.equal(evaluate({},branch,await readCompleteCheckRuns(pagedGet(all.slice(0,-1)),sha)),false);
});
