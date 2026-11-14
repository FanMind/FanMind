import { NextRequest, NextResponse } from "next/server";
import { requireChatAdminCapability } from "@/lib/chatAdmin";
import { assertMediaCharacter, getMediaAsset, loadCharacterMedia, mediaObject, mediaRest, mediaVideoEnabled, requireMediaCatalogue, updateMediaAsset, type MediaAsset } from "@/lib/chatAdminMedia";
import { ChatAdminMediaError, MEDIA_MAX_BYTES, MEDIA_MAX_ITEMS, mediaId, mediaText } from "@/lib/chatAdminMediaPolicy.mjs";
import { MEDIA_VIDEO_MAX_BYTES, mediaKind, mediaPriceRules, normalizeMediaFolder, validateMediaFolders, withMediaPrice } from "@/lib/chatAdminMediaCatalogue.mjs";
import { normalizeMediaImage } from "@/lib/chatAdminMediaImage";
import { normalizeMediaVideo } from "@/lib/chatAdminMediaVideo";
import { isTrustedFanMindMutationRequest, readBoundedJsonRequest } from "@/lib/httpMutationPolicy.mjs";
import { WorkspaceAuthorizationError } from "@/lib/workspaceAuthorization";
import { consumeSharedRateLimit } from "@/lib/sharedRateLimit";
export const runtime="nodejs";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
function failure(error:unknown){
 if(error instanceof WorkspaceAuthorizationError)return NextResponse.json({error:error.code},{status:error.code==="unauthenticated"?401:403,headers});
 const code=error instanceof ChatAdminMediaError?error.code:"media_catalogue_unavailable";
 return NextResponse.json({error:code},{status:code==="stale_media_context"||code==="media_folder_not_empty"?409:code.endsWith("not_enabled")||code.endsWith("unavailable")||code==="media_processing_busy"?503:400,headers});
}
async function change(request:NextRequest,upload:boolean){
 if(!isTrustedFanMindMutationRequest(request))return NextResponse.json({error:"untrusted_origin"},{status:403,headers});
 try{
  const {workspace,user}=await requireChatAdminCapability();requireMediaCatalogue();
  const parsed=await readBoundedJsonRequest(request,upload?35_100_000:32_000);
  if(!parsed.ok||!parsed.value||typeof parsed.value!=="object"||Array.isArray(parsed.value))throw new ChatAdminMediaError("invalid_media_body");
  const body=parsed.value as Record<string,unknown>,characterId=mediaId(body.character_id);
  if(!Number.isSafeInteger(body.character_revision))throw new ChatAdminMediaError("invalid_media_binding");
  const character=await assertMediaCharacter(workspace.id,characterId,body.character_revision as number);
  const library=await loadCharacterMedia(workspace.id,characterId),folders=validateMediaFolders(character,library.folders);
  const rate=await consumeSharedRateLimit({scope:upload?"chat_admin_media_catalogue_upload":"chat_admin_media_catalogue_edit",subject:user.id,maxRequests:20,windowMs:upload?600_000:60_000});
  if(!rate.allowed)return NextResponse.json({error:"rate_limited"},{status:429,headers});
  if(upload){
   const kind=mediaKind(body.media_type) as "image"|"video";
   if(kind==="video"&&!mediaVideoEnabled())throw new ChatAdminMediaError("media_video_not_enabled");
   if(body.rights_confirmed!==true)throw new ChatAdminMediaError("media_rights_required");
   if(library.assets.length>=MEDIA_MAX_ITEMS)throw new ChatAdminMediaError("media_library_limit");
   const folderId=body.folder_id===null?null:mediaId(body.folder_id);
   if(folderId&&folders.get(folderId)?.kind!==kind)throw new ChatAdminMediaError("media_folder_binding_invalid");
   const max=kind==="image"?MEDIA_MAX_BYTES:MEDIA_VIDEO_MAX_BYTES;
   if(typeof body.data!=="string"||!body.data.length||body.data.length>Math.ceil(max/3)*4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(body.data))throw new ChatAdminMediaError("invalid_media_file");
   const input=Buffer.from(body.data,"base64");
   if(kind==="video"){
    const budget=await consumeSharedRateLimit({scope:"chat_admin_media_video_processing",subject:workspace.id,maxRequests:2,windowMs:60_000});
    if(!budget.allowed)return NextResponse.json({error:"rate_limited"},{status:429,headers});
   }
   const normalized=kind==="video"?await normalizeMediaVideo(input):{bytes:await normalizeMediaImage(input),duration_ms:null};
   const authority=await requireChatAdminCapability();
   if(authority.workspace.id!==workspace.id||authority.user.id!==user.id)throw new WorkspaceAuthorizationError("Kontext geändert.","resource_forbidden");
   await assertMediaCharacter(workspace.id,characterId,character.revision);
   const rows=await mediaRest<MediaAsset[]>("chat_character_media",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({id:crypto.randomUUID(),workspace_id:workspace.id,character_id:characterId,media_type:kind,folder_id:folderId,original_filename:mediaText(body.original_name??"",255),byte_size:normalized.bytes.length,duration_ms:normalized.duration_ms})});
   if(rows.length!==1)throw new ChatAdminMediaError("media_store_unavailable");
   try{await mediaObject(workspace.id,characterId,rows[0].id,"POST",normalized.bytes,kind);await mediaObject(workspace.id,characterId,rows[0].id,"PROBE",undefined,kind);await updateMediaAsset(workspace.id,characterId,rows[0],{available:true});}
   catch{await updateMediaAsset(workspace.id,characterId,rows[0],{deleted:true,available:false,reviewed:false});throw new ChatAdminMediaError("media_upload_incomplete");}
  }else{
   let payload:Record<string,unknown>,playbook=character.sales_playbook;
   if(body.action==="save_folder"){
    if(!body.folder||typeof body.folder!=="object"||Array.isArray(body.folder))throw new ChatAdminMediaError("invalid_media_folder");
    const supplied=body.folder as Record<string,unknown>,id=mediaId(supplied.id),previous=folders.get(id);
    const price=withMediaPrice(character,id,body.price,previous?.offer_id??"");playbook=price.playbook;
    const rules=body.price===null?mediaPriceRules():mediaPriceRules({negotiation_allowed:(body.price as Record<string,unknown>)?.negotiation_allowed,special_discounts_allowed:(body.price as Record<string,unknown>)?.special_discounts_allowed});
    payload=normalizeMediaFolder({...supplied,offer_id:price.offer_id,price_rules:rules},character,library.folders);
   }else if(body.action==="delete_folder"){
    const folder=folders.get(mediaId(body.id));
    if(!folder||folder.revision!==body.revision)throw new ChatAdminMediaError("stale_media_context");
    if(library.folders.some(f=>f.parent_id===folder.id)||library.assets.some(a=>a.folder_id===folder.id))throw new ChatAdminMediaError("media_folder_not_empty");
    payload={id:folder.id,revision:folder.revision};
   }else if(body.action==="move_asset"||body.action==="save_asset_price"){
    const asset=await getMediaAsset(workspace.id,characterId,mediaId(body.id));
    if(asset.deleted||asset.revision!==body.revision)throw new ChatAdminMediaError("stale_media_context");
    payload={id:asset.id,revision:asset.revision};
    if(body.action==="move_asset"){
     const folderId=body.folder_id===null?null:mediaId(body.folder_id);
     if(folderId&&folders.get(folderId)?.kind!==(asset.media_type??"image"))throw new ChatAdminMediaError("media_folder_binding_invalid");payload.folder_id=folderId;
    }else{
     const price=withMediaPrice(character,asset.id,body.price,asset.offer_id);playbook=price.playbook;
     payload.offer_id=price.offer_id;payload.price_rules=body.price===null?mediaPriceRules():mediaPriceRules({negotiation_allowed:(body.price as Record<string,unknown>)?.negotiation_allowed,special_discounts_allowed:(body.price as Record<string,unknown>)?.special_discounts_allowed});
    }
   }else throw new ChatAdminMediaError("invalid_media_action");
   const saved=await mediaRest("rpc/chat_admin_media_catalogue_write",{method:"POST",body:JSON.stringify({p_workspace:workspace.id,p_character:characterId,p_character_revision:character.revision,p_action:body.action,p_payload:payload,p_playbook:playbook})});
   if(saved!==true)throw new ChatAdminMediaError("stale_media_context");
  }
  return NextResponse.json({...await loadCharacterMedia(workspace.id,characterId),character:await assertMediaCharacter(workspace.id,characterId)},{headers});
 }catch(error){return failure(error);}
}
export const POST=(request:NextRequest)=>change(request,true);
export const PATCH=(request:NextRequest)=>change(request,false);
