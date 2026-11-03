"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/admin";
import { getSupabaseHeaders, getSupabaseRestUrl } from "@/lib/supabase/config";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = new Set(["open", "in_review", "resolved"]);

export async function updateOpenQuestionStatus(formData: FormData): Promise<void> {
  // Never trust the caller or a hidden form field for authorization.
  await requirePlatformAdmin();
  const workspace = formData.get("workspace");
  const id = formData.get("id");
  const status = formData.get("status");
  if (typeof workspace !== "string" || !UUID.test(workspace) ||
      typeof id !== "string" || !UUID.test(id) ||
      typeof status !== "string" || !STATUSES.has(status)) {
    throw new Error("Ungültige Statusänderung");
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) throw new Error("Datenbankzugriff nicht konfiguriert");
  const response = await fetch(getSupabaseRestUrl(
    `website_chat_open_questions?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${encodeURIComponent(workspace)}&select=id`,
  ), {
    method: "PATCH",
    headers: { ...getSupabaseHeaders(key), Prefer: "return=representation" },
    body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("Statusänderung fehlgeschlagen");
  const rows = await response.json() as Array<{ id: string }>;
  if (rows.length !== 1 || rows[0].id !== id) throw new Error("Frage im Workspace nicht gefunden");
  revalidatePath("/admin/open-questions");
}
