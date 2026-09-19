import Link from "next/link";
import { redirect } from "next/navigation";

import { getPreActivationRedirect } from "@/lib/preActivation";
import { getSupabaseServerUser } from "@/lib/supabase/server";
import { getUserAuthorizedWorkspaceDashboard } from "@/lib/workspaceAuthorization";

export default async function WorkspaceMemberAccessPausedPage() {
  const { data } = await getSupabaseServerUser();
  if (!data.user) redirect("/login?returnTo=/workspace/access-paused");

  const { workspace } = await getUserAuthorizedWorkspaceDashboard(data.user);
  if (!workspace) redirect("/workspace/setup");

  const target = getPreActivationRedirect(workspace, data.user.email);
  if (target !== "/workspace/access-paused") {
    redirect(target ?? "/dashboard");
  }

  return (
    <main
      style={{
        fontFamily: "var(--font-geist-sans)",
        margin: "0 auto",
        maxWidth: 720,
        padding: "64px 20px",
      }}
    >
      <p style={{ color: "#0369a1", fontWeight: 700 }}>Workspace-Zugang</p>
      <h1>Der CRM-Zugang ist derzeit pausiert.</h1>
      <p>
        Deine Workspace- und CRM-Daten bleiben erhalten. Nur der Workspace-Owner beziehungsweise ein Platform Admin kann den Zugang klären. Sobald ein Platform Admin
        den kostenlosen Zugang wieder freigibt oder verlängert, steht dir der
        CRM-Bereich automatisch wieder zur Verfügung.
      </p>
      <p>
        <Link href="/logout">Abmelden</Link>
      </p>
    </main>
  );
}
