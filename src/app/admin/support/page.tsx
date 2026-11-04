import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/admin";
import { listSupportCases, listSupportWorkspaces, supportCentreActor, supportCentreTime, supportCentreEnabled, type SupportAudit } from "@/lib/supportCentreServer";
import { supportProblems, supportCaseNeedsAttention, type SupportCase } from "@/lib/supportCentrePolicy";
import { DecisionButtons } from "./DecisionButtons";
import styles from "./support.module.css";

export const dynamic = "force-dynamic";
const statuses: Record<string, string> = { pending: "Freigabe offen", running: "Ausführung / Nachprüfung offen", rejected: "Abgelehnt", succeeded: "Lesende Nachprüfung bestanden", failed: "Weiterhin gestört / Prüfung fehlgeschlagen", expired: "Abgelaufen" };
const events: Record<string, string> = { requested: "Freigabe angefragt", approved: "Einmalige Prüfung freigegeben", rejected: "Abgelehnt", succeeded: "Nachprüfung bestanden", failed: "Nachprüfung fehlgeschlagen", expired: "Freigabe abgelaufen" };
const time = (value: string) => new Date(value).toLocaleString("de-AT", { timeZone: "Europe/Vienna" });

export default async function SupportCentrePage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  await requirePlatformAdmin();
  const { workspace } = await searchParams;
  let owner = false, error = "";
  let workspaces: Array<{ id: string; name: string }> = [];
  let cases: SupportCase[] = [], audit: SupportAudit[] = [];
  if (supportCentreEnabled()) {
    try {
      owner = (await supportCentreActor())?.owner === true;
      workspaces = await listSupportWorkspaces();
      if (workspace) {
        if (!workspaces.some(w => w.id === workspace)) throw new Error("invalid_workspace");
        ({ cases, audit } = await listSupportCases(workspace));
      }
    } catch { error = "Supportdaten sind derzeit nicht verfügbar. Es wird kein leerer Erfolgsstatus angenommen."; }
  }
  const now = await supportCentreTime();
  const pending = cases.filter(c => c.status === "pending" && Date.parse(c.expires_at) > now);
  const alerts = cases.filter(c => supportCaseNeedsAttention(c, now));
  return <main className={styles.root}>
    <header><Link href="/admin">← FanMind-Administration</Link><h1>KI-Support-Zentrale</h1><p>Supportfälle, technische Diagnosen und kontrollierte Owner-Freigaben.</p><p>{owner ? "Plattform-Owner · Freigaben möglich" : "Plattform-Admin · lesender Zugriff"}</p></header>
    <nav aria-label="Support-Navigation">{[["dashboard", "Dashboard"], ["cases", "Supportfälle & Diagnosen"], ["approvals", "Owner-Freigaben"], ["history", "Reparaturhistorie"], ["audit", "Audit & Aktivitäten"]].map(([id,label]) => <a key={id} href={`#${id}`}>{label}</a>)}<Link href="/admin/open-questions">Unbeantwortete Fragen</Link></nav>
    {!supportCentreEnabled() && <p className={styles.notice}>Die Support-Zentrale ist noch nicht aktiviert. Datenbankinstallation und Staging-Abnahme stehen aus.</p>}
    {error && <p role="alert" className={styles.notice}>{error}</p>}
    {supportCentreEnabled() && !error && <form method="get" action="/admin/support"><label htmlFor="workspace">Workspace auswählen (maximal 100)</label><br/><select id="workspace" name="workspace" defaultValue={workspace ?? ""} required><option value="" disabled>Workspace wählen</option>{workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select>{" "}<button type="submit">Anzeigen</button></form>}
    <section id="dashboard"><h2>Dashboard</h2>{!workspace || error || !supportCentreEnabled() ? <p>Für verlässliche Zahlen zuerst einen verfügbaren Workspace auswählen.</p> : <><p>Die maximal 100 neuesten Fälle des ausgewählten Workspaces.</p><div className={styles.metrics}><p>{cases.length} Fälle</p><p>{pending.length} offene Freigaben</p><p>{cases.filter(c=>c.status==="failed").length} fehlgeschlagene Prüfungen</p><p>{cases.filter(c=>c.status==="succeeded").length} bestätigte Prüfungen</p></div></>}
      {owner && alerts.length > 0 && <aside aria-label="Owner-Benachrichtigungen" className={styles.notice}><h3>Aufmerksamkeit erforderlich</h3><ul>{alerts.map(c => <li key={c.id}><a href={`#case-${c.id}`}>{c.platform}: {statuses[c.status]}</a></li>)}</ul><p>Routineerfolge stehen ausschließlich im Verlauf.</p></aside>}
    </section>
    <section id="cases"><h2>Supportfälle & technische Diagnosen</h2><p>Nur feste Fehlerklassen; keine Nachrichteninhalte, Zugangsdaten oder Provider-Fehlertexte.</p>{cases.map(c => <article key={c.id} id={`case-${c.id}`}><h3>{c.platform} · {supportProblems[c.problem].problem}</h3><p>{c.status === "pending" && Date.parse(c.expires_at) <= now ? "Abgelaufen" : statuses[c.status]} · {time(c.created_at)}</p><details><summary>Details anzeigen</summary><dl><dt>Betroffenes System</dt><dd>Workspace-Verbindung · {c.platform}</dd><dt>Problembeschreibung</dt><dd>{supportProblems[c.problem].problem}</dd><dt>Technische Diagnose</dt><dd>{supportProblems[c.problem].diagnosis}</dd><dt>Bereits durchgeführte Prüfungen</dt><dd>Authentifizierung, Workspace-Zuordnung, gespeicherter Verbindungsstatus und Synchronisierungsfehlerklasse.</dd><dt>Vorgeschlagene Aktion</dt><dd>{supportProblems[c.problem].repair}</dd><dt>Konkret benötigte Berechtigung</dt><dd>{c.permission} · {c.action}</dd><dt>Risiko</dt><dd>{supportProblems[c.problem].risk}</dd><dt>Erwartete Auswirkungen</dt><dd>{supportProblems[c.problem].impact}</dd><dt>Freigabe gültig bis</dt><dd>{time(c.expires_at)} · einmalig für diesen Fall</dd></dl></details></article>)}</section>
    <section id="approvals"><h2>Owner-Freigaben</h2><p>Eine Freigabe erlaubt genau eine lesende Prüfung mit Nachprüfung. Sie ersetzt keine Kundenbestätigung und erlaubt keine Provider-, Daten- oder Rechteänderung.</p>{pending.map(c => <article key={c.id}><a href={`#case-${c.id}`}>{c.platform}: Details anzeigen</a>{owner ? <DecisionButtons workspace={c.workspace_id} id={c.id}/> : <p>Nur der Plattform-Owner kann entscheiden.</p>}</article>)}</section>
    <section id="history"><h2>Reparaturhistorie</h2><p>Dieser Bereich zeigt die Prüfungen der Support-Zentrale. Bestehende kundenseitig bestätigte Synchronisierungsreparaturen besitzen weiterhin ihr eigenes Audit.</p><ul>{cases.filter(c=>!["pending","running"].includes(c.status)).map(c=><li key={c.id}>{c.platform} · {statuses[c.status]} · {time(c.completed_at ?? c.created_at)}</li>)}</ul></section>
    <section id="audit"><h2>Audit & Aktivitäten</h2><p>Die 200 neuesten protokollierten Ereignisse des ausgewählten Workspaces.</p><ol>{audit.map((event,index)=><li key={`${event.case_id}-${index}`}>{time(event.created_at)} · {events[event.event]} · <a href={`#case-${event.case_id}`}>Fall anzeigen</a></li>)}</ol></section>
  </main>;
}
