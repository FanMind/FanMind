import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getChatCharacter, requireChatAdminCapability } from "@/lib/chatAdmin";
import { getSupabaseHeaders, requireSupabasePublicConfig, SUPABASE_ACCESS_TOKEN_COOKIE } from "@/lib/supabase/config";
import { normalizeMediaImage } from "@/lib/chatAdminMediaImage";
import { MEDIA_MAX_BYTES, mediaId } from "@/lib/chatAdminMediaPolicy.mjs";
import { WorkspaceAuthorizationError } from "@/lib/workspaceAuthorization";

export const runtime="nodejs";
const privateHeaders={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox"};
const absent=()=>new NextResponse(null,{status:404,headers:privateHeaders});
export async function GET(request:NextRequest){
 try{
  const {workspace}=await requireChatAdminCapability();
  const id=mediaId(request.nextUrl.searchParams.get("character_id"));
  const revision=Number(request.nextUrl.searchParams.get("revision"));
  if(!Number.isSafeInteger(revision)||revision<1)return absent();
  const character=await getChatCharacter(workspace.id,id);
  const path=character.profile_image_path;
  // Only the explicitly assigned portrait of this workspace and this Model.
  if(character.revision!==revision||!path||!path.startsWith(`chat-characters/${workspace.id}/${id}/`)||!/^chat-characters\/[0-9a-f-]+\/[0-9a-f-]+\/(?!\.{1,2}$)[A-Za-z0-9._-]+$/u.test(path))return absent();
  const token=(await cookies()).get(SUPABASE_ACCESS_TOKEN_COOKIE)?.value;
  if(!token)return new NextResponse(null,{status:401,headers:privateHeaders});
  const response=await fetch(`${requireSupabasePublicConfig().url}/storage/v1/object/authenticated/${path}`,{headers:getSupabaseHeaders(token),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(10_000)});
  if(!response.ok){await response.body?.cancel();return absent();}
  const reader=response.body?.getReader();if(!reader)return absent();
  const chunks:Uint8Array[]=[];let length=0;
  try{while(true){const item=await reader.read();if(item.done)break;length+=item.value.length;if(length>MEDIA_MAX_BYTES)return absent();chunks.push(item.value);}}
  finally{await reader.cancel().catch(()=>{});}
  const image=await normalizeMediaImage(Buffer.concat(chunks));
  const current=await getChatCharacter(workspace.id,id);
  if(current.revision!==revision||current.profile_image_path!==path)return absent();
  return new NextResponse(new Uint8Array(image),{headers:{...privateHeaders,"Content-Type":"image/webp","Content-Length":String(image.length)}});
 }catch(error){
  if(error instanceof WorkspaceAuthorizationError)return new NextResponse(null,{status:error.code==="unauthenticated"?401:403,headers:privateHeaders});
  return absent();
 }
}
