import { runMetaInitialImport } from "@/lib/metaInitialImport";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { areDemoConnectionsDisabled } from "@/lib/demoMode";
import {
  encryptToken,
  isTokenEncryptionConfigured,
  tokenLastFour,
} from "@/lib/facebookIntegration";
import {
  exchangeInstagramCode,
  exchangeInstagramLongLivedToken,
  fetchInstagramProfile,
  getInstagramOAuthScopes,
  subscribeInstagramAccount,
  verifyInstagramOAuthState,
} from "@/lib/instagramIntegration";
import { canManageMetaConnections } from "@/lib/metaIntegrationPolicy.mjs";
import {
  getSupabaseServerUser,
  updateInstagramWebhookSubscribed,
  upsertInstagramSocialConnection,
} from "@/lib/supabase/server";
import { requireActiveAuthorizedWorkspace } from "@/lib/workspaceAuthorization";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const appOrigin = getCanonicalAppOrigin(url);
  const code = url.searchParams.get("code");
  const state = verifyInstagramOAuthState(url.searchParams.get("state"));

  const { data } = await getSupabaseServerUser();
  if (!data.user) redirect("/login");
  if (!code || !state || state.userId !== data.user.id) {
    return redirectToChannels(appOrigin, "instagram_error=oauth");
  }

  let activeContext;
  try {
    activeContext = await requireActiveAuthorizedWorkspace();
  } catch {
    return redirectToChannels(appOrigin, "instagram_error=workspace_inactive");
  }
  const workspace = activeContext.workspace;
  if (
    activeContext.user.id !== data.user.id ||
    workspace.id !== state.workspaceId
  ) {
    return redirectToChannels(appOrigin, "instagram_error=workspace");
  }
  if (!canManageMetaConnections(workspace.role)) {
    return redirectToChannels(appOrigin, "instagram_error=role");
  }
  if (areDemoConnectionsDisabled(data.user, workspace)) {
    return redirectToChannels(appOrigin, "instagram_error=demo_disabled");
  }

  try {
    const shortLivedToken = await exchangeInstagramCode(code);
    const token = await exchangeInstagramLongLivedToken(shortLivedToken);
    const profile = await fetchInstagramProfile(token);
    if (!isTokenEncryptionConfigured()) {
      return redirectToChannels(appOrigin, "instagram_error=encryption");
    }
    const encryptedToken = encryptToken(token.accessToken);
    if (!encryptedToken) {
      return redirectToChannels(appOrigin, "instagram_error=encryption");
    }

    const connectedAt = new Date();
    const tokenExpiresAt = token.expiresIn
      ? new Date(connectedAt.getTime() + token.expiresIn * 1_000).toISOString()
      : null;
    const result = await upsertInstagramSocialConnection({
      workspaceId: state.workspaceId,
      connectedBy: data.user.id,
      externalAccountId: profile.userId,
      externalAccountName: profile.username,
      pageId: profile.userId,
      pageName: profile.username,
      pageAccessTokenEncrypted: encryptedToken,
      tokenLastFour: tokenLastFour(token.accessToken),
      scopes: [...getInstagramOAuthScopes(state.connectionType)],
      webhookSubscribed: false,
      oauthLoginType: "instagram_login",
      externalAccountType: "professional",
      tokenExpiresAt,
      permissionsVerifiedAt: null,
    });
    if (result.error || !result.connection) {
      console.error("Instagram social connection save failed", {
        code: "instagram_connection_save_failed",
        workspaceIdPresent: Boolean(state.workspaceId),
        accountIdPresent: Boolean(profile.userId),
        usernamePresent: Boolean(profile.username),
        hasEncryptedToken: true,
      });
      return redirectToChannels(appOrigin, "instagram_error=save");
    }

    if (state.connectionType !== "instagram_insights" && result.connection) {
      const subscribed = await subscribeInstagramAccount(
        profile.userId,
        token.accessToken,
        state.connectionType,
      );
      const webhookResult = await updateInstagramWebhookSubscribed(
        result.connection.id,
        Boolean(result.connection.webhook_subscribed || subscribed),
      );
      if (webhookResult.error) {
        console.error("Instagram webhook status save failed", {
          code: "instagram_webhook_status_save_failed",
          accountIdPresent: true,
          subscribed,
        });
      }
    }

    const initialImport = await runMetaInitialImport(result.connection, state.connectionType);
    revalidatePath("/channels");
    return redirectToChannels(
      appOrigin,
      `connected=${state.connectionType}&meta_import=${initialImport}`,
    );
  } catch {
    console.error("Instagram OAuth callback failed", {
      code: "instagram_oauth_callback_failed",
    });
    return redirectToChannels(appOrigin, "instagram_error=callback");
  }
}

function redirectToChannels(appOrigin: string, query: string): Response {
  return Response.redirect(new URL(`/channels?${query}`, appOrigin), 302);
}

function getCanonicalAppOrigin(requestUrl: URL): string {
  for (const value of [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.FANMIND_APP_URL,
    process.env.INSTAGRAM_REDIRECT_URI,
  ]) {
    const origin = parseOrigin(value);
    if (origin) return origin;
  }
  return requestUrl.origin;
}

function parseOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.origin
      : null;
  } catch {
    return null;
  }
}
