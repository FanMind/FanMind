import { redirect } from "next/navigation";
import { getPreActivationRedirect } from "@/lib/preActivation";
import {
  checkMetaWebhookStorageHealth,
  getOpenFollowupCount,
  getSupabaseServerUser,
  getUserWorkspaceDashboard,
  getWorkspaceContacts,
  getWorkspaceMetaWebhookEvents,
  getWorkspaceSocialConnections,
  getWorkspaceTelegramMessages,
  signOutSupabaseServerSession,
  type ConversationMessageRow,
  type MetaWebhookEventRow,
  type SocialConnectionRow,
  type WorkspaceDashboardRow,
} from "@/lib/supabase/server";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { getWorkspaceNavigationForUser } from "@/lib/workspaceNavigation";
import { resolveWorkspaceLocale } from "@/lib/workspaceLocale";
import { wt } from "@/lib/workspaceCopy";
import type { FanMindLanguage } from "@/lib/fanmindCopy";
import { getWorkspaceKpiStatsFromContacts } from "@/lib/workspaceKpiStats";
import dashboardStyles from "../dashboard/dashboard.module.css";
import { ChannelsGrid } from "./ChannelsGrid";
import { getTelegramWebhookStatus, type TelegramWebhookStatus } from "@/lib/telegramStatus";
import { areDemoConnectionsDisabled } from "@/lib/demoMode";
import { isInstagramOAuthConfigured } from "@/lib/instagramIntegration";
import { isTokenEncryptionConfigured } from "@/lib/facebookIntegration";

type SafeFacebookConnection = Pick<
  SocialConnectionRow,
  "page_name" | "page_id" | "webhook_subscribed" | "last_event_at" | "scopes" | "last_comment_fetch_at" | "last_comment_fetch_count" | "last_comment_fetch_error" | "last_messenger_sync_at" | "last_messenger_sync_checked_count" | "last_messenger_sync_imported_inbound_count" | "last_messenger_sync_imported_outbound_count" | "last_messenger_sync_imported_media_count" | "last_messenger_sync_skipped_count" | "last_messenger_sync_error" | "last_messenger_sync_outbound_at"
> & { has_page_access_token: boolean };

type SafeInstagramConnection = {
  account_name: string | null;
  account_id: string | null;
  has_access_token: boolean;
  scopes: string[] | null;
  token_expires_at: string | null;
  webhook_subscribed: boolean;
  last_messenger_sync_at: string | null;
  last_messenger_sync_checked_count: number | null;
  last_messenger_sync_imported_inbound_count: number | null;
  last_messenger_sync_imported_outbound_count: number | null;
  last_messenger_sync_skipped_count: number | null;
  last_messenger_sync_error: string | null;
};

type FacebookLiveSetupStatus = {
  facebookAppIdConfigured: boolean;
  facebookAppSecretConfigured: boolean;
  webhookVerifyTokenConfigured: boolean;
  publicBaseUrlConfigured: boolean;
  metaBusinessIdConfigured: boolean;
  oauthCallbackUrl: string | null;
};

type ChannelsWorkspaceProps = {
  workspace: WorkspaceDashboardRow;
  userDisplayName: string;
  contactCount: number;
  openFollowupCount: number;
  facebookConnection: SafeFacebookConnection | null;
  facebookError?: string | null;
  instagramConnection: SafeInstagramConnection | null;
  instagramError?: string | null;
  instagramOAuthConfigured: boolean;
  metaWebhookEvents: MetaWebhookEventRow[];
  metaWebhookError?: string | null;
  metaWebhookStorageHealth: {
    serviceRoleConfigured: boolean;
    tableReadable: boolean;
    error: string | null;
  };
  facebookLiveSetupStatus: FacebookLiveSetupStatus;
  telegramMessages: ConversationMessageRow[];
  telegramMessagesError?: string | null;
  telegramSetupStatus: TelegramWebhookStatus;
  telegramCheckRequested: boolean;
  demoConnectionsDisabled: boolean;
  locale: FanMindLanguage;
  userEmail: string | null | undefined;
};

