"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createContactFollowup,
  createContactMemory,
  createManualConversationMessage,
  ensureConversationForContact,
  saveReplyDraftAsNote,
  updateConversationPriority,
  updateConversationStatus,
  createWorkspaceContactsBatch,
  createWorkspaceContactServer,
  archiveWorkspaceContact,
  archiveWorkspaceContactServer,
  mergeWorkspaceContacts,
  getWorkspaceContact,
  getWorkspaceContacts,
  getWorkspaceConversations,
  updateWorkspaceContactServer,
  updateContactTopFanMarkServer,
  updateContactInternalNotesServer,
  upsertContactReplyTarget,
  type ContactRow,
  type ContactUpdateResult,
} from "@/lib/supabase/server";
import {
  requireActiveAuthorizedWorkspace,
  requireContactInActiveAuthorizedWorkspace,
} from "@/lib/workspaceAuthorization";
import { areDemoConnectionsDisabled } from "@/lib/demoMode";
import {
  formatPlatformLabel,
  getDuplicateKey,
  normalizePlatform,
  parseCsvContacts,
  type PlatformValue,
} from "./import/csv";
import {
  getContactGroupIdentity,
  normalizeFanIdentity,
} from "@/lib/fanIdentity";
import { isAllowedManualFacebookThreadUrl } from "@/lib/sourceContext";

type SuggestedSaveResult = {
  ok: boolean;
  message: string;
};

export type CsvImportActionState = {
  ok: boolean;
  message: string;
  importedCount: number;
  skippedDuplicates: number;
  skippedInvalid: number;
};

export async function updateTopFanMark(formData: FormData) {
  const contactId = formValue(formData, "contact_id");
  const isTopFan = formValue(formData, "is_top_fan") === "true";
  const returnTo = sanitizeFanReturnTo(formValue(formData, "return_to") || `/fans/${contactId}`);

  if (!contactId) {
    redirect(`${returnTo}?notice=top_fan_unknown_contact`);
  }

  let workspaceId: string;
  try {
    const { workspace, contact } =
      await requireContactInActiveAuthorizedWorkspace(contactId);
    workspaceId = workspace.id;
    if (contact.workspace_id !== workspace.id) {
      redirect(`${returnTo}?notice=top_fan_forbidden`);
    }
  } catch {
    redirect(`${returnTo}?notice=top_fan_forbidden`);
  }

  const result = await updateContactTopFanMarkServer({
    workspaceId,
    contactId,
    isTopFan,
  });

  if (result.error) {
    redirect(`${returnTo}?notice=top_fan_save_failed`);
  }

  revalidatePath(`/fans/${contactId}`);
  revalidatePath("/fans");
  revalidatePath("/top-fans");

  const separator = returnTo.includes("?") ? "&" : "?";
  redirect(`${returnTo}${separator}notice=${isTopFan ? "top_fan_marked" : "top_fan_removed"}`);
}

export async function importCsvContacts(
  _previousState: CsvImportActionState,
  formData: FormData,
): Promise<CsvImportActionState> {
  const workspace = await getCurrentWorkspaceOrThrow();
  const csvText = formValue(formData, "csv_text");
  const parsed = parseCsvContacts(csvText);

  if (!parsed.contacts.length) {
    return {
      ok: false,
      message:
        parsed.errors.join(" ") || "Keine importierbaren Kontakte erkannt.",
      importedCount: 0,
      skippedDuplicates: 0,
      skippedInvalid: parsed.errors.length,
    };
  }

  const existingContacts = await getWorkspaceContacts(workspace.id);

  if (existingContacts.error) {
    return {
      ok: false,
      message: "Bestehende Kontakte konnten nicht geladen werden.",
      importedCount: 0,
      skippedDuplicates: 0,
      skippedInvalid: parsed.errors.length,
    };
  }

  const knownDuplicateKeys = new Set(
    existingContacts.contacts
      .map((contact) =>
        getDuplicateKey(contact.handle, contact.source_platform),
      )
      .filter((key): key is string => Boolean(key)),
  );
  let skippedDuplicates = 0;
  const contactsToCreate: typeof parsed.contacts = [];

  for (const contact of parsed.contacts) {
    const duplicateKey = getDuplicateKey(
      contact.handle,
      contact.sourcePlatform,
    );

    if (duplicateKey && knownDuplicateKeys.has(duplicateKey)) {
      skippedDuplicates += 1;
      continue;
    }

    contactsToCreate.push({
      displayName: contact.displayName,
      handle: contact.handle,
      sourcePlatform: contact.sourcePlatform,
      language: contact.language,
      status: contact.status,
      tags: contact.tags,
      summary: contact.summary,
    });

    if (duplicateKey) {
      knownDuplicateKeys.add(duplicateKey);
    }
  }

  const result = await createWorkspaceContactsBatch({
    workspaceId: workspace.id,
    contacts: contactsToCreate,
  });

  if (result.error) {
    return {
      ok: false,
      message:
        "Kein Kontakt wurde importiert. Der gesamte Import wurde atomar abgebrochen.",
      importedCount: 0,
      skippedDuplicates,
      skippedInvalid: parsed.errors.length,
    };
  }

  const importedCount = result.createdCount;

  revalidatePath("/fans");
  revalidatePath("/fans/import");
  revalidatePath("/dashboard");

  return {
    ok: true,
    message: `${importedCount} Kontakte importiert, ${skippedDuplicates} Duplikate übersprungen${
      parsed.errors.length
        ? `, ${parsed.errors.length} ungültige Zeilen übersprungen`
        : ""
    }.`,
    importedCount,
    skippedDuplicates,
    skippedInvalid: parsed.errors.length,
  };
}

