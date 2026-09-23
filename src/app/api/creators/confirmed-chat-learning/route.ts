import { NextResponse } from "next/server";
import { getOptionalBearerAccessToken } from "@/lib/requestAccessToken";
import { isTrustedFanMindMutationRequest, readBoundedJsonRequest } from "@/lib/httpMutationPolicy.mjs";
import { requireContactInActiveAuthorizedWorkspaceMember } from "@/lib/workspaceAuthorization";
import { creatorIntelligenceEnabled } from "@/lib/creatorIntelligence";
import { persistConfirmedChatLearning } from "@/lib/creatorConfirmedChatPersistence";
import { CreatorPolicyError } from "@/lib/creatorIntelligencePolicy.mjs";

function json(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: Request) {
  try {
    const accessToken = getOptionalBearerAccessToken(request);
    const contactId = new URL(request.url).searchParams.get("contactId") ?? "";
    const context = await requireContactInActiveAuthorizedWorkspaceMember(
      contactId,
      accessToken,
    );
    if (!accessToken && !isTrustedFanMindMutationRequest(request)) {
      return json({ error: "Bitte den angemeldeten FanMind-Bereich verwenden." }, 403);
    }
    if (!creatorIntelligenceEnabled()) {
      return json({ error: "Die Creator-Erweiterung wird noch vorbereitet." }, 503);
    }
    const body = await readBoundedJsonRequest(request, 32000);
    if (!body.ok) {
      return json(
        { error: "Ungültige oder zu große Lern-Evidenz." },
        body.reason === "payload_too_large" ? 413 : 400,
      );
    }
    const learningId = await persistConfirmedChatLearning(
      context.workspace.id,
      context.contact.id,
      context.user.id,
      body.value,
      accessToken,
    );
    return json({ ok: true, learningId });
  } catch (error) {
    if (error instanceof CreatorPolicyError) {
      return json({ error: "Die Lern-Evidenz ist unvollständig oder nicht eindeutig gebunden." }, 400);
    }
    return json({ error: "Die bestätigte Chat-Evidenz konnte nicht gespeichert werden." }, 409);
  }
}
