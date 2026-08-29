import { supabase } from "@/lib/supabase";
import {
  CANONICAL_COMPLETED_FOLLOWUP_STATUS,
  COMPLETED_FOLLOWUP_FILTER,
} from "@/lib/followupStatus";
import {
  normalizeContactDraft,
  type ContactDraft,
  type NormalizedContactDraft,
} from "@/lib/contactDraftPolicy.mjs";
import { isOfflineEligibleStatus } from "@/lib/offlineReadCachePolicy.mjs";
import { normalizeManualFollowupDraft } from "@/lib/manualFollowupPolicy.mjs";
import type {
  Contact,
  ContactListItem,
  ContactMemory,
  ConversationMessage,
  DashboardUnreadFan,
  FanAnalysisReport,
  Followup,
  Workspace,
} from "@/types";

const CONTACT_COLUMNS =
  "id,workspace_id,display_name,handle,source_platform,language,status,tags,summary,internal_notes,created_at,updated_at";
const CONTACT_LIST_COLUMNS =
  "id,workspace_id,display_name,handle,source_platform,status,summary,updated_at";
const MEMORY_COLUMNS =
  "id,workspace_id,contact_id,type,content,importance,created_at";
const CONVERSATION_MESSAGE_COLUMNS =
  "id,workspace_id,conversation_id,contact_id,direction,message_type,source_platform,author_label,content,created_at,seen_at";
const UNSEEN_MESSAGE_COLUMNS = "contact_id,source_platform,created_at";
const FOLLOWUP_COLUMNS =
  "id,workspace_id,contact_id,due_date,priority,reason,status,created_at";
const FAN_ANALYSIS_REPORT_COLUMNS =
  "id,workspace_id,contact_id,report_json,summary,source_message_count,source_from_at,source_to_at,confidence_score,review_status,generated_at,updated_at";
const MEMBER_SAFE_WORKSPACE_RPC =
  "get_current_workspace_member_safe_dashboard";
const MEMBER_MUTATIONS_DISABLED_ERROR =
  "Teamzugänge sind in der Mobile App derzeit schreibgeschützt.";

type MemberSafeWorkspaceRpcRow = {
  workspace_id: string;
  workspace_name: string;
  plan_id: string;
  membership_role: string;
  member_processing_allowed: boolean;
};

function isOwnerRole(role: Workspace["role"]): boolean {
  return role === "owner";
}

function isMissingMemberSafeWorkspaceRpc(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  const code = String(candidate.code ?? "").trim().toUpperCase();
  const message = String(candidate.message ?? "").trim().toLowerCase();
  return (
    message.includes(MEMBER_SAFE_WORKSPACE_RPC) &&
    (code === "PGRST202" ||
      (message.includes("could not find the function") &&
        message.includes("schema cache")))
  );
}

function message(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error) {
    const value = String((error as { message?: unknown }).message ?? "");
    if (value) return fallback;
  }
  return fallback;
}

