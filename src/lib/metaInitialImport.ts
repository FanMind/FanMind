import "server-only";

import { syncFacebookMessengerConversationForContact } from "@/app/channels/facebookWebhookActions";
import { syncInstagramMessengerConversationForContact } from "@/app/channels/instagramWebhookActions";
import { areDemoConnectionsDisabled } from "@/lib/demoMode";
import { canManageMetaConnections } from "@/lib/metaIntegrationPolicy.mjs";
import { consumeSharedRateLimit } from "@/lib/sharedRateLimit";
import { getWorkspaceSocialConnectionsServer, type SocialConnectionRow } from "@/lib/supabase/server";
import { requireActiveAuthorizedWorkspace } from "@/lib/workspaceAuthorization";

export type MetaInitialImportBinding = Pick<SocialConnectionRow,
  "id" | "workspace_id" | "platform" | "page_id" | "connected_at" | "connected_by"
>;
export type MetaInitialImportStatus = "complete" | "partial" | "not_needed" | "deferred" | "failed";

/** Called only after the provider-confirmed connection has been saved. Never from a page/query. */
export async function runMetaInitialImport(
  binding: MetaInitialImportBinding,
  connectionType: string,
): Promise<MetaInitialImportStatus> {
  if (!["facebook", "instagram"].includes(binding.platform) ||
      connectionType !== `${binding.platform}_messages`) return "not_needed";

  async function loadAuthorizedConnection() {
    const { user, workspace } = await requireActiveAuthorizedWorkspace();
    if (user.id !== binding.connected_by || workspace.id !== binding.workspace_id ||
        !canManageMetaConnections(workspace.role) || areDemoConnectionsDisabled(user, workspace)) {
      throw new Error("meta_initial_import_forbidden");
    }
    const result = await getWorkspaceSocialConnectionsServer(workspace.id);
    if (result.error) throw new Error("meta_initial_import_unavailable");
    const connection = result.connections.find(row => row.id === binding.id);
    if (!connection || connection.status !== "connected" ||
        connection.platform !== binding.platform || connection.workspace_id !== binding.workspace_id ||
        connection.page_id !== binding.page_id || connection.connected_at !== binding.connected_at ||
        connection.connected_by !== binding.connected_by) throw new Error("meta_initial_import_changed");
    return connection;
  }

  try {
    const before = await loadAuthorizedConnection();
    if (before.last_messenger_sync_at) return "not_needed";
    // Existing database-backed limiter serializes the allowance across tabs/processes.
    // A missing limiter fails closed; there is no in-memory or unbounded retry fallback.
    const limit = await consumeSharedRateLimit({
      scope: "meta.initial-import",
      subject: `${binding.workspace_id}:${binding.platform}:${binding.id}`,
      maxRequests: 1,
      windowMs: 15 * 60 * 1000,
    });
    if (!limit.allowed) return "deferred";
    const connection = await loadAuthorizedConnection();
    if (connection.last_messenger_sync_at) return "not_needed";
    const sync = binding.platform === "facebook"
      ? syncFacebookMessengerConversationForContact
      : syncInstagramMessengerConversationForContact;
    const result = await sync({ connection, revalidate: true });
    return !result.ok ? "failed" : result.continuationPending ? "partial" : "complete";
  } catch {
    // A failed import must not misreport a successfully saved connection as failed OAuth.
    console.error("Meta initial import unavailable", { code: "meta_initial_import_failed" });
    return "failed";
  }
}
