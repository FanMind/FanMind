import { requirePlatformAdmin } from "@/lib/admin";
import { listAdminOpenQuestions } from "@/lib/adminOpenQuestions";
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
      <ul style={{ listStyle: "none", padding: 0 }}>
        {questions.map(question => <li key={question.id} style={{ padding: "14px 0", borderBottom: "1px solid #ddd" }}>
          <details><summary>{question.question.slice(0, 200)} · {question.status}</summary>
            <p>{question.question}</p>
            <p>Erkannt: {new Date(question.created_at).toLocaleString("de-AT")} · Ursache: {question.reason}</p>
            <p>Gespräch: {question.conversation_id}</p>
          </details>
        </li>)}
      </ul>
      <p>Bearbeitungsstatus und Häufigkeitsanalyse folgen nach Prüfung der Schreibberechtigungen und Gruppierungslogik.</p>
    </section>
  </AdminBillingShell>;
}