export async function loadWorkspace(userId: string): Promise<{
  workspace: Workspace | null;
  error: string | null;
  offlineEligible: boolean;
}> {
  const ownerResult = await supabase
    .from("workspaces")
    .select("id,name,owner_user_id,billing_status")
    .eq("owner_user_id", userId)
    .limit(1)
    .maybeSingle();

  if (ownerResult.error) {
    return {
      workspace: null,
      error: message(ownerResult.error, "Workspace konnte nicht geladen werden."),
      offlineEligible: isOfflineEligibleStatus(ownerResult.status),
    };
  }
  if (ownerResult.data) {
    return {
      workspace: { ...ownerResult.data, role: "owner" } as Workspace,
      error: null,
      offlineEligible: false,
    };
  }

  const membershipResult = await supabase
    .from("workspace_members")
    .select("workspace_id,role")
    .eq("user_id", userId)
    .limit(2);
  if (membershipResult.error) {
    return {
      workspace: null,
      error: "Workspace konnte nicht geladen werden.",
      offlineEligible: isOfflineEligibleStatus(membershipResult.status),
    };
  }
  if (!membershipResult.data?.length) {
    return {
      workspace: null,
      error: "Kein FanMind-Workspace gefunden. Bitte schließe zuerst das Onboarding im Web ab.",
      offlineEligible: false,
    };
  }
  if (membershipResult.data.length !== 1) {
    return {
      workspace: null,
      error: "Mehrere Workspace-Mitgliedschaften müssen zuerst im Web eindeutig ausgewählt werden.",
      offlineEligible: false,
    };
  }
  const [membership] = membershipResult.data;
  if (!membership) {
    return {
      workspace: null,
      error: "Die Workspace-Mitgliedschaft konnte nicht eindeutig geladen werden.",
      offlineEligible: false,
    };
  }

  if (String(membership.role).trim().toLowerCase() === "owner") {
    return {
      workspace: null,
      error: "Eine inkonsistente Workspace-Rolle wurde sicher abgelehnt.",
      offlineEligible: false,
    };
  }

  const workspaceResult = await supabase
    .rpc(MEMBER_SAFE_WORKSPACE_RPC)
    .select(
      "workspace_id,workspace_name,plan_id,membership_role,member_processing_allowed",
    )
    .maybeSingle();
  let safeWorkspace = workspaceResult.data as MemberSafeWorkspaceRpcRow | null;
  if (workspaceResult.error && !isMissingMemberSafeWorkspaceRpc(workspaceResult.error)) {
    return {
      workspace: null,
      error: "Die sichere Workspace-Mitgliederansicht ist noch nicht verifiziert.",
      offlineEligible: isOfflineEligibleStatus(workspaceResult.status),
    };
  }
  if (workspaceResult.error && isMissingMemberSafeWorkspaceRpc(workspaceResult.error)) {
    const compatibilityResult = await supabase
      .from("workspaces")
      .select("id,name,plan_id")
      .eq("id", membership.workspace_id)
      .limit(1)
      .maybeSingle();
    if (
      compatibilityResult.error ||
      !compatibilityResult.data ||
      compatibilityResult.data.id !== membership.workspace_id ||
      typeof compatibilityResult.data.name !== "string" ||
      typeof compatibilityResult.data.plan_id !== "string"
    ) {
      return {
        workspace: null,
        error: "Die sichere Workspace-Mitgliederansicht ist noch nicht verifiziert.",
        offlineEligible: isOfflineEligibleStatus(compatibilityResult.status),
      };
    }
    safeWorkspace = {
      workspace_id: compatibilityResult.data.id,
      workspace_name: compatibilityResult.data.name,
      plan_id: compatibilityResult.data.plan_id,
      membership_role: "member",
      member_processing_allowed: false,
    };
  }
  if (
    !safeWorkspace ||
    safeWorkspace.workspace_id !== membership.workspace_id ||
    safeWorkspace.membership_role !== "member" ||
    typeof safeWorkspace.workspace_name !== "string" ||
    typeof safeWorkspace.plan_id !== "string" ||
    typeof safeWorkspace.member_processing_allowed !== "boolean"
  ) {
    return {
      workspace: null,
      error: "Die sichere Workspace-Mitgliederansicht ist noch nicht verifiziert.",
      offlineEligible: isOfflineEligibleStatus(workspaceResult.status),
    };
  }
  return {
    workspace: {
      id: safeWorkspace.workspace_id,
      name: safeWorkspace.workspace_name,
      plan_id: safeWorkspace.plan_id,
      role: "member",
      member_safe_projection: true,
      member_processing_allowed: safeWorkspace.member_processing_allowed,
    },
    error: null,
    offlineEligible: false,
  };
}

export async function listContacts(
  workspaceId: string,
  search = "",
): Promise<{
  contacts: ContactListItem[];
  error: string | null;
  offlineEligible: boolean;
}> {
  let query = supabase
    .from("contacts")
    .select(CONTACT_LIST_COLUMNS)
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(250);

  const term = search.trim();
  if (term) {
    const escaped = term.replace(/[%_,]/g, "");
    query = query.or(
      `display_name.ilike.%${escaped}%,handle.ilike.%${escaped}%,source_platform.ilike.%${escaped}%,summary.ilike.%${escaped}%`,
    );
  }

  const result = await query;
  if (result.error) {
    return {
      contacts: [],
      error: "Kontakte konnten nicht geladen werden.",
      offlineEligible: isOfflineEligibleStatus(result.status),
    };
  }
  const contacts = (result.data ?? []).filter(
    (contact) => String(contact.status ?? "").toLowerCase() !== "archived",
  ) as ContactListItem[];
  return { contacts, error: null, offlineEligible: false };
}

