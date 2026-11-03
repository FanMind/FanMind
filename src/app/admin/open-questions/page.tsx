import { requirePlatformAdmin } from "@/lib/admin";
import {
  listAdminOpenQuestions,
  listAdminOpenQuestionWorkspaces,
} from "@/lib/adminOpenQuestions";
import { AdminBillingShell } from "../billing/AdminBillingShell";
import { AdminTabs } from "../billing/AdminTabs";
import {
  OpenQuestionsClient,
  type OpenQuestionClientRow,
  type OpenQuestionTopicStat,
} from "./OpenQuestionsClient";

export default async function OpenQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const user = await requirePlatformAdmin();
  const { workspace } = await searchParams;
  let workspaceError = "";
  let workspaces: Awaited<ReturnType<typeof listAdminOpenQuestionWorkspaces>> = [];

  try {
    workspaces = await listAdminOpenQuestionWorkspaces();
  } catch {
    workspaceError = "Workspaces konnten nicht geladen werden.";
  }

  const selectedWorkspace = workspaces.find((candidate) => candidate.id === workspace);
  let questions: Awaited<ReturnType<typeof listAdminOpenQuestions>> = [];
  let questionError = "";
  if (workspace && !selectedWorkspace) {
    questionError = "Dieser Workspace steht für die Admin-Prüfung nicht zur Verfügung.";
  } else if (selectedWorkspace) {
    try {
      questions = await listAdminOpenQuestions(selectedWorkspace.id);
    } catch {
      questionError = "Offene Fragen konnten nicht geladen werden.";
    }
  }

  const topicCounts = new Map<string, number>();
  for (const question of questions.filter((item) => item.status !== "resolved")) {
    topicCounts.set(question.topic, (topicCounts.get(question.topic) ?? 0) + 1);
  }
  const topicStats: OpenQuestionTopicStat[] = [...topicCounts]
    .map(([topic, count]) => ({ topic, count }))
    .sort((left, right) => right.count - left.count || left.topic.localeCompare(right.topic, "de"));
  const clientQuestions: OpenQuestionClientRow[] = questions.map((question) => ({
    id: question.id,
    topic: question.topic,
    reason: question.reason,
    status: question.status,
    createdAt: question.created_at,
    reviewedQuestionExcerpt: question.reviewedQuestionExcerpt,
    excerptReviewState: question.excerptReviewState,
    duplicateCount: question.duplicateCount,
  }));

  return (
    <AdminBillingShell
      user={user}
      title="Offene Fragen"
      subtitle="Wissenslücken prüfen, priorisieren und workspacegetrennt bearbeiten."
    >
      <AdminTabs activeTab="open-questions" />
      <OpenQuestionsClient
        workspaces={workspaces}
        selectedWorkspaceId={selectedWorkspace?.id ?? ""}
        questions={clientQuestions}
        topicStats={topicStats}
        error={workspaceError || questionError}
      />
    </AdminBillingShell>
  );
}
