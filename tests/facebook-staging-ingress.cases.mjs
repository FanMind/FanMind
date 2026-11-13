import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as policy from '../src/lib/facebookStagingIngressPolicy.mjs';
import { OPERATOR_USER, OPERATOR_WORKSPACE } from '../src/lib/stagingOperatorIdentity.mjs';
const env = {FANMIND_RUNTIME_ENVIRONMENT:'staging',NEXT_PUBLIC_APP_URL:'https://staging.fanmind.ch',NEXT_PUBLIC_SUPABASE_URL:'https://vshyhvgcmrlagvfnvomc.supabase.co',FANMIND_STAGING_OPERATOR_SESSION_ENABLED:'true',FACEBOOK_APP_ID:policy.STAGING_INGRESS_APP,FACEBOOK_REDIRECT_URI:'https://staging.fanmind.ch/api/integrations/facebook/callback'};
const state={userId:OPERATOR_USER,workspaceId:OPERATOR_WORKSPACE,connectionType:'facebook_messages'};
const target={workspace_id:OPERATOR_WORKSPACE,page_id:policy.STAGING_INGRESS_PAGE,platform:'facebook',status:'connected',id:'connection',page_access_token_encrypted:'encrypted'};
const request=(query='code=synthetic&state=signed')=>new Request(env.FACEBOOK_REDIRECT_URI+'?'+query);
function load(path,deps,environment=env,mutate=false){const exports={};const source=readFileSync(path,'utf8');runInNewContext(ts.transpileModule(mutate ? source.replace('!stagingFacebookIngressTarget(process.env, connection)', 'false') : source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>deps[name]??{},process:{env:environment},console,URL,Response,Request,Headers,Buffer,Set});return exports;}
test('Strict-cookie bridge renders only the dedicated Staging Operator callback; escapes input and never changes cookies',async()=>{
 const r=policy.stagingFacebookOAuthContinuation(request('code=%22%3E%3Cscript%3E&state=%22%3E%3Cscript%3E'),env,state);
 assert.equal(r.status,200);assert.equal(r.headers.get('set-cookie'),null);assert.equal(r.headers.get('cache-control'),'no-store, private');assert.equal(r.headers.get('referrer-policy'),'no-referrer');assert.match(r.headers.get('content-security-policy'),/form-action 'self'/);
 const html=await r.text();assert.doesNotMatch(html,/<script\b/iu);assert.match(html,/&quot;&gt;&lt;script&gt;/);assert.match(html,/name="same_site_continue" value="1"/);
 for(const patch of [{FANMIND_RUNTIME_ENVIRONMENT:'production'},{NEXT_PUBLIC_APP_URL:'https://fanmind.ch'},{NEXT_PUBLIC_SUPABASE_URL:'https://drqkpdvtbbrrdwmtrodz.supabase.co'},{FACEBOOK_APP_ID:'2214477125984114'},{FACEBOOK_APP_ID:'1637976007865045'},{FACEBOOK_REDIRECT_URI:'https://fanmind.ch/api/integrations/facebook/callback'},{META_APP_ID:'foreign'},{FANMIND_STAGING_OPERATOR_SESSION_ENABLED:'false'}]) assert.equal(policy.stagingFacebookOAuthContinuation(request(),{...env,...patch},state),null);
 for(const s of [null,{...state,userId:'foreign'},{...state,workspaceId:'foreign'}])assert.equal(policy.stagingFacebookOAuthContinuation(request(),env,s),null);
 for(const query of ['code=x','state=signed','code=x&state=y&same_site_continue=1','code='+ 'x'.repeat(4097)+'&state=y'])assert.equal(policy.stagingFacebookOAuthContinuation(request(query),env,state),null);
 assert.equal(policy.stagingFacebookOAuthContinuation(new Request('https://foreign.invalid/api/integrations/facebook/callback?code=x&state=y'),env,state),null);
});
test('actual callback performs no exchange on unauthenticated bridge or wrong-user retry; authenticated continuation rechecks workspace',async()=>{
 let user=null,exchanges=0,completed=0,workspace=OPERATOR_WORKSPACE;
 const api=load('src/app/api/integrations/facebook/callback/route.ts',{
  '@/lib/facebookStagingIngressPolicy.mjs':policy,
  'next/navigation':{redirect:()=>{throw Error('login');}},'next/cache':{revalidatePath(){}},
  '@/lib/demoMode':{areDemoConnectionsDisabled:()=>false},
  '@/lib/metaIntegrationPolicy.mjs':{canManageMetaConnections:()=>true},
  '@/lib/supabase/server':{getSupabaseServerUser:async()=>({data:{user}})},
  '@/lib/workspaceAuthorization':{requireActiveAuthorizedWorkspace:async()=>({user,workspace:{id:workspace,role:'owner'}})},
  '@/lib/facebookIntegration':{verifyFacebookOAuthState:()=>state,exchangeFacebookCode:async()=>{exchanges++;return 'private';},getFacebookRuntimeConfigurationStatus:()=>({})},
  '@/lib/facebookConnectionFlow':{completeFacebookOAuthConnection:async()=>{completed++;return {ok:true,connectedType:'facebook_messages',initialImport:'skipped'};}}
 });
 assert.equal((await api.GET(request())).status,200);assert.equal(exchanges,0);
 await assert.rejects(api.GET(request('code=x&state=y&same_site_continue=1')),/login/);assert.equal(exchanges,0);
 user={id:'foreign'};assert.match((await api.GET(request())).headers.get('location'),/facebook_error=oauth/);assert.equal(exchanges,0);
 user={id:OPERATOR_USER};workspace='foreign';assert.match((await api.GET(request())).headers.get('location'),/facebook_error=workspace/);assert.equal(exchanges,0);
 workspace=OPERATOR_WORKSPACE;assert.match((await api.GET(request('code=x&state=y&same_site_continue=1'))).headers.get('location'),/connected=facebook_messages/);assert.equal(exchanges,1);assert.equal(completed,1);
});
function actionHarness({connection=target,allowed=true,active=true,saved=true,environment=env,mutate=false}={}){
 const calls=[];const status={subscribedAppsStatus:'active',fields:{messages:active?'active':'missing',feed:active?'active':'missing'}};
 const server={getSupabaseServerUser:async()=>({data:{user:{id:OPERATOR_USER}}}),getUserWorkspaceDashboard:async()=>({workspace:{id:OPERATOR_WORKSPACE,role:'owner'}}),getWorkspaceProcessingEntitlement:async()=>({allowed:true}),getWorkspaceSocialConnectionsServer:async()=>({connections:[connection]}),updateFacebookWebhookSubscribed:async(id,value)=>{calls.push(['save',id,value]);return {error:saved?null:{}};}};
 const api=load('src/app/channels/facebookWebhookActions.ts',{
  '@/lib/facebookStagingIngressPolicy.mjs':policy,'@/lib/facebookScopes':{FACEBOOK_MESSAGES_OAUTH_SCOPES:['pages_messaging'],FACEBOOK_COMMENT_FEED_SCOPES:['pages_read_user_content']},'next/cache':{revalidatePath(){}},
  '@/lib/demoMode':{areDemoConnectionsDisabled:()=>false},'@/lib/metaIntegrationPolicy.mjs':{canManageMetaConnections:()=>true},'@/lib/supabase/server':server,
  '@/lib/facebookIntegration':{decryptToken:()=> 'private-token',fetchFacebookTokenDiagnostics:async()=>{calls.push(['diagnostics']);return {};},hasFacebookPageAuthorization:()=>allowed,verifyFacebookPageTokenIdentity:async()=>allowed,subscribeFacebookPage:async(id,token,fields)=>{calls.push(['subscribe',id,...fields]);return status;},fetchFacebookPageWebhookStatus:async()=>{calls.push(['read']);return status;}}
 },environment,mutate);return {api,calls};
}
test('actual Staging action refuses foreign app/Page/workspace and unverified credentials before subscription',async()=>{
 for(const patch of [{page_id:'440506919151695'},{workspace_id:'foreign'},{status:'disconnected'}]){const h=actionHarness({connection:{...target,...patch}});assert.equal((await h.api.controlStagingFacebookIngress(true)).ok,false);assert.equal(h.calls.length,0);}
 const h=actionHarness({allowed:false});assert.equal((await h.api.controlStagingFacebookIngress(true)).code,'page_permissions');assert.equal(h.calls.some(c=>c[0]==='subscribe'||c[0]==='save'),false);
 const prod=actionHarness({environment:{...env,FANMIND_RUNTIME_ENVIRONMENT:'production'}});assert.equal((await prod.api.controlStagingFacebookIngress(true)).code,'target_rejected');assert.equal(prod.calls.length,0);
});
test('actual activation uses only messages/feed; local flag requires both exact-app fields and successful storage',async()=>{
 const h=actionHarness();assert.equal((await h.api.controlStagingFacebookIngress(true)).ok,true);assert.deepEqual(h.calls.find(c=>c[0]==='subscribe'),['subscribe',policy.STAGING_INGRESS_PAGE,'messages','feed']);assert.deepEqual(h.calls.at(-1),['save','connection',true]);
 const missing=actionHarness({active:false});assert.equal((await missing.api.controlStagingFacebookIngress(true)).ok,false);assert.deepEqual(missing.calls.at(-1),['save','connection',false]);
 const failed=actionHarness({saved:false});assert.equal((await failed.api.controlStagingFacebookIngress(true)).code,'save_failed');
 const read=actionHarness();assert.equal((await read.api.controlStagingFacebookIngress(false)).ok,true);assert.equal(read.calls.some(c=>c[0]==='subscribe'),false);
});

