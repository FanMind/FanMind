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
test('optional table unavailability requires an explicit notice; denied, malformed and failed reads remain errors',async()=>{
 for(const code of ['42P01','PGRST205']) {
  const data={code,message:code==='PGRST205'?"Could not find the table 'public.social_provider_connections' in the schema cache":'relation "public.social_provider_connections" does not exist'};
  const h=harness({status:404,data});assert.equal((await h.run()).length,0);assert.equal(h.unavailableCount(),1);assert.equal(h.authorizations(),2);
  await assert.rejects(harness({status:404,data}).run(false));
  await assert.rejects(harness({status:404,data,revoked:true}).run());
 }
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

// #1129 regressions live in this existing, CI-registered disclosure suite.
class DisclosureFailure extends Error {}
const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), {status});
const tableUnavailable = (table, code = 'PGRST205') => jsonResponse({code, message: code === 'PGRST205'
  ? `Could not find the table 'public.${table}' in the schema cache`
  : `relation "public.${table}" does not exist`}, 404);
const optionalTables = new Set(['content_sources','content_metric_snapshots','workspace_analysis_settings',
  'communication_analysis_reports','creators','creator_voice_profiles','creator_sales_playbooks',
  'creator_commercial_events','social_provider_connections']);

function collectorFixture(override = () => undefined, token = 'synthetic-user-jwt') {
  const calls = [];
  const config = {
    SUPABASE_ACCESS_TOKEN_COOKIE: 'cookie',
    getSupabaseHeaders: value => ({Authorization:`Bearer ${value}`}),
    getSupabaseApiKeyHeaders: buildSupabaseApiKeyHeaders,
    getSupabaseRestUrl: table => `https://synthetic.invalid/rest/v1/${table}`,
  };
  const errors = {DataDisclosureExportError: DisclosureFailure};
  const social = load('src/lib/socialConnectionDisclosure.ts', {
    'server-only': {}, '@/lib/supabase/config': config,
    '@/lib/dataDisclosurePagination': errors,
    '@/lib/workspaceAuthorization': {requireAuthorizedWorkspace: async () => ({
      user:{id:'synthetic-owner'},workspace:{id:workspace,owner_user_id:'synthetic-owner'},
    })},
  }, {SUPABASE_SERVICE_ROLE_KEY:'sb_secret_synthetic'});
  const collector = load('src/lib/dataDisclosureMetaExport.ts', {
    'next/headers':{cookies:async()=>({get:()=>({value:token})})},
    '@/lib/supabase/config':config, '@/lib/dataDisclosurePagination':errors,
    '@/lib/socialConnectionDisclosure':social,
  }).getWorkspaceMetaDataForDisclosure;
  const fetchImpl = async (url, options) => {
    const table = url.pathname.split('/').at(-1);
    const offset = Number(url.searchParams.get('offset') || 0);
    calls.push({table,offset,url,options});
    assert.equal(url.searchParams.get('workspace_id'),`eq.${workspace}`);
    assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error');
    if(table!=='social_provider_connections') assert.equal(options.headers.Authorization,'Bearer synthetic-user-jwt');
    return (await override({table,offset,url,options,calls})) ?? jsonResponse([]);
  };
  return {calls,run:(id=workspace)=>collector(id,fetchImpl)};
}

test('uninstalled optional modules produce explicit unavailable sections, not zero-record claims', async () => {
  const h=collectorFixture(({table})=>optionalTables.has(table)?tableUnavailable(table):undefined);
  const result=await h.run();
  assert.equal(result.length,14);
  assert.equal(result.filter(x=>x.unavailable).length,9);
  assert.equal(result.find(x=>x.key==='content').unavailable,true);
  assert.equal(result.find(x=>x.key==='social_provider_connections').unavailable,true);
  assert.equal(result.find(x=>x.key==='messages').unavailable,undefined);
  assert.equal(h.calls.length,14,'no repeated probe may turn a genuine failure into an empty dataset');
});

test('existing empty optional modules are read successfully without an unavailable marker',async()=>{
  const result=await collectorFixture().run();
  assert.ok(result.every(x=>x.rows.length===0 && !x.unavailable));
});