export async function saveFacebookReplyTarget(formData: FormData) {
  const contactId = formValue(formData, "contact_id");
  const { user, workspace } =
    await requireContactInActiveAuthorizedWorkspace(contactId);
  if (areDemoConnectionsDisabled(user, workspace)) {
    redirect(`/fans/${contactId}?notice=demo_external_actions_disabled`);
  }

  const url = formValue(formData, "reply_target_url");
  if (!isAllowedManualFacebookThreadUrl(url)) {
    redirect(`/fans/${contactId}?notice=reply_target_invalid`);
  }

  const result = await upsertContactReplyTarget({
    workspaceId: workspace.id,
    contactId,
    sourcePlatform: "facebook",
    sourceType: "facebook_messages",
    label: "Exakter Facebook-Chat-Link",
    url,
    quality: "manual_exact_thread",
  });

  if (result.error) {
    if (
      result.error.message.includes(
        "Der exakte Chat-Link kann derzeit nicht gespeichert werden.",
      )
    ) {
      redirect(`/fans/${contactId}?notice=reply_target_storage_unavailable`);
    }
    redirect(`/fans/${contactId}?notice=reply_target_save_failed`);
  }
  revalidatePath(`/fans/${contactId}`);
  redirect(`/fans/${contactId}?notice=reply_target_saved`);
}

export async function saveContactInternalNotes(formData: FormData) {
  const workspace = await getCurrentWorkspaceOrThrow();
  const contactId = formValue(formData, "contact_id");
  const locale = formValue(formData, "lang") === "en" ? "en" : "de";
  const langParam = locale === "en" ? "&lang=en" : "";

  await ensureContactInWorkspace(workspace.id, contactId);

  const internalNotes = formValue(formData, "internal_notes");
  if (!internalNotes.trim()) {
    redirect(`/fans/${contactId}?notice=notes_empty${langParam}`);
  }

  const result = await updateContactInternalNotesServer({
    workspaceId: workspace.id,
    contactId,
    internalNotes,
  });

  if (result.error || result.contact?.internal_notes !== internalNotes.trim()) {
    revalidatePath(`/fans/${contactId}`);
    redirect(`/fans/${contactId}?notice=notes_save_failed${langParam}`);
  }

  revalidatePath(`/fans/${contactId}`);
  revalidatePath("/fans/[id]", "page");
  revalidatePath("/fans");
  refresh();
  redirect(`/fans/${contactId}?notice=notes_saved${langParam}`);
}

export async function saveSuggestedMemory(input: {
  contactId: string;
  content: string;
  importance?: string | null;
}): Promise<SuggestedSaveResult> {
  const workspace = await getCurrentWorkspaceOrThrow();
  await ensureContactInWorkspace(workspace.id, input.contactId);

  const result = await createContactMemory({
    workspaceId: workspace.id,
    contactId: input.contactId,
    content: input.content,
    importance: input.importance,
    type: "note",
  });

  if (result.error) {
    return { ok: false, message: "Kontaktwissen konnte nicht gespeichert werden." };
  }

  revalidatePath(`/fans/${input.contactId}`);
  revalidatePath("/dashboard");

  return { ok: true, message: "Memory gespeichert." };
}

