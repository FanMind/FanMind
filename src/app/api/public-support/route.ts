import {NextRequest,NextResponse} from "next/server";
import {isTrustedFanMindMutationRequest,readBoundedJsonRequest} from "@/lib/httpMutationPolicy.mjs";
import {parsePublicSupportRequest,guardPublicSupportReply,PUBLIC_SUPPORT_INSTRUCTIONS} from "@/lib/publicSupportPolicy.mjs";
import {buildBoundedReplySuggestionContext} from "@/lib/aiExecutionPolicy.mjs";
import {getClientIp} from "@/lib/rateLimit";
import {consumeSharedRateLimit} from "@/lib/sharedRateLimit";
import {getFanMindAiModel,recordAiUsageEvent} from "@/lib/aiUsage";
import {supportCentreDatabase} from "@/lib/supportCentreServer";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
const failure=(status:number)=>NextResponse.json({error:"public_support_unavailable"},{status,headers});
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
async function usageWorkspace(){
 // Only operational identity metadata is resolved. Never load customer content or prompts.
 const owners=await supportCentreDatabase("support_centre_owners?select=user_id&limit=2") as Array<{user_id:string}>;
 if(!Array.isArray(owners)||owners.length!==1||!uuid.test(owners[0]?.user_id))throw Error("owner_unavailable");
 const rows=await supportCentreDatabase(`workspaces?select=id&owner_user_id=eq.${encodeURIComponent(owners[0].user_id)}&limit=2`) as Array<{id:string}>;
 if(!Array.isArray(rows)||rows.length!==1||!uuid.test(rows[0]?.id))throw Error("workspace_unavailable");
 return rows[0].id;
}
export async function POST(request:NextRequest){
 if(!isTrustedFanMindMutationRequest(request))return failure(403);
 if(process.env.FANMIND_SUPPORT_CENTRE_ENABLED!=="true")return failure(503);
 if(request.headers.get("content-type")?.split(";")[0].trim().toLowerCase()!=="application/json")return failure(400);
 const body=await readBoundedJsonRequest(request,32768);if(!body.ok)return failure(body.reason==="payload_too_large"?413:400);
 let input;try{input=parsePublicSupportRequest(body.value);}catch{return failure(400);}
 const key=process.env.OPENAI_API_KEY?.trim();if(!key)return failure(503);
 let workspaceId:string;
 try{
  const limits=[
   {scope:"public_support_ip",subject:getClientIp(request),maxRequests:12,windowMs:600000},
   {scope:"public_support_global_hour",subject:"fanmind-public-support",maxRequests:200,windowMs:3600000},
   {scope:"public_support_global_day",subject:"fanmind-public-support",maxRequests:1000,windowMs:86400000},
  ];
  for(const limit of limits)if(!(await consumeSharedRateLimit(limit)).allowed)return failure(429);
  workspaceId=await usageWorkspace();
 }catch{return failure(503);}
 const bounded=buildBoundedReplySuggestionContext({contactId:"public-support",displayName:"Besucher",incomingMessage:input.question,conversationContext:JSON.stringify(input.history),messageLimit:50});
 const system=PUBLIC_SUPPORT_INSTRUCTIONS;
 const content=JSON.stringify({language:input.language,recentConversation:bounded.context.conversationContext,question:bounded.context.incomingMessage});
 const model=getFanMindAiModel(),started=Date.now(),inputChars=system.length+content.length;
 let providerUsage:unknown;
 try{
  const provider=await fetch("https://api.openai.com/v1/responses",{
   method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},
   body:JSON.stringify({model,store:false,max_output_tokens:800,input:[{role:"system",content:system},{role:"user",content}]}),
   signal:AbortSignal.any([request.signal,AbortSignal.timeout(20000)]),
  });
  if(!provider.ok)throw Error("provider_unavailable");
  const data=await provider.json();providerUsage=data.usage;
  const text=typeof data.output_text==="string"?data.output_text:(Array.isArray(data.output)?data.output.flatMap((o:{content?:Array<{type?:string;text?:string}>})=>o.content??[]).filter((c:{type?:string;text?:string})=>c.type==="output_text"&&typeof c.text==="string").map((c:{text:string})=>c.text).join("\n"):"");
  const reply=guardPublicSupportReply(text,input.language);
  await recordAiUsageEvent({workspaceId,feature:"website_chat_reply",model,inputChars,outputChars:reply.length,status:"ok",latencyMs:Date.now()-started,sourceRoute:"/api/public-support",providerUsage});
  return NextResponse.json({reply},{headers});
 }catch{
  await recordAiUsageEvent({workspaceId,feature:"website_chat_reply",model,inputChars,status:"error",errorCode:"public_support_unavailable",latencyMs:Date.now()-started,sourceRoute:"/api/public-support",providerUsage});
  return failure(503);
 }
}
