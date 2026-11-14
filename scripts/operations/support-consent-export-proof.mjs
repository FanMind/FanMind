// Independent source/DB projection proof, not a live HTTP/browser download.
// Input contains only DB-redacted turns. Never accept or print support contents.
import {readFileSync,writeFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {collectSupportExport} from '../../src/lib/supportPrivacy.mjs';
const [input,output]=process.argv.slice(2),root=resolve('docs/legal/private-evidence');
if(!input||!output||![input,output].every(p=>resolve(p).startsWith(root+'/'))||(statSync(input).mode&0o777)!==0o600)throw Error('private_proof_paths_required');
const live=JSON.parse(readFileSync(input,'utf8'));
if(live.kind!=='independent-redacted-export-proof'||live.foreign_rows!==0||live.row_count!==live.turns.length||live.turns.length>=100||live.turns.some(t=>t.question!=='[Inhalt zurückgehalten]'||t.answer!=='[Inhalt zurückgehalten]'||!/^redacted-\d+$/.test(t.request_id)))throw Error('redacted_projection_required');
const identity={actor:'synthetic-owner-binding',workspace:'synthetic-operator-workspace',scope:'independent-own-scope'};
const source=readFileSync('src/app/api/support/privacy/route.ts','utf8'),exports={};
const dependencies={
 'next/server':{NextResponse:{json:(data,options={})=>new Response(JSON.stringify(data),{...options,headers:{'Content-Type':'application/json',...options.headers}})}},
 '@/lib/supportAIConsentPolicy':{persistentSupportConsentEnabled:()=>true},
 '@/lib/supportAIConsentServer':{readSupportAIConsent:async actor=>{if(actor!==identity.actor)throw Error('foreign_actor');return live.state;}},
 '@/lib/httpMutationPolicy.mjs':{isTrustedFanMindMutationRequest:()=>false},
 '@/lib/supportContinuityServer':{supportCustomer:async()=>identity,readSupportConversation:async i=>{if(i!==identity)throw Error('foreign_identity');return live.turns;}},
 '@/lib/supportCentreServer':{supportCentreEnabled:()=>true,supportCentreDatabase:()=>{throw Error('unexpected_database_write');}},
 '@/lib/supportPrivacy.mjs':{collectSupportExport},
 '@/lib/sharedRateLimit':{consumeSharedRateLimit:async()=>({allowed:true})},
 '@/lib/supportCentreRequest':{},'@/lib/supportCentrePolicy':{}
};
runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>{if(!(name in dependencies))throw Error('unexpected_dependency');return dependencies[name];},Response,Date});
const request=scope=>({nextUrl:new URL('https://staging.fanmind.ch/api/support/privacy?scope='+scope)});
const response=await exports.GET(request(identity.scope));const payload=await response.json();
if(response.status!==200||JSON.stringify(payload.ai_consent)!==JSON.stringify(live.state)||payload.turns.length!==live.row_count||!response.headers.get('Content-Disposition')?.includes('fanmind-support-data.json')||response.headers.get('Cache-Control')!=='private, no-store'||(await exports.GET(request('foreign'))).status!==400)throw Error('export_contract_failed');
writeFileSync(output,JSON.stringify({notice:'INDEPENDENT REDACTED PROJECTION; NOT A LIVE HTTP OR BROWSER DOWNLOAD',source_sha256:createHash('sha256').update(source).digest('hex'),captured_at:live.captured_at,payload},null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({kind:'independent-redacted-export-proof',actual_route_status:200,download_header:true,private_no_store:true,foreign_scope_denied:true,foreign_rows:0,row_count:payload.turns.length,consent:payload.ai_consent,source_sha256:createHash('sha256').update(source).digest('hex'),file_sha256:createHash('sha256').update(readFileSync(output)).digest('hex'),live_browser_download:'NOT_TESTED'}));
