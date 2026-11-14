import {NextRequest,NextResponse} from "next/server";
import {creatorSupportChoices,runCreatorSupport,supportCreatorIdentity} from "@/lib/supportCreatorServer";
import {isTrustedFanMindMutationRequest,readBoundedJsonRequest} from "@/lib/httpMutationPolicy.mjs";
import {consumeSharedRateLimit} from "@/lib/sharedRateLimit";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
const fail=(status:number)=>NextResponse.json({error:"creator_support_unavailable"},{status,headers});
export async function GET(request:NextRequest){
 if(process.env.FANMIND_RUNTIME_ENVIRONMENT!=="staging")return fail(404);
 try{return NextResponse.json(await creatorSupportChoices(request.nextUrl.searchParams.get("character")??undefined),{headers});}catch{return fail(403);}
}
export async function POST(request:NextRequest){
 if(process.env.FANMIND_RUNTIME_ENVIRONMENT!=="staging")return fail(404);
 if(!isTrustedFanMindMutationRequest(request))return fail(403);
 try{
  const i=await supportCreatorIdentity();
  const parsed=await readBoundedJsonRequest(request,5000);if(!parsed.ok||!parsed.value||typeof parsed.value!=="object"||Array.isArray(parsed.value))return fail(400);
  const b=parsed.value as Record<string,unknown>;
  if(Object.keys(b).some(k=>!["scope","requestId","question","characterId","fanId","readConsent","manageConsent","undo","test","aiConsent","analyse"].includes(k))||typeof b.scope!=="string"||typeof b.requestId!=="string"||typeof b.question!=="string"||typeof b.characterId!=="string"||b.fanId!==undefined&&typeof b.fanId!=="string"||typeof b.readConsent!=="boolean"||typeof b.manageConsent!=="boolean"||b.undo!==undefined&&typeof b.undo!=="string"||b.test!==undefined&&typeof b.test!=="string"||b.aiConsent!==undefined&&typeof b.aiConsent!=="boolean"||b.analyse!==undefined&&typeof b.analyse!=="boolean"||[b.undo!==undefined,b.test!==undefined,b.analyse===true].filter(Boolean).length>1)return fail(400);
  if(b.scope!==i.scope)return fail(409);
  if(!(await consumeSharedRateLimit({scope:"support_creator_tools",subject:`${i.actor}:${i.workspace}`,maxRequests:12,windowMs:60000})).allowed)return fail(429);
  const result=await runCreatorSupport(b as Parameters<typeof runCreatorSupport>[0],request.signal);
  return NextResponse.json({scope:i.scope,...result},{headers});
 }catch{return fail(409);}
}
