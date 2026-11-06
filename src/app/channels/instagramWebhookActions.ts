import "server-only";

import { revalidatePath } from "next/cache";
import { areDemoConnectionsDisabled } from "@/lib/demoMode";
import { decryptToken } from "@/lib/facebookIntegration";
import {
  fetchInstagramConversationMessages,
  fetchInstagramConversationPage,
} from "@/lib/instagramIntegration";
import {
  META_INCREMENTAL_CHAT_FETCH_LIMIT,
  META_INITIAL_CHAT_BACKFILL_LIMIT,
} from "@/lib/metaDataHandlingPolicy.mjs";
import { canManageMetaConnections } from "@/lib/metaIntegrationPolicy.mjs";
import {
  assertMetaConversationSyncBudget,
  META_CONVERSATION_SYNC_EXECUTION_BUDGET_MS,
  resolveMetaConversationSyncCheckpoint,
} from "@/lib/metaConversationPaginationPolicy.mjs";
import { shouldPersistMetaConnectionSyncStatus } from "@/lib/metaSyncScopePolicy.mjs";
import {
  createEmptySocialSyncResult,
  type SocialSyncResult,
} from "@/lib/socialSync";
import {
  createMetaWebhookConversationMessage,
  getSupabaseServerUser,
  getUserWorkspaceDashboard,
  getMetaMessengerSyncContinuation,
  getWorkspaceProcessingEntitlement,
  getWorkspaceContacts,
  getWorkspaceSocialConnectionsServer,
  markContactInboundMessagesSeen,
  type SocialConnectionRow,
  updateInstagramMessengerSyncStatus,
} from "@/lib/supabase/server";

const INSTAGRAM_INCREMENTAL_CONVERSATION_LIMIT = 10;
const INSTAGRAM_INITIAL_CONVERSATION_LIMIT = 25;
const INSTAGRAM_UNSUPPORTED_MESSAGE =
  "Instagram-Nachricht ohne über die API abrufbaren Textinhalt.";

export type InstagramMessengerSyncResult = SocialSyncResult & {
  syncedAt: string;
  conversationsChecked: number;
  continuationPending?: boolean;
  error?: string | null;
};

export async function syncInstagramMessengerHistory(input?: {
  contactId?: string;
  expectedConnectionId?: string;
  markInboundSeen?: boolean;
  revalidate?: boolean;
}): Promise<InstagramMessengerSyncResult> {
  const syncedAt = new Date().toISOString();
  const { connection, error } = await getCurrentInstagramConnection(
    input?.expectedConnectionId,
  );
  if (error || !connection)
    return syncError(syncedAt, error ?? "Instagram-Verbindung fehlt.");
  return syncInstagramMessengerHistoryForConnection(connection, {
    ...input,
    syncedAt,
    revalidate: input?.revalidate ?? true,
  });
}

export async function syncInstagramMessengerConversationForContact(input: {
  connection: SocialConnectionRow;
  contactId?: string | null;
  fanSenderId?: string | null;
  markInboundSeen?: boolean;
  revalidate?: boolean;
}): Promise<InstagramMessengerSyncResult> {
  return syncInstagramMessengerHistoryForConnection(input.connection, {
    contactId: input.contactId ?? undefined,
    fanSenderId: input.fanSenderId ?? undefined,
    markInboundSeen: input.markInboundSeen,
    revalidate: input.revalidate ?? true,
    syncedAt: new Date().toISOString(),
  });
}

