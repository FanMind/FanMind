import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BillingCheckoutButton } from "@/components/BillingCheckoutButton";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { getWorkspaceNavigationForUser } from "@/lib/workspaceNavigation";
import { getWorkspaceKpiStatsFromContacts } from "@/lib/workspaceKpiStats";
import {
  getOpenFollowupCount,
  getSupabaseServerUser,
  getUserWorkspaceDashboard,
  getWorkspaceContacts,
  signOutSupabaseServerSession,
  type ContactRow,
  type WorkspaceDashboardRow,
} from "@/lib/supabase/server";
import { getBillingCheckoutActionLabel, shouldShowBillingCheckoutAction } from "@/lib/billing";
import { getCommercialOptionLabel, getWorkspacePlanLabel, getWorkspacePlanStatus } from "@/lib/dashboardFeatures";
import styles from "../dashboard/dashboard.module.css";

export const metadata: Metadata = {
  title: "FanMind | Onboarding",
  description: "Geschützter Onboarding-Grundablauf für den FanMind Produkt.",
};

type OnboardingAction = {
  label: string;
  href: string;
};

type OnboardingStep = {
  title: string;
  description: string;
  status: "done" | "next" | "recommended";
  statusLabel: string;
  actions?: OnboardingAction[];
};

type OnboardingWorkspaceProps = {
  workspace: WorkspaceDashboardRow;
  contacts: ContactRow[];
  contactsError?: string;
  openFollowupCount: number;
  userDisplayName: string;
  userEmail: string | null | undefined;
};

async function logout() {
  "use server";

  await signOutSupabaseServerSession();
  redirect("/");
}

