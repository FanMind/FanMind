import Link from "next/link";
import { redirect } from "next/navigation";
import { getBillingStatusLabel } from "@/lib/billing";
import { isAdminCrmAccessWorkspace } from "@/lib/adminCrmAccessPolicy.mjs";
import { getBillingContinuationHref } from "@/lib/preActivation";
import { getCommercialOptionLabel } from "@/lib/dashboardFeatures";
import { getSupabaseServerUser, getUserWorkspaceDashboard, signOutSupabaseServerSession } from "@/lib/supabase/server";
import styles from "../../dashboard/dashboard.module.css";

export const dynamic = "force-dynamic";

async function logout() {
  "use server";
  await signOutSupabaseServerSession();
  redirect("/");
}

function planLabel(planId?: string | null) {
  if (planId === "pilot") return "Pilot / Setup";
  if (planId === "starter") return "Starter";
  if (planId === "growth") return "Growth";
  if (planId === "agency") return "Agency";
  return planId ?? "Ausgewähltes Paket";
}

export default async function BillingPendingPage() {
  const { data } = await getSupabaseServerUser();
  if (!data.user) redirect("/login?returnTo=/billing/pending");

  const workspaceResult = await getUserWorkspaceDashboard(data.user);
  if (workspaceResult.error?.message === "TEMPORARY_DEMO_DELETED") redirect("/login?demo_deleted=1");
  const workspace = workspaceResult.workspace;
  const continuationHref = getBillingContinuationHref(workspace, data.user.email);
  if (isAdminCrmAccessWorkspace(workspace)) redirect(continuationHref);

  return (
    <main className={styles.page}>
      <section className={styles.fallbackCard} aria-label="Zahlung eingereicht">
        <div>
          <p className={styles.eyebrow}>Freischaltung in Bearbeitung</p>
          <h1>Zahlung eingereicht</h1>
          <p>Danke — deine Zahlung wurde sicher übergeben. Bei SEPA-Lastschrift und anderen asynchronen Zahlarten kann die finale Bestätigung einige Geschäftstage dauern.</p>
        </div>

        {workspace ? (
          <dl className={styles.onboardingFacts}>
            <div><dt>Gebuchtes Paket</dt><dd>{planLabel(workspace.plan_id)}</dd></div>
            <div><dt>Option</dt><dd>{getCommercialOptionLabel(workspace.commercial_option)}</dd></div>
            <div><dt>Zahlungsstatus</dt><dd>{getBillingStatusLabel(workspace.billing_status)}</dd></div>
          </dl>
        ) : (
          <div className={styles.emptyState}><strong>Wir bereiten deinen Zugang vor.</strong><p>Bitte aktualisiere den Status in Kürze erneut.</p></div>
        )}

        <div className={styles.emptyActions}>
          <Link className={styles.primaryButton} href={continuationHref}>Status aktualisieren</Link>
          {workspace?.billing_status === "pending_sepa_mandate" && workspace.stripe_subscription_id ? (
            <Link className={styles.secondaryButton} href="/settings/package">Paket und Kündigung verwalten</Link>
          ) : null}
          <form action={logout}><button className={styles.secondaryButton} type="submit">Abmelden</button></form>
        </div>
      </section>
    </main>
  );
}
