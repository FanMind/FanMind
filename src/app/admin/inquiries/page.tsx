import { requirePlatformAdmin } from "@/lib/admin";
import { getInquiryNotificationConfigStatus } from "@/lib/inquiryNotifications";
import { listPilotInquiries, type InquiryStatus } from "@/lib/inquiries";
import { AdminBillingShell } from "../billing/AdminBillingShell";
import { AdminTabs } from "../billing/AdminTabs";
import styles from "./adminInquiries.module.css";

const statusLabels: Record<InquiryStatus, string> = {
  new: "Neu",
  contacted: "Kontaktiert",
  archived: "Archiviert",
};

function date(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function StatusAction({ id, status, label }: { id: string; status: InquiryStatus; label: string }) {
  return (
    <form action={`/api/admin/inquiries/${id}/status`} method="post">
      <input type="hidden" name="status" value={status} />
      <button type="submit">{label}</button>
    </form>
  );
}

export default async function AdminInquiriesPage() {
  const user = await requirePlatformAdmin();
  const { inquiries, error } = await listPilotInquiries();
  const newCount = inquiries.filter((inquiry) => inquiry.status === "new").length;

  return (
    <AdminBillingShell
      user={user}
      title="Admin-Anfragen"
      subtitle="Pilot- und Kontaktanfragen aus dem Landingpage-Footer prüfen und nachverfolgen."
    >
      <div className={styles.stack}>
        <AdminTabs activeTab="inquiries" />

        <section className={styles.heroCard}>
          <div>
            <span className={styles.eyebrow}>Pilot-Anfragen</span>
            <h1>{newCount} neue Anfrage{newCount === 1 ? "" : "n"}</h1>
            <p>Anfragen werden serverseitig gespeichert. Es gibt keine automatische Newsletter-Anmeldung, keine Antwort-Automation und keine externe Integration.</p>
          </div>
          <span className={styles.configBadge}>{getInquiryNotificationConfigStatus()}</span>
        </section>

        {error ? <div className={styles.errorBox}>{error}</div> : null}

        <section className={styles.card}>
          <div className={styles.tableHead}>
            <span>Kontakt</span>
            <span>Nachricht / Use Case</span>
            <span>Quelle</span>
            <span>Status</span>
            <span>Datum</span>
            <span>Aktionen</span>
          </div>
          {inquiries.length ? inquiries.map((inquiry) => (
            <article className={styles.tableRow} key={inquiry.id}>
              <div>
                <strong>{inquiry.email}</strong>
                <small>{inquiry.name || "Name nicht angegeben"}</small>
              </div>
              <p>{inquiry.message || "Keine Nachricht angegeben."}</p>
              <span>{inquiry.source}</span>
              <span className={styles.statusBadge} data-status={inquiry.status}>{statusLabels[inquiry.status]}</span>
              <time>{date(inquiry.created_at)}</time>
              <div className={styles.actions}>
                {inquiry.status !== "contacted" ? <StatusAction id={inquiry.id} status="contacted" label="Als kontaktiert markieren" /> : null}
                {inquiry.status !== "archived" ? <StatusAction id={inquiry.id} status="archived" label="Archivieren" /> : null}
                {inquiry.status !== "new" ? <StatusAction id={inquiry.id} status="new" label="Wieder auf neu" /> : null}
              </div>
            </article>
          )) : <div className={styles.emptyState}>Noch keine Anfragen gespeichert.</div>}
        </section>
      </div>
    </AdminBillingShell>
  );
}
