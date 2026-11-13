import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

import * as paging from '../src/lib/facebookGraphPagingPolicy.mjs';
import * as conversationPaging from '../src/lib/metaConversationPaginationPolicy.mjs';
import * as selection from '../src/lib/facebookPageSelectionPolicy.mjs';
import * as providerError from '../src/lib/metaProviderErrorPolicy.mjs';
import * as runtime from '../src/lib/metaRuntimeConfigPolicy.mjs';
import * as crypto from 'node:crypto';
const app = '123456789012345';
const scopes = load('src/lib/facebookScopes.ts', {});
const required = [...scopes.FACEBOOK_MESSAGES_OAUTH_SCOPES];
const diagnostics = { app_id: app, is_valid: true, scopes: required, granular_scopes: required.map(scope => ({ scope, target_ids: ['11', '22'] })) };
function load(path, dependencies, extra = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, { exports, URL, AbortSignal, Buffer, Date, console: { info(){}, warn(){}, error(){} }, process: { env: { FACEBOOK_APP_ID: app, FACEBOOK_APP_SECRET: '0123456789abcdef0123456789abcdef' } }, require(name) { assert.ok(name in dependencies, name); return dependencies[name]; }, ...extra });
  return exports;
}
function harness(respond, extra = {}) {
  const calls = [];
  const api = load('src/lib/facebookIntegration.ts', {
    '@/lib/facebookScopes': scopes, '@/lib/metaIntegrationPolicy.mjs': { META_GRAPH_API_VERSION: 'v25.0' }, '@/lib/facebookGraphPagingPolicy.mjs': paging,
    '@/lib/metaConversationPaginationPolicy.mjs': conversationPaging, '@/lib/facebookPageSelectionPolicy.mjs': selection, '@/lib/metaProviderErrorPolicy.mjs': providerError,
    '@/lib/metaRuntimeConfigPolicy.mjs': runtime, 'node:crypto': crypto,
  }, { fetch: async (url, options) => { calls.push(String(url)); options?.signal?.throwIfAborted(); const result = await respond(new URL(url), options); return { ok: !result.error, status: result.error ? 403 : 200, json: async () => result }; }, ...extra });
  return { api, calls };
}
const row = (id, token = `token-${id}`) => ({ id, name: `Page ${id}`, access_token: token, tasks: ['MESSAGING'] });
const next = after => `https://graph.facebook.com/v25.0/123/accounts?after=${after}&access_token=never-forward`;
function responder({ edge = [row('11')], field = [], debug = diagnostics, direct = {} } = {}) {
  return url => {
    if (url.pathname.endsWith('/debug_token')) return { data: debug };
    if (url.pathname.endsWith('/me/accounts')) return { data: edge };
    if (url.pathname.endsWith('/me')) return { accounts: { data: field } };
    return direct[url.pathname.split('/').at(-1)] ?? { error: { code: 10 } };
  };
}
test('non-empty primary is supplemented, deduplicated, and retains usable tokens; tasks are not OAuth scopes', async () => {
  const h = harness(responder({ field: [row('11', null), row('22')] }));
  const pages = await h.api.fetchFacebookPages('user');
  assert.deepEqual(Array.from(pages, p=>p.id), ['11','22']);
  assert.equal(pages[0].accessToken, 'token-11');
  assert.equal(pages[0].scopes.includes('MESSAGING'), false);
});
test('both accounts methods exhaust pagination on the trusted edge using the original token', async () => {
  for (const nested of [false, true]) {
    const h = harness(url => {
      if (url.pathname.endsWith('/debug_token')) return { data: { ...diagnostics, granular_scopes: [] } };
      if (url.searchParams.get('after')) { assert.equal(url.searchParams.get('access_token'),'user'); return { data: [row('22')] }; }
      if (url.pathname.endsWith('/me')) return { accounts: { data: nested ? [row('11')] : [], ...(nested ? { paging: { next: next('cursor') } } : {}) } };
      return { data: nested ? [] : [row('11')], ...(!nested ? { paging: { next: next('cursor') } } : {}) };
    });
    assert.deepEqual(Array.from(await h.api.fetchFacebookPages('user'),p=>p.id),['11','22']);
    assert.ok(h.calls.every(url=>!url.includes('never-forward')));
  }
});
test('granular targets are a union, never inferred from names or supplied IDs; invalid app tokens cannot add targets', async () => {
  const debug = { ...diagnostics, granular_scopes: [{ scope:'pages_show_list',target_ids:['11','22'] }, {scope:'pages_messaging',target_ids:['11']} ] };
  const h = harness(responder({debug, direct: {'22':row('22')}}));
  assert.deepEqual(Array.from(await h.api.fetchFacebookPages('user'),p=>p.id), ['11','22']);
  for (const invalid of [{...debug,is_valid:false},{...debug,app_id:'other'}]) {
    const bad = harness(responder({debug:invalid, direct:{'22':row('22')}}));
    assert.equal((await bad.api.fetchFacebookPages('user')).length,1);
    assert.ok(!bad.calls.some(url=>url.includes('/22?')));
  }
});
test('pagination errors, unsafe paths, loops and request exhaustion cannot silently return partial success', async () => {
  for (const kind of ['foreign','path','loop','exhaust','failure']) {
    const h = harness(url => {
      if (kind==='failure' && url.searchParams.get('after')) return {error:{code:10}};
      const continuation = kind==='foreign' ? 'https://evil.invalid/steal?after=x' : kind==='path' ? 'https://graph.facebook.com/v25.0/22/feed?after=x' : next(kind==='exhaust' ? `cursor${url.searchParams.get('after')??''}x` : 'same');
      return {data:[row('11')],paging:{next:continuation}};
    });
    await assert.rejects(h.api.fetchFacebookPages('user'));
    assert.ok(h.calls.length<=10);
    assert.ok(h.calls.every(url=>new URL(url).hostname==='graph.facebook.com'));
  }
});
test('missing tokens remain visibly unavailable and granular ID mismatches cannot substitute another page', async () => {
  const h = harness(responder({edge:[row('11',null)],direct:{'22':row('33')}}));
  const pages=await h.api.fetchFacebookPages('user');
  assert.equal(pages.length,1); assert.equal(pages[0].accessToken,null);
});
test('per-page authorization fails closed for invalid, missing, foreign-app, missing-scope or different-target grants', () => {
  const {api}=harness(responder());
  assert.equal(api.hasFacebookPageAuthorization(diagnostics,'22',required),true);
  for(const debug of [null,{...diagnostics,is_valid:false},{...diagnostics,app_id:'other'},{...diagnostics,scopes:[],granular_scopes:[]},{...diagnostics,granular_scopes:[{scope:'pages_messaging',target_ids:['11']}]}]) {
    assert.equal(api.hasFacebookPageAuthorization(debug,'22',required),false);
  }
  assert.equal(api.hasRequiredFacebookPagePermissions(null),false);
});