async function syncInstagramMessengerHistoryForConnection(
  connection: SocialConnectionRow,
  input: {
    contactId?: string;
    fanSenderId?: string;
    markInboundSeen?: boolean;
    revalidate: boolean;
    syncedAt: string;
  },
): Promise<InstagramMessengerSyncResult> {
  const { syncedAt } = input;
  const executionDeadlineMs =
    Date.now() + META_CONVERSATION_SYNC_EXECUTION_BUDGET_MS;
  const shouldPersistConnectionStatus =
    shouldPersistMetaConnectionSyncStatus(input);
  const token = connection.page_access_token_encrypted
    ? decryptToken(connection.page_access_token_encrypted)
    : null;

  if (!connection.page_id || !token) {
    const message =
      "Instagram-Zugriffstoken fehlt oder konnte nicht entschlüsselt werden.";
    if (shouldPersistConnectionStatus) {
      await persistSyncStatus(connection.id, syncedAt, message, true);
    }
    if (input.revalidate) revalidatePath("/channels");
    return syncError(syncedAt, message);
  }

  try {
    const continuation = shouldPersistConnectionStatus
      ? await getMetaMessengerSyncContinuation(connection.id, "instagram")
      : null;
    if (continuation?.error) throw continuation.error;
    if (continuation && !continuation.schemaReady) {
      throw new Error(
        "Meta-Sync-Fortsetzung ist in dieser Umgebung noch nicht bereit.",
      );
    }

    const workspaceContacts =
      input.contactId || input.fanSenderId
        ? (await getWorkspaceContacts(connection.workspace_id)).contacts
        : [];
    const contact = input.contactId
      ? workspaceContacts.find((entry) => entry.id === input.contactId)
      : null;
    const targetFanSenderId = input.fanSenderId ?? contact?.handle ?? null;
    const initialSync = !connection.last_messenger_sync_at;
    const messageFetchLimit = initialSync
      ? META_INITIAL_CHAT_BACKFILL_LIMIT
      : META_INCREMENTAL_CHAT_FETCH_LIMIT;
    const conversationFetchLimit = initialSync
      ? INSTAGRAM_INITIAL_CONVERSATION_LIMIT
      : INSTAGRAM_INCREMENTAL_CONVERSATION_LIMIT;
    assertMetaConversationSyncBudget(executionDeadlineMs);
    const conversationPage = await fetchInstagramConversationPage(
      connection.page_id,
      token,
      conversationFetchLimit,
      continuation?.continuationAfter ?? null,
      executionDeadlineMs,
    );
    const conversations = conversationPage.conversations;
    const checkpoint = shouldPersistConnectionStatus
      ? resolveMetaConversationSyncCheckpoint({
          runStartedAt: syncedAt,
          existingContinuationAfter:
            continuation?.continuationAfter ?? null,
          existingContinuationStartedAt:
            continuation?.continuationStartedAt ?? null,
          nextAfter: conversationPage.nextAfter,
        })
      : null;

    let conversationsChecked = 0;
    let checkedMessages = 0;
    let importedInbound = 0;
    let importedOutbound = 0;
    let skippedDuplicates = 0;
    let lastOutboundAt: string | null = null;

    for (const conversation of conversations) {
      assertMetaConversationSyncBudget(executionDeadlineMs);
      if (
        connection.last_messenger_sync_at &&
        conversation.updatedTime &&
        Date.parse(conversation.updatedTime) <=
          Date.parse(connection.last_messenger_sync_at) - 5 * 60 * 1_000
      ) {
        continue;
      }

      const messages = await fetchInstagramConversationMessages(
        conversation.id,
        token,
        messageFetchLimit,
        connection.last_messenger_sync_at,
        executionDeadlineMs,
      );
      const chronologicalMessages = [...messages].sort(
        (left, right) =>
          (Date.parse(left.createdTime ?? "") || 0) -
          (Date.parse(right.createdTime ?? "") || 0),
      );
      let conversationMatched = false;

      for (const message of chronologicalMessages) {
        assertMetaConversationSyncBudget(executionDeadlineMs);
        const direction =
          message.from?.id === connection.page_id ? "outbound" : "inbound";
        const fanActor =
          direction === "outbound"
            ? message.to.find((actor) => actor.id !== connection.page_id) ?? null
            : message.from;
        const fanSenderId = fanActor?.id?.trim() || null;
        if (!fanSenderId) continue;
        if (targetFanSenderId && fanSenderId !== targetFanSenderId) continue;

        conversationMatched = true;
        checkedMessages += 1;
        const content =
          message.message ?? INSTAGRAM_UNSUPPORTED_MESSAGE;

        const result = await createMetaWebhookConversationMessage({
          workspaceId: connection.workspace_id,
          senderId: fanSenderId,
          pageId: connection.page_id,
          recipientId: connection.page_id,
          sourcePlatform: "instagram",
          authorLabel:
            direction === "outbound"
              ? (connection.page_name ?? "Team")
              : (fanActor?.username ?? "Instagram Nutzer"),
          content,
          messageType: "dm",
          sourceType: "instagram_messages",
          externalMessageId: message.id,
          externalThreadId: conversation.id,
          sourceConversationId: conversation.id,
          originalTextExcerpt: content,
          direction,
          messageKind: message.message ? "text" : "unknown",
          receivedAt: message.createdTime,
        });
        if (result.error) throw result.error;
        if (result.conversation) {
          if (direction === "outbound") {
            importedOutbound += 1;
            lastOutboundAt = message.createdTime ?? syncedAt;
          } else {
            importedInbound += 1;
          }
        } else {
          skippedDuplicates += 1;
        }
      }

      if (conversationMatched) conversationsChecked += 1;
    }

    if (shouldPersistConnectionStatus) {
      const statusResult = await updateInstagramMessengerSyncStatus(
        connection.id,
        {
          syncedAt,
          checkedConversations: conversationsChecked,
          importedInbound,
          importedOutbound,
          skippedDuplicates,
          importedMedia: 0,
          error: null,
          lastOutboundAt,
          cursorUpdate: checkpoint?.completedSyncAt
            ? {
                kind: "complete",
                completedSyncAt: checkpoint.completedSyncAt,
              }
            : {
                kind: "partial",
                continuationAfter: checkpoint!.continuationAfter!,
                continuationStartedAt: checkpoint!.continuationStartedAt!,
              },
        },
      );
      if (statusResult.error) throw statusResult.error;
    }
    if (input.contactId && input.markInboundSeen) {
      await markContactInboundMessagesSeen({
        workspaceId: connection.workspace_id,
        contactId: input.contactId,
      });
    }
    if (input.revalidate) {
      revalidatePath("/channels");
      revalidatePath("/inbox");
      if (input.contactId) revalidatePath(`/fans/${input.contactId}`);
    }

    return {
      ok: true,
      syncedAt,
      conversationsChecked,
      checkedConversations: conversationsChecked,
      checkedMessages,
      importedInbound,
      importedOutbound,
      importedMedia: 0,
      skippedDuplicates,
      errors: [],
      syncLimit: messageFetchLimit,
      lastSyncAt:
        checkpoint?.completedSyncAt ??
        connection.last_messenger_sync_at ??
        checkpoint?.intervalStartedAt ??
        syncedAt,
      continuationPending: Boolean(checkpoint?.continuationAfter),
      error: null,
    };
  } catch {
    const message =
      "Instagram-Verlauf konnte nicht abgerufen werden. Prüfe DM-Berechtigung und Professional-Konto.";
    if (shouldPersistConnectionStatus) {
      await persistSyncStatus(connection.id, syncedAt, message, true);
    }
    if (input.revalidate) revalidatePath("/channels");
    return syncError(syncedAt, message);
  }
}

