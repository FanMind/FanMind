import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
import * as pdfnative from 'pdfnative';
import {verifyCreatorDisclosureRelease,verifyCreatorDisclosure} from '../scripts/operations/creator-staging-disclosure-acceptance.mjs';
const env={NEXT_PUBLIC_APP_URL:'https://staging.fanmind.ch',FANMIND_RUNTIME_ENVIRONMENT:'staging',GITHUB_REF:'refs/heads/main',GITHUB_SHA:'a'.repeat(40),FANMIND_CREATOR_FOUNDATION_REVIEWED_COMMIT:'a'.repeat(40),FANMIND_STAGING_SUPABASE_SERVICE_ROLE_KEY:'sb_secret_synthetic_never_export'};
const first={workspaceId:'11111111-1111-4111-8111-111111111111',creatorId:'22222222-2222-4222-8222-222222222222',writingStyle:'warm and expressive',actor:{token:'synthetic.owner.session_token'}};
const other={workspaceId:'33333333-3333-4333-8333-333333333333',creatorId:'44444444-4444-4444-8444-444444444444',writingStyle:'calm and concise',actor:{token:'synthetic.other.session_token'}};
const version={application:'fanmind',runtimeEnvironment:'staging',releaseCommit:env.GITHUB_SHA};
const json=value=>new Response(JSON.stringify(value),{status:200});
const pdfModule={};
const moduleRequire=createRequire(import.meta.url);
runInNewContext(ts.transpileModule(readFileSync('src/lib/dataDisclosurePdf.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:pdfModule,require:name=>{if(name==='pdfnative')return pdfnative;assert.match(name,/^pdfnative\/fonts\//u);return moduleRequire(name);}});
async function pdf(extra=[]) {
  return pdfModule.createDataDisclosurePdf({generatedAt:new Date('2026-09-11T12:00:00Z'),locale:'en',user:{id:'synthetic-owner'},workspace:{id:first.workspaceId,name:'Synthetic acceptance'},contacts:[],storedDataSections:[{title:'Creator writing style',countLabel:'Records',emptyMessage:'Empty',entries:[{title:first.creatorId,fields:[first.writingStyle,...extra]}]}]});
}
function harness({document,status=200,release=version,changedAfter=false,contentType='application/pdf'}={}) {
  const calls=[]; let versions=0;
  return {calls,fetchImpl:async(url,options)=>{
    calls.push({url,options});assert.equal(url.origin,env.NEXT_PUBLIC_APP_URL);assert.equal(options.redirect,'error');
    if(url.pathname==='/api/version'){assert.equal(options.headers?.Cookie,undefined);versions++;return json(changedAfter && versions>1?{...version,releaseCommit:'b'.repeat(40)}:release);}
    assert.equal(url.pathname,'/settings/profile/data-export');assert.equal(url.search,'?lang=en');assert.equal(options.headers.Cookie,`fanmind_sb_access_token=${first.actor.token}`);
    return new Response(document,{status,headers:{'content-type':contentType}});
  }};
}
test('the real PDF generator and parser prove own Creator and writing-style export',async()=>{
  const h=harness({document:await pdf()});assert.equal(await verifyCreatorDisclosure(env,first,other,h),'PASS');assert.equal(h.calls.length,3);
});
test('foreign Creator data, style and secrets in a real PDF are rejected',async()=>{
  for(const value of [other.creatorId,other.workspaceId,other.writingStyle,first.actor.token,env.FANMIND_STAGING_SUPABASE_SERVICE_ROLE_KEY,'encrypted_token']){
    await assert.rejects(verifyCreatorDisclosure(env,first,other,harness({document:await pdf([value])})),/disclosure_(foreign_data|writing_style|secret)/);
  }
});
test('wrong target or release never transmits an owner session to the export route',async()=>{
  let calls=0;await assert.rejects(verifyCreatorDisclosureRelease({...env,NEXT_PUBLIC_APP_URL:'https://fanmind.ch'},{fetchImpl:async()=>{calls++;}}));assert.equal(calls,0);
  for(const release of [{...version,releaseCommit:'b'.repeat(40)},{...version,runtimeEnvironment:'production'}]){
    const h=harness({release});await assert.rejects(verifyCreatorDisclosure(env,first,other,h),/disclosure_release/);assert.equal(h.calls.length,1);
  }
  const h=harness();await assert.rejects(verifyCreatorDisclosure(env,{...first,actor:{token:'invalid;cookie'}},other,h),/disclosure_session/);assert.equal(h.calls.length,0);
});
test('login/error pages, changed releases and oversized streams cannot pass as PDF delivery',async()=>{
  for(const options of [{status:409,document:'unavailable'},{contentType:'text/html',document:'Login'},{document:'not a PDF'},{changedAfter:true,document:await pdf()}])await assert.rejects(verifyCreatorDisclosure(env,first,other,harness(options)));
  let chunks=0,cancelled=false;
  const stream=new ReadableStream({pull(controller){chunks++;controller.enqueue(new Uint8Array(5*1024*1024));},cancel(){cancelled=true;}},{highWaterMark:0});
  await assert.rejects(verifyCreatorDisclosure(env,first,other,harness({document:stream})),/disclosure_bound/);assert.equal(chunks,2);assert.equal(cancelled,true);
});
