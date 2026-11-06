import type { FanMindLanguage } from "@/lib/fanmindCopy";
import { wt } from "@/lib/workspaceCopy";
import Image from "next/image";
import styles from "../app/dashboard/dashboard.module.css";
import type { FollowupCompletionRate } from "@/lib/workspaceKpiStats";

type KpiIconName =
  | "users"
  | "pulse"
  | "check"
  | "megaphone"
  | "refresh"
  | "percent";

type KpiTone = "blue" | "green" | "violet" | "orange" | "cyan";

type KpiCardData = {
  label: string;
  value: string;
  meta: string;
  icon: KpiIconName;
  tone: KpiTone;
  sparklinePoints: string;
  infoLabel: string;
  comingSoon?: boolean;
};

type WorkspaceKpiStripProps = {
  contactCount: number;
  openFollowupCount?: number;
  locale?: FanMindLanguage;
  followupCompletionRate?: FollowupCompletionRate | null;
};

function getKpiCards(
  contactCount: number,
  openFollowupCount: number,
  locale: FanMindLanguage,
  followupCompletionRate?: FollowupCompletionRate | null,
): KpiCardData[] {
  return [
    {
      label: wt(locale, "Gesamtfans"),
      value: contactCount.toLocaleString("de-DE"),
      meta: wt(locale, "Echte Kontakte im Workspace"),
      icon: "users",
      tone: "blue",
      sparklinePoints: "M2 13 C16 12 25 11 38 11.5 S61 12 74 10 S96 8.5 124 5",
      infoLabel:
        "Anzahl gespeicherter Kontakte im aktuellen Workspace.",
    },
    {
      label: wt(locale, "Aktive Fans"),
      value: "0",
      meta: wt(locale, "Aktivitätslogik noch nicht aktiv"),
      icon: "pulse",
      tone: "green",
      sparklinePoints:
        "M2 13 C13 12.5 21 11 31 11.5 S47 12.5 56 9.5 S72 6.5 82 7.5 S97 10.5 107 6.5 S118 5 124 4",
      infoLabel:
        "Kontakte mit aktueller Aktivität im ausgewählten Zeitraum.",
    },
    {
      label: wt(locale, "Offene Follow-ups"),
      value: openFollowupCount.toLocaleString("de-DE"),
      meta: wt(locale, "Rückmeldungen / Aufgaben"),
      icon: "check",
      tone: "violet",
      sparklinePoints:
        "M2 12.5 C13 11 21 11.5 31 9.5 S47 7 57 9 S72 12.5 83 9.5 S98 5.5 108 6.5 S118 7.5 124 4.5",
      infoLabel:
        "Offene Rückmelde-Aufgaben zu Fans oder Kontakten.",
    },
    {
      label: wt(locale, "Laufende Kampagnen"),
      value: "0",
      meta: wt(locale, "Kampagnen nicht aktiv"),
      icon: "megaphone",
      tone: "blue",
      sparklinePoints:
        "M2 13 C14 12.5 22 10.5 32 11 S48 12.5 58 9.5 S73 7.5 83 9 S98 10.5 108 7 S119 5 124 4.5",
      infoLabel:
        "Kampagnenfunktion vorbereitet, aktuell noch nicht aktiv.",
      comingSoon: true,
    },
    {
      label: wt(locale, "Reaktivierung"),
      value: "0",
      meta: wt(locale, "Reaktivierung noch nicht aktiv"),
      icon: "refresh",
      tone: "orange",
      sparklinePoints:
        "M2 13.5 C12 12.5 20 8 31 9 S47 13 57 8.5 S72 6 82 8 S97 11.5 107 7 S118 5.5 124 4.25",
      infoLabel:
        "Kontakte, die später gezielt wieder angesprochen werden können.",
      comingSoon: true,
    },
    {
      label: wt(locale, "Follow-up-Abschlussquote"),
      value: followupCompletionRate
        ? `${followupCompletionRate.percentage} %`
        : wt(locale, "Nicht verfügbar"),
      meta: followupCompletionRate
        ? wt(locale, "Alle Zeiten · erledigt / gesamt")
        : wt(locale, "Noch keine auswertbaren Follow-ups"),
      icon: "percent",
      tone: "cyan",
      sparklinePoints:
        "M2 12.5 C14 12 22 11.5 32 12 S48 13 58 11 S73 9 83 9.5 S98 10 108 7.5 S119 6 124 4.75",
      infoLabel:
        "All-time-Anteil erledigter Follow-ups: completed und historisches done geteilt durch open, completed und done im aktuellen Workspace. Keine Conversion- oder Umsatzkennzahl.",
    },
  ];
}

