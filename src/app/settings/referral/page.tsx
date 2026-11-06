import Link from "next/link";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { isPlatformAdminEmail } from "@/lib/admin";
import { isWorkspaceBillingSuspended } from "@/lib/billing";
import { getPreActivationRedirect } from "@/lib/preActivation";
import {
  getOpenFollowupCount,
  getSupabaseServerUser,
  getUserWorkspaceDashboard,
  getWorkspaceContacts,
  signOutSupabaseServerSession,
} from "@/lib/supabase/server";
import {
  getWorkspaceReferralSummary,
  type WorkspaceReferral,
} from "@/lib/referrals";
import { getWorkspaceNavigation } from "@/lib/workspaceNavigation";
import { AccountTabs } from "../AccountTabs";
import { resolveWorkspaceLocale } from "@/lib/workspaceLocale";
import { getWorkspaceKpiStatsFromContacts } from "@/lib/workspaceKpiStats";
import { ReferralCopyButton } from "../ReferralCopyButton";
import dashboardStyles from "../../dashboard/dashboard.module.css";
import styles from "./referral.module.css";

async function logout() {
  "use server";
  await signOutSupabaseServerSession();
  redirect("/");
}

export default async function ReferralSettingsPage() {
  const { data } = await getSupabaseServerUser();
  if (!data.user) redirect("/login");

  const locale = await resolveWorkspaceLocale({ user: data.user });
  const workspaceResult = await getUserWorkspaceDashboard(data.user);
  if (workspaceResult.error?.message === "TEMPORARY_DEMO_DELETED") {
    redirect("/login?demo_deleted=1");
  }

  const workspace = workspaceResult.workspace;
  if (!workspace) redirect("/dashboard");

  const preActivationRedirect = getPreActivationRedirect(workspace, data.user.email);
  if (preActivationRedirect) redirect(preActivationRedirect);
  if (isWorkspaceBillingSuspended(workspace)) redirect("/billing/suspended");

  const [contactsResult, followupResult, referralSummary] = await Promise.all([
    getWorkspaceContacts(workspace.id),
    getOpenFollowupCount(workspace.id),
    getWorkspaceReferralSummary(workspace.id, data.user.id),
  ]);
  const contactCount = getWorkspaceKpiStatsFromContacts(
    contactsResult.contacts ?? [],
  ).totalFans;
  const { mainNavigation, settingsNavigation, savedViews } =
    getWorkspaceNavigation(
      "referral",
      locale,
      0,
      isPlatformAdminEmail(data.user.email),
    );
  const displayName =
    typeof data.user.user_metadata?.display_name === "string" &&
    data.user.user_metadata.display_name.trim()
      ? data.user.user_metadata.display_name.trim()
      : data.user.email || workspace.name;
  const activeCount = referralSummary.activeReferralCount;
  const pendingCount = countStatuses(referralSummary.referrals, [
    "pending",
    "qualified",
  ]);
  const inactiveCount = countStatuses(referralSummary.referrals, [
    "inactive",
    "rejected",
    "locked_after_window_closed",
  ]);
  const capCount = referralSummary.state?.active_paid_workspace_count ?? 0;
  const cap = referralSummary.state?.active_paid_workspace_cap ?? 2000;
  const capPercent = Math.max(0, Math.min((capCount / Math.max(cap, 1)) * 100, 100));
  const monthlyBefore = workspace.monthly_fee_cents ?? 0;
  const monthlyDiscount = Math.round(
    monthlyBefore * (referralSummary.discountPercent / 100),
  );
  const monthlyAfter = Math.max(monthlyBefore - monthlyDiscount, 0);

  return (
    <main className={dashboardStyles.page}>
      <WorkspaceShell
        workspaceName={workspace.name}
        userLabel={displayName}
        planLabel={workspace.plan_id}
        planMeta={workspace.commercial_option}
        planStatus={workspace.billing_status ?? "—"}
        mainNavigation={mainNavigation}
        settingsNavigation={settingsNavigation}
        savedViews={savedViews}
        header={{
          title: locale === "en" ? "Recommendations" : "Empfehlungen",
          subtitle:
            locale === "en"
              ? "Your personal recommendation link and current discount status."
              : "Persönlicher Empfehlungslink und aktueller Rabattstatus.",
          searchPlaceholder:
            locale === "en"
              ? "Search contacts and messages ..."
              : "Fans und Nachrichten suchen ...",
          primaryActionLabel:
            locale === "en" ? "Package" : "Zum Paket",
          primaryActionHref: "/settings/package",
        }}
        contactCount={contactCount}
        openFollowupCount={followupResult.count ?? 0}
        logoutAction={logout}
        locale={locale}
      >
        <div className={styles.stack}>
          <AccountTabs activePage="referral" locale={locale} />

          <section className={styles.hero} aria-labelledby="referral-title">
            <div>
              <h2 id="referral-title">Referral Growth Window</h2>
              <p>
                Teile deinen persönlichen Link. Für jeden aktiven, zahlenden
                geworbenen Workspace erhältst du 5 % Rabatt auf die Starter-Grundgebühr
                von 312 €/Monat – maximal 20 aktive Empfehlungen beziehungsweise 100 %.
                Einrichtung und KI-Add-ons sind nicht rabattfähig.
              </p>
            </div>
            <span
              className={
                referralSummary.eligible
                  ? styles.statusActive
                  : styles.statusWarning
              }
            >
              {referralSummary.eligible
                ? "Teilnahme aktiv"
                : "Noch nicht freigeschaltet"}
            </span>
          </section>

          {referralSummary.error ? (
            <p className={styles.errorNotice}>{referralSummary.error}</p>
          ) : null}
          {!referralSummary.eligible ? (
            <p className={styles.notice}>
              {referralSummary.eligibilityReason ??
                "Der Empfehlungslink wird nach erfolgreicher Freischaltung eines zahlenden Workspaces aktiviert."}
            </p>
          ) : null}

          <section className={styles.codeGrid} aria-label="Empfehlungscode und Link">
            <article className={styles.codeCard}>
              <span>Empfehlungscode</span>
              <strong>
                {referralSummary.eligible
                  ? referralSummary.member?.referral_code ?? "Wird erstellt"
                  : "Nach Freischaltung verfügbar"}
              </strong>
              <ReferralCopyButton
                value={
                  referralSummary.eligible
                    ? referralSummary.member?.referral_code
                    : null
                }
                label="Code kopieren"
              />
            </article>
            <article className={styles.codeCard}>
              <span>Persönlicher Empfehlungslink</span>
              <strong>
                {referralSummary.referralUrl ??
                  "Nach erfolgreicher Freischaltung verfügbar"}
              </strong>
              <ReferralCopyButton
                value={referralSummary.referralUrl}
                label="Link kopieren"
              />
            </article>
          </section>

          <section className={styles.metricGrid} aria-label="Empfehlungsstatus">
            <article className={styles.metric}>
              <span>Aktiv</span>
              <strong>{activeCount} / 20</strong>
              <small>Zählen aktuell für deinen Rabatt.</small>
            </article>
            <article className={styles.metric}>
              <span>In Prüfung</span>
              <strong>{pendingCount}</strong>
              <small>Registriert, aber noch nicht zahlend aktiv.</small>
            </article>
            <article className={styles.metric}>
              <span>Aktueller Rabatt</span>
              <strong>{referralSummary.discountPercent} %</strong>
              <small>Maximal 100 %, keine Barauszahlung.</small>
            </article>
            <article className={styles.metric}>
              <span>Voraussichtlicher Monatsbetrag</span>
              <strong>{formatMoney(monthlyAfter)}</strong>
              <small>
                Vorher {formatMoney(monthlyBefore)} · Vorteil {formatMoney(monthlyDiscount)}
              </small>
            </article>
          </section>

          <section className={styles.card} aria-labelledby="growth-cap-title">
            <h3 id="growth-cap-title">Globaler Programmstand</h3>
            <div className={styles.progressTrack} aria-hidden="true">
              <div
                className={styles.progressValue}
                style={{ width: `${capPercent}%` }}
              />
            </div>
            <div className={styles.progressCopy}>
              <span>{capCount.toLocaleString("de-DE")} aktive zahlende Workspaces</span>
              <strong>{cap.toLocaleString("de-DE")}</strong>
            </div>
            <p>
              Programmstatus: {formatProgramStatus(referralSummary.state?.status)}.
              Neue rabattwirksame Empfehlungen entstehen nur, solange das Growth
              Window offen ist. Bereits aktive Ansprüche bleiben nach den
              Teilnahmebedingungen erhalten.
            </p>
          </section>

          <section className={styles.tableCard} aria-labelledby="referral-list-title">
            <h3 id="referral-list-title">Deine Empfehlungen</h3>
            <p>
              Es werden nur Status- und Abrechnungsinformationen angezeigt, keine
              fremden Kontakt- oder Zahlungsdaten.
            </p>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Erfasst</th>
                    <th>Aktiviert</th>
                    <th>Abrechnungsstatus</th>
                    <th>Hinweis</th>
                  </tr>
                </thead>
                <tbody>
                  {referralSummary.referrals.length ? (
                    referralSummary.referrals.map((referral) => (
                      <tr key={referral.id}>
                        <td>{formatReferralStatus(referral.status)}</td>
                        <td>{formatDate(referral.first_seen_at)}</td>
                        <td>{formatDate(referral.activated_at)}</td>
                        <td>{formatBillingStatus(referral.billing_status_snapshot)}</td>
                        <td>
                          {referral.deactivation_reason ||
                            referral.locked_reason ||
                            "—"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5}>Noch keine Empfehlungen erfasst.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {inactiveCount > 0 ? (
              <p>{inactiveCount} Empfehlung(en) zählen derzeit nicht für den Rabatt.</p>
            ) : null}
          </section>

          <section className={styles.card} aria-labelledby="referral-rules-title">
            <h3 id="referral-rules-title">Kurzregeln</h3>
            <ul className={styles.rules}>
              <li>5 % Rabatt je aktivem, zahlendem geworbenen Workspace.</li>
              <li>Maximal 20 aktive Empfehlungen beziehungsweise 100 % Rabatt.</li>
              <li>Der Rabatt gilt ausschließlich auf die Starter-Grundgebühr von 312 €/Monat.</li>
              <li>Einrichtung, KI Plus, KI Ultra und andere Add-ons sind nicht rabattfähig.</li>
              <li>Bei Kündigung, dauerhaftem Zahlungsausfall oder Rückerstattung entfällt der jeweilige 5-%-Anteil für künftige Rechnungen.</li>
              <li>Keine Barauszahlung, kein negativer Rechnungsbetrag und kein mehrstufiges Referral-System.</li>
            </ul>
            <p>
              Die vollständige Programmlogik steht in den{" "}
              <Link href="/referral-bedingungen">Referral-Teilnahmebedingungen</Link>.
            </p>
          </section>
        </div>
      </WorkspaceShell>
    </main>
  );
}

function countStatuses(referrals: WorkspaceReferral[], statuses: string[]): number {
  const allowed = new Set(statuses);
  return referrals.filter((referral) => allowed.has(referral.status)).length;
}

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("de-DE");
}

function formatProgramStatus(status?: string | null): string {
  if (status === "open") return "offen";
  if (status === "reopened") return "wieder geöffnet";
  if (status === "closing") return "wird geschlossen";
  if (status === "closed") return "geschlossen";
  return "wird geprüft";
}

function formatReferralStatus(status: string): string {
  if (status === "active") return "Aktiv";
  if (status === "qualified") return "Qualifiziert";
  if (status === "pending") return "In Prüfung";
  if (status === "inactive") return "Inaktiv";
  if (status === "rejected") return "Abgelehnt";
  if (status === "locked_after_window_closed") return "Nach Programmschluss gesperrt";
  return status;
}

function formatBillingStatus(status: string | null): string {
  if (!status) return "—";
  if (status === "active") return "Aktiv";
  if (status === "pending_payment_setup") return "Zahlung ausstehend";
  if (status === "cancelled") return "Gekündigt";
  if (status === "refunded") return "Rückerstattet";
  if (status === "payment_failed") return "Zahlung fehlgeschlagen";
  return status;
}
