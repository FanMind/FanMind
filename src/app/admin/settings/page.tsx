import { requirePlatformAdmin } from "@/lib/admin";
import { PUBLIC_DAILY_PLAN_ENABLED } from "@/lib/publicDailyPlanPolicy.mjs";
import { isPaymentTermsActivationEnabled } from "@/lib/paymentTermsActivationPolicy.mjs";
import { isInternalDailyTestWorkspaceProvisioningReady } from "@/lib/supabase/server";
import { getStripeConfigStatus } from "@/lib/stripeBilling";
import { isInternalDailyTestStripeReady } from "@/lib/internalDailyTestReadinessPolicy.mjs";
import { AdminBillingShell } from "@/app/admin/billing/AdminBillingShell";
import { AdminTabs } from "@/app/admin/billing/AdminTabs";
import styles from "@/app/admin/billing/adminBilling.module.css";

type AdminSettingsPageProps = {
  searchParams: Promise<{ daily_test_plan?: string | string[] }>;
};

export default async function AdminSettingsPage({ searchParams }: AdminSettingsPageProps) {
  const user = await requirePlatformAdmin();
  const provisioningReady = await isInternalDailyTestWorkspaceProvisioningReady();
  const termsReady = isPaymentTermsActivationEnabled();
  const stripeReady = isInternalDailyTestStripeReady(getStripeConfigStatus());
  const enabled = PUBLIC_DAILY_PLAN_ENABLED && termsReady && provisioningReady && stripeReady;
  const params = await searchParams;
  const result = Array.isArray(params.daily_test_plan)
    ? params.daily_test_plan[0]
    : params.daily_test_plan;

  return (
    <AdminBillingShell
      user={user}
      title="Produktfreigaben"
      subtitle="Öffentliche Tarife und technische Aktivierung prüfen"
    >
      <main className={styles.adminStack}>
        <AdminTabs activeTab="settings" />
        {result ? (
          <p className={result === "enabled" ? styles.badgeOk : styles.badgeWarn}>
            {result === "not_ready"
              ? "Freigabe blockiert: Daily-Provisioning oder Stripe-/Webhook-Konfiguration ist noch nicht vollständig bereit."
              : "Die frühere Beta-Freigabe ändert das dauerhafte Daily-Angebot nicht."}
          </p>
        ) : null}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <span className={styles.eyebrow}>Öffentlicher Tagestarif</span>
              <h2>Daily · 0 € Setup + 1 €/Tag</h2>
              <p className={styles.cardSubtitle}>
                Daily ist dauerhaft in der öffentlichen Tarifauswahl. Die kostenpflichtige Aktivierung setzt alle technischen und vertraglichen Voraussetzungen voraus.
              </p>
            </div>
            <span className={enabled ? styles.badgeOk : styles.badgeWarn}>
              {enabled ? "Aktivierung bereit" : "Registrierung offen · Aktivierung ausstehend"}
            </span>
          </div>
          <div className={styles.statusList}>
            <div className={styles.statusItem}>
              <span>Preis</span><strong>1 € pro Tag</strong>
            </div>
            <div className={styles.statusItem}>
              <span>Kündigung</span><strong>Täglich möglich</strong>
            </div>
            <div className={styles.statusItem}>
              <span>Referral</span><strong>Ausgeschlossen</strong>
            </div>
            <div className={styles.statusItem}>
              <span>Sichere Registrierung</span><strong>{provisioningReady ? "Bereit" : "Rollout ausstehend"}</strong>
            </div>
            <div className={styles.statusItem}>
              <span>Stripe &amp; Webhook</span><strong>{stripeReady ? "Bereit" : "Konfiguration unvollständig"}</strong>
            </div>
          </div>
          <div className={styles.statusItem}>
            <span>Zahlungsbedingungen</span><strong>{termsReady ? "Freigegeben" : "Vertragsversion offen"}</strong>
          </div>
          <p className={styles.muted}>
            Der frühere 24-Stunden-Beta-Schalter steuert diesen öffentlichen Tarif nicht mehr.
            Bestehende Abos und Workspaces werden durch die Katalogfreigabe nicht verändert.
          </p>
        </section>
      </main>
    </AdminBillingShell>
  );
}