function ComingSoonImage({
  size = "medium",
}: {
  size?: "small" | "medium" | "large";
}) {
  return (
    <Image
      src="/assets/coming-soon-badge.png"
      alt="Coming Soon"
      width={1536}
      height={1024}
      className={`${styles.comingSoonImage} ${styles[`comingSoon-${size}`]}`}
    />
  );
}

function KpiIcon({ icon }: { icon: KpiIconName }) {
  const iconPaths: Record<KpiIconName, string[]> = {
    users: [
      "M8.5 11.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z",
      "M3.5 19a5 5 0 0 1 10 0",
      "M16.25 10.5a2.75 2.75 0 1 0 0-5.5",
      "M15.25 14.25A4.5 4.5 0 0 1 20.5 19",
    ],
    pulse: [
      "M3.5 12h3.25l2-5.5 4.25 11 2.25-7H20.5",
      "M4.75 18.75a9 9 0 1 1 14.5-10.5",
    ],
    check: [
      "M8 12.25 10.65 15 16.25 8.75",
      "M12 3.75a8.25 8.25 0 1 0 0 16.5 8.25 8.25 0 0 0 0-16.5Z",
    ],
    megaphone: [
      "M4.25 13.25h3l8.25 4.5V6.25l-8.25 4.5h-3v2.5Z",
      "M7.25 13.25 8.75 19",
      "M17.5 9.25a3.25 3.25 0 0 1 0 5.5",
      "M19.5 6.75a6.75 6.75 0 0 1 0 10.5",
    ],
    refresh: [
      "M5.5 8.5A7 7 0 0 1 17.75 6L20 8.25",
      "M18.5 15.5A7 7 0 0 1 6.25 18L4 15.75",
      "M17.75 6v4.25H13.5",
      "M6.25 18v-4.25H10.5",
    ],
    percent: [
      "M6.75 17.25 17.25 6.75",
      "M7.75 9.25a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5Z",
      "M16.25 18.25a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5Z",
    ],
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      {iconPaths[icon].map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

function KpiCard({
  label,
  value,
  meta,
  tone,
  icon,
  sparklinePoints,
  infoLabel,
  comingSoon = false,
}: KpiCardData) {
  const toneClass = `tone-${tone}`;
  const cardClassName = `${styles.kpiCard} ${styles[toneClass]} ${comingSoon ? styles.kpiCardComingSoon : ""}`;

  return (
    <article className={cardClassName}>
      <div className={styles.kpiIcon}>
        <KpiIcon icon={icon} />
      </div>
      <button
        type="button"
        className={styles.kpiInfo}
        aria-label={infoLabel}
      >
        i
        <span className={styles.kpiInfoTooltip} role="tooltip">
          {infoLabel}
        </span>
      </button>
      <div className={styles.kpiTextBlock}>
        <p className={styles.kpiLabel}>{label}</p>
        <p className={styles.kpiValue}>{value}</p>
        <p className={styles.kpiMeta}>{meta}</p>
      </div>
      <svg
        className={styles.kpiSparkline}
        aria-hidden="true"
        viewBox="0 0 126 14"
        preserveAspectRatio="none"
      >
        <path d={sparklinePoints} />
      </svg>
      {comingSoon ? <ComingSoonImage size="small" /> : null}
    </article>
  );
}

export function WorkspaceKpiStrip({
  contactCount,
  openFollowupCount = 0,
  locale = "de",
  followupCompletionRate,
}: WorkspaceKpiStripProps) {
  const kpiCards = getKpiCards(
    contactCount,
    openFollowupCount,
    locale,
    followupCompletionRate,
  );

  return (
    <section className={styles.kpiGrid} aria-label="KPI-Karten">
      {kpiCards.map((card) => (
        <KpiCard key={card.label} {...card} />
      ))}
    </section>
  );
}
