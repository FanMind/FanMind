import { syncFacebookMessengerConversationForContact } from "@/app/channels/facebookWebhookActions";
import { syncInstagramMessengerConversationForContact } from "@/app/channels/instagramWebhookActions";
import { readBoundedJsonRequest } from "@/lib/httpMutationPolicy.mjs";
import {
  isMetaCatchupQueueEnabled,
  META_CATCHUP_WORKER_SECRET_MIN_LENGTH,
  validateMetaCatchupWorkerRequestBody,
  type MetaCatchupWorkerDisposition,
  type MetaCatchupWorkerErrorCode,
} from "@/lib/metaCatchupQueuePolicy.mjs";
import {
  getClaimedMetaConversationCatchupJob,
  getWorkspaceProcessingEntitlement,
  getWorkspaceSocialConnectionsServer,
} from "@/lib/supabase/server";
import { timingSafeTextEqual } from "@/lib/webhookSecurityPolicy.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_WORKER_BODY_BYTES = 512;

export async function POST(request: Request) {
  if (!isAuthorizedWorkerRequest(request)) {
    return fixedError("worker_unauthorized", 401);
  }
  if (!isMetaCatchupQueueEnabled()) {
    return fixedError("queue_disabled", 503);
  }

  const parsed = await readBoundedJsonRequest(request, MAX_WORKER_BODY_BYTES);
  if (!parsed.ok) {
    return fixedError(
      parsed.reason === "payload_too_large" ? "payload_too_large" : "invalid_body",
      parsed.reason === "payload_too_large" ? 413 : 400,
    );
  }
  const validation = validateMetaCatchupWorkerRequestBody(parsed.value);
  if (!validation.ok) return fixedError("invalid_body", 400);

  const claimed = await getClaimedMetaConversationCatchupJob(validation.value);
  if (claimed.error) {
    return workerResult("retry", "internal_route_unavailable");
  }
  if (!claimed.job) return fixedError("claim_unavailable", 409);
  const job = claimed.job;

  const entitlement = await getWorkspaceProcessingEntitlement(
    job.workspace_id,
  );
  if (entitlement.error) {
    return workerResult("retry", "entitlement_unavailable");
  }
  if (!entitlement.allowed) {
    return workerResult("cancelled", "entitlement_unavailable");
  }

  const connections = await getWorkspaceSocialConnectionsServer(
    job.workspace_id,
  );
  if (connections.error) {
    return workerResult("retry", "connection_unavailable");
  }
  const connection = connections.connections.find(
    (candidate) =>
      candidate.id === job.social_connection_id &&
      candidate.workspace_id === job.workspace_id &&
      candidate.platform === job.platform &&
      candidate.status === "connected",
  );
  if (!connection) {
    return workerResult("terminal", "connection_unavailable");
  }

  let result;
  try {
    result =
      job.platform === "facebook"
        ? await syncFacebookMessengerConversationForContact({
            connection,
            contactId: job.contact_id,
            fanSenderId: job.fan_sender_id,
            revalidate: false,
          })
        : await syncInstagramMessengerConversationForContact({
            connection,
            contactId: job.contact_id,
            fanSenderId: job.fan_sender_id,
            revalidate: false,
          });
  } catch {
    return workerResult("retry", "meta_sync_failed");
  }

  return result.ok
    ? workerResult("success", null)
    : workerResult("retry", "meta_sync_failed");
}

function isAuthorizedWorkerRequest(request: Request): boolean {
  const configured = process.env.FANMIND_META_CATCHUP_WORKER_SECRET?.trim() ?? "";
  if (configured.length < META_CATCHUP_WORKER_SECRET_MIN_LENGTH) return false;
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  if (!authorization.startsWith("Bearer ")) return false;
  return timingSafeTextEqual(configured, authorization.slice(7).trim());
}

function workerResult(
  disposition: MetaCatchupWorkerDisposition,
  errorCode: MetaCatchupWorkerErrorCode | null,
) {
  return Response.json(
    { disposition, errorCode },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

function fixedError(error: string, status: number) {
  return Response.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
