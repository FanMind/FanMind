import { NextResponse } from "next/server";
import { requireAuthorizedWorkspaceMember } from "@/lib/workspaceAuthorization";
import { evaluateWorkspaceProcessingEntitlement } from "@/lib/workspaceProcessingPolicy.mjs";
import { isTrustedFanMindMutationRequest, readBoundedJsonRequest } from "@/lib/httpMutationPolicy.mjs";
import { getOptionalBearerAccessToken } from "@/lib/requestAccessToken";
import { creatorIntelligenceEnabled, getCreatorBundles, saveCreatorBundle } from "@/lib/creatorIntelligence";
import { CreatorPolicyError } from "@/lib/creatorIntelligencePolicy.mjs";

function response(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
}
async function authorize(request: Request) {
  const accessToken = getOptionalBearerAccessToken(request);
  const context = await requireAuthorizedWorkspaceMember(accessToken);
  return { ...context, accessToken, canManage: context.workspace.owner_user_id === context.user.id };
}
export async function GET(request: Request) {
  try {
    const context = await authorize(request);
    if (!creatorIntelligenceEnabled()) return response({ available: false, creators: [], canManage: false });
    return response({ available: true, creators: await getCreatorBundles(context.workspace.id, context.accessToken), canManage: context.canManage });
  } catch {
    return response({ error: "Creator-Profile konnten nicht geladen werden. Bitte prüfe deinen Workspace-Zugang." }, 403);
  }
}
export async function POST(request: Request) {
  try {
    const context = await authorize(request);
    if (!context.accessToken && !isTrustedFanMindMutationRequest(request)) return response({ error: "Die Änderung muss aus dem angemeldeten FanMind-Bereich erfolgen." }, 403);
    if (!context.canManage || !evaluateWorkspaceProcessingEntitlement(context.workspace).allowed) return response({ error: "Nur der Owner eines aktiven Workspaces kann Creator-Profile ändern." }, 403);
    if (!creatorIntelligenceEnabled()) return response({ error: "Creator-Profile werden für diesen Zugang noch vorbereitet." }, 503);
    const body = await readBoundedJsonRequest(request, 32000);
    if (!body.ok) return response({ error: "Bitte prüfe die Eingabe und Textlängen." }, body.reason === "payload_too_large" ? 413 : 400);
    const payload = body.value as { action?: unknown; bundle?: unknown } | null;
    if (payload?.action !== "save") return response({ error: "Ungültige Creator-Aktion." }, 400);
    const creatorId = await saveCreatorBundle(context.workspace.id, payload.bundle, context.accessToken);
    return response({ ok: true, creatorId, creators: await getCreatorBundles(context.workspace.id, context.accessToken) });
  } catch (error) {
    return response({ error: error instanceof CreatorPolicyError
      ? "Bitte prüfe Pflichtfelder, Preise und Textlängen. Für die Freigabe sind drei echte Beispielnachrichten nötig."
      : "Die Änderung konnte nicht gespeichert werden. Bitte lade die aktuellen Profile erneut; bestehendes Fanwissen bleibt erhalten." }, error instanceof CreatorPolicyError ? 400 : 409);
  }
}
