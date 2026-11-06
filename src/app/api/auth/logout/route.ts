import { NextRequest, NextResponse } from "next/server";
import { isTrustedFanMindMutationRequest } from "@/lib/httpMutationPolicy.mjs";
import { signOutSupabaseServerSession } from "@/lib/supabase/server";
import { SUPABASE_ACCESS_TOKEN_COOKIE, SUPABASE_REFRESH_TOKEN_COOKIE } from "@/lib/supabase/config";

export async function POST(request: NextRequest) {
  if (!isTrustedFanMindMutationRequest(request)) {
    return NextResponse.json(
      { error: "Die Abmeldung konnte nicht verifiziert werden.", code: "origin_forbidden" },
      { status: 403 },
    );
  }
  await signOutSupabaseServerSession();

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SUPABASE_ACCESS_TOKEN_COOKIE);
  response.cookies.delete(SUPABASE_REFRESH_TOKEN_COOKIE);

  return response;
}
