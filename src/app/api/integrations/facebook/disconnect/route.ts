import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import {
  disconnectFacebookSocialConnection,
  getSupabaseServerUser,
  getUserWorkspaceDashboard,
} from "@/lib/supabase/server";
import { areDemoConnectionsDisabled } from "@/lib/demoMode";
import { isTrustedFanMindMutationRequest } from "@/lib/httpMutationPolicy.mjs";
import { canManageMetaConnections } from "@/lib/metaIntegrationPolicy.mjs";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isTrustedFanMindMutationRequest(request)) {
    return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
  }
  const { data } = await getSupabaseServerUser();
  if (!data.user) redirect("/login");

  const workspaceResult = await getUserWorkspaceDashboard(data.user);
  if (!workspaceResult.workspace)
    redirect("/channels?facebook_error=workspace");
  if (!canManageMetaConnections(workspaceResult.workspace.role))
    redirect("/channels?facebook_error=role");
  if (areDemoConnectionsDisabled(data.user, workspaceResult.workspace))
    redirect("/channels?facebook_error=demo_disabled");

  await disconnectFacebookSocialConnection(workspaceResult.workspace.id);
  revalidatePath("/channels");
  redirect("/channels?disconnected=facebook");
}
