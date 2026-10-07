import { cookies } from "next/headers";
import { getSupabaseHeaders, getSupabaseRestUrl, SUPABASE_ACCESS_TOKEN_COOKIE } from "@/lib/supabase/config";
import { requireActiveAuthorizedWorkspace, WorkspaceAuthorizationError } from "@/lib/workspaceAuthorization";
import type { CreatorPlaybook } from "@/lib/creatorIntelligencePolicy.mjs";

export type ChatCharacter = { id:string; workspace_id:string; display_name:string; profile_image_path:string|null; public_age:number; bio:string; location:string|null; languages:string[]; personality:string; writing_style:string; emoji_style:string; sentence_style:string; typical_phrases:string[]; forbidden_phrases:string[]; flirt_style:string; sales_rules:string; sales_playbook?:CreatorPlaybook; example_messages:string[]; status:"active"|"inactive"; revision:number; created_at:string; updated_at:string };
export type ChatCharacterFan = { id:string; workspace_id:string; character_id:string; display_name:string; handle:string|null; platform:string; language:string|null; status:"active"|"inactive"; customer_tier:"red"|"blue"|"yellow"|"green"; summary:string; notes:string; revision:number; created_at:string; updated_at:string };
export type ChatCharacterConversation = { id:string; workspace_id:string; character_id:string; fan_id:string; fan_reference:string; created_at:string; updated_at:string };
export type ChatCharacterMessage = { id:string; workspace_id:string; character_id:string; fan_id:string; conversation_id:string; generation_id:string|null; direction:"fan_inbound"|"suggested_reply"|"confirmed_reply"; content:string; character_revision:number; sequence:number; created_at:string };

