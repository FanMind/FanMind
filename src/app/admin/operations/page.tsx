import { requirePlatformAdmin } from "@/lib/admin";
import {
  getOperationsOverviewData,
  runOperationsHealthChecks,
} from "@/lib/operations";
import { AdminBillingShell } from "../billing/AdminBillingShell";
import { AdminTabs } from "../billing/AdminTabs";
import { BackupJobActions } from "./BackupJobActions";
import { OperationsAutoRefresh } from "./OperationsAutoRefresh";
import { ServerErrorGroupsCard } from "./ServerErrorGroupsCard";
import styles from "../billing/adminBilling.module.css";

function badge(status: string) {
  if (
    ["healthy", "completed", "succeeded", "uploaded", "passed", "success"].includes(
      status,
    )
  ) {
    return styles.badgeOk;
  }
  if (
    [
      "degraded",
      "running",
      "warning",
      "queued",
      "claimed",
      "offsite_pending",
      "not_configured",
      "noop",
    ].includes(status)
  ) {
    return styles.badgeWarn;
  }
  if (["unavailable", "failed", "failure", "critical", "blocked"].includes(status)) {
    return styles.badgeBad;
  }
  return styles.badge;
}

function safeCommit() {
  return (
    process.env.FANMIND_RELEASE_COMMIT ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GITHUB_SHA ??
    "nicht gesetzt"
  );
}

function formatDate(value: unknown) {
  if (typeof value !== "string" || !value) return "Zeit offen";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Zeit offen"
    : date.toLocaleString("de-DE");
}

