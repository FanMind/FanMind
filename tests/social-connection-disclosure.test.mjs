import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { buildSupabaseApiKeyHeaders } from '../src/lib/supabase/apiKeyPolicy.mjs';
const workspace='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const row={workspace_id:workspace,provider:'x',external_account_id:'synthetic-account',display_name:'Synthetic Creator',expires_at:'2026-09-12T12:00:00Z',connected_at:'2026-09-11T12:00:00Z'};
function load(path,deps,env={}) {
 const exports={};const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(code,{exports,URL,Response,AbortSignal,Buffer,TextDecoder,process:{env},require:name=>{assert.ok(Object.hasOwn(deps,name),name);return deps[name]}});return exports;
}
function harness({denied=false,foreign=false,member=false,revoked=false,status=200,data=[row],key='sb_secret_synthetic',network=false}={}) {
 const calls=[];let authorizations=0;
 const deps={
  'server-only':{},
  '@/lib/workspaceAuthorization':{requireAuthorizedWorkspace:async token=>{assert.equal(token,'synthetic-user-jwt');authorizations++;if(denied||(revoked&&authorizations>1))throw Error('unauthorized');return{user:{id:'owner'},workspace:{id:foreign?'other':workspace,owner_user_id:member?'different':'owner'}};}},
  '@/lib/supabase/config':{getSupabaseApiKeyHeaders:buildSupabaseApiKeyHeaders,getSupabaseRestUrl:table=>`https://stagingref.supabase.co/rest/v1/${table}`},
  '@/lib/dataDisclosurePagination':{DataDisclosureExportError:class extends Error{}},
 };
 const run=load('src/lib/socialConnectionDisclosure.ts',deps,{SUPABASE_SERVICE_ROLE_KEY:key}).getSocialConnectionMetadataForDisclosure;
 const fetchImpl=async(url,options)=>{calls.push({url,options});if(network)throw Error('private backend text');return new Response(JSON.stringify(data),{status})};
 return{calls,run:()=>run(workspace,'synthetic-user-jwt',fetchImpl),authorizations:()=>authorizations};
}
test('owner export selects only safe metadata and strips any unexpected token column from the returned object',async()=>{
 for(const key of ['sb_secret_synthetic','eyJ.synthetic.service']) {
  const h=harness({key,data:[{...row,encrypted_token:'NEVER_EXPORT',refresh_token:'NEVER_EXPORT',revision:'internal'}]});
  const result=JSON.parse(JSON.stringify(await h.run()));assert.deepEqual(result,[row]);assert.equal(h.authorizations(),2);
  const {url,options}=h.calls[0];assert.equal(url.searchParams.get('workspace_id'),`eq.${workspace}`);assert.equal(url.searchParams.get('limit'),'3');assert.equal(url.searchParams.get('select'),Object.keys(row).join(','));
  assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');assert.equal(options.headers.Authorization,key.startsWith('sb_')?undefined:`Bearer ${key}`);
 }
});
test('anonymous, foreign, member and missing server credentials never reach the privileged table',async()=>{
 for(const options of [{denied:true},{foreign:true},{member:true},{key:''}]){const h=harness(options);await assert.rejects(h.run());assert.equal(h.calls.length,0)}
 const revoked=harness({revoked:true});await assert.rejects(revoked.run());assert.equal(revoked.calls.length,1);
});
test('only an explicitly missing optional table is empty; denied, malformed and unavailable exports fail',async()=>{
 for(const code of ['42P01','PGRST205']){const h=harness({status:404,data:{code}});assert.equal((await h.run()).length,0)}
 for(const options of [{status:403,data:{code:'42501'}},{status:500,data:{code:'PGRST002'}},{status:404,data:{code:'PGRST202'}},{network:true},{data:{}},{data:[{...row,workspace_id:'other'}]},{data:[row,row]},{data:[row,{...row,provider:'tiktok'},row]},{data:[{...row,provider:'unexpected'}]},{data:[{...row,display_name:'x'.repeat(33000)}]}]){await assert.rejects(harness(options).run())}
});
test('the actual disclosure collector uses the protected metadata reader while Creator datasets still use the user JWT',async()=>{
 const calls=[];let protectedReads=0;
 const deps={
  'next/headers':{cookies:async()=>({get:()=>({value:'synthetic-user-jwt'})})},
  '@/lib/supabase/config':{SUPABASE_ACCESS_TOKEN_COOKIE:'cookie',getSupabaseHeaders:token=>({Authorization:`Bearer ${token}`}),getSupabaseRestUrl:table=>`https://stagingref.supabase.co/rest/v1/${table}`},
  '@/lib/dataDisclosurePagination':{DataDisclosureExportError:class extends Error{}},
  '@/lib/socialConnectionDisclosure':{getSocialConnectionMetadataForDisclosure:async(id,token)=>{assert.equal(id,workspace);assert.equal(token,'synthetic-user-jwt');protectedReads++;return[row]}},
 };
 const collector=load('src/lib/dataDisclosureMetaExport.ts',deps).getWorkspaceMetaDataForDisclosure;
 const result=await collector(workspace,async(url,options)=>{calls.push({url,options});return new Response('[]',{status:200})});
 assert.equal(protectedReads,1);assert.equal(result.find(x=>x.key==='social_provider_connections').rows.length,1);
 assert.ok(!calls.some(c=>c.url.pathname.endsWith('/social_provider_connections')));
 for(const table of ['creators','creator_voice_profiles','creator_sales_playbooks','creator_commercial_events']){const c=calls.find(c=>c.url.pathname.endsWith('/'+table));assert.ok(c);assert.equal(c.options.headers.Authorization,'Bearer synthetic-user-jwt');assert.equal(c.url.searchParams.get('workspace_id'),`eq.${workspace}`)}
});