for(const table of ['social_connections','conversation_messages','fan_analysis_reports','contact_ai_profiles','workspace_voice_profiles']) {
  test(`required table ${table} remains fail closed when unavailable`,async()=>{
    await assert.rejects(collectorFixture(x=>x.table===table?tableUnavailable(table):undefined).run(),DisclosureFailure);
  });
}

for(const [label,status,data] of [
  ['generic 404',404,{message:'not found'}],['code without table binding',404,{code:'PGRST205'}],
  ['unrelated relation',404,{code:'42P01',message:'relation "private_table" does not exist'}],
  ['unrelated cache entry',404,{code:'PGRST205',message:"Could not find the table 'public.other' in the schema cache"}],
  ['unauthenticated',401,{code:'PGRST301'}],['forbidden',403,{code:'42501'}],
  ['server error',500,{code:'PGRST002',message:'schema cache unavailable'}],
  ['missing column',400,{code:'42703',message:'column does not exist'}],
  ['missing column cache',400,{code:'PGRST204',message:'Could not find column'}],
]) {
  test(`optional content ${label} is not suppressed`,async()=>{
    const h=collectorFixture(({table})=>table==='content_sources'?jsonResponse(data,status):undefined);
    await assert.rejects(h.run(),DisclosureFailure);
  });
}

test('a known legacy column projection can succeed, but is never confused with a missing table',async()=>{
  const h=collectorFixture(({table,url})=> table==='content_sources' && url.searchParams.get('select').includes('social_connection_id')
    ? jsonResponse({code:'42703',message:'column does not exist'},400) : undefined);
  const result=await h.run();assert.equal(result.find(x=>x.key==='content').unavailable,undefined);
  assert.equal(h.calls.filter(x=>x.table==='content_sources').length,2);
});

test('network and malformed responses fail without retries or loss of stored rows',async()=>{
  for(const response of [()=>{throw Error('PRIVATE_NETWORK_DETAIL');},()=>new Response('<html>not found</html>',{status:404}),
    ()=>new Response('invalid-json',{status:200}),()=>jsonResponse({}),()=>jsonResponse([null]),
    ()=>jsonResponse([{workspace_id:'other'}])]) {
    const h=collectorFixture(({table})=>table==='content_sources'?response():undefined);
    await assert.rejects(h.run(),DisclosureFailure);
    assert.equal(h.calls.filter(x=>x.table==='content_sources').length,1);
  }
});

test('a transient denied read cannot be replaced by a later missing-table probe',async()=>{
  let n=0;
  const h=collectorFixture(({table})=>table==='content_sources'?(++n===1?jsonResponse({code:'42501'},403):tableUnavailable(table)):undefined);
  await assert.rejects(h.run(),DisclosureFailure);assert.equal(n,1);
});

test('all 501 records survive pagination; losing a later page still aborts the export',async()=>{
  const rows=Array.from({length:501},(_,index)=>({id:`record-${index}`,workspace_id:workspace,title:`Synthetic post ${index}`}));
  const h=collectorFixture(({table,offset})=>table==='content_sources'?jsonResponse(rows.slice(offset,offset+500)):undefined);
  const data=(await h.run()).find(x=>x.key==='content');assert.equal(data.rows.length,501);assert.equal(data.rows[500].id,'record-500');
  for(const fail of [()=>tableUnavailable('content_sources'),()=>jsonResponse({code:'42501'},403),()=>jsonResponse([{workspace_id:'foreign'}])]) {
    const broken=collectorFixture(({table,offset})=>table==='content_sources'?(offset?fail():jsonResponse(rows.slice(0,500))):undefined);
    await assert.rejects(broken.run(),DisclosureFailure);
  }
});

test('missing session or workspace never reaches any data endpoint',async()=>{
  for(const [id,token] of [[workspace,''],['','synthetic-user-jwt']]) {
    const h=collectorFixture(undefined,token);await assert.rejects(h.run(id),DisclosureFailure);assert.equal(h.calls.length,0);
  }
});

