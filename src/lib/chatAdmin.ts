import { cookies } from "next/headers";
import { getSupabaseHeaders, getSupabaseRestUrl, SUPABASE_ACCESS_TOKEN_COOKIE } from "@/lib/supabase/config";
import { requireActiveAuthorizedWorkspace, WorkspaceAuthorizationError } from "@/lib/workspaceAuthorization";

export type ChatCharacter = { id:string; workspace_id:string; display_name:string; profile_image_path:string|null; public_age:number; bio:string; location:string|null; languages:string[]; personality:string; writing_style:string; emoji_style:string; sentence_style:string; typical_phrases:string[]; forbidden_phrases:string[]; flirt_style:string; sales_rules:string; example_messages:string[]; status:"active"|"inactive"; revision:number; created_at:string; updated_at:string };

async function token() { return (await cookies()).get(SUPABASE_ACCESS_TOKEN_COOKIE)?.value; }
async function rest<T>(path:string, init:RequestInit = {}):Promise<T> {
  const accessToken = await token();
  if (!accessToken) throw new WorkspaceAuthorizationError("Keine aktive Session.", "unauthenticated");
  const response = await fetch(`${getSupabaseRestUrl(path)}`, { ...init, headers:{...getSupabaseHeaders(accessToken), ...(init.headers ?? {})}, cache:"no-store" });
  if (!response.ok) throw new Error(`chat_admin_store_${response.status}`);
  return response.status === 204 ? ([] as T) : response.json();
}
export async function requireChatAdminCapability() {
  const context = await requireActiveAuthorizedWorkspace();
  if (context.workspace.role.toLowerCase() !== "owner") throw new WorkspaceAuthorizationError("Owner erforderlich.", "resource_forbidden");
  let rows:Array<{workspace_id:string;chat_admin_multi_character:boolean}>;
  try { rows = await rest<Array<{workspace_id:string;chat_admin_multi_character:boolean}>>(`workspace_chat_admin_capabilities?workspace_id=eq.${encodeURIComponent(context.workspace.id)}&select=workspace_id,chat_admin_multi_character&limit=2`); }
  catch { throw new WorkspaceAuthorizationError("ChatAdmin-Capability nicht verfügbar.", "resource_forbidden"); }
  if (rows.length !== 1 || rows[0].workspace_id !== context.workspace.id || rows[0].chat_admin_multi_character !== true) throw new WorkspaceAuthorizationError("ChatAdmin-Capability fehlt.", "resource_forbidden");
  return context;
}
export async function hasChatAdminCapability():Promise<boolean> { try { await requireChatAdminCapability(); return true; } catch { return false; } }
export async function listChatCharacters(workspaceId:string) { return rest<ChatCharacter[]>(`chat_characters?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=*&order=display_name.asc`); }
export async function getChatCharacter(workspaceId:string,id:string) { const rows=await rest<ChatCharacter[]>(`chat_characters?workspace_id=eq.${encodeURIComponent(workspaceId)}&id=eq.${encodeURIComponent(id)}&select=*&limit=2`); if(rows.length!==1 || rows[0].workspace_id!==workspaceId) throw new WorkspaceAuthorizationError("Character nicht freigegeben.","resource_forbidden"); return rows[0]; }
export async function createChatCharacter(workspaceId:string,userId:string,data:Record<string,unknown>) { const rows=await rest<ChatCharacter[]>("chat_characters",{method:"POST",headers:{"Content-Type":"application/json",Prefer:"return=representation"},body:JSON.stringify({...data,workspace_id:workspaceId,created_by_user_id:userId})}); if(rows.length!==1) throw new Error("character_create_failed"); return rows[0]; }
export async function updateChatCharacter(workspaceId:string,id:string,revision:number,data:Record<string,unknown>) { const rows=await rest<ChatCharacter[]>(`chat_characters?workspace_id=eq.${encodeURIComponent(workspaceId)}&id=eq.${encodeURIComponent(id)}&revision=eq.${revision}`,{method:"PATCH",headers:{"Content-Type":"application/json",Prefer:"return=representation"},body:JSON.stringify({...data,revision:revision+1,updated_at:new Date().toISOString()})}); if(rows.length!==1) throw new WorkspaceAuthorizationError("Character-Revision ungültig.","resource_forbidden"); return rows[0]; }
export async function deleteChatCharacter(workspaceId:string,id:string,revision:number) { const rows=await rest<Array<{id:string}>>(`chat_characters?workspace_id=eq.${encodeURIComponent(workspaceId)}&id=eq.${encodeURIComponent(id)}&revision=eq.${revision}`,{method:"DELETE",headers:{Prefer:"return=representation"}}); if(rows.length!==1) throw new WorkspaceAuthorizationError("Character nicht freigegeben.","resource_forbidden"); }
