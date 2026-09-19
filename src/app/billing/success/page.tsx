import Link from "next/link";
import { redirect } from "next/navigation";
import { getBillingStatusLabel } from "@/lib/billing";
import { isAdminCrmAccessWorkspace } from "@/lib/adminCrmAccessPolicy.mjs";
import { getBillingContinuationHref } from "@/lib/preActivation";
import { getSupabaseServerUser, getUserWorkspaceDashboard } from "@/lib/supabase/server";
import styles from "../../dashboard/dashboard.module.css";

export const dynamic = "force-dynamic";

type BillingSuccessSearchParams = {
  session_id?: string;
};

function getLoginHref(sessionId?: string) {
  const returnTo = sessionId ? `/billing/success?session_id=${encodeURIComponent(sessionId)}` : "/billing/success";
  return `/login?returnTo=${encodeURIComponent(returnTo)}`;
}

export default async function BillingSuccessPage({ searchParams }: { searchParams?: Promise<BillingSuccessSearchParams> }) {
  const params = await searchParams;
  const sessionId = params?.session_id;
  const { data } = await getSupabaseServerUser();

  if (!data.user) {
    if (!sessionId) redirect(getLoginHref());

    return (
      <main className={styles.page}>
        <section className={styles.fallbackCard} aria-label="Zahlung eingereicht">
          <p className={styles.eyebrow}>Sichere Zahlungsseite</p>
          <h1>Zahlung wurde eingereicht</h1>
          <p>Dein Zugang wird automatisch aktualisiert.</p>
          <p>Bei SEPA-Lastschrift kann die Bestätigung einige Geschäftstage dauern.</p>
          <div className={styles.emptyActions}>
            <Link className={styles.primaryButton} href={getLoginHref(sessionId)}>Einloggen und Workspace öffnen</Link>
          </div>
        </section>
      </main>
    );
  }

  const workspaceResult = await getUserWorkspaceDashboard(data.user);
  if (workspaceResult.error?.message === "TEMPORARY_DEMO_DELETED") redirect("/login?demo_deleted=1");
  const workspace = workspaceResult.workspace;
  const isActive = workspace?.billing_status === "active";
  const continuationHref = getBillingContinuationHref(workspace, data.user.email);
  if (isAdminCrmAccessWorkspace(workspace)) redirect(continuationHref);

  return (
    <main className={styles.page}>
      <section className={styles.fallbackCard} aria-label={isActive ? "Freischaltung erfolgreich" : "Zahlung eingereicht"}>
        <p className={styles.eyebrow}>Sichere Zahlungsseite</p>
        <h1>{isActive ? "Freischaltung erfolgreich" : "Zahlung wurde eingereicht"}</h1>
        <p>{isActive ? "Dein FanMind-Workspace ist freigeschaltet." : "Dein Zugang wird automatisch aktualisiert."}</p>
        {!isActive ? <p>Bei SEPA-Lastschrift kann die Bestätigung einige Geschäftstage dauern.</p> : null}
        {workspace ? <div className={styles.emptyState}><strong>Aktueller Status: {getBillingStatusLabel(workspace.billing_status)}</strong></div> : null}
        <div className={styles.emptyActions}>
          <Link className={styles.primaryButton} href={continuationHref}>{isActive ? "Zum Dashboard" : "Status aktualisieren"}</Link>
          {!isActive ? <Link className={styles.secondaryButton} href="/billing/pending">Zu Zahlung eingereicht</Link> : null}
        </div>
      </section>
    </main>
  );
}
