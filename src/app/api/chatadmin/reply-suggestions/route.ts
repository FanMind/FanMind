import { NextRequest, NextResponse } from "next/server";
import { getChatAdminGeneration, getChatCharacter, getChatConversation, getChatFan, isChatAdminFanRuntimeEnabled, listRecentChatMessages, persistChatAdminGeneration, requireChatAdminCapability, requireChatAdminFanRuntime } from "@/lib/chatAdmin";
import { assertChatAdminReplySemantics, buildChatAdminCharacterContext, buildChatAdminFanContext, CHAT_ADMIN_REPLY_INSTRUCTIONS, ChatAdminPolicyError } from "@/lib/chatAdminPolicy.mjs";
import { getFanMindAiModel, recordAiUsageEvent } from "@/lib/aiUsage";
import { isTrustedFanMindMutationRequest, readBoundedJsonRequest } from "@/lib/httpMutationPolicy.mjs";
import { consumeSharedRateLimit } from "@/lib/sharedRateLimit";
import { WorkspaceAuthorizationError } from "@/lib/workspaceAuthorization";
import { AI_REPLY_INPUT_CHAR_LIMIT } from "@/lib/aiExecutionPolicy.mjs";
const URL="https://api.openai.com/v1/responses";
export async function POST(request:NextRequest){
 if(!isTrustedFanMindMutationRequest(request))return NextResponse.json({error:"untrusted_origin"},{status:403});
 let workspaceId="",userId="",inputChars=0;let usageRecorded=false;const model=getFanMindAiModel(),started=Date.now();
 try{
  const fanMode=isChatAdminFanRuntimeEnabled();if(fanMode)requireChatAdminFanRuntime();const {workspace,user}=await requireChatAdminCapability();workspaceId=workspace.id;userId=user.id;
  const parsed=await readBoundedJsonRequest(request,16_000);if(!parsed.ok||!parsed.value||typeof parsed.value!=="object")return NextResponse.json({error:"invalid_body"},{status:400});
  const body=parsed.value as Record<string,unknown>;if(typeof body.character_id!=="string"||!Number.isInteger(body.character_revision))return NextResponse.json({error:"invalid_context_binding"},{status:400});
  if(fanMode&&(typeof body.fan_id!=="string"||typeof body.conversation_id!=="string"||typeof body.generation_id!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(body.generation_id)))return NextResponse.json({error:"invalid_context_binding"},{status:400});
  const character=await getChatCharacter(workspace.id,body.character_id);if(character.revision!==body.character_revision)return NextResponse.json({error:"stale_character_revision"},{status:409});
  const fan=fanMode?await getChatFan(workspace.id,character.id,body.fan_id as string):null;const conversation=fanMode?await getChatConversation(workspace.id,character.id,fan!.id,body.conversation_id as string):null;const history=fanMode?await listRecentChatMessages(workspace.id,character.id,fan!.id,conversation!.id):[];
  const context=fanMode?buildChatAdminFanContext(character,fan!,conversation!,history,body.incoming_message,AI_REPLY_INPUT_CHAR_LIMIT):buildChatAdminCharacterContext(character,body.incoming_message,typeof body.fan_label==="string"?body.fan_label:"");inputChars=context.length;
  const requestedOffer=(JSON.parse(context) as {sales_playbook?:{requested_offer?:Record<string,unknown>|null}}).sales_playbook?.requested_offer??null;
  if(inputChars>AI_REPLY_INPUT_CHAR_LIMIT)return NextResponse.json({error:"input_too_large"},{status:400});
  const previous=fanMode?await getChatAdminGeneration(workspace.id,character.id,fan!.id,conversation!.id,body.generation_id as string):[];if(previous.length){const inbound=previous.filter(message=>message.direction==="fan_inbound"),stored=previous.filter(message=>message.direction==="suggested_reply");if(previous.length!==4||inbound.length!==1||inbound[0].content!==String(body.incoming_message).trim()||stored.length!==3)return NextResponse.json({error:"generation_id_conflict"},{status:409});return NextResponse.json({replies:stored.map(message=>message.content),character_id:character.id,character_revision:character.revision,fan_id:fan!.id,conversation_id:conversation!.id,safety_note:"Antwort kopieren und manuell bei OnlyFans einfügen. Keine Verbindung und kein automatisches Senden."});}
  const limit=await consumeSharedRateLimit({scope:"ai_reply_user_ip",subject:`chatadmin:${user.id}`,maxRequests:20,windowMs:600_000});if(!limit.allowed)return NextResponse.json({error:"rate_limited"},{status:429});
  const key=process.env.OPENAI_API_KEY;if(!key)return NextResponse.json({error:"ai_unavailable"},{status:503});
  const response=await fetch(URL,{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model,input:[{role:"system",content:CHAT_ADMIN_REPLY_INSTRUCTIONS},{role:"user",content:context}],text:{format:{type:"json_schema",name:"chat_admin_replies",strict:true,schema:{type:"object",additionalProperties:false,required:["replies"],properties:{replies:{type:"array",minItems:3,maxItems:3,items:{type:"string",minLength:1}}}}}},max_output_tokens:900,store:false}),signal:AbortSignal.any([request.signal,AbortSignal.timeout(25_000)]),cache:"no-store"});
  const payload=await response.json() as {output_text?:string;output?:Array<{content?:Array<{text?:string}>}>;usage?:unknown};if(!response.ok)throw new Error("provider_failed");const text=payload.output_text??payload.output?.flatMap(v=>v.content??[]).map(v=>v.text??"").join("")??"";const result=JSON.parse(text) as {replies:unknown};const replies=assertChatAdminReplySemantics(result.replies,body.incoming_message,requestedOffer);
  await recordAiUsageEvent({workspaceId,userId,feature:"chat_admin_reply",model,inputChars,outputChars:replies.join("").length,status:"ok",latencyMs:Date.now()-started,sourceRoute:"/api/chatadmin/reply-suggestions",providerUsage:payload.usage});usageRecorded=true;
  // A model call can outlive a capability, Workspace selection or Character edit.
  // Reload with the user's authority before returning any generated content.
  const currentAuthority = await requireChatAdminCapability();
  if (currentAuthority.workspace.id !== workspaceId || currentAuthority.user.id !== userId) {
    throw new WorkspaceAuthorizationError("ChatAdmin-Kontext hat sich geändert.", "resource_forbidden");
  }
  const currentCharacter = await getChatCharacter(workspaceId, character.id);
  const currentFan = fanMode ? await getChatFan(workspaceId, currentCharacter.id, fan!.id) : null;
  const currentConversation = fanMode ? await getChatConversation(workspaceId, currentCharacter.id, currentFan!.id, conversation!.id) : null;
  const currentHistory = fanMode ? await listRecentChatMessages(workspaceId, currentCharacter.id, currentFan!.id, currentConversation!.id) : [];
  if (
    currentCharacter.revision !== character.revision ||
    currentCharacter.status !== "active" ||
    (fanMode ? buildChatAdminFanContext(currentCharacter, currentFan!, currentConversation!, currentHistory, body.incoming_message,AI_REPLY_INPUT_CHAR_LIMIT) : buildChatAdminCharacterContext(currentCharacter,body.incoming_message,typeof body.fan_label==="string"?body.fan_label:"")) !== context
  ) {
    return NextResponse.json({error:"stale_character_revision"},{status:409});
  }
  if(request.signal.aborted)return NextResponse.json({error:"request_cancelled"},{status:499});
  const persisted=fanMode?await persistChatAdminGeneration(workspaceId,character.id,fan!.id,conversation!.id,character.revision,currentFan!.revision,body.generation_id as string,currentHistory.map(message=>message.id),String(body.incoming_message).trim(),replies):replies;
  return NextResponse.json({replies:persisted,character_id:character.id,character_revision:character.revision,...(fanMode?{fan_id:fan!.id,conversation_id:conversation!.id}:{}),safety_note:"Antwort kopieren und manuell bei OnlyFans einfügen. Keine Verbindung und kein automatisches Senden."});
 }catch(error){if(workspaceId&&!usageRecorded)await recordAiUsageEvent({workspaceId,userId,feature:"chat_admin_reply",model,inputChars,status:"error",errorCode:"chat_admin_reply_failed",latencyMs:Date.now()-started,sourceRoute:"/api/chatadmin/reply-suggestions"});if(error instanceof WorkspaceAuthorizationError)return NextResponse.json({error:error.code},{status:error.code==="unauthenticated"?401:403});if(error instanceof ChatAdminPolicyError)return NextResponse.json({error:error.code},{status:400});return NextResponse.json({error:"reply_generation_failed"},{status:503});}
}
