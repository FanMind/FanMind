import "server-only";
import { getSupabaseHeaders, getSupabaseRestUrl } from "@/lib/supabase/config";

export type OpenQuestionRow = {
  id: string;
  workspace_id: string;
  conversation_id: string;
  inbound_message_id: string;
  reason: string;
  status: "open" | "in_review" | "resolved";
  created_at: string;
};
export type AdminOpenQuestion = OpenQuestionRow & { question: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Call only from a server component after requirePlatformAdmin().
// Explicit workspace selection is mandatory: never aggregate private tenant content by default.
export async function listAdminOpenQuestions(workspaceId: string): Promise<AdminOpenQuestion[]> {
  if (!UUID.test(workspaceId)) throw new Error("Ungültige Workspace-ID");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) throw new Error("Datenbankzugriff nicht konfiguriert");
  const headers = getSupabaseHeaders(key);
  const base = getSupabaseRestUrl(
    `website_chat_open_questions?select=id,workspace_id,conversation_id,inbound_message_id,reason,status,created_at&workspace_id=eq.${encodeURIComponent(workspaceId)}&order=created_at.desc&limit=100`,
  );
  const response = await fetch(base, { headers, cache: "no-store", signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("Offene Fragen konnten nicht geladen werden");
  const rows = await response.json() as OpenQuestionRow[];
  if (rows.some(row => row.workspace_id !== workspaceId)) throw new Error("Workspace-Zuordnung ungültig");
  // Fetch only messages referenced by this workspace's candidates, never all conversations.
  const ids = rows.map(row => row.inbound_message_id);
  if (!ids.length) return [];
  const messagesResponse = await fetch(getSupabaseRestUrl(
    `conversation_messages?select=id,workspace_id,content&workspace_id=eq.${encodeURIComponent(workspaceId)}&id=in.(${ids.map(encodeURIComponent).join(",")})&limit=100`,
  ), { headers, cache: "no-store", signal: AbortSignal.timeout(5000) });
  if (!messagesResponse.ok) throw new Error("Fragetexte konnten nicht geladen werden");
  const messages = await messagesResponse.json() as Array<{ id: string; workspace_id: string; content: string }>;
  const textById = new Map(messages.filter(m => m.workspace_id === workspaceId).map(m => [m.id, m.content]));
  return rows.map(row => ({ ...row, question: textById.get(row.inbound_message_id) ?? "[Nachricht nicht verfügbar]" }));
}
