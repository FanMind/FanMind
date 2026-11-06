import { NextRequest, NextResponse } from "next/server";

import { readBoundedJsonRequest } from "@/lib/httpMutationPolicy.mjs";
import { getClientIp } from "@/lib/rateLimit";
import { consumeSharedRateLimit } from "@/lib/sharedRateLimit";
import {
  hashWebsiteChatSessionToken,
  MAX_BODY_BYTES,
  requireWebsiteChatPreflight,
  WEBSITE_CHAT_INSTALLATION_HEADER,
  WEBSITE_CHAT_INSTALLATION_QUERY,
} from "@/lib/websiteChatPolicy.mjs";
import {
  ingestWebsiteChatMessage,
  resolveWebsiteChatInstallation,
  WebsiteChatServiceError,
} from "@/lib/websiteChat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INSTALLATION_HEADER = WEBSITE_CHAT_INSTALLATION_HEADER;
const ALLOWED_HEADER_NAMES = ["authorization", "content-type", INSTALLATION_HEADER];
const ALLOWED_HEADERS = ALLOWED_HEADER_NAMES.join(",");
const MESSAGE_RATE_WINDOW_MS = 10 * 60 * 1000;
const MESSAGE_RATE_MAXIMUM = 20;
const MESSAGE_COARSE_IP_RATE_MAXIMUM = 60;

function corsHeaders(origin?: string) {
  return {
    ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Max-Age": "600",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
  };
}

function response(payload: Record<string, unknown>, status: number, origin?: string) {
  return NextResponse.json(payload, { status, headers: corsHeaders(origin) });
}

function installationId(request: Request) {
  return request.headers.get(INSTALLATION_HEADER);
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

async function consumeCoarseIpRateLimit(request: NextRequest) {
  return consumeSharedRateLimit({
    scope: "website_chat_message_coarse_ip",
    subject: getClientIp(request),
    maxRequests: MESSAGE_COARSE_IP_RATE_MAXIMUM,
    windowMs: MESSAGE_RATE_WINDOW_MS,
  });
}

export async function OPTIONS(request: NextRequest) {
  const coarseRateLimit = await consumeCoarseIpRateLimit(request).catch(() => null);
  if (!coarseRateLimit) return response({ ok: false, code: "SERVICE_UNAVAILABLE" }, 503);
  if (!coarseRateLimit.allowed) return response({ ok: false, code: "RATE_LIMITED" }, 429);
  try {
    requireWebsiteChatPreflight({
      method: request.headers.get("access-control-request-method"),
      requestedHeaders: request.headers.get("access-control-request-headers"),
    }, ALLOWED_HEADER_NAMES);
    const resolved = await resolveWebsiteChatInstallation({
      publicInstallationId: request.nextUrl.searchParams.get(WEBSITE_CHAT_INSTALLATION_QUERY),
      origin: request.headers.get("origin"),
    });
    return new NextResponse(null, { status: 204, headers: corsHeaders(resolved.origin) });
  } catch {
    return response({ ok: false, code: "ORIGIN_FORBIDDEN" }, 403);
  }
}

export async function POST(request: NextRequest) {
  const coarseRateLimit = await consumeCoarseIpRateLimit(request).catch(() => null);
  if (!coarseRateLimit) return response({ ok: false, code: "SERVICE_UNAVAILABLE" }, 503);
  if (!coarseRateLimit.allowed) return response({ ok: false, code: "RATE_LIMITED" }, 429);
  let resolved;
  try {
    resolved = await resolveWebsiteChatInstallation({
      publicInstallationId: installationId(request),
      origin: request.headers.get("origin"),
    });
  } catch {
    return response({ ok: false, code: "ORIGIN_FORBIDDEN" }, 403);
  }

  const sessionToken = bearerToken(request);
  let sessionSubject: string;
  try {
    sessionSubject = hashWebsiteChatSessionToken({
      token: sessionToken,
      secret: process.env.FANMIND_WEBSITE_CHAT_SESSION_SECRET ?? "",
    });
  } catch {
    return response({ ok: false, code: "SESSION_INVALID" }, 401, resolved.origin);
  }
  if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
    return response({ ok: false, code: "VALIDATION_ERROR" }, 400, resolved.origin);
  }
  const parsed = await readBoundedJsonRequest(request, MAX_BODY_BYTES);
  if (!parsed.ok) {
    return response(
      { ok: false, code: parsed.reason === "payload_too_large" ? "PAYLOAD_TOO_LARGE" : "VALIDATION_ERROR" },
      parsed.reason === "payload_too_large" ? 413 : 400,
      resolved.origin,
    );
  }

  let rateLimit;
  try {
    rateLimit = await consumeSharedRateLimit({
      scope: "website_chat_message_session",
      subject: `${resolved.installation.id}:${sessionSubject}`,
      maxRequests: MESSAGE_RATE_MAXIMUM,
      windowMs: MESSAGE_RATE_WINDOW_MS,
    });
  } catch {
    return response({ ok: false, code: "SERVICE_UNAVAILABLE" }, 503, resolved.origin);
  }
  if (!rateLimit.allowed) {
    return response({ ok: false, code: "RATE_LIMITED" }, 429, resolved.origin);
  }

  try {
    const body = parsed.value as { clientMessageId?: unknown; message?: unknown } | null;
    const result = await ingestWebsiteChatMessage({
      publicInstallationId: installationId(request),
      origin: resolved.origin,
      sessionToken,
      clientMessageId: body?.clientMessageId,
      message: body?.message,
    });
    return response(
      { ok: true, accepted: result.accepted, duplicate: result.duplicate },
      result.duplicate ? 200 : 202,
      resolved.origin,
    );
  } catch (error) {
    if (error instanceof WebsiteChatServiceError && error.code === "message_invalid") {
      return response({ ok: false, code: "VALIDATION_ERROR" }, 400, resolved.origin);
    }
    if (error instanceof WebsiteChatServiceError && error.code === "session_unavailable") {
      return response({ ok: false, code: "SESSION_INVALID" }, 401, resolved.origin);
    }
    return response({ ok: false, code: "SERVICE_UNAVAILABLE" }, 503, resolved.origin);
  }
}