async function logout() {
  "use server";

  await signOutSupabaseServerSession();
  redirect("/");
}

function ChannelsWorkspace({
  workspace,
  userDisplayName,
  contactCount,
  openFollowupCount,
  facebookConnection,
  facebookError,
  instagramConnection,
  instagramError,
  instagramOAuthConfigured,
  metaWebhookEvents,
  metaWebhookError,
  metaWebhookStorageHealth,
  facebookLiveSetupStatus,
  telegramMessages,
  telegramMessagesError,
  telegramSetupStatus,
  telegramCheckRequested,
  demoConnectionsDisabled,
  locale,
  userEmail,
}: ChannelsWorkspaceProps) {
  const { mainNavigation, settingsNavigation, savedViews } =
    getWorkspaceNavigationForUser(
      "channels",
      userEmail,
      locale,
      0,
      workspace.role,
    );
  const userLabel = userDisplayName || workspace.name || (locale === "en" ? "User" : "Nutzer");

  return (
    <WorkspaceShell
      workspaceName={workspace.name}
      userLabel={userLabel}
      planLabel={workspace.plan_id}
      planMeta={workspace.role}
      planStatus="Sync"
      mainNavigation={mainNavigation}
      settingsNavigation={settingsNavigation}
      savedViews={savedViews}
      header={{
        title: wt(locale, "Kanäle"),
        subtitle:
          "Verbinde Quellen für Nachrichten, Kommentare, Leads und Support-Anfragen.",
        searchPlaceholder: "Suche nach Plattform, Status oder Anschlussart ...",
        primaryActionLabel: "Sync vorbereiten",
        primaryActionHref: "#channel-grid-title",
      }}
      contactCount={contactCount}
      openFollowupCount={openFollowupCount}
      logoutAction={logout}
      locale={locale}
    >
      <ChannelsGrid
        facebookConnection={facebookConnection}
        facebookError={facebookError}
        instagramConnection={instagramConnection}
        instagramError={instagramError}
        instagramOAuthConfigured={instagramOAuthConfigured}
        metaWebhookEvents={metaWebhookEvents}
        metaWebhookError={metaWebhookError}
        metaWebhookStorageHealth={metaWebhookStorageHealth}
        facebookLiveSetupStatus={facebookLiveSetupStatus}
        telegramMessages={telegramMessages}
        telegramMessagesError={telegramMessagesError}
        telegramSetupStatus={telegramSetupStatus}
        telegramCheckRequested={telegramCheckRequested}
        demoConnectionsDisabled={demoConnectionsDisabled}
      />
    </WorkspaceShell>
  );
}

function getUserDisplayName(
  metadata: Record<string, unknown> | undefined,
  fallback: string,
): string {
  const displayName = metadata?.display_name ?? metadata?.full_name;

  return typeof displayName === "string" && displayName.trim()
    ? displayName.trim()
    : fallback;
}

function singleSearchParam(
  value: string | string[] | undefined,
): string | null {
  if (typeof value === "string") return value;
  return Array.isArray(value) && typeof value[0] === "string"
    ? value[0]
    : null;
}

