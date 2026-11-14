import assert from 'node:assert/strict';
import test from 'node:test';
import { instagramUnifiedEnabled, assertUnifiedOperator, stagingInstagramIngressEnabled, validateUnifiedDiagnostics, selectUnifiedAccount, readUnifiedCredential, instagramUnifiedContinuation, UNIFIED_SCOPES } from '../src/lib/instagramUnifiedPolicy.mjs';
import { OPERATOR_USER, OPERATOR_WORKSPACE } from '../src/lib/stagingOperatorIdentity.mjs';
import { validateInstagramGraphPagingUrl, resolveInstagramGraphPagingCursor } from '../src/lib/instagramGraphPagingPolicy.mjs';
const env={INSTAGRAM_LOGIN_MODE:'unified',FANMIND_RUNTIME_ENVIRONMENT:'staging',FANMIND_STAGING_OPERATOR_SESSION_ENABLED:'true',NEXT_PUBLIC_APP_URL:'https://staging.fanmind.ch',NEXT_PUBLIC_SUPABASE_URL:'https://vshyhvgcmrlagvfnvomc.supabase.co',INSTAGRAM_APP_ID:'1547928503809961',FACEBOOK_APP_ID:'1547928503809961',INSTAGRAM_APP_SECRET:'a'.repeat(32),FACEBOOK_APP_SECRET:'a'.repeat(32),INSTAGRAM_UNIFIED_CONFIG_ID:'12345678',INSTAGRAM_REDIRECT_URI:'https://staging.fanmind.ch/api/integrations/instagram/callback'};
test('Unified configuration refuses Production, wrong app/project/secret and foreign Operator',()=>{
 assert.equal(instagramUnifiedEnabled(env),true);
 for(const patch of [{FANMIND_RUNTIME_ENVIRONMENT:'production'},{FACEBOOK_APP_ID:'wrong'},{INSTAGRAM_APP_SECRET:'b'.repeat(32)},{NEXT_PUBLIC_SUPABASE_URL:'https://drqkpdvtbbrrdwmtrodz.supabase.co'},{META_APP_SECRET:'foreign'}])assert.equal(instagramUnifiedEnabled({...env,...patch}),false);
 assert.doesNotThrow(()=>assertUnifiedOperator(env,OPERATOR_USER,OPERATOR_WORKSPACE));
 assert.throws(()=>assertUnifiedOperator(env,'foreign',OPERATOR_WORKSPACE));assert.throws(()=>assertUnifiedOperator(env,OPERATOR_USER,'foreign'));
});
test('ingress controls use exact Staging Operator/account eligibility without browser-denied OAuth columns',()=>{
 assert.equal(stagingInstagramIngressEnabled(env,OPERATOR_USER,OPERATOR_WORKSPACE,'fanmind.crm'),true);
 for(const [configuration,user,workspace,name] of [
  [{...env,FANMIND_RUNTIME_ENVIRONMENT:'production'},OPERATOR_USER,OPERATOR_WORKSPACE,'fanmind.crm'],
  [env,'foreign',OPERATOR_WORKSPACE,'fanmind.crm'],[env,OPERATOR_USER,'foreign','fanmind.crm'],
  [env,OPERATOR_USER,OPERATOR_WORKSPACE,'foreign'],[{},OPERATOR_USER,OPERATOR_WORKSPACE,'fanmind.crm'],
 ])assert.equal(stagingInstagramIngressEnabled(configuration,user,workspace,name),false);
});
test('System User diagnostics reject user/Page tokens, wrong app, missing/extra scopes and expired credentials',()=>{
 const d={is_valid:true,app_id:env.INSTAGRAM_APP_ID,type:'SYSTEM_USER',scopes:[...UNIFIED_SCOPES],expires_at:2000000000};
 assert.doesNotThrow(()=>validateUnifiedDiagnostics(d));
 assert.deepEqual(validateUnifiedDiagnostics({...d,expires_at:0,data_access_expires_at:0,access_token:'must-not-escape'}),{appId:env.INSTAGRAM_APP_ID,tokenType:'SYSTEM_USER',scopes:[...UNIFIED_SCOPES],expiresAt:0,dataAccessExpiresAt:0});
 assert.equal(validateUnifiedDiagnostics({...d,expires_at:undefined}).expiresAt,null);
 assert.throws(()=>validateUnifiedDiagnostics({...d,expires_at:'Never'}));
 for(const patch of [{is_valid:false},{type:'USER'},{type:'PAGE'},{app_id:'foreign'},{scopes:['instagram_basic']},{scopes:[...UNIFIED_SCOPES,'ads_read']},{expires_at:1}])assert.throws(()=>validateUnifiedDiagnostics({...d,...patch}));
});
test('Assigned-account selection rejects mixed grants, wrong username and ambiguous identities',()=>{
 const a={id:'12345678',username:'fanmind.crm'};assert.deepEqual(selectUnifiedAccount([a]),a);
 for(const v of [[],[a,a],[{...a,username:'foreign'}],[{...a,id:'invalid'}]])assert.throws(()=>selectUnifiedAccount(v));
});
test('Encrypted credential payload binds app/config/business/account and never treats a raw Page token as Unified',()=>{
 const v={version:1,mode:'unified',appId:env.INSTAGRAM_APP_ID,configId:env.INSTAGRAM_UNIFIED_CONFIG_ID,businessId:'12345678',accountId:'87654321',accessToken:'synthetic'};
 assert.equal(readUnifiedCredential(JSON.stringify(v),env,'87654321').accessToken,'synthetic');
 for(const patch of [{configId:'foreign'},{appId:'foreign'},{accountId:'foreign'},{businessId:''},{mode:'instagram_login'}])assert.throws(()=>readUnifiedCredential(JSON.stringify({...v,...patch}),env,'87654321'));
 assert.throws(()=>readUnifiedCredential('raw-page-token',env,'87654321'));
});
test('Paging is pinned to the selected provider host and never crosses protocols, versions or credentials',()=>{
 const ig='https://graph.instagram.com/v25.0/123?after=abc', fb='https://graph.facebook.com/v25.0/123?after=abc';
 assert.equal(validateInstagramGraphPagingUrl(ig),ig);assert.equal(validateInstagramGraphPagingUrl(fb),null);assert.equal(validateInstagramGraphPagingUrl(ig,'graph.facebook.com'),null);
 assert.equal(resolveInstagramGraphPagingCursor(fb,'graph.facebook.com'),'abc');
 for(const host of ['graph.facebook.com','graph.instagram.com']) {
  for(const authority of [`${host}.attacker.invalid`,`attacker.invalid/${host}`,`${host}:444`,`user@attacker.invalid/${host}`]) {
   assert.equal(validateInstagramGraphPagingUrl(`https://${authority}/v25.0/123?after=abc`,host),null);
  }
 }
 assert.equal(validateInstagramGraphPagingUrl(ig,'attacker.invalid'),null);
 for(const u of ['http://graph.facebook.com/v25.0/123','https://attacker.invalid/v25.0/123','https://user@graph.facebook.com/v25.0/123','https://graph.facebook.com/v1.0/123'])assert.equal(validateInstagramGraphPagingUrl(u,'graph.facebook.com'),null);
});
test('Strict continuation is single-step, escaped, no-store and exact Operator/origin bound',async()=>{
 const state={userId:OPERATOR_USER,workspaceId:OPERATOR_WORKSPACE};const request=q=>new Request(env.INSTAGRAM_REDIRECT_URI+'?'+q);
 const r=instagramUnifiedContinuation(request('code=%22%3E%3Cscript%3E&state=signed'),env,state);assert.equal(r.status,200);assert.equal(r.headers.get('set-cookie'),null);assert.equal(r.headers.get('referrer-policy'),'no-referrer');assert.doesNotMatch(await r.text(),/<script\b/iu);
 assert.equal(instagramUnifiedContinuation(request('code=x&state=signed&same_site_continue=1'),env,state),null);
 assert.equal(instagramUnifiedContinuation(request('code=x&state=signed'),env,{...state,workspaceId:'foreign'}),null);
 assert.equal(instagramUnifiedContinuation(new Request('https://foreign.invalid/api/integrations/instagram/callback?code=x&state=signed'),env,state),null);
});