export async function saveSuggestedFollowup(input: {
  contactId: string;
  reason: string;
  inDays?: number | null;
}): Promise<SuggestedSaveResult> {
  const workspace = await getCurrentWorkspaceOrThrow();
  await ensureContactInWorkspace(workspace.id, input.contactId);

  const result = await createContactFollowup({
    workspaceId: workspace.id,
    contactId: input.contactId,
    reason: input.reason,
    dueDate: getDueDate(input.inDays),
    priority: "normal",
    status: "open",
  });

  if (result.error) {
    return { ok: false, message: "Follow-up konnte nicht gespeichert werden." };
  }

  revalidatePath(`/fans/${input.contactId}`);
  revalidatePath("/dashboard");

  return { ok: true, message: "Follow-up gespeichert." };
}

export async function saveManualFanMessage(formData: FormData) {
  const workspace = await getCurrentWorkspaceOrThrow();
  const contactId = formValue(formData, "contact_id");
  const locale = formValue(formData, "lang") === "en" ? "en" : "de";
  const langParam = locale === "en" ? "?lang=en" : "";
  await ensureContactInWorkspace(workspace.id, contactId);

  const direction =
    formValue(formData, "direction") === "outbound" ? "outbound" : "inbound";
  const result = await createManualConversationMessage({
    workspaceId: workspace.id,
    contactId,
    direction,
    sourcePlatform: formValue(formData, "source_platform") || "manual",
    messageType: "manual",
    sourceType: "manual_note",
    authorLabel: direction === "inbound" ? "Fan" : "Team",
    content: formValue(formData, "content"),
  });

  if (result.error) {
    redirect(
      `/fans/${contactId}${langParam ? `${langParam}&` : "?"}notice=message_save_failed`,
    );
  }

  revalidatePath(`/fans/${contactId}`);
  revalidatePath("/fans");
  revalidatePath("/dashboard");
  redirect(
    `/fans/${contactId}${langParam ? `${langParam}&` : "?"}notice=message_saved`,
  );
}

export async function saveManualMemory(formData: FormData) {
  const workspace = await getCurrentWorkspaceOrThrow();
  const contactId = formValue(formData, "contact_id");
  const locale = formValue(formData, "lang") === "en" ? "en" : "de";
  const langParam = locale === "en" ? "?lang=en" : "";
  await ensureContactInWorkspace(workspace.id, contactId);

  const content = formValue(formData, "content").trim();
  if (!content) {
    redirect(
      `/fans/${contactId}${langParam ? `${langParam}&` : "?"}notice=memory_empty`,
    );
  }

  const result = await createContactMemory({
    workspaceId: workspace.id,
    contactId,
    content,
    importance: formValue(formData, "importance") || "normal",
    type: formValue(formData, "type") || "note",
  });

  if (result.error) {
    redirect(
      `/fans/${contactId}${langParam ? `${langParam}&` : "?"}notice=memory_save_failed`,
    );
  }

  revalidatePath(`/fans/${contactId}`);
  revalidatePath("/dashboard");
  redirect(
    `/fans/${contactId}${langParam ? `${langParam}&` : "?"}notice=memory_saved`,
  );
}

export async function saveManualFollowup(formData: FormData) {
  const workspace = await getCurrentWorkspaceOrThrow();
  const contactId = formValue(formData, "contact_id");
  const locale = formValue(formData, "lang") === "en" ? "en" : "de";
  const langParam = locale === "en" ? "?lang=en" : "";
  await ensureContactInWorkspace(workspace.id, contactId);

  const result = await createContactFollowup({
    workspaceId: workspace.id,
    contactId,
    reason: formValue(formData, "reason"),
    dueDate: formValue(formData, "due_date"),
    priority: formValue(formData, "priority") || "normal",
    status: "open",
  });

  if (result.error) {
    redirect(
      `/fans/${contactId}${langParam ? `${langParam}&` : "?"}notice=followup_save_failed`,
    );
  }

  revalidatePath(`/fans/${contactId}`);
  revalidatePath("/fans");
  revalidatePath("/followups");
  revalidatePath("/dashboard");
  redirect(
    `/fans/${contactId}${langParam ? `${langParam}&` : "?"}notice=followup_saved`,
  );
}

