import { requirePlatformAdmin } from "@/lib/admin";
import { isPaymentTermsActivationEnabled } from "@/lib/paymentTermsActivationPolicy.mjs";
import { getPublicDailyBetaStatusFromServer } from "@/lib/runtimeProductSettings";
import { isInternalDailyTestWorkspaceProvisioningReady } from "@/lib/supabase/server";
import { getStripeConfigStatus } from "@/lib/stripeBilling";
import { isInternalDailyTestBillingRuntimeReady, isInternalDailyTestStripeReady } from "@/lib/internalDailyTestReadinessPolicy.mjs";
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
  const billingRuntimeReady = isInternalDailyTestBillingRuntimeReady();
  const betaStatus = await getPublicDailyBetaStatusFromServer();
  const admissionReady = termsReady && provisioningReady && stripeReady && billingRuntimeReady;
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
              : result === "busy"
                ? "Daily wurde parallel geändert. Bitte lade den aktuellen Status neu."
                : result === "enabled"
                  ? "Daily-Beta ist für neue Anmeldungen eingeschaltet."
                  : "Daily-Beta ist für neue Anmeldungen ausgeschaltet. Bestehende Daily-Abos laufen weiter."}
          </p>
        ) : null}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <span className={styles.eyebrow}>Interne Beta</span>
              <h2>Daily · 0 € Setup + 1 €/Tag</h2>
              <p className={styles.cardSubtitle}>
                Der Platform-Admin kann Daily während der internen Beta für neue Anmeldungen ein- oder ausschalten. Es gibt keinen automatischen Ablauf.
              </p>
            </div>
            <span className={betaStatus.enabled ? styles.badgeOk : styles.badgeWarn}>
              {betaStatus.enabled ? "Beta ein" : "Beta aus"}
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
            <div className={styles.statusItem}>
              <span>Billing-Ledger</span><strong>{billingRuntimeReady ? "Bereit" : "Rollout ausstehend"}</strong>
            </div>
          </div>
          <div className={styles.statusItem}>
            <span>Zahlungsbedingungen</span><strong>{termsReady ? "Freigegeben" : "Vertragsversion offen"}</strong>
          </div>
          <form action="/api/admin/settings/daily-test-plan" method="post">
            <input type="hidden" name="enabled" value={betaStatus.enabled ? "false" : "true"} />
            <button
              className={betaStatus.enabled ? styles.buttonDanger : styles.buttonPrimary}
              type="submit"
              disabled={!betaStatus.enabled && !admissionReady}
              title={!betaStatus.enabled && !admissionReady
                ? "Daily kann erst eingeschaltet werden, wenn Registrierung, Stripe/Webhook, Billing-Ledger und Zahlungsbedingungen bereit sind."
                : undefined}
            >
              {betaStatus.enabled ? "Daily-Beta für neue Anmeldungen ausschalten" : "Daily-Beta für neue Anmeldungen einschalten"}
            </button>
          </form>
          {!betaStatus.enabled && !admissionReady ? (
            <p className={styles.badgeWarn} role="status">
              Einschalten ist noch gesperrt. Schließe zuerst alle oben als ausstehend oder unvollständig markierten Readiness-Schritte ab.
            </p>
          ) : null}
          <p className={styles.muted}>
            Bei „Aus“ verschwindet Daily aus Landingpage, Registrierung und Workspace-Einrichtung und neue Daily-Checkouts bleiben gesperrt. Bestehende Daily-Abos und Workspaces werden nicht verändert oder gekündigt.
          </p>
        </section>
      </main>
    </AdminBillingShell>
  );
}
