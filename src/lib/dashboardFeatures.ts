import type { PlanId } from "@/config/plans";
import { getPlan } from "@/lib/plans";
import { getBillingStatusLabel } from "@/lib/billing";
import { resolvePublicWorkspacePlanId } from "@/lib/publicDailyPlanPolicy.mjs";
import type { CommercialOption, ProductiveCommercialOption } from "@/lib/plans";

export type DashboardFeatureKey =
  | "dashboard_overview"
  | "contacts"
  | "contact_detail"
  | "sandra_demo"
  | "ai_suggestions"
  | "memory"
  | "followups"
  | "csv_import"
  | "one_profile"
  | "multiple_profiles"
  | "segments"
  | "multi_client_workspace"
  | "analytics"
  | "campaigns"
  | "integrations"
  | "automatic_sending"
  | "roadmap";

export type DashboardFeatureStatus =
  | "active"
  | "demo"
  | "limited"
  | "upgrade"
  | "preview"
  | "roadmap_only"
  | "hidden";

export type DashboardFeatureVisibility =
  | "sidebar"
  | "main"
  | "upgrade"
  | "roadmap"
  | "hidden";

type DashboardFeaturePlanAccess = {
  status: DashboardFeatureStatus;
  visibility: DashboardFeatureVisibility;
  minPlan?: Exclude<PlanId, "pilot">;
};

export type DashboardFeatureDefinition = {
  key: DashboardFeatureKey;
  label: string;
  description: string;
  statusByPlan: Record<PlanId, DashboardFeatureStatus>;
  visibilityByPlan: Record<PlanId, DashboardFeatureVisibility>;
  minPlan?: Exclude<PlanId, "pilot">;
  route?: string;
  ctaLabel?: string;
};

export type ResolvedDashboardFeature = Omit<DashboardFeatureDefinition, "statusByPlan" | "visibilityByPlan" | "minPlan"> & DashboardFeaturePlanAccess;

export type DashboardFeatureGroups = {
  sidebar: ResolvedDashboardFeature[];
  active: ResolvedDashboardFeature[];
  demoLimited: ResolvedDashboardFeature[];
  later: ResolvedDashboardFeature[];
  roadmap: ResolvedDashboardFeature[];
};

const planOrder: PlanId[] = ["pilot", "starter", "growth", "agency"];

const access = (
  pilot: DashboardFeaturePlanAccess,
  starter: DashboardFeaturePlanAccess,
  growth: DashboardFeaturePlanAccess,
  agency: DashboardFeaturePlanAccess,
): {
  statusByPlan: Record<PlanId, DashboardFeatureStatus>;
  visibilityByPlan: Record<PlanId, DashboardFeatureVisibility>;
  minPlan?: Exclude<PlanId, "pilot">;
} => {
  const minPlan = [pilot, starter, growth, agency].find((entry) => entry.minPlan)?.minPlan;

  return {
    statusByPlan: {
      pilot: pilot.status,
      starter: starter.status,
      growth: growth.status,
      agency: agency.status,
    },
    visibilityByPlan: {
      pilot: pilot.visibility,
      starter: starter.visibility,
      growth: growth.visibility,
      agency: agency.visibility,
    },
    ...(minPlan ? { minPlan } : {}),
  };
};

const active = (visibility: DashboardFeatureVisibility = "sidebar"): DashboardFeaturePlanAccess => ({ status: "active", visibility });
const demo = (visibility: DashboardFeatureVisibility = "sidebar"): DashboardFeaturePlanAccess => ({ status: "demo", visibility });
const limited = (visibility: DashboardFeatureVisibility = "sidebar"): DashboardFeaturePlanAccess => ({ status: "limited", visibility });
const preview = (minPlan?: Exclude<PlanId, "pilot">, visibility: DashboardFeatureVisibility = "main"): DashboardFeaturePlanAccess => ({
  status: "preview",
  visibility,
  ...(minPlan ? { minPlan } : {}),
});
const upgrade = (minPlan: Exclude<PlanId, "pilot">): DashboardFeaturePlanAccess => ({ status: "upgrade", visibility: "upgrade", minPlan });
const roadmapOnly = (): DashboardFeaturePlanAccess => ({ status: "roadmap_only", visibility: "roadmap" });
const hidden = (): DashboardFeaturePlanAccess => ({ status: "hidden", visibility: "hidden" });

