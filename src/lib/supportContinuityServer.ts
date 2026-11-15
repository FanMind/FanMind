import "server-only";
import { isSupportUuid } from "./supportCentrePolicy";
import { createHash } from "node:crypto";
import { getSupabaseServerUser,getUserWorkspaceDashboard } from "@/lib/supabase/server";
import { supportCentreDatabase,supportCentreEnabled } from "./supportCentreServer";
export async function supportCustomer() {
 if(!supportCentreEnabled())return null;
 const {data}=await getSupabaseServerUser();if(!data.user)return null;
 const target=await getUserWorkspaceDashboard(data.user);if(target.error||!target.workspace)return null;
 return {actor:data.user.id,workspace:target.workspace.id,scope:createHash("sha256").update(`${data.user.id}:${target.workspace.id}`).digest("hex")};
}
export type SupportTurn={request_id:string;question:string;answer:string;context:string;unanswered:boolean;created_at:string};
export function safeSupportTurns(rows:unknown):SupportTurn[]{
 if(!Array.isArray(rows)||rows.length>100)throw new Error("invalid_turns");
 return rows.map(r=>{if(typeof r.question!=="string"||r.question.length>1000||typeof r.answer!=="string"||r.answer.length>2000||!isSupportUuid(r.request_id)||!Number.isFinite(Date.parse(r.created_at)))throw new Error("invalid_turn");return {request_id:r.request_id,question:r.question,answer:r.answer,context:r.context,unanswered:r.unanswered===true,created_at:r.created_at};}).reverse();
}
export async function readSupportConversation(identity:NonNullable<Awaited<ReturnType<typeof supportCustomer>>>,before?:string){return safeSupportTurns(await supportCentreDatabase(before?"rpc/support_chat_page":"rpc/support_chat_read",{p_actor:identity.actor,p_workspace:identity.workspace,...(before?{p_before:before}:{})}));}