export default async function ChannelsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const { data, error: userError } = await getSupabaseServerUser();

  if (!data.user) {
    redirect("/login");
  }

  const locale = await resolveWorkspaceLocale({ lang: params.lang, user: data.user });
  const workspaceResult = await getUserWorkspaceDashboard(data.user);
  if (workspaceResult.error?.message === "TEMPORARY_DEMO_DELETED") {
    redirect("/login?demo_deleted=1");
  }

  const workspace = workspaceResult.workspace;
  const preActivationRedirect = getPreActivationRedirect(workspace, data.user.email);
  if (preActivationRedirect) redirect(preActivationRedirect);
  const contactsResult = workspace
    ? await getWorkspaceContacts(workspace.id)
    : null;
  const socialConnectionsResult = workspace
    ? await getWorkspaceSocialConnections(workspace.id)
    : null;
  const metaWebhookEventsResult = workspace
    ? await getWorkspaceMetaWebhookEvents(workspace.id, 20)
    : null;
  const metaWebhookStorageHealthResult = workspace
    ? await checkMetaWebhookStorageHealth()
    : null;
  const telegramMessagesResult = workspace
    ? await getWorkspaceTelegramMessages(workspace.id, 5)
    : null;
  const openFollowupCountResult = workspace
    ? await getOpenFollowupCount(workspace.id)
    : null;
  const telegramSetupStatus = await getTelegramWebhookStatus();
  const telegramCheckRequested = params.check === "telegram";
  const facebookConnection =
    socialConnectionsResult?.connections.find(
      (connection) =>
        connection.platform === "facebook" && connection.status === "connected",
    ) ?? null;
  const instagramConnection =
    socialConnectionsResult?.connections.find(
      (connection) =>
        connection.platform === "instagram" && connection.status === "connected",
    ) ?? null;

  return (
    <main className={dashboardStyles.page}>
      {(facebookConnection || instagramConnection) && ["failed", "deferred", "partial"].includes(singleSearchParam(params.meta_import) ?? "") ? (
        <p role="status">
          {locale === "en"
            ? "The first message import is not complete. Check the import status in your channel and continue with the manual sync if needed."
            : "Der erste Nachrichtenimport ist noch nicht vollständig. Prüfe den Importstatus im Kanal und setze den Abgleich bei Bedarf manuell fort."}
        </p>
      ) : null}
      {workspace ? (
        <ChannelsWorkspace
          workspace={workspace}
          userDisplayName={getUserDisplayName(
            data.user.user_metadata,
            workspace.name,
          )}
          contactCount={getWorkspaceKpiStatsFromContacts(contactsResult?.contacts ?? []).totalFans}
          openFollowupCount={openFollowupCountResult?.count ?? 0}
          facebookConnection={facebookConnection ? {
            page_name: facebookConnection.page_name,
            page_id: facebookConnection.page_id,
            webhook_subscribed: facebookConnection.webhook_subscribed,
            last_event_at: facebookConnection.last_event_at,
            has_page_access_token: Boolean(facebookConnection.token_last_four),
            scopes: facebookConnection.scopes ?? [],
            last_comment_fetch_at: facebookConnection.last_comment_fetch_at,
            last_comment_fetch_count: facebookConnection.last_comment_fetch_count,
            last_comment_fetch_error: facebookConnection.last_comment_fetch_error,
            last_messenger_sync_at: facebookConnection.last_messenger_sync_at,
            last_messenger_sync_checked_count: facebookConnection.last_messenger_sync_checked_count,
            last_messenger_sync_imported_inbound_count: facebookConnection.last_messenger_sync_imported_inbound_count,
            last_messenger_sync_imported_outbound_count: facebookConnection.last_messenger_sync_imported_outbound_count,
            last_messenger_sync_imported_media_count: facebookConnection.last_messenger_sync_imported_media_count,
            last_messenger_sync_skipped_count: facebookConnection.last_messenger_sync_skipped_count,
            last_messenger_sync_error: facebookConnection.last_messenger_sync_error,
            last_messenger_sync_outbound_at: facebookConnection.last_messenger_sync_outbound_at,
          } : null}
          facebookError={singleSearchParam(params.facebook_error)}
          instagramConnection={instagramConnection ? {
            account_name: instagramConnection.external_account_name ?? instagramConnection.page_name,
            account_id: instagramConnection.external_account_id ?? instagramConnection.page_id,
            has_access_token: Boolean(instagramConnection.token_last_four),
            scopes: instagramConnection.scopes ?? [],
            token_expires_at: instagramConnection.token_expires_at,
            webhook_subscribed: instagramConnection.webhook_subscribed,
            last_messenger_sync_at: instagramConnection.last_messenger_sync_at,
            last_messenger_sync_checked_count: instagramConnection.last_messenger_sync_checked_count,
            last_messenger_sync_imported_inbound_count: instagramConnection.last_messenger_sync_imported_inbound_count,
            last_messenger_sync_imported_outbound_count: instagramConnection.last_messenger_sync_imported_outbound_count,
            last_messenger_sync_skipped_count: instagramConnection.last_messenger_sync_skipped_count,
            last_messenger_sync_error: instagramConnection.last_messenger_sync_error,
          } : null}
          instagramError={singleSearchParam(params.instagram_error)}
          instagramOAuthConfigured={isInstagramOAuthConfigured() && isTokenEncryptionConfigured()}
          metaWebhookEvents={metaWebhookEventsResult?.events ?? []}
          metaWebhookError={metaWebhookEventsResult?.error?.message ?? null}
          metaWebhookStorageHealth={{
            serviceRoleConfigured:
              metaWebhookStorageHealthResult?.serviceRoleConfigured ?? false,
            tableReadable: metaWebhookStorageHealthResult?.tableReadable ?? false,
            error: metaWebhookStorageHealthResult?.error?.message ?? null,
          }}
          facebookLiveSetupStatus={getFacebookLiveSetupStatus()}
          telegramMessages={telegramMessagesResult?.messages ?? []}
          telegramMessagesError={telegramMessagesResult?.error?.message ?? null}
          telegramSetupStatus={telegramSetupStatus}
          telegramCheckRequested={telegramCheckRequested}
          demoConnectionsDisabled={areDemoConnectionsDisabled(data.user, workspace)}
          locale={locale}
          userEmail={data.user.email}
        />
      ) : (
        <section
          className={dashboardStyles.fallbackCard}
          aria-label="FanMind Kanäle"
        >
          <div>
            <p className={dashboardStyles.eyebrow}>FanMind Kanäle</p>
            <h1>Workspace-Status</h1>
            <p>
              Kanäle ist geschützt: Supabase Auth ist aktiv. Für deinen Account
              wurde noch kein Workspace gefunden.
            </p>
          </div>
          {userError ? (
            <p className={dashboardStyles.error}>
              <strong>
                Supabase-Session konnte nicht vollständig geprüft werden.
              </strong>
              <span>{userError.message}</span>
            </p>
          ) : null}
          {workspaceResult.error ? (
            <p className={dashboardStyles.error}>
              <strong>Workspace-Daten konnten nicht geladen werden.</strong>
              <span>{workspaceResult.error.message}</span>
            </p>
          ) : null}
          <form action={logout}>
            <button type="submit" className={dashboardStyles.secondaryButton}>
              Abmelden
            </button>
          </form>
        </section>
      )}
    </main>
  );
}