export async function saveInboundMessage(formData: FormData) {
  const workspace = await getCurrentWorkspaceOrThrow();
  const contactId = formValue(formData, "contact_id");
  await ensureContactInWorkspace(workspace.id, contactId);

  const result = await createManualConversationMessage({
    workspaceId: workspace.id,
    contactId,
    direction: "inbound",
    sourcePlatform: formValue(formData, "source_platform") || "manual",
    messageType: formValue(formData, "message_type") || "dm",
    sourceUrl: formValue(formData, "source_url"),
    replyTargetUrl: formValue(formData, "source_url"),
    authorLabel: "Fan",
    content: formValue(formData, "content"),
  });

  if (result.error) {
    throw new Error("inbound_message_save_failed");
  }

  revalidatePath(`/fans/${contactId}`);
  revalidatePath("/inbox");
  redirect(`/fans/${contactId}`);
}

export async function saveManualSentReply(formData: FormData) {
  const { workspace, user } = await requireActiveAuthorizedWorkspace();
  const contactId = formValue(formData, "contact_id");
  await ensureContactInWorkspace(workspace.id, contactId);
  const conversation = await getExistingOrNewConversation(
    workspace.id,
    contactId,
    formValue(formData, "conversation_id"),
  );

  const result = await createManualConversationMessage({
    workspaceId: workspace.id,
    contactId,
    direction: "outbound",
    messageType: "dm",
    sourcePlatform:
      conversation.source_platform ||
      formValue(formData, "source_platform") ||
      "manual",
    sourceType: conversation.source_type || undefined,
    sourceUrl: conversation.source_url,
    replyTargetUrl: conversation.reply_target_url,
    authorLabel:
      conversation.source_platform === "facebook"
        ? workspace.name || "Team"
        : getActionUserLabel(user, workspace.name),
    originalAuthorLabel:
      conversation.source_platform === "facebook"
        ? workspace.name || "Team"
        : undefined,
    userId: user.id,
    content: formValue(formData, "content"),
  });

  if (result.error) {
    throw new Error("manual_reply_save_failed");
  }

  revalidatePath(`/fans/${contactId}`);
  revalidatePath("/inbox");
  redirect(`/fans/${contactId}?focus=reply&notice=manual_sent_saved`);
}

export async function saveReplyDraft(formData: FormData) {
  const workspace = await getCurrentWorkspaceOrThrow();
  const contactId = formValue(formData, "contact_id");
  await ensureContactInWorkspace(workspace.id, contactId);
  const conversation = await getExistingOrNewConversation(
    workspace.id,
    contactId,
    formValue(formData, "conversation_id"),
  );

  const result = await saveReplyDraftAsNote({
    workspaceId: workspace.id,
    conversationId: conversation.id,
    contactId,
    content: formValue(formData, "content"),
  });

  if (result.error) {
    throw new Error("reply_draft_save_failed");
  }

  revalidatePath(`/fans/${contactId}`);
  revalidatePath("/inbox");
  redirect(`/fans/${contactId}?focus=reply&notice=draft_saved`);
}

export async function markConversationDone(formData: FormData) {
  await updateConversationStatusAction(
    formData,
    "done",
    "Konversation erledigt",
    "done",
  );
}

export async function markConversationWaiting(formData: FormData) {
  await updateConversationStatusAction(
    formData,
    "waiting",
    "Wartet auf Antwort im Originalkanal",
    "waiting",
  );
}

export async function reopenConversation(formData: FormData) {
  await updateConversationStatusAction(
    formData,
    "open",
    "Antwort vorbereiten",
    "open",
  );
}

export async function setConversationPriority(formData: FormData) {
  const workspace = await getCurrentWorkspaceOrThrow();
  const contactId = formValue(formData, "contact_id");
  await ensureContactInWorkspace(workspace.id, contactId);
  const conversation = await getExistingOrNewConversation(
    workspace.id,
    contactId,
    formValue(formData, "conversation_id"),
  );
  const priority = formValue(formData, "priority");

  if (!["low", "normal", "medium", "high"].includes(priority)) {
    throw new Error("Ungültige Priorität.");
  }

  const result = await updateConversationPriority({
    workspaceId: workspace.id,
    conversationId: conversation.id,
    priority: priority as "low" | "normal" | "medium" | "high",
  });

  if (result.error) {
    throw new Error("conversation_priority_update_failed");
  }

  revalidatePath(`/fans/${contactId}`);
  revalidatePath("/inbox");
  redirect(`/fans/${contactId}?focus=reply&notice=priority_saved`);
}