test('Staging source exception accepts only the exact manually reviewed task branch and preserves runtime settings', async () => {
  const {isReviewedStagingSourceAllowed: allowed}=await import('../scripts/operations/staging-reviewed-source-policy.mjs');
  const env={GITHUB_REPOSITORY:'FanMind/FanMind',GITHUB_REF:'refs/heads/fix/facebook-page-discovery-staging',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_SHA:'a'.repeat(40),REVIEWED_RELEASE_COMMIT:'a'.repeat(40),BILLING_WRITE_FREEZE:'preserve'};
  assert.equal(allowed(env),true);
  for (const override of [{GITHUB_REPOSITORY:'attacker/FanMind'},{GITHUB_REF:'refs/heads/other'},{GITHUB_EVENT_NAME:'push'},{REVIEWED_RELEASE_COMMIT:''},{REVIEWED_RELEASE_COMMIT:'b'.repeat(40)},{BILLING_WRITE_FREEZE:'false'},{FANMIND_STAGING_RELEASE_RECOVERY_CONFIRM:'recover-live-staging-release-state'}]) assert.equal(allowed({...env,...override}),false);
  assert.equal(allowed({...env,GITHUB_REF:'refs/heads/main',REVIEWED_RELEASE_COMMIT:''}),true);
  const operator = {...env,GITHUB_REF:'refs/heads/feat/1464-staging-agent-access',STAGING_OPERATOR_SESSION_ENABLED:'true'};
  assert.equal(allowed(operator),true);
  for (const override of [{GITHUB_REPOSITORY:'attacker/FanMind'},{GITHUB_REF:'refs/heads/main'}, {GITHUB_REF:'refs/heads/feat/1464-staging-agent-access-extra'},{GITHUB_EVENT_NAME:'push'},{REVIEWED_RELEASE_COMMIT:''},{REVIEWED_RELEASE_COMMIT:'b'.repeat(40)},{BILLING_WRITE_FREEZE:'false'},{FANMIND_STAGING_RELEASE_RECOVERY_CONFIRM:'recover-live-staging-release-state'},{FANMIND_STAGING_RELEASE_RECOVERY_PREVIOUS_COMMIT:'b'.repeat(40)}]) assert.equal(allowed({...operator,...override}),false);
  assert.equal(allowed({...env,STAGING_OPERATOR_SESSION_ENABLED:'true'}),false);
});

