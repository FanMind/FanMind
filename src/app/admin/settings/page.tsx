import { requirePlatformAdmin } from "@/lib/admin";
import { getPublicDailyTestPlanEnabled } from "@/lib/runtimeProductSettings";

export const dynamic = "force-dynamic";
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
  const visible = await getPublicDailyTestPlanEnabled();
  const enabled = visible && termsReady && provisioningReady && stripeReady;
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
            {result === "enabled" ? "Daily-Angebot eingeschaltet." : result === "disabled" ? "Daily-Angebot auf der gesamten öffentlichen Website ausgeblendet." : "Einstellung bitte prüfen."}
          </p>
        ) : null}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <span className={styles.eyebrow}>Öffentlicher Tagestarif</span>
              <h2>Daily · 0 € Setup + 1 €/Tag</h2>
              <p className={styles.cardSubtitle}>
                Schaltet das Daily-Angebot auf Landingpage, Registrierung, Paketwahl und öffentlichen Angebotsbedingungen ein oder aus. Die Einstellung bleibt bis zu deiner nächsten Änderung bestehen, auch länger als 14 Tage.
              </p>
            </div>
            <span className={enabled ? styles.badgeOk : styles.badgeWarn}>
              {!visible ? "Angebot ausgeschaltet" : enabled ? "Angebot an · Aktivierung bereit" : "Angebot an · Aktivierung ausstehend"}
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
          <form action="/api/admin/settings/daily-test-plan" method="post">
            <input type="hidden" name="enabled" value={visible ? "false" : "true"} />
            <button type="submit" className={visible ? styles.buttonDanger : styles.buttonPrimary}>
              {visible ? "Daily-Angebot ausschalten" : "Daily-Angebot einschalten"}
            </button>
          </form>
          <p className={styles.muted}>
            Aus blendet das Angebot überall öffentlich aus und sperrt neue Daily-Aktivierungen.
            Bestehende Abos, Testerzugänge, Rechnungen und Kündigungen bleiben unverändert.
            Einschalten ersetzt nicht die separat angezeigte technische Zahlungsfreigabe.
          </p>
        </section>
      </main>
    </AdminBillingShell>
  );
}