async function persistSyncStatus(
  connectionId: string,
  syncedAt: string,
  error: string,
  preserveCursor = false,
): Promise<void> {
  await updateInstagramMessengerSyncStatus(connectionId, {
    syncedAt,
    checkedConversations: 0,
    importedInbound: 0,
    importedOutbound: 0,
    skippedDuplicates: 0,
    importedMedia: 0,
    error,
    cursorUpdate: preserveCursor ? { kind: "preserve" } : undefined,
  });
}

function syncError(
  syncedAt: string,
  error: string,
): InstagramMessengerSyncResult {
  return {
    ...createEmptySocialSyncResult({
      ok: false,
      lastSyncAt: syncedAt,
      syncLimit: META_INITIAL_CHAT_BACKFILL_LIMIT,
      error,
    }),
    syncedAt,
    conversationsChecked: 0,
    error,
  };
}

async function getCurrentInstagramConnection(expectedConnectionId?: string) {
  const { data } = await getSupabaseServerUser();
  if (!data.user) return { connection: null, error: "Nicht angemeldet." };
  const workspaceResult = await getUserWorkspaceDashboard(data.user);
  if (!workspaceResult.workspace)
    return { connection: null, error: "Kein Workspace gefunden." };
  if (areDemoConnectionsDisabled(data.user, workspaceResult.workspace)) {
    return {
      connection: null,
      error:
        "Dieser Demo-Workspace ist öffentlich. Echte Kanalverbindungen sind hier deaktiviert.",
    };
  }
  if (!canManageMetaConnections(workspaceResult.workspace.role)) {
    return {
      connection: null,
      error: "Nur Workspace-Owner oder -Admins dürfen externe Konten verwalten.",
    };
  }
  const entitlement = await getWorkspaceProcessingEntitlement(
    workspaceResult.workspace.id,
  );
  if (entitlement.error || !entitlement.allowed) {
    return {
      connection: null,
      error: "Workspace-Verarbeitung ist nicht freigegeben.",
    };
  }
  const connectionsResult = await getWorkspaceSocialConnectionsServer(
    workspaceResult.workspace.id,
  );
  if (connectionsResult.error) {
    return {
      connection: null,
      error: "Instagram-Verbindung konnte nicht geladen werden.",
    };
  }
  return {
    connection:
      connectionsResult.connections.find(
        (entry) =>
          entry.platform === "instagram" &&
          entry.status === "connected" &&
          (!expectedConnectionId || entry.id === expectedConnectionId),
      ) ?? null,
    error: null,
  };
}
