import Link from "next/link";
import { redirect } from "next/navigation";
import { BillingCheckoutButton } from "@/components/BillingCheckoutButton";
import { getBillingCheckoutActionLabel, shouldShowBillingCheckoutAction } from "@/lib/billing";
import { isAdminCrmAccessWorkspace } from "@/lib/adminCrmAccessPolicy.mjs";
import { getBillingContinuationHref } from "@/lib/preActivation";
import { getSupabaseServerUser, getUserWorkspaceDashboard } from "@/lib/supabase/server";
import styles from "../../dashboard/dashboard.module.css";

export default async function BillingCancelPage() {
  const { data } = await getSupabaseServerUser();
  const workspaceResult = data.user ? await getUserWorkspaceDashboard(data.user) : { workspace: null };
  const workspace = workspaceResult.workspace;
  if (isAdminCrmAccessWorkspace(workspace)) {
    redirect(getBillingContinuationHref(workspace, data.user?.email));
  }
  return (
    <main className={styles.page}>
      <section className={styles.fallbackCard}>
        <p className={styles.eyebrow}>Sichere Zahlungsseite</p>
        <h1>Zahlung nicht abgeschlossen</h1>
        <p>Zahlung wurde nicht abgeschlossen. Du kannst die Zahlung erneut starten.</p>
        {workspace && shouldShowBillingCheckoutAction(workspace) ? (
          <BillingCheckoutButton planId={workspace.plan_id} commercialOption={workspace.commercial_option} label={getBillingCheckoutActionLabel(workspace.billing_status)} />
        ) : (
          <Link className={styles.primaryButton} href="/billing/start">Zahlung erneut versuchen</Link>
        )}
        <div className={styles.emptyActions}>
          <Link className={styles.secondaryButton} href="/dashboard">Zum Dashboard</Link>
        </div>
      </section>
    </main>
  );
}
