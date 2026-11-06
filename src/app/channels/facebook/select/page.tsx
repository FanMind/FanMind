import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { areDemoConnectionsDisabled } from "@/lib/demoMode";
import {
  fetchFacebookPages,
  verifyPendingFacebookPageSelection,
} from "@/lib/facebookIntegration";
import { FACEBOOK_PAGE_SELECTION_COOKIE } from "@/lib/facebookPageSelectionPolicy.mjs";
import { canManageMetaConnections } from "@/lib/metaIntegrationPolicy.mjs";
import { requireActiveAuthorizedWorkspace } from "@/lib/workspaceAuthorization";
import { FanMindLogo } from "@/components/FanMindLogo";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function FacebookPageSelectionPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  let authorization;
  try {
    authorization = await requireActiveAuthorizedWorkspace();
  } catch {
    redirect("/channels?facebook_error=processing");
  }
  const { user, workspace } = authorization;
  if (!canManageMetaConnections(workspace.role))
    redirect("/channels?facebook_error=role");
  if (areDemoConnectionsDisabled(user, workspace))
    redirect("/channels?facebook_error=demo_disabled");

  const pending = verifyPendingFacebookPageSelection(
    (await cookies()).get(FACEBOOK_PAGE_SELECTION_COOKIE)?.value,
  );
  if (
    !pending ||
    pending.userId !== user.id ||
    pending.workspaceId !== workspace.id
  ) {
    redirect("/channels?facebook_error=page_selection_expired");
  }

  let pages: Awaited<ReturnType<typeof fetchFacebookPages>> = [];
  try {
    pages = await fetchFacebookPages(pending.userAccessToken);
  } catch {
    redirect("/channels?facebook_error=page_selection_fetch");
  }
  if (!pages.length) redirect("/channels?facebook_error=no_page");

  const params = (await searchParams) ?? {};

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="page-title">
        <FanMindLogo
          className={styles.logo}
          href="/channels"
          ariaLabel="Zurück zu den FanMind Kanälen"
        />
        <p className={styles.eyebrow}>Facebook · sichere Kontowahl</p>
        <h1 id="page-title">Welche Seite gehört zu diesem Workspace?</h1>
        <p className={styles.intro}>
          Meta hat mehrere von dir verwaltete Facebook-Seiten geliefert. Wähle
          ausdrücklich die Seite, die mit <strong>{workspace.name}</strong>
          verbunden werden soll. FanMind übernimmt keine andere Seite
          automatisch.
        </p>

        {params.error ? (
          <p className={styles.notice} role="alert">
            Die Auswahl konnte nicht bestätigt werden. Bitte prüfe die Seite
            und versuche es erneut.
          </p>
        ) : null}

        <form
          action="/api/integrations/facebook/select"
          method="post"
          className={styles.form}
        >
          <fieldset>
            <legend>Verfügbare Facebook-Seiten</legend>
            <div className={styles.options}>
              {pages.map((page) => (
                <label key={page.id} className={styles.option}>
                  <input
                    type="radio"
                    name="page_id"
                    value={page.id}
                    required
                  />
                  <span>
                    <strong>{page.name}</strong>
                    <small>Meta-Seiten-ID: {page.id}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className={styles.actions}>
            <button type="submit">Ausgewählte Seite verbinden</button>
            <Link href="/channels">Abbrechen</Link>
          </div>
        </form>

        <ul className={styles.securityNotes}>
          <li>Kein Facebook-Passwort wird an FanMind übergeben.</li>
          <li>Die Auswahl gilt nur für den aktuell angemeldeten Workspace.</li>
          <li>Der kurzlebige OAuth-Zugriff bleibt verschlüsselt und serverseitig.</li>
        </ul>
      </section>
    </main>
  );
}
