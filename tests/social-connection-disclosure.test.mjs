import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { buildSupabaseApiKeyHeaders } from '../src/lib/supabase/apiKeyPolicy.mjs';

const workspace='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const row={workspace_id:workspace,provider:'x',external_account_id:'synthetic-account',display_name:'Synthetic Creator',expires_at:'2026-09-12T12:00:00Z',connected_at:'2026-09-11T12:00:00Z'};

function load(path,deps,env={}) {
  const exports={};
  const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  runInNewContext(code,{exports,URL,Request,Response,AbortSignal,Buffer,TextDecoder,process:{env},require:name=>{assert.ok(Object.hasOwn(deps,name),name);return deps[name]}});
  return exports;
}

function protectedConnectionHarness({denied=false,foreign=false,member=false,revoked=false,status=200,data=[row],key='sb_secret_synthetic',network=false}={}) {
  const calls=[];let authorizations=0;let unavailableCount=0;
  const deps={
    'server-only':{},
    '@/lib/workspaceAuthorization':{requireAuthorizedWorkspace:async token=>{assert.equal(token,'synthetic-user-jwt');authorizations++;if(denied||(revoked&&authorizations>1))throw Error('unauthorized');return{user:{id:'owner'},workspace:{id:foreign?'other':workspace,owner_user_id:member?'different':'owner'}};}},
    '@/lib/supabase/config':{getSupabaseApiKeyHeaders:buildSupabaseApiKeyHeaders,getSupabaseRestUrl:table=>`https://stagingref.supabase.co/rest/v1/${table}`},
    '@/lib/dataDisclosurePagination':{DataDisclosureExportError:class extends Error{}},
  };
  const run=load('src/lib/socialConnectionDisclosure.ts',deps,{SUPABASE_SERVICE_ROLE_KEY:key}).getSocialConnectionMetadataForDisclosure;
  const fetchImpl=async(url,options)=>{calls.push({url,options});if(network)throw Error('private backend text');return new Response(JSON.stringify(data),{status})};
  return{calls,run:(capture=true)=>run(workspace,'synthetic-user-jwt',fetchImpl,capture?()=>{unavailableCount++;}:undefined),authorizations:()=>authorizations,unavailableCount:()=>unavailableCount};
}

test('protected provider metadata never exposes connection credentials',async()=>{
  for(const key of ['sb_secret_synthetic','eyJ.synthetic.service']) {
    const h=protectedConnectionHarness({key,data:[{...row,encrypted_token:'NEVER_EXPORT',refresh_token:'NEVER_EXPORT',revision:'internal'}]});
    const result=JSON.parse(JSON.stringify(await h.run()));
    assert.deepEqual(result,[row]);assert.equal(h.authorizations(),2);
    const {url,options}=h.calls[0];
    assert.equal(url.searchParams.get('workspace_id'),`eq.${workspace}`);
    assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');
  }
});

test('protected provider metadata remains owner-only and fail-closed',async()=>{
  for(const options of [{denied:true},{foreign:true},{member:true},{key:''}]) {
    const h=protectedConnectionHarness(options);await assert.rejects(h.run());assert.equal(h.calls.length,0);
  }
  const revoked=protectedConnectionHarness({revoked:true});await assert.rejects(revoked.run());assert.equal(revoked.calls.length,1);
});

class DisclosureFailure extends Error {}
const jsonResponse=(data,status=200)=>new Response(JSON.stringify(data),{status});

const expectedTables=[
  'workspaces','contacts','memories','followups','conversations','conversation_messages',
  'conversation_summaries','contact_reply_targets','fan_analysis_reports','contact_ai_profiles',
  'workspace_voice_profiles','workspace_ai_prompt_settings','ai_usage_events','social_connections','meta_webhook_events',
];

