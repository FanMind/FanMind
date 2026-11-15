import {NextRequest,NextResponse} from "next/server";
import {supportCustomer} from "@/lib/supportContinuityServer";
import {supportCentreDatabase} from "@/lib/supportCentreServer";
import {SUPPORT_AI_CONSENT_VERSION,SUPPORT_AI_CONSENT_TEXT,persistentSupportConsentEnabled,consentState} from "@/lib/supportAIConsentPolicy";
import {readSupportAIConsent} from "@/lib/supportAIConsentServer";
import {readSupportRequest} from "@/lib/supportCentreRequest";
import {isSupportUuid} from "@/lib/supportCentrePolicy";
import {isTrustedFanMindMutationRequest} from "@/lib/httpMutationPolicy.mjs";
import {consumeSharedRateLimit} from "@/lib/sharedRateLimit";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
const fail=(status:number)=>NextResponse.json({error:"consent_unavailable"},{status,headers});
export async function GET(){
 if(!persistentSupportConsentEnabled())return fail(404);
 try{const i=await supportCustomer();if(!i)return fail(401);return NextResponse.json({scope:i.scope,state:await readSupportAIConsent(i.actor),version:SUPPORT_AI_CONSENT_VERSION,text:SUPPORT_AI_CONSENT_TEXT},{headers});}catch{return fail(503);}
}
export async function POST(request:NextRequest){
 if(!persistentSupportConsentEnabled())return fail(404);
 if(!isTrustedFanMindMutationRequest(request))return fail(403);
 try{
  const i=await supportCustomer();if(!i)return fail(401);
  const b=await readSupportRequest(request,3000);
  if(Object.keys(b).some(k=>!["scope","granted","version","revision","requestId","confirmed"].includes(k))||b.scope!==i.scope||typeof b.granted!=="boolean"||b.version!==SUPPORT_AI_CONSENT_VERSION||!Number.isSafeInteger(b.revision)||(b.revision as number)<0||!isSupportUuid(b.requestId)||b.confirmed!==true)return fail(409);
  if(!(await consumeSharedRateLimit({scope:"support.ai_consent",subject:i.actor,maxRequests:12,windowMs:60000})).allowed)return fail(429);
  const state=consentState(await supportCentreDatabase("rpc/support_ai_consent_decide",{p_actor:i.actor,p_version:SUPPORT_AI_CONSENT_VERSION,p_granted:b.granted,p_revision:b.revision,p_request:b.requestId}));
  const current=await supportCustomer();if(current?.scope!==i.scope)return fail(409);
  const checked=await readSupportAIConsent(i.actor);if(JSON.stringify(state)!==JSON.stringify(checked)||state.granted!==b.granted)return fail(409);
  return NextResponse.json({scope:i.scope,state,version:SUPPORT_AI_CONSENT_VERSION,text:SUPPORT_AI_CONSENT_TEXT},{headers});
 }catch{return fail(409);}
}
