export type PlanId = "pilot" | "starter" | "growth" | "agency";

export type FeatureStatus =
  | "active"
  | "demo"
  | "limited"
  | "upgrade"
  | "coming_soon"
  | "hidden"
  | "preview";

export type FeatureVisibility =
  | "visible"
  | "hidden"
  | "roadmap_only"
  | "admin_only"
  | "sales_demo_only";

export type FeatureContext =
  | "landing"
  | "app"
  | "roadmap"
  | "admin"
  | "sales_demo";

export type FeatureKey =
  | "login"
  | "dashboard"
  | "contacts"
  | "contact_detail"
  | "sandra_demo"
  | "ai_replies"
  | "memory"
  | "followups"
  | "csv_import"
  | "roadmap"
  | "single_profile"
  | "multiple_profiles"
  | "multi_client_workspace"
  | "basic_segments"
  | "campaigns"
  | "analytics"
  | "team_roles"
  | "integrations"
  | "payments"
  | "automatic_sending";

export type PlanMode = "demo" | "production" | "agency";

export type FeatureAccessConfig = {
  status: FeatureStatus;
  visibility: FeatureVisibility;
};

export type PlanConfig = {
  id: PlanId;
  name: string;
  badge: string;
  priceLabel: string;
  mode: PlanMode;
  maxProfiles: number | null;
  maxContacts: number | null;
  contactsLabel: string;
  description: string;
  primaryAction: string;
  upgradePlan?: Exclude<PlanId, "pilot">;
  featureConfig: Record<FeatureKey, FeatureAccessConfig>;
  upgradeTargets: Partial<Record<FeatureKey, PlanId>>;
};

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  login: "Login / Registrierung",
  dashboard: "Geschütztes Dashboard",
  contacts: "Kontakte / Follower",
  contact_detail: "Kontaktdetailseite",
  sandra_demo: "Sandra M. Demo",
  ai_replies: "KI-Antwortvorschläge",
  memory: "Kontaktwissen",
  followups: "Follow-ups",
  csv_import: "CSV-Import",
  roadmap: "Roadmap",
  single_profile: "Ein Profil",
  multiple_profiles: "Mehrere Profile",
  multi_client_workspace: "Multi-Client-Workspace",
  basic_segments: "Basis-Segmente",
  campaigns: "Kampagnen",
  analytics: "Analytics",
  team_roles: "Team-Rollen / Rechte",
  integrations: "Integrationen",
  payments: "Zahlungen",
  automatic_sending: "Automatisches Senden",
};

export const FEATURE_KEYS = Object.keys(FEATURE_LABELS) as FeatureKey[];

const DEFAULT_VISIBILITY: Record<FeatureKey, FeatureVisibility> = {
  login: "visible",
  dashboard: "visible",
  contacts: "visible",
  contact_detail: "visible",
  sandra_demo: "visible",
  ai_replies: "visible",
  memory: "visible",
  followups: "visible",
  csv_import: "visible",
  roadmap: "visible",
  single_profile: "visible",
  multiple_profiles: "visible",
  multi_client_workspace: "visible",
  basic_segments: "visible",
  campaigns: "roadmap_only",
  analytics: "roadmap_only",
  team_roles: "roadmap_only",
  integrations: "visible",
  payments: "hidden",
  automatic_sending: "hidden",
};

function featureConfig(
  statuses: Record<FeatureKey, FeatureStatus>,
  visibilityOverrides: Partial<Record<FeatureKey, FeatureVisibility>> = {},
): Record<FeatureKey, FeatureAccessConfig> {
  return FEATURE_KEYS.reduce(
    (config, featureKey) => ({
      ...config,
      [featureKey]: {
        status: statuses[featureKey],
        visibility:
          featureKey === "automatic_sending"
            ? "hidden"
            : visibilityOverrides[featureKey] ?? DEFAULT_VISIBILITY[featureKey],
      },
    }),
    {} as Record<FeatureKey, FeatureAccessConfig>,
  );
}

const pilotUpgradeTargets: Partial<Record<FeatureKey, PlanId>> = {
  single_profile: "starter",
  multiple_profiles: "growth",
  basic_segments: "growth",
  analytics: "growth",
  multi_client_workspace: "agency",
};

const starterUpgradeTargets: Partial<Record<FeatureKey, PlanId>> = {
  multiple_profiles: "growth",
  basic_segments: "growth",
  analytics: "growth",
  team_roles: "agency",
  multi_client_workspace: "agency",
};

const growthUpgradeTargets: Partial<Record<FeatureKey, PlanId>> = {
  multi_client_workspace: "agency",
  team_roles: "agency",
  analytics: "agency",
};

