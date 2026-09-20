import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { buildSupabaseApiKeyHeaders } from '../src/lib/supabase/apiKeyPolicy.mjs';

const workspace='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userId='synthetic-owner';
const email='owner@example.invalid';
const row={workspace_id:workspace,provider:'x',external_account_id:'synthetic-account',display_name:'Synthetic Creator',expires_at:'2026-09-12T12:00:00Z',connected_at:'2026-09-11T12:00:00Z'};

function load(path,deps,env={}) {
  const exports={};
  const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  runInNewContext(code,{exports,URL,Request,Response,AbortSignal,Buffer,TextDecoder,process:{env},require:name=>{assert.ok(Object.hasOwn(deps,name),name);return deps[name]}});
  return exports;
}

class DisclosureFailure extends Error {}
const jsonResponse=(data,status=200)=>new Response(JSON.stringify(data),{status});

function protectedConnectionHarness({denied=false,foreign=false,member=false,revoked=false,status=200,data=[row],key='sb_secret_synthetic',network=false}={}) {
  const calls=[];let authorizations=0;
  const deps={
    'server-only':{},
    '@/lib/workspaceAuthorization':{requireAuthorizedWorkspace:async token=>{assert.equal(token,'synthetic-user-jwt');authorizations++;if(denied||(revoked&&authorizations>1))throw Error('unauthorized');return{user:{id:'owner'},workspace:{id:foreign?'other':workspace,owner_user_id:member?'different':'owner'}};}},
    '@/lib/supabase/config':{getSupabaseApiKeyHeaders:buildSupabaseApiKeyHeaders,getSupabaseRestUrl:table=>`https://stagingref.supabase.co/rest/v1/${table}`},
    '@/lib/dataDisclosurePagination':{DataDisclosureExportError:DisclosureFailure},
  };
  const run=load('src/lib/socialConnectionDisclosure.ts',deps,{SUPABASE_SERVICE_ROLE_KEY:key}).getSocialConnectionMetadataForDisclosure;
  const fetchImpl=async(url,options)=>{calls.push({url,options});if(network)throw Error('private backend text');return jsonResponse(data,status)};
  return{calls,run:()=>run(workspace,'synthetic-user-jwt',fetchImpl),authorizations:()=>authorizations};
}

test('protected provider metadata never exposes connection credentials',async()=>{
  for(const key of ['sb_secret_synthetic','eyJ.synthetic.service']) {
    const h=protectedConnectionHarness({key,data:[{...row,encrypted_token:'NEVER_EXPORT',refresh_token:'NEVER_EXPORT',revision:'internal'}]});
    const result=JSON.parse(JSON.stringify(await h.run()));
    assert.deepEqual(result,[row]);assert.equal(h.authorizations(),2);
    assert.equal(h.calls[0].url.searchParams.get('workspace_id'),`eq.${workspace}`);
    assert.equal(h.calls[0].options.redirect,'error');assert.equal(h.calls[0].options.cache,'no-store');
  }
});

test('protected provider metadata remains owner-only and fail-closed',async()=>{
  for(const options of [{denied:true},{foreign:true},{member:true},{key:''}]) {
    const h=protectedConnectionHarness(options);await assert.rejects(h.run());assert.equal(h.calls.length,0);
  }
  const revoked=protectedConnectionHarness({revoked:true});await assert.rejects(revoked.run());assert.equal(revoked.calls.length,1);
});

const expectedTables=[
  'profiles','workspace_members','workspaces','contacts','memories','followups','conversations',
  'conversation_messages','conversation_summaries','contact_reply_targets','fan_analysis_reports',
  'contact_ai_profiles','workspace_voice_profiles','ai_usage_events','social_connections','meta_webhook_events',
  'content_sources','content_metric_snapshots','communication_analysis_reports','workspace_analysis_settings',
  'creators','creator_voice_profiles','creator_sales_playbooks','creator_commercial_events',
  'workspace_chat_admin_capabilities','chat_characters','chat_character_conversations','chat_character_messages',
];