test('Page token must resolve to the exact selected Page identity before persistence', async () => {
  for (const [payload, expected] of [[{id:'22'},true],[{id:'11'},false],[{error:{code:190}},false],[{},false]]) {
    const h=harness(()=>payload);
    assert.equal(await h.api.verifyFacebookPageTokenIdentity('page-token','22'),expected);
    assert.equal(new URL(h.calls[0]).searchParams.get('fields'),'id');
  }
});

test('real selection route rejects foreign user/Workspace and expired pending state before any provider or persistence call', async () => {
  for (const pending of [null,{userId:'foreign',workspaceId:'workspace-1'},{userId:'user-1',workspaceId:'foreign'}]) {
    let calls=0;
    const response = () => ({cookies:{set(){} }});
    const route=load('src/app/api/integrations/facebook/select/route.ts',{
      'next/cache':{revalidatePath(){}},'next/server':{NextResponse:{redirect:response,json:response}},
      '@/lib/demoMode':{areDemoConnectionsDisabled:()=>false},
      '@/lib/facebookConnectionFlow':{completeFacebookOAuthConnection:async()=>{calls++;return {ok:true}}},
      '@/lib/facebookIntegration':{verifyPendingFacebookPageSelection:()=>pending},
      '@/lib/facebookPageSelectionPolicy.mjs':selection,
      '@/lib/httpMutationPolicy.mjs':{isTrustedFanMindMutationRequest:()=>true},
      '@/lib/metaIntegrationPolicy.mjs':{canManageMetaConnections:()=>true},
      '@/lib/supabase/server':{getSupabaseServerUser:async()=>({data:{user:{id:'user-1'}}})},
      '@/lib/workspaceAuthorization':{requireActiveAuthorizedWorkspace:async()=>({user:{id:'user-1'},workspace:{id:'workspace-1',role:'owner'}})},
    });
    await route.POST({url:'https://staging.fanmind.ch/api/integrations/facebook/select',nextUrl:{protocol:'https:'},cookies:{get:()=>({value:'encrypted'})},formData:async()=>{calls++;throw new Error('must not read form');}});
    assert.equal(calls,0);
  }
});