export async function getContact(
  workspaceId: string,
  contactId: string,
): Promise<{ contact: Contact | null; error: string | null }> {
  const result = await supabase
    .from("contacts")
    .select(CONTACT_COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("id", contactId)
    .limit(1)
    .maybeSingle();
  if (result.error || !result.data) {
    return { contact: null, error: "Kontakt konnte nicht geladen werden." };
  }
  return { contact: result.data as Contact, error: null };
}

async function duplicateContactExists(input: {
  workspaceId: string;
  draft: NormalizedContactDraft;
  excludeContactId?: string;
}): Promise<{ duplicate: boolean; error: string | null }> {
  if (!input.draft.handle) return { duplicate: false, error: null };

  let query = supabase
    .from("contacts")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .ilike("handle", input.draft.handle)
    .eq("source_platform", input.draft.source_platform)
    .limit(1);
  if (input.excludeContactId) {
    query = query.neq("id", input.excludeContactId);
  }

  const result = await query;
  if (result.error) {
    return {
      duplicate: false,
      error: "Die Duplikatprüfung konnte nicht abgeschlossen werden.",
    };
  }
  return { duplicate: (result.data?.length ?? 0) > 0, error: null };
}

function contactValidationMessage(errors: string[]): string {
  if (errors.includes("display_name")) {
    return "Bitte gib einen Kontaktnamen mit höchstens 160 Zeichen ein.";
  }
  if (errors.includes("status")) {
    return "Bitte wähle einen gültigen Kontaktstatus.";
  }
  if (errors.includes("language")) {
    return "Bitte verwende einen Sprachcode wie de, en oder de-ch.";
  }
  if (errors.includes("tags")) {
    return "Bitte verwende höchstens 20 kurze Tags.";
  }
  return "Bitte prüfe die Kontaktfelder und ihre maximale Länge.";
}

export async function createContact(input: {
  workspaceId: string;
  workspaceRole: Workspace["role"];
  draft: ContactDraft;
}): Promise<{ contact: Contact | null; error: string | null }> {
  if (!isOwnerRole(input.workspaceRole)) {
    return { contact: null, error: MEMBER_MUTATIONS_DISABLED_ERROR };
  }
  const normalized = normalizeContactDraft(input.draft);
  if (!normalized.ok || !normalized.value) {
    return { contact: null, error: contactValidationMessage(normalized.errors) };
  }

  const duplicate = await duplicateContactExists({
    workspaceId: input.workspaceId,
    draft: normalized.value,
  });
  if (duplicate.error) return { contact: null, error: duplicate.error };
  if (duplicate.duplicate) {
    return {
      contact: null,
      error: "Ein Kontakt mit diesem Handle und dieser Quelle existiert bereits.",
    };
  }

  const result = await supabase
    .from("contacts")
    .insert({
      workspace_id: input.workspaceId,
      ...normalized.value,
    })
    .select(CONTACT_COLUMNS)
    .single();
  if (result.error || !result.data) {
    return { contact: null, error: "Kontakt konnte nicht angelegt werden." };
  }
  return { contact: result.data as Contact, error: null };
}

export async function updateContact(input: {
  workspaceId: string;
  workspaceRole: Workspace["role"];
  contactId: string;
  draft: ContactDraft;
}): Promise<{ contact: Contact | null; error: string | null }> {
  if (!isOwnerRole(input.workspaceRole)) {
    return { contact: null, error: MEMBER_MUTATIONS_DISABLED_ERROR };
  }
  const normalized = normalizeContactDraft(input.draft);
  if (!normalized.ok || !normalized.value) {
    return { contact: null, error: contactValidationMessage(normalized.errors) };
  }

  const duplicate = await duplicateContactExists({
    workspaceId: input.workspaceId,
    draft: normalized.value,
    excludeContactId: input.contactId,
  });
  if (duplicate.error) return { contact: null, error: duplicate.error };
  if (duplicate.duplicate) {
    return {
      contact: null,
      error: "Ein anderer Kontakt mit diesem Handle und dieser Quelle existiert bereits.",
    };
  }

  const result = await supabase
    .from("contacts")
    .update(normalized.value)
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.contactId)
    .select(CONTACT_COLUMNS)
    .maybeSingle();
  if (result.error || !result.data) {
    return {
      contact: null,
      error: "Kontakt konnte nicht gespeichert werden oder gehört nicht zu deinem Workspace.",
    };
  }
  return { contact: result.data as Contact, error: null };
}

