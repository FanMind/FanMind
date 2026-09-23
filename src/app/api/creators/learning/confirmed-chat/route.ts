import { NextResponse } from "next/server";
import { requireContactInActiveAuthorizedWorkspace } from "@/lib/workspaceAuthorization";
import { getOptionalBearerAccessToken } from "@/lib/requestAccessToken";
import { isTrustedFanMindMutationRequest, readBoundedJsonRequest } from "@/lib/httpMutationPolicy.mjs";
import { evaluateWorkspaceProcessingEntitlement } from "@/lib/workspaceProcessingPolicy.mjs";
import { creatorIntelligenceEnabled } from "@/lib/creatorIntelligence";
import {
  confirmCreatorConfirmedChatOutbound,
  creatorConfirmedChatLearningEnabled,
  linkCreatorConfirmedChatOutcomes,
} from "@/lib/creatorConfirmedChatPersistence";

const MAX_BODY_BYTES = 8_000;

function json(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  let accessToken: string | undefined;
  try {
    accessToken = getOptionalBearerAccessToken(request);
  } catch {
    return json({ error: "Bitte melde dich erneut an." }, 401);
  }
  if (!accessToken && !isTrustedFanMindMutationRequest(request)) {
    return json({ error: "Die Bestätigung muss aus dem angemeldeten FanMind-Bereich erfolgen." }, 403);
  }

  const parsed = await readBoundedJsonRequest(request, MAX_BODY_BYTES);
  if (!parsed.ok) {
    return json(
      { error: "Ungültige oder zu große Eingabe." },
      parsed.reason === "payload_too_large" ? 413 : 400,
    );
  }
  const raw = parsed.value as Record<string, unknown> | null;
  const action = stringValue(raw?.action);
  const contactId = stringValue(raw?.contactId);
  const proposalId = stringValue(raw?.proposalId);
  if (!contactId || !proposalId || (action !== "confirm_outbound" && action !== "link_outcomes")) {
    return json({ error: "Ungültige Lern-Evidence-Anfrage." }, 400);
  }

  try {
    const context = await requireContactInActiveAuthorizedWorkspace(contactId, accessToken);
    if (!evaluateWorkspaceProcessingEntitlement(context.workspace).allowed) {
      return json({ error: "Dieser Workspace ist derzeit nur lesbar." }, 403);
    }
    if (!creatorIntelligenceEnabled() || !creatorConfirmedChatLearningEnabled()) {
      return json({ error: "Bestätigtes Chat-Lernen ist für diesen Zugang noch nicht aktiviert." }, 503);
    }

    if (action === "confirm_outbound") {
      const outboundMessageId = stringValue(raw?.outboundMessageId);
      if (!outboundMessageId) return json({ error: "outboundMessageId ist Pflicht." }, 400);
      const result = await confirmCreatorConfirmedChatOutbound({
        workspaceId: context.workspace.id,
        contactId: context.contact.id,
        proposalId,
        outboundMessageId,
        actorUserId: context.user.id,
        accessToken,
      });
      return json({ ok: true, evidence: result });
    }

    const reactionMessageId = stringValue(raw?.reactionMessageId) || null;
    const purchaseEventId = stringValue(raw?.purchaseEventId) || null;
    if (!reactionMessageId && !purchaseEventId) {
      return json({ error: "Mindestens ein belegtes Ergebnis ist erforderlich." }, 400);
    }
    const result = await linkCreatorConfirmedChatOutcomes({
      workspaceId: context.workspace.id,
      contactId: context.contact.id,
      proposalId,
      reactionMessageId,
      purchaseEventId,
      accessToken,
    });
    return json({ ok: true, evidence: result });
  } catch {
    // The persistence/RLS contract owns the detailed reason. Never expose tenant,
    // evidence, database or provider diagnostics to the caller.
    return json({ error: "Die bestätigte Chat-Evidence konnte nicht sicher verknüpft werden." }, 409);
  }
}