test('Staging connection imports only its saved Page and leaves shared-app subscriptions unchanged', async()=>{
  const calls=[];
  const integration={
    fetchFacebookGrantedPermissions:async()=>[],fetchFacebookTokenDiagnostics:async()=>diagnostics,getGrantedFacebookPermissionNames:()=>required,
    getFacebookGrantedScopeNames:()=>required,hasRequiredFacebookPagePermissions:()=>true,hasFacebookPageAuthorization:()=>true,
    verifyFacebookPageTokenIdentity:async()=>true,fetchFacebookPages:async()=>[{id:'22',name:'Page',accessToken:'token',scopes:[]}],
    isTokenEncryptionConfigured:()=>true,encryptToken:()=> 'encrypted',tokenLastFour:()=> 'fake',FACEBOOK_PAGE_MESSENGER_WEBHOOK_FIELDS:['messages'],
    subscribeFacebookPage:async()=>{calls.push('subscribe');},
  };
  const flow=load('src/lib/facebookConnectionFlow.ts',{
    '@/lib/facebookScopes':scopes,'@/lib/facebookIntegration':integration,
    '@/lib/metaInitialImport':{runMetaInitialImport:async connection=>{calls.push(['import',connection.workspace_id,connection.page_id]);return 'complete';}},
    '@/lib/supabase/server':{upsertFacebookSocialConnection:async input=>({connection:{id:'saved',workspace_id:input.workspaceId,page_id:input.pageId}}),updateFacebookWebhookSubscribed:async()=>{calls.push('webhook-save');}},
  },{process:{env:{FANMIND_RUNTIME_ENVIRONMENT:'staging'}}});
  assert.equal((await flow.completeFacebookOAuthConnection({workspaceId:'workspace-1',connectedBy:'user-1',connectionType:'facebook_messages',userAccessToken:'user',selectedPageId:'22'})).ok,true);
  assert.deepEqual(calls,[['import','workspace-1','22']]);
});

test('host diagnostics emit only fixed discovery labels and numeric/boolean counts',async()=>{
  const {summarizeFacebookDiscoveryLogs:summarize}=await import('../scripts/operations/staging-facebook-discovery-diagnostics.mjs');
  const log="private token\nFacebook /me/accounts pages diagnostics {\n httpStatus: 200,\n pageCount: 1,\n pagesMissingAccessToken: 0,\n token: 'SECRET',\n pageId: 999\n}\nFacebook direct page fetch diagnostics { hasPage: false, errorCode: 10, message: 'private text' }";
  assert.deepEqual(summarize(log),[{label:'Facebook /me/accounts pages diagnostics',counts:{httpStatus:200,pageCount:1,pagesMissingAccessToken:0}},{label:'Facebook direct page fetch diagnostics',counts:{hasPage:false,errorCode:10}}]);
  assert.doesNotMatch(JSON.stringify(summarize(log)),/SECRET|999|private/u);
});

test('discovery shares one deadline across sources and probes only absent or tokenless granular targets',async()=>{
  const signals=[];
  const base=responder({edge:[row('11')],field:[row('22')],debug:{...diagnostics,granular_scopes:[{scope:'pages_show_list',target_ids:['11','22','33']}]},direct:{'33':row('33')}});
  const h=harness((url,options)=>{signals.push(options.signal);return base(url);});
  assert.equal((await h.api.fetchFacebookPages('user')).length,3);
  assert.equal(new Set(signals).size,1);
  assert.ok(h.calls.some(url=>new URL(url).pathname.endsWith('/33')));
  assert.ok(h.calls.every(url=>!['/v25.0/11','/v25.0/22'].includes(new URL(url).pathname)));
});
test('expired shared deadline aborts discovery instead of persisting or returning a partial list',async()=>{
  const controller=new AbortController();
  const h=harness(()=>{controller.abort();return {data:[row('11')]};},{AbortSignal:{timeout:()=>controller.signal}});
  await assert.rejects(h.api.fetchFacebookPages('user'));
  assert.equal(h.calls.length,2);
});