function collectorFixture(override=()=>undefined,token='synthetic-user-jwt') {
  const calls=[];
  const config={SUPABASE_ACCESS_TOKEN_COOKIE:'cookie',getSupabaseHeaders:value=>({Authorization:`Bearer ${value}`}),getSupabaseRestUrl:table=>`https://synthetic.invalid/rest/v1/${table}`};
  const collector=load('src/lib/dataDisclosureMetaExport.ts',{
    'next/headers':{cookies:async()=>({get:()=>token?{value:token}:undefined})},
    '@/lib/supabase/config':config,
    '@/lib/dataDisclosurePagination':{DataDisclosureExportError:DisclosureFailure},
  }).getWorkspaceMetaDataForDisclosure;
  const fetchImpl=async(url,options)=>{
    const table=url.pathname.split('/').at(-1);const offset=Number(url.searchParams.get('offset')||0);calls.push({table,offset,url,options});
    assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer synthetic-user-jwt');
    if(table==='profiles') {
      assert.equal(url.searchParams.get('id'),`eq.${userId}`);assert.equal(url.searchParams.get('workspace_id'),null);
    } else if(table==='workspace_members') {
      assert.equal(url.searchParams.get('workspace_id'),`eq.${workspace}`);assert.equal(url.searchParams.get('user_id'),`eq.${userId}`);
    } else if(table==='workspaces') {
      assert.equal(url.searchParams.get('id'),`eq.${workspace}`);assert.equal(url.searchParams.get('workspace_id'),null);
    } else assert.equal(url.searchParams.get('workspace_id'),`eq.${workspace}`);
    return (await override({table,offset,url,options,calls})) ?? jsonResponse([]);
  };
  return{calls,run:(id=workspace,uid=userId)=>collector(id,uid,fetchImpl)};
}

test('complete disclosure enumerates every browser-readable Production Creator data family',async()=>{
  const h=collectorFixture();const result=await h.run();
  assert.deepEqual(h.calls.map(x=>x.table).sort(),[...expectedTables].sort());assert.equal(result.length,expectedTables.length);
  assert.equal(h.calls.find(x=>x.table==='conversation_messages').url.searchParams.get('source_platform'),null,'all channels must be exported');
  assert.ok(!h.calls.some(x=>x.table==='workspace_ai_prompt_settings'),'a table absent from current Production must not be invented as stored data');
});

test('profile, membership, workspace and social rows remain Creator-bound and credentials are stripped',async()=>{
  const h=collectorFixture(({table})=>{
    if(table==='profiles') return jsonResponse([{id:userId,email,display_name:'Creator',phone:'+43 1 234'}]);
    if(table==='workspace_members') return jsonResponse([{id:'membership-1',workspace_id:workspace,user_id:userId,role:'owner',created_at:'2026-09-01T00:00:00Z'}]);
    if(table==='workspaces') return jsonResponse([{id:workspace,name:'Creator workspace',billing_status:'active',stripe_customer_id:'cus_secret',api_key:'NEVER'}]);
    if(table==='social_connections') return jsonResponse([{id:'connection-1',workspace_id:workspace,platform:'instagram',page_name:'Creator page',page_access_token_encrypted:'NEVER',token_last_four:'1234',refresh_token:'NEVER'}]);
  });
  const result=await h.run();assert.equal(result.find(x=>x.key==='profile_record').rows[0].phone,'+43 1 234');assert.equal(result.find(x=>x.key==='membership_record').rows[0].role,'owner');
  const ws=result.find(x=>x.key==='workspace_record').rows[0];assert.equal(ws.name,'Creator workspace');assert.equal(ws.billing_status,'active');assert.equal(ws.stripe_customer_id,undefined);assert.equal(ws.api_key,undefined);
  const social=result.find(x=>x.key==='connections').rows[0];assert.equal(social.page_name,'Creator page');assert.equal(social.page_access_token_encrypted,undefined);assert.equal(social.token_last_four,undefined);assert.equal(social.refresh_token,undefined);
});

test('safe current and future CRM fields are preserved instead of narrow projections',async()=>{
  const h=collectorFixture(({table})=>table==='memories'?jsonResponse([{id:'memory-1',workspace_id:workspace,content:'PRESERVE_MEMORY',future_safe_field:'PRESERVE_FUTURE'}]):undefined);
  const data=(await h.run()).find(x=>x.key==='memories').rows[0];assert.equal(data.content,'PRESERVE_MEMORY');assert.equal(data.future_safe_field,'PRESERVE_FUTURE');assert.equal(h.calls.find(x=>x.table==='memories').url.searchParams.get('select'),'*');
});

