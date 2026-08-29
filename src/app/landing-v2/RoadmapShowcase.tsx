"use client";

import { ComingSoonMark } from "@/components/ComingSoonMark";
import styles from "./landing-v2.module.css";
import fitStyles from "./roadmap-card-fit.module.css";

type RoadmapPhase = {
  number: string;
  phase: string;
  icon: string;
  title: string;
  status: string;
  statusIcon: string;
  tone: string;
  availability: "done" | "upcoming" | "later";
  items: Array<{ label: string; state: string; status?: string }>;
};

function RoadmapLineIcon({ icon }: { icon: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2.4,
  };

  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      {icon === "rocket" && (
        <>
          <path {...common} d="M14 46c6-1 12-5 16-10" />
          <path {...common} d="M24 42 14 54l12-4" />
          <path {...common} d="M23 31 13 29l8-8 10 2" />
          <path {...common} d="M33 41l2 10 8-8-2-10" />
          <path {...common} d="M24 40c-4-4-4-12 0-16 7-7 20-11 32-10-1 12-5 25-12 32-4 4-12 4-16 0Z" />
          <circle {...common} cx="42" cy="28" r="5" />
        </>
      )}
      {icon === "upload" && (
        <>
          <path {...common} d="M20 43h-3a10 10 0 0 1 0-20 15 15 0 0 1 28-3 11 11 0 0 1 3 22h-4" />
          <path {...common} d="M32 50V28" />
          <path {...common} d="M22 38 32 28l10 10" />
        </>
      )}
      {icon === "campaign" && (
        <>
          <path {...common} d="M35 22 52 14v30l-17-8Z" />
          <path {...common} d="M18 26h17v12H18a6 6 0 0 1 0-12Z" />
          <path {...common} d="M24 38l5 12h9l-6-12" />
          <circle {...common} cx="14" cy="18" r="4" />
          <circle {...common} cx="25" cy="15" r="3" />
        </>
      )}
      {icon === "analytics" && (
        <>
          <path {...common} d="M14 46h38" />
          <path {...common} d="M18 38V26h8v12" />
          <path {...common} d="M30 38V18h8v20" />
          <path {...common} d="M42 38V12h8v26" />
          <path {...common} d="M18 52c2-5 8-8 14-8s12 3 14 8" />
          <circle {...common} cx="22" cy="44" r="4" />
          <circle {...common} cx="32" cy="43" r="4" />
          <circle {...common} cx="42" cy="44" r="4" />
        </>
      )}
      {icon === "integrations" && (
        <>
          <circle {...common} cx="32" cy="32" r="5" />
          <circle {...common} cx="32" cy="12" r="5" />
          <circle {...common} cx="49" cy="42" r="5" />
          <circle {...common} cx="15" cy="42" r="5" />
          <circle {...common} cx="16" cy="22" r="3" />
          <circle {...common} cx="48" cy="22" r="3" />
          <path {...common} d="M32 17v10M36 35l9 5M28 35l-9 5M19 23l8 6M45 23l-8 6" />
        </>
      )}
    </svg>
  );
}

export default function RoadmapShowcase({ phases, ariaLabel }: { phases: RoadmapPhase[]; ariaLabel: string }) {
  function scrollToPhase(number: string) {
    document.getElementById(`roadmap-phase-${number}`)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "nearest",
      inline: "center",
    });
  }

  return (
    <>
      <div className={styles.roadmapTimeline} aria-label={ariaLabel}>
        {phases.map((phase) => (
          <button
            className={styles.roadmapTimelineNode}
            data-tone={phase.tone}
            data-done={phase.availability === "done" ? "true" : undefined}
            key={phase.number}
            type="button"
            onClick={() => scrollToPhase(phase.number)}
            aria-label={`${phase.number}: ${phase.phase} ${phase.title}`}
          >
            <strong>{phase.number}</strong>
            {phase.availability === "done" ? <span className={styles.roadmapDoneCheck} aria-hidden="true">✓</span> : null}
            <i aria-hidden="true" />
          </button>
        ))}
      </div>

      <div className={styles.roadmapMarquee} aria-label={ariaLabel}>
        <div className={styles.roadmapGrid}>
          {phases.map((phase) => {
            const contentFitPhase = ["05", "06", "07", "08"].includes(phase.number);

            return (
              <article
                className={`${styles.roadmapCard} ${phase.availability === "done" ? "" : styles.cardWithComingSoon} ${contentFitPhase ? fitStyles.contentFitCard : ""}`}
                data-tone={phase.tone}
                key={phase.phase}
                id={`roadmap-phase-${phase.number}`}
                tabIndex={-1}
              >
                <div className={styles.roadmapPhasePill}>{phase.phase}</div>
                <div className={styles.roadmapIcon}>
                  <RoadmapLineIcon icon={phase.icon} />
                </div>
                <h3 className={contentFitPhase ? fitStyles.contentFitTitle : undefined}>{phase.title}</h3>
                <div className={`${styles.roadmapStatus} ${contentFitPhase ? fitStyles.contentFitStatus : ""}`}>
                  <span>{phase.statusIcon}</span> {phase.status}
                </div>
                <ul>
                  {phase.items.map((item) => (
                    <li
                      className={contentFitPhase ? fitStyles.contentFitItem : undefined}
                      data-state={item.state}
                      key={item.label}
                    >
                      <span className={contentFitPhase ? fitStyles.contentFitItemLabel : undefined}>{item.label}</span>
                      {item.status ? (
                        <em className={contentFitPhase ? fitStyles.contentFitItemStatus : undefined}>{item.status}</em>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {phase.availability === "done" ? null : <ComingSoonMark size="medium" className={styles.comingSoonImage} />}
              </article>
            );
          })}
        </div>
      </div>
    </>
  );
}