test('discovery failures expose only endpoint, fixed category and bounded numeric codes',async()=>{
  const h=harness(url=>url.pathname.endsWith('/me/accounts')?{data:[row('11')]}:{error:{code:100,message:'private token message'}});
  await assert.rejects(h.api.fetchFacebookPages('secret-user-token'),error=>{
    assert.equal(error.diagnostic,'page_discovery_accounts_field_http_403_100');
    assert.doesNotMatch(error.diagnostic,/secret|private|message/u);return true;
  });
  const malformed=harness(()=>({id:'user'}));
  await assert.rejects(malformed.api.fetchFacebookPages('user'),error=>error.diagnostic==='page_discovery_accounts_edge_shape_200_0');
  const e=new h.api.FacebookPageDiscoveryError('accounts_edge','http',NaN,Infinity);
  assert.equal(e.diagnostic,'page_discovery_accounts_edge_http_0_0');
});

test('a valid user with omitted expanded accounts is empty, then only real granular targets recover Pages',async()=>{
  const base=responder({edge:[],debug:{...diagnostics,granular_scopes:[{scope:'pages_show_list',target_ids:['22']}]},direct:{'22':row('22')}});
  const h=harness(url=>url.pathname.endsWith('/me')?{id:'12345'}:base(url));
  assert.deepEqual(Array.from(await h.api.fetchFacebookPages('user'),p=>p.id),['22']);
  assert.ok(h.calls.every(url=>!new URL(url).pathname.endsWith('/11')));
});
test('null, missing-identity and malformed expanded accounts remain errors, never implicit authorization',async()=>{
  for(const invalid of [{},{id:'not-a-user'},{id:'12345',accounts:null},{id:'12345',accounts:{}},{id:'12345',accounts:{data:'private malformed'}}]){
    const h=harness(url=>url.pathname.endsWith('/me/accounts')?{data:[]}:invalid);
    await assert.rejects(h.api.fetchFacebookPages('user'),e=>e.diagnostic==='page_discovery_accounts_field_shape_200_0');
  }
});
test('empty lists distinguish unreadable real granular targets from missing granular authorization without disclosing text or IDs',async()=>{
  const denied=harness(responder({edge:[],field:[],debug:diagnostics}));
  await assert.rejects(denied.api.fetchFacebookPages('user'),e=>e.diagnostic==='page_discovery_granular_page_http_403_10');
  const noTargets=harness(responder({edge:[],field:[],debug:{...diagnostics,granular_scopes:[]}}));
  await assert.rejects(noTargets.api.fetchFacebookPages('user'),e=>e.diagnostic==='page_discovery_granular_targets_shape_0_0');
  const invalidToken=harness(responder({edge:[],field:[],debug:{...diagnostics,is_valid:false}}));
  await assert.rejects(invalidToken.api.fetchFacebookPages('user'),e=>e.diagnostic==='page_discovery_token_debug_shape_0_0');
});

test('comment collection distinguishes a valid empty feed from malformed HTTP 200 and provider errors', async () => {
  const empty = harness(() => ({ data: [] }));
  assert.equal((await empty.api.fetchFacebookPagePostsWithComments('11', 'page-token')).comments.length, 0);
  for (const body of [null, {}, { data: null }, { data: {} }, { data: [null] }, { data: [{ id: 22 }] }, { data: [], error: { code: 190, message: 'private-provider-text' } }, { data: [{ id: '11_22', comments: {} }] }]) {
    const h = harness(() => body, { fetch: async () => ({ ok: true, json: async () => body }) });
    await assert.rejects(h.api.fetchFacebookPagePostsWithComments('11', 'page-token'), error => {
      assert.equal(error.name, 'FacebookCommentFetchError');
      assert.equal(error.message.includes('private-provider-text'), false);
      return true;
    });
  }
});

test('comment feed and nested pagination share a deadline and preserve the original post mapping', async () => {
  const signals = [];
  const h = harness((url, options) => {
    signals.push(options.signal);
    assert.equal(options.redirect, 'error');
    if (url.pathname.endsWith('/feed')) return { data: [{ id: '11_22', comments: { data: [{ id: '22_1', message: 'synthetic one' }], paging: { next: 'https://graph.facebook.com/v25.0/11_22/comments?after=next' } } }] };
    return { data: [{ id: '22_2', message: 'synthetic two' }] };
  });
  const result = await h.api.fetchFacebookPagePostsWithComments('11', 'page-token');
  assert.deepEqual(Array.from(result.comments, c => [c.id, c.postId]), [['22_1','11_22'], ['22_2','11_22']]);
  assert.equal(signals.length, 2);
  assert.equal(signals[0], signals[1]);
});

