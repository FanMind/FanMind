import { readSupportRequest } from "@/lib/supportCentreRequest";
import { NextRequest, NextResponse } from "next/server";
import { consumeSharedRateLimit } from "@/lib/sharedRateLimit";
import { isSupportUuid } from "@/lib/supportCentrePolicy";
import { decideSupportCase, supportCentreActor, supportCentreEnabled } from "@/lib/supportCentreServer";

export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  const reply = (error: string, status: number) => NextResponse.json({ error }, { status, headers });
  if (!supportCentreEnabled()) return reply("not_available", 404);
  if (request.headers.get("origin") !== request.nextUrl.origin) return reply("invalid_origin", 403);
  try {
    const actor = await supportCentreActor();
    if (!actor) return reply("unauthorized", 401);
    if (!actor.owner) return reply("owner_required", 403);
    let body: Record<string, unknown>;
    try { body = await readSupportRequest(request, 1024); } catch { return reply("invalid_request", 400); }
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(k => !["workspace", "id", "decision"].includes(k)) ||
      !isSupportUuid(body.workspace) || !isSupportUuid(body.id) || (typeof body.decision !== "string" || !["approve", "reject"].includes(body.decision))) return reply("invalid_request", 400);
    const limit = await consumeSharedRateLimit({ scope: "support.centre.decision", subject: actor.user.id, maxRequests: 10, windowMs: 60000 });
    if (!limit.allowed) return reply("rate_limited", 429);
    const status = await decideSupportCase(actor.user.id, body.workspace, body.id, body.decision as "approve" | "reject");
    return NextResponse.json({ status }, { headers });
  } catch {
    // Includes expired/already consumed claims and ambiguous audit responses; no blind retry.
    return reply("decision_unavailable_reload_required", 409);
  }
}
