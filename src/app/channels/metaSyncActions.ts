"use server";

import {
  fetchFacebookCommentsNow,
  syncFacebookMessengerHistory,
} from "./facebookWebhookActions";
import { syncInstagramMessengerHistory } from "./instagramWebhookActions";
import { requireActiveAuthorizedWorkspace } from "@/lib/workspaceAuthorization";

export async function syncFacebookMessengerHistoryFromChannelPage(): Promise<void> {
  await requireActiveAuthorizedWorkspace();
  await syncFacebookMessengerHistory({ revalidate: true });
}

export type FacebookCommentSyncState = {
  ok: boolean;
  fetchedAt: string;
  postsChecked: number;
  commentsChecked: number;
  importedCount: number;
  continuationPending: boolean;
};

export async function syncFacebookCommentsFromChannelPage(
  _previousState: FacebookCommentSyncState | null,
): Promise<FacebookCommentSyncState> {
  void _previousState;
  await requireActiveAuthorizedWorkspace();
  const result = await fetchFacebookCommentsNow();
  // Only this run's counters cross the browser boundary, never provider errors,
  // scopes, tokens, connection rows or caller-supplied previous state.
  return {
    ok: result.ok,
    fetchedAt: result.fetchedAt,
    postsChecked: result.postsChecked,
    commentsChecked: result.commentsChecked,
    importedCount: result.importedCount,
    continuationPending: result.continuationPending === true,
  };
}

export async function syncInstagramMessengerHistoryFromChannelPage(): Promise<void> {
  await requireActiveAuthorizedWorkspace();
  await syncInstagramMessengerHistory({ revalidate: true });
}