export async function createFan(formData: FormData) {
  const workspace = await getCurrentWorkspaceOrThrow();
  const platforms = formPlatforms(formData, "source_platforms", {
    fallbackManual: true,
  });
  const baseContact = getContactFormValues(formData);

  for (const platform of platforms) {
    const result = await createWorkspaceContactServer({
      ...baseContact,
      workspaceId: workspace.id,
      sourcePlatform: platform,
    });

    if (result.error) {
      throw new Error("contact_create_failed");
    }
  }

  revalidatePath("/fans");
  revalidatePath("/dashboard");
  redirect("/fans?notice=fan_created#fans-list");
}

export async function updateFan(formData: FormData) {
  const workspace = await getCurrentWorkspaceOrThrow();
  const primaryContactId =
    formValue(formData, "primary_contact_id") ||
    formValue(formData, "group_primary_contact_id");
  const submittedGroupKey = formValue(formData, "fan_group_key");
  const platforms = formPlatforms(formData, "source_platforms", {
    fallbackManual: false,
  });
  const baseContact = getContactFormValues(formData);

  if (!primaryContactId) {
    redirectFanUpdateFailed();
  }

  if (!platforms.length) {
    redirectFanUpdateFailed();
  }

  let successRedirect = "/fans?notice=fan_updated#fans-list";

  try {
    const [primaryResult, contactsResult] = await Promise.all([
      getWorkspaceContact(workspace.id, primaryContactId),
      getWorkspaceContacts(workspace.id),
    ]);

    if (primaryResult.error) {
      throw new Error("primary_contact_load_failed");
    }
    if (!primaryResult.contact) {
      throw new Error("Primärer Kontakt wurde nicht gefunden.");
    }
    if (contactsResult.error) {
      throw new Error("contact_list_load_failed");
    }

    const primaryContact = primaryResult.contact;
    const editableContacts = resolveServerFanGroup(
      primaryContact,
      contactsResult.contacts,
      submittedGroupKey,
    );
    const selectedPlatforms = new Set(platforms);
    const contactsByPlatform = new Map<PlatformValue, ContactRow[]>();

    for (const contact of editableContacts) {
      const platform = normalizePlatform(contact.source_platform);
      contactsByPlatform.set(platform, [
        ...(contactsByPlatform.get(platform) ?? []),
        contact,
      ]);
    }

    const archivedPlatforms: PlatformValue[] = [];

    for (const [platform, platformContacts] of contactsByPlatform) {
      const sortedPlatformContacts = [...platformContacts].sort(
        compareContactAgeAsc,
      );

      if (!selectedPlatforms.has(platform)) {
        for (const contact of sortedPlatformContacts) {
          const archived = await archiveWorkspaceContactServer({
            workspaceId: workspace.id,
            contactId: contact.id,
            reason: `Kanal ${formatPlatformLabel(platform)} in der Fan-Bearbeitung abgewählt.`,
          });
          assertUpdatedContact(
            archived,
            `Kanal ${formatPlatformLabel(platform)} konnte nicht archiviert werden.`,
          );
        }
        archivedPlatforms.push(platform);
        continue;
      }

      const [keptContact, ...duplicateContacts] = sortedPlatformContacts;
      const updated = await updateWorkspaceContactServer({
        ...baseContact,
        workspaceId: workspace.id,
        contactId: keptContact.id,
        sourcePlatform: platform,
      });
      assertUpdatedContact(
        updated,
        `Kanal ${formatPlatformLabel(platform)} konnte nicht aktualisiert werden.`,
      );

      for (const duplicate of duplicateContacts) {
        const archived = await archiveWorkspaceContactServer({
          workspaceId: workspace.id,
          contactId: duplicate.id,
          reason: `Doppelter aktiver Kontakt für ${formatPlatformLabel(platform)} in der Fan-Bearbeitung archiviert; Kontakt ${keptContact.id} bleibt aktiv.`,
        });
        assertUpdatedContact(
          archived,
          `Doppelter Kanal ${formatPlatformLabel(platform)} konnte nicht archiviert werden.`,
        );
      }
    }

    for (const platform of platforms) {
      if ((contactsByPlatform.get(platform) ?? []).length > 0) continue;
      const created = await createWorkspaceContactServer({
        ...baseContact,
        workspaceId: workspace.id,
        sourcePlatform: platform,
      });
      if (created.error || !created.contact) {
        throw new Error(`contact_channel_create_failed_${platform}`);
      }
    }

    const verificationResult = await getWorkspaceContacts(workspace.id);
    if (verificationResult.error) {
      throw new Error("contact_update_verification_failed");
    }
    const verifyGroup = resolveServerFanGroup(
      { ...primaryContact, ...baseContact },
      verificationResult.contacts,
      submittedGroupKey,
    );
    const activePlatforms = uniqueActionPlatforms(verifyGroup);
    const expectedPlatforms = [...selectedPlatforms].sort();

    if (activePlatforms.join(",") !== expectedPlatforms.join(",")) {
      throw new Error(
        `Kanäle konnten nicht aktualisiert werden: aktiv sind ${formatActionPlatformList(activePlatforms)}, erwartet war ${formatActionPlatformList(expectedPlatforms)}.`,
      );
    }

    revalidatePath("/fans");
    revalidatePath("/dashboard");
    revalidatePath("/inbox");
    for (const contact of editableContacts) {
      revalidatePath(`/fans/${contact.id}`);
    }
    successRedirect = `/fans?notice=fan_updated&active=${encodeURIComponent(activePlatforms.join(","))}&archived=${archivedPlatforms.length}#fans-list`;
  } catch {
    redirectFanUpdateFailed();
  }

  redirect(successRedirect);
}

