import { NextRequest, NextResponse } from "next/server";
import { saveRepairAuditEvent } from "@/lib/supportRepairAuditServer";
import {
  getSupabaseServerUser,
  getUserWorkspaceDashboard,
  getWorkspaceSocialConnections,
} from "@/lib/supabase/server";

const supported = new Set(["instagram", "facebook", "whatsapp"]);

/**
 * Validate an explicit, authenticated customer repair request.
 * This endpoint deliberately performs NO provider mutation. A future repair
 * executor must add CSRF protection, durable audit storage, authorization,
 * idempotency, provider-specific preconditions and post-action verification.
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
  try { input = await request.json(); }
  catch { return NextResponse.json({ error: "invalid_request" }, { status: 400, headers }); }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }
  const body = input as Record<string, unknown>;
  if (!supported.has(String(body.platform)) || body.confirmed !== true ||
      body.action !== "request_reconnect") {
    return NextResponse.json({ error: "explicit_consent_required" }, { status: 400, headers });
  }

  const { data } = await getSupabaseServerUser();
  if (!data.user) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  const workspaceResult = await getUserWorkspaceDashboard(data.user);
  if (!workspaceResult.workspace || workspaceResult.error) {
    return NextResponse.json({ error: "workspace_unavailable" }, { status: 403, headers });
  }
  // Validate membership through the authenticated workspace resolution,
  // never a client-supplied workspace identifier.
  const result = await getWorkspaceSocialConnections(workspaceResult.workspace.id);
  if (result.error) {
    return NextResponse.json({ error: "diagnostics_unavailable" }, { status: 503, headers });
  }
  const match = result.connections.some((connection) =>
    connection.platform === body.platform && connection.status !== "connected");
  if (!match) {
    return NextResponse.json({ error: "no_repair_needed" }, { status: 409, headers });
  }

  // Persist the customer-confirmed manual handoff before acknowledging it.
  // A failed audit write must never be reported as a successful request.
  const requestId = crypto.randomUUID();
  try {
    await saveRepairAuditEvent({
      workspace_id: workspaceResult.workspace.id,
      actor_user_id: data.user.id,
      platform: body.platform as "instagram" | "facebook" | "whatsapp",
      action: "request_reconnect",
      consent_required: true,
      consent_given: true,
      status: "manual_action_required",
      request_id: requestId,
      completed_at: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "repair_audit_unavailable" }, { status: 503, headers });
  }
  return NextResponse.json({
    requestId,
    status: "manual_action_required",
    repairExecuted: false,
    nextStepUrl: "/channels",
  }, { status: 202, headers });
}
