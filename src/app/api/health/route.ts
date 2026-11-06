import { NextResponse } from "next/server";
import { isPlatformAdminEmail } from "@/lib/admin";
import { runOperationsHealthChecks } from "@/lib/operations";
import { getSupabaseServerUser } from "@/lib/supabase/server";

export async function GET() {
  const { data } = await getSupabaseServerUser();
  const isAdmin = isPlatformAdminEmail(data.user?.email);
  const result = await runOperationsHealthChecks(isAdmin);
  const status = result.status === "healthy" ? 200 : result.status === "degraded" ? 207 : 503;
  return NextResponse.json({ ...result, scope: isAdmin ? "admin" : "public" }, { status, headers: { "Cache-Control": "no-store" } });
}