export const DASHBOARD_FEATURES: DashboardFeatureDefinition[] = [
  {
    key: "dashboard_overview",
    label: "Dashboard-Überblick",
    description: "Gemeinsamer Workspace-Startpunkt mit Paketstatus, Setup-Hinweisen und nächsten Schritten.",
    route: "/dashboard",
    ...access(demo(), active(), preview("growth", "sidebar"), demo()),
  },
  {
    key: "contacts",
    label: "Kontakte",
    description: "Der Demo-Zugang nutzt Beispieldaten; Starter arbeitet produktiv mit dem Kontaktbestand.",
    route: "/fans",
    ctaLabel: "Kontakte ansehen",
    ...access(demo(), active(), active(), demo()),
  },
  {
    key: "contact_detail",
    label: "Kontaktdetail",
    description: "Detailansicht für einen Kontakt mit Kontext, Kontaktwissen und Follow-up-Vorbereitung.",
    route: "/dashboard#contact-detail",
    ...access(demo("main"), active("main"), active("main"), demo("main")),
  },
  {
    key: "sandra_demo",
    label: "Sandra M. Demo",
    description: "Sicherer Demo-Kontakt für KI-, Kontaktwissen- und Follow-up-Demos.",
    route: "/dashboard#sandra-demo",
    ctaLabel: "Demo öffnen",
    ...access(active("main"), hidden(), hidden(), demo("main")),
  },
  {
    key: "ai_suggestions",
    label: "KI-Antwortvorschläge",
    description: "Manuelle Antwortvorschläge ohne automatisches Senden; Starter ist bewusst limitiert.",
    route: "/dashboard#ai-suggestions",
    ...access(demo(), limited(), preview("growth"), preview("agency")),
  },
  {
    key: "memory",
    label: "Kontaktwissen",
    description: "Merkt relevante Kontaktinformationen für bessere manuelle Antworten und Follow-ups.",
    route: "/dashboard#memory",
    ...access(demo("main"), active("main"), active("main"), demo("main")),
  },
  {
    key: "followups",
    label: "Follow-ups",
    description: "Manuelle nächste Schritte und Erinnerungen vorbereiten; kein automatischer Versand.",
    route: "/dashboard#followups",
    ...access(demo(), active(), preview("growth"), preview("agency")),
  },
  {
    key: "csv_import",
    label: "CSV-Import",
    description: "Der Demo-Zugang zeigt den Import als Vorschau; Starter kann CSV-Daten produktiv vorbereiten.",
    route: "/dashboard#csv-import",
    ctaLabel: "Import prüfen",
    ...access(preview("starter"), active(), active(), demo()),
  },
  {
    key: "one_profile",
    label: "Ein Profil",
    description: "Ein aktives Profil als produktiver Starter-Arbeitsbereich.",
    route: "/dashboard#profile",
    ...access(upgrade("starter"), active("main"), active("main"), demo("main")),
  },
  {
    key: "multiple_profiles",
    label: "Mehrere Profile",
    description: "Später mehrere Fan-Profile für Creator, Teams oder Events verwalten.",
    ...access(upgrade("growth"), upgrade("growth"), preview("growth"), preview("agency")),
  },
  {
    key: "segments",
    label: "Basis-Segmente",
    description: "Später Kontakte nach einfachen Kriterien für Follow-ups und Auswertung gruppieren.",
    ...access(upgrade("growth"), upgrade("growth"), preview("growth"), preview("agency")),
  },
  {
    key: "multi_client_workspace",
    label: "Multi-Client-Workspace",
    description: "Agentur-Vorschau für mehrere Kunden, Workspaces und Verantwortlichkeiten.",
    ...access(upgrade("agency"), upgrade("agency"), upgrade("agency"), preview("agency")),
  },
  {
    key: "analytics",
    label: "Analytics",
    description: "Auswertungen bleiben im aktuellen Dashboard als klar getrennte Vorschau beziehungsweise Upgrade-Hinweis.",
    ...access(roadmapOnly(), roadmapOnly(), preview("growth"), preview("agency")),
  },
  {
    key: "campaigns",
    label: "Kampagnen",
    description: "Kampagnen sind Roadmap-Thema und werden nicht als aktive Starter-Funktion angezeigt.",
    ...access(roadmapOnly(), roadmapOnly(), roadmapOnly(), roadmapOnly()),
  },
  {
    key: "integrations",
    label: "Integrationen",
    description: "Produktive Integrationen sind noch nicht aktiv und bleiben als Roadmap-Hinweis getrennt.",
    ...access(roadmapOnly(), roadmapOnly(), roadmapOnly(), roadmapOnly()),
  },
  {
    key: "automatic_sending",
    label: "Automatisches Senden",
    description: "Automatisches Senden ist unabhängig vom Paket deaktiviert und wird nicht als Feature angeboten.",
    ...access(hidden(), hidden(), hidden(), hidden()),
  },
  {
    key: "roadmap",
    label: "Roadmap",
    description: "Transparenter Hinweisbereich für kommende Funktionen, Vorschauen und Paket-Upgrades.",
    route: "/dashboard#roadmap",
    ...access(active(), active(), active(), active()),
  },
];

