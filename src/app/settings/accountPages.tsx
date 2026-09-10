import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isWorkspaceBillingSuspended } from "@/lib/billing";
import { getPreActivationRedirect } from "@/lib/preActivation";
import {
  getOpenFollowupCount,
  getSupabaseServerUser,
  getUserWorkspaceDashboard,
  getWorkspaceContacts,
  signOutSupabaseServerSession,
  type SupabaseServerUser,
  type WorkspaceDashboardRow,
} from "@/lib/supabase/server";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { UserPreferenceFallback } from "@/components/UserPreferenceFallback";
import { getCommercialOptionLabel, getWorkspacePlanStatus } from "@/lib/dashboardFeatures";
import { getCustomerBillingTaxNote, listCustomerInvoicesForWorkspace, type CustomerInvoiceSummary } from "@/lib/customerBilling";
import { isPlatformAdminEmail } from "@/lib/admin";
import { getWorkspaceNavigation } from "@/lib/workspaceNavigation";
import { resolveWorkspaceLocale } from "@/lib/workspaceLocale";
import { FANMIND_BRIGHTNESS_COOKIE, getUserMetadataBrightness, normalizeFanMindBrightness, type FanMindBrightness } from "@/lib/userPreferences";
import type { FanMindLanguage } from "@/lib/fanmindCopy";
import { getWorkspaceKpiStatsFromContacts } from "@/lib/workspaceKpiStats";
import dashboardStyles from "../dashboard/dashboard.module.css";
import profileStyles from "./profile/profile.module.css";
import {
  type SettingsAccountPage,
  getPlanLabel,
  getProfileFields,
  getSettingsAccountPageHref,
  getSettingsAccountPageTitle,
  InvoicesSettingsSection,
  PackageSettingsSection,
  ProfileSettingsSection,
  SettingsHeaderBar,
} from "./AccountSections";
import { requestSubscriptionCancellation, revokeSubscriptionCancellation, saveAppearancePreferences, savePersonalProfileData, saveTaxMasterData, saveWorkspaceMasterData } from "./actions";

type AccountWorkspaceProps = {
  workspace: WorkspaceDashboardRow;
  user: SupabaseServerUser;
  activePage: SettingsAccountPage;
  userDisplayName: string;
  contactCount: number;
  openFollowupCount: number;
  showAdminArea: boolean;
  invoices: CustomerInvoiceSummary[];
  invoiceError: string | null;
  taxNote: string | null;
  locale: FanMindLanguage;
  brightness: FanMindBrightness;
  preferencesError?: string | null;
  profileSaved?: boolean;
  workspaceSaved?: boolean;
  taxSaved?: boolean;
  personalError?: string | null;
  workspaceError?: string | null;
  taxError?: string | null;
  cancelError?: string | null;
  cancelSaved?: string | null;
};

const EMPTY_VALUE = "Noch nicht hinterlegt";

async function logout() {
  "use server";

  await signOutSupabaseServerSession();
  redirect("/");
}

function getUserDisplayName(metadata: Record<string, unknown> | undefined): string {
  const displayName = metadata?.display_name ?? metadata?.full_name;
  return typeof displayName === "string" && displayName.trim() ? displayName.trim() : EMPTY_VALUE;
}

function getSidebarUserLabel(userDisplayName: string, userEmail: string | undefined, workspaceName: string): string {
  return userDisplayName !== EMPTY_VALUE ? userDisplayName : userEmail || workspaceName || "Nutzer";
}

function AccountWorkspace({ workspace, user, activePage, userDisplayName, contactCount, openFollowupCount, showAdminArea, invoices, invoiceError, taxNote, locale, brightness, preferencesError, profileSaved, workspaceSaved, taxSaved, personalError, workspaceError, taxError, cancelError, cancelSaved }: AccountWorkspaceProps) {
  const { mainNavigation, settingsNavigation, savedViews } = getWorkspaceNavigation("settings", locale, 0, showAdminArea);
  const fields = getProfileFields(user, workspace, userDisplayName, locale);
  const hasOnlyRealValues = fields.every((field) => field.source === "real");
  const userLabel = getSidebarUserLabel(userDisplayName, user.email, workspace.name);
  const pageTitle = getSettingsAccountPageTitle(activePage);

  return (
    <>
    <UserPreferenceFallback locale={locale} brightness={brightness} />
    <WorkspaceShell
      workspaceName={workspace.name}
      userLabel={userLabel}
      planLabel={getPlanLabel(workspace)}
      planMeta={getCommercialOptionLabel(workspace.commercial_option)}
      planStatus={getWorkspacePlanStatus(workspace)}
      mainNavigation={mainNavigation}
      settingsNavigation={settingsNavigation}
      savedViews={savedViews}
      header={{
        title: pageTitle,
        subtitle: "Kompakter CRM-Kontobereich mit getrennten Seiten für Profil, Paket und Rechnungen.",
        searchPlaceholder: "Suche nach Profil, Workspace, Paket ...",
        primaryActionLabel: activePage === "invoices" ? "Rechnungen" : pageTitle,
        primaryActionHref: getSettingsAccountPageHref(activePage),
      }}
      contactCount={contactCount}
      openFollowupCount={openFollowupCount}
      logoutAction={logout}
      locale={locale}
    >
      <div className={profileStyles.profileStack}>
        <SettingsHeaderBar activePage={activePage} locale={locale} />
        {activePage === "profile" ? <ProfileSettingsSection fields={fields} hasOnlyRealValues={hasOnlyRealValues} preferencesAction={saveAppearancePreferences} locale={locale} brightness={brightness} preferencesError={preferencesError} personalAction={savePersonalProfileData} workspaceAction={saveWorkspaceMasterData} taxAction={saveTaxMasterData} profileSaved={profileSaved} workspaceSaved={workspaceSaved} taxSaved={taxSaved} personalError={personalError} workspaceError={workspaceError} taxError={taxError} /> : null}
        {activePage === "package" ? <PackageSettingsSection workspace={workspace} cancelAction={requestSubscriptionCancellation} revokeCancelAction={revokeSubscriptionCancellation} cancelError={cancelError} cancelSaved={cancelSaved} /> : null}
        {activePage === "invoices" ? <InvoicesSettingsSection invoices={invoices} invoiceError={invoiceError} taxNote={taxNote} /> : null}
      </div>
    </WorkspaceShell>
    </>
  );
}

