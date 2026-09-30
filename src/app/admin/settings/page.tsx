import { requirePlatformAdmin } from "@/lib/admin";
import { isPaymentTermsActivationEnabled } from "@/lib/paymentTermsActivationPolicy.mjs";
import { getPublicDailyBetaStatusFromServer } from "@/lib/runtimeProductSettings";
import { formatMicrocentsAsEur, getAiCapacityAdminState } from "@/lib/aiCapacityAdmin";
import { isInternalDailyTestWorkspaceProvisioningReady } from "@/lib/supabase/server";
import { getStripeConfigStatus } from "@/lib/stripeBilling";
import { isInternalDailyTestBillingRuntimeReady, isInternalDailyTestStripeReady } from "@/lib/internalDailyTestReadinessPolicy.mjs";
import { AdminBillingShell } from "@/app/admin/billing/AdminBillingShell";
import { AdminTabs } from "@/app/admin/billing/AdminTabs";
import styles from "@/app/admin/billing/adminBilling.module.css";

type AdminSettingsPageProps = {
  searchParams: Promise<{ daily_test_plan?: string | string[]; ai_capacity?: string | string[] }>;
};

export default async function AdminSettingsPage({ searchParams }: AdminSettingsPageProps) {
  const user = await requirePlatformAdmin();
  const provisioningReady = await isInternalDailyTestWorkspaceProvisioningReady();
  const termsReady = isPaymentTermsActivationEnabled();
  const stripeReady = isInternalDailyTestStripeReady(getStripeConfigStatus());
  const billingRuntimeReady = isInternalDailyTestBillingRuntimeReady();
  const betaStatus = await getPublicDailyBetaStatusFromServer();
  const aiCapacity = await getAiCapacityAdminState();
  const admissionReady = termsReady && provisioningReady && stripeReady && billingRuntimeReady;
  const params = await searchParams;
  const result = Array.isArray(params.daily_test_plan)
    ? params.daily_test_plan[0]
    : params.daily_test_plan;
  const aiResult = Array.isArray(params.ai_capacity)
    ? params.ai_capacity[0]
    : params.ai_capacity;

  return (
    <AdminBillingShell
      user={user}
      title="Produktfreigaben"
      subtitle="Öffentliche Tarife und technische Aktivierung prüfen"
    >
      <main className={styles.adminStack}>
        <AdminTabs activeTab="settings" />
        {result || betaStatus.cleanupRequired ? (
          <p className={result === "enabled" ? styles.badgeOk : styles.badgeWarn}>
            {betaStatus.cleanupRequired && result !== "enabled"
              ? "Daily ist ausgeschaltet, aber offene Zahlungslinks müssen noch vollständig gesperrt werden. Bitte führe die Sperrung erneut aus."
              : result === "not_ready"
              ? "Freigabe blockiert: Daily-Provisioning oder Stripe-/Webhook-Konfiguration ist noch nicht vollständig bereit."
              : result === "busy"
                ? "Daily wurde parallel geändert. Bitte lade den aktuellen Status neu."
                : result === "enabled"
                  ? "Daily-Beta ist für neue Anmeldungen eingeschaltet."
                  : result === "disabled_cleanup_required"
                    ? "Daily ist ausgeschaltet, aber offene Zahlungslinks konnten nicht vollständig gesperrt werden. Bitte führe die Sperrung erneut aus."
                    : "Daily-Beta ist für neue Anmeldungen ausgeschaltet. Bestehende Daily-Abos laufen weiter."}
          </p>
        ) : null}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <span className={styles.eyebrow}>AI Capacity v2</span>
              <h2>99 / 199 / 312 € · Admin-Steuerung</h2>
              <p className={styles.cardSubtitle}>
                Server-only Policy für Schnell, Ausgewogen, Premium, Paketfreigaben, Zusatzkapazität und Not-Aus. Ohne kontrollierten Datenbank-Rollout bleibt alles wirkungslos und fail-closed.
              </p>
            </div>
            <span className={aiCapacity.installed ? styles.badgeOk : styles.badgeWarn}>
              {aiCapacity.installed ? "Schema bereit" : "Rollout ausstehend"}
            </span>
          </div>
          {aiResult ? (
            <p className={aiResult === "updated" ? styles.badgeOk : styles.badgeWarn}>
              {aiResult === "updated"
                ? "AI-Capacity-Einstellungen wurden revisionssicher gespeichert."
                : aiResult === "conflict"
                  ? "Die Einstellungen wurden parallel geändert. Bitte neu laden und erneut speichern."
                  : aiResult === "not_ready"
                    ? "AI-Capacity-Schema ist noch nicht kontrolliert ausgerollt."
                    : aiResult === "invalid"
                      ? "Die AI-Capacity-Einstellungen sind unvollständig oder ungültig."
                      : "AI-Capacity-Einstellungen konnten nicht gespeichert werden."}
            </p>
          ) : null}
          <div className={styles.statusList}>
            <div className={styles.statusItem}><span>Kapazitäts-Runtime</span><strong>{aiCapacity.policy.globalCapacityEnabled ? "Ein" : "Aus"}</strong></div>
            <div className={styles.statusItem}><span>Not-Aus</span><strong>{aiCapacity.policy.emergencySpendFreeze ? "Aktiv" : "Inaktiv"}</strong></div>
            <div className={styles.statusItem}><span>Top-up-Verkauf</span><strong>{aiCapacity.policy.topUpSalesEnabled ? "Ein" : "Aus"}</strong></div>
            <div className={styles.statusItem}><span>Revision</span><strong>{aiCapacity.revision ?? "—"}</strong></div>
          </div>
          <form action="/api/admin/settings/ai-capacity" method="post" className={styles.formGrid}>
            <input type="hidden" name="revision" value={aiCapacity.revision ?? ""} />
            <label className={styles.checkboxLabel}><input type="checkbox" name="global_capacity_enabled" defaultChecked={aiCapacity.policy.globalCapacityEnabled} disabled={!aiCapacity.installed} /> Capacity-v2-Nutzung global freigeben</label>
            <label className={styles.checkboxLabel}><input type="checkbox" name="emergency_spend_freeze" defaultChecked={aiCapacity.policy.emergencySpendFreeze} disabled={!aiCapacity.installed} /> Not-Aus für neue AI-Reservierungen</label>
            <label className={styles.checkboxLabel}><input type="checkbox" name="top_up_sales_enabled" defaultChecked={aiCapacity.policy.topUpSalesEnabled} disabled={!aiCapacity.installed} /> Zusatzkapazität verkaufen</label>

            <div className={styles.statusList}>
              <label className={styles.checkboxLabel}><input type="checkbox" name="fast_enabled" defaultChecked={aiCapacity.policy.qualityModeEnabled.fast} disabled={!aiCapacity.installed} /> Schnell</label>
              <label className={styles.checkboxLabel}><input type="checkbox" name="balanced_enabled" defaultChecked={aiCapacity.policy.qualityModeEnabled.balanced} disabled={!aiCapacity.installed} /> Ausgewogen</label>
              <label className={styles.checkboxLabel}><input type="checkbox" name="premium_enabled" defaultChecked={aiCapacity.policy.qualityModeEnabled.premium} disabled={!aiCapacity.installed} /> Premium</label>
            </div>

            <div className={styles.statusList}>
              <label className={styles.field}>99 € Paket · neues Geschäft
                <input type="checkbox" name="package_99_sales_enabled" defaultChecked={aiCapacity.policy.packageSalesEnabled.capacity_99} disabled={!aiCapacity.installed} />
                <input className={styles.input} name="budget_99_eur" inputMode="decimal" placeholder="AI-Budget in EUR · noch offen" defaultValue={formatMicrocentsAsEur(aiCapacity.policy.includedBudgetEurMicrocents.capacity_99)} disabled={!aiCapacity.installed} />
              </label>
              <label className={styles.field}>199 € Paket · neues Geschäft
                <input type="checkbox" name="package_199_sales_enabled" defaultChecked={aiCapacity.policy.packageSalesEnabled.capacity_199} disabled={!aiCapacity.installed} />
                <input className={styles.input} name="budget_199_eur" inputMode="decimal" placeholder="AI-Budget in EUR · noch offen" defaultValue={formatMicrocentsAsEur(aiCapacity.policy.includedBudgetEurMicrocents.capacity_199)} disabled={!aiCapacity.installed} />
              </label>
              <label className={styles.field}>312 € Paket · neues Geschäft
                <input type="checkbox" name="package_312_sales_enabled" defaultChecked={aiCapacity.policy.packageSalesEnabled.capacity_312} disabled={!aiCapacity.installed} />
                <input className={styles.input} name="budget_312_eur" inputMode="decimal" placeholder="AI-Budget in EUR · noch offen" defaultValue={formatMicrocentsAsEur(aiCapacity.policy.includedBudgetEurMicrocents.capacity_312)} disabled={!aiCapacity.installed} />
              </label>
            </div>
            <button className={styles.buttonPrimary} type="submit" disabled={!aiCapacity.installed}>AI-Capacity-Einstellungen speichern</button>
          </form>
          <p className={styles.muted}>
            Die Budgetwerte bleiben bewusst leer, bis sie anhand realer FanMind-Nutzung festgelegt werden. Ein Merge dieses Codes wendet das Supabase-Schema nicht an und aktiviert keine Zahlung, kein Top-up und keine Capacity-v2-Kundennutzung.
          </p>
        </section>

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
          {betaStatus.cleanupRequired && !betaStatus.enabled ? (
            <form action="/api/admin/settings/daily-test-plan" method="post">
              <input type="hidden" name="enabled" value="false" />
              <button className={styles.buttonDanger} type="submit">
                Offene Daily-Zahlungslinks erneut sperren
              </button>
            </form>
          ) : null}
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
