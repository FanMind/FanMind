import { NextRequest, NextResponse } from "next/server";
import {
  isTrustedFanMindMutationRequest,
  readBoundedJsonRequest,
} from "@/lib/httpMutationPolicy.mjs";
import { SUPABASE_ACCESS_TOKEN_COOKIE, SUPABASE_REFRESH_TOKEN_COOKIE } from "@/lib/supabase/config";

const isProduction = process.env.NODE_ENV === "production";
const MAX_SESSION_BODY_BYTES = 24_000;
const MAX_ACCESS_TOKEN_CHARACTERS = 16_000;
const MAX_REFRESH_TOKEN_CHARACTERS = 4_000;

function clearSessionCookies(response: NextResponse): NextResponse {
  response.cookies.delete(SUPABASE_ACCESS_TOKEN_COOKIE);
  response.cookies.delete(SUPABASE_REFRESH_TOKEN_COOKIE);

  return response;
}

export async function POST(request: NextRequest) {
  if (!isTrustedFanMindMutationRequest(request)) {
    return NextResponse.json(
      { error: "Die Sitzungsanfrage konnte nicht verifiziert werden.", code: "origin_forbidden" },
      { status: 403 },
    );
  }

  const parsedBody = await readBoundedJsonRequest(request, MAX_SESSION_BODY_BYTES);
  if (!parsedBody.ok) {
    return NextResponse.json(
      {
        error: parsedBody.reason === "payload_too_large"
          ? "Die Sitzungsanfrage ist zu groß."
          : "Die Sitzungsanfrage ist ungültig.",
        code: parsedBody.reason === "payload_too_large" ? "payload_too_large" : "invalid_request",
      },
      { status: parsedBody.reason === "payload_too_large" ? 413 : 400 },
    );
  }
  const payload = parsedBody.value as { accessToken?: unknown; refreshToken?: unknown; expiresIn?: unknown } | null;
  const accessToken = typeof payload?.accessToken === "string" ? payload.accessToken.trim() : "";
  const refreshToken = typeof payload?.refreshToken === "string" ? payload.refreshToken.trim() : "";

  if (!accessToken || accessToken.length > MAX_ACCESS_TOKEN_CHARACTERS || refreshToken.length > MAX_REFRESH_TOKEN_CHARACTERS) {
    return NextResponse.json({ error: "Die Sitzungsdaten sind ungültig.", code: "invalid_session" }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  const accessMaxAge = typeof payload?.expiresIn === "number" && Number.isSafeInteger(payload.expiresIn) && payload.expiresIn > 0
    ? Math.min(payload.expiresIn, 60 * 60 * 24)
    : 60 * 60;

  response.cookies.set(SUPABASE_ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: accessMaxAge,
  });

  if (refreshToken) {
    response.cookies.set(SUPABASE_REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return response;
}

export async function DELETE(request: NextRequest) {
  if (!isTrustedFanMindMutationRequest(request)) {
    return NextResponse.json(
      { error: "Die Sitzungsanfrage konnte nicht verifiziert werden.", code: "origin_forbidden" },
      { status: 403 },
    );
  }
  return clearSessionCookies(NextResponse.json({ ok: true }));
}
