import { isTrustedFanMindMutationRequest } from "@/lib/httpMutationPolicy.mjs";
import {NextRequest,NextResponse} from "next/server";
import {supportCustomer,readSupportConversation} from "@/lib/supportContinuityServer";
import {supportCentreDatabase,supportCentreEnabled} from "@/lib/supportCentreServer";
import {collectSupportExport} from "@/lib/supportPrivacy.mjs";
import {consumeSharedRateLimit} from "@/lib/sharedRateLimit";
import {readSupportRequest} from "@/lib/supportCentreRequest";
import {isSupportUuid} from "@/lib/supportCentrePolicy";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
const failure=(status:number)=>NextResponse.json({error:"support_privacy_unavailable"},{status,headers});
export async function GET(request:NextRequest){
 if(!supportCentreEnabled())return failure(404);
 try{
  const identity=await supportCustomer();if(!identity)return failure(401);
  const query=request.nextUrl.searchParams,preview=query.get("preview");
  if(query.get("scope")!==identity.scope||[...query.keys()].some(k=>k!=="scope"&&k!=="preview")||query.getAll("scope").length!==1||query.getAll("preview").length>1||(preview!==null&&preview!=="erase"))return failure(400);
  const limit=await consumeSharedRateLimit({scope:"support.privacy.export",subject:`${identity.actor}:${identity.workspace}`,maxRequests:5,windowMs:3600000});if(!limit.allowed)return failure(429);
  if(preview==="erase"){
   const state=await supportCentreDatabase("rpc/support_chat_privacy_state",{p_actor:identity.actor,p_workspace:identity.workspace}) as {thread:string;sequence:number}|null;
   if(state!==null&&(!isSupportUuid(state.thread)||!Number.isSafeInteger(state.sequence)||state.sequence<0))return failure(503);
   return NextResponse.json({scope:identity.scope,state},{headers});
  }
  const turns=await collectSupportExport(before=>readSupportConversation(identity,before));
  return NextResponse.json({generated_at:new Date().toISOString(),retention_days:30,scope:identity.scope,description:"Current retained own support conversation; paginated, not an atomic snapshot",turns},{headers:{...headers,"Content-Disposition":'attachment; filename="fanmind-support-data.json"'}});
 }catch{return failure(503);}
}
export async function POST(request:NextRequest){
 if(!supportCentreEnabled())return failure(404);
 if(!isTrustedFanMindMutationRequest(request))return failure(403);
 try{
  const identity=await supportCustomer();if(!identity)return failure(401);
  const input=await readSupportRequest(request,512);
  if(Object.keys(input).length!==5||input.action!=="erase"||input.confirmed!==true||input.scope!==identity.scope||!isSupportUuid(input.thread)||!Number.isSafeInteger(input.sequence)||(input.sequence as number)<0)return failure(400);
  const limit=await consumeSharedRateLimit({scope:"support.privacy.erase",subject:`${identity.actor}:${identity.workspace}`,maxRequests:3,windowMs:3600000});if(!limit.allowed)return failure(429);
  const erased=await supportCentreDatabase("rpc/support_chat_erase",{p_actor:identity.actor,p_workspace:identity.workspace,p_thread:input.thread,p_sequence:input.sequence});
  if(typeof erased!=="boolean")return failure(503);
  // A new conversation is never deleted by replaying an earlier approved snapshot.
  if(await supportCentreDatabase("rpc/support_chat_privacy_state",{p_actor:identity.actor,p_workspace:identity.workspace})!==null)return failure(409);
  return NextResponse.json({erased:true},{headers});
 }catch{return failure(503);}
}