function routeFixture({datasets=[],failAt,anonymous=false,noWorkspace=false,knownFailure=false}={}) {
  let input, pdfCalls=0;
  const maybeFail=(stage)=>{if(failAt===stage)throw (knownFailure?new DisclosureFailure('PRIVATE_RAW_ERROR content_sources <script>'):Error('PRIVATE_RAW_ERROR font token'));};
  class TestNextResponse extends Response {
    static redirect(url) {return new TestNextResponse(null,{status:307,headers:{Location:String(url)}});}
  }
  const pdf=load('src/lib/dataDisclosurePdf.ts',{'pdfnative':{}});
  const route=load('src/app/settings/profile/data-export/route.ts',{
    'next/server':{NextResponse:TestNextResponse},
    '@/lib/dashboardFeatures':{getCommercialOptionLabel:()=> 'Existing plan'},
    '@/lib/dataDisclosureExport':{DataDisclosureExportError:DisclosureFailure,getAllWorkspaceContactsForDisclosure:async()=>{
      maybeFail('contacts');return[{display_name:'Synthetic contact',summary:'PRESERVE_CONTACT'}];}},
    '@/lib/dataDisclosureMetaExport':{getWorkspaceMetaDataForDisclosure:async()=>{maybeFail('datasets');return datasets;}},
    '@/lib/supabase/server':{
      getSupabaseServerUser:async()=>{maybeFail('auth');return{data:{user:anonymous?null:{id:'synthetic-owner',email:'owner@example.invalid'}}};},
      getUserWorkspaceDashboard:async()=>{maybeFail('workspace');return{workspace:noWorkspace?null:{id:workspace,name:'Synthetic workspace'}};},
    },
    '@/lib/dataDisclosurePdf':{createDataDisclosurePdf:async value=>{
      input=value;pdfCalls++;maybeFail('pdf');return Buffer.from('%PDF-1.7\nSYNTHETIC_TRANSPORT_ONLY');}},
  });
  return {run:(lang='de')=>route.GET(new Request(`https://fanmind.invalid/settings/profile/data-export?lang=${lang}`)),
    input:()=>input, pdfCalls:()=>pdfCalls, lines:()=>pdf.buildDataDisclosurePdfLines(input)};
}

for(const locale of ['de','en']) {
  test(`localized ${locale} PDF transport preserves data and marks unavailable categories before account content`,async()=>{
    const h=routeFixture({datasets:[{key:'content',rows:[],unavailable:true},{key:'fan_reports',rows:[{workspace_id:workspace,summary:'PRESERVE_REPORT'}]}]});
    const response=await h.run(locale);
    assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'application/pdf');
    assert.match(response.headers.get('Content-Disposition'),new RegExp(locale==='en'?'partial\\.pdf':'teilweise\\.pdf'));
    assert.equal(response.headers.get('X-FanMind-Disclosure-Status'),'partial');
    assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');
    const lines=h.lines(), joined=lines.join('\n');
    assert.match(lines[0],locale==='en'?/Partial export/:/Teilauskunft/);
    assert.ok(lines.indexOf(locale==='en'?'Completeness not confirmed':'Vollständigkeit nicht bestätigt')<lines.indexOf(locale==='en'?'Account':'Konto'));
    assert.match(joined,/PRESERVE_CONTACT/);assert.match(joined,/PRESERVE_REPORT/);
    const missing=lines.indexOf(locale==='en'?'Owned post and media cache':'Eigener Post-/Medien-Cache');
    assert.match(lines[missing+1],locale==='en'?/^Not included:/:/^Nicht enthalten:/);
    assert.doesNotMatch(lines[missing+1],/^(Stored records|Gespeicherte Datensätze): 0/);
    assert.doesNotMatch(joined,/content_sources|PGRST205|PRIVATE_RAW_ERROR/);
  });
}

test('readable empty datasets keep normal PDF filename and genuine zero-record result',async()=>{
  const h=routeFixture({datasets:[{key:'content',rows:[]}]});const response=await h.run('en');
  assert.match(response.headers.get('Content-Disposition'),/fanmind-data-disclosure\.pdf/);
  assert.equal(response.headers.get('X-FanMind-Disclosure-Status'),'available-data');
  assert.match(h.lines().join('\n'),/Stored records: 0/);assert.doesNotMatch(h.lines().join('\n'),/Completeness not confirmed/);
});

