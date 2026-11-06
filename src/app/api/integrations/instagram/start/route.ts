import { redirect } from "next/navigation";
import { areDemoConnectionsDisabled } from "@/lib/demoMode";
import {
  createInstagramOAuthState,
  getInstagramOAuthScopes,
  getInstagramOAuthUrl,
  type InstagramConnectionType,
} from "@/lib/instagramIntegration";
import { canManageMetaConnections } from "@/lib/metaIntegrationPolicy.mjs";
import {
  getSupabaseServerUser,
} from "@/lib/supabase/server";
import { requireActiveAuthorizedWorkspace } from "@/lib/workspaceAuthorization";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestedType = new URL(request.url).searchParams.get("type");
  const connectionType: InstagramConnectionType =
    requestedType === "instagram_comments" ||
    requestedType === "instagram_insights"
      ? requestedType
      : "instagram_messages";
  const { data } = await getSupabaseServerUser();
  if (!data.user) redirect("/login");

  let activeContext;
  try {
    activeContext = await requireActiveAuthorizedWorkspace();
  } catch {
    redirect("/channels?instagram_error=workspace_inactive");
  }
  const workspace = activeContext.workspace;
  if (activeContext.user.id !== data.user.id)
    redirect("/channels?instagram_error=workspace");
  if (!canManageMetaConnections(workspace.role))
    redirect("/channels?instagram_error=role");
  if (areDemoConnectionsDisabled(data.user, workspace))
    redirect("/channels?instagram_error=demo_disabled");

  try {
    const state = createInstagramOAuthState({
      workspaceId: workspace.id,
      userId: data.user.id,
      connectionType,
    });
    return Response.redirect(
      getInstagramOAuthUrl(state, getInstagramOAuthScopes(connectionType)),
      302,
    );
  } catch {
    redirect("/channels?instagram_error=config");
  }
}
