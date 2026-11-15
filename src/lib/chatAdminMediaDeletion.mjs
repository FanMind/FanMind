import { MEDIA_BUCKET, MEDIA_UUID } from "./chatAdminMediaPolicy.mjs";
import { isChatAdminStorageObjectAbsent } from "./chatAdminStorageAbsence.mjs";

// Used only inside the existing explicitly gated account-deletion processor,
// after its atomic owned-Workspace inventory. No independent execution path.
export async function deleteOwnedChatAdminMedia({fetchImpl,config,workspaceIds}) {
 const headers={apikey:config.serviceKey,Authorization:`Bearer ${config.serviceKey}`,"Content-Type":"application/json"};
 for(const workspaceId of workspaceIds){
  if(!MEDIA_UUID.test(workspaceId))throw new Error("media_deletion_binding_invalid");
  const base=`${config.supabaseUrl}/rest/v1/chat_character_media?workspace_id=eq.${workspaceId}`;
  const inventory=async columns=>{const response=await fetchImpl(`${base}&select=${columns}&order=id.asc&limit=1001`,{headers,cache:"no-store",signal:AbortSignal.timeout(15000)});return {response,rows:await response.json()};};
  let {response:listed,rows}=await inventory("id,workspace_id,character_id,media_type");
  // Old installations have only images. Do not tie erasure of existing videos
  // to a runtime flag that could have been disabled during recovery.
  if(!listed.ok&&["42703","PGRST204"].includes(rows?.code))({response:listed,rows}=await inventory("id,workspace_id,character_id"));
  if(!listed.ok){if(["42P01","PGRST205"].includes(rows?.code))continue;throw new Error("media_deletion_inventory_failed");}
  if(!Array.isArray(rows)||rows.length>1000||rows.some(row=>row.workspace_id!==workspaceId||!MEDIA_UUID.test(row.id)||!MEDIA_UUID.test(row.character_id)))throw new Error("media_deletion_binding_invalid");
  for(const row of rows){
   if(row.media_type!==undefined&&!["image","video"].includes(row.media_type))throw new Error("media_deletion_binding_invalid");
   const path=`${workspaceId}/${row.character_id}/${row.id}.${row.media_type==="video"?"mp4":"webp"}`,object=`${config.supabaseUrl}/storage/v1/object`;
   const revoked=await fetchImpl(`${base}&id=eq.${row.id}`,{method:"PATCH",headers,body:JSON.stringify({deleted:true,reviewed:false,available:false}),cache:"no-store",signal:AbortSignal.timeout(15000)});
   if(!revoked.ok)throw new Error("media_deletion_revoke_failed");
   const removed=await fetchImpl(`${object}/${MEDIA_BUCKET}`,{method:"DELETE",headers,body:JSON.stringify({prefixes:[path]}),cache:"no-store",signal:AbortSignal.timeout(15000)});
   if(!removed.ok)throw new Error("media_deletion_object_failed");
   const deletion=await removed.json();
   if(!Array.isArray(deletion)||deletion.some(item=>item.name!==path)||deletion.length>1)throw new Error("media_deletion_object_failed");
   const absent=await fetchImpl(`${object}/authenticated/${MEDIA_BUCKET}/${path}`,{headers,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(15000)});
   if(!await isChatAdminStorageObjectAbsent(absent))throw new Error("media_deletion_absence_failed");
   const cleaned=await fetchImpl(`${base}&id=eq.${row.id}&deleted=eq.true`,{method:"DELETE",headers,cache:"no-store",signal:AbortSignal.timeout(15000)});
   if(!cleaned.ok)throw new Error("media_deletion_metadata_failed");
  }
 }
}