function collectorFixture(override=()=>undefined,token='synthetic-user-jwt') {
  const calls=[];
  const config={
    SUPABASE_ACCESS_TOKEN_COOKIE:'cookie',
    getSupabaseHeaders:value=>({Authorization:`Bearer ${value}`}),
    getSupabaseRestUrl:table=>`https://synthetic.invalid/rest/v1/${table}`,
  };
  const collector=load('src/lib/dataDisclosureMetaExport.ts',{
    'next/headers':{cookies:async()=>({get:()=>token?{value:token}:undefined})},
    '@/lib/supabase/config':config,
    '@/lib/dataDisclosurePagination':{DataDisclosureExportError:DisclosureFailure},
  }).getWorkspaceMetaDataForDisclosure;
  const fetchImpl=async(url,options)=>{
    const table=url.pathname.split('/').at(-1);
    const offset=Number(url.searchParams.get('offset')||0);
    calls.push({table,offset,url,options});
    assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error');
    assert.equal(options.headers.Authorization,'Bearer synthetic-user-jwt');
    const filter=table==='workspaces'?'id':'workspace_id';
    assert.equal(url.searchParams.get(filter),`eq.${workspace}`);
    return (await override({table,offset,url,options,calls})) ?? jsonResponse([]);
  };
  return{calls,run:(id=workspace)=>collector(id,fetchImpl)};
}

test('complete disclosure enumerates every active Creator/Workspace data family',async()=>{
  const h=collectorFixture();
  const result=await h.run();
  assert.deepEqual(h.calls.map(x=>x.table).sort(),[...expectedTables].sort());
  assert.equal(result.length,expectedTables.length);
  assert.ok(result.every(dataset=>Array.isArray(dataset.rows)));
  const messages=h.calls.find(x=>x.table==='conversation_messages');
  assert.ok(messages);assert.equal(messages.url.searchParams.get('source_platform'),null,'all channels must be exported');
});

test('workspace and social rows keep user data but strip credentials and Stripe provider identifiers',async()=>{
  const h=collectorFixture(({table})=>{
    if(table==='workspaces') return jsonResponse([{id:workspace,name:'Creator workspace',workspace_id:'SHOULD_NOT_MATTER',billing_status:'active',stripe_customer_id:'cus_secret',stripe_subscription_id:'sub_secret',api_key:'NEVER'}]);
    if(table==='social_connections') return jsonResponse([{id:'connection-1',workspace_id:workspace,platform:'instagram',page_name:'Creator page',page_access_token_encrypted:'NEVER',token_last_four:'1234',refresh_token:'NEVER'}]);
  });
  const result=await h.run();
  const workspaceRow=result.find(x=>x.key==='workspace_record').rows[0];
  assert.equal(workspaceRow.name,'Creator workspace');assert.equal(workspaceRow.billing_status,'active');
  assert.equal(workspaceRow.stripe_customer_id,undefined);assert.equal(workspaceRow.stripe_subscription_id,undefined);assert.equal(workspaceRow.api_key,undefined);
  const social=result.find(x=>x.key==='connections').rows[0];
  assert.equal(social.page_name,'Creator page');assert.equal(social.page_access_token_encrypted,undefined);assert.equal(social.token_last_four,undefined);assert.equal(social.refresh_token,undefined);
});

test('all stored fields of active CRM rows are preserved instead of using narrow projections',async()=>{
  const h=collectorFixture(({table})=>table==='memories'?jsonResponse([{id:'memory-1',workspace_id:workspace,contact_id:'fan-1',content:'PRESERVE_MEMORY',importance:'high',future_safe_field:'PRESERVE_FUTURE'}]):undefined);
  const data=(await h.run()).find(x=>x.key==='memories').rows[0];
  assert.equal(data.content,'PRESERVE_MEMORY');assert.equal(data.future_safe_field,'PRESERVE_FUTURE');
  assert.equal(h.calls.find(x=>x.table==='memories').url.searchParams.get('select'),'*');
});

test('missing, denied, malformed or foreign active data aborts the complete export',async()=>{
  for(const response of [
    ()=>jsonResponse({code:'PGRST205'},404),
    ()=>jsonResponse({code:'42501'},403),
    ()=>new Response('invalid-json',{status:200}),
    ()=>jsonResponse({}),
    ()=>jsonResponse([{id:'x',workspace_id:'foreign'}]),
    ()=>{throw Error('PRIVATE_NETWORK_DETAIL')},
  ]) {
    const h=collectorFixture(({table})=>table==='memories'?response():undefined);
    await assert.rejects(h.run(),DisclosureFailure);
  }
});

test('pagination preserves every active record and a later-page failure aborts instead of truncating',async()=>{
  const rows=Array.from({length:501},(_,index)=>({id:`memory-${index}`,workspace_id:workspace,content:`PRESERVE-${index}`}));
  const h=collectorFixture(({table,offset})=>table==='memories'?jsonResponse(rows.slice(offset,offset+500)):undefined);
  const data=(await h.run()).find(x=>x.key==='memories');
  assert.equal(data.rows.length,501);assert.equal(data.rows[500].content,'PRESERVE-500');
  const broken=collectorFixture(({table,offset})=>table==='memories'?(offset?jsonResponse({code:'PGRST002'},500):jsonResponse(rows.slice(0,500))):undefined);
  await assert.rejects(broken.run(),DisclosureFailure);
});

