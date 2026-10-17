import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/admin";
import { roadmapPhases } from "@/config/roadmap";
import { AdminBillingShell } from "../billing/AdminBillingShell";
import { AdminTabs } from "../billing/AdminTabs";
import styles from "./adminRoadmap.module.css";

const statusLabels: Record<string, string> = {
  done: "Erledigt",
  progress: "In Arbeit",
  partial: "Vorbereitet",
  planned: "Coming Soon / Roadmap",
  later: "Später",
};

function phaseStatusLabel(availability: string, status: string) {
  if (availability === "done") return "Erledigt";
  if (status.includes("Smoke-Test")) return "Finaler Smoke-Test";
  if (status.includes("Vorbereitung") || status.includes("Beta") || status.includes("Arbeit")) return "In Arbeit / vorbereitet";
  if (status.includes("Kürze")) return "Coming Soon";
  return "Später / Roadmap";
}

export default async function AdminRoadmapPage() {
  const user = await requirePlatformAdmin();

  return (
    <AdminBillingShell
      user={user}
      title="Admin-Roadmap"
      subtitle="Interne Roadmap aus derselben Datenquelle wie die Landingpage – ohne falsche Live-Versprechen."
    >
      <div className={styles.adminRoadmapStack}>
        <AdminTabs activeTab="roadmap" />

        <section className={styles.heroCard}>
          <div>
            <span className={styles.eyebrow}>Produktplanung</span>
            <h1>Roadmap-Phasen intern verfolgen</h1>
            <p>
              Die Reihenfolge entspricht der öffentlichen Landingpage: Alle Phasen sind fortlaufend nummeriert und nutzen dieselbe zentrale Datenquelle.
            </p>
          </div>
          <Link className={styles.primaryLink} href="/#roadmap">Öffentliche Roadmap prüfen</Link>
        </section>

        <section className={styles.heroCard} aria-label="Interner AI-Capacity-Abnahmestand">
          <div>
            <span className={styles.eyebrow}>Interner Betriebs- und Abnahmestand · 17.10.2026</span>
            <h2>AI Capacity v2: Entwicklungsarbeit abgeschlossen, Staging-Abnahme blockiert</h2>
            <p>
              #1331 (SQL-Lifecycle), #1332 (geschützter Read-only-Pfad) und #1333 (sichere BLOCK-Diagnose)
              sind auf main gemergt. Das bestätigt nur Source und Tests, keine Installation oder Aktivierung
              in Staging bzw. Production.
            </p>
            <p>
              Der erste geschützte Staging-Lauf 39022404980 endete mit BLOCK. Eine erfolgreiche
              Datenbankverbindung, SQL-Ausführung oder passende Baseline ist dadurch nicht bewiesen.
              Die Ursache bleibt offen; die neue Diagnosefunktion wurde seit dem Merge noch nicht
              in einem erneut autorisierten Live-Lauf abgenommen.
            </p>
            <p>
              <strong>Nächster Schritt:</strong> aktuelle Commit- und Checksum-Bindungen prüfen und erst
              nach neuer exakter Owner-Freigabe einmalig read-only diagnostizieren. Kein Retry auf
              alte Autorisierung, kein SQL-Apply. Top-up/Refund (D3), Entitlements, Legal und
              Verkauf bleiben separat offen.
            </p>
            <p>
              <Link href="https://github.com/FanMind/FanMind/actions/runs/39022404980">
                Fehlgeschlagenen Staging-Lauf ansehen
              </Link>
              {" · "}
              <Link href="https://github.com/FanMind/FanMind/pull/1333">
                Diagnose-PR #1333
              </Link>
            </p>
          </div>
        </section>

        <div className={styles.phaseGrid}>
          {roadmapPhases.map((phase) => (
            <article className={styles.phaseCard} data-done={phase.availability === "done" ? "true" : undefined} key={phase.number}>
              <div className={styles.phaseHeader}>
                <span className={styles.phaseNumber}>{phase.phase}</span>
                <span className={phase.availability === "done" ? styles.doneBadge : styles.openBadge}>
                  {phase.availability === "done" ? "✓ " : ""}{phaseStatusLabel(phase.availability, phase.status)}
                </span>
              </div>
              <h2>{phase.title}</h2>
              <p className={styles.phaseStatus}>{phase.statusIcon} {phase.status}</p>
              <ul>
                {phase.items.map((item) => (
                  <li data-state={item.state} key={item.label}>
                    <span aria-hidden="true">{item.state === "done" ? "✓" : "○"}</span>
                    <strong>{item.label}</strong>
                    <em>{item.status ?? statusLabels[item.state] ?? "Offen"}</em>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </AdminBillingShell>
  );
}
