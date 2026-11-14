import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
function load(file,deps={},env={FANMIND_RUNTIME_ENVIRONMENT:'staging'}){const exports={};runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{if(n in deps)return deps[n];throw Error('unexpected '+n);},process:{env},Date,Headers,Request,URL});return exports;}
const policy=load('src/lib/supportAIConsentPolicy.ts');
test('persistent consent is default-off for Production, never inferred from AGB, and rejects corrupt or outdated positive evidence',()=>{
 assert.equal(policy.persistentSupportConsentEnabled(),true);
 assert.equal(load('src/lib/supportAIConsentPolicy.ts',{}, {FANMIND_RUNTIME_ENVIRONMENT:'production'}).persistentSupportConsentEnabled(),false);
 const base={granted:false,revision:0,version:null,grantedAt:null,revokedAt:null};assert.equal(policy.consentState(base).granted,false);
 for(const s of [{...base,granted:true},{...base,revision:-1},{...base,granted:true,version:'old',grantedAt:new Date().toISOString()},{...base,grantedAt:'bad'}])assert.throws(()=>policy.consentState(s));
});
test('actual consent route derives user, rejects foreign scope/fields/origin and validates stored readback',async()=>{
 let enabled=true,identity={actor:'actor',workspace:'workspace',scope:'own'},writes=0,foreign=false;
 let state={granted:false,revision:0,version:null,grantedAt:null,revokedAt:null};
 const route=load('src/app/api/support/ai-consent/route.ts',{
  'next/server':{NextResponse:{json:(body,o)=>({body,...o})}},
  '@/lib/supportContinuityServer':{supportCustomer:async()=>identity},
  '@/lib/supportAIConsentPolicy':{...policy,persistentSupportConsentEnabled:()=>enabled},
  '@/lib/supportAIConsentServer':{readSupportAIConsent:async actor=>{assert.equal(actor,'actor');return foreign?{...state,revision:99}:state;}},
  '@/lib/supportCentreServer':{supportCentreDatabase:async(path,b)=>{assert.equal(path,'rpc/support_ai_consent_decide');assert.equal(b.p_actor,'actor');assert.equal(b.p_version,policy.SUPPORT_AI_CONSENT_VERSION);writes++;state={granted:b.p_granted,revision:state.revision+1,version:b.p_version,grantedAt:b.p_granted?new Date().toISOString():state.grantedAt,revokedAt:b.p_granted?null:new Date().toISOString()};return state;}},
  '@/lib/supportCentreRequest':{readSupportRequest:async r=>r.body},
  '@/lib/supportCentrePolicy':{isSupportUuid:s=>s==='request'},
  '@/lib/httpMutationPolicy.mjs':{isTrustedFanMindMutationRequest:r=>r.trusted===true},
  '@/lib/sharedRateLimit':{consumeSharedRateLimit:async()=>({allowed:true})}
 });
 const b={scope:'own',granted:true,version:policy.SUPPORT_AI_CONSENT_VERSION,revision:0,requestId:'request',confirmed:true};
 for(const bad of [{...b,scope:'foreign'},{...b,actor:'foreign'},{...b,confirmed:false},{...b,version:'old'}])assert.equal((await route.POST({trusted:true,body:bad})).status,409);
 assert.equal((await route.POST({trusted:false,body:b})).status,403);assert.equal(writes,0);
 assert.equal((await route.GET()).body.state.granted,false);
 assert.equal((await route.POST({trusted:true,body:b})).body.state.granted,true);assert.equal(writes,1);
 assert.equal((await route.GET()).body.state.granted,true);
 assert.equal((await route.POST({trusted:true,body:{...b,granted:false,revision:1}})).body.state.granted,false);
 foreign=true;assert.equal((await route.POST({trusted:true,body:b})).status,409);
 identity=null;assert.equal((await route.GET()).status,401);enabled=false;assert.equal((await route.GET()).status,404);
});
test('actual conversation denies stale client AI after withdrawal and suppresses an in-flight result after consent revision changes',async()=>{
 let allowed=false,revision=1,calls=0,writes=0,revokeDuringProvider=false;
 const identity={actor:'actor',workspace:'workspace',scope:'own'};
 const route=load('src/app/api/support/conversation/route.ts',{
  'next/server':{NextRequest:Request,NextResponse:{json:(body,o={})=>({body,status:o.status??200})}},
  '@/lib/supportAIConsentPolicy':{persistentSupportConsentEnabled:()=>true},
  '@/lib/supportAIConsentServer':{readSupportAIConsent:async()=>({granted:allowed,revision})},
  '@/lib/supportContinuityServer':{supportCustomer:async()=>identity,readSupportConversation:async()=>[]},
  '@/lib/supportCentreServer':{supportCentreEnabled:()=>true,supportCentreDatabase:async()=>{writes++;}},
  '@/lib/supportCentreRequest':{readSupportRequest:async r=>r.json()},
  '@/lib/supportCentrePolicy':{isSupportUuid:()=>true},
  '@/lib/sharedRateLimit':{consumeSharedRateLimit:async()=>({allowed:true})},
  '@/lib/httpMutationPolicy.mjs':{isTrustedFanMindMutationRequest:()=>true},
  '@/lib/supportHistoryPolicy':{isRetiredCreatorSupportTurn:()=>false},
  '@/lib/supportKnowledge':{supportAnswer:()=>({answer:'local',unanswered:false})},
  '@/lib/publicSupportPolicy.mjs':{isPublicSupportPricingQuestion:()=>false},
  '@/lib/supportCreatorCapacity':{answerCreatorSupport:async input=>{assert.equal(input.identity.actor,'actor');assert.equal(input.identity.workspace,'workspace');await input.beforeProvider();calls++;if(revokeDuringProvider){allowed=false;revision++;}return 'synthetic AI';}}
 });
 const request=(aiConsent=true)=>new Request('https://staging.fanmind.ch/api/support/conversation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:'id',scope:'own',question:'How does FanMind work?',context:'support',aiConsent})});
 assert.equal((await route.POST(request())).status,409);assert.equal(calls,0);assert.equal(writes,0);
 allowed=true;assert.equal((await route.POST(request())).status,200);assert.equal(calls,1);assert.equal(writes,1);
 revokeDuringProvider=true;assert.equal((await route.POST(request())).status,409);assert.equal(calls,2);assert.equal(writes,1);
 assert.equal((await route.POST(request())).status,409);assert.equal(calls,2);
 assert.equal((await route.POST(request(false))).status,200);assert.equal(calls,2);
});
