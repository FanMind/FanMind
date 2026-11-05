import { NextRequest,NextResponse } from "next/server";
import { listOwnerSupportNotifications,supportCentreActor,supportCentreEnabled,supportCentreDatabase } from "@/lib/supportCentreServer";
import { readSupportRequest } from "@/lib/supportCentreRequest";
import { isSupportUuid } from "@/lib/supportCentrePolicy";
import { consumeSharedRateLimit } from "@/lib/sharedRateLimit";
import { safeSupportTurns } from "@/lib/supportContinuityServer";
const headers={"Cache-Control":"no-store"};
const fail=(status:number)=>NextResponse.json({error:"support_unavailable"},{status,headers});
export async function GET(request:NextRequest){
 if(!supportCentreEnabled())return fail(404);
 try{
  const actor=await supportCentreActor();if(!actor)return fail(401);
  const workspace=request.nextUrl.searchParams.get("workspace"),thread=request.nextUrl.searchParams.get("thread");
  if(workspace||thread){if(!isSupportUuid(workspace)||!isSupportUuid(thread))return fail(400);const before=request.nextUrl.searchParams.get("before");if(before&&!isSupportUuid(before))return fail(400);const turns=safeSupportTurns(await supportCentreDatabase("rpc/support_chat_review",{p_workspace:workspace,p_thread:thread,p_before:before}));return NextResponse.json({turns},{headers});}
  if(!actor.owner)return fail(403);
  const retention=await supportCentreDatabase("rpc/support_retention_health",{p_actor:actor.user.id});
  return NextResponse.json({items:await listOwnerSupportNotifications(),retention},{headers});
 }catch{return fail(503);}
}
export async function POST(request:NextRequest){
 if(!supportCentreEnabled())return fail(404);
 if(request.headers.get("origin")!==request.nextUrl.origin)return fail(403);
 try{
  const actor=await supportCentreActor();if(!actor?.owner)return fail(403);
  const input=await readSupportRequest(request,512);
  const limit=await consumeSharedRateLimit({scope:"support.owner.maintenance",subject:actor.user.id,maxRequests:5,windowMs:60000});if(!limit.allowed)return fail(429);
  if(input.action==="recover"&&Object.keys(input).length===1){const repaired=await supportCentreDatabase("rpc/support_centre_recover",{p_actor:actor.user.id});return NextResponse.json({repaired},{headers});}
  if(input.action==="ack"&&isSupportUuid(input.id)&&Object.keys(input).length===2){await supportCentreDatabase("rpc/support_centre_ack",{p_actor:actor.user.id,p_notification:input.id});return NextResponse.json({ok:true},{headers});}
  return fail(400);
 }catch{return fail(503);}
}
