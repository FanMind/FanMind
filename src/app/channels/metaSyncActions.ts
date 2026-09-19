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

export async function syncFacebookCommentsFromChannelPage(): Promise<void> {
  await requireActiveAuthorizedWorkspace();
  await fetchFacebookCommentsNow();
}

export async function syncInstagramMessengerHistoryFromChannelPage(): Promise<void> {
  await requireActiveAuthorizedWorkspace();
  await syncInstagramMessengerHistory({ revalidate: true });
}
