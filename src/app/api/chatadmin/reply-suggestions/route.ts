import { ReplyQualityError, runReplyQualityGate } from "@/lib/replyQualityPolicy.mjs";
import { NextRequest, NextResponse } from "next/server";
import { applyChatAdminCurrentInterests, isChatAdminCurrentFactsEnabled, getLatestChatAdminConfirmedReply, getChatAdminGeneration, getChatCharacter, getChatConversation, getChatFan, isChatAdminFanRuntimeEnabled, listRecentChatMessages, persistChatAdminGeneration, requireChatAdminCapability, requireChatAdminFanRuntime, updateChatFan } from "@/lib/chatAdmin";
import { assertChatAdminAdultSafety, assertChatAdminReplySemantics, buildChatAdminCharacterContext, buildChatAdminFanContext, ChatAdminPolicyError } from "@/lib/chatAdminPolicy.mjs";
import { recordAiUsageEvent } from "@/lib/aiUsage";
import { isTrustedFanMindMutationRequest, readBoundedJsonRequest } from "@/lib/httpMutationPolicy.mjs";
import { consumeSharedRateLimit } from "@/lib/sharedRateLimit";
import { WorkspaceAuthorizationError } from "@/lib/workspaceAuthorization";
import { AI_REPLY_INPUT_CHAR_LIMIT } from "@/lib/aiExecutionPolicy.mjs";
import { deriveChatAdminReplyPause, extractChatAdminFacts, learnChatAdminKnowledge } from "@/lib/chatAdminKnowledge.mjs";
import { getChatAdminModelProfile, buildChatAdminModelRequest, CHAT_ADMIN_MODEL_TIMEOUT_MS } from "@/lib/chatAdminModelPolicy.mjs";
const URL="https://api.openai.com/v1/responses";
export async function POST(request:NextRequest){
 if(!isTrustedFanMindMutationRequest(request))return NextResponse.json({error:"untrusted_origin"},{status:403});
 let workspaceId="",userId="",inputChars=0;let usageRecorded=false;let providerAttemptStarted=false;let providerUsage:unknown;const model=getChatAdminModelProfile().model,started=Date.now();
 try{
  const fanMode=isChatAdminFanRuntimeEnabled();if(fanMode)requireChatAdminFanRuntime();const {workspace,user}=await requireChatAdminCapability();workspaceId=workspace.id;userId=user.id;
  const parsed=await readBoundedJsonRequest(request,16_000);if(!parsed.ok||!parsed.value||typeof parsed.value!=="object")return NextResponse.json({error:"invalid_body"},{status:400});
  const body=parsed.value as Record<string,unknown>;if(typeof body.character_id!=="string"||!Number.isInteger(body.character_revision))return NextResponse.json({error:"invalid_context_binding"},{status:400});
  if(fanMode&&(typeof body.fan_id!=="string"||typeof body.conversation_id!=="string"||typeof body.generation_id!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(body.generation_id)))return NextResponse.json({error:"invalid_context_binding"},{status:400});
  assertChatAdminAdultSafety(body.incoming_message);
  const character=await getChatCharacter(workspace.id,body.character_id);if(character.revision!==body.character_revision)return NextResponse.json({error:"stale_character_revision"},{status:409});
  const fan=fanMode?await getChatFan(workspace.id,character.id,body.fan_id as string):null;const conversation=fanMode?await getChatConversation(workspace.id,character.id,fan!.id,body.conversation_id as string):null;const history=fanMode?await listRecentChatMessages(workspace.id,character.id,fan!.id,conversation!.id):[];
  const lastConfirmed=fanMode?await getLatestChatAdminConfirmedReply(workspace.id,character.id,fan!.id,conversation!.id):null;
  const replyPause=deriveChatAdminReplyPause(fan?.notes,lastConfirmed);if(replyPause.paused)return NextResponse.json({error:"conversation_paused",reply_pause:replyPause},{status:409});
  const context=fanMode?buildChatAdminFanContext(character,fan!,conversation!,history,body.incoming_message,AI_REPLY_INPUT_CHAR_LIMIT,started):buildChatAdminCharacterContext(character,body.incoming_message,typeof body.fan_label==="string"?body.fan_label:"");inputChars=context.length;
  const requestedOffer=(JSON.parse(context) as {sales_playbook?:{requested_offer?:Record<string,unknown>|null}}).sales_playbook?.requested_offer??null;
  if(inputChars>AI_REPLY_INPUT_CHAR_LIMIT)return NextResponse.json({error:"input_too_large"},{status:400});
  const previous=fanMode?await getChatAdminGeneration(workspace.id,character.id,fan!.id,conversation!.id,body.generation_id as string):[];if(previous.length){const inbound=previous.filter(message=>message.direction==="fan_inbound"),stored=previous.filter(message=>message.direction==="suggested_reply");if(previous.length!==4||inbound.length!==1||inbound[0].content!==String(body.incoming_message).trim()||stored.length!==3)return NextResponse.json({error:"generation_id_conflict"},{status:409});const memoryStatus=await saveGenerationKnowledge(workspaceId,userId,character.id,character.revision,fan!.id,conversation!.id,String(body.generation_id),String(body.incoming_message).trim());return NextResponse.json({memory_status:memoryStatus,replies:stored.map(message=>message.content),character_id:character.id,character_revision:character.revision,fan_id:fan!.id,conversation_id:conversation!.id,safety_note:"Antwort kopieren und manuell bei OnlyFans einfügen. Keine Verbindung und kein automatisches Senden."});}
  const limit=await consumeSharedRateLimit({scope:"ai_reply_user_ip",subject:`chatadmin:${user.id}`,maxRequests:20,windowMs:600_000});if(!limit.allowed)return NextResponse.json({error:"rate_limited"},{status:429});
  const key=process.env.OPENAI_API_KEY;if(!key)return NextResponse.json({error:"ai_unavailable"},{status:503});
  const baseRequest=buildChatAdminModelRequest(context);
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(CHAT_ADMIN_MODEL_TIMEOUT_MS)]);
  const sentContext=JSON.parse(context) as {conversation?:{recent_messages?:Array<{direction:string;content:string}>}};
  const recentReplies=(sentContext.conversation?.recent_messages??[]).filter(message=>message.direction==="confirmed_reply").map(message=>message.content).slice(-6);
  const generated=await runReplyQualityGate({
   inputChars, inputLimit:AI_REPLY_INPUT_CHAR_LIMIT, recentReplies,
   generate:async feedback=>{
    providerAttemptStarted=false;
    signal.throwIfAborted();
    if(feedback){
     const authority=await requireChatAdminCapability();
     if(authority.workspace.id!==workspaceId||authority.user.id!==userId)throw new WorkspaceAuthorizationError("Kontext geändert","resource_forbidden");
     const c=await getChatCharacter(workspaceId,character.id), f=fanMode?await getChatFan(workspaceId,c.id,fan!.id):null;
     const conv=fanMode?await getChatConversation(workspaceId,c.id,f!.id,conversation!.id):null;
     const messages=fanMode?await listRecentChatMessages(workspaceId,c.id,f!.id,conv!.id):[];
     const confirmed=fanMode?await getLatestChatAdminConfirmedReply(workspaceId,c.id,f!.id,conv!.id):null;
     if(deriveChatAdminReplyPause(f?.notes,confirmed).paused||confirmed?.id!==lastConfirmed?.id||
       (fanMode?buildChatAdminFanContext(c,f!,conv!,messages,body.incoming_message,AI_REPLY_INPUT_CHAR_LIMIT,started):buildChatAdminCharacterContext(c,body.incoming_message,typeof body.fan_label==="string"?body.fan_label:""))!==context)throw new ChatAdminPolicyError("reply_context_changed");
     const retryLimit=await consumeSharedRateLimit({scope:"ai_reply_user_ip",subject:`chatadmin:${user.id}`,maxRequests:20,windowMs:600_000});
     if(!retryLimit.allowed)throw new ChatAdminPolicyError("rate_limited");
    }
    signal.throwIfAborted();
    providerAttemptStarted=true;
    const response=await fetch(URL,{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({...baseRequest,input:[...baseRequest.input,...(feedback?[{role:"user",content:feedback}]:[])]}),signal,cache:"no-store"});
    const payload=await response.json() as {output_text?:string;output?:Array<{content?:Array<{text?:string}>}>;usage?:unknown};
    return {payload,ok:response.ok,replies:null as string[]|null};
   },
   readReplies:result=>{
    providerUsage=result.payload.usage;
    if(!result.ok)throw new Error("provider_failed");
    const payload=result.payload;
    const text=payload.output_text??payload.output?.flatMap(v=>v.content??[]).map(v=>v.text??"").join("")??"";
    result.replies=assertChatAdminReplySemantics(JSON.parse(text).replies,body.incoming_message,requestedOffer);
    return result.replies;
   },
   onAttempt:async({result,error,feedback})=>{
    if(!providerAttemptStarted)return;
    providerAttemptStarted=false;
    usageRecorded=true;
    await recordAiUsageEvent({workspaceId,userId,feature:"chat_admin_reply",model,
     inputChars:inputChars+baseRequest.input[0].content.length+(feedback?.length??0),
     outputChars:result?.replies?.join("").length??0,status:error?"error":"ok",
     errorCode:error instanceof ReplyQualityError?error.code:error&&typeof error==="object"&&"name" in error&&error.name==="TimeoutError"?"chat_admin_provider_timeout":error?"chat_admin_reply_failed":undefined,
     latencyMs:Date.now()-started,sourceRoute:"/api/chatadmin/reply-suggestions",providerUsage:result?.payload.usage});
   },
  });
  const replies=generated.replies!;
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
    (fanMode ? buildChatAdminFanContext(currentCharacter, currentFan!, currentConversation!, currentHistory, body.incoming_message,AI_REPLY_INPUT_CHAR_LIMIT,started) : buildChatAdminCharacterContext(currentCharacter,body.incoming_message,typeof body.fan_label==="string"?body.fan_label:"")) !== context
  ) {
    return NextResponse.json({error:"stale_character_revision"},{status:409});
  }
  const freshConfirmed=fanMode?await getLatestChatAdminConfirmedReply(workspaceId,character.id,fan!.id,conversation!.id):null;
  const freshPause=deriveChatAdminReplyPause(currentFan?.notes,freshConfirmed);if(freshPause.paused)return NextResponse.json({error:"conversation_paused",reply_pause:freshPause},{status:409});
  if(freshConfirmed?.id!==lastConfirmed?.id)return NextResponse.json({error:"stale_conversation"},{status:409});
  if(request.signal.aborted)return NextResponse.json({error:"request_cancelled"},{status:499});
  const persisted=fanMode?await persistChatAdminGeneration(workspaceId,character.id,fan!.id,conversation!.id,character.revision,currentFan!.revision,body.generation_id as string,currentHistory.map(message=>message.id),String(body.incoming_message).trim(),replies):replies;
  const memoryStatus = fanMode ? await saveGenerationKnowledge(workspaceId,userId,character.id,character.revision,fan!.id,conversation!.id,String(body.generation_id),String(body.incoming_message).trim()) : "unchanged";
  return NextResponse.json({memory_status:memoryStatus,replies:persisted,character_id:character.id,character_revision:character.revision,...(fanMode?{fan_id:fan!.id,conversation_id:conversation!.id}:{}),safety_note:"Antwort kopieren und manuell bei OnlyFans einfügen. Keine Verbindung und kein automatisches Senden."});
 }catch(error){const timedOut=typeof error==="object"&&error!==null&&"name" in error&&error.name==="TimeoutError";if(workspaceId&&!usageRecorded&&providerAttemptStarted)await recordAiUsageEvent({workspaceId,userId,feature:"chat_admin_reply",model,inputChars,status:"error",errorCode:timedOut?"chat_admin_provider_timeout":"chat_admin_reply_failed",latencyMs:Date.now()-started,sourceRoute:"/api/chatadmin/reply-suggestions",providerUsage});if(error instanceof WorkspaceAuthorizationError)return NextResponse.json({error:error.code},{status:error.code==="unauthenticated"?401:403});if(error instanceof ReplyQualityError)return NextResponse.json({error:error.code},{status:502});if(error instanceof ChatAdminPolicyError)return NextResponse.json({error:error.code},{status:error.code==="rate_limited"?429:400});if(timedOut)return NextResponse.json({error:"reply_generation_timeout"},{status:504});return NextResponse.json({error:"reply_generation_failed"},{status:503});}
}

