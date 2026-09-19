import { redirect } from "next/navigation";
import {
  createFacebookOAuthState,
  getFacebookOAuthUrl,
  isFacebookOAuthRuntimeReady,
} from "@/lib/facebookIntegration";
import {
  FACEBOOK_COMMENT_FEED_SCOPES,
  FACEBOOK_INSIGHTS_OAUTH_SCOPES,
  FACEBOOK_MESSAGES_OAUTH_SCOPES,
} from "@/lib/facebookScopes";
import { canManageMetaConnections } from "@/lib/metaIntegrationPolicy.mjs";
import {
  getSupabaseServerUser,
} from "@/lib/supabase/server";
import { areDemoConnectionsDisabled } from "@/lib/demoMode";
import { requireActiveAuthorizedWorkspace } from "@/lib/workspaceAuthorization";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const requestedType = requestUrl.searchParams.get("type");
  const connectionType =
    requestedType === "facebook_comments" ||
    requestedType === "facebook_insights"
      ? requestedType
      : "facebook_messages";
  const { data } = await getSupabaseServerUser();
  if (!data.user) redirect("/login");

  let activeContext;
  try {
    activeContext = await requireActiveAuthorizedWorkspace();
  } catch {
    redirect("/channels?facebook_error=workspace_inactive");
  }
  const workspace = activeContext.workspace;
  if (activeContext.user.id !== data.user.id)
    redirect("/channels?facebook_error=workspace");
  if (!canManageMetaConnections(workspace.role))
    redirect("/channels?facebook_error=role");
  if (areDemoConnectionsDisabled(data.user, workspace))
    redirect("/channels?facebook_error=demo_disabled");

  if (!isFacebookOAuthRuntimeReady())
    redirect("/channels?facebook_error=config");

  try {
    const state = createFacebookOAuthState({
      workspaceId: workspace.id,
      userId: data.user.id,
      connectionType,
    });
    const scopes =
      connectionType === "facebook_comments"
        ? FACEBOOK_COMMENT_FEED_SCOPES
        : connectionType === "facebook_insights"
          ? FACEBOOK_INSIGHTS_OAUTH_SCOPES
          : FACEBOOK_MESSAGES_OAUTH_SCOPES;
    return Response.redirect(getFacebookOAuthUrl(state, scopes), 302);
  } catch {
    redirect("/channels?facebook_error=config");
  }
}
