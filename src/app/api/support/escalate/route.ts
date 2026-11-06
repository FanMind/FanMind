import { readSupportRequest } from "@/lib/supportCentreRequest";
import { NextRequest, NextResponse } from "next/server";
import { consumeSharedRateLimit } from "@/lib/sharedRateLimit";
import { getSupabaseServerUser, getUserWorkspaceDashboard, getWorkspaceSocialConnections } from "@/lib/supabase/server";
import { recordSupportProblem, supportCentreEnabled } from "@/lib/supportCentreServer";
import { supportPlatforms, type SupportPlatform } from "@/lib/supportCentrePolicy";

/** Explicit handoff of coarse diagnostics; no customer-selected workspace/connection. */
export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  const reply = (error: string, status: number) => NextResponse.json({ error }, { status, headers });
  if (!supportCentreEnabled() || process.env.FANMIND_INAPP_HELP_DIAGNOSTICS_ENABLED !== "true") return reply("not_available", 404);
  if (request.headers.get("origin") !== request.nextUrl.origin) return reply("invalid_origin", 403);
  try {
    const { data } = await getSupabaseServerUser();
    if (!data.user) return reply("unauthorized", 401);
    const workspace = await getUserWorkspaceDashboard(data.user);
    if (!workspace.workspace || workspace.error) return reply("workspace_unavailable", 403);
    let input: Record<string, unknown>;
    try { input = await readSupportRequest(request, 256); } catch { return reply("invalid_request", 400); }
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(k=>k!=="platform") || !supportPlatforms.includes(input.platform as SupportPlatform)) return reply("invalid_request", 400);
    const limit = await consumeSharedRateLimit({ scope: "support.centre.escalation", subject: workspace.workspace.id, maxRequests: 3, windowMs: 60000 });
    if (!limit.allowed) return reply("rate_limited", 429);
    const connections = await getWorkspaceSocialConnections(workspace.workspace.id);
    if (connections.error) return reply("diagnostics_unavailable", 503);
    const exact = connections.connections.filter(c=>c.workspace_id===workspace.workspace!.id && c.platform===input.platform);
    if (exact.length !== 1) return reply("connection_unavailable", 409);
    const connection = exact[0];
    const syncIssue = connection.status === "connected" && Boolean(connection.last_messenger_sync_error?.trim());
    if (connection.status === "connected" && !syncIssue) return reply("no_problem_found", 409);
    await recordSupportProblem({ workspace: workspace.workspace.id, connection: connection.id, platform: input.platform as SupportPlatform, problem: syncIssue ? "sync_attention" : "connection_attention" });
    return NextResponse.json({ status: "recorded" }, { headers });
  } catch { return reply("support_unavailable", 503); }
}
