"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  claimConversationAssignment,
  getWorkspaceConversations,
  releaseConversationAssignment,
} from "@/lib/supabase/server";
import { requireActiveAuthorizedWorkspace } from "@/lib/workspaceAuthorization";

export async function claimConversation(formData: FormData) {
  await updateAssignment(formData, "claim");
}

export async function releaseConversation(formData: FormData) {
  await updateAssignment(formData, "release");
}

async function updateAssignment(formData: FormData, mode: "claim" | "release") {
  const locale = formValue(formData, "lang") === "en" ? "en" : "de";
  const conversationId = formValue(formData, "conversation_id");
  if (!conversationId) redirect(inboxNoticePath("conversation_missing", locale));

  const { user, workspace } = await requireActiveAuthorizedWorkspace();
  const conversations = await getWorkspaceConversations(workspace.id);
  const conversation = conversations.conversations.find(
    (candidate) => candidate.id === conversationId,
  );

  if (conversations.error || !conversation) {
    redirect(inboxNoticePath("conversation_forbidden", locale));
  }
  if (conversation.assignment_supported !== true) {
    redirect(inboxNoticePath("assignment_failed", locale));
  }

  const result =
    mode === "claim"
      ? await claimConversationAssignment({
          workspaceId: workspace.id,
          conversationId,
          assignedUserId: user.id,
          assignedOwner: getUserLabel(user),
        })
      : await releaseConversationAssignment({
          workspaceId: workspace.id,
          conversationId,
          assignedUserId: user.id,
        });

  if (result.error) redirect(inboxNoticePath("assignment_failed", locale));

  revalidatePath("/inbox");
  redirect(
    mode === "claim"
      ? inboxNoticePath("conversation_claimed", locale)
      : inboxNoticePath("conversation_released", locale),
  );
}

function inboxNoticePath(notice: string, locale: "de" | "en"): string {
  const params = new URLSearchParams({ notice });
  if (locale === "en") params.set("lang", "en");
  return `/inbox?${params.toString()}`;
}

function getUserLabel(user: {
  user_metadata?: Record<string, unknown>;
}): string {
  const metadataLabel =
    user.user_metadata?.display_name ??
    user.user_metadata?.full_name ??
    user.user_metadata?.name;

  if (typeof metadataLabel === "string" && metadataLabel.trim()) {
    return metadataLabel.trim().slice(0, 120);
  }

  return "Workspace-Team";
}

function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}