test('foreign identity/workspace rows and failed active reads abort the complete export',async()=>{
  const foreignCases=[
    ['profiles',()=>jsonResponse([{id:'foreign-user'}])],
    ['workspace_members',()=>jsonResponse([{id:'membership-1',workspace_id:workspace,user_id:'foreign-user'}])],
    ['workspaces',()=>jsonResponse([{id:'foreign-workspace'}])],
    ['memories',()=>jsonResponse([{id:'memory-1',workspace_id:'foreign-workspace'}])],
  ];
  for(const [target,response] of foreignCases) await assert.rejects(collectorFixture(({table})=>table===target?response():undefined).run(),DisclosureFailure);
  for(const response of [()=>jsonResponse({code:'PGRST205'},404),()=>jsonResponse({code:'42501'},403),()=>new Response('invalid-json',{status:200}),()=>jsonResponse({}),()=>{throw Error('PRIVATE_NETWORK_DETAIL')}]) {
    await assert.rejects(collectorFixture(({table})=>table==='memories'?response():undefined).run(),DisclosureFailure);
  }
});

test('pagination preserves every active record and later-page failure aborts instead of truncating',async()=>{
  const rows=Array.from({length:501},(_,index)=>({id:`memory-${index}`,workspace_id:workspace,content:`PRESERVE-${index}`}));
  const h=collectorFixture(({table,offset})=>table==='memories'?jsonResponse(rows.slice(offset,offset+500)):undefined);const data=(await h.run()).find(x=>x.key==='memories');assert.equal(data.rows.length,501);assert.equal(data.rows[500].content,'PRESERVE-500');
  await assert.rejects(collectorFixture(({table,offset})=>table==='memories'?(offset?jsonResponse({code:'PGRST002'},500):jsonResponse(rows.slice(0,500))):undefined).run(),DisclosureFailure);
});

test('missing session, workspace or user identity never reaches browser-readable endpoints',async()=>{
  for(const [id,uid,token] of [[workspace,userId,''],['',userId,'synthetic-user-jwt'],[workspace,'','synthetic-user-jwt']]) {
    const h=collectorFixture(undefined,token);await assert.rejects(h.run(id,uid),DisclosureFailure);assert.equal(h.calls.length,0);
  }
});

function privateFixture({member=false,foreign=false,key='sb_secret_synthetic',override=()=>undefined}={}) {
  const calls=[];let auths=0;
  const config={SUPABASE_ACCESS_TOKEN_COOKIE:'cookie',getSupabaseApiKeyHeaders:buildSupabaseApiKeyHeaders,getSupabaseRestUrl:table=>`https://synthetic.invalid/rest/v1/${table}`};
  const run=load('src/lib/dataDisclosurePrivateExport.ts',{
    'server-only':{},
    'next/headers':{cookies:async()=>({get:()=>({value:'synthetic-user-jwt'})})},
    '@/lib/supabase/config':config,
    '@/lib/workspaceAuthorization':{requireAuthorizedWorkspace:async token=>{assert.equal(token,'synthetic-user-jwt');auths++;return{user:{id:foreign?'foreign':userId},workspace:{id:workspace,owner_user_id:member?'different':userId}};}},
    '@/lib/dataDisclosurePagination':{DataDisclosureExportError:DisclosureFailure},
  },{SUPABASE_SERVICE_ROLE_KEY:key}).getPrivateAccountDataForDisclosure;
  const fetchImpl=async(url,options)=>{
    const table=url.pathname.split('/').at(-1);const offset=Number(url.searchParams.get('offset')||0);calls.push({table,offset,url,options});assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error');
    if(table==='pilot_inquiries') return (await override({table,url,offset})) ?? jsonResponse([{id:'p1',email,name:'Old inquiry',message:'Hello'}]);
    if(table==='referral_program_members') return (await override({table,url,offset})) ?? jsonResponse([{id:'rm1',workspace_id:workspace,user_id:userId,referral_code:'OWNCODE',eligible:true,status:'active'}]);
    if(table==='referrals') {
      const given=url.searchParams.get('referrer_workspace_id')!==null;
      return (await override({table,url,offset,given})) ?? (given
        ? jsonResponse([{id:'r1',referrer_workspace_id:workspace,referrer_user_id:userId,referred_workspace_id:'other-workspace',referred_user_id:'other-user',referral_code:'OWNCODE',status:'active'}])
        : jsonResponse([{id:'r2',referrer_workspace_id:'other-workspace',referrer_user_id:'other-user',referred_workspace_id:workspace,referred_user_id:userId,referral_code:'OTHER',status:'active'}]));
    }
    if(table==='referral_discount_snapshots') return (await override({table,url,offset})) ?? jsonResponse([{id:'rd1',workspace_id:workspace,discount_percent:5}]);
    if(table==='account_deletion_requests') return (await override({table,url,offset})) ?? jsonResponse([{id:'d1',workspace_id:workspace,user_id:userId,notification_email:email,status:'pending'}]);
    return (await override({table,url,offset})) ?? jsonResponse([]);
  };
  return{calls,auths:()=>auths,run:()=>run(workspace,userId,email,fetchImpl)};
}

