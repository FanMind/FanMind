import { NextRequest, NextResponse } from "next/server";

function configuredAppOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

function forwardedOrigin(request: NextRequest): string | null {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return null;
  const proto = request.headers.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  try {
    return new URL(`${proto}://${host}`).origin;
  } catch {
    return null;
  }
}

function requestOrigin(request: NextRequest): string {
  return request.nextUrl.origin;
}

export function getSafeAdminRedirectUrl(request: NextRequest, path: string): URL {
  const origin = configuredAppOrigin() ?? forwardedOrigin(request) ?? requestOrigin(request);
  return new URL(path, origin);
}

export function getSafeAdminRefererPath(request: NextRequest): string | null {
  const referer = request.headers.get("referer");
  if (!referer) return null;

  try {
    const refererUrl = new URL(referer);
    const allowedOrigins = new Set([getSafeAdminRedirectUrl(request, "/").origin, requestOrigin(request)]);
    if (!allowedOrigins.has(refererUrl.origin)) return null;
    return `${refererUrl.pathname}${refererUrl.search}${refererUrl.hash}`;
  } catch {
    return referer.startsWith("/") && !referer.startsWith("//") ? referer : null;
  }
}

export function redirectAdminHtml(request: NextRequest, path: string): NextResponse<unknown> | null {
  if (!request.headers.get("accept")?.includes("text/html")) return null;
  return NextResponse.redirect(getSafeAdminRedirectUrl(request, path), { status: 303 });
}