async function token() { return (await cookies()).get(SUPABASE_ACCESS_TOKEN_COOKIE)?.value; }
async function rest<T>(path:string, init:RequestInit = {}):Promise<T> {
  const accessToken = await token();
  if (!accessToken) throw new WorkspaceAuthorizationError("Keine aktive Session.", "unauthenticated");
  const response = await fetch(`${getSupabaseRestUrl(path)}`, { ...init, headers:{...getSupabaseHeaders(accessToken), ...(init.headers ?? {})}, cache:"no-store" });
  if (!response.ok) throw new Error(`chat_admin_store_${response.status}`);
  return response.status === 204 ? ([] as T) : response.json();
}
async function ensureStagingChatAdminCapability(workspaceId:string,userId:string):Promise<boolean> {
  if(process.env.FANMIND_RUNTIME_ENVIRONMENT!=="staging")return false;
  const previewWorkspaceId=process.env.FANMIND_CHAT_ADMIN_PREVIEW_WORKSPACE_ID?.trim();
  const previewUserId=process.env.FANMIND_CHAT_ADMIN_PREVIEW_USER_ID?.trim();
  if(!previewWorkspaceId||!previewUserId||workspaceId!==previewWorkspaceId||userId!==previewUserId)return false;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if(!serviceKey)return false;
  const url=new URL(getSupabaseRestUrl("workspace_chat_admin_capabilities"));
  url.searchParams.set("on_conflict","workspace_id");
  const response=await fetch(url,{
    method:"POST",
    headers:{...getSupabaseHeaders(serviceKey),"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"},
    body:JSON.stringify({workspace_id:workspaceId,chat_admin_multi_character:true,granted_to_user_id:userId,updated_at:new Date().toISOString()}),
    cache:"no-store",
  });
  return response.ok;
}
export function isChatAdminFanRuntimeEnabled():boolean {
  return process.env.FANMIND_CHAT_ADMIN_CHARACTER_FANS_ENABLED==="true"||process.env.FANMIND_RUNTIME_ENVIRONMENT==="staging";
}
export async function requireChatAdminCapability() {
  const context = await requireActiveAuthorizedWorkspace();
  if (context.workspace.role.toLowerCase() !== "owner") throw new WorkspaceAuthorizationError("Owner erforderlich.", "resource_forbidden");
  let rows:Array<{workspace_id:string;chat_admin_multi_character:boolean}>;
  try { rows = await rest<Array<{workspace_id:string;chat_admin_multi_character:boolean}>>(`workspace_chat_admin_capabilities?workspace_id=eq.${encodeURIComponent(context.workspace.id)}&select=workspace_id,chat_admin_multi_character&limit=2`); }
  catch { throw new WorkspaceAuthorizationError("ChatAdmin-Capability nicht verfügbar.", "resource_forbidden"); }
  if((rows.length!==1||rows[0].workspace_id!==context.workspace.id||rows[0].chat_admin_multi_character!==true)&&await ensureStagingChatAdminCapability(context.workspace.id,context.user.id)){
    rows=await rest<Array<{workspace_id:string;chat_admin_multi_character:boolean}>>(`workspace_chat_admin_capabilities?workspace_id=eq.${encodeURIComponent(context.workspace.id)}&select=workspace_id,chat_admin_multi_character&limit=2`);
  }
  if (rows.length !== 1 || rows[0].workspace_id !== context.workspace.id || rows[0].chat_admin_multi_character !== true) throw new WorkspaceAuthorizationError("ChatAdmin-Capability fehlt.", "resource_forbidden");
  return context;
}
export async function hasChatAdminCapability():Promise<boolean> { try { await requireChatAdminCapability(); return true; } catch { return false; } }
export function requireChatAdminFanRuntime() { if(!isChatAdminFanRuntimeEnabled()) throw new WorkspaceAuthorizationError("ChatAdmin-Fans sind nicht aktiviert.","resource_forbidden"); }
export async function hasChatAdminFanSchema(workspaceId:string):Promise<boolean> {
  if(!isChatAdminFanRuntimeEnabled())return false;
  const workspace=encodeURIComponent(workspaceId);
  try {
    const results=await Promise.all([
      rest(`chat_character_fans?workspace_id=eq.${workspace}&select=id,workspace_id,character_id,display_name,handle,platform,language,status,summary,notes,creation_id,revision,created_at,updated_at&limit=0`),
      rest(`chat_character_conversations?workspace_id=eq.${workspace}&select=id,workspace_id,character_id,fan_id,fan_reference,created_at,updated_at&limit=0`),
      rest(`chat_character_messages?workspace_id=eq.${workspace}&select=id,workspace_id,character_id,fan_id,conversation_id,generation_id,direction,content,character_revision,sequence,created_at&limit=0`),
      rest<boolean>("rpc/chat_admin_fan_schema_ready",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"}),
    ]);
    return results[3]===true;
  }
  catch { return false; }
}
export async function hasChatAdminStructuredOffersSchema(workspaceId:string):Promise<boolean> {
  try {
    await rest(`chat_characters?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=sales_playbook&limit=0`);
    return true;
  }
  catch { return false; }
}
export async function listChatCharacters(workspaceId:string) { return rest<ChatCharacter[]>(`chat_characters?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=*&order=display_name.asc`); }
export async function getChatCharacter(workspaceId:string,id:string) { const rows=await rest<ChatCharacter[]>(`chat_characters?workspace_id=eq.${encodeURIComponent(workspaceId)}&id=eq.${encodeURIComponent(id)}&select=*&limit=2`); if(rows.length!==1 || rows[0].workspace_id!==workspaceId) throw new WorkspaceAuthorizationError("Character nicht freigegeben.","resource_forbidden"); return rows[0]; }
export async function createChatCharacter(workspaceId:string,userId:string,data:Record<string,unknown>) { const rows=await rest<ChatCharacter[]>("chat_characters",{method:"POST",headers:{"Content-Type":"application/json",Prefer:"return=representation"},body:JSON.stringify({...data,workspace_id:workspaceId,created_by_user_id:userId})}); if(rows.length!==1) throw new Error("character_create_failed"); return rows[0]; }
export async function updateChatCharacter(workspaceId:string,id:string,revision:number,data:Record<string,unknown>) { const rows=await rest<ChatCharacter[]>(`chat_characters?workspace_id=eq.${encodeURIComponent(workspaceId)}&id=eq.${encodeURIComponent(id)}&revision=eq.${revision}`,{method:"PATCH",headers:{"Content-Type":"application/json",Prefer:"return=representation"},body:JSON.stringify({...data,revision:revision+1,updated_at:new Date().toISOString()})}); if(rows.length!==1) throw new WorkspaceAuthorizationError("Character-Revision ungültig.","resource_forbidden"); return rows[0]; }
export async function deleteChatCharacter(workspaceId:string,id:string,revision:number) { const rows=await rest<Array<{id:string}>>(`chat_characters?workspace_id=eq.${encodeURIComponent(workspaceId)}&id=eq.${encodeURIComponent(id)}&revision=eq.${revision}`,{method:"DELETE",headers:{Prefer:"return=representation"}}); if(rows.length!==1) throw new WorkspaceAuthorizationError("Character nicht freigegeben.","resource_forbidden"); }
export type ChatCharacterFanListItem = Pick<ChatCharacterFan,"id"|"character_id"|"display_name"|"handle"|"platform"|"status"|"customer_tier"|"revision">;
export async function listChatFans(workspaceId:string,characterId:string,offset:number,limit:number) { return rest<ChatCharacterFanListItem[]>(`chat_character_fans?workspace_id=eq.${encodeURIComponent(workspaceId)}&character_id=eq.${encodeURIComponent(characterId)}&select=id,character_id,display_name,handle,platform,status,customer_tier,revision&order=display_name.asc,id.asc&offset=${offset}&limit=${limit}`); }
export async function getChatFan(workspaceId:string,characterId:string,fanId:string) { const rows=await rest<ChatCharacterFan[]>(`chat_character_fans?workspace_id=eq.${encodeURIComponent(workspaceId)}&character_id=eq.${encodeURIComponent(characterId)}&id=eq.${encodeURIComponent(fanId)}&select=*&limit=2`); if(rows.length!==1) throw new WorkspaceAuthorizationError("Fan nicht freigegeben.","resource_forbidden"); return rows[0]; }
export async function createChatFan(workspaceId:string,characterId:string,creationId:string,data:Record<string,unknown>) { await getChatCharacter(workspaceId,characterId); const rows=await rest<ChatCharacterFan[]>("rpc/create_chat_admin_fan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({target_workspace_id:workspaceId,target_character_id:characterId,target_creation_id:creationId,fan_data:data})}); if(rows.length!==1)throw new Error("fan_create_failed"); return rows[0]; }
export async function updateChatFan(workspaceId:string,characterId:string,fanId:string,revision:number,data:Record<string,unknown>) { const rows=await rest<ChatCharacterFan[]>(`chat_character_fans?workspace_id=eq.${encodeURIComponent(workspaceId)}&character_id=eq.${encodeURIComponent(characterId)}&id=eq.${encodeURIComponent(fanId)}&revision=eq.${revision}`,{method:"PATCH",headers:{"Content-Type":"application/json",Prefer:"return=representation"},body:JSON.stringify({...data,revision:revision+1,updated_at:new Date().toISOString()})}); if(rows.length!==1)throw new WorkspaceAuthorizationError("Fan-Revision ungültig.","resource_forbidden"); return rows[0]; }
export async function deleteChatFan(workspaceId:string,characterId:string,fanId:string,revision:number) { const rows=await rest<Array<{id:string}>>(`chat_character_fans?workspace_id=eq.${encodeURIComponent(workspaceId)}&character_id=eq.${encodeURIComponent(characterId)}&id=eq.${encodeURIComponent(fanId)}&revision=eq.${revision}`,{method:"DELETE",headers:{Prefer:"return=representation"}}); if(rows.length!==1)throw new WorkspaceAuthorizationError("Fan nicht freigegeben.","resource_forbidden"); }
export async function getFanConversation(workspaceId:string,characterId:string,fanId:string) { const rows=await rest<ChatCharacterConversation[]>(`chat_character_conversations?workspace_id=eq.${encodeURIComponent(workspaceId)}&character_id=eq.${encodeURIComponent(characterId)}&fan_id=eq.${encodeURIComponent(fanId)}&select=*&order=created_at.asc&limit=2`); if(rows.length!==1)throw new WorkspaceAuthorizationError("Conversation nicht freigegeben.","resource_forbidden"); return rows[0]; }
export async function getChatConversation(workspaceId:string,characterId:string,fanId:string,conversationId:string) { const rows=await rest<ChatCharacterConversation[]>(`chat_character_conversations?workspace_id=eq.${encodeURIComponent(workspaceId)}&character_id=eq.${encodeURIComponent(characterId)}&fan_id=eq.${encodeURIComponent(fanId)}&id=eq.${encodeURIComponent(conversationId)}&select=*&limit=2`); if(rows.length!==1)throw new WorkspaceAuthorizationError("Conversation nicht freigegeben.","resource_forbidden"); return rows[0]; }
export async function listChatMessages(workspaceId:string,characterId:string,fanId:string,conversationId:string) { const rows=await rest<ChatCharacterMessage[]>(`chat_character_messages?workspace_id=eq.${encodeURIComponent(workspaceId)}&character_id=eq.${encodeURIComponent(characterId)}&fan_id=eq.${encodeURIComponent(fanId)}&conversation_id=eq.${encodeURIComponent(conversationId)}&select=*&order=sequence.desc&limit=100`); return rows.reverse(); }
export async function listRecentChatMessages(workspaceId:string,characterId:string,fanId:string,conversationId:string) { const rows=await rest<ChatCharacterMessage[]>(`chat_character_messages?workspace_id=eq.${encodeURIComponent(workspaceId)}&character_id=eq.${encodeURIComponent(characterId)}&fan_id=eq.${encodeURIComponent(fanId)}&conversation_id=eq.${encodeURIComponent(conversationId)}&select=*&order=sequence.desc&limit=20`); return rows.reverse(); }
export async function getChatAdminGeneration(workspaceId:string,characterId:string,fanId:string,conversationId:string,generationId:string) { return rest<ChatCharacterMessage[]>(`chat_character_messages?workspace_id=eq.${encodeURIComponent(workspaceId)}&character_id=eq.${encodeURIComponent(characterId)}&fan_id=eq.${encodeURIComponent(fanId)}&conversation_id=eq.${encodeURIComponent(conversationId)}&generation_id=eq.${encodeURIComponent(generationId)}&select=*&order=sequence.asc&limit=5`); }
export async function persistChatAdminGeneration(workspaceId:string,characterId:string,fanId:string,conversationId:string,characterRevision:number,fanRevision:number,generationId:string,historyIds:string[],incoming:string,replies:string[]) { return rest<string[]>("rpc/persist_chat_admin_generation",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({target_workspace_id:workspaceId,target_character_id:characterId,target_fan_id:fanId,target_conversation_id:conversationId,target_character_revision:characterRevision,target_fan_revision:fanRevision,target_generation_id:generationId,expected_history_ids:historyIds,inbound_content:incoming,suggested_contents:replies})}); }
export async function persistChatAdminConfirmedReply(workspaceId:string,characterId:string,fanId:string,conversationId:string,characterRevision:number,fanRevision:number,confirmationId:string,content:string) { const rows=await rest<ChatCharacterMessage[]>("rpc/persist_chat_admin_confirmed_reply",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({target_workspace_id:workspaceId,target_character_id:characterId,target_fan_id:fanId,target_conversation_id:conversationId,target_character_revision:characterRevision,target_fan_revision:fanRevision,target_confirmation_id:confirmationId,reply_content:content})}); if(rows.length!==1)throw new Error("confirmed_reply_result_invalid"); return rows[0]; }