test('comment pagination rejects foreign targets, wrong edges, loops and unbounded empty pages', async () => {
  for (const nextUrl of ['https://attacker.invalid/v25.0/11/feed', 'https://graph.facebook.com/v25.0/other/feed']) {
    const h = harness(() => ({ data: [], paging: { next: nextUrl } }));
    await assert.rejects(h.api.fetchFacebookPagePostsWithComments('11', 'page-token'));
    assert.equal(h.calls.length, 1);
  }
  for (const loop of [true, false]) {
    let count = 0;
    const h = harness(() => ({ data: [], paging: { next: `https://graph.facebook.com/v25.0/11/feed?after=${loop ? 'same' : ++count}` } }));
    await assert.rejects(h.api.fetchFacebookPagePostsWithComments('11', 'page-token'));
    assert.ok(h.calls.length <= 100);
  }
  const h = harness(() => ({ data: [{ id: '11_22', comments: { data: [], paging: { next: 'https://graph.facebook.com/v25.0/foreign/comments' } } }] }));
  await assert.rejects(h.api.fetchFacebookPagePostsWithComments('11', 'page-token'));
  assert.equal(h.calls.length, 1);
});

test('comment UI action authorizes afresh and serializes only server-derived outcome fields', async () => {
  let authorized = false;
  let calls = 0;
  const result = { ok: true, fetchedAt: '2026-11-13T08:00:00.000Z', postsChecked: 2, commentsChecked: 3, importedCount: 1, continuationPending: true, error: 'private provider text', tokenScopes: ['private'], access_token: 'synthetic-token', workspaceId: 'other' };
  const actions = load('src/app/channels/metaSyncActions.ts', {
    './facebookWebhookActions': { fetchFacebookCommentsNow: async () => { assert.equal(authorized, true); calls++; return result; } },
    './instagramWebhookActions': {},
    '@/lib/workspaceAuthorization': { requireActiveAuthorizedWorkspace: async () => { if (!authorized) throw new Error('denied'); } },
  });
  await assert.rejects(actions.syncFacebookCommentsFromChannelPage(result), /denied/u);
  assert.equal(calls, 0);
  authorized = true;
  const actual = await actions.syncFacebookCommentsFromChannelPage({ ok: false, workspaceId: 'client-controlled', postsChecked: 999 });
  assert.deepEqual(Object.keys(actual).sort(), ['ok', 'fetchedAt', 'postsChecked', 'commentsChecked', 'importedCount', 'continuationPending'].sort());
  assert.equal(actual.postsChecked, 2);
  assert.equal(JSON.stringify(actual).includes('private'), false);
  assert.equal(calls, 1);
});


test('inbound Messenger readiness does not require optional outbound echoes; feed alone is insufficient', async () => {
  for (const [fields, ready] of [[['messages','feed'],true],[['messages'],true],[['feed'],false], [[],false]]) {
    const h=harness(()=>({data:[{id:app,subscribed_fields:fields}]}));
    const status=await h.api.fetchFacebookPageWebhookStatus('11','synthetic-token');
    assert.equal(status.ok,ready);assert.equal(status.fields.message_echoes,'missing');
  }
});
test('explicit Messenger subscription requests only inbound messages and preserves existing feed', async () => {
  let posted;
  const h=harness((url,options)=>{
    if(options?.method==='POST'){posted=url.searchParams.get('subscribed_fields');return {success:true};}
    return {data:[{id:app,subscribed_fields:posted?.split(',')??['feed']}]};
  });
  const status=await h.api.subscribeFacebookPage('11','synthetic-token');
  assert.equal(status.ok,true);assert.deepEqual(posted.split(',').sort(),['feed','messages']);
});
