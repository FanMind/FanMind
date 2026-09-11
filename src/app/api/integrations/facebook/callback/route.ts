import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { areDemoConnectionsDisabled } from "@/lib/demoMode";
import {
  createPendingFacebookPageSelection,
  exchangeFacebookCode,
  verifyFacebookOAuthState,
} from "@/lib/facebookIntegration";
import {
  FACEBOOK_PAGE_SELECTION_COOKIE,
  FACEBOOK_PAGE_SELECTION_MAX_AGE_SECONDS,
} from "@/lib/facebookPageSelectionPolicy.mjs";
import { completeFacebookOAuthConnection } from "@/lib/facebookConnectionFlow";
import { canManageMetaConnections } from "@/lib/metaIntegrationPolicy.mjs";
import {
  getSupabaseServerUser,
} from "@/lib/supabase/server";
import { requireActiveAuthorizedWorkspace } from "@/lib/workspaceAuthorization";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const appOrigin = getCanonicalAppOrigin(url);
  const code = url.searchParams.get("code");
  const state = verifyFacebookOAuthState(url.searchParams.get("state"));

  const { data } = await getSupabaseServerUser();
  if (!data.user) redirect("/login");
  if (!code || !state || state.userId !== data.user.id) {
    return redirectToChannels(appOrigin, "facebook_error=oauth");
  }

  let activeContext;
  try {
    activeContext = await requireActiveAuthorizedWorkspace();
  } catch {
    return redirectToChannels(appOrigin, "facebook_error=workspace_inactive");
  }
  const workspace = activeContext.workspace;
  if (
    activeContext.user.id !== data.user.id ||
    workspace.id !== state.workspaceId
  ) {
    return redirectToChannels(appOrigin, "facebook_error=workspace");
  }
  if (!canManageMetaConnections(workspace.role)) {
    return redirectToChannels(appOrigin, "facebook_error=role");
  }
  if (areDemoConnectionsDisabled(data.user, workspace)) {
    return redirectToChannels(appOrigin, "facebook_error=demo_disabled");
  }

  try {
    const userToken = await exchangeFacebookCode(code);
    const connectionType =
      state.connectionType ?? "facebook_messages";
    const result = await completeFacebookOAuthConnection({
      workspaceId: state.workspaceId,
      connectedBy: data.user.id,
      connectionType,
      userAccessToken: userToken,
    });

    if (!result.ok && result.errorCode === "page_selection_required") {
      const pendingSelection = createPendingFacebookPageSelection({
        workspaceId: state.workspaceId,
        userId: data.user.id,
        userAccessToken: userToken,
        connectionType,
      });
      if (!pendingSelection) {
        return redirectToChannels(appOrigin, "facebook_error=encryption");
      }
      const response = NextResponse.redirect(
        new URL("/channels/facebook/select", appOrigin),
        302,
      );
      response.cookies.set(
        FACEBOOK_PAGE_SELECTION_COOKIE,
        pendingSelection,
        {
          httpOnly: true,
          sameSite: "lax",
          secure: appOrigin.startsWith("https://"),
          path: "/",
          maxAge: FACEBOOK_PAGE_SELECTION_MAX_AGE_SECONDS,
          priority: "high",
        },
      );
      return response;
    }
    if (!result.ok) {
      return redirectToChannels(
        appOrigin,
        `facebook_error=${result.errorCode}&type=${connectionType}`,
      );
    }

    revalidatePath("/channels");
    return redirectToChannels(
      appOrigin,
      `connected=${result.connectedType}&meta_import=${result.initialImport}`,
    );
  } catch {
    console.error("Facebook OAuth callback failed", {
      code: "facebook_oauth_callback_failed",
    });
    return redirectToChannels(appOrigin, "facebook_error=callback");
  }
}

function redirectToChannels(appOrigin: string, query: string): Response {
  return Response.redirect(new URL(`/channels?${query}`, appOrigin), 302);
}

function getCanonicalAppOrigin(requestUrl: URL): string {
  const configuredAppUrl = parseOrigin(process.env.NEXT_PUBLIC_APP_URL ?? process.env.FANMIND_APP_URL);
  if (configuredAppUrl) return configuredAppUrl;

  const metaRedirectOrigin = parseOrigin(process.env.FACEBOOK_REDIRECT_URI ?? process.env.META_REDIRECT_URI);
  if (metaRedirectOrigin) return metaRedirectOrigin;

  return requestUrl.origin;
}

function parseOrigin(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}
