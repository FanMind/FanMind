import { revalidatePath } from "next/cache";
import {
  checkMetaWebhookStorageHealth,
  getSupabaseServerUser,
  getWorkspaceSocialConnections,
} from "@/lib/supabase/server";
import { processMetaWebhookPayload } from "@/lib/metaWebhook";
import { normalizeWebhookErrorCode } from "@/lib/webhookSecurityPolicy.mjs";
import { isTrustedFanMindMutationRequest } from "@/lib/httpMutationPolicy.mjs";
import { requireActiveAuthorizedWorkspace } from "@/lib/workspaceAuthorization";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isTrustedFanMindMutationRequest(request)) {
    return Response.json(
      { ok: false, error: "origin_forbidden" },
      { status: 403 },
    );
  }
  const { data } = await getSupabaseServerUser();
  if (!data.user) {
    return Response.json(
      { ok: false, error: "Nicht angemeldet." },
      { status: 401 },
    );
  }

  let activeContext;
  try {
    activeContext = await requireActiveAuthorizedWorkspace();
  } catch {
    return Response.json(
      { ok: false, error: "Workspace ist nicht aktiv." },
      { status: 403 },
    );
  }
  const workspace = activeContext.workspace;
  if (activeContext.user.id !== data.user.id) {
    return Response.json(
      { ok: false, error: "Kein Workspace gefunden." },
      { status: 403 },
    );
  }

  const storageHealth = await checkMetaWebhookStorageHealth();
  if (!storageHealth.serviceRoleConfigured || !storageHealth.tableReadable) {
    return Response.json(
      { ok: false, error: "Webhook-Diagnose ist nicht verfügbar." },
      { status: 503 },
    );
  }

  const connectionsResult = await getWorkspaceSocialConnections(workspace.id);
  const facebookConnection = connectionsResult.connections.find(
    (connection) =>
      connection.platform === "facebook" && connection.status === "connected",
  );
  const pageId = facebookConnection?.page_id ?? `fanmind-self-test-${workspace.id}`;
  const senderId = `fanmind-self-test-sender-${Date.now()}`;

  const payload = {
    object: "page",
    entry: [
      {
        id: pageId,
        time: Math.floor(Date.now() / 1000),
        messaging: [
          {
            sender: { id: senderId },
            recipient: { id: pageId },
            timestamp: Date.now(),
            message: {
              mid: `fanmind-self-test-${Date.now()}`,
              text: "FanMind Webhook-Selbsttest",
            },
          },
        ],
      },
    ],
  };

  const result = await processMetaWebhookPayload(payload);
  const errorCode = result.errorCode
    ? normalizeWebhookErrorCode(result.errorCode)
    : null;
  revalidatePath("/channels");

  return Response.json(
    {
      ok: !errorCode,
      workspace_id: workspace.id,
      page_id: pageId,
      event_type: "messages",
      status: errorCode ? "error" : result.saved ? "stored" : "ignored",
      error: errorCode ? "processing_failed" : null,
      saved: result.saved,
      skipped: result.skipped,
    },
    { status: errorCode ? 500 : 200 },
  );
}