export async function renderSettingsAccountPage(activePage: SettingsAccountPage, searchParams?: { preferences_error?: string; profile_saved?: string; workspace_saved?: string; tax_saved?: string; personal_error?: string; workspace_error?: string; tax_error?: string; profile_error?: string; cancel_error?: string; cancel_saved?: string }) {
  const { data, error: userError } = await getSupabaseServerUser();
  if (!data.user) redirect("/login");

  const locale = await resolveWorkspaceLocale({ user: data.user });
  const cookieStore = await cookies();
  const brightness = getUserMetadataBrightness(data.user) ?? normalizeFanMindBrightness(cookieStore.get(FANMIND_BRIGHTNESS_COOKIE)?.value);

  const workspaceResult = await getUserWorkspaceDashboard(data.user);
  if (workspaceResult.error?.message === "TEMPORARY_DEMO_DELETED") redirect("/login?demo_deleted=1");

  const workspace = workspaceResult.workspace;
  const preActivationRedirect = getPreActivationRedirect(workspace, data.user.email);
  const pendingSepaPackageAccess = activePage === "package"
    && workspace?.billing_status === "pending_sepa_mandate";
  if (preActivationRedirect && !pendingSepaPackageAccess) redirect(preActivationRedirect);
  if (isWorkspaceBillingSuspended(workspace)) redirect("/billing/suspended");

  const contactsResult = workspace ? await getWorkspaceContacts(workspace.id) : null;
  const openFollowupCountResult = workspace ? await getOpenFollowupCount(workspace.id) : null;
  const invoiceResult = workspace && activePage === "invoices" ? await listCustomerInvoicesForWorkspace(workspace) : { invoices: [], error: null };

  return (
    <main className={dashboardStyles.page}>
      {workspace ? (
        <AccountWorkspace
          workspace={workspace}
          user={data.user}
          activePage={activePage}
          userDisplayName={getUserDisplayName(data.user.user_metadata)}
          contactCount={getWorkspaceKpiStatsFromContacts(contactsResult?.contacts ?? []).totalFans}
          openFollowupCount={openFollowupCountResult?.count ?? 0}
          showAdminArea={isPlatformAdminEmail(data.user.email)}
          invoices={invoiceResult.invoices}
          invoiceError={invoiceResult.error}
          taxNote={activePage === "invoices" ? getCustomerBillingTaxNote() : null}
          locale={locale}
          brightness={brightness}
          preferencesError={searchParams?.preferences_error ?? null}
          profileSaved={searchParams?.profile_saved === "1"}
          workspaceSaved={searchParams?.workspace_saved === "1"}
          taxSaved={searchParams?.tax_saved === "1"}
          personalError={searchParams?.personal_error ?? searchParams?.profile_error ?? null}
          workspaceError={searchParams?.workspace_error ?? null}
          taxError={searchParams?.tax_error ?? null}
          cancelError={searchParams?.cancel_error ?? null}
          cancelSaved={searchParams?.cancel_saved ?? null}
        />
      ) : (
        <section className={dashboardStyles.fallbackCard} aria-label="FanMind Profil-Einstellungen">
          <div>
            <p className={dashboardStyles.eyebrow}>Profil-Einstellungen</p>
            <h1>Workspace-Status</h1>
            <p>Profil-Einstellungen sind geschützt: Supabase Auth ist aktiv. Für deinen Account wurde noch kein Workspace gefunden.</p>
          </div>
          {userError ? <p className={dashboardStyles.error}><strong>Supabase-Session konnte nicht vollständig geprüft werden.</strong><span>{userError.message}</span></p> : null}
          {workspaceResult.error ? <p className={dashboardStyles.error}><strong>Workspace-Daten konnten nicht geladen werden.</strong><span>{workspaceResult.error.message}</span></p> : null}
          <form action={logout}><button type="submit" className={dashboardStyles.secondaryButton}>Abmelden</button></form>
        </section>
      )}
    </main>
  );
}