export async function archiveFan(formData: FormData) {
  const workspace = await getCurrentWorkspaceOrThrow();
  const contactId = formValue(formData, "contact_id");
  await ensureContactInWorkspace(workspace.id, contactId);
  const result = await archiveWorkspaceContact({
    workspaceId: workspace.id,
    contactId,
    reason: "Kontakt wurde über FanMind archiviert.",
  });
  if (result.error) throw new Error("contact_archive_failed");
  revalidatePath("/fans");
  revalidatePath("/dashboard");
  revalidatePath("/inbox");
  redirect("/fans?notice=contact_archived#fans-list");
}

export async function mergeFanContacts(formData: FormData) {
  const returnTo = getMergeReturnPath(formValue(formData, "return_to"));
  let targetContactId = "";

  try {
    const workspace = await getCurrentWorkspaceOrThrow();
    const sourceContactId = formValue(formData, "source_contact_id");
    targetContactId = formValue(formData, "target_contact_id");

    if (!sourceContactId) {
      throw new Error("Der Quell-Fan fehlt.");
    }

    if (!targetContactId) {
      throw new Error("Bitte wähle einen Ziel-Fan aus.");
    }

    if (sourceContactId === targetContactId) {
      throw new Error("Quelle und Ziel dürfen nicht identisch sein.");
    }

    const [sourceResult, targetResult, contactsResult] = await Promise.all([
      getWorkspaceContact(workspace.id, sourceContactId),
      getWorkspaceContact(workspace.id, targetContactId),
      getWorkspaceContacts(workspace.id),
    ]);

    if (sourceResult.error) throw new Error("merge_source_load_failed");
    if (targetResult.error) throw new Error("merge_target_load_failed");
    if (contactsResult.error) throw new Error("merge_contact_list_load_failed");
    if (!sourceResult.contact || !targetResult.contact) {
      throw new Error("Quelle oder Ziel wurde nicht gefunden.");
    }

    const sourceGroup = resolveServerFanGroup(
      sourceResult.contact,
      contactsResult.contacts,
      "",
    ).filter((contact) => contact.id !== targetContactId);

    if (!sourceGroup.length) {
      throw new Error("Keine Quellkontakte zum Zusammenführen gefunden.");
    }

    for (const sourceContact of sourceGroup) {
      const result = await mergeWorkspaceContacts({
        workspaceId: workspace.id,
        sourceContactId: sourceContact.id,
        targetContactId,
      });
      assertUpdatedContact(
        result,
        `Kontakt ${sourceContact.id} konnte nicht zusammengeführt werden.`,
      );
    }
  } catch {
    redirectMergeFailed(returnTo);
  }

  revalidatePath("/fans");
  revalidatePath("/dashboard");
  revalidatePath("/inbox");
  revalidatePath(`/fans/${targetContactId}`);
  redirect(`${returnTo}?notice=contacts_merged#fans-list`);
}

async function getExistingOrNewConversation(
  workspaceId: string,
  contactId: string,
  conversationId: string,
) {
  if (conversationId) {
    const conversations = await getWorkspaceConversations(workspaceId);

    if (conversations.error) {
      throw new Error("conversation_list_load_failed");
    }

    const existing = conversations.conversations.find(
      (conversation) =>
        conversation.id === conversationId &&
        conversation.contact_id === contactId,
    );

    if (!existing) {
      throw new Error("Conversation gehört nicht zum aktuellen Kontakt.");
    }

    return existing;
  }

  const ensured = await ensureConversationForContact({
    workspaceId,
    contactId,
  });

  if (ensured.error || !ensured.conversation) {
    throw new Error("conversation_load_failed");
  }

  return ensured.conversation;
}

