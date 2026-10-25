import { NextRequest, NextResponse } from "next/server";
import { syncFacebookMessengerHistory } from "@/app/channels/facebookWebhookActions";
import { syncInstagramMessengerHistory } from "@/app/channels/instagramWebhookActions";
import { consumeSharedRateLimit } from "@/lib/sharedRateLimit";
import {
  executeConfirmedMessageSyncRepair,
  type ConfirmedRepairPlatform,
} from "@/lib/supportConfirmedRepair";
import {
  completeRepairAuditEvent,
  startRepairAuditEvent,
} from "@/lib/supportRepairAuditServer";
import {
  getSupabaseServerUser,
  getUserWorkspaceDashboard,
  getWorkspaceSocialConnections,
} from "@/lib/supabase/server";

const supported = new Set<ConfirmedRepairPlatform>(["instagram", "facebook"]);
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

/**
 * Runs one allowlisted message-sync restart after explicit customer consent.
 * OAuth, credentials, permissions, disconnects and provider configuration are
 * never changed by this endpoint.
 */
export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  if (process.env.FANMIND_INAPP_HELP_REPAIR_ENABLED !== "true") {
    return NextResponse.json({ error: "not_available" }, { status: 404, headers });
  }
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403, headers });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }
  const body = input as Record<string, unknown>;
  if (
    body.confirmed !== true ||
    body.action !== "restart_message_sync" ||
    typeof body.platform !== "string" ||
    !supported.has(body.platform as ConfirmedRepairPlatform) ||
    typeof body.requestId !== "string" ||
    !uuid.test(body.requestId)
  ) {
    return NextResponse.json(
      { error: "explicit_consent_required" },
      { status: 400, headers },
    );
  }
  const platform = body.platform as ConfirmedRepairPlatform;

  const { data } = await getSupabaseServerUser();
  if (!data.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  }
  const workspaceResult = await getUserWorkspaceDashboard(data.user);
  if (!workspaceResult.workspace || workspaceResult.error) {
    return NextResponse.json(
      { error: "workspace_unavailable" },
      { status: 403, headers },
    );
  }
  const workspaceId = workspaceResult.workspace.id;
  const connections = await getWorkspaceSocialConnections(workspaceId);
  if (connections.error) {
    return NextResponse.json(
      { error: "diagnostics_unavailable" },
      { status: 503, headers },
    );
  }

  const repairCandidates = connections.connections.filter(
    (connection) =>
      connection.platform === platform &&
      connection.status === "connected" &&
      Boolean(connection.last_messenger_sync_error?.trim()),
  );
  if (repairCandidates.length === 0) {
    const requiresLogin = connections.connections.some(
      (connection) =>
        connection.platform === platform && connection.status !== "connected",
    );
    return NextResponse.json(
      {
        error: requiresLogin
          ? "manual_reauthorization_required"
          : "no_repair_needed",
      },
      { status: 409, headers },
    );
  }
  if (repairCandidates.length !== 1) {
    return NextResponse.json(
      { error: "ambiguous_connection_state" },
      { status: 409, headers },
    );
  }
  const connection = repairCandidates[0];
  const requestId = body.requestId;
  let auditCompletedAt: string | null = null;

  const result = await executeConfirmedMessageSyncRepair(
    { platform, connectionId: connection.id },
    {
      acquireRateLimit: () =>
        consumeSharedRateLimit({
          scope: "support.repair.message-sync",
          subject: `${workspaceId}:${platform}:${connection.id}`,
          maxRequests: 1,
          windowMs: 15 * 60 * 1000,
        }),
      startAudit: () =>
        startRepairAuditEvent({
          workspace_id: workspaceId,
          actor_user_id: data.user.id,
          platform,
          action: "restart_message_sync",
          consent_required: true,
          consent_given: true,
          status: "started",
          request_id: requestId,
          completed_at: null,
        }).then(() => undefined),
      completeAudit: (status) =>
        completeRepairAuditEvent({
          workspace_id: workspaceId,
          actor_user_id: data.user.id,
          platform,
          action: "restart_message_sync",
          consent_required: true,
          consent_given: true,
          status,
          request_id: requestId,
          completed_at: (auditCompletedAt ??= new Date().toISOString()),
        }).then(() => undefined),
      syncMessages: async (selectedPlatform) => {
        const sync =
          selectedPlatform === "facebook"
            ? await syncFacebookMessengerHistory({
                revalidate: true,
                expectedConnectionId: connection.id,
              })
            : await syncInstagramMessengerHistory({
                revalidate: true,
                expectedConnectionId: connection.id,
              });
        return {
          ok: sync.ok,
          continuationPending: sync.continuationPending,
        };
      },
      readConnections: () => getWorkspaceSocialConnections(workspaceId),
    },
  );

  if (result.status === "replayed") {
    return NextResponse.json(
      { error: "repair_request_replayed" },
      { status: 409, headers },
    );
  }
  if (result.status === "unavailable" || result.status === "audit_incomplete") {
    return NextResponse.json(
      { error: "repair_audit_unavailable", status: result.status },
      { status: 503, headers },
    );
  }
  if (result.status === "rate_limited") {
    return NextResponse.json(
      { requestId, status: result.status, repairExecuted: false, verified: false },
      { status: 429, headers },
    );
  }
  if (!result.verified) {
    return NextResponse.json(
      {
        requestId,
        status: result.status,
        repairExecuted: result.repairExecuted,
        verified: false,
        nextStepUrl: "/channels",
      },
      { status: 409, headers },
    );
  }
  return NextResponse.json(
    {
      requestId,
      status: "succeeded",
      repairExecuted: true,
      verified: true,
    },
    { headers },
  );
}