for(const locale of ['de','en']) for(const stage of ['auth','workspace','contacts','datasets','pdf']) {
  test(`${locale} ${stage} failure renders a safe actionable page, never raw diagnostics`,async()=>{
    const h=routeFixture({failAt:stage,knownFailure:stage==='datasets'});const response=await h.run(locale);const html=await response.text();
    assert.equal(response.status,stage==='datasets'?409:500);
    assert.equal(response.headers.get('Content-Type'),'text/html; charset=utf-8');
    assert.equal(response.headers.get('Cache-Control'),'private, no-store');
    assert.equal(response.headers.get('Referrer-Policy'),'no-referrer');
    assert.match(response.headers.get('Content-Security-Policy'),/default-src 'none'/);
    assert.match(html,new RegExp(`<html lang="${locale}">`));
    assert.match(html,locale==='en'?/Try again/:/Erneut versuchen/);assert.match(html,locale==='en'?/Back to profile/:/Zurück zum Profil/);
    assert.match(html,new RegExp(`/settings/profile/data-export\\?lang=${locale}`));
    assert.doesNotMatch(html,/PRIVATE_RAW_ERROR|content_sources|<script|owner@example|SYNTHETIC_TRANSPORT/);
    assert.equal(h.pdfCalls(),stage==='pdf'?1:0);
  });
}

test('missing workspace has the same helpful non-cached page and anonymous access still redirects to login',async()=>{
  const h=routeFixture({noWorkspace:true});const response=await h.run();assert.equal(response.status,404);assert.match(await response.text(),/Zurück zum Profil/);assert.equal(h.pdfCalls(),0);
  const anonymous=routeFixture({anonymous:true});const redirect=await anonymous.run();assert.equal(redirect.status,307);assert.equal(redirect.headers.get('Location'),'https://fanmind.invalid/login');assert.equal(redirect.headers.get('Cache-Control'),'private, no-store');assert.equal(anonymous.pdfCalls(),0);
});

test('untrusted locale query is never reflected in error HTML or retry links',async()=>{
  const h=routeFixture({failAt:'datasets'});const response=await h.run(encodeURIComponent('en"><script>ATTACK</script>'));
  const html=await response.text();assert.match(html,/<html lang="de">/);assert.doesNotMatch(html,/ATTACK|<script>/);
});

// These tests run with the repository's real PDF engine in normal CI. They are
// not gated on environment flags and never call Supabase or an external provider.
for(const locale of ['de','en']) {
  test(`real PDF ${locale} contains the completeness warning on page one and preserves all records`,async()=>{
    const {mkdtemp,writeFile,rm}=await import('node:fs/promises');
    const {join}=await import('node:path');const {pathToFileURL}=await import('node:url');
    const {extractText,initNodeDecompression_parser}=await import('pdfnative');
    await initNodeDecompression_parser();
    const temp=await mkdtemp(join(process.cwd(),'.disclosure-1129-'));
    try {
      const output=ts.transpileModule(readFileSync('src/lib/dataDisclosurePdf.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
      const file=join(temp,'pdf.mjs');await writeFile(file,output);
      const engine=await import(pathToFileURL(file).href);
      const h=routeFixture({datasets:[{key:'content',rows:[],unavailable:true},{key:'fan_reports',rows:[{workspace_id:workspace,summary:'PRESERVE_REPORT'}]}]});
      await h.run(locale);
      const input=h.input();input.contacts=Array.from({length:60},(_,i)=>({displayName:`Synthetic contact ${i+1}`,summary:`PRESERVED-${i+1}`}));
      const pdf=await engine.createDataDisclosurePdf(input);
      assert.equal(Buffer.from(pdf).subarray(0,5).toString(),'%PDF-');
      const pages=extractText(pdf),text=pages.map(p=>p.text).join('\n');
      assert.match(pages[0].text,locale==='en'?/Completeness not confirmed/:/Vollständigkeit nicht bestätigt/);
      assert.match(text,/PRESERVED-60/);assert.match(text,/PRESERVE_REPORT/);
      assert.match(text,locale==='en'?/Not included:/:/Nicht enthalten:/);
      assert.doesNotMatch(text,/content_sources|PGRST205/);
      assert.ok(pages.length>1);
    } finally {await rm(temp,{recursive:true,force:true});}
  });
}
