import { NextRequest,NextResponse } from "next/server";
import { supportCustomer,readSupportConversation } from "@/lib/supportContinuityServer";
import { supportCentreDatabase,supportCentreEnabled } from "@/lib/supportCentreServer";
import { readSupportRequest } from "@/lib/supportCentreRequest";
import { isSupportUuid } from "@/lib/supportCentrePolicy";
import { consumeSharedRateLimit } from "@/lib/sharedRateLimit";
import { supportAnswer } from "@/lib/supportKnowledge";
const headers={"Cache-Control":"no-store"};
const fail=(status:number)=>NextResponse.json({error:"support_unavailable"},{status,headers});
export async function GET(request:NextRequest){
 if(!supportCentreEnabled())return fail(404);
 try{const identity=await supportCustomer();if(!identity)return fail(401);const before=request.nextUrl.searchParams.get("before");if(before&&!isSupportUuid(before))return fail(400);return NextResponse.json({scope:identity.scope,turns:await readSupportConversation(identity,before??undefined)},{headers});}catch{return fail(503);}
}
export async function POST(request:NextRequest){
 if(!supportCentreEnabled())return fail(404);
 if(request.headers.get("origin")!==request.nextUrl.origin)return fail(403);
 try{
  const identity=await supportCustomer();if(!identity)return fail(401);
  const body=await readSupportRequest(request,5000);
  if(Object.keys(body).some(k=>!["requestId","question","context","handoff","scope"].includes(k))||body.scope!==identity.scope)return fail(409);
  const limit=await consumeSharedRateLimit({scope:"support.conversation",subject:`${identity.actor}:${identity.workspace}`,maxRequests:20,windowMs:60000});if(!limit.allowed)return fail(429);
  if(body.handoff===true){if(Object.keys(body).some(k=>!["handoff","scope"].includes(k)))return fail(400);await supportCentreDatabase("rpc/support_chat_handoff",{p_actor:identity.actor,p_workspace:identity.workspace});return NextResponse.json({scope:identity.scope,status:"handed_off"},{headers});}
  if(!isSupportUuid(body.requestId)||typeof body.question!=="string"||!body.question.trim()||body.question.length>1000||typeof body.context!=="string"||!["dashboard","channels","billing","support"].includes(body.context))return fail(400);
  const response=supportAnswer(body.question);
  await supportCentreDatabase("rpc/support_chat_send",{p_actor:identity.actor,p_workspace:identity.workspace,p_request:body.requestId,p_question:body.question,p_answer:response.answer,p_context:body.context,p_unanswered:response.unanswered});
  return NextResponse.json({scope:identity.scope,turns:await readSupportConversation(identity)},{headers});
 }catch{return fail(503);}
}
