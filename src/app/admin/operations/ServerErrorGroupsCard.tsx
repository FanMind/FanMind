import type { getRecentServerErrorGroups } from "@/lib/operations";
import styles from "../billing/adminBilling.module.css";

type ErrorGroupsResult = Awaited<ReturnType<typeof getRecentServerErrorGroups>>;

function tone(status: string, severity: string | null) {
  if (severity === "critical") return styles.badgeBad;
  if (status === "open" || severity === "warning") return styles.badgeWarn;
  if (status === "resolved") return styles.badgeOk;
  return styles.badge;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Zeit offen" : date.toLocaleString("de-DE");
}

export function ServerErrorGroupsCard({ result }: { result: ErrorGroupsResult }) {
  const groups = result.data ?? [];
  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <span className={styles.eyebrow}>Fehlertracking</span>
          <h2>Serverfehler-Gruppen</h2>
        </div>
      </div>
      {groups.length ? (
        groups.map((group) => (
          <p className={styles.statusItem} key={group.fingerprint}>
            <span>
              {group.http_method} {group.route_path}
              <small>
                Referenz {group.fingerprint.slice(0, 12)} · {group.route_type} · {group.occurrence_count} Vorkommen · zuletzt {formatDate(group.last_seen_at)}
                {group.latest_release_commit ? ` · Release ${group.latest_release_commit.slice(0, 12)}` : ""}
              </small>
            </span>
            <span className={tone(group.status, group.last_notified_severity)}>
              {group.last_notified_severity ?? group.status}
            </span>
          </p>
        ))
      ) : (
        <p className={styles.emptyState}>
          {result.error ?? "Noch keine datensparsamen Serverfehler-Gruppen gespeichert."}
        </p>
      )}
    </article>
  );
}