function stringMetadataValue(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function getUserDisplayName(
  metadata: Record<string, unknown> | undefined,
  workspaceName: string,
): string {
  return (
    stringMetadataValue(metadata, "display_name") ??
    stringMetadataValue(metadata, "name") ??
    stringMetadataValue(metadata, "full_name") ??
    workspaceName ??
    "Nutzer"
  );
}

function getOnboardingSteps({
  workspace,
  contacts,
}: {
  workspace: WorkspaceDashboardRow;
  contacts: ContactRow[];
}): OnboardingStep[] {
  const workspaceDone = Boolean(workspace.id);
  const packageDone = Boolean(workspace.plan_id || workspace.commercial_option);
  const hasContact = contacts.length > 0;
  return [
    {
      title: "Workspace eingerichtet",
      description:
        "Dein geschützter FanMind-Workspace ist geladen und kann im begleiteten Setup genutzt werden.",
      status: workspaceDone ? "done" : "next",
      statusLabel: workspaceDone ? "Erledigt" : "Nächster Schritt",
    },
    {
      title: "Paket bestätigt",
      description:
        "Das bestätigte Paket steuert den begleiteten Setup-Rahmen. Es gibt keine Online-Zahlung aktuell.",
      status: packageDone ? "done" : "next",
      statusLabel: packageDone ? "Erledigt" : "Nächster Schritt",
    },
    {
      title: "Ersten Fan anlegen",
      description:
        "Lege mindestens einen echten Kontakt an, damit Fanliste und Kontaktdetails mit Workspace-Daten arbeiten.",
      status: hasContact ? "done" : "next",
      statusLabel: hasContact ? "Erledigt" : "Nächster Schritt",
      actions: [
        { label: "Zur Fanliste", href: "/fans#fans-list" },
        { label: "Neuen Fan anlegen", href: "/fans#new-fan-modal" },
      ],
    },
    {
      title: "CSV-Import vorbereiten",
      description:
        "Bereite eine echte CSV-Datei vor oder öffne den Importbereich. Ohne Datei werden keine Kontakte erzeugt.",
      status: "recommended",
      statusLabel: "Empfohlen",
      actions: [{ label: "CSV-Import vorbereiten", href: "/fans/import" }],
    },
    {
      title: "Chatverlauf manuell einfügen",
      description:
        "Füge manuell einen WhatsApp- oder Chatverlauf auf der Kontaktdetailseite ein. FanMind synchronisiert aktuell keine externen Plattformen.",
      status: hasContact ? "next" : "recommended",
      statusLabel: hasContact ? "Nächster Schritt" : "Nach erstem Fan",
      actions: [
        {
          label: hasContact ? "Fan öffnen" : "Zur Fanliste",
          href: hasContact ? `/fans/${contacts[0].id}` : "/fans#fans-list",
        },
      ],
    },
    {
      title: "KI-Vorschläge testen",
      description:
        "FanMind erzeugt Antwortvorschläge. Der Mensch prüft und sendet final selbst.",
      status: "recommended",
      statusLabel: hasContact ? "Empfohlen" : "Nach erstem Fan",
      actions: [
        {
          label: hasContact ? "KI im Fan testen" : "Zur Fanliste",
          href: hasContact ? `/fans/${contacts[0].id}` : "/fans#fans-list",
        },
      ],
    },
    {
      title: "Dashboard prüfen",
      description:
        "Dashboard zeigt echte Workspace-Daten, offene Follow-ups und keine Fake-Kampagnen.",
      status: "recommended",
      statusLabel: "Empfohlen",
      actions: [{ label: "Zum Dashboard", href: "/dashboard" }],
    },
  ];
}

function OnboardingWorkspace({
  workspace,
  contacts,
  contactsError,
  openFollowupCount,
  userDisplayName,
  userEmail,
}: OnboardingWorkspaceProps) {
  const { mainNavigation, settingsNavigation, savedViews } =
    getWorkspaceNavigationForUser(
      "onboarding",
      userEmail,
      "de",
      0,
      workspace.role,
    );
  const planLabel = getWorkspacePlanLabel(workspace);
  const planStatus = getWorkspacePlanStatus(workspace);
  const steps = getOnboardingSteps({ workspace, contacts });
  const completedCount = steps.filter((step) => step.status === "done").length;

  return (
    <WorkspaceShell
      workspaceName={workspace.name}
      userLabel={userDisplayName}
      planLabel={planLabel}
      planMeta={getCommercialOptionLabel(workspace.commercial_option)}
      planStatus={planStatus}
      mainNavigation={mainNavigation}
      settingsNavigation={settingsNavigation}
      savedViews={savedViews}
      header={{
        title: "Onboarding",
        subtitle: "Richte deinen FanMind-Workspace Schritt für Schritt ein.",
        searchPlaceholder:
          "Onboarding-Schritte, Fans oder Workspace suchen ...",
        primaryActionLabel: "Zum Dashboard",
        primaryActionHref: "/dashboard",
      }}
      contactCount={getWorkspaceKpiStatsFromContacts(contacts).totalFans}
      openFollowupCount={openFollowupCount}
      logoutAction={logout}
    >
      <section
        className={styles.onboardingHero}
        aria-labelledby="onboarding-title"
      >
        <div>
          <p className={styles.eyebrow}>Begleitetes Setup</p>
          <h2 id="onboarding-title">Dein nächster sinnvoller Schritt</h2>
          <p>
            Diese zentrale Setup-Seite zeigt, was bereits eingerichtet ist, was
            noch fehlt und welche Aktion als nächstes im begleiteten Pilot- oder
            Starter-Start sinnvoll ist.
          </p>
        </div>
        <div
          className={styles.onboardingProgress}
          aria-label="Onboarding Fortschritt"
        >
          <strong>
            {completedCount}/{steps.length}
          </strong>
          <span>aus Workspace-Daten erledigt</span>
        </div>
      </section>

      <section
        className={styles.onboardingGrid}
        aria-label="Onboarding Checkliste"
      >
        <article className={styles.moduleCard}>
          <div className={styles.moduleHeader}>
            <div>
              <p className={styles.eyebrow}>Checkliste</p>
              <h2>Produkt-Schritte</h2>
            </div>
            <span>{contacts.length ? "Echte Daten" : "Kontakt fehlt"}</span>
          </div>
          {contactsError ? (
            <p className={styles.error}>
              <strong>Kontakte konnten nicht geladen werden.</strong>
              <span>{contactsError}</span>
            </p>
          ) : null}
          <ol className={styles.onboardingChecklist}>
            {steps.map((step, index) => (
              <li
                key={step.title}
                className={styles[`onboarding-${step.status}`]}
              >
                <div className={styles.onboardingStepIndex}>{index + 1}</div>
                <div>
                  <div className={styles.onboardingStepHeader}>
                    <h3>{step.title}</h3>
                    <span>{step.statusLabel}</span>
                  </div>
                  <p>{step.description}</p>
                  {step.actions?.length ? (
                    <div className={styles.emptyActions}>
                      {step.actions.map((action) => (
                        <Link
                          className={styles.secondaryButton}
                          href={action.href}
                          key={action.label}
                        >
                          {action.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </article>

        <aside className={styles.moduleCard} aria-label="Workspace Status">
          <div className={styles.moduleHeader}>
            <div>
              <p className={styles.eyebrow}>Workspace</p>
              <h2>Status</h2>
            </div>
            <span>{planStatus}</span>
          </div>
          <dl className={styles.onboardingFacts}>
            <div>
              <dt>Workspace</dt>
              <dd>{workspace.name}</dd>
            </div>
            <div>
              <dt>Paket</dt>
              <dd>{planLabel}</dd>
            </div>
            <div>
              <dt>Commercial Option</dt>
              <dd>{getCommercialOptionLabel(workspace.commercial_option)}</dd>
            </div>
            <div>
              <dt>Gespeicherte Fans</dt>
              <dd>{contacts.length.toLocaleString("de-DE")}</dd>
            </div>
          </dl>
          {shouldShowBillingCheckoutAction(workspace) ? (
            <div className={styles.emptyState}>
              <strong>Dein Zugang wurde erstellt. Starte jetzt die Zahlung, um FanMind freizuschalten.</strong>
              <p>Öffne die sichere Zahlungsseite, damit FanMind deinen Zugang nach bestätigter Zahlung aktualisieren kann.</p>
              <BillingCheckoutButton planId={workspace.plan_id} commercialOption={workspace.commercial_option} label={getBillingCheckoutActionLabel(workspace.billing_status)} />
              <Link className={styles.secondaryButton} href="/billing/start">Paket & Zahlung ansehen</Link>
            </div>
          ) : null}
          <div className={styles.emptyState}>
            <strong>Starter Flex</strong>
            <p>990 € Einrichtung + 312 €/Monat · monatlich kündbar</p>
            <strong>Starter 12 Monate</strong>
            <p>0 € Einrichtung + 312 €/Monat · 12 Monate Mindestlaufzeit</p>
          </div>
          <div className={styles.emptyActions}>
            <Link className={styles.primaryButton} href="/fans#fans-list">
              Zur Fanliste
            </Link>
            <Link className={styles.secondaryButton} href="/fans/import">
              CSV importieren
            </Link>
            <Link className={styles.secondaryButton} href="/dashboard">
              Zum Dashboard
            </Link>
          </div>
        </aside>
      </section>

      <div className={styles.safetyNote} role="note">
        <strong>Sichere Zahlung</strong>
        <span>
          FanMind speichert keine Bankdaten. Automatisches Senden bleibt deaktiviert; der Mensch prüft und sendet final selbst.
        </span>
      </div>
    </WorkspaceShell>
  );
}

export default async function OnboardingPage() {
  const { data } = await getSupabaseServerUser();

  if (!data.user) {
    redirect("/login");
  }

  const workspaceResult = await getUserWorkspaceDashboard(data.user);
  if (workspaceResult.error?.message === "TEMPORARY_DEMO_DELETED") {
    redirect("/login?demo_deleted=1");
  }

  const workspace = workspaceResult.workspace;
  const contactsResult = workspace
    ? await getWorkspaceContacts(workspace.id)
    : null;
  const openFollowupCountResult = workspace
    ? await getOpenFollowupCount(workspace.id)
    : null;

  return (
    <main className={styles.page}>
      {workspace ? (
        <OnboardingWorkspace
          workspace={workspace}
          contacts={contactsResult?.contacts ?? []}
          contactsError={contactsResult?.error?.message}
          openFollowupCount={openFollowupCountResult?.count ?? 0}
          userDisplayName={getUserDisplayName(
            data.user.user_metadata,
            workspace.name,
          )}
          userEmail={data.user.email}
        />
      ) : (
        <section
          className={styles.fallbackCard}
          aria-label="FanMind Onboarding"
        >
          <div>
            <p className={styles.eyebrow}>FanMind Onboarding</p>
            <h1>Workspace-Status</h1>
            <p>
              Onboarding ist geschützt. Für deinen Account wurde noch kein
              Workspace gefunden.
            </p>
          </div>
          {workspaceResult.error ? (
            <p className={styles.error}>
              <strong>Workspace-Daten konnten nicht geladen werden.</strong>
              <span>{workspaceResult.error.message}</span>
            </p>
          ) : null}
          <form action={logout}>
            <button type="submit" className={styles.secondaryButton}>
              Abmelden
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
