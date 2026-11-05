import { cookies } from "next/headers";
import { getSupabaseHeaders, getSupabaseRestUrl, requireSupabasePublicConfig, SUPABASE_ACCESS_TOKEN_COOKIE } from "./supabase/config";
import { getChatCharacter } from "./chatAdmin";
import { WorkspaceAuthorizationError } from "./workspaceAuthorization";
import { attachMediaGrounding, ChatAdminMediaError, MEDIA_BUCKET, MEDIA_MAX_BYTES, MEDIA_MAX_ITEMS, mediaId } from "./chatAdminMediaPolicy.mjs";
import type { ChatCharacter, ChatCharacterFan } from "./chatAdmin";

export type MediaAsset={id:string;workspace_id:string;character_id:string;description:string;tags:string[];folder:string;offer_id:string;reviewed:boolean;available:boolean;deleted:boolean;revision:number};
export type CustomMediaPolicy={enabled:boolean;offer_id:string;delivery_hours:number|null;motifs:string[];requires_confirmation:boolean;revision:number};
export const emptyCustomMediaPolicy:CustomMediaPolicy={enabled:false,offer_id:"",delivery_hours:null,motifs:[],requires_confirmation:true,revision:0};
export const mediaEnabled=()=>process.env.FANMIND_CHAT_ADMIN_MEDIA_ENABLED==="true";
export function requireMediaEnabled(){if(!mediaEnabled())throw new ChatAdminMediaError("media_not_enabled");}
export async function mediaRest<T>(path:string,init:RequestInit={}):Promise<T>{
  const token=(await cookies()).get(SUPABASE_ACCESS_TOKEN_COOKIE)?.value;
  if(!token)throw new WorkspaceAuthorizationError("Keine aktive Session.","unauthenticated");
  const response=await fetch(getSupabaseRestUrl(path),{...init,headers:{...getSupabaseHeaders(token),"Content-Type":"application/json",...init.headers},cache:"no-store",signal:AbortSignal.timeout(10_000)});
  if(!response.ok)throw new ChatAdminMediaError("media_store_unavailable");
  return response.status===204?[] as T:response.json();
}
export const mediaScope=(workspaceId:string,characterId:string)=>`workspace_id=eq.${mediaId(workspaceId)}&character_id=eq.${mediaId(characterId)}`;
export async function loadCharacterMedia(workspaceId:string,characterId:string){
  const scope=mediaScope(workspaceId,characterId);
  const [assets,policies]=await Promise.all([
    mediaRest<MediaAsset[]>(`chat_character_media?${scope}&select=*&order=id.asc&limit=${MEDIA_MAX_ITEMS+1}`),
    mediaRest<CustomMediaPolicy[]>(`chat_character_media_policies?${scope}&select=*&limit=2`),
  ]);
  if(assets.length>MEDIA_MAX_ITEMS||policies.length>1)throw new ChatAdminMediaError("media_library_limit");
  return {assets,policy:policies[0]??emptyCustomMediaPolicy};
}
export async function getMediaAsset(workspaceId:string,characterId:string,id:string){
  const rows=await mediaRest<MediaAsset[]>(`chat_character_media?${mediaScope(workspaceId,characterId)}&id=eq.${mediaId(id)}&select=*&limit=2`);
  if(rows.length!==1||rows[0].workspace_id!==workspaceId||rows[0].character_id!==characterId)throw new WorkspaceAuthorizationError("Bild nicht freigegeben.","resource_forbidden");
  return rows[0];
}
export function mediaObjectPath(workspaceId:string,characterId:string,id:string){return `${mediaId(workspaceId)}/${mediaId(characterId)}/${mediaId(id)}.webp`;}
export async function mediaObject(workspaceId:string,characterId:string,id:string,method:"GET"|"POST"|"DELETE",bytes?:Buffer){
  const token=(await cookies()).get(SUPABASE_ACCESS_TOKEN_COOKIE)?.value;
  if(!token)throw new WorkspaceAuthorizationError("Keine aktive Session.","unauthenticated");
  const path=mediaObjectPath(workspaceId,characterId,id);
  const url=`${requireSupabasePublicConfig().url}/storage/v1/object/${method==="GET"?"authenticated/":""}${MEDIA_BUCKET}${method==="DELETE"?"":`/${path}`}`;
  const response=await fetch(url,{method,headers:{...getSupabaseHeaders(token),...(method==="DELETE"?{"Content-Type":"application/json"}:bytes?{"Content-Type":"image/webp","x-upsert":"false"}:{})},body:method==="DELETE"?JSON.stringify({prefixes:[path]}):bytes?new Uint8Array(bytes):undefined,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(15_000)});
  if(!response.ok)throw new ChatAdminMediaError("media_object_unavailable");
  if(method==="DELETE"){
    const result=await response.json();
    if(Array.isArray(result)&&result.length===1&&result[0]?.name===path)return Buffer.alloc(0);
    if(!Array.isArray(result)||result.length!==0)throw new ChatAdminMediaError("media_cleanup_unverified");
    // Retry after a successful object delete but interrupted metadata cleanup.
    const check=await fetch(`${requireSupabasePublicConfig().url}/storage/v1/object/authenticated/${MEDIA_BUCKET}/${path}`,{headers:getSupabaseHeaders(token),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(10_000)});
    await check.body?.cancel();
    if(check.status!==404)throw new ChatAdminMediaError("media_cleanup_unverified");
    return Buffer.alloc(0);
  }
  if(method!=="GET")return Buffer.alloc(0);
  // Bound actual bytes, even if Content-Length is missing or dishonest.
  const reader=response.body?.getReader();if(!reader)throw new ChatAdminMediaError("invalid_image");
  const chunks:Uint8Array[]=[];let length=0;
  try{while(true){const item=await reader.read();if(item.done)break;length+=item.value.length;if(length>MEDIA_MAX_BYTES)throw new ChatAdminMediaError("invalid_image_size");chunks.push(item.value);}}
  finally{await reader.cancel().catch(()=>{});}
  return Buffer.concat(chunks);
}
export async function assertMediaCharacter(workspaceId:string,characterId:string,revision?:number,allowInactive=false){
  const character=await getChatCharacter(workspaceId,mediaId(characterId));
  if(!allowInactive&&character.status!=="active"||revision!==undefined&&character.revision!==revision)throw new ChatAdminMediaError("stale_media_context");
  return character;
}
export async function updateMediaAsset(workspaceId:string,characterId:string,asset:MediaAsset,patch:Record<string,unknown>){
  const rows=await mediaRest<MediaAsset[]>(`chat_character_media?${mediaScope(workspaceId,characterId)}&id=eq.${mediaId(asset.id)}&revision=eq.${asset.revision}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify(patch)});
  if(rows.length!==1)throw new ChatAdminMediaError("stale_media_context");return rows[0];
}
export async function groundChatAdminContext(context:string,character:ChatCharacter,fan:ChatCharacterFan|null,incoming:unknown,now:number){
  if(!mediaEnabled())return context;
  const {assets,policy}=await loadCharacterMedia(character.workspace_id,character.id);
  const grounded=attachMediaGrounding(context,character,fan,assets,policy,incoming,now);
  const matches=JSON.parse(grounded).media_inventory.matches as Array<{id:string}>;
  for(const match of matches)await mediaObject(character.workspace_id,character.id,match.id,"GET");
  return grounded;
}
