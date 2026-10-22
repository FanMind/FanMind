import { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseServerUser,
  getUserWorkspaceDashboard,
  getWorkspaceSocialConnections,
} from "@/lib/supabase/server";
import { getSupportRepairPolicy } from "@/lib/supportRepairPolicy";
import { verifyConnectionAfterRepair } from "@/lib/supportRepairPostcheck";

const supported = new Set(["instagram", "facebook", "whatsapp"]);

/**
 * Executes only safe read-only support actions.
 * No provider API mutations, reconnections, or customer data writes.
 * Durable audit storage for mutating repairs is intentionally not implemented.
 */
export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  if (process.env.FANMIND_INAPP_HELP_AUTOMATIC_CHECKS_ENABLED !== "true") {
    return NextResponse.json({ error: "not_available" }, { status: 404, headers });
  }
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403, headers });
  }
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "invalid_request" }, { status: 400, headers }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }
  const input = body as Record<string, unknown>;
  const action = typeof input.action === "string" ? input.action : "";
  const policy = getSupportRepairPolicy(action);
  if (!policy || policy.classification !== "automatic" ||
      typeof input.platform !== "string" || !supported.has(input.platform)) {
    return NextResponse.json({ error: "action_not_permitted" }, { status: 403, headers });
  }

  const { data } = await getSupabaseServerUser();
  if (!data.user) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  const workspace = await getUserWorkspaceDashboard(data.user);
  if (!workspace.workspace || workspace.error) {
    return NextResponse.json({ error: "workspace_unavailable" }, { status: 403, headers });
  }
  const connections = await getWorkspaceSocialConnections(workspace.workspace.id);
  if (connections.error) {
    return NextResponse.json({ error: "diagnostics_unavailable" }, { status: 503, headers });
  }
  const check = verifyConnectionAfterRepair(connections.connections, input.platform as "instagram" | "facebook" | "whatsapp");
  return NextResponse.json({
    action,
    platform: input.platform,
    status: check.status,
    performed: "read_only_check",
    changed: false,
    verified: check.verified,
  }, { headers });
}