import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as crypto from 'node:crypto';
import * as unifiedPolicy from '../src/lib/instagramUnifiedPolicy.mjs';
import * as paging from '../src/lib/instagramGraphPagingPolicy.mjs';
import { sanitizeMetaProviderError } from '../src/lib/metaProviderErrorPolicy.mjs';
import { renderInstagramUnifiedConfiguration, subscribeStagingMetaWebhook } from '../scripts/operations/staging-meta-runtime.mjs';
test('server connection read preserves persisted Unified identity and expiry without expanding public column grants',async()=>{
 const source=ts.createSourceFile('server.ts',readFileSync('src/lib/supabase/server.ts','utf8'),ts.ScriptTarget.Latest,true);
 const names=new Set(['SOCIAL_CONNECTION_PUBLIC_COLUMNS','SOCIAL_CONNECTION_SECRET_COLUMNS']);
 const nodes=source.statements.filter(node=>ts.isVariableStatement(node)?node.declarationList.declarations.some(d=>names.has(d.name.getText(source))):ts.isFunctionDeclaration(node)&&node.name?.text==='getWorkspaceSocialConnectionsServer');
 const exports={};let selected;
 const stored={id:'synthetic-connection',workspace_id:OPERATOR_WORKSPACE,platform:'instagram',status:'connected',external_account_name:'fanmind.crm',oauth_login_type:'instagram_unified_login',external_account_type:'professional',token_expires_at:'2030-01-01T00:00:00Z',permissions_verified_at:'2026-11-14T00:00:00Z',page_access_token_encrypted:'synthetic-ciphertext'};
 const code=ts.transpileModule(nodes.map(n=>n.getText(source)).join('\n'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const context={exports,getServiceAccessToken:()=> 'synthetic-service-key',socialConnectionsError:()=>({connections:[],error:'denied'}),postgrestSelect:async(table,key,columns,filters)=>{
  assert.equal(table,'social_connections');assert.equal(key,'synthetic-service-key');assert.equal(filters[0][1],OPERATOR_WORKSPACE);
  selected=columns.split(',');return{data:[Object.fromEntries(Object.entries(stored).filter(([name])=>selected.includes(name)))],error:null};
 }};
 runInNewContext(code,context);
 const result=await exports.getWorkspaceSocialConnectionsServer(OPERATOR_WORKSPACE);
 assert.equal(result.connections[0].oauth_login_type,'instagram_unified_login');
 for(const name of ['external_account_type','token_expires_at','permissions_verified_at'])assert.equal(result.connections[0][name],stored[name]);
 const publicColumns=readFileSync('src/lib/supabase/server.ts','utf8').match(/const SOCIAL_CONNECTION_PUBLIC_COLUMNS =\s*"([^"]+)";/u)[1].split(',');
 for(const name of ['oauth_login_type','external_account_type','token_expires_at','permissions_verified_at','page_access_token_encrypted'])assert.equal(publicColumns.includes(name),false);
 context.getServiceAccessToken=()=>null;selected=null;
 assert.equal((await exports.getWorkspaceSocialConnectionsServer(OPERATOR_WORKSPACE)).error,'denied');assert.equal(selected,null);
 const page=readFileSync('src/app/channels/page.tsx','utf8');
 assert.match(page,/unified: stagingInstagramIngressEnabled\(process\.env, data\.user\.id, workspace\.id, instagramConnection\.external_account_name\)/u);
});
function integration(fetchImpl) {
 const exports={};
 const deps={'node:crypto':crypto,'@/lib/instagramUnifiedPolicy.mjs':unifiedPolicy,'@/lib/instagramGraphPagingPolicy.mjs':paging,'@/lib/metaIntegrationPolicy.mjs':{META_GRAPH_API_VERSION:'v25.0'},'@/lib/metaConversationPaginationPolicy.mjs':{normalizeMetaPagingCursor:x=>x,createMetaConversationSyncAbortSignal:()=>undefined},'@/lib/metaRuntimeConfigPolicy.mjs':{isUsableMetaAppId:x=>/^\d+$/u.test(x??''),isUsableMetaAppSecret:x=>/^[a-f0-9]{32}$/u.test(x??''),normalizeMetaRuntimeValue:x=>x,normalizeMetaCallbackUrl:x=>x},'@/lib/instagramScopes':{},'@/lib/metaProviderErrorPolicy.mjs':{sanitizeMetaProviderError}};
 runInNewContext(ts.transpileModule(readFileSync('src/lib/instagramIntegration.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>deps[n],process:{env},fetch:fetchImpl,URL,URLSearchParams,Response,AbortSignal,Buffer,console});return exports;
}
test('actual Unified exchange uses Meta server credentials and discovers exact assigned account/business; no Instagram exchange fallback',async()=>{
 const calls=[];const api=integration(async(url,options)=>{
  const u=new URL(url);calls.push(u.pathname);assert.equal(u.host,'graph.facebook.com');assert.equal(options.redirect,'error');
  const data=u.pathname.endsWith('/oauth/access_token')?{access_token:'synthetic'}:u.pathname.endsWith('/debug_token')?{data:{is_valid:true,type:'SYSTEM_USER',app_id:env.INSTAGRAM_APP_ID,scopes:[...UNIFIED_SCOPES]}}:u.pathname.endsWith('/assigned_instagram_accounts')?{data:[{id:'12345678',username:'fanmind.crm'}]}:{id:'system-user',client_business_id:'87654321'};
  return Response.json(data);
 });
 const url=new URL(api.getInstagramOAuthUrl('signed',['ads_read']));assert.equal(url.host,'www.facebook.com');assert.equal(url.searchParams.get('config_id'),env.INSTAGRAM_UNIFIED_CONFIG_ID);assert.equal(url.searchParams.has('scope'),false);
 const token=await api.exchangeInstagramCode('synthetic-code');assert.equal(token.userId,'12345678');assert.equal(token.businessId,'87654321');assert.equal(calls.length,4);
 assert.equal((await api.exchangeInstagramLongLivedToken(token)).accessToken,'synthetic');assert.equal(calls.length,4);
 const stored=api.instagramStoredToken(token);assert.equal(api.unwrapInstagramCredential(stored,'12345678'),'synthetic');assert.throws(()=>api.unwrapInstagramCredential(stored,'foreign'));
});
test('actual subscription refuses another app readback despite successful POST',async()=>{
 let posts=0;const api=integration(async(url,options)=>{if(options?.method==='POST'){posts++;return Response.json({success:true});}return Response.json({data:[{id:'foreign',subscribed_fields:['messages','comments']}]});});
 assert.equal(await api.subscribeInstagramAccount('12345678','synthetic','instagram_messages'),false);assert.equal(posts,1);
});
test('actual subscription confirms both exact-app fields after POST',async()=>{
 let posts=0;const api=integration(async(url,options)=>{if(options?.method==='POST'){posts++;return Response.json({success:true});}assert.equal(new URL(url).searchParams.has('fields'),false);return Response.json({data:posts?[{id:env.INSTAGRAM_APP_ID,subscribed_fields:['messages','comments']}]:[]});});
 assert.equal(await api.subscribeInstagramAccount('12345678','synthetic','instagram_messages'),true);assert.equal(posts,1);
});
test('Unified subscription failures retain only phase, HTTP status and bounded numeric provider code',async()=>{
 for(const [phase,status,code,expected] of [['get',400,100,'100'],['post',403,200,'200'],['post',400,'PRIVATE_TOKEN','none'],['get',400,1000000,'none']]) {
  const api=integration(async(url,options)=>{
   if(phase==='post'&&options.method!=='POST')return Response.json({data:[]});
   return Response.json({error:{code,message:'PRIVATE_TOKEN PRIVATE_BODY',type:'PRIVATE_TYPE',access_token:'PRIVATE_TOKEN'}},{status});
  });
  await assert.rejects(api.subscribeInstagramAccount('12345678','synthetic','instagram_messages'),error=>{
   assert.equal(error.message,`instagram_subscription_${phase}_http_${status}_code_${expected}`);assert.doesNotMatch(error.message,/PRIVATE/u);return true;
  });
 }
});
test('protected Instagram configuration preserves all Facebook/Operator/Billing/encryption and rejects conflicts',()=>{
 const before='FACEBOOK_APP_ID=1547928503809961\nFACEBOOK_APP_SECRET='+ 'a'.repeat(32)+'\nFANMIND_TOKEN_ENCRYPTION_KEY=unchanged\nBILLING_STATE=preserve\n';
 const after=renderInstagramUnifiedConfiguration(before,[],'2150411132228815');assert.ok(after.startsWith(before));assert.match(after,/INSTAGRAM_LOGIN_MODE="unified"/u);assert.equal(renderInstagramUnifiedConfiguration(after,[],'2150411132228815'),after);
 assert.throws(()=>renderInstagramUnifiedConfiguration(before,[],'wrong'));assert.throws(()=>renderInstagramUnifiedConfiguration(before+'INSTAGRAM_APP_ID=foreign\n',[],'2150411132228815'));assert.throws(()=>renderInstagramUnifiedConfiguration(before,['INSTAGRAM_APP_SECRET=foreign\n'],'2150411132228815'));
});
test('App Instagram registration preserves existing Facebook object and requires exact active readback',async()=>{
 let writes=0;const page={object:'page',active:true,callback_url:'https://staging.fanmind.ch/api/webhooks/meta',fields:[{name:'messages'},{name:'feed'}]};
 const values={FACEBOOK_APP_ID:env.FACEBOOK_APP_ID,FACEBOOK_APP_SECRET:env.FACEBOOK_APP_SECRET,FACEBOOK_WEBHOOK_VERIFY_TOKEN:'v'.repeat(40),INSTAGRAM_APP_ID:env.INSTAGRAM_APP_ID,INSTAGRAM_APP_SECRET:env.INSTAGRAM_APP_SECRET,INSTAGRAM_LOGIN_MODE:'unified'};
 const request=async(url,options)=>{if(options.method==='POST'){writes++;assert.equal(options.body.get('object'),'instagram');assert.equal(options.body.get('fields'),'messages,comments');return Response.json({success:true});}return Response.json({data:[page,...(writes?[{object:'instagram',active:true,callback_url:page.callback_url,fields:[{name:'messages'},{name:'comments'}]}]:[])]});};
 await subscribeStagingMetaWebhook(values,env.FACEBOOK_APP_ID,request,'instagram');assert.equal(writes,1);
 await subscribeStagingMetaWebhook(values,env.FACEBOOK_APP_ID,request,'page');assert.equal(writes,1);
});
