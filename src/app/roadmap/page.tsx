import type { Metadata } from "next";
import Link from "next/link";
import { roadmapPhases, type RoadmapPhase } from "@/config/roadmap";
import styles from "./roadmap.module.css";

export const metadata: Metadata = {
  title: "FanMind | Roadmap",
  description: "Transparente Roadmap für aktive, geplante und spätere FanMind Features.",
};

function RoadmapColumn({
  title,
  phases,
}: {
  title: string;
  phases: RoadmapPhase[];
}) {
  return (
    <section className={styles.column}>
      <h2>{title}</h2>
      <div className={styles.items}>
        {phases.map((phase) => (
          <article className={styles.item} data-availability={phase.availability} key={phase.number}>
            <div>
              <p className={styles.phaseLabel}>{phase.phase}</p>
              <h3>{phase.title}</h3>
              <p className={styles.phaseStatus}>{phase.statusIcon} {phase.status}</p>
            </div>
            <ul className={styles.phaseItems}>
              {phase.items.map((item) => (
                <li data-state={item.state} key={item.label}>
                  <span aria-hidden="true">{item.state === "done" ? "✓" : "○"}</span>
                  <span>{item.label}</span>
                  {item.status ? <small>{item.status}</small> : null}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function RoadmapPage() {
  const available = roadmapPhases.filter((phase) => phase.availability === "done");
  const upcoming = roadmapPhases.filter((phase) => phase.availability === "upcoming");
  const later = roadmapPhases.filter((phase) => phase.availability === "later");

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/">FanMind</Link>
        <nav aria-label="Roadmap Navigation">
          <Link href="/onboarding">Onboarding</Link>
          <Link href="/roadmap">Roadmap</Link>
        </nav>
      </header>

      <div className={styles.contentScroll}>
        <section className={styles.hero}>
          <p>Roadmap</p>
          <h1>Was ist verfügbar, was kommt später?</h1>
          <span>
            Dieselbe zentrale Roadmap steuert Landingpage, öffentliche Übersicht und Adminbereich. Nicht aktive Funktionen bleiben klar als Vorbereitung oder spätere Planung markiert.
          </span>
        </section>

        <div className={styles.grid}>
          <RoadmapColumn title="Verfügbar / Aktiv" phases={available} />
          <RoadmapColumn title="In Arbeit / Vorbereitung" phases={upcoming} />
          <RoadmapColumn title="Später / Roadmap" phases={later} />
        </div>

        <section className={styles.integrationNotice}>
          <h2>Integrationen</h2>
          <p>
            Creator Intelligence und die ausgewählte Facebook-/Instagram-/OnlyFans- sowie KI-Übergabearbeit sind jetzt in Arbeit. Jeder Creator erhält einen eigenen Account und Workspace; Android folgt danach. Weitere Phase-8-Kanäle sowie Teamzugänge und mehrere Workspaces bleiben später geplant. Direkte Plattformanbindungen benötigen weiterhin ihre technische und rechtliche Abnahme. Nachrichten werden nicht automatisch gesendet.
          </p>
        </section>

        <footer className={styles.siteFooter}>
          <strong>FanMind</strong>
          <p>KI-gestütztes Fan-CRM mit manuellem Copy-&-Open-Workflow · kontakt@fanmind.ch</p>
          <nav aria-label="Footer Navigation">
            <Link href="/impressum">Impressum</Link>
            <Link href="/datenschutz">Datenschutz</Link>
            <Link href="/agb">AGB</Link>
            <Link href="/zahlungsbedingungen">Zahlungsbedingungen</Link>
            <Link href="/roadmap">Roadmap</Link>
            <Link href="/login">Login</Link>
            <Link href="/register">Registrieren</Link>
          </nav>
        </footer>
      </div>
    </main>
  );
}
