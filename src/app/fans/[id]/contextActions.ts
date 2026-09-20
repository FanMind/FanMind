"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getSupabaseHeaders,
  getSupabaseRestUrl,
} from "@/lib/supabase/config";
import { requireContactInActiveAuthorizedWorkspace } from "@/lib/workspaceAuthorization";

const MEMORY_TYPES = new Set(["note", "preference", "promise"]);
const IMPORTANCE_LEVELS = new Set(["low", "normal", "high"]);

function formValue(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function localeFromForm(formData: FormData): "de" | "en" {
  return formValue(formData, "lang") === "en" ? "en" : "de";
}

function contactPath(
  contactId: string,
  locale: "de" | "en",
  notice: string,
  hash = "contact-knowledge",
): string {
  const params = new URLSearchParams({ notice });
  if (locale === "en") params.set("lang", "en");
  return `/fans/${encodeURIComponent(contactId)}?${params.toString()}#${hash}`;
}

function followupsPath(
  locale: "de" | "en",
  status: "open" | "completed",
  notice: string,
): string {
  const params = new URLSearchParams({
    notice,
    status: status === "completed" ? "done" : "open",
  });
  if (locale === "en") params.set("lang", "en");
  return `/followups?${params.toString()}`;
}

function serviceRoleKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
}

