import { NextRequest, NextResponse } from "next/server";
import { createChatCharacter, deleteChatCharacter, listChatCharacters, requireChatAdminCapability, updateChatCharacter } from "@/lib/chatAdmin";
import { assertChatAdminCharacterInput, ChatAdminPolicyError } from "@/lib/chatAdminPolicy.mjs";
import { isTrustedFanMindMutationRequest, readBoundedJsonRequest } from "@/lib/httpMutationPolicy.mjs";
import { WorkspaceAuthorizationError } from "@/lib/workspaceAuthorization";

function denied(error:unknown){ if(error instanceof WorkspaceAuthorizationError) return NextResponse.json({error:error.code},{status:error.code==="unauthenticated"?401:403}); return NextResponse.json({error:"chat_admin_unavailable"},{status:503}); }
export async function GET(){try{const {workspace}=await requireChatAdminCapability();return NextResponse.json({characters:await listChatCharacters(workspace.id)});}catch(error){return denied(error)}}
export async function POST(request:NextRequest){
  if(!isTrustedFanMindMutationRequest(request)) return NextResponse.json({error:"untrusted_origin"},{status:403});
  try{const {workspace,user}=await requireChatAdminCapability();const body=await readBoundedJsonRequest(request,64_000);if(!body.ok)return NextResponse.json({error:body.reason},{status:400});const data=assertChatAdminCharacterInput(body.value);return NextResponse.json({character:await createChatCharacter(workspace.id,user.id,data)},{status:201});}catch(error){if(error instanceof ChatAdminPolicyError)return NextResponse.json({error:error.code},{status:400});return denied(error)}
}
export async function PATCH(request:NextRequest){
  if(!isTrustedFanMindMutationRequest(request)) return NextResponse.json({error:"untrusted_origin"},{status:403});
  try{const {workspace}=await requireChatAdminCapability();const body=await readBoundedJsonRequest(request,64_000);if(!body.ok||!body.value||typeof body.value!=="object")return NextResponse.json({error:"invalid_body"},{status:400});const raw=body.value as Record<string,unknown>;if(typeof raw.id!=="string"||!Number.isInteger(raw.revision))return NextResponse.json({error:"invalid_revision"},{status:400});const data=assertChatAdminCharacterInput(raw);return NextResponse.json({character:await updateChatCharacter(workspace.id,raw.id,raw.revision as number,data)});}catch(error){if(error instanceof ChatAdminPolicyError)return NextResponse.json({error:error.code},{status:400});return denied(error)}
}
export async function DELETE(request:NextRequest){
  if(!isTrustedFanMindMutationRequest(request)) return NextResponse.json({error:"untrusted_origin"},{status:403});
  try{const {workspace}=await requireChatAdminCapability();const body=await readBoundedJsonRequest(request,4096);if(!body.ok||!body.value||typeof body.value!=="object")return NextResponse.json({error:"invalid_body"},{status:400});const raw=body.value as Record<string,unknown>;if(typeof raw.id!=="string"||!Number.isInteger(raw.revision))return NextResponse.json({error:"invalid_revision"},{status:400});await deleteChatCharacter(workspace.id,raw.id,raw.revision as number);return new NextResponse(null,{status:204});}catch(error){return denied(error)}
}
