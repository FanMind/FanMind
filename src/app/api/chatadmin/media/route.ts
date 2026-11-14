import { NextRequest, NextResponse } from "next/server";
import { requireChatAdminCapability } from "@/lib/chatAdmin";
import { assertMediaCharacter, getMediaAsset, loadCharacterMedia, mediaObject, mediaRest, mediaScope, requireMediaEnabled, updateMediaAsset, type MediaAsset, type CustomMediaPolicy } from "@/lib/chatAdminMedia";
import { ChatAdminMediaError, MEDIA_MAX_BYTES, MEDIA_MAX_ITEMS, mediaId, mediaText, normalizeCustomPolicy, normalizeMediaEdit } from "@/lib/chatAdminMediaPolicy.mjs";
import { normalizeMediaImage } from "@/lib/chatAdminMediaImage";
import { isTrustedFanMindMutationRequest, readBoundedJsonRequest } from "@/lib/httpMutationPolicy.mjs";
import { WorkspaceAuthorizationError } from "@/lib/workspaceAuthorization";
import { consumeSharedRateLimit } from "@/lib/sharedRateLimit";

export const runtime="nodejs";
const privateHeaders={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
function failure(error:unknown){
 if(error instanceof WorkspaceAuthorizationError)return NextResponse.json({error:error.code},{status:error.code==="unauthenticated"?401:403,headers:privateHeaders});
 if(error instanceof ChatAdminMediaError)return NextResponse.json({error:error.code},{status:error.code==="stale_media_context"?409:error.code==="media_not_enabled"||error.code.endsWith("unavailable")?503:400,headers:privateHeaders});
 return NextResponse.json({error:"media_unavailable"},{status:503,headers:privateHeaders});
}
export async function GET(request:NextRequest){try{
 const {workspace}=await requireChatAdminCapability();requireMediaEnabled();
 const characterId=mediaId(request.nextUrl.searchParams.get("character_id"));
 const character=await assertMediaCharacter(workspace.id,characterId,undefined,!request.nextUrl.searchParams.get("id"));
 const assetId=request.nextUrl.searchParams.get("id");
 if(assetId){
  const asset=await getMediaAsset(workspace.id,characterId,assetId);if(asset.deleted)throw new ChatAdminMediaError("media_deleted");
  const kind=asset.media_type??"image",requestedRange=request.headers.get("range");
  if(kind==="video"){
   if(requestedRange&&!/^bytes=\d+-\d*$/u.test(requestedRange))return new NextResponse(null,{status:416,headers:privateHeaders});
   const budget=await consumeSharedRateLimit({scope:"chat_admin_media_video_preview",subject:workspace.id,maxRequests:12,windowMs:60_000});
   if(!budget.allowed)return NextResponse.json({error:"rate_limited"},{status:429,headers:privateHeaders});
  }
  const bytes=await mediaObject(workspace.id,characterId,asset.id,"GET",undefined,kind);
  await assertMediaCharacter(workspace.id,characterId,character.revision);
  const range=request.headers.get("range");
  const type=kind==="video"?"video/mp4":"image/webp";
  if(kind==="video"&&range){
   const match=/^bytes=(\d+)-(\d*)$/u.exec(range),start=Number(match?.[1]),end=match?.[2]?Number(match[2]):bytes.length-1;
   if(!match||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=bytes.length)return new NextResponse(null,{status:416,headers:{...privateHeaders,"Content-Range":`bytes */${bytes.length}`}});
   const last=Math.min(end,bytes.length-1),slice=bytes.subarray(start,last+1);
   return new NextResponse(new Uint8Array(slice),{status:206,headers:{...privateHeaders,"Content-Type":type,"Accept-Ranges":"bytes","Content-Range":`bytes ${start}-${last}/${bytes.length}`,"Content-Length":String(slice.length),"Content-Security-Policy":"default-src 'none'; sandbox"}});
  }
  return new NextResponse(new Uint8Array(bytes),{headers:{...privateHeaders,"Content-Type":type,"Content-Length":String(bytes.length),...(kind==="video"?{"Accept-Ranges":"bytes"}:{}),"Content-Security-Policy":"default-src 'none'; sandbox"}});
 }
 return NextResponse.json({...await loadCharacterMedia(workspace.id,characterId),character,analysis_enabled:process.env.FANMIND_CHAT_ADMIN_MEDIA_ANALYSIS_ENABLED==="true"},{headers:privateHeaders});
}catch(error){return failure(error);}}

async function mutate(request:NextRequest,method:"POST"|"PATCH"|"DELETE"){
 if(!isTrustedFanMindMutationRequest(request))return NextResponse.json({error:"untrusted_origin"},{status:403});
 try{
  const {workspace,user}=await requireChatAdminCapability();requireMediaEnabled();
  const parsed=await readBoundedJsonRequest(request,method==="POST"?7_100_000:12_000);
  if(!parsed.ok||!parsed.value||typeof parsed.value!=="object"||Array.isArray(parsed.value))throw new ChatAdminMediaError("invalid_media_body");
  const body=parsed.value as Record<string,unknown>,characterId=mediaId(body.character_id);
  if(!Number.isSafeInteger(body.character_revision))throw new ChatAdminMediaError("invalid_media_binding");
  const character=await assertMediaCharacter(workspace.id,characterId,body.character_revision as number,method==="DELETE");
  if(body.action==="policy"&&method==="PATCH"){
   const policy=normalizeCustomPolicy(body.policy,character.sales_playbook?.offers??[]);
   const existing=await loadCharacterMedia(workspace.id,characterId);
   if(body.revision!==existing.policy.revision)throw new ChatAdminMediaError("stale_media_context");
   if(existing.policy.revision===0)await mediaRest("chat_character_media_policies",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({...policy,workspace_id:workspace.id,character_id:characterId})});
   else{const rows=await mediaRest<CustomMediaPolicy[]>(`chat_character_media_policies?${mediaScope(workspace.id,characterId)}&revision=eq.${existing.policy.revision}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify(policy)});if(rows.length!==1)throw new ChatAdminMediaError("stale_media_context");}
  }else if(method==="POST"){
   if(body.rights_confirmed!==true)throw new ChatAdminMediaError("media_rights_required");
   const limit=await consumeSharedRateLimit({scope:"chat_admin_media_upload",subject:user.id,maxRequests:20,windowMs:600_000});if(!limit.allowed)return NextResponse.json({error:"rate_limited"},{status:429});
   const {assets}=await loadCharacterMedia(workspace.id,characterId);if(assets.length>=MEDIA_MAX_ITEMS)throw new ChatAdminMediaError("media_library_limit");
   if(typeof body.image!=="string"||body.image.length>Math.ceil(MEDIA_MAX_BYTES/3)*4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(body.image))throw new ChatAdminMediaError("invalid_image");
   const image=await normalizeMediaImage(Buffer.from(body.image,"base64"));
   const id=crypto.randomUUID();
   const rows=await mediaRest<MediaAsset[]>("chat_character_media",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({id,workspace_id:workspace.id,character_id:characterId,folder:mediaText(body.folder??"",80)})});
   if(rows.length!==1)throw new ChatAdminMediaError("media_store_unavailable");
   try{await mediaObject(workspace.id,characterId,id,"POST",image);await updateMediaAsset(workspace.id,characterId,rows[0],{available:true});}
   catch{await updateMediaAsset(workspace.id,characterId,rows[0],{deleted:true,available:false,reviewed:false});throw new ChatAdminMediaError("media_upload_incomplete");}
  }else{
   const asset=await getMediaAsset(workspace.id,characterId,mediaId(body.id));
   if(body.revision!==asset.revision)throw new ChatAdminMediaError("stale_media_context");
   if(method==="DELETE"){
    if(!asset.deleted)await updateMediaAsset(workspace.id,characterId,asset,{deleted:true,available:false,reviewed:false});
    await mediaObject(workspace.id,characterId,asset.id,"DELETE",undefined,asset.media_type??"image");
    // NoSuchKey can also mask revoked Storage visibility. Revalidate current
    // Character authority before removing its tombstone; RLS remains final.
    await assertMediaCharacter(workspace.id,characterId,undefined,true);
    const removed=await mediaRest<MediaAsset[]>(`chat_character_media?${mediaScope(workspace.id,characterId)}&id=eq.${asset.id}&deleted=eq.true`,{method:"DELETE",headers:{Prefer:"return=representation"}});
    if(removed.length!==1||removed[0].id!==asset.id)throw new ChatAdminMediaError("media_cleanup_unverified");
   }else{if(asset.deleted)throw new ChatAdminMediaError("media_deleted");const edit=normalizeMediaEdit(body);if(edit.offer_id&&!(character.sales_playbook?.offers??[]).some(offer=>offer.id===edit.offer_id&&offer.active))throw new ChatAdminMediaError("invalid_media_offer");await updateMediaAsset(workspace.id,characterId,asset,edit);}
  }
  return NextResponse.json({...await loadCharacterMedia(workspace.id,characterId),character:await assertMediaCharacter(workspace.id,characterId,undefined,method==="DELETE")},{headers:privateHeaders});
 }catch(error){return failure(error);}
}
export const POST=(request:NextRequest)=>mutate(request,"POST");
export const PATCH=(request:NextRequest)=>mutate(request,"PATCH");
export const DELETE=(request:NextRequest)=>mutate(request,"DELETE");
