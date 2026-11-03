import "server-only";
import { getSupabaseHeaders, getSupabaseRestUrl } from "@/lib/supabase/config";
import {
  projectOpenQuestionReviews,
  topicForReviewedExcerpt,
  type OpenQuestionReviewSource,
  type OpenQuestionReviewState,
} from "@/lib/openQuestionsReview.mjs";

export type OpenQuestionRow = {
  id: string;
  workspace_id: string;
  reason: string;
  status: "open" | "in_review" | "resolved";
  created_at: string;
};
export type AdminOpenQuestion = OpenQuestionRow & {
  topic: string;
  reviewedQuestionExcerpt: string | null;
  excerptReviewState: OpenQuestionReviewState;
  duplicateCount: number;
};
export type AdminOpenQuestionWorkspace = { id: string; name: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function serviceKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) throw new Error("Datenbankzugriff nicht konfiguriert");
  return key;
}

function topicForReason(reason: string) {
  if (reason === "provider_error") return "Technische Hilfe";
  if (reason === "knowledge_gap") return "Fehlendes Wissen";
  return "Allgemeine Supportfrage";
}

// Call only from a server component after requirePlatformAdmin(). The narrow
// projection deliberately excludes billing, owner and tenant-content fields.
export async function listAdminOpenQuestionWorkspaces(): Promise<AdminOpenQuestionWorkspace[]> {
  const response = await fetch(getSupabaseRestUrl("workspaces?select=id,name&order=name.asc&limit=500"), {
    headers: getSupabaseHeaders(serviceKey()),
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("Workspaces konnten nicht geladen werden");
  const rows = await response.json() as Array<{ id?: unknown; name?: unknown }>;
  if (rows.some((row) => typeof row.id !== "string" || !UUID.test(row.id) || typeof row.name !== "string" || !row.name.trim())) {
    throw new Error("Workspace-Liste ungültig");
  }
  return rows.map((row) => ({ id: row.id as string, name: (row.name as string).trim() }));
}

// Call only from a server component after requirePlatformAdmin().
// Explicit workspace selection is mandatory: never aggregate private tenant content by default.
export async function listAdminOpenQuestions(workspaceId: string): Promise<AdminOpenQuestion[]> {
  if (!UUID.test(workspaceId)) throw new Error("Ungültige Workspace-ID");
  const headers = getSupabaseHeaders(serviceKey());
  const questionsUrl = getSupabaseRestUrl(
    `website_chat_open_questions?select=id,workspace_id,reason,status,created_at&workspace_id=eq.${encodeURIComponent(workspaceId)}&order=created_at.desc&limit=100`,
  );
  const response = await fetch(questionsUrl, { headers, cache: "no-store", signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("Offene Fragen konnten nicht geladen werden");
  const rows = await response.json() as OpenQuestionRow[];
  if (!Array.isArray(rows) || rows.some((row) => !UUID.test(row.id) || row.workspace_id !== workspaceId)) {
    throw new Error("Workspace-Zuordnung ungültig");
  }
  if (!rows.length) return [];

  let reviewRows: OpenQuestionReviewSource[] = [];
  try {
    const ids = rows.map((row) => row.id);
    const reviewsUrl = getSupabaseRestUrl(
      `website_chat_open_question_review_derivatives?select=open_question_id,workspace_id,review_version,review_state,reviewed_question_excerpt,reviewer_id,reviewed_at&workspace_id=eq.${encodeURIComponent(workspaceId)}&open_question_id=in.(${ids.map(encodeURIComponent).join(",")})&order=review_version.desc&limit=500`,
    );
    const reviewResponse = await fetch(reviewsUrl, { headers, cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (reviewResponse.ok) {
      const payload = await reviewResponse.json();
      if (Array.isArray(payload)) reviewRows = payload as OpenQuestionReviewSource[];
    }
  } catch {
    reviewRows = [];
  }

  const projections = projectOpenQuestionReviews(rows, reviewRows);
  return rows.map((row) => {
    const projection = projections.get(row.id) ?? {
      reviewedQuestionExcerpt: null,
      excerptReviewState: "pending" as const,
      duplicateCount: 1,
    };
    return {
      ...row,
      topic: topicForReviewedExcerpt(projection.reviewedQuestionExcerpt, topicForReason(row.reason)),
      ...projection,
    };
  });
}
