import { requirePlatformAdmin } from "@/lib/admin";
import { calculateReferralDiscount, getAdminReferralOverview, type ReferralStatus } from "@/lib/adminReferrals";
import { AdminBillingShell } from "../billing/AdminBillingShell";
import { AdminTabs } from "../billing/AdminTabs";
import { updateReferralStatusAction } from "./actions";
import styles from "../billing/adminBilling.module.css";

function date(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
}

function money(cents: number | null | undefined) {
  return typeof cents === "number" ? new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100) : "—";
}

function statusClass(status: string) {
  if (status === "open" || status === "reopened" || status === "active" || status === "qualified") return styles.badgeOk;
  if (status === "closing" || status === "pending" || status === "locked_after_window_closed") return styles.badgeWarn;
  if (status === "closed" || status === "inactive" || status === "rejected") return styles.badgeBad;
  return styles.badge;
}

function countStatus(rows: Array<{ status: ReferralStatus }>, status: ReferralStatus) {
  return rows.filter((row) => row.status === status).length;
}

export default async function AdminReferralsPage() {
  const user = await requirePlatformAdmin();
  const { state, members, referrals, snapshots, workspaces, activeReferralCounts, error } = await getAdminReferralOverview();
  const activeReferrals = countStatus(referrals, "active");
  const effectiveCap = state?.active_paid_workspace_cap ?? 2000;
  const activePaidWorkspaceCount = state?.active_paid_workspace_count ?? state?.active_paid_workspace_count_snapshot ?? 0;
  const capProgress = Math.min(100, Math.round((activePaidWorkspaceCount / effectiveCap) * 100));

  return (
    <AdminBillingShell user={user} title="Referral Admin" subtitle="Admin-only Grundlage für das Referral Growth Window. Keine automatische Billing-Verrechnung ist aktiv.">
      <div className={styles.adminStack}>
        <AdminTabs activeTab="referrals" />

        <section className={styles.referralAdminHero}>
          <div>
            <span className={styles.eyebrow}>Issue #461 · Phase 2</span>
            <h1>Referral Growth Window vorbereiten</h1>
            <p>Referral-Link, Signup-Attribution, Statusprüfung und Admin-Korrektur sind vorbereitet. Jede Billing-Verrechnung bleibt bewusst ein separater geprüfter Schritt.</p>
          </div>
          <span className={statusClass(state?.status ?? "pending")}>{state?.status ?? "Migration fehlt"}</span>
        </section>

        {error ? <div className={styles.emptyState}>{error}</div> : null}

        <section className={styles.referralKpiGrid} aria-label="Referral Kennzahlen">
          <article className={styles.kpiCard}><span>Programmstatus</span><strong>{state?.status ?? "—"}</strong></article>
          <article className={styles.kpiCard}><span>active_paid_workspace_count</span><strong>{activePaidWorkspaceCount} / {effectiveCap}</strong></article>
          <article className={styles.kpiCard}><span>Cap-Fortschritt</span><strong>{capProgress}%</strong></article>
          <article className={styles.kpiCard}><span>Aktive Referrals</span><strong>{activeReferrals}</strong></article>
        </section>

        <section className={styles.referralDetailGrid}>
          <dl className={styles.field}><dt>Globale Cap-Größe</dt><dd>active_paid_workspace_count</dd></dl>
          <dl className={styles.field}><dt>Cap-Regel</dt><dd>Schließen bei {effectiveCap} aktiven zahlenden Workspaces</dd></dl>
          <dl className={styles.field}><dt>Letztes Status-Update</dt><dd>{date(state?.updated_at)}</dd></dl>
          <dl className={styles.field}><dt>AGB/Zahlungsbedingungen</dt><dd>Separater Schritt vor Aktivierung</dd></dl>
        </section>

        <section className={`${styles.card} ${styles.referralAdminCard}`}>
          <div className={styles.cardHeader}><div><span className={styles.eyebrow}>Referrer</span><h2>Mitglieder, Rabattberechnung &amp; Overrides</h2></div><span className={styles.badge}>{members.length} Einträge</span></div>
          {members.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Workspace</th><th>Code</th><th>Status</th><th>Aktive Referrals</th><th>Rabatt</th><th>Override</th><th>Notiz</th></tr></thead><tbody>{members.map((member) => {
            const workspace = workspaces.get(member.workspace_id);
            const activeCount = member.override_active_referral_count ?? activeReferralCounts.get(member.workspace_id) ?? 0;
            const discount = calculateReferralDiscount(activeCount, member.override_discount_percent);
            return <tr key={member.id}><td><strong>{workspace?.name ?? member.workspace_id}</strong><span className={styles.subline}>{workspace?.plan_id ?? "Plan offen"} · {workspace?.billing_status ?? "Billing offen"}</span></td><td>{member.referral_code}</td><td><span className={statusClass(member.status)}>{member.status}</span></td><td>{activeCount} / 20</td><td>{discount}%<span className={styles.subline}>laufende Kosten; nicht angewendet</span></td><td>{member.override_discount_percent !== null || member.override_active_referral_count !== null ? member.override_reason ?? "Override aktiv" : "—"}</td><td>{member.admin_note ?? "—"}</td></tr>;
          })}</tbody></table></div> : <div className={styles.emptyState}>Noch keine Referral-Mitglieder. Admin kann sie nach Migration serverseitig anlegen; öffentliche Teilnahme ist noch nicht aktiv.</div>}
        </section>

        <section className={`${styles.card} ${styles.referralAdminCard}`}>
          <div className={styles.cardHeader}><div><span className={styles.eyebrow}>Referrals</span><h2>Attributionen &amp; Status</h2></div><span className={styles.badge}>{referrals.length} Einträge</span></div>
          <div className={styles.statusList}>{(["pending","qualified","active","inactive","rejected","locked_after_window_closed"] as ReferralStatus[]).map((status) => <div className={styles.statusItem} key={status}><span>{status}</span><strong>{countStatus(referrals, status)}</strong></div>)}</div>
          {referrals.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Code</th><th>Referrer</th><th>Geworbener Workspace</th><th>Status</th><th>Programmphase</th><th>Billing Snapshot</th><th>Zeitpunkt</th><th>Korrektur</th></tr></thead><tbody>{referrals.map((referral) => <tr key={referral.id}><td>{referral.referral_code}</td><td>{workspaces.get(referral.referrer_workspace_id)?.name ?? referral.referrer_workspace_id}</td><td>{referral.referred_workspace_id ? workspaces.get(referral.referred_workspace_id)?.name ?? referral.referred_workspace_id : "—"}</td><td><span className={statusClass(referral.status)}>{referral.status}</span></td><td>{referral.created_during_program_status}</td><td>{referral.billing_status_snapshot ?? "—"}</td><td>{date(referral.first_seen_at)}</td><td><form action={updateReferralStatusAction} className={styles.inlineForm}><input type="hidden" name="id" value={referral.id} /><select name="status" defaultValue={referral.status}>{(["pending","qualified","active","inactive","rejected","locked_after_window_closed"] as ReferralStatus[]).map((status) => <option key={status} value={status}>{status}</option>)}</select><input name="adminNote" defaultValue={referral.admin_note ?? ""} placeholder="Admin-Notiz" /><button type="submit">Speichern</button></form></td></tr>)}</tbody></table></div> : null}
        </section>

        <section className={`${styles.card} ${styles.referralAdminCard}`}>
          <div className={styles.cardHeader}><div><span className={styles.eyebrow}>Snapshots</span><h2>Rabatt-Snapshots vorbereitet</h2></div><span className={styles.badge}>Keine Billing-Automatik</span></div>
          {snapshots.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Workspace</th><th>Aktive Referrals</th><th>Rabatt</th><th>Vorher</th><th>Nachher</th><th>Status</th><th>Berechnet</th></tr></thead><tbody>{snapshots.map((snapshot) => <tr key={snapshot.id}><td>{workspaces.get(snapshot.workspace_id)?.name ?? snapshot.workspace_id}</td><td>{snapshot.active_referral_count}</td><td>{snapshot.discount_percent}%</td><td>{money(snapshot.monthly_fee_cents_before_discount)}</td><td>{money(snapshot.monthly_fee_cents_after_discount)}</td><td>{snapshot.program_status_snapshot}</td><td>{date(snapshot.calculated_at)}</td></tr>)}</tbody></table></div> : <div className={styles.emptyState}>Snapshots sind als Datenmodell vorbereitet. Sie werden erst nach separater Signup-/Checkout-Attribution und Admin-Prüfung erzeugt.</div>}
        </section>
      </div>
    </AdminBillingShell>
  );
}