test('missing session or workspace never reaches a data endpoint',async()=>{
  for(const [id,token] of [[workspace,''],['','synthetic-user-jwt']]) {
    const h=collectorFixture(undefined,token);await assert.rejects(h.run(id),DisclosureFailure);assert.equal(h.calls.length,0);
  }
});

function routeFixture({datasets=[],failAt,anonymous=false,noWorkspace=false,knownFailure=false}={}) {
  let input,pdfCalls=0;
  const maybeFail=stage=>{if(failAt===stage)throw(knownFailure?new DisclosureFailure('PRIVATE_RAW_ERROR content_sources <script>'):Error('PRIVATE_RAW_ERROR font token'));};
  class TestNextResponse extends Response {static redirect(url){return new TestNextResponse(null,{status:307,headers:{Location:String(url)}})}}
  const pdf=load('src/lib/dataDisclosurePdf.ts',{'pdfnative':{}});
  const route=load('src/app/settings/profile/data-export/route.ts',{
    'next/server':{NextResponse:TestNextResponse},
    '@/lib/dashboardFeatures':{getCommercialOptionLabel:()=> 'Existing plan'},
    '@/lib/dataDisclosureExport':{DataDisclosureExportError:DisclosureFailure,getAllWorkspaceContactsForDisclosure:async()=>{maybeFail('contacts');return[{display_name:'Synthetic contact',summary:'PRESERVE_CONTACT'}]}},
    '@/lib/dataDisclosureMetaExport':{getWorkspaceMetaDataForDisclosure:async()=>{maybeFail('datasets');return datasets;}},
    '@/lib/supabase/server':{
      getSupabaseServerUser:async()=>{maybeFail('auth');return{data:{user:anonymous?null:{id:'synthetic-owner',email:'owner@example.invalid',user_metadata:{display_name:'Synthetic Creator',phone:'+43 1 234',role_audience:'Creator',preferred_plan:'starter'}}}}},
      getUserWorkspaceDashboard:async()=>{maybeFail('workspace');return{workspace:noWorkspace?null:{id:workspace,name:'Synthetic workspace',role:'owner',plan_id:'starter',commercial_option:'starter_no_setup_commitment',setup_fee_cents:0,monthly_fee_cents:31200,commitment_months:12}}},
    },
    '@/lib/dataDisclosurePdf':{createDataDisclosurePdf:async value=>{input=value;pdfCalls++;maybeFail('pdf');return Buffer.from('%PDF-1.7\nSYNTHETIC_TRANSPORT_ONLY')}},
  });
  return{run:(lang='de')=>route.GET(new Request(`https://fanmind.invalid/settings/profile/data-export?lang=${lang}`)),input:()=>input,pdfCalls:()=>pdfCalls,lines:()=>pdf.buildDataDisclosurePdfLines(input)};
}

test('successful disclosure is explicitly complete and includes account metadata plus every collected data section',async()=>{
  const datasets=[
    {key:'workspace_record',rows:[{id:workspace,name:'Synthetic workspace',billing_status:'active'}]},
    {key:'memories',rows:[{id:'m1',workspace_id:workspace,content:'PRESERVE_MEMORY'}]},
    {key:'messages',rows:[{id:'msg1',workspace_id:workspace,source_platform:'x',content:'PRESERVE_X_MESSAGE'}]},
  ];
  const h=routeFixture({datasets});const response=await h.run('de');
  assert.equal(response.status,200);assert.equal(response.headers.get('X-FanMind-Disclosure-Status'),'complete');
  assert.match(response.headers.get('Content-Disposition'),/fanmind-datenauskunft\.pdf/);
  assert.doesNotMatch(response.headers.get('Content-Disposition'),/teilweise|partial/i);
  const lines=h.lines().join('\n');
  assert.match(lines,/Kontoprofil und gespeicherte Präferenzen/);assert.match(lines,/phone: \+43 1 234/);assert.match(lines,/workspace_role: owner/);
  assert.match(lines,/Workspace-, Vertrags- und Abrechnungsdaten/);assert.match(lines,/PRESERVE_MEMORY/);assert.match(lines,/PRESERVE_X_MESSAGE/);
  assert.doesNotMatch(lines,/Vollständigkeit nicht bestätigt|Teilauskunft/);
});

