import { NextResponse } from "next/server";
import {
  getSupabaseServerUser,
  getUserWorkspaceDashboard,
  getWorkspaceSocialConnections,
} from "@/lib/supabase/server";

// Read-only and feature gated. Never accepts a workspace ID from the caller.
export async function GET() {
  if (process.env.FANMIND_INAPP_HELP_DIAGNOSTICS_ENABLED !== "true") {
    return NextResponse.json({ error: "not_available" }, { status: 404 });
  }
  const { data } = await getSupabaseServerUser();
  if (!data.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const result = await getUserWorkspaceDashboard(data.user);
  if (!result.workspace || result.error) {
    return NextResponse.json({ error: "workspace_unavailable" }, { status: 403 });
  }

  const connections = await getWorkspaceSocialConnections(result.workspace.id);
  if (connections.error) {
    return NextResponse.json({ error: "diagnostics_unavailable" }, { status: 503 });
  }

  // Deliberately expose only platform and coarse status. No tokens, IDs,
  // account names, scopes, errors, or other private integration metadata.
  const safe = connections.connections
    .filter((connection) => ["facebook", "instagram", "whatsapp"].includes(connection.platform))
    .map((connection) => ({
      platform: connection.platform,
      status: connection.status === "connected" ? "connected" : "attention_required",
    }));

  return NextResponse.json(
    { ok: true, connections: safe },
    { headers: { "Cache-Control": "no-store" } },
  );
}
