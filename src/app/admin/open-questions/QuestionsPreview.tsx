"use client";
import { useMemo, useState } from "react";

type Item = { id: number; question: string; topic: string; count: number; reason: string; status: "Neu" | "In Prüfung" | "Erledigt" };
const initial: Item[] = [
  { id: 1, question: "Wie ändere ich die Rechnungsadresse?", topic: "Abrechnung", count: 8, reason: "Wissenslücke", status: "Neu" },
  { id: 2, question: "Wo finde ich den Export meiner Daten?", topic: "Datenexport", count: 5, reason: "Quelle fehlt", status: "In Prüfung" },
  { id: 3, question: "Kann ich einen Teamzugang einrichten?", topic: "Teamverwaltung", count: 4, reason: "Antwort unsicher", status: "Neu" },
  { id: 4, question: "Warum lädt die Übersicht nicht?", topic: "Technisches Problem", count: 3, reason: "Technischer Fehler", status: "Neu" },
];
export function QuestionsPreview() {
  const [items, setItems] = useState(initial);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const visible = useMemo(() => items.filter(x => (x.question + " " + x.topic).toLocaleLowerCase("de").includes(query.toLocaleLowerCase("de")) && (!status || x.status === status)), [items, query, status]);
  const detail = items.find(x => x.id === selected);
  return <section style={{ padding: 20, background: "white", borderRadius: 12, marginTop: 20 }}>
    <p role="status"><strong>Testvorschau:</strong> Keine echten Besucherfragen, keine Speicherung und kein E-Mail-Versand.</p>
    <p>{items.filter(x => x.status !== "Erledigt").length} offene Themen · {items.reduce((n,x) => n + x.count, 0)} beispielhafte Vorkommen</p>
    <label>Fragen suchen <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Frage oder Thema" /></label>{" "}
    <label>Status <select value={status} onChange={e => setStatus(e.target.value)}><option value="">Alle</option><option>Neu</option><option>In Prüfung</option><option>Erledigt</option></select></label>
    <ul style={{ listStyle: "none", padding: 0 }}>
      {visible.map(x => <li key={x.id} style={{ borderBottom: "1px solid #ddd", padding: "12px 0" }}>
        <button type="button" onClick={() => setSelected(x.id)} aria-label={`Frage öffnen: ${x.question}`} style={{ textAlign: "left" }}>{x.question}</button>
        <div>{x.topic} · {x.count}× · {x.status}</div>
      </li>)}
    </ul>
    {visible.length === 0 && <p>Keine passenden Fragen.</p>}
    {detail && <section aria-label="Fragedetails" style={{ border: "1px solid #bbb", padding: 16, borderRadius: 8 }}>
      <h2>Fragedetails</h2><p><strong>{detail.question}</strong></p>
      <p>Thema: {detail.topic} · Häufigkeit: {detail.count} · Ursache: {detail.reason}</p>
      <label>Bearbeitungsstatus <select value={detail.status} onChange={e => setItems(xs => xs.map(x => x.id === detail.id ? {...x, status: e.target.value as Item["status"]} : x))}>
        <option>Neu</option><option>In Prüfung</option><option>Erledigt</option>
      </select></label>{" "}<button type="button" onClick={() => setSelected(null)}>Schließen</button>
      <p>Änderungen sind nur in dieser Vorschau sichtbar.</p>
    </section>}
  </section>;
}
