import { requirePlatformAdmin } from "@/lib/admin";
import { listAdminOpenQuestions } from "@/lib/adminOpenQuestions";
import { groupOpenQuestions } from "@/lib/openQuestionsGrouping.mjs";
import { updateOpenQuestionStatus } from "./actions";
import { AdminBillingShell } from "../billing/AdminBillingShell";
import { AdminTabs } from "../billing/AdminTabs";

export default async function OpenQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const user = await requirePlatformAdmin();
  const { workspace } = await searchParams;
  let questions: Awaited<ReturnType<typeof listAdminOpenQuestions>> = [];
  let error = "";
  if (workspace) {
    try { questions = await listAdminOpenQuestions(workspace); }
    catch (cause) { error = cause instanceof Error ? cause.message : "Abfrage fehlgeschlagen"; }
  }
  // Resolved items remain visible in the audit list, but are not open questions.
  const grouped = groupOpenQuestions(questions.filter(question => question.status !== "resolved"));
  return <AdminBillingShell user={user} title="Offene Fragen" subtitle="Echte Chatfragen – Workspace-Auswahl erforderlich.">
    <AdminTabs activeTab="open-questions" />
    <section style={{ padding: 20, marginTop: 20, background: "white", borderRadius: 12 }}>
      <form method="get" action="/admin/open-questions">
        <label htmlFor="workspace">Workspace-ID</label>{" "}
        <input id="workspace" name="workspace" defaultValue={workspace ?? ""} required placeholder="UUID des Workspaces" style={{ minWidth: 270 }} />{" "}
        <button type="submit">Fragen laden</button>
      </form>
      {!workspace && <p>Bitte zuerst einen Workspace auswählen. Es werden keine Fragen anderer Workspaces eingeblendet.</p>}
      {error && <p role="alert">{error}</p>}
      {workspace && !error && <p>{questions.length} erfasste Fragen (maximal 100 neueste Einträge).</p>}
      {workspace && !error && questions.length === 0 && <p>Keine erfassten Fragen für diesen Workspace.</p>}
      {workspace && !error && <section aria-label="Häufigste offene Fragen"><h2>Häufigste offene Fragen</h2><p>Gruppierung innerhalb des ausgewählten Workspaces; nur die 100 zuletzt erfassten Fragen.</p><ol>{grouped.slice(0, 10).map(group => <li key={group.normalized_question}>{group.excerpt.slice(0, 140)} — {group.count} {group.count === 1 ? "Vorkommen" : "Vorkommen"}</li>)}</ol></section>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {questions.map(question => <li key={question.id} style={{ padding: "14px 0", borderBottom: "1px solid #ddd" }}>
          <details><summary>{question.question.slice(0, 200)} · {question.status}</summary>
            <p>{question.question}</p>
            <p>Erkannt: {new Date(question.created_at).toLocaleString("de-AT")} · Ursache: {question.reason}</p>
            <p>Gespräch: {question.conversation_id}</p>
            <form action={updateOpenQuestionStatus}>
              <input type="hidden" name="workspace" value={workspace ?? ""} />
              <input type="hidden" name="id" value={question.id} />
              <label htmlFor={`status-${question.id}`}>Bearbeitungsstatus</label>{" "}
              <select id={`status-${question.id}`} name="status" defaultValue={question.status}>
                <option value="open">Offen</option><option value="in_review">In Prüfung</option><option value="resolved">Erledigt</option>
              </select>{" "}<button type="submit">Speichern</button>
            </form>
          </details>
        </li>)}
      </ul>
      <p>Statusänderungen sind nur für Plattformadministratoren und die ausgewählte Workspace-ID erlaubt. Häufigkeiten basieren auf den maximal 100 geladenen Einträgen.</p>
    </section>
  </AdminBillingShell>;
}
