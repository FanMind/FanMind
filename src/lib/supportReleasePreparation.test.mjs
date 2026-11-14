import {consentApplySourceReady} from '../../scripts/operations/support-ai-consent-source-preflight.mjs';
import {REQUIRED_MAIN_CHECKS,REQUIRED_PR_CHECKS} from '../../scripts/operations/production-release-preflight.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {consentProductionRequest,classifyConsentPlan} from '../../scripts/operations/support-ai-consent-production.mjs';
import {reference,SQL_SHA256,classifyConsent,consentInstallSql} from '../../scripts/operations/support-ai-consent-contract.mjs';
const sha='a'.repeat(40),live='b'.repeat(40);
const env=action=>({GITHUB_REPOSITORY:'FanMind/FanMind',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_ACTOR_ID:'270165082',GITHUB_SHA:sha,FANMIND_RUNTIME_ENVIRONMENT:'production',FANMIND_SUPPORT_REVIEWED_COMMIT:sha,FANMIND_SUPPORT_CONFIRM:`support-ai-consent-production-${action}`,CONSENT_EXPECTED_LIVE:live,CONSENT_SQL_SHA256:SQL_SHA256,NEXT_PUBLIC_SUPABASE_URL:'https://drqkpdvtbbrrdwmtrodz.supabase.co',NEXT_PUBLIC_APP_URL:'https://fanmind.ch',FANMIND_BACKUP_DB_HOST:'aws-1-eu-west-3.pooler.supabase.com',FANMIND_BACKUP_DB_USER:'postgres.drqkpdvtbbrrdwmtrodz',FANMIND_BACKUP_DB_NAME:'postgres',FANMIND_BACKUP_PGPASSFILE:'/etc/fanmind-backup/worker.pgpass',FANMIND_ADMIN_EMAILS:'owner@example.com'});
test('separate Production consent control rejects other targets, approvals, sources, redirects and activation',()=>{
 for(const action of ['verify','apply']){
  assert.equal(consentProductionRequest(env(action),action).commit,sha);
  for(const bad of [{GITHUB_ACTOR_ID:'other'},{GITHUB_REF:'refs/heads/feature'},{GITHUB_EVENT_NAME:'schedule'},{FANMIND_RUNTIME_ENVIRONMENT:'staging'},{FANMIND_SUPPORT_REVIEWED_COMMIT:live},{CONSENT_SQL_SHA256:'0'.repeat(64)},{FANMIND_SUPPORT_CONFIRM:'support-ai-consent-production-verify',...(action==='verify'?{FANMIND_SUPPORT_CONFIRM:'apply'}:{})},{NEXT_PUBLIC_SUPABASE_URL:'https://vshyhvgcmrlagvfnvomc.supabase.co'},{NEXT_PUBLIC_APP_URL:'https://staging.fanmind.ch'},{FANMIND_BACKUP_DB_USER:'postgres.vshyhvgcmrlagvfnvomc'},{PGPASSWORD:'secret'},{PGOPTIONS:'-c role=postgres'},{CONSENT_EXPECTED_LIVE:'invalid'},{FANMIND_SUPPORT_PERSISTENT_CONSENT_VERSION:'support-ai-20261114-v1'}])assert.throws(()=>consentProductionRequest({...env(action),...bad},action));
 }
 for(const action of ['activate','deactivate','retention','export'])assert.throws(()=>consentProductionRequest(env(action),action));
});
test('schema planning distinguishes absent, exact and full structural/ACL/body drift',()=>{
 const exact=reference().catalogue;assert.equal(classifyConsentPlan(exact,'apply'),'skip');assert.equal(classifyConsentPlan({relations:[],functions:[]},'verify'),'absent');assert.equal(classifyConsentPlan({relations:[],functions:[]},'apply'),'apply');
 for(const mutate of [c=>c.functions.pop(),c=>c.relations[0].columns[0].notnull=false,c=>c.relations[0].constraints.pop(),c=>c.relations[0].policies=1,c=>c.functions[0].body+=' ',c=>c.functions[0].acl.push({role:'authenticated',privilege:'EXECUTE',grantable:false}),c=>c.relations[0].columns[0].acl='{authenticated=r/postgres}',c=>c.relations.push({...c.relations[0],name:'support_ai_consent_extra'})]){const copy=structuredClone(exact);mutate(copy);assert.equal(classifyConsent(copy),'DRIFT');assert.throws(()=>classifyConsentPlan(copy,'apply'));}
 const install=consentInstallSql("SELECT jsonb_build_object('base',true);",{base:true},'SELECT true AS safe;');assert.match(install,/BEGIN;[\s\S]*consent_postflight[\s\S]*consent_base_postflight[\s\S]*consent_role_postflight[\s\S]*COMMIT;/);assert.equal((install.match(/^COMMIT;/gm)??[]).length,1);
});
test('workflow preserves the Production lease and existing controls, never auto-migrates or activates',()=>{
 const w=readFileSync('.github/workflows/support-ai-consent-production.yml','utf8');assert.match(w,/workflow_dispatch:/);assert.doesNotMatch(w,/^  (push|schedule|pull_request):/m);assert.match(w,/group: fanmind-production-deploy/);assert.match(w,/environment: production/);assert.match(w,/options: \[verify, apply\]/);assert.match(w,/default: verify/);assert.match(w,/git merge-base --is-ancestor/);assert.match(w,/--env-file=\/etc\/fanmind-backup\/worker.env/);
 const controller=readFileSync('scripts/operations/support-ai-consent-production.mjs','utf8');assert.doesNotMatch(controller,/pm2.*(?:reload|restart)|replaceSupportFlag|writeFileSync\([^\n]*\.env/);assert.match(controller,/PGSSLMODE:'verify-full'/);assert.match(controller,/consent_must_remain_disabled/);
});

test('Production apply reuses original completed-check policy and blocks failed Meta/shared controls',()=>{
 const e={...env('apply'),REVIEWED_COMMIT:sha,GITHUB_RUN_ID:'123'};
 const branch={protected:true,commit:{sha}},run={id:123,head_sha:sha,event:'workflow_dispatch',path:'.github/workflows/support-ai-consent-production.yml',repository:{full_name:'FanMind/FanMind'},actor:{id:270165082},check_suite_id:99},pr={merge_commit_sha:sha,merged_at:'2026-11-14',base:{ref:'main'},head:{repo:{full_name:'FanMind/FanMind'}}};
 const checks=names=>({total_count:names.length,check_runs:names.map((name,i)=>({id:i+1,name,status:'completed',conclusion:'success',app:{slug:'github-actions'},check_suite:{id:1}}))});
 const main=checks(REQUIRED_MAIN_CHECKS),head=checks(REQUIRED_PR_CHECKS);
 assert.equal(consentApplySourceReady(e,branch,run,pr,main,head),true);
 for(const name of ['control',...REQUIRED_MAIN_CHECKS]){const failed=structuredClone(main);failed.check_runs.push({id:100,name,status:'completed',conclusion:'failure',app:{slug:'github-actions'},check_suite:{id:2}});failed.total_count++;assert.equal(consentApplySourceReady(e,branch,run,pr,failed,head),false);}
 assert.equal(consentApplySourceReady(e,{...branch,protected:false},run,pr,main,head),false);
 assert.equal(consentApplySourceReady(e,branch,{...run,path:'.github/workflows/other.yml'},pr,main,head),false);
 assert.equal(consentApplySourceReady(e,branch,run,pr,main,{...head,total_count:101}),false);
});
