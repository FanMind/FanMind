"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/admin";
import { getSupabaseHeaders, getSupabaseRestUrl } from "@/lib/supabase/config";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = new Set(["open", "in_review", "resolved"]);

export async function updateOpenQuestionStatus(formData: FormData): Promise<void> {
  // Never trust the caller or a hidden form field for authorization or actor identity.
  const actor = await requirePlatformAdmin();
  const workspace = formData.get("workspace");
  const id = formData.get("id");
  const status = formData.get("status");
  if (typeof workspace !== "string" || !UUID.test(workspace) ||
      typeof id !== "string" || !UUID.test(id) ||
      typeof status !== "string" || !STATUSES.has(status) || !UUID.test(actor.id)) {
    throw new Error("Ungültige Statusänderung");
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) throw new Error("Datenbankzugriff nicht konfiguriert");
  const response = await fetch(getSupabaseRestUrl("rpc/update_website_chat_open_question_status"), {
    method: "POST",
    headers: { ...getSupabaseHeaders(key), Prefer: "return=representation" },
    body: JSON.stringify({
      p_workspace_id: workspace,
      p_question_id: id,
      p_actor_id: actor.id,
      p_after_status: status,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("Statusänderung fehlgeschlagen");
  const rows = await response.json() as Array<{ id: string; workspace_id: string; after_status: string }>;
  if (rows.length !== 1 || rows[0].id !== id || rows[0].workspace_id !== workspace || rows[0].after_status !== status) {
    throw new Error("Frage im Workspace nicht gefunden");
  }
  revalidatePath("/admin/open-questions");
}
