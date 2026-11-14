import test from 'node:test';

import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AUDIT_CONFIRMATIONS,AUDIT_SOURCES,checkAuditSources,evaluateAuditEnvironment,auditState,auditAcceptanceSql,legacyAuditPreflightSql,runAudit} from '../../scripts/operations/support-repair-audit-staging.mjs';
test('audit controlled sources retain the exact reviewed upgrade and rollback-only acceptance',()=>{
 const sources=checkAuditSources();assert.equal(Object.keys(sources).length,4);
 assert.equal(AUDIT_SOURCES['docs/operations/sql/support_repair_audit_staging_empty_upgrade.sql'],'178bb5017ac25114ded84213f37f92bda224193bbd9ab0aa5b2812fec6c9faf1');
 const sql=auditAcceptanceSql(sources);
 assert.doesNotMatch(sql,/\bcommit\s*;/iu);assert.match(sql,/SHARE ROW EXCLUSIVE/u);
 assert.match(sql,/audit_acceptance_requires_empty/u);assert.match(sql,/SUPPORT_AUDIT_TRANSACTION=ROLLED_BACK/u);
 assert.match(legacyAuditPreflightSql(sources),/confrelid/u);
});
test('audit environment refuses wrong target, unchecked source, schedule, TLS and ambiguous action',()=>{
 for(const mode of Object.keys(AUDIT_CONFIRMATIONS)){
  const valid={...env(mode==='audit-verify'?'verify':'apply'),FANMIND_SUPPORT_CONFIRM:AUDIT_CONFIRMATIONS[mode]};
  assert.equal(evaluateAuditEnvironment(valid,mode,sha).ok,true);
  for(const bad of [{GITHUB_REF:'refs/heads/feature'},{GITHUB_EVENT_NAME:'schedule'},{FANMIND_TARGET_SUPABASE_PROJECT_REF:'drqkpdvtbbrrdwmtrodz'},{PGSSLMODE:'require'},{PGPASSWORD:'secret'},{FANMIND_SUPPORT_CONFIRM:'apply-support-centre-schema'},{NEXT_PUBLIC_APP_URL:'https://fanmind.ch'}])
   assert.equal(evaluateAuditEnvironment({...valid,...bad},mode,sha).ok,false);
 }
 assert.throws(()=>auditState('SUPPORT_REPAIR_AUDIT_SCHEMA_STATE=INSTALLED\n'),/classifier_output/u);
 assert.equal(auditState('SUPPORT_REPAIR_AUDIT_SCHEMA_STATE=INSTALLED SUPPORT_REPAIR_AUDIT_SCHEMA_DETAILS={}'),'INSTALLED');
});
test('audit executor rejects drift/data before DDL, skips installed state and verifies rollback cleanup',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'fanmind-audit-policy-'));const pass=join(dir,'pgpass');
 writeFileSync(pass,'localhost:5432:postgres:postgres:synthetic\n',{mode:0o600});
 const state=value=>'SUPPORT_REPAIR_AUDIT_SCHEMA_STATE='+value+' SUPPORT_REPAIR_AUDIT_SCHEMA_DETAILS={}';
 const absence=JSON.stringify({audit:0,owner:0,threads:0,connection:0,cases:0});
 async function execute(mode,{initial='INSTALLED',legacy={exact:true,empty:true,dependencies:true},residue=absence,markers=true}={}){
  const calls=[];let classifiers=0;
  const configuration={...env(mode==='audit-verify'?'verify':'apply'),FANMIND_SUPPORT_CONFIRM:AUDIT_CONFIRMATIONS[mode],PGPASSFILE:pass};
  const promise=runAudit(mode,configuration,{
   fetch:async url=>url.endsWith('/api/version')?({status:200,text:async()=>JSON.stringify({application:'fanmind',runtimeEnvironment:'staging',releaseCommit:sha})}):({status:404,headers:{get:()=>'no-store'},text:async()=>JSON.stringify({error:url.endsWith('repair-request')?'not_available':'support_unavailable'})}),
   verifyCore:()=>{},
   spawn:(command,args,options)=>{
    if(command==='git')return {status:0,stdout:sha+'\n'};
    calls.push(options.input);
    let out='';
    if(options.input.includes('SUPPORT_REPAIR_AUDIT_SCHEMA_DETAILS'))out=state(classifiers++===0?initial:'INSTALLED');
    else if(options.input.startsWith('BEGIN READ ONLY;SELECT jsonb_build_object(\'exact\''))out=JSON.stringify(legacy);
    else if(options.input.includes('SUPPORT_AUDIT_TRANSACTION=ROLLED_BACK'))out=markers?'SUPPORT_REPAIR_AUDIT_NATIVE_ACCEPTANCE=PASS\nSUPPORT_SYNTHETIC_FUNCTIONS=PASS\nSUPPORT_AUDIT_BINDING=PASS\nSUPPORT_AUDIT_TRANSACTION=ROLLED_BACK':'';
    else if(options.input.includes("'threads'"))out=residue;
    return {status:0,stdout:out};
   },
  });return {promise,calls};
 }
 try{
  for(const legacy of [{exact:false,empty:true,dependencies:true},{exact:true,empty:false,dependencies:true},{exact:true,empty:true,dependencies:false}]){
   const run=await execute('audit-upgrade',{initial:'DRIFT',legacy});
   await assert.rejects(run.promise,/legacy_drift_or_data/u);assert.equal(run.calls.some(q=>q.includes('ALTER TABLE')),false);
  }
  const installed=await execute('audit-upgrade');await installed.promise;assert.equal(installed.calls.some(q=>q.includes('ALTER TABLE')),false);
  const upgrade=await execute('audit-upgrade',{initial:'DRIFT'});await upgrade.promise;assert.equal(upgrade.calls.filter(q=>q.includes('ALTER TABLE')).length,1);
  const accepted=await execute('audit-acceptance');await accepted.promise;
  const missing=await execute('audit-acceptance',{markers:false});await assert.rejects(missing.promise,/acceptance_marker/u);
  const dirty=await execute('audit-acceptance',{residue:JSON.stringify({audit:1,owner:0,threads:0,connection:0,cases:0})});await assert.rejects(dirty.promise,/cleanup/u);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sourceManifest,classify,catalogueSql,canonical} from '../../scripts/operations/support-centre-schema.mjs';
