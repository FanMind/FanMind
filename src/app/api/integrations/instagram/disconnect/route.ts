import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { areDemoConnectionsDisabled } from "@/lib/demoMode";
import { isTrustedFanMindMutationRequest } from "@/lib/httpMutationPolicy.mjs";
import { canManageMetaConnections } from "@/lib/metaIntegrationPolicy.mjs";
import {
  disconnectInstagramSocialConnection,
  getSupabaseServerUser,
  getUserWorkspaceDashboard,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isTrustedFanMindMutationRequest(request)) {
    return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
  }
  const { data } = await getSupabaseServerUser();
  if (!data.user) redirect("/login");

  const workspaceResult = await getUserWorkspaceDashboard(data.user);
  if (!workspaceResult.workspace)
    redirect("/channels?instagram_error=workspace");
  if (!canManageMetaConnections(workspaceResult.workspace.role))
    redirect("/channels?instagram_error=role");
  if (areDemoConnectionsDisabled(data.user, workspaceResult.workspace))
    redirect("/channels?instagram_error=demo_disabled");

  await disconnectInstagramSocialConnection(workspaceResult.workspace.id);
  revalidatePath("/channels");
  redirect("/channels?disconnected=instagram");
}