async function updateConversationStatusAction(
  formData: FormData,
  status: "open" | "waiting" | "done" | "archived",
  nextStep: string,
  notice: string,
) {
  const workspace = await getCurrentWorkspaceOrThrow();
  const contactId = formValue(formData, "contact_id");
  await ensureContactInWorkspace(workspace.id, contactId);
  const conversation = await getExistingOrNewConversation(
    workspace.id,
    contactId,
    formValue(formData, "conversation_id"),
  );
  const result = await updateConversationStatus({
    workspaceId: workspace.id,
    conversationId: conversation.id,
    status,
    nextStep,
  });

  if (result.error) {
    throw new Error("conversation_status_update_failed");
  }

  revalidatePath(`/fans/${contactId}`);
  revalidatePath("/inbox");

  const returnTo = formValue(formData, "return_to");
  redirect(
    returnTo === "inbox"
      ? `/inbox?notice=${notice}`
      : `/fans/${contactId}?focus=reply&notice=${notice}`,
  );
}

function getActionUserLabel(
  user: { email?: string; user_metadata?: Record<string, unknown> } | null,
  fallback: string,
): string {
  const label =
    user?.user_metadata?.display_name ?? user?.user_metadata?.full_name;

  if (typeof label === "string" && label.trim()) return label.trim();
  if (user?.email) return user.email;
  return fallback || "Team";
}

function resolveServerFanGroup(
  primaryContact: ContactRow,
  contacts: ContactRow[],
  submittedGroupKey: string,
): ContactRow[] {
  const activeContacts = contacts.filter(
    (contact) => contact.status?.trim().toLowerCase() !== "archived",
  );
  const contactsById = new Map(
    activeContacts.map((contact) => [contact.id, contact]),
  );
  const primary = contactsById.get(primaryContact.id) ?? primaryContact;
  const groupIdentity = getContactGroupIdentity(primary);
  const normalizedName = normalizeFanIdentity(primary.display_name);
  const normalizedHandle = normalizeFanIdentity(primary.handle);
  const exactName = primary.display_name?.trim();
  const exactNameKey = exactName?.toLowerCase() ?? "";

  const group = activeContacts.filter((contact) => {
    if (contact.id === primary.id) return true;

    const contactGroupIdentity = getContactGroupIdentity(contact);
    if (groupIdentity && contactGroupIdentity === groupIdentity) return true;
    if (submittedGroupKey && contactGroupIdentity === submittedGroupKey)
      return true;

    const contactName = normalizeFanIdentity(contact.display_name);
    const contactHandle = normalizeFanIdentity(contact.handle);
    if (normalizedName && normalizedHandle) {
      if (
        contactName === normalizedName &&
        contactHandle === normalizedHandle
      ) {
        return true;
      }
      if (contactHandle === normalizedHandle) return true;
    }

    if (
      exactNameKey &&
      contact.display_name?.trim().toLowerCase() === exactNameKey &&
      !normalizedHandle
    ) {
      return true;
    }

    return false;
  });

  return group.length ? group : [primary];
}

function assertUpdatedContact(
  result: ContactUpdateResult,
  fallbackMessage: string,
): asserts result is ContactUpdateResult & { contact: ContactRow } {
  if (result.error || !result.contact) {
    throw new Error(fallbackMessage);
  }
}

function redirectFanUpdateFailed(): never {
  console.error("Fan-Kanal-Bearbeitung fehlgeschlagen.", {
    code: "contact_update_failed",
  });
  redirect(
    "/fans?notice=fan_update_failed&error=contact_update_failed#fans-list",
  );
}

function redirectMergeFailed(returnTo = "/fans"): never {
  console.error("Fan-Merge fehlgeschlagen.", { code: "contact_merge_failed" });
  redirect(
    `${returnTo}?notice=contacts_merge_failed&error=contact_merge_failed#fans-list`,
  );
}

function getMergeReturnPath(value: string): string {
  if (value.startsWith("/fans/")) return value;
  return "/fans";
}

function compareContactAgeAsc(left: ContactRow, right: ContactRow): number {
  return getActionTime(left.created_at) - getActionTime(right.created_at);
}