export default async function AdminOperationsPage() {
  const user = await requirePlatformAdmin();
  const [health, data] = await Promise.all([
    runOperationsHealthChecks(true),
    getOperationsOverviewData(),
  ]);
  const commit = safeCommit();
  const hasActiveJobs = (data.jobs.data ?? []).some((job) =>
    ["queued", "claimed", "running"].includes(String(job.status ?? "")),
  );

  return (
    <AdminBillingShell
      user={user}
      title="Operations Center"
      subtitle="Sichere Grundlage für Healthchecks, Admin-Meldungen und Backup-Transparenz."
    >
      <OperationsAutoRefresh enabled={hasActiveJobs} />
      <div className={styles.adminStack}>
        <AdminTabs activeTab="operations" />

        <section className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>Betriebsübersicht</span>
            <h1>Admin Operations Center</h1>
            <p>
              Keine Shell-Befehle, kein Restore und keine Production-Migration aus
              der Web-App. Diese Ansicht liest nur datenschutzsparsame Betriebsdaten.
            </p>
          </div>
          <span className={badge(health.status)}>{health.status}</span>
        </section>

        <section className={styles.kpiGrid}>
          {health.checks.map((check) => (
            <div className={styles.kpiCard} key={check.component}>
              <span>{check.component}</span>
              <strong>{check.status}</strong>
              <small>
                {check.publicMessage}
                {check.latencyMs ? ` · ${check.latencyMs} ms` : ""}
              </small>
            </div>
          ))}
          <div className={styles.kpiCard}>
            <span>Produktions-Commit</span>
            <strong>{commit.slice(0, 12)}</strong>
            <small>Sicher nur aus der Release-Umgebung ermittelt.</small>
          </div>
        </section>

        <section className={styles.operationsGrid}>
          <article className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <span className={styles.eyebrow}>Health</span>
                <h2>Letzte Health-Events</h2>
              </div>
            </div>
            {(data.healthEvents.data ?? []).length ? (
              (data.healthEvents.data ?? []).map((event) => (
                <p className={styles.statusItem} key={String(event.id)}>
                  <span>
                    {String(event.component ?? "system")}
                    <small>{formatDate(event.created_at ?? event.checked_at)}</small>
                  </span>
                  <span className={badge(String(event.status ?? "unknown"))}>
                    {String(event.status ?? "unknown")}
                  </span>
                </p>
              ))
            ) : (
              <p className={styles.emptyState}>
                {data.healthEvents.error ?? "Noch keine Health-Events gespeichert."}
              </p>
            )}
          </article>

          <article className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <span className={styles.eyebrow}>Meldungen</span>
                <h2>Letzte Benachrichtigungen</h2>
              </div>
            </div>
            {(data.notifications.data ?? []).length ? (
              (data.notifications.data ?? []).map((notification) => (
                <p className={styles.statusItem} key={notification.id}>
                  <span>
                    {notification.title}
                    <small>
                      {notification.message} · {formatDate(notification.created_at)}
                    </small>
                  </span>
                  <span className={badge(notification.severity)}>
                    {notification.severity}
                  </span>
                </p>
              ))
            ) : (
              <p className={styles.emptyState}>
                {data.notifications.error ?? "Keine Benachrichtigungen vorhanden."}
              </p>
            )}
          </article>

          <article className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <span className={styles.eyebrow}>Backups</span>
                <h2>Backupstatus</h2>
              </div>
            </div>
            {(data.backups.data ?? []).length ? (
              (data.backups.data ?? []).map((run) => (
                <p className={styles.statusItem} key={String(run.id)}>
                  <span>
                    {String(run.backup_type ?? "backup")}
                    <small>
                      {formatDate(run.started_at)} · Größe {String(run.size_bytes ?? "offen")}
                      {run.sha256 ? ` · SHA256 ${String(run.sha256).slice(0, 12)}…` : ""}
                      {run.offsite_status ? ` · Offsite ${String(run.offsite_status)}` : ""}
                    </small>
                  </span>
                  <span className={badge(String(run.status ?? "unknown"))}>
                    {String(run.status ?? "unknown")}
                  </span>
                </p>
              ))
            ) : (
              <p className={styles.emptyState}>
                {data.backups.error ??
                  "Backup-Worker vorbereitet; noch keine Läufe gespeichert."}
              </p>
            )}
            <BackupJobActions />
          </article>

          <article className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <span className={styles.eyebrow}>Jobs</span>
                <h2>Admin-Operationen</h2>
              </div>
            </div>
            {(data.jobs.data ?? []).length ? (
              (data.jobs.data ?? []).map((job) => (
                <p className={styles.statusItem} key={String(job.id)}>
                  <span>
                    {String(job.job_type ?? "operation")}
                    <small>
                      Worker {String(job.worker_id ?? "wartet")} · Lease{" "}
                      {String(job.lease_until ?? "-")} · Ergebnis{" "}
                      {String(job.result_reference ?? "-")}
                    </small>
                  </span>
                  <span className={badge(String(job.status ?? "unknown"))}>
                    {String(job.status ?? "unknown")}
                  </span>
                </p>
              ))
            ) : (
              <p className={styles.emptyState}>
                {data.jobs.error ?? "Keine Operation-Jobs gespeichert."}
              </p>
            )}
          </article>

          <ServerErrorGroupsCard result={data.serverErrors} />

          <article className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <span className={styles.eyebrow}>Audit</span>
                <h2>Letzte Admin-Aktionen</h2>
              </div>
            </div>
            {(data.audits.data ?? []).length ? (
              (data.audits.data ?? []).map((entry) => (
                <p className={styles.statusItem} key={String(entry.id)}>
                  <span>
                    {String(entry.action ?? "operation")}
                    <small>
                      {String(entry.actor_email ?? "System")} · {formatDate(entry.created_at)}
                    </small>
                  </span>
                  <span className={badge(String(entry.outcome ?? "unknown"))}>
                    {String(entry.outcome ?? "unknown")}
                  </span>
                </p>
              ))
            ) : (
              <p className={styles.emptyState}>
                {data.audits.error ?? "Noch keine Audit-Einträge gespeichert."}
              </p>
            )}
          </article>

          <article className={`${styles.card} ${styles.operationsWide}`}>
            <div className={styles.cardHeader}>
              <div>
                <span className={styles.eyebrow}>Konfiguration</span>
                <h2>Bekannte Zustände</h2>
              </div>
            </div>
            <div className={styles.statusList}>
              {health.checks.map((check) => (
                <div className={styles.statusItem} key={`cfg-${check.component}`}>
                  <span>{check.component}</span>
                  <span className={badge(check.status)}>{check.status}</span>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </AdminBillingShell>
  );
}