test('independent in-memory mutation proves the foreign-Page negative detects a removed target guard',async()=>{
 async function assertForeignDenied(h){assert.equal((await h.api.controlStagingFacebookIngress(true)).ok,false);assert.equal(h.calls.length,0);}
 await assertForeignDenied(actionHarness({connection:{...target,page_id:'440506919151695'}}));
 await assert.rejects(assertForeignDenied(actionHarness({connection:{...target,page_id:'440506919151695'},mutate:true})),{name:'AssertionError'});
});

test('installed Next proxy adaptation keeps the Strict-cookie bridge on the exact Staging host only',async()=>{
 const require=createRequire(import.meta.url);
 const NextNodeServer=require('next/dist/server/next-server').default;
 const {NodeNextRequest}=require('next/dist/server/base-http/node');
 const {NextRequestAdapter}=require('next/dist/server/web/spec-extension/adapters/next-request');
 const incoming=Readable.from([]);incoming.method='GET';incoming.url='/api/integrations/facebook/callback?code=synthetic&state=signed';incoming.headers={host:'staging.fanmind.ch','x-forwarded-proto':'https','sec-fetch-site':'cross-site'};
 const nodeRequest=new NodeNextRequest(incoming);NextNodeServer.prototype.attachRequestMeta.call({fetchHostname:'localhost',port:3001,nextConfig:{experimental:{}}},nodeRequest,{query:{}},false);
 const adapted=NextRequestAdapter.fromNodeNextRequest(nodeRequest,new AbortController().signal);
 assert.equal(new URL(adapted.url).origin,'https://localhost:3001');assert.equal(policy.stagingFacebookOAuthContinuation(adapted,env,state).status,200);
 for(const host of ['attacker.invalid','fanmind.ch','staging.fanmind.ch.attacker.invalid'])assert.equal(policy.stagingFacebookOAuthContinuation(new Request(adapted.url,{headers:{host,'x-forwarded-proto':'https'}}),env,state),null);
 for(const origin of ['https://attacker.invalid:3001','http://localhost:3000','https://fanmind.ch'])assert.equal(policy.stagingFacebookOAuthContinuation(new Request(origin+'/api/integrations/facebook/callback?code=x&state=y',{headers:incoming.headers}),env,state),null);
});
