import {NextResponse} from "next/server";
// Retired Owner-corrected pilot. Never load identity, CRM content or write tools.
const retired=()=>NextResponse.json({error:"creator_support_retired"},{status:410,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
export const GET=retired;
export const POST=retired;