function getFacebookLiveSetupStatus(): FacebookLiveSetupStatus {
  const publicBaseUrl = firstConfiguredEnv("NEXT_PUBLIC_APP_URL", "FANMIND_APP_URL");
  const explicitCallbackUrl = firstConfiguredEnv("FACEBOOK_REDIRECT_URI", "META_REDIRECT_URI");
  const oauthCallbackUrl = explicitCallbackUrl ?? (publicBaseUrl ? `${publicBaseUrl.replace(/\/$/, "")}/api/integrations/facebook/callback` : null);

  return {
    facebookAppIdConfigured: Boolean(firstConfiguredEnv("FACEBOOK_APP_ID", "META_APP_ID")),
    facebookAppSecretConfigured: Boolean(firstConfiguredEnv("FACEBOOK_APP_SECRET", "META_APP_SECRET", "META_WEBHOOK_APP_SECRET")),
    webhookVerifyTokenConfigured: Boolean(firstConfiguredEnv("FACEBOOK_WEBHOOK_VERIFY_TOKEN", "META_WEBHOOK_VERIFY_TOKEN")),
    publicBaseUrlConfigured: Boolean(publicBaseUrl),
    metaBusinessIdConfigured: Boolean(firstConfiguredEnv("META_BUSINESS_ID", "NEXT_PUBLIC_META_BUSINESS_ID")),
    oauthCallbackUrl,
  };
}

function firstConfiguredEnv(...names: string[]): string | null {
  for (const name of names) {
    const value = process.env[name];
    if (value?.trim()) return value.trim();
  }
  return null;
}