export const PLANS: Record<PlanId, PlanConfig> = {
  pilot: {
    id: "pilot",
    name: "Interne Demo",
    badge: "Nicht öffentlich buchbar",
    priceLabel: "Nur interner Demo-/Legacy-Zugang",
    mode: "demo",
    maxProfiles: 0,
    maxContacts: null,
    contactsLabel: "Demo-Daten",
    description:
      "Interner Demo-/Legacy-Zugang. Kein öffentlich buchbares Paket; produktive Kunden wählen Starter Flex oder Starter 12 Monate.",
    primaryAction: "Demo starten",
    upgradePlan: "starter",
    featureConfig: featureConfig({
      login: "active",
      dashboard: "demo",
      contacts: "demo",
      contact_detail: "demo",
      sandra_demo: "active",
      ai_replies: "demo",
      memory: "demo",
      followups: "demo",
      csv_import: "preview",
      roadmap: "active",
      single_profile: "upgrade",
      multiple_profiles: "upgrade",
      multi_client_workspace: "upgrade",
      basic_segments: "upgrade",
      campaigns: "coming_soon",
      analytics: "upgrade",
      team_roles: "hidden",
      integrations: "demo",
      payments: "hidden",
      automatic_sending: "hidden",
    }),
    upgradeTargets: pilotUpgradeTargets,
  },
  starter: {
    id: "starter",
    name: "Starter",
    badge: "Produktiver MVP-Workspace",
    priceLabel: "Legacy Starter: 0 € Setup + 312 €/Monat · Capacity-v2 Ziel: 99 / 199 / 312 €/Monat, jeweils ohne Einrichtungsgebühr",
    mode: "production",
    maxProfiles: 1,
    maxContacts: 1000,
    contactsLabel: "bis 1.000 Kontakte",
    description:
      "Produktiver Workspace für ein Profil. Neue Capacity-v2 Pakete kosten 99 / 199 / 312 € pro Monat und haben keine Einrichtungsgebühr. Der bestehende Starter-Pfad bleibt nur als Legacy-/Migrationsbasis erhalten, bis Capacity-v2 kontrolliert aktiviert ist.",
    primaryAction: "Starter wählen",
    upgradePlan: "growth",
    featureConfig: featureConfig({
      login: "active",
      dashboard: "active",
      contacts: "active",
      contact_detail: "active",
      sandra_demo: "active",
      ai_replies: "limited",
      memory: "active",
      followups: "active",
      csv_import: "active",
      roadmap: "active",
      single_profile: "active",
      multiple_profiles: "upgrade",
      multi_client_workspace: "upgrade",
      basic_segments: "upgrade",
      campaigns: "coming_soon",
      analytics: "upgrade",
      team_roles: "upgrade",
      integrations: "preview",
      payments: "hidden",
      automatic_sending: "hidden",
    }),
    upgradeTargets: starterUpgradeTargets,
  },
  growth: {
    id: "growth",
    name: "Growth",
    badge: "Coming Soon / Vorschau",
    priceLabel: "Coming Soon",
    mode: "production",
    maxProfiles: 5,
    maxContacts: 10000,
    contactsLabel: "Coming Soon / Vorschau",
    description:
      "Coming Soon / Roadmap-Vorschau für mehrere Profile, Basis-Segmente und wachsende Teams; noch nicht produktiv buchbar und ohne aktive Feature-Zusage.",
    primaryAction: "Growth Vorschau",
    upgradePlan: "agency",
    featureConfig: featureConfig({
      login: "preview",
      dashboard: "preview",
      contacts: "preview",
      contact_detail: "preview",
      sandra_demo: "preview",
      ai_replies: "preview",
      memory: "preview",
      followups: "preview",
      csv_import: "preview",
      roadmap: "preview",
      single_profile: "preview",
      multiple_profiles: "preview",
      multi_client_workspace: "preview",
      basic_segments: "preview",
      campaigns: "coming_soon",
      analytics: "coming_soon",
      team_roles: "coming_soon",
      integrations: "coming_soon",
      payments: "hidden",
      automatic_sending: "hidden",
    }),
    upgradeTargets: growthUpgradeTargets,
  },
  agency: {
    id: "agency",
    name: "Agency",
    badge: "Coming Soon / Roadmap",
    priceLabel: "Coming Soon",
    mode: "agency",
    maxProfiles: null,
    maxContacts: null,
    contactsLabel: "Coming Soon / Roadmap",
    description:
      "Roadmap-Vorschau für mehrere Profile oder Kunden-Workspaces. Multi-Client, Rollen, Analytics und Kampagnen bleiben im MVP als Vorschau markiert und werden nicht produktiv freigeschaltet.",
    primaryAction: "Agency anfragen",
    featureConfig: featureConfig({
      login: "preview",
      dashboard: "preview",
      contacts: "preview",
      contact_detail: "preview",
      sandra_demo: "preview",
      ai_replies: "preview",
      memory: "preview",
      followups: "preview",
      csv_import: "preview",
      roadmap: "preview",
      single_profile: "preview",
      multiple_profiles: "preview",
      multi_client_workspace: "preview",
      basic_segments: "preview",
      campaigns: "coming_soon",
      analytics: "coming_soon",
      team_roles: "coming_soon",
      integrations: "coming_soon",
      payments: "hidden",
      automatic_sending: "hidden",
    }),
    upgradeTargets: {},
  },
};