export async function listContactMemories(
  workspaceId: string,
  contactId: string,
): Promise<{ memories: ContactMemory[]; error: string | null }> {
  const result = await supabase
    .from("memories")
    .select(MEMORY_COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (result.error) {
    return { memories: [], error: "Kontaktwissen konnte nicht geladen werden." };
  }
  return { memories: (result.data ?? []) as ContactMemory[], error: null };
}

export async function listContactMessages(
  workspaceId: string,
  contactId: string,
): Promise<{ messages: ConversationMessage[]; error: string | null }> {
  const result = await supabase
    .from("conversation_messages")
    .select(CONVERSATION_MESSAGE_COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .limit(100);
  if (result.error) {
    return { messages: [], error: "Nachrichtenverlauf konnte nicht geladen werden." };
  }
  return { messages: (result.data ?? []) as ConversationMessage[], error: null };
}

export async function getContactFanAnalysisReport(
  workspaceId: string,
  contactId: string,
): Promise<{ report: FanAnalysisReport | null; error: string | null }> {
  const result = await supabase
    .from("fan_analysis_reports")
    .select(FAN_ANALYSIS_REPORT_COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("contact_id", contactId)
    .limit(1)
    .maybeSingle();
  if (result.error) {
    return {
      report: null,
      error:
        "Fan-Analyse kann ohne Herkunftszeitraum, Konfidenz und Prüfstatus nicht sicher angezeigt werden.",
    };
  }
  return {
    report: (result.data as FanAnalysisReport | null) ?? null,
    error: null,
  };
}

export async function listUnseenInboundFans(
  workspaceId: string,
): Promise<{ fans: DashboardUnreadFan[]; error: string | null }> {
  const messagesResult = await supabase
    .from("conversation_messages")
    .select(UNSEEN_MESSAGE_COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("direction", "inbound")
    .is("seen_at", null)
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(500);

  if (messagesResult.error) {
    return { fans: [], error: "Neue Nachrichten konnten nicht geladen werden." };
  }

  const latestByContact = new Map<
    string,
    { unreadCount: number; createdAt: string | null; sourcePlatform: string | null }
  >();
  for (const messageRow of messagesResult.data ?? []) {
    const contactId = String(messageRow.contact_id ?? "").trim();
    if (!contactId) continue;
    const existing = latestByContact.get(contactId);
    if (existing) {
      existing.unreadCount += 1;
      continue;
    }
    latestByContact.set(contactId, {
      unreadCount: 1,
      createdAt: messageRow.created_at ?? null,
      sourcePlatform: messageRow.source_platform ?? null,
    });
  }

  const contactIds = Array.from(latestByContact.keys());
  if (!contactIds.length) return { fans: [], error: null };

  const contactsResult = await supabase
    .from("contacts")
    .select(CONTACT_LIST_COLUMNS)
    .eq("workspace_id", workspaceId)
    .in("id", contactIds)
    .limit(250);
  if (contactsResult.error) {
    return { fans: [], error: "Fans mit neuen Nachrichten konnten nicht geladen werden." };
  }

  const fans = (contactsResult.data ?? [])
    .filter((contact) => String(contact.status ?? "").toLowerCase() !== "archived")
    .flatMap((contact) => {
      const unseen = latestByContact.get(contact.id);
      if (!unseen) return [];
      return [{
        ...(contact as ContactListItem),
        unread_count: unseen.unreadCount,
        latest_message_at: unseen.createdAt,
        latest_source_platform: unseen.sourcePlatform,
      }];
    })
    .sort((left, right) =>
      String(right.latest_message_at ?? "").localeCompare(
        String(left.latest_message_at ?? ""),
      ),
    );

  return { fans, error: null };
}

export async function markContactInboundMessagesSeen(input: {
  workspaceId: string;
  workspaceRole: Workspace["role"];
  contactId: string;
}): Promise<string | null> {
  if (!isOwnerRole(input.workspaceRole)) return null;
  const result = await supabase
    .from("conversation_messages")
    .update({ seen_at: new Date().toISOString() })
    .eq("workspace_id", input.workspaceId)
    .eq("contact_id", input.contactId)
    .eq("direction", "inbound")
    .is("seen_at", null);
  return result.error ? "Neue Nachrichten konnten nicht als gelesen markiert werden." : null;
}

export async function createContactMemory(input: {
  workspaceId: string;
  workspaceRole: Workspace["role"];
  contactId: string;
  content: string;
  importance?: "low" | "normal" | "high";
}): Promise<string | null> {
  if (!isOwnerRole(input.workspaceRole)) return MEMBER_MUTATIONS_DISABLED_ERROR;
  const content = input.content.trim().slice(0, 1200);
  if (!content) return "Kontaktwissen ist leer.";
  const result = await supabase.from("memories").insert({
    workspace_id: input.workspaceId,
    contact_id: input.contactId,
    type: "preference",
    content,
    importance: input.importance ?? "normal",
  });
  return result.error ? "Kontaktwissen konnte nicht gespeichert werden." : null;
}

export async function listFollowups(
  workspaceId: string,
): Promise<{ followups: Followup[]; error: string | null }> {
  const result = await supabase
    .from("followups")
    .select(`${FOLLOWUP_COLUMNS},contact:contacts(id,display_name,handle)`)
    .eq("workspace_id", workspaceId)
    .not("status", "in", COMPLETED_FOLLOWUP_FILTER)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(200);
  if (result.error) {
    return { followups: [], error: "Follow-ups konnten nicht geladen werden." };
  }
  return { followups: (result.data ?? []) as unknown as Followup[], error: null };
}

export async function listContactFollowups(
  workspaceId: string,
  contactId: string,
): Promise<{
  followups: Followup[];
  totalCount: number;
  truncated: boolean;
  error: string | null;
}> {
  const result = await supabase
    .from("followups")
    .select(FOLLOWUP_COLUMNS, { count: "exact" })
    .eq("workspace_id", workspaceId)
    .eq("contact_id", contactId)
    .not("status", "in", COMPLETED_FOLLOWUP_FILTER)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(100);
  if (result.error) {
    return {
      followups: [],
      totalCount: 0,
      truncated: false,
      error: "Follow-ups des Fans konnten nicht geladen werden.",
    };
  }
  const followups = (result.data ?? []) as Followup[];
  const totalCount = result.count ?? followups.length;
  return {
    followups,
    totalCount,
    truncated: followups.length < totalCount,
    error: null,
  };
}

export async function listTodaysFollowups(
  workspaceId: string,
  dueDate: string,
): Promise<{
  followups: Followup[];
  totalCount: number;
  truncated: boolean;
  error: string | null;
}> {
  const pageSize = 200;
  const maximumLoadedRows = 1_000;
  const selectColumns = `${FOLLOWUP_COLUMNS},contact:contacts(id,display_name,handle)`;
  const rankedPriorityGroups: Array<{
    priorities: readonly string[];
    fallback?: boolean;
  }> = [
    { priorities: ["urgent"] },
    { priorities: ["high"] },
    { priorities: ["normal", "medium"] },
    { priorities: ["low"] },
    { priorities: [], fallback: true },
  ];

  const countResult = await supabase
    .from("followups")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("due_date", dueDate)
    .not("status", "in", COMPLETED_FOLLOWUP_FILTER);
  if (countResult.error) {
    return {
      followups: [],
      totalCount: 0,
      truncated: false,
      error: "Heutige Follow-ups konnten nicht geladen werden.",
    };
  }

  const rows: Followup[] = [];
  const totalCount = countResult.count ?? 0;
  const loadTarget = Math.min(totalCount, maximumLoadedRows);
  for (const group of rankedPriorityGroups) {
    let groupOffset = 0;
    while (rows.length < loadTarget) {
      const pageLimit = Math.min(pageSize, loadTarget - rows.length);
      let pageQuery = supabase
        .from("followups")
        .select(selectColumns)
        .eq("workspace_id", workspaceId)
        .eq("due_date", dueDate)
        .not("status", "in", COMPLETED_FOLLOWUP_FILTER)
        .order("created_at", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true });
      pageQuery =
        group.fallback
          ? pageQuery.or(
              "priority.is.null,priority.not.in.(urgent,high,normal,medium,low)",
            )
          : group.priorities.length === 1
            ? pageQuery.eq("priority", group.priorities[0]!)
            : pageQuery.in("priority", [...group.priorities]);
      const pageResult = await pageQuery.range(
        groupOffset,
        groupOffset + pageLimit - 1,
      );
      if (pageResult.error) {
        return {
          followups: [],
          totalCount,
          truncated: totalCount > 0,
          error: "Heutige Follow-ups konnten nicht vollständig geladen werden.",
        };
      }
      const pageRows = (pageResult.data ?? []) as unknown as Followup[];
      rows.push(...pageRows);
      groupOffset += pageRows.length;
      if (pageRows.length < pageLimit) break;
    }
    if (rows.length >= loadTarget) break;
  }

  const priorityRank: Record<string, number> = {
    urgent: 4,
    high: 3,
    normal: 2,
    medium: 2,
    low: 1,
  };
  rows.sort((left, right) => {
    const leftRank = priorityRank[String(left.priority ?? "").toLowerCase()] ?? 0;
    const rightRank = priorityRank[String(right.priority ?? "").toLowerCase()] ?? 0;
    return (
      rightRank - leftRank ||
      String(left.created_at ?? "").localeCompare(String(right.created_at ?? "")) ||
      left.id.localeCompare(right.id)
    );
  });

  return {
    followups: rows,
    totalCount,
    truncated: rows.length < totalCount,
    error: null,
  };
}

export async function createFollowup(input: {
  workspaceId: string;
  workspaceRole: Workspace["role"];
  contactId: string;
  dueDate: string;
  reason: string;
  priority?: "low" | "normal" | "high";
}): Promise<string | null> {
  if (!isOwnerRole(input.workspaceRole)) return MEMBER_MUTATIONS_DISABLED_ERROR;
  const normalized = normalizeManualFollowupDraft({
    reason: input.reason,
    dueDate: input.dueDate,
    priority: input.priority,
  });
  if (!normalized.ok) return "Bitte prüfe Grund, Datum und Priorität des Follow-ups.";
  const result = await supabase.from("followups").insert({
    workspace_id: input.workspaceId,
    contact_id: input.contactId,
    due_date: normalized.value.due_date,
    reason: normalized.value.reason,
    priority: normalized.value.priority,
    status: "open",
  });
  return result.error ? "Follow-up konnte nicht gespeichert werden." : null;
}

export async function completeFollowup(
  workspaceId: string,
  followupId: string,
  workspaceRole: Workspace["role"],
): Promise<string | null> {
  if (!isOwnerRole(workspaceRole)) return MEMBER_MUTATIONS_DISABLED_ERROR;
  const result = await supabase
    .from("followups")
    .update({ status: CANONICAL_COMPLETED_FOLLOWUP_STATUS })
    .eq("workspace_id", workspaceId)
    .eq("id", followupId);
  return result.error ? "Follow-up konnte nicht abgeschlossen werden." : null;
}

export async function loadDashboardCounts(workspaceId: string): Promise<{
  contacts: number;
  followups: number;
  error: string | null;
}> {
  const [contactsResult, followupsResult] = await Promise.all([
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId),
    supabase
      .from("followups")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .not("status", "in", COMPLETED_FOLLOWUP_FILTER),
  ]);
  if (contactsResult.error || followupsResult.error) {
    return { contacts: 0, followups: 0, error: "Kennzahlen konnten nicht geladen werden." };
  }
  return {
    contacts: contactsResult.count ?? 0,
    followups: followupsResult.count ?? 0,
    error: null,
  };
}