function uniqueActionPlatforms(contacts: ContactRow[]): PlatformValue[] {
  return Array.from(
    new Set(
      contacts
        .filter(
          (contact) => contact.status?.trim().toLowerCase() !== "archived",
        )
        .map((contact) => normalizePlatform(contact.source_platform)),
    ),
  ).sort();
}

function formatActionPlatformList(platforms: PlatformValue[]): string {
  return platforms.length
    ? platforms.map(formatPlatformLabel).join(", ")
    : "keine Kanäle";
}

function getActionTime(value: string | null): number {
  return value ? new Date(value).getTime() : 0;
}

function sanitizeFanReturnTo(value: string): string {
  if (value.startsWith("/fans/") || value.startsWith("/fans?") || value === "/fans" || value.startsWith("/top-fans")) {
    return value;
  }

  return "/fans";
}

function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function formPlatforms(
  formData: FormData,
  key: string,
  options: { fallbackManual: boolean },
) {
  const platforms = formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string")
    .map((value) => normalizePlatform(value));

  const uniquePlatforms = Array.from(new Set(platforms)).slice(0, 9);

  return uniquePlatforms.length || !options.fallbackManual
    ? uniquePlatforms
    : ["manual" as const];
}

function getContactFormValues(formData: FormData) {
  return {
    displayName: formValue(formData, "display_name"),
    handle: formValue(formData, "handle"),
    language: formValue(formData, "language"),
    status: formValue(formData, "status"),
    tags: parseTags(formValue(formData, "tags")),
    summary: formValue(formData, "summary"),
  };
}

function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}

async function getCurrentWorkspaceOrThrow() {
  try {
    const { workspace } = await requireActiveAuthorizedWorkspace();
    return workspace;
  } catch (error) {
    if (error instanceof Error && error.message.includes("User-Session")) {
      redirect("/login");
    }
    throw error;
  }
}

async function ensureContactInWorkspace(
  workspaceId: string,
  contactId: string,
) {
  const authorized =
    await requireContactInActiveAuthorizedWorkspace(contactId);
  if (authorized.workspace.id !== workspaceId) {
    throw new Error("Kontakt wurde im aktuellen Workspace nicht gefunden.");
  }
}

function getDueDate(inDays: number | null | undefined): string | null {
  if (typeof inDays !== "number" || !Number.isFinite(inDays) || inDays < 0) {
    return null;
  }

  const dueDate = new Date();
  dueDate.setUTCDate(dueDate.getUTCDate() + Math.floor(inDays));

  return dueDate.toISOString().slice(0, 10);
}

export async function syncFacebookChatForContact(contactId: string) {
  const { user, workspace } =
    await requireContactInActiveAuthorizedWorkspace(contactId);
  if (areDemoConnectionsDisabled(user, workspace)) {
    redirect(`/fans/${contactId}?notice=demo_external_actions_disabled`);
  }
  const { syncFacebookMessengerHistory } =
    await import("@/app/channels/facebookWebhookActions");
  const result = await syncFacebookMessengerHistory({
    contactId,
    markInboundSeen: true,
  });
  const params = new URLSearchParams();
  params.set(
    "notice",
    result.ok
      ? `Facebook-Chat synchronisiert: ${result.importedInbound} inbound, ${result.importedOutbound} outbound neu.`
      : "Facebook-Verlauf konnte nicht abgerufen werden. Prüfe Page Access Token und Messenger-Berechtigungen.",
  );
  revalidatePath(`/fans/${contactId}`);
  redirect(`/fans/${contactId}?${params.toString()}`);
}

export async function syncInstagramChatForContact(contactId: string) {
  const { user, workspace } =
    await requireContactInActiveAuthorizedWorkspace(contactId);
  if (areDemoConnectionsDisabled(user, workspace)) {
    redirect(`/fans/${contactId}?notice=demo_external_actions_disabled`);
  }
  const { syncInstagramMessengerHistory } =
    await import("@/app/channels/instagramWebhookActions");
  const result = await syncInstagramMessengerHistory({
    contactId,
    markInboundSeen: true,
  });
  const params = new URLSearchParams();
  params.set(
    "notice",
    result.ok
      ? `Instagram-Chat synchronisiert: ${result.importedInbound} inbound, ${result.importedOutbound} outbound neu.`
      : "Instagram-Verlauf konnte nicht abgerufen werden. Prüfe DM-Berechtigung und Professional-Konto.",
  );
  revalidatePath(`/fans/${contactId}`);
  redirect(`/fans/${contactId}?${params.toString()}`);
}