test('owner-only service data includes own inquiry/referral/deletion records but strips counterparty identifiers',async()=>{
  const h=privateFixture();const result=await h.run();assert.equal(h.auths(),2);
  assert.deepEqual(h.calls.map(x=>x.table).sort(),['account_deletion_requests','pilot_inquiries','referral_discount_snapshots','referral_program_members','referrals','referrals'].sort());
  const given=result.find(x=>x.key==='referrals_given').rows[0];const received=result.find(x=>x.key==='referrals_received').rows[0];
  assert.equal(given.relationship_role,'referrer');assert.equal(received.relationship_role,'referred');
  for(const item of [given,received]) {
    assert.equal(item.referrer_user_id,undefined);assert.equal(item.referred_user_id,undefined);assert.equal(item.referrer_workspace_id,undefined);assert.equal(item.referred_workspace_id,undefined);
  }
  assert.equal(result.find(x=>x.key==='pilot_inquiries').rows[0].email,email);
  assert.equal(result.find(x=>x.key==='account_deletion_requests').rows[0].notification_email,email);
});

test('private service reader rejects member/foreign identity, missing service key and out-of-scope rows',async()=>{
  for(const options of [{member:true},{foreign:true},{key:''}]) {const h=privateFixture(options);await assert.rejects(h.run(),DisclosureFailure);assert.equal(h.calls.length,0)}
  const foreignRow=privateFixture({override:({table})=>table==='referral_discount_snapshots'?jsonResponse([{id:'x',workspace_id:'foreign'}]):undefined});
  await assert.rejects(foreignRow.run(),DisclosureFailure);
});

function routeFixture({datasets=[],privateDatasets=[],failAt,authReadError=false,anonymous=false,noWorkspace=false,member=false,knownFailure=false}={}) {
  let input,pdfCalls=0,collectorArgs,privateArgs;
  const maybeFail=stage=>{if(failAt===stage)throw(knownFailure?new DisclosureFailure('PRIVATE_RAW_ERROR content_sources <script>'):Error('PRIVATE_RAW_ERROR font token'));};
  class TestNextResponse extends Response {static redirect(url){return new TestNextResponse(null,{status:307,headers:{Location:String(url)}})}}
  const pdf=load('src/lib/dataDisclosurePdf.ts',{'pdfnative':{}});
  const route=load('src/app/settings/profile/data-export/route.ts',{
    'next/server':{NextResponse:TestNextResponse},
    '@/lib/dashboardFeatures':{getCommercialOptionLabel:()=> 'Existing plan'},
    '@/lib/dataDisclosureExport':{DataDisclosureExportError:DisclosureFailure,getAllWorkspaceContactsForDisclosure:async()=>{maybeFail('contacts');return[{display_name:'Synthetic contact',summary:'PRESERVE_CONTACT'}]}},
    '@/lib/dataDisclosureMetaExport':{getWorkspaceMetaDataForDisclosure:async(...args)=>{collectorArgs=args;maybeFail('datasets');return datasets;}},
    '@/lib/dataDisclosurePrivateExport':{getPrivateAccountDataForDisclosure:async(...args)=>{privateArgs=args;maybeFail('private');return privateDatasets;}},
    '@/lib/dataDisclosureAuthProjection':{projectAuthAccountForDisclosure:()=>({created_at:'2026-01-01T00:00:00Z',providers:['email'],identities:[]})},
    '@/lib/supabase/server':{
      getSupabaseServerUser:async()=>{maybeFail('auth');return{data:{user:anonymous?null:{id:userId,email,user_metadata:{display_name:'Synthetic Creator',phone:'+43 1 234',role_audience:'Creator',preferred_plan:'starter',provider_token:'NEVER_EXPORT_PROVIDER',nested:{refresh_token:'NEVER_EXPORT_REFRESH',safe:'PRESERVE_SAFE'}}}},error:authReadError?{message:'PRIVATE_AUTH_ERROR'}:null}},
      getUserWorkspaceDashboard:async()=>{maybeFail('workspace');return{workspace:noWorkspace?null:{id:workspace,name:'Synthetic workspace',owner_user_id:member?'different':userId,role:member?'member':'owner',plan_id:'starter',commercial_option:'starter_no_setup_commitment',setup_fee_cents:0,monthly_fee_cents:31200,commitment_months:12}}},
    },
    '@/lib/dataDisclosurePdf':{createDataDisclosurePdf:async value=>{input=value;pdfCalls++;maybeFail('pdf');return Buffer.from('%PDF-1.7\nSYNTHETIC_TRANSPORT_ONLY')}},
  });
  return{run:(lang='de')=>route.GET(new Request(`https://fanmind.invalid/settings/profile/data-export?lang=${lang}`)),input:()=>input,pdfCalls:()=>pdfCalls,collectorArgs:()=>collectorArgs,privateArgs:()=>privateArgs,lines:()=>pdf.buildDataDisclosurePdfLines(input)};
}