import {evaluateSupportEnvironment,CONFIRMATIONS} from '../../scripts/operations/support-centre-staging.mjs';
import {collectSupportExport} from './supportPrivacy.mjs';
const sha='a'.repeat(40),ref='vshyhvgcmrlagvfnvomc';
function env(mode='verify'){const write=!['verify','monitor'].includes(mode);return {GITHUB_REF:'refs/heads/main',GITHUB_SHA:sha,GITHUB_EVENT_NAME:'workflow_dispatch',FANMIND_RUNTIME_ENVIRONMENT:'staging',FANMIND_SUPPORT_REVIEWED_COMMIT:sha,FANMIND_SUPPORT_CONFIRM:CONFIRMATIONS[mode],NEXT_PUBLIC_APP_URL:'https://staging.fanmind.ch',NEXT_PUBLIC_SUPABASE_URL:`https://${ref}.supabase.co`,FANMIND_TARGET_API_ORIGIN:'https://staging.fanmind.ch',FANMIND_PRODUCTION_API_ORIGIN:'https://fanmind.ch',FANMIND_TARGET_SUPABASE_PROJECT_REF:ref,FANMIND_PRODUCTION_SUPABASE_PROJECT_REF:'drqkpdvtbbrrdwmtrodz',FANMIND_TARGET_DB_HOST:`db.${ref}.supabase.co`,FANMIND_PRODUCTION_DB_HOST:'db.drqkpdvtbbrrdwmtrodz.supabase.co',PGHOST:`db.${ref}.supabase.co`,PGUSER:'postgres',PGPORT:'5432',PGDATABASE:'postgres',PGSSLMODE:'verify-full',FANMIND_ENABLE_NON_PRODUCTION_WRITES:String(write),FANMIND_NON_PRODUCTION_WRITE_ACK:write?'I_UNDERSTAND_NON_PRODUCTION_ONLY':''};}
test('customer runtime acceptance cannot target Production, unmarked accounts, overlapping fixtures or an unreviewed ref',async()=>{
 const {customerAcceptanceBoundary}=await import('../../scripts/operations/support-customer-staging-acceptance.mjs');
 const valid={...env('apply'),GITHUB_REPOSITORY:'FanMind/FanMind',FANMIND_SUPPORT_CUSTOMER_CONFIRM:'run-staging-support-customer-acceptance',FANMIND_STAGING_E2E_EMAIL:'primary-staging@example.invalid',FANMIND_STAGING_E2E_PASSWORD:'synthetic-only',FANMIND_STAGING_E2E_WORKSPACE_ID:'10000000-0000-4000-8000-000000000001',FANMIND_STAGING_E2E_SECONDARY_EMAIL:'secondary-staging@example.invalid',FANMIND_STAGING_E2E_SECONDARY_PASSWORD:'synthetic-only',FANMIND_STAGING_E2E_SECONDARY_WORKSPACE_ID:'10000000-0000-4000-8000-000000000002'};
 assert.equal(customerAcceptanceBoundary(valid,sha).length,2);
 for(const bad of [{GITHUB_REPOSITORY:'foreign/repo'},{GITHUB_EVENT_NAME:'schedule'},{GITHUB_REF:'refs/heads/feature'},{NEXT_PUBLIC_APP_URL:'https://fanmind.ch'},{FANMIND_SUPPORT_REVIEWED_COMMIT:'b'.repeat(40)},{FANMIND_STAGING_E2E_EMAIL:'customer@example.invalid'},{FANMIND_STAGING_E2E_PASSWORD:''},{FANMIND_STAGING_E2E_SECONDARY_WORKSPACE_ID:valid.FANMIND_STAGING_E2E_WORKSPACE_ID},{FANMIND_STAGING_E2E_SECONDARY_EMAIL:valid.FANMIND_STAGING_E2E_EMAIL},{PGSSLMODE:'require'}])assert.throws(()=>customerAcceptanceBoundary({...valid,...bad},sha));
});
test('support rollout manifest covers entire base plus operations schema',()=>{const m=sourceManifest();assert.equal(m.tables.length,7);assert.equal(m.functions.length,20);assert.equal(m.triggers.length,2);assert.ok(m.sources.every(s=>/^[a-f0-9]{64}$/.test(s.sha256)));assert.ok(catalogueSql().includes('attacl'));});
test('support protected path rejects Production, redirect, missing consent and wrong checkout',()=>{
 for(const mode of Object.keys(CONFIRMATIONS))assert.equal(evaluateSupportEnvironment(env(mode),mode,sha).ok,true,mode);
 for(const bad of [{PGSSLMODE:'require'},{PGHOST:'db.drqkpdvtbbrrdwmtrodz.supabase.co'},{FANMIND_SUPPORT_CONFIRM:'apply-website-chat-retention-migration'},{GITHUB_REF:'refs/heads/feature'},{PGPASSWORD:'forbidden'},{PGOPTIONS:'unsafe'},{FANMIND_TARGET_SUPABASE_PROJECT_REF:'drqkpdvtbbrrdwmtrodz'}])assert.equal(evaluateSupportEnvironment({...env('apply'),...bad},'apply',sha).ok,false);
 assert.equal(evaluateSupportEnvironment(env(),'verify','b'.repeat(40)).ok,false);
 assert.equal(evaluateSupportEnvironment({...env('retention'),GITHUB_EVENT_NAME:'schedule'},'retention',sha).ok,false);
});
test('support classification never promotes partial/drifting or missing reference',()=>{
 const empty={tables:[],functions:[],triggers:[],sequences:[],extra_relations:[]};assert.equal(classify(empty,null),'ABSENT');assert.equal(classify({...empty,tables:[{}]},null),'REFERENCE_REQUIRED');assert.equal(classify(null,null),'INCOMPLETE');
 assert.equal(canonical({b:2,a:1}),canonical({a:1,b:2}));
});
test('own support export preserves every page and rejects duplicate cursors/partial result',async()=>{
 const first=Array.from({length:100},(_,i)=>({request_id:String(i)})),older=[{request_id:'older'}];let calls=0;
 const rows=await collectSupportExport(async before=>{calls++;return before?older:first;});assert.equal(rows.length,101);assert.equal(rows[0].request_id,'older');assert.equal(calls,2);
 await assert.rejects(collectSupportExport(async()=>first),/cursor/);
 await assert.rejects(collectSupportExport(async()=>{throw new Error('store_failed');}),/store_failed/);
});
test('privacy mutation uses exact scope, explicit confirmation and a fresh auth-derived tuple',()=>{
 const route=readFileSync('src/app/api/support/privacy/route.ts','utf8');assert.match(route,/input\.confirmed!==true/);assert.match(route,/input\.scope!==identity\.scope/);assert.match(route,/p_actor:identity\.actor,p_workspace:identity\.workspace/);assert.match(route,/rpc\/support_chat_privacy_state/);
});