export function getCommercialOptionLabel(commercialOption: CommercialOption | ProductiveCommercialOption | string): string {
  switch (commercialOption) {
    case "pilot_only":
      return "Interner Legacy-/Demo-Zugang · nicht öffentlich buchbar";
    case "starter_paid_setup":
      return "Starter Flex · 990 € Einrichtung + 312 €/Monat · monatlich kündbar";
    case "starter_no_setup_commitment":
      return "Starter 12 Monate · 0 € Einrichtung + 312 €/Monat · 12 Monate Bindung";
    case "growth_preview":
      return "Growth Vorschau";
    case "agency_preview":
      return "Agency Demo / Erstgespräch";
    case "internal_daily_test":
      return "Daily · 0 € Setup + 1 €/Tag · täglich kündbar";
    default:
      return commercialOption;
  }
}

type WorkspacePlanDisplayInput = {
  plan_id?: string | null;
  commercial_option?: string | null;
  billing_status?: string | null;
  member_safe_projection?: boolean;
};

export function getWorkspacePlanLabel(workspace: WorkspacePlanDisplayInput): string {
  const labels = { daily: "Daily", pilot: "Pilot / Setup", starter: "Starter", growth: "Growth", agency: "Agency", member: "Teamzugang", unknown: "Paket nicht zugeordnet" };
  return labels[resolvePublicWorkspacePlanId(workspace)];
}

export function getWorkspacePlanStatus(workspace: WorkspacePlanDisplayInput): string {
  const plan = resolvePublicWorkspacePlanId(workspace);
  if (plan === "daily") return getBillingStatusLabel(workspace.billing_status);
  if (plan === "member") return "Teamzugang";
  return plan === "starter" ? "Aktiv" : plan === "pilot" ? "Demo" : "Vorschau";
}

export function resolveDashboardFeatures(
  planId: PlanId,
  commercialOption: CommercialOption | ProductiveCommercialOption | string,
): ResolvedDashboardFeature[] {
  const normalizedPlanId = planOrder.includes(planId) ? planId : "pilot";
  const plan = getPlan(normalizedPlanId);
  const isPreviewCommercialOption = commercialOption === "growth_preview" || commercialOption === "agency_preview";

  return DASHBOARD_FEATURES.map((feature) => {
    const status = feature.statusByPlan[normalizedPlanId];
    const visibility = feature.visibilityByPlan[normalizedPlanId];
    const minPlan = feature.minPlan ?? plan.upgradePlan;

    if (
      normalizedPlanId === "growth" ||
      normalizedPlanId === "agency" ||
      isPreviewCommercialOption
    ) {
      const previewOnlyStatus = ["active", "demo", "limited"].includes(status)
        ? "preview"
        : status;

      return { ...feature, status: previewOnlyStatus, visibility, minPlan };
    }

    return { ...feature, status, visibility, minPlan };
  });
}

export function getDashboardFeatureGroups(
  planId: PlanId,
  commercialOption: CommercialOption | ProductiveCommercialOption | string,
): DashboardFeatureGroups {
  const features = resolveDashboardFeatures(planId, commercialOption).filter(
    (feature) => feature.status !== "hidden" && feature.visibility !== "hidden",
  );

  return {
    sidebar: features.filter(
      (feature) => feature.visibility === "sidebar" && ["active", "demo", "limited", "preview"].includes(feature.status),
    ),
    active: features.filter(
      (feature) => feature.key !== "roadmap" && feature.visibility !== "roadmap" && feature.status === "active",
    ),
    demoLimited: features.filter(
      (feature) => feature.key !== "roadmap" && feature.visibility !== "roadmap" && ["demo", "limited"].includes(feature.status),
    ),
    later: features.filter((feature) => feature.status === "upgrade"),
    roadmap: features.filter(
      (feature) => feature.key === "roadmap" || feature.status === "preview" || feature.status === "roadmap_only" || feature.visibility === "roadmap",
    ),
  };
}

export function getDashboardStatusLabel(status: DashboardFeatureStatus): string {
  switch (status) {
    case "active":
      return "Aktiv";
    case "demo":
      return "Demo";
    case "limited":
      return "Limitiert";
    case "upgrade":
      return "Upgrade";
    case "preview":
      return "Vorschau";
    case "roadmap_only":
      return "Roadmap";
    case "hidden":
      return "Ausgeblendet";
  }
}

export function getDashboardStatusText(status: DashboardFeatureStatus, minPlan?: Exclude<PlanId, "pilot">): string {
  switch (status) {
    case "active":
      return "Im aktuellen Paket aktiv.";
    case "demo":
      return "Als sichere Demo sichtbar; noch nicht produktiv angebunden.";
    case "limited":
      return "Aktiv mit bewusst begrenztem Umfang.";
    case "upgrade":
      return minPlan ? `Upgrade auf ${getPlan(minPlan).name} erforderlich.` : "Upgrade erforderlich.";
    case "preview":
      return "Vorschau: wird sichtbar vorbereitet, aber noch nicht produktiv ausgeliefert.";
    case "roadmap_only":
      return "Nur als Roadmap-Hinweis sichtbar.";
    case "hidden":
      return "Nicht sichtbar.";
  }
}
