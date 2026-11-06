import { notFound } from "next/navigation";
import { WorkspaceShell, type WorkspaceNavLink } from "@/components/WorkspaceShell";

export const dynamic = "force-dynamic";

async function previewLogout() {
  "use server";
}

const previewPath = "/sidebar-preview-e2e";

const mainNavigation: WorkspaceNavLink[] = [
  { label: "Dashboard", href: previewPath, icon: "dashboard", active: true },
  { label: "Fans", href: `${previewPath}#fans`, icon: "contacts" },
  { label: "Follow-ups", href: `${previewPath}#followups`, icon: "followups", badge: "3" },
  { label: "Kanäle", href: `${previewPath}#channels`, icon: "channels", badge: "Sync" },
];

const settingsNavigation: WorkspaceNavLink[] = [
  { label: "Profil & Konto", href: `${previewPath}#profile`, icon: "profile" },
  { label: "Adminbereich", href: `${previewPath}#admin`, icon: "admin" },
];

const savedViews: WorkspaceNavLink[] = [
  { label: "Top Fans", href: `${previewPath}#top-fans`, icon: "topFans" },
  { label: "Reaktivierung", href: `${previewPath}#reactivation`, icon: "reactivation" },
];

export default function SidebarPreviewPage() {
  if (process.env.FANMIND_ENABLE_SIDEBAR_PREVIEW_E2E !== "true") {
    notFound();
  }

  return (
    <WorkspaceShell
      workspaceName="FanMind"
      userLabel="FanMind"
      planLabel="Starter"
      planMeta="Preview"
      planStatus="Aktiv"
      mainNavigation={mainNavigation}
      settingsNavigation={settingsNavigation}
      savedViews={savedViews}
      header={{
        title: "Sidebar-Vorschau",
        subtitle: "Temporärer no-write Browser-Abnahmescreen",
        searchPlaceholder: "Suche",
        primaryActionLabel: "Vorschau",
        primaryActionHref: previewPath,
      }}
      contactCount={312}
      openFollowupCount={3}
      logoutAction={previewLogout}
      profileHref={`${previewPath}#profile`}
    >
      <main
        data-testid="sidebar-preview-content"
        style={{
          display: "grid",
          minHeight: "620px",
          placeItems: "center",
          border: "1px solid rgba(148, 163, 184, 0.16)",
          borderRadius: "18px",
          color: "#cbd5e1",
          background: "rgba(15, 23, 42, 0.62)",
        }}
      >
        <div style={{ maxWidth: "620px", padding: "32px", textAlign: "center" }}>
          <p style={{ color: "#67e8f9", fontWeight: 900, letterSpacing: "0.12em" }}>
            FANMIND UI ABNAHME
          </p>
          <h2 style={{ margin: "12px 0", color: "#ffffff", fontSize: "28px" }}>
            Eine Sidebar, eine Icon-Schiene
          </h2>
          <p style={{ lineHeight: 1.6 }}>
            Dieser temporäre Screen enthält ausschließlich synthetische Darstellungsdaten und
            erzeugt keine API-, Datenbank-, Billing-, KI- oder Social-Media-Schreibzugriffe.
          </p>
        </div>
      </main>
    </WorkspaceShell>
  );
}