test('actual own-data route rejects stale scope/foreign Origin and never substitutes client identities',async()=>{
 const {runInNewContext}=await import('node:vm'),{default:ts}=await import('typescript');
 let identity={actor:'actor-a',workspace:'workspace-a',scope:'scope-a'},allowed=true,erased=0,failed=false;
 const http=await import('./httpMutationPolicy.mjs');
 const exports={},dependencies={
  '@/lib/supportAIConsentPolicy':{persistentSupportConsentEnabled:()=>false},'@/lib/supportAIConsentServer':{},
  '@/lib/httpMutationPolicy.mjs':http,
  'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status??200})}},
  '@/lib/supportContinuityServer':{supportCustomer:async()=>identity,readSupportConversation:async()=>{if(failed)throw new Error('store_failed');return [];}},
  '@/lib/supportCentreServer':{supportCentreEnabled:()=>true,supportCentreDatabase:async(path,args)=>{assert.equal(args.p_actor,'actor-a');assert.equal(args.p_workspace,'workspace-a');if(path.endsWith('privacy_state'))return erased?null:{thread:'10000000-0000-4000-8000-000000000001',sequence:2};erased++;return true;}},
  '@/lib/supportPrivacy.mjs':{collectSupportExport},'@/lib/sharedRateLimit':{consumeSharedRateLimit:async()=>({allowed})},
  '@/lib/supportCentreRequest':{readSupportRequest:async r=>r.json()},'@/lib/supportCentrePolicy':{isSupportUuid:v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v)}
 };
 runInNewContext(ts.transpileModule(readFileSync('src/app/api/support/privacy/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>dependencies[n],Date,Number,Object});
 const request=(query='',body,origin='https://staging.fanmind.ch')=>({url:`https://staging.fanmind.ch/api/support/privacy${query}`,nextUrl:new URL(`https://staging.fanmind.ch/api/support/privacy${query}`),headers:new Headers({origin}),json:async()=>body});
 assert.equal((await exports.GET(request('?scope=foreign'))).status,400);
 const data=await exports.GET(request('?scope=scope-a'));assert.equal(data.status,200);assert.equal(data.body.scope,'scope-a');
 failed=true;assert.equal((await exports.GET(request('?scope=scope-a'))).status,503);failed=false;
 const body={action:'erase',confirmed:true,scope:'scope-a',thread:'10000000-0000-4000-8000-000000000001',sequence:2};
 assert.equal((await exports.POST(request('',body,'https://evil.invalid'))).status,403);
 assert.equal((await exports.POST(request('',{...body,actor:'other'}))).status,400);
 assert.equal((await exports.POST(request('',{...body,scope:'foreign'}))).status,400);
 allowed=false;assert.equal((await exports.POST(request('',body))).status,429);assert.equal(erased,0);
 allowed=true;assert.equal((await exports.POST(request('',body))).status,200);assert.equal(erased,1);
 identity=null;assert.equal((await exports.GET(request('?scope=scope-a'))).status,401);
});
