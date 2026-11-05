import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sourceManifest,classify,catalogueSql,canonical} from '../../scripts/operations/support-centre-schema.mjs';
import {evaluateSupportEnvironment,CONFIRMATIONS} from '../../scripts/operations/support-centre-staging.mjs';
import {collectSupportExport} from './supportPrivacy.mjs';
const sha='a'.repeat(40),ref='vshyhvgcmrlagvfnvomc';
function env(mode='verify'){const write=!['verify','monitor'].includes(mode);return {GITHUB_REF:'refs/heads/main',GITHUB_SHA:sha,GITHUB_EVENT_NAME:'workflow_dispatch',FANMIND_RUNTIME_ENVIRONMENT:'staging',FANMIND_SUPPORT_REVIEWED_COMMIT:sha,FANMIND_SUPPORT_CONFIRM:CONFIRMATIONS[mode],NEXT_PUBLIC_APP_URL:'https://staging.fanmind.ch',NEXT_PUBLIC_SUPABASE_URL:`https://${ref}.supabase.co`,FANMIND_TARGET_API_ORIGIN:'https://staging.fanmind.ch',FANMIND_PRODUCTION_API_ORIGIN:'https://fanmind.ch',FANMIND_TARGET_SUPABASE_PROJECT_REF:ref,FANMIND_PRODUCTION_SUPABASE_PROJECT_REF:'drqkpdvtbbrrdwmtrodz',FANMIND_TARGET_DB_HOST:`db.${ref}.supabase.co`,FANMIND_PRODUCTION_DB_HOST:'db.drqkpdvtbbrrdwmtrodz.supabase.co',PGHOST:`db.${ref}.supabase.co`,PGUSER:'postgres',PGPORT:'5432',PGDATABASE:'postgres',PGSSLMODE:'verify-full',FANMIND_ENABLE_NON_PRODUCTION_WRITES:String(write),FANMIND_NON_PRODUCTION_WRITE_ACK:write?'I_UNDERSTAND_NON_PRODUCTION_ONLY':''};}
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
 const exports={},dependencies={
  'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status??200})}},
  '@/lib/supportContinuityServer':{supportCustomer:async()=>identity,readSupportConversation:async()=>{if(failed)throw new Error('store_failed');return [];}},
  '@/lib/supportCentreServer':{supportCentreEnabled:()=>true,supportCentreDatabase:async(path,args)=>{assert.equal(args.p_actor,'actor-a');assert.equal(args.p_workspace,'workspace-a');if(path.endsWith('privacy_state'))return erased?null:{thread:'10000000-0000-4000-8000-000000000001',sequence:2};erased++;return true;}},
  '@/lib/supportPrivacy.mjs':{collectSupportExport},'@/lib/sharedRateLimit':{consumeSharedRateLimit:async()=>({allowed})},
  '@/lib/supportCentreRequest':{readSupportRequest:async r=>r.json()},'@/lib/supportCentrePolicy':{isSupportUuid:v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v)}
 };
 runInNewContext(ts.transpileModule(readFileSync('src/app/api/support/privacy/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>dependencies[n],Date,Number,Object});
 const request=(query='',body,origin='https://staging.fanmind.ch')=>({nextUrl:new URL(`https://staging.fanmind.ch/api/support/privacy${query}`),headers:new Headers({origin}),json:async()=>body});
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
