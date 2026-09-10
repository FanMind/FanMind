import { NextResponse } from "next/server";
import { requireContactInActiveAuthorizedWorkspace } from "@/lib/workspaceAuthorization";
import { getOptionalBearerAccessToken } from "@/lib/requestAccessToken";
import { isTrustedFanMindMutationRequest, readBoundedJsonRequest } from "@/lib/httpMutationPolicy.mjs";
import { creatorIntelligenceEnabled, getCreatorFanData, saveCreatorFanReview } from "@/lib/creatorIntelligence";
import { evaluateWorkspaceProcessingEntitlement } from "@/lib/workspaceProcessingPolicy.mjs";

function json(value: unknown, status = 200) { return NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store" } }); }
async function authorize(request: Request) {
  const accessToken = getOptionalBearerAccessToken(request);
  const contactId = new URL(request.url).searchParams.get("contactId") ?? "";
  const context = await requireContactInActiveAuthorizedWorkspace(contactId, accessToken);
  return { ...context, accessToken, canManage: context.workspace.owner_user_id === context.user.id };
}
export async function GET(request: Request) {
  try {
    const context = await authorize(request);
    if (!creatorIntelligenceEnabled()) return json({ available: false });
    return json({ available: true, canManage: context.canManage, ...await getCreatorFanData(context.workspace.id, context.contact.id, context.accessToken) });
  } catch { return json({ error: "Fan-Daten konnten nicht geladen werden. Bitte Creator-Profil und Workspace-Zugang prüfen." }, 409); }
}
export async function POST(request: Request) {
  try {
    const context = await authorize(request);
    if (!context.accessToken && !isTrustedFanMindMutationRequest(request)) return json({ error: "Bitte den angemeldeten FanMind-Bereich verwenden." }, 403);
    if (!context.canManage || !evaluateWorkspaceProcessingEntitlement(context.workspace).allowed) return json({ error: "Diese Prüfung kann nur der Owner eines aktiven Workspaces speichern." }, 403);
    if (!creatorIntelligenceEnabled()) return json({ error: "Die Creator-Erweiterung wird noch vorbereitet." }, 503);
    const body = await readBoundedJsonRequest(request, 12000);
    if (!body.ok) return json({ error: "Ungültige oder zu große Eingabe." }, body.reason === "payload_too_large" ? 413 : 400);
    await saveCreatorFanReview(context.workspace.id, context.contact.id, body.value, context.accessToken);
    return json({ ok: true });
  } catch { return json({ error: "Bitte Bestätigung, Quelle, Werte und Datum prüfen. Bereits erfasste Belege werden nicht doppelt gezählt." }, 409); }
}
