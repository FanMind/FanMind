import {persistentSupportConsentEnabled} from "@/lib/supportAIConsentPolicy";
import {readSupportAIConsent} from "@/lib/supportAIConsentServer";
import { isTrustedFanMindMutationRequest } from "@/lib/httpMutationPolicy.mjs";
import { NextRequest,NextResponse } from "next/server";
import { supportCustomer,readSupportConversation } from "@/lib/supportContinuityServer";
import { supportCentreDatabase,supportCentreEnabled } from "@/lib/supportCentreServer";
import { readSupportRequest } from "@/lib/supportCentreRequest";
import { isSupportUuid } from "@/lib/supportCentrePolicy";
import { consumeSharedRateLimit } from "@/lib/sharedRateLimit";
import { isRetiredCreatorSupportTurn } from "@/lib/supportHistoryPolicy";
import { supportAnswer } from "@/lib/supportKnowledge";
const headers={"Cache-Control":"no-store"};
const fail=(status:number)=>NextResponse.json({error:"support_unavailable"},{status,headers});
export async function GET(request:NextRequest){
 if(!supportCentreEnabled())return fail(404);
 try{const identity=await supportCustomer();if(!identity)return fail(401);const before=request.nextUrl.searchParams.get("before");if(before&&!isSupportUuid(before))return fail(400);return NextResponse.json({scope:identity.scope,turns:await readSupportConversation(identity,before??undefined)},{headers});}catch{return fail(503);}
}
export async function POST(request:NextRequest){
 if(!supportCentreEnabled())return fail(404);
 if(!isTrustedFanMindMutationRequest(request))return fail(403);
 try{
  const identity=await supportCustomer();if(!identity)return fail(401);
  const body=await readSupportRequest(request,5000);
  if(Object.keys(body).some(k=>!["requestId","question","context","handoff","scope","aiConsent"].includes(k))||body.scope!==identity.scope)return fail(409);
  const limit=await consumeSharedRateLimit({scope:"support.conversation",subject:`${identity.actor}:${identity.workspace}`,maxRequests:20,windowMs:60000});if(!limit.allowed)return fail(429);
  if(body.handoff===true){if(Object.keys(body).some(k=>!["handoff","scope"].includes(k)))return fail(400);await supportCentreDatabase("rpc/support_chat_handoff",{p_actor:identity.actor,p_workspace:identity.workspace});return NextResponse.json({scope:identity.scope,status:"handed_off"},{headers});}
  if(!isSupportUuid(body.requestId)||typeof body.question!=="string"||!body.question.trim()||body.question.length>1000||typeof body.context!=="string"||!["dashboard","channels","billing","support"].includes(body.context))return fail(400);
  if(body.aiConsent!==undefined&&typeof body.aiConsent!=="boolean")return fail(400);
  let response=supportAnswer(body.question),answerMode="knowledge";
  if(body.aiConsent===true){
   const consent=persistentSupportConsentEnabled()?await readSupportAIConsent(identity.actor):null;
   if(consent&&!consent.granted)return fail(409);
   // Reuse the existing approved Support provider pipeline. Only this actor's
   // explicitly consented Support text is passed, never CRM, credentials or IDs.
   const retained=await readSupportConversation(identity);
   if(retained.some(turn=>turn.request_id===body.requestId))return NextResponse.json({scope:identity.scope,turns:retained,answerMode:"stored"},{headers});
   const {isPublicSupportPricingQuestion,publicSupportPricingReply}=await import("@/lib/publicSupportPolicy.mjs");
   if(isPublicSupportPricingQuestion(body.question)){response={answer:publicSupportPricingReply("de"),unanswered:false};}else{
    const {POST:answerQuestion}=await import("../../public-support/route");
    const forwarded=new Headers(request.headers);forwarded.delete("content-length");forwarded.set("Content-Type","application/json");
    const generated=await answerQuestion(new NextRequest(new URL("/api/public-support",request.url),{
     method:"POST",headers:forwarded,signal:request.signal,
     body:JSON.stringify({question:body.question,history:retained.filter(turn=>!isRetiredCreatorSupportTurn(turn.question)).slice(-2).flatMap(turn=>[{role:"user",text:turn.question},{role:"assistant",text:turn.answer}]),consent:true,language:"de"}),
    }));
    if(consent){const latest=await readSupportAIConsent(identity.actor);if(!latest.granted||latest.revision!==consent.revision)return fail(409);}
    if(!generated.ok)return fail(generated.status===429?429:503);
    const result=await generated.json();
    if(typeof result.reply!=="string"||!result.reply.trim()||result.reply.length>2000||request.signal.aborted)return fail(503);
    const current=await supportCustomer();
    if(!current||current.scope!==identity.scope)return fail(409);
    if(request.signal.aborted)return fail(503);
    response={answer:result.reply,unanswered:false};answerMode="ai";
   }
  }
  await supportCentreDatabase("rpc/support_chat_send",{p_actor:identity.actor,p_workspace:identity.workspace,p_request:body.requestId,p_question:body.question,p_answer:response.answer,p_context:body.context,p_unanswered:response.unanswered});
  return NextResponse.json({scope:identity.scope,turns:await readSupportConversation(identity),answerMode},{headers});
 }catch{return fail(503);}
}