async function mutateWorkspaceScopedEntry(input: {
  workspaceId: string;
  contactId: string;
  table: "memories" | "followups";
  entryId: string;
  entryLabel: string;
  method: "PATCH" | "DELETE";
  values?: Record<string, unknown>;
}): Promise<{ ok: boolean; error?: string }> {
  const key = serviceRoleKey();
  if (!key) {
    return {
      ok: false,
      error: `${input.entryLabel} kann nicht geändert werden: Serverberechtigung ist nicht konfiguriert.`,
    };
  }

  const url = new URL(getSupabaseRestUrl(input.table));
  url.searchParams.set("id", `eq.${input.entryId}`);
  url.searchParams.set("workspace_id", `eq.${input.workspaceId}`);
  url.searchParams.set("contact_id", `eq.${input.contactId}`);
  url.searchParams.set("select", "id");

  try {
    const response = await fetch(url, {
      method: input.method,
      headers: {
        ...getSupabaseHeaders(key),
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body:
        input.method === "PATCH"
          ? JSON.stringify(input.values ?? {})
          : undefined,
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `${input.entryLabel} konnte nicht geändert werden (${response.status}).`,
      };
    }

    const rows = (await response.json().catch(() => [])) as Array<{
      id?: string;
    }>;
    if (!rows.some((row) => row.id === input.entryId)) {
      return {
        ok: false,
        error: `${input.entryLabel} wurde im autorisierten Workspace nicht gefunden.`,
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : `${input.entryLabel} konnte nicht geändert werden.`,
    };
  }
}

export async function updateManualMemory(formData: FormData) {
  const contactId = formValue(formData, "contact_id");
  const memoryId = formValue(formData, "memory_id");
  const locale = localeFromForm(formData);
  const content = formValue(formData, "content").slice(0, 4000);
  const rawImportance = formValue(formData, "importance");
  const rawType = formValue(formData, "type");

  if (!contactId || !memoryId || !content) {
    redirect(contactPath(contactId, locale, "knowledge_update_invalid"));
  }

  const { workspace } =
    await requireContactInActiveAuthorizedWorkspace(contactId);
  const importance = IMPORTANCE_LEVELS.has(rawImportance)
    ? rawImportance
    : "normal";
  const type = MEMORY_TYPES.has(rawType) ? rawType : "note";
  const result = await mutateWorkspaceScopedEntry({
    table: "memories",
    entryId: memoryId,
    entryLabel: "Kontaktwissen",
    workspaceId: workspace.id,
    contactId,
    method: "PATCH",
    values: { content, importance, type },
  });

  if (!result.ok) {
    redirect(contactPath(contactId, locale, "knowledge_update_failed"));
  }

  revalidatePath(`/fans/${contactId}`);
  revalidatePath("/dashboard");
  redirect(contactPath(contactId, locale, "knowledge_updated"));
}

export async function deleteManualMemory(formData: FormData) {
  const contactId = formValue(formData, "contact_id");
  const memoryId = formValue(formData, "memory_id");
  const locale = localeFromForm(formData);

  if (!contactId || !memoryId) {
    redirect(contactPath(contactId, locale, "knowledge_delete_invalid"));
  }

  const { workspace } =
    await requireContactInActiveAuthorizedWorkspace(contactId);
  const result = await mutateWorkspaceScopedEntry({
    table: "memories",
    entryId: memoryId,
    entryLabel: "Kontaktwissen",
    workspaceId: workspace.id,
    contactId,
    method: "DELETE",
  });

  if (!result.ok) {
    redirect(contactPath(contactId, locale, "knowledge_delete_failed"));
  }

  revalidatePath(`/fans/${contactId}`);
  revalidatePath("/dashboard");
  redirect(contactPath(contactId, locale, "knowledge_deleted"));
}

export async function updateManualFollowupStatus(formData: FormData) {
  const contactId = formValue(formData, "contact_id");
  const followupId = formValue(formData, "followup_id");
  const locale = localeFromForm(formData);
  const returnTo =
    formValue(formData, "return_to") === "followups"
      ? "followups"
      : "contact";
  const nextStatus =
    formValue(formData, "next_status") === "open" ? "open" : "completed";

  const redirectFailure = (notice: string) => {
    if (returnTo === "followups") {
      redirect(followupsPath(locale, nextStatus, notice));
    }
    redirect(contactPath(contactId, locale, notice, "followups"));
  };
  const redirectSuccess = () => {
    const notice = nextStatus === "completed" ? "followup_completed" : "followup_reopened";
    if (returnTo === "followups") {
      redirect(followupsPath(locale, nextStatus, notice));
    }
    redirect(contactPath(contactId, locale, notice, "followups"));
  };

  if (!contactId || !followupId) {
    redirectFailure("followup_status_invalid");
  }

  const { workspace } =
    await requireContactInActiveAuthorizedWorkspace(contactId);
  const result = await mutateWorkspaceScopedEntry({
    table: "followups",
    entryId: followupId,
    entryLabel: "Follow-up",
    workspaceId: workspace.id,
    contactId,
    method: "PATCH",
    values: { status: nextStatus },
  });

  if (!result.ok) {
    redirectFailure("followup_status_failed");
  }

  revalidatePath(`/fans/${contactId}`);
  revalidatePath("/dashboard");
  revalidatePath("/followups");
  redirectSuccess();
}

export async function deleteManualFollowup(formData: FormData) {
  const contactId = formValue(formData, "contact_id");
  const followupId = formValue(formData, "followup_id");
  const locale = localeFromForm(formData);

  if (!contactId || !followupId) {
    redirect(
      contactPath(contactId, locale, "followup_delete_invalid", "followups"),
    );
  }

  const { workspace } =
    await requireContactInActiveAuthorizedWorkspace(contactId);
  const result = await mutateWorkspaceScopedEntry({
    table: "followups",
    entryId: followupId,
    entryLabel: "Follow-up",
    workspaceId: workspace.id,
    contactId,
    method: "DELETE",
  });

  if (!result.ok) {
    redirect(
      contactPath(contactId, locale, "followup_delete_failed", "followups"),
    );
  }

  revalidatePath(`/fans/${contactId}`);
  revalidatePath("/dashboard");
  revalidatePath("/followups");
  redirect(contactPath(contactId, locale, "followup_deleted", "followups"));
}

export async function deleteContactAndCreatorData(formData: FormData) {
  const contactId = formValue(formData, "contact_id");
  const locale = localeFromForm(formData);
  if (!contactId) redirect(`/fans?notice=contact_delete_invalid${locale === "en" ? "&lang=en" : ""}`);

  const { workspace } =
    await requireContactInActiveAuthorizedWorkspace(contactId);
  const key = serviceRoleKey();
  if (!key) redirect(contactPath(contactId, locale, "contact_delete_failed"));

  const url = new URL(getSupabaseRestUrl("rpc/delete_contact_with_meta_catchup"));
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...getSupabaseHeaders(key),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_workspace_id: workspace.id,
      p_contact_id: contactId,
    }),
    cache: "no-store",
  }).catch(() => null);
  const rows = response?.ok
    ? await response.json().catch(() => null)
    : null;
  if (
    !Array.isArray(rows) ||
    rows.length !== 1 ||
    rows[0]?.deleted_contact_id !== contactId ||
    rows[0]?.deleted_workspace_id !== workspace.id
  ) {
    redirect(contactPath(contactId, locale, "contact_delete_failed"));
  }

  revalidatePath("/fans");
  revalidatePath("/dashboard");
  revalidatePath("/followups");
  redirect(`/fans?notice=contact_deleted${locale === "en" ? "&lang=en" : ""}`);
}