test('successful disclosure binds both readers to the signed-in Creator and is explicitly complete',async()=>{
  const datasets=[{key:'profile_record',rows:[{id:userId,display_name:'Synthetic Creator'}]},{key:'membership_record',rows:[{id:'membership-1',workspace_id:workspace,user_id:userId,role:'owner'}]},{key:'workspace_record',rows:[{id:workspace,name:'Synthetic workspace',billing_status:'active'}]},{key:'memories',rows:[{id:'m1',workspace_id:workspace,content:'PRESERVE_MEMORY'}]},{key:'messages',rows:[{id:'msg1',workspace_id:workspace,source_platform:'x',content:'PRESERVE_X_MESSAGE'}]}];
  const privateDatasets=[{key:'referral_membership',rows:[{workspace_id:workspace,user_id:userId,referral_code:'OWNCODE'}]}];
  const h=routeFixture({datasets,privateDatasets});const response=await h.run('de');
  assert.deepEqual(h.collectorArgs(),[workspace,userId]);assert.deepEqual(h.privateArgs(),[workspace,userId,email]);
  assert.equal(response.status,200);assert.equal(response.headers.get('X-FanMind-Disclosure-Status'),'complete');assert.match(response.headers.get('Content-Disposition'),/fanmind-datenauskunft\.pdf/);assert.doesNotMatch(response.headers.get('Content-Disposition'),/teilweise|partial/i);
  const lines=h.lines().join('\n');assert.match(lines,/Kontoprofil und gespeicherte Präferenzen/);assert.match(lines,/phone: \+43 1 234/);assert.match(lines,/PRESERVE_SAFE/);assert.match(lines,/Gespeichertes Nutzerprofil/);assert.match(lines,/PRESERVE_MEMORY/);assert.match(lines,/PRESERVE_X_MESSAGE/);assert.match(lines,/OWNCODE/);assert.doesNotMatch(lines,/NEVER_EXPORT|provider_token|refresh_token|Vollständigkeit nicht bestätigt|Teilauskunft/);
});

test('workspace members cannot export the Creator Workspace disclosure',async()=>{
  const h=routeFixture({member:true});const response=await h.run();assert.equal(response.status,403);assert.equal(h.pdfCalls(),0);assert.equal(h.collectorArgs(),undefined);assert.equal(h.privateArgs(),undefined);
});

test('an Auth read error cannot produce a PDF marked complete',async()=>{
  const h=routeFixture({authReadError:true});const response=await h.run();const html=await response.text();
  assert.equal(response.status,500);assert.equal(response.headers.get('X-FanMind-Disclosure-Status'),null);assert.equal(h.pdfCalls(),0);assert.doesNotMatch(html,/PRIVATE_AUTH_ERROR/u);
});

