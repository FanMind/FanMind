import { requirePlatformAdmin } from "@/lib/admin";
import { getPublicDailyPlanState } from "@/lib/runtimeProductSettings";
import { isPaymentTermsActivationEnabled } from "@/lib/paymentTermsActivationPolicy.mjs";
import { isInternalDailyTestWorkspaceProvisioningReady } from "@/lib/supabase/server";
import { getStripeConfigStatus } from "@/lib/stripeBilling";
import { isInternalDailyTestStripeReady } from "@/lib/internalDailyTestReadinessPolicy.mjs";
import { AdminBillingShell } from "@/app/admin/billing/AdminBillingShell";
import { AdminTabs } from "@/app/admin/billing/AdminTabs";
import styles from "@/app/admin/billing/adminBilling.module.css";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ daily_test_plan?: string | string[] }> }) {
  const user = await requirePlatformAdmin();
  const [visibility, provisioningReady] = await Promise.all([getPublicDailyPlanState(), isInternalDailyTestWorkspaceProvisioningReady()]);
  const termsReady = isPaymentTermsActivationEnabled();
  const stripeReady = isInternalDailyTestStripeReady(getStripeConfigStatus());
  const activationReady = termsReady && provisioningReady && stripeReady;
  const params = await searchParams;
  const result = Array.isArray(params.daily_test_plan) ? params.daily_test_plan[0] : params.daily_test_plan;
  return <AdminBillingShell user={user} title="Produktfreigaben" subtitle="Tarife auf der gesamten Website ein- und ausschalten">
    <main className={styles.adminStack}>
      <AdminTabs activeTab="settings" />
      {["enabled", "disabled"].includes(result ?? "") && <p role="status" className={styles.badgeOk}>Einstellung gespeichert. Der aktuelle Zustand steht beim Schalter.</p>}
      {!visibility.available && <p role="alert" className={styles.badgeWarn}>Die Einstellung kann gerade nicht gelesen werden. Das Angebot bleibt vorsichtshalber ausgeblendet.</p>}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div><span className={styles.eyebrow}>Öffentlicher Tagestarif</span><h2>Daily · 0 € Setup + 1 €/Tag</h2><p className={styles.cardSubtitle}>Ein Schalter für Landingpage, Registrierung, Paketwahl und neue Buchungen. Die Einstellung bleibt bis zur nächsten Änderung gespeichert, ohne 24-Stunden-Ablauf.</p></div>
          <span className={visibility.enabled ? styles.badgeOk : styles.badgeWarn}>{visibility.enabled ? "Angebot sichtbar" : "Angebot ausgeblendet"}</span>
        </div>
        <form method="post" action="/api/admin/settings/daily-test-plan">
          <input type="hidden" name="enabled" value={String(!visibility.enabled)} />
          <button type="submit" role="switch" aria-checked={visibility.enabled} aria-label="Daily-Angebot auf der Website" disabled={!visibility.available}>
            {visibility.enabled ? "Daily ausschalten" : "Daily einschalten"}
          </button>
        </form>
        <p className={styles.muted}>Ausblenden beendet keine bestehenden Abos. Bereits freigeschaltete Tester behalten ihren Zugang; Vertragsdaten, Rechnungen und Kündigung bleiben erreichbar.</p>
        <div className={styles.statusList}>
          <div className={styles.statusItem}><span>Preis</span><strong>1 € pro Tag · 0 € Setup</strong></div>
          <div className={styles.statusItem}><span>Kündigung</span><strong>Täglich möglich · kein Referral-Rabatt</strong></div>
          <div className={styles.statusItem}><span>Workspace-Erstellung</span><strong>{provisioningReady ? "Bereit" : "Rollout ausstehend"}</strong></div>
          <div className={styles.statusItem}><span>Stripe &amp; Webhook</span><strong>{stripeReady ? "Bereit" : "Konfiguration unvollständig"}</strong></div>
          <div className={styles.statusItem}><span>Zahlungsbedingungen</span><strong>{termsReady ? "Freigegeben" : "Vertragsversion offen"}</strong></div>
        </div>
        <p className={activationReady ? styles.badgeOk : styles.badgeWarn}>{activationReady ? "Technische Vorprüfung bereit; echte Zahlung und Freischaltung separat testen." : "Die Sichtbarkeit ist schaltbar. Die kostenpflichtige Aktivierung wartet noch auf die oben genannten Voraussetzungen."}</p>
      </section>
    </main>
  </AdminBillingShell>;
}