for(const locale of ['de','en']) for(const stage of ['auth','workspace','contacts','datasets','pdf']) {
  test(`${locale} ${stage} failure renders a safe actionable page and never returns an incomplete PDF`,async()=>{
    const h=routeFixture({failAt:stage,knownFailure:stage==='datasets'});const response=await h.run(locale);const html=await response.text();
    assert.equal(response.status,stage==='datasets'?409:500);
    assert.equal(response.headers.get('Content-Type'),'text/html; charset=utf-8');
    assert.equal(response.headers.get('Cache-Control'),'private, no-store');
    assert.equal(response.headers.get('Referrer-Policy'),'no-referrer');
    assert.match(response.headers.get('Content-Security-Policy'),/default-src 'none'/);
    assert.match(html,new RegExp(`<html lang="${locale}">`));
    assert.match(html,locale==='en'?/Try again/:/Erneut versuchen/);assert.match(html,locale==='en'?/Back to profile/:/Zurück zum Profil/);
    assert.match(html,locale==='en'?/complete data disclosure/i:/vollständige Datenauskunft/i);
    assert.doesNotMatch(html,/PRIVATE_RAW_ERROR|content_sources|<script|owner@example|SYNTHETIC_TRANSPORT/iu);
    assert.equal(h.pdfCalls(),stage==='pdf'?1:0);
  });
}

test('missing workspace is helpful and anonymous access still redirects to login',async()=>{
  const h=routeFixture({noWorkspace:true});const response=await h.run();assert.equal(response.status,404);assert.match(await response.text(),/Zurück zum Profil/);assert.equal(h.pdfCalls(),0);
  const anonymous=routeFixture({anonymous:true});const redirect=await anonymous.run();assert.equal(redirect.status,307);assert.equal(redirect.headers.get('Location'),'https://fanmind.invalid/login');assert.equal(redirect.headers.get('Cache-Control'),'private, no-store');assert.equal(anonymous.pdfCalls(),0);
});

test('untrusted locale is never reflected in error HTML or retry links',async()=>{
  for(const tag of ['script','SCRIPT','ScRiPt']) {
    const h=routeFixture({failAt:'datasets'});const response=await h.run(encodeURIComponent(`en"><${tag}>ATTACK</${tag}>`));const html=await response.text();
    assert.match(html,/<html lang="de">/);assert.doesNotMatch(html,/ATTACK|<script/iu);
  }
});

for(const locale of ['de','en']) {
  test(`real PDF ${locale} preserves complete Creator data across pages without a partial marker`,async()=>{
    const {mkdtemp,writeFile,rm}=await import('node:fs/promises');
    const {join}=await import('node:path');const {pathToFileURL}=await import('node:url');
    const {extractText,initNodeDecompression_parser}=await import('pdfnative');
    await initNodeDecompression_parser();
    const temp=await mkdtemp(join(process.cwd(),'.disclosure-1129-'));
    try {
      const output=ts.transpileModule(readFileSync('src/lib/dataDisclosurePdf.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
      const file=join(temp,'pdf.mjs');await writeFile(file,output);const engine=await import(pathToFileURL(file).href);
      const h=routeFixture({datasets:[{key:'memories',rows:[{workspace_id:workspace,id:'memory-1',content:'PRESERVE_MEMORY'}]},{key:'messages',rows:[{workspace_id:workspace,id:'msg-1',content:'PRESERVE_MESSAGE'}]}]});
      await h.run(locale);const input=h.input();input.contacts=Array.from({length:60},(_,i)=>({displayName:`Synthetic contact ${i+1}`,summary:`PRESERVED-${i+1}`}));
      const pdf=await engine.createDataDisclosurePdf(input);assert.equal(Buffer.from(pdf).subarray(0,5).toString(),'%PDF-');
      const pages=extractText(pdf),text=pages.map(p=>p.text).join('\n');
      assert.match(text,/PRESERVED-60/);assert.match(text,/PRESERVE_MEMORY/);assert.match(text,/PRESERVE_MESSAGE/);
      assert.doesNotMatch(text,/Completeness not confirmed|Vollständigkeit nicht bestätigt|Partial export|Teilauskunft/);
      assert.ok(pages.length>1);
    } finally {await rm(temp,{recursive:true,force:true})}
  });
}
