import { runMetaInitialImport, type MetaInitialImportStatus } from "@/lib/metaInitialImport";
import {
  encryptToken,
  fetchFacebookGrantedPermissions,
  fetchFacebookPages,
  fetchFacebookTokenDiagnostics,
  getFacebookGrantedScopeNames,
  getGrantedFacebookPermissionNames,
  hasFacebookCommentFeedScopes,
  hasFacebookInsightsScopes,
  hasRequiredFacebookPagePermissions,
  isTokenEncryptionConfigured,
  FACEBOOK_PAGE_COMMENT_WEBHOOK_FIELDS,
  FACEBOOK_PAGE_MESSENGER_WEBHOOK_FIELDS,
  subscribeFacebookPage,
  tokenLastFour,
  type FacebookPage,
} from "@/lib/facebookIntegration";
import type { FacebookPageSelectionConnectionType } from "@/lib/facebookPageSelectionPolicy.mjs";
import {
  updateFacebookWebhookSubscribed,
  upsertFacebookSocialConnection,
} from "@/lib/supabase/server";

export type FacebookConnectionErrorCode =
  | "page_permissions"
  | "comment_review"
  | "insights_review"
  | "page_selection_required"
  | "page_selection_invalid"
  | "no_page"
  | "no_page_token"
  | "encryption"
  | "save";

export type FacebookConnectionFlowResult =
  | {
      ok: true;
      connectedType: FacebookPageSelectionConnectionType;
      pageId: string;
      pageName: string;
      initialImport: MetaInitialImportStatus;
    }
  | {
      ok: false;
      errorCode: FacebookConnectionErrorCode;
      selectablePages?: Array<Pick<FacebookPage, "id" | "name">>;
    };

export async function completeFacebookOAuthConnection(input: {
  workspaceId: string;
  connectedBy: string;
  connectionType: FacebookPageSelectionConnectionType;
  userAccessToken: string;
  selectedPageId?: string | null;
}): Promise<FacebookConnectionFlowResult> {
  const permissions = await fetchFacebookGrantedPermissions(
    input.userAccessToken,
  );
  const userTokenDiagnostics = await fetchFacebookTokenDiagnostics(
    input.userAccessToken,
  );
  const grantedPermissionNames =
    getGrantedFacebookPermissionNames(permissions);
  const isCommentConnection =
    input.connectionType === "facebook_comments";
  const isInsightsConnection =
    input.connectionType === "facebook_insights";

  if (
    !isCommentConnection &&
    !isInsightsConnection &&
    !hasRequiredFacebookPagePermissions(permissions)
  ) {
    return { ok: false, errorCode: "page_permissions" };
  }
  if (
    isCommentConnection &&
    !hasFacebookCommentFeedScopes(grantedPermissionNames)
  ) {
    return { ok: false, errorCode: "comment_review" };
  }
  if (
    isInsightsConnection &&
    !hasFacebookInsightsScopes(grantedPermissionNames)
  ) {
    return { ok: false, errorCode: "insights_review" };
  }

  const pages = await fetchFacebookPages(input.userAccessToken);
  if (!pages.length) return { ok: false, errorCode: "no_page" };

  if (pages.length > 1 && !input.selectedPageId) {
    return {
      ok: false,
      errorCode: "page_selection_required",
      selectablePages: pages.map(({ id, name }) => ({ id, name })),
    };
  }

  const page = input.selectedPageId
    ? pages.find((candidate) => candidate.id === input.selectedPageId)
    : pages[0];
  if (!page) return { ok: false, errorCode: "page_selection_invalid" };
  if (!page.accessToken)
    return { ok: false, errorCode: "no_page_token" };
  if (!isTokenEncryptionConfigured())
    return { ok: false, errorCode: "encryption" };

  const encryptedToken = encryptToken(page.accessToken);
  if (!encryptedToken)
    return { ok: false, errorCode: "encryption" };

  const pageTokenDiagnostics = await fetchFacebookTokenDiagnostics(
    page.accessToken,
  );
  const grantedScopes = mergeScopes(
    grantedPermissionNames,
    getFacebookGrantedScopeNames(userTokenDiagnostics),
    getFacebookGrantedScopeNames(pageTokenDiagnostics),
    page.scopes,
  );
  const desiredWebhookFields = isCommentConnection
    ? FACEBOOK_PAGE_COMMENT_WEBHOOK_FIELDS
    : isInsightsConnection
      ? []
      : FACEBOOK_PAGE_MESSENGER_WEBHOOK_FIELDS;
  const result = await upsertFacebookSocialConnection({
    workspaceId: input.workspaceId,
    connectedBy: input.connectedBy,
    externalAccountId: page.id,
    externalAccountName: page.name,
    pageId: page.id,
    pageName: page.name,
    pageAccessTokenEncrypted: encryptedToken,
    tokenLastFour: tokenLastFour(page.accessToken),
    scopes: grantedScopes,
    webhookSubscribed: false,
    oauthLoginType: "facebook_login",
    externalAccountType: "page",
    permissionsVerifiedAt: new Date().toISOString(),
  });

  if (result.error || !result.connection) {
    console.error("Facebook social connection save failed", {
      code: "facebook_connection_save_failed",
      workspaceIdPresent: Boolean(input.workspaceId),
      pageIdPresent: Boolean(page.id),
      pageNamePresent: Boolean(page.name),
      hasEncryptedToken: true,
      webhookSubscribed: false,
    });
    return { ok: false, errorCode: "save" };
  }

  if (desiredWebhookFields.length && result.connection) {
    const webhookStatus = await subscribeFacebookPage(
      page.id,
      page.accessToken,
      desiredWebhookFields,
    );
    const webhookSubscribed = Boolean(
      result.connection.webhook_subscribed ||
        (webhookStatus.subscribedAppsStatus === "active" &&
          desiredWebhookFields.every(
            (field) => webhookStatus.fields[field] === "active",
          )),
    );
    const webhookResult = await updateFacebookWebhookSubscribed(
      result.connection.id,
      webhookSubscribed,
    );
    if (webhookResult.error) {
      console.error("Facebook webhook status save failed", {
        code: "facebook_webhook_status_save_failed",
        pageIdPresent: true,
        webhookSubscribed,
      });
    }
  }

  const initialImport = await runMetaInitialImport(result.connection, input.connectionType);

  return {
    ok: true,
    initialImport,
    connectedType: input.connectionType,
    pageId: page.id,
    pageName: page.name,
  };
}

function mergeScopes(
  ...scopeGroups: Array<string[] | null | undefined>
): string[] {
  return [...new Set(scopeGroups.flatMap((scopes) => scopes ?? []))].sort();
}