for(const locale of ['de','en']) for(const stage of ['auth','workspace','contacts','datasets','private','pdf']) {
  test(`${locale} ${stage} failure renders a safe actionable page and never returns an incomplete PDF`,async()=>{
    const h=routeFixture({failAt:stage,knownFailure:stage==='datasets'||stage==='private'});const response=await h.run(locale);const html=await response.text();
    assert.equal(response.status,(stage==='datasets'||stage==='private')?409:500);assert.equal(response.headers.get('Content-Type'),'text/html; charset=utf-8');assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(response.headers.get('Referrer-Policy'),'no-referrer');assert.match(response.headers.get('Content-Security-Policy'),/default-src 'none'/);
    assert.match(html,new RegExp(`<html lang="${locale}">`));assert.match(html,locale==='en'?/Try again/:/Erneut versuchen/);assert.match(html,locale==='en'?/complete data disclosure/i:/vollständige Datenauskunft/i);assert.doesNotMatch(html,/PRIVATE_RAW_ERROR|content_sources|<script|owner@example|SYNTHETIC_TRANSPORT/iu);assert.equal(h.pdfCalls(),stage==='pdf'?1:0);
  });
}

test('missing workspace is helpful and anonymous access still redirects to login',async()=>{
  const h=routeFixture({noWorkspace:true});const response=await h.run();assert.equal(response.status,404);assert.match(await response.text(),/Zurück zum Profil/);assert.equal(h.pdfCalls(),0);
  const anonymous=routeFixture({anonymous:true});const redirect=await anonymous.run();assert.equal(redirect.status,307);assert.equal(redirect.headers.get('Location'),'https://fanmind.invalid/login');assert.equal(redirect.headers.get('Cache-Control'),'private, no-store');assert.equal(anonymous.pdfCalls(),0);
});

test('untrusted locale is never reflected in error HTML or retry links',async()=>{
  for(const tag of ['script','SCRIPT','ScRiPt']) {const h=routeFixture({failAt:'datasets'});const response=await h.run(encodeURIComponent(`en"><${tag}>ATTACK</${tag}>`));const html=await response.text();assert.match(html,/<html lang="de">/);assert.doesNotMatch(html,/ATTACK|<script/iu)}
});

for(const locale of ['de','en']) {
  test(`real PDF ${locale} preserves complete Creator data across pages without a partial marker`,async()=>{
    const {mkdtemp,writeFile,rm}=await import('node:fs/promises');const {join}=await import('node:path');const {pathToFileURL}=await import('node:url');const {extractText,initNodeDecompression_parser}=await import('pdfnative');await initNodeDecompression_parser();
    const temp=await mkdtemp(join(process.cwd(),'.disclosure-1129-'));
    try {
      const output=ts.transpileModule(readFileSync('src/lib/dataDisclosurePdf.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;const file=join(temp,'pdf.mjs');await writeFile(file,output);const engine=await import(pathToFileURL(file).href);
      const h=routeFixture({datasets:[{key:'profile_record',rows:[{id:userId,display_name:'Synthetic Creator'}]},{key:'memories',rows:[{workspace_id:workspace,id:'memory-1',content:'PRESERVE_MEMORY'}]},{key:'messages',rows:[{workspace_id:workspace,id:'msg-1',content:'PRESERVE_MESSAGE'}]}],privateDatasets:[{key:'referral_membership',rows:[{workspace_id:workspace,user_id:userId,referral_code:'OWNCODE'}]}]});
      await h.run(locale);const input=h.input();input.contacts=Array.from({length:60},(_,i)=>({displayName:`Synthetic contact ${i+1}`,summary:`PRESERVED-${i+1}`}));const pdf=await engine.createDataDisclosurePdf(input);assert.equal(Buffer.from(pdf).subarray(0,5).toString(),'%PDF-');
      const pages=extractText(pdf),text=pages.map(p=>p.text).join('\n');assert.match(text,/PRESERVED-60/);assert.match(text,/PRESERVE_MEMORY/);assert.match(text,/PRESERVE_MESSAGE/);assert.match(text,/OWNCODE/);assert.doesNotMatch(text,/Completeness not confirmed|Vollständigkeit nicht bestätigt|Partial export|Teilauskunft/);assert.ok(pages.length>1);
    } finally {await rm(temp,{recursive:true,force:true})}
  });
}