async function saveGenerationKnowledge(workspaceId:string,userId:string,characterId:string,characterRevision:number,fanId:string,conversationId:string,generationId:string,incoming:string):Promise<"unchanged"|"saved"|"not_saved"> {
 const proposed=extractChatAdminFacts(incoming,generationId);
 if (!proposed.length && !isChatAdminCurrentFactsEnabled()) return "unchanged";
 const checkAuthority=async()=>{
  const authority=await requireChatAdminCapability();
  if(authority.workspace.id!==workspaceId||authority.user.id!==userId)throw new WorkspaceAuthorizationError("Kontext geändert","resource_forbidden");
  const character=await getChatCharacter(workspaceId,characterId);
  if(character.status!=="active"||character.revision!==characterRevision)throw new WorkspaceAuthorizationError("Character geändert","resource_forbidden");
 };
 await checkAuthority();
 let fan=await getChatFan(workspaceId,characterId,fanId);
 if(fan.status!=="active")throw new WorkspaceAuthorizationError("Fan geändert","resource_forbidden");
 const saved=await getChatAdminGeneration(workspaceId,characterId,fanId,conversationId,generationId);
 const inbound=saved.find(message=>message.direction==="fan_inbound" && message.content===incoming);
 if(!inbound || !Number.isSafeInteger(inbound.sequence))return "not_saved";
 let interestChanged=false;
 if(isChatAdminCurrentFactsEnabled()){
  try {interestChanged=await applyChatAdminCurrentInterests(workspaceId,characterId,fanId,conversationId,characterRevision,fan.revision,generationId);}
  catch {await checkAuthority();return "not_saved";}
  await checkAuthority();
  // Exactly one authority for interests. Legacy notes remain intact; independent
  // boundaries/communication can still use the existing notes path.
  if(!proposed.some(fact=>fact.kind!=="interest"))return interestChanged?"saved":"unchanged";
  fan=await getChatFan(workspaceId,characterId,fanId);
 }

 let notes:string;
 try { notes=learnChatAdminKnowledge(fan.notes,isChatAdminCurrentFactsEnabled()?proposed.filter(fact=>fact.kind!=="interest"):proposed,[{id:generationId,direction:"fan_inbound",content:incoming,sequence:inbound.sequence}]); }
 catch { return "not_saved"; }
 if(notes===fan.notes)return interestChanged?"saved":"unchanged";
 let status:"saved"|"not_saved"="saved";
 try { await updateChatFan(workspaceId,characterId,fanId,fan.revision,{notes}); }
 catch { status="not_saved"; }
 // A CAS/storage failure is recoverable; known authority loss never is.
 await checkAuthority();
 return status;
}
