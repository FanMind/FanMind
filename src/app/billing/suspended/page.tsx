import Link from "next/link";
import { redirect } from "next/navigation";
import { BillingCheckoutButton } from "@/components/BillingCheckoutButton";
import { isWorkspaceBillingSuspended } from "@/lib/billing";
import { isAdminCrmAccessWorkspace } from "@/lib/adminCrmAccessPolicy.mjs";
import { getBillingContinuationHref } from "@/lib/preActivation";
import { getSupabaseServerUser, getUserWorkspaceDashboard } from "@/lib/supabase/server";

export default async function BillingSuspendedPage() {
  const { data } = await getSupabaseServerUser();
  if (!data.user) redirect("/login");
  const { workspace } = await getUserWorkspaceDashboard(data.user);
  if (!workspace) redirect("/dashboard");
  if (isAdminCrmAccessWorkspace(workspace)) {
    redirect(getBillingContinuationHref(workspace, data.user.email));
  }
  if (!isWorkspaceBillingSuspended(workspace)) redirect("/dashboard");
  return <main style={{ maxWidth: 720, margin: "0 auto", padding: "64px 20px", fontFamily: "var(--font-geist-sans)" }}>
    <p style={{ color: "#b45309", fontWeight: 700 }}>Billing gesperrt</p>
    <h1>Dein Zugang ist aktuell gesperrt, weil die Zahlung nicht abgeschlossen werden konnte.</h1>
    <p>Sobald die Zahlung erfolgreich bestätigt wurde, wird der Zugang automatisch reaktiviert.</p>
    <BillingCheckoutButton planId={workspace.plan_id} commercialOption={workspace.commercial_option} />
    <p>Falls du bereits überwiesen hast, kontaktiere FanMind.</p>
    <p><Link href="/logout">Logout</Link></p>
  </main>;
}
