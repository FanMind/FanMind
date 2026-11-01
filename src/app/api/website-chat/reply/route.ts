import { NextRequest, NextResponse } from "next/server";

import { getFanMindAiModel, recordAiUsageEvent } from "@/lib/aiUsage";
import { getClientIp } from "@/lib/rateLimit";
import { consumeSharedRateLimit } from "@/lib/sharedRateLimit";
import { readBoundedJsonRequest } from "@/lib/httpMutationPolicy.mjs";
import { getWorkspaceAiPromptContext } from "@/lib/workspaceAiPrompts";
import {
  hashWebsiteChatSessionToken,
  MAX_BODY_BYTES,
  WEBSITE_CHAT_INSTALLATION_HEADER,
} from "@/lib/websiteChatPolicy.mjs";
import {
  persistWebsiteChatAssistantReply,
  resolveWebsiteChatAssistantContext,
  resolveWebsiteChatInstallation,
  WebsiteChatServiceError,
} from "@/lib/websiteChat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAXIMUM = 20;
const TIMEOUT_MS = 20_000;

function corsHeaders(origin?: string) {
  return {
    ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": `authorization, content-type, ${WEBSITE_CHAT_INSTALLATION_HEADER}`,
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
  return request.headers.get(WEBSITE_CHAT_INSTALLATION_HEADER);
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

function extractText(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const value = body as { output_text?: unknown; output?: Array<{ content?: Array<{ text?: unknown }> }> };
  if (typeof value.output_text === "string") return value.output_text.trim();
  for (const item of value.output ?? []) {
    for (const part of item.content ?? []) {
      if (typeof part.text === "string" && part.text.trim()) return part.text.trim();
    }
  }
  return "";
}

export async function OPTIONS(request: NextRequest) {
  try {
    const resolved = await resolveWebsiteChatInstallation({
      publicInstallationId: request.nextUrl.searchParams.get("installation_id"),
      origin: request.headers.get("origin"),
    });
    return new NextResponse(null, { status: 204, headers: corsHeaders(resolved.origin) });
  } catch {
    return response({ ok: false, code: "ORIGIN_FORBIDDEN" }, 403);
  }
}

export async function POST(request: NextRequest) {
  if (process.env.FANMIND_WEBSITE_CHAT_AI_ENABLED !== "true") {
    return response({ ok: false, code: "AI_NOT_ENABLED" }, 404);
  }
  let resolved;
  try {
    resolved = await resolveWebsiteChatInstallation({
      publicInstallationId: installationId(request),
      origin: request.headers.get("origin"),
    });
  } catch {
    return response({ ok: false, code: "ORIGIN_FORBIDDEN" }, 403);
  }

  if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
    return response({ ok: false, code: "VALIDATION_ERROR" }, 400, resolved.origin);
  }
  const parsed = await readBoundedJsonRequest(request, MAX_BODY_BYTES);
  if (!parsed.ok) return response({ ok: false, code: "VALIDATION_ERROR" }, 400, resolved.origin);
  const body = parsed.value as { clientMessageId?: unknown } | null;
  const token = bearerToken(request);

  let subject = "";
  try {
    subject = hashWebsiteChatSessionToken({
      token,
      secret: process.env.FANMIND_WEBSITE_CHAT_SESSION_SECRET ?? "",
    });
  } catch {
    return response({ ok: false, code: "SESSION_INVALID" }, 401, resolved.origin);
  }

  let rateLimit;
  try {
    rateLimit = await consumeSharedRateLimit({
      scope: "website_chat_ai_session",
      subject: `${resolved.installation.id}:${subject}:${getClientIp(request)}`,
      maxRequests: RATE_MAXIMUM,
      windowMs: RATE_WINDOW_MS,
    });
  } catch {
    return response({ ok: false, code: "SERVICE_UNAVAILABLE" }, 503, resolved.origin);
  }
  if (!rateLimit.allowed) return response({ ok: false, code: "RATE_LIMITED" }, 429, resolved.origin);

  let context;
  try {
    context = await resolveWebsiteChatAssistantContext({
      publicInstallationId: installationId(request),
      origin: resolved.origin,
      sessionToken: token,
      clientMessageId: body?.clientMessageId,
    });
  } catch (error) {
    if (error instanceof WebsiteChatServiceError && error.code === "session_unavailable") {
      return response({ ok: false, code: "SESSION_INVALID" }, 401, resolved.origin);
    }
    return response({ ok: false, code: "CONTEXT_UNAVAILABLE" }, 409, resolved.origin);
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return response({ ok: false, code: "AI_UNAVAILABLE" }, 503, resolved.origin);

  const promptContext = await getWorkspaceAiPromptContext(context.workspaceId, null, true);
  const model = getFanMindAiModel();
  const transcript = context.messages.map((message) => ({
    role: message.direction === "inbound" ? "user" : "assistant",
    content: message.content,
  }));
  const system = [
    "Du bist der Website-KI-Assistent eines FanMind-Workspaces.",
    "Antworte nur auf Basis des sichtbaren Gesprächs und der freigegebenen Unternehmenshinweise.",
    "Erfinde keine Preise, Rabatte, Termine, Verfügbarkeiten, Zusagen oder Eigenschaften.",
    "Wenn Information fehlt oder eine sichere Antwort nicht möglich ist, sage das kurz und biete die Übergabe an einen Menschen an.",
    "Antworte freundlich, knapp und hilfreich in der Sprache des Besuchers.",
    "Keine Manipulation, kein künstlicher Zeitdruck und keine Behauptung, ein Mensch zu sein.",
    promptContext.companyPrompt ? `Freigegebene Unternehmenshinweise: ${promptContext.companyPrompt}` : "",
  ].filter(Boolean).join("\n");

  const inputChars = system.length + transcript.reduce((sum, item) => sum + item.content.length, 0);
  const startedAt = Date.now();
  try {
    const provider = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: 500,
        input: [{ role: "system", content: system }, ...transcript],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const providerBody = await provider.json().catch(() => null);
    const reply = extractText(providerBody);
    if (!provider.ok || !reply) {
      await recordAiUsageEvent({
        workspaceId: context.workspaceId,
        contactId: context.contactId,
        feature: "website_chat_reply",
        model,
        inputChars,
        outputChars: 0,
        status: "error",
        errorCode: provider.ok ? "missing_output" : String(provider.status),
        latencyMs: Date.now() - startedAt,
        sourceRoute: "/api/website-chat/reply",
        providerUsage: (providerBody as { usage?: unknown } | null)?.usage,
      });
      return response({ ok: false, code: "AI_UNAVAILABLE" }, 502, resolved.origin);
    }

    const persisted = await persistWebsiteChatAssistantReply({ context, reply });
    await recordAiUsageEvent({
      workspaceId: context.workspaceId,
      contactId: context.contactId,
      feature: "website_chat_reply",
      model,
      inputChars,
      outputChars: persisted.reply.length,
      status: "ok",
      latencyMs: Date.now() - startedAt,
      sourceRoute: "/api/website-chat/reply",
      providerUsage: (providerBody as { usage?: unknown } | null)?.usage,
    });
    return response({ ok: true, reply: persisted.reply, duplicate: persisted.duplicate }, 200, resolved.origin);
  } catch {
    await recordAiUsageEvent({
      workspaceId: context.workspaceId,
      contactId: context.contactId,
      feature: "website_chat_reply",
      model,
      inputChars,
      outputChars: 0,
      status: "error",
      errorCode: "exception",
      latencyMs: Date.now() - startedAt,
      sourceRoute: "/api/website-chat/reply",
    });
    return response({ ok: false, code: "AI_UNAVAILABLE" }, 503, resolved.origin);
  }
}
