import { BillingCheckoutButton } from "@/components/BillingCheckoutButton";
import { ComingSoonMark } from "@/components/ComingSoonMark";
import { AI_TIER_IDS, formatAiTierPrice, getAiTierConfig } from "@/config/aiTiers.mjs";
import {
  getBillingCheckoutActionLabel,
  shouldShowBillingCheckoutAction,
} from "@/lib/billing";
import { getCommercialOptionLabel, getWorkspacePlanLabel } from "@/lib/dashboardFeatures";
import { resolvePublicWorkspacePlanId } from "@/lib/publicDailyPlanPolicy.mjs";
import { getBillingStatusLabel } from "@/lib/billing";
import { resolveSubscriptionCancellation } from "@/lib/subscriptionCancellation";
import type { CustomerInvoiceSummary } from "@/lib/customerBilling";
import type {
  SupabaseServerUser,
  WorkspaceDashboardRow,
} from "@/lib/supabase/server";
import type { FanMindLanguage } from "@/lib/fanmindCopy";
import type { FanMindBrightness } from "@/lib/userPreferences";
import { AccountTabs, SETTINGS_ACCOUNT_TABS, type SettingsAccountPage } from "./AccountTabs";
export type { SettingsAccountPage } from "./AccountTabs";
import { SettingsPreferenceForm } from "./SettingsPreferenceForm";
import dashboardStyles from "../dashboard/dashboard.module.css";
import profileStyles from "./profile/profile.module.css";
export type ProfileField = {
  label: string;
  value: string;
  source: "real" | "placeholder";
  group: "personal" | "workspace" | "tax";
};

const EMPTY_VALUE = "Noch nicht hinterlegt";

type PackageCard = {
  key: string;
  name: string;
  price: string;
  description: string;
  features: string[];
  badge: "Aktuell" | "Verfügbar" | "Coming Soon";
  planId: "pilot" | "starter";
  commercialOption: string;
  requestMode: "checkout_if_unpaid" | "request" | "contact";
  showComingSoonMark?: boolean;
};

type AddOnCard = {
  key: string;
  name: string;
  purpose: string;
  status: "Nicht aktiv" | "Aktiv" | "Coming Soon" | "Auf Anfrage";
  price: string;
  features?: string[];
  showComingSoonMark?: boolean;
};

const BASE_PACKAGE_CARDS: PackageCard[] = [
  {
    key: "starter_paid_setup",
    name: "Starter Flex",
    price: "990 € Setup + 312 €/Monat",
    description: "Für laufende FanMind-Nutzung ohne Mindestlaufzeit; Kündigung zum Ende des bezahlten Abrechnungsmonats.",
    features: [
      "jederzeit zum Monatsende kündbar",
      "laufender Monat vollständig zahlbar",
      "produktiver CRM-Kern",
      "Copy-&-Open Workflow",
    ],
    badge: "Verfügbar",
    planId: "starter",
    commercialOption: "starter_paid_setup",
    requestMode: "checkout_if_unpaid",
  },
  {
    key: "starter_no_setup_commitment",
    name: "Starter 12 Monate",
    price: "0 € Setup + 312 €/Monat",
    description:
      "Für Nutzer, die fix starten und Setup-Kosten vermeiden wollen.",
    features: [
      "12 Monate Mindestlaufzeit",
      "danach Verlängerung um jeweils einen Monat",
      "produktiver CRM-Kern",
      "Planungssicherheit",
    ],
    badge: "Verfügbar",
    planId: "starter",
    commercialOption: "starter_no_setup_commitment",
    requestMode: "checkout_if_unpaid",
  },
  {
    key: "internal_daily_test",
    name: "Daily",
    price: "0 € Setup + 1 €/Tag",
    description: "FanMind mit täglicher Abrechnung ohne Einrichtungsgebühr.",
    features: ["täglich kündbar", "keine Einrichtungsgebühr", "kein Referral-Rabatt", "Copy-&-Open Workflow"],
    badge: "Verfügbar",
    planId: "pilot",
    commercialOption: "internal_daily_test",
    requestMode: "checkout_if_unpaid",
  },
  {
    key: "growth",
    name: "Growth",
    price: "Coming Soon",
    description:
      "Roadmap-Paket für wachsende Teams; noch nicht produktiv buchbar.",
    features: [
      "Coming Soon",
      "Roadmap-Vorschau",
      "keine aktive Freischaltung",
    ],
    badge: "Coming Soon",
    planId: "starter",
    commercialOption: "growth",
    requestMode: "contact",
    showComingSoonMark: true,
  },
];

const AI_ADD_ON_CARDS: AddOnCard[] = AI_TIER_IDS.map((tierId) => {
  const tier = getAiTierConfig(tierId);
  return {
    key: `ai_${tier.id}`,
    name: tier.name,
    purpose: tier.description,
    status: tier.publicStatus,
    price: formatAiTierPrice(tier),
    features: [...tier.features],
    showComingSoonMark: tier.publicStatus === "Coming Soon",
  };
});

const ADD_ON_CARDS: AddOnCard[] = [
  ...AI_ADD_ON_CARDS,
  {
    key: "reach_analysis",
    name: "Reichweitenanalyse",
    purpose:
      "Vorbereitete Auswertung für Reichweite und Resonanz ohne Voll-Analytics-Suite.",
    status: "Nicht aktiv",
    price: "auf Anfrage",
    features: ["vorbereitet", "manuelle Prüfung"],
    showComingSoonMark: true,
  },
  {
    key: "campaign_insights",
    name: "Kampagnen-Insights",
    purpose: "Spätere Einordnung von Kampagnenwirkung ohne Versandautomation.",
    status: "Coming Soon",
    price: "auf Anfrage",
    features: ["Roadmap-Vorschau", "keine Versandautomation"],
    showComingSoonMark: true,
  },
  {
    key: "custom",
    name: "Custom Add-on",
    purpose: "Musterplatz für geprüfte Zusatzmodule oder Pilotwünsche.",
    status: "Auf Anfrage",
    price: "auf Anfrage",
    features: ["individueller Wunsch", "manuelle Freigabe"],
    showComingSoonMark: true,
  },
];

function getPackageCards(workspace: WorkspaceDashboardRow): PackageCard[] {
  return BASE_PACKAGE_CARDS.map((card) => ({
    ...card,
    badge:
      workspace.commercial_option === card.commercialOption
        ? "Aktuell"
        : card.badge,
  }));
}

function getAddOnChipClass(status: AddOnCard["status"]): string {
  if (status === "Aktiv") return profileStyles.statusChip;
  if (status === "Coming Soon") return profileStyles.mutedBadge;
  if (status === "Auf Anfrage") return profileStyles.warningChip;
  return profileStyles.softChip;
}

function getPackageRequestHref(
  workspace: WorkspaceDashboardRow,
  card: PackageCard,
): string {
  const subject = encodeURIComponent(
    `FanMind Planwechsel anfragen: ${card.name}`,
  );
  const body = encodeURIComponent(
    [
      `Workspace: ${workspace.name}`,
      `Aktuelles Paket: ${getPlanLabel(workspace)}`,
      `Gewünschtes Paket: ${card.name}`,
      "Bitte prüft den sicheren Billing-/Checkout-Flow und meldet euch mit den nächsten Schritten.",
    ].join("\n"),
  );

  return `mailto:kontakt@fanmind.ch?subject=${subject}&body=${body}`;
}

function getAddOnRequestHref(
  workspace: WorkspaceDashboardRow,
  addOn: AddOnCard,
  action: "add" | "cancel",
): string {
  const actionLabel =
    action === "add" ? "Hinzufügen anfragen" : "Kündigung anfragen";
  const subject = encodeURIComponent(
    `FanMind Add-on ${actionLabel}: ${addOn.name}`,
  );
  const body = encodeURIComponent(
    [
      `Workspace: ${workspace.name}`,
      `Add-on: ${addOn.name}`,
      `Aktion: ${actionLabel}`,
      "Bitte prüft die Abrechnung manuell. Es soll keine automatische Abbuchung ohne bestätigten Flow erfolgen.",
    ].join("\n"),
  );

  return `mailto:kontakt@fanmind.ch?subject=${subject}&body=${body}`;
}

export function getSettingsAccountPageTitle(
  activePage: SettingsAccountPage,
): string {
  return (
    SETTINGS_ACCOUNT_TABS.find((item) => item.key === activePage)?.label ??
    "Profil"
  );
}

export function getSettingsAccountPageHref(
  activePage: SettingsAccountPage,
): string {
  return (
    SETTINGS_ACCOUNT_TABS.find((item) => item.key === activePage)?.href ??
    "/settings/profile"
  );
}

export function getPlanLabel(workspace: WorkspaceDashboardRow): string {
  if (resolvePublicWorkspacePlanId(workspace) === "daily") return getWorkspacePlanLabel(workspace);
  if (
    workspace.plan_id === "pilot" &&
    workspace.commercial_option === "pilot_only"
  )
    return "Pilot / Setup";
  return getCommercialOptionLabel(workspace.commercial_option);
}

export function getProfileFields(
  user: SupabaseServerUser,
  workspace: WorkspaceDashboardRow,
  userDisplayName: string,
  locale: FanMindLanguage,
): ProfileField[] {
  const email =
    typeof user.email === "string" && user.email.trim()
      ? user.email.trim()
      : EMPTY_VALUE;
  const workspaceName = workspace.name?.trim() || EMPTY_VALUE;
  const metadata = user.user_metadata ?? {};
  const value = (...keys: string[]) => {
    for (const key of keys) {
      const candidate = metadata[key];
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
    return EMPTY_VALUE;
  };
  const field = (label: string, fieldValue: string, group: ProfileField["group"]): ProfileField => ({
    label,
    value: fieldValue,
    source: fieldValue === EMPTY_VALUE ? "placeholder" : "real",
    group,
  });

  return [
    field("Anzeigename / Name", userDisplayName, "personal"),
    field("E-Mail", email, "personal"),
    field("Telefon", value("phone", "phone_number", "telephone"), "personal"),
    field("Sprache", locale === "en" ? "English" : "Deutsch", "personal"),
    field("Rolle / Zielgruppe", value("role_audience", "role", "target_group", "audience"), "personal"),
    field("Workspace-Name", workspaceName, "workspace"),
    field("Unternehmen / Club / Creator", workspace.organization_name?.trim() || (value("organization", "organisation", "company", "club", "creator_name") === EMPTY_VALUE ? workspaceName : value("organization", "organisation", "company", "club", "creator_name")), "workspace"),
    field("Straße / Hausnummer", workspace.street_address?.trim() || value("street", "address_street", "street_address"), "workspace"),
    field("PLZ", workspace.postal_code?.trim() || value("postal_code", "zip", "address_zip"), "workspace"),
    field("Ort", workspace.city?.trim() || value("city", "address_city", "locality"), "workspace"),
    field("Land", workspace.country?.trim() || value("country", "address_country"), "workspace"),
    field("UID / VAT ID", workspace.vat_id?.trim() || value("vat_id", "uid", "tax_id"), "tax"),
    field("Steuernummer", workspace.tax_number?.trim() || value("tax_number"), "tax"),
    field("Firmenbuchnummer", workspace.company_register_number?.trim() || value("company_register_number", "commercial_register_number"), "tax"),
    field("Firmenbuchgericht", workspace.company_register_court?.trim() || value("company_register_court", "commercial_register_court"), "tax"),
  ];
}

export function SettingsHeaderBar({
  activePage,
  locale = "de",
}: {
  activePage: SettingsAccountPage;
  locale?: FanMindLanguage;
}) {
  return <AccountTabs activePage={activePage} locale={locale} />;
}

function formatMoney(cents?: number | null): string {
  return typeof cents === "number"
    ? (cents / 100).toLocaleString("de-DE", {
        style: "currency",
        currency: "EUR",
      })
    : "—";
}

function formatDate(value?: string | null): string {
  return value ? new Date(value).toLocaleDateString("de-DE") : "—";
}

export function ProfileSettingsSection({
  fields,
  hasOnlyRealValues,
  preferencesAction,
  locale,
  brightness,
  preferencesError,
  personalAction,
  workspaceAction,
  taxAction,
  profileSaved,
  workspaceSaved,
  taxSaved,
  personalError,
  workspaceError,
  taxError,
}: {
  fields: ProfileField[];
  hasOnlyRealValues: boolean;
  preferencesAction: (formData: FormData) => void;
  personalAction: (formData: FormData) => void;
  workspaceAction: (formData: FormData) => void;
  taxAction: (formData: FormData) => void;
  profileSaved?: boolean;
  workspaceSaved?: boolean;
  taxSaved?: boolean;
  personalError?: string | null;
  workspaceError?: string | null;
  taxError?: string | null;
  locale: FanMindLanguage;
  brightness: FanMindBrightness;
  preferencesError?: string | null;
}) {
  const valueFor = (label: string) => fields.find((field) => field.label === label)?.value ?? "";
  const inputValue = (label: string) => {
    const value = valueFor(label);
    return value === EMPTY_VALUE ? "" : value;
  };
  const input = (name: string, label: string, maxLength: number, readOnly = false, type = "text") => (
    <label className={profileStyles.formField}>
      <span>{label}</span>
      <input name={name} type={type} defaultValue={inputValue(label)} maxLength={maxLength} readOnly={readOnly} aria-readonly={readOnly} />
    </label>
  );

  return (
    <div className={profileStyles.profileGrid}>
      <section className={profileStyles.compactCard} aria-labelledby="personal-profile-title">
        <div className={profileStyles.cardHeader}>
          <div>
            <p className={dashboardStyles.eyebrow}>Profil</p>
            <h2 id="personal-profile-title">Persönliche Daten</h2>
          </div>
          <span className={profileStyles.softChip}>{hasOnlyRealValues ? "Vollständig" : "Editierbar"}</span>
        </div>
        <p className={profileStyles.headerCopy}>E-Mail bleibt geschützt und read-only. Diese Karte speichert nur Name, Telefon und Rolle/Zielgruppe.</p>
        {profileSaved ? <p className={profileStyles.successNotice}>Persönliche Daten wurden gespeichert.</p> : null}
        {personalError ? <p className={dashboardStyles.error}>{personalError}</p> : null}
        <form action={personalAction} className={profileStyles.profileForm}>
          <div className={profileStyles.formGrid}>
            {input("displayName", "Anzeigename / Name", 120)}
            {input("email", "E-Mail", 180, true, "email")}
            {input("phone", "Telefon", 40, false, "tel")}
            {input("roleAudience", "Rolle / Zielgruppe", 120)}
          </div>
          <div className={profileStyles.actionRow}><button type="submit" className={profileStyles.smallSaveButton}>Persönliche Daten speichern</button></div>
        </form>
      </section>

      <section className={profileStyles.compactCard} aria-labelledby="workspace-profile-title">
        <div className={profileStyles.cardHeader}>
          <div>
            <p className={dashboardStyles.eyebrow}>Workspace</p>
            <h2 id="workspace-profile-title">Workspace / Unternehmen</h2>
          </div>
          <span className={profileStyles.softChip}>Stammdaten</span>
        </div>
        <p className={profileStyles.headerCopy}>Diese Karte aktualisiert nur Workspace-Name, Organisation und Adresse.</p>
        {workspaceSaved ? <p className={profileStyles.successNotice}>Workspace-Stammdaten wurden gespeichert.</p> : null}
        {workspaceError ? <p className={dashboardStyles.error}>{workspaceError}</p> : null}
        <form action={workspaceAction} className={profileStyles.profileForm}>
          <div className={profileStyles.formGrid}>
            {input("workspaceName", "Workspace-Name", 120)}
            {input("organizationName", "Unternehmen / Club / Creator", 160)}
            {input("streetAddress", "Straße / Hausnummer", 180)}
            {input("postalCode", "PLZ", 24)}
            {input("city", "Ort", 100)}
            {input("country", "Land", 80)}
          </div>
          <div className={profileStyles.actionRow}><button type="submit" className={profileStyles.smallSaveButton}>Workspace speichern</button></div>
        </form>
      </section>

      <section className={profileStyles.compactCard} aria-labelledby="tax-profile-title">
        <div className={profileStyles.cardHeader}>
          <div>
            <p className={dashboardStyles.eyebrow}>Steuern</p>
            <h2 id="tax-profile-title">Steuerdaten</h2>
          </div>
          <span className={profileStyles.softChip}>Separat</span>
        </div>
        <p className={profileStyles.headerCopy}>Diese Karte speichert ausschließlich UID/VAT ID, Steuernummer und Registerdaten.</p>
        {taxSaved ? <p className={profileStyles.successNotice}>Steuerdaten wurden gespeichert.</p> : null}
        {taxError ? <p className={dashboardStyles.error}>{taxError}</p> : null}
        <form action={taxAction} className={profileStyles.profileForm}>
          <div className={profileStyles.formGrid}>
            {input("vatId", "UID / VAT ID", 40)}
            {input("taxNumber", "Steuernummer", 60)}
            {input("companyRegisterNumber", "Firmenbuchnummer", 80)}
            {input("companyRegisterCourt", "Firmenbuchgericht", 120)}
          </div>
          <div className={profileStyles.actionRow}><button type="submit" className={profileStyles.smallSaveButton}>Steuerdaten speichern</button></div>
        </form>
      </section>

      <section className={profileStyles.compactCard} aria-labelledby="preference-profile-title">
        <div className={profileStyles.cardHeader}>
          <div>
            <p className={dashboardStyles.eyebrow}>Einstellungen</p>
            <h2 id="preference-profile-title">Sprache & Helligkeit</h2>
          </div>
          <span className={profileStyles.softChip}>Preference-Logik</span>
        </div>
        {preferencesError ? <p className={dashboardStyles.error}>{preferencesError}</p> : null}
        <SettingsPreferenceForm action={preferencesAction} locale={locale} brightness={brightness} returnTo="/settings/profile" formClassName={profileStyles.profilePreferenceForm} buttonClassName={profileStyles.profilePreferenceButton} />
      </section>

      <section className={profileStyles.compactCard} aria-labelledby="gdpr-profile-title">
        <div className={profileStyles.cardHeader}>
          <div>
            <p className={dashboardStyles.eyebrow}>{locale === "en" ? "Privacy" : "DSGVO"}</p>
            <h2 id="gdpr-profile-title">{locale === "en" ? "Data disclosure" : "Datenauskunft"}</h2>
          </div>
          <span className={profileStyles.warningChip}>Sicherer Flow</span>
        </div>
        <p className={profileStyles.headerCopy}>{locale === "en" ? "The PDF contains the account, authorized workspace, contacts, stored Meta chats/comments, owned post caches, metric snapshots and analysis profiles. Secrets, tokens and data from other workspaces are excluded." : "Die PDF enthält Konto, autorisierten Workspace, Kontakte, gespeicherte Meta-Chats/Kommentare, eigene Post-Caches, Metrik-Snapshots und Analyseprofile. Secrets, Tokens und Daten anderer Workspaces sind ausgeschlossen."}</p>
        <div className={profileStyles.actionRowSplit}>
          <a className={profileStyles.mailButton} href={`/settings/profile/data-export?lang=${locale}`}>{locale === "en" ? "Download PDF data disclosure" : "PDF-Datenauskunft herunterladen"}</a>
          <a className={profileStyles.mailButton} href="/settings/account-deletion">{locale === "en" ? "Delete account and data" : "Account und Daten löschen"}</a>
        </div>
      </section>
    </div>
  );
}


export function PackageSettingsSection({
  workspace,
  cancelAction,
  revokeCancelAction,
  cancelError,
  cancelSaved,
}: {
  workspace: WorkspaceDashboardRow;
  cancelAction: () => Promise<void>;
  revokeCancelAction: () => Promise<void>;
  cancelError?: string | null;
  cancelSaved?: string | null;
}) {
  const packageCards = getPackageCards(workspace);
  const cancellation = resolveSubscriptionCancellation(workspace);
  const hasCancellation = Boolean(workspace.subscription_cancel_requested_at);

  return (
    <section aria-labelledby="package-profile-title">
      <h2 id="package-profile-title" className={profileStyles.visuallyHidden}>
        Hauptpakete und Add-ons
      </h2>
      <div className={profileStyles.managementCard} aria-labelledby="subscription-management-title">
        <div className={profileStyles.cardHeader}>
          <div>
            <p className={dashboardStyles.eyebrow}>Abo verwalten</p>
            <h3 id="subscription-management-title">Vertrag & Kündigung</h3>
          </div>
          <span className={hasCancellation ? profileStyles.warningChip : profileStyles.statusChip}>{hasCancellation ? "Kündigung vorgemerkt" : getBillingStatusLabel(workspace.billing_status)}</span>
        </div>
        {cancelError ? <p className={dashboardStyles.error}>{cancelError}</p> : null}
        {cancelSaved ? <p className={profileStyles.successNotice}>{cancelSaved}</p> : null}
        <dl className={profileStyles.subscriptionGrid}>
          <div><dt>Aktuelles Paket</dt><dd>{cancellation.currentPackage}</dd></div>
          <div><dt>Vertragsstatus</dt><dd>{hasCancellation ? "Kündigung vorgemerkt" : getBillingStatusLabel(workspace.billing_status)}</dd></div>
          <div><dt>Mindestlaufzeit</dt><dd>{formatDate(cancellation.minimumTermEndsAt)}</dd></div>
          <div><dt>Nächstes Abrechnungsdatum</dt><dd>{formatDate(cancellation.nextBillingAt)}</dd></div>
          <div><dt>Mögliches Kündigungsdatum</dt><dd>{formatDate(cancellation.possibleCancellationAt)}</dd></div>
          <div><dt>Wirksames Vertragsende</dt><dd>{formatDate(workspace.subscription_effective_end_at ?? cancellation.effectiveEndAt)}</dd></div>
        </dl>
        <p className={profileStyles.headerCopy}>Account und Login bleiben erhalten. Keine sofortige Abschaltung während bezahlter oder gebundener Zeiträume; nach Vertragsende wird der Workspace in einen Archiv-/Lesemodus versetzt.</p>
        {hasCancellation ? (
          <form action={revokeCancelAction} className={profileStyles.actionRow}>
            <button type="submit" className={profileStyles.packageButton}>Kündigung zurücknehmen</button>
          </form>
        ) : (
          <details className={profileStyles.cancelBox}>
            <summary>Zum Vertragsende kündigen</summary>
            <p>Bestätigung: FanMind kündigt dieses Abo zum wirksamen Vertragsende {formatDate(cancellation.effectiveEndAt)}. Der Account wird nicht gelöscht; DSGVO-Löschung ist ein separater Prozess.</p>
            <form action={cancelAction}><button type="submit" className={profileStyles.dangerButton} disabled={!cancellation.canSelfService}>Zum Vertragsende kündigen</button></form>
          </details>
        )}
      </div>

      <div className={profileStyles.packageCardGrid}>
        {packageCards.map((card) => {
          const isCurrent = card.badge === "Aktuell";
          const canStartCheckout =
            isCurrent &&
            shouldShowBillingCheckoutAction(workspace);
          const isComingSoon = card.badge === "Coming Soon";
          const requestLabel =
            workspace.billing_status === "demo_free" ? "Auswählen" : "Wechseln";
          return (
            <article
              className={`${profileStyles.packageCard} ${isCurrent ? profileStyles.packageCardCurrent : ""}`}
              key={card.key}
            >
              <div className={profileStyles.packageCardTop}>
                <h3>{card.name}</h3>
                <span
                  className={
                    isCurrent
                      ? profileStyles.statusChip
                      : card.badge === "Coming Soon"
                        ? profileStyles.mutedBadge
                        : profileStyles.softChip
                  }
                >
                  {card.badge}
                </span>
              </div>
              {!isComingSoon ? (
                <p className={profileStyles.packagePrice}>{card.price}</p>
              ) : null}
              <p className={profileStyles.packageDescription}>
                {card.description}
              </p>
              <ul className={profileStyles.packageFeatureList}>
                {card.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              {card.showComingSoonMark ? (
                <div className={profileStyles.cardMarkSlot}>
                  <ComingSoonMark
                    size="small"
                    className={profileStyles.settingsComingSoonMark}
                  />
                </div>
              ) : null}
              {isComingSoon ? null : isCurrent ? (
                <>
                  {canStartCheckout ? (
                    <BillingCheckoutButton
                      planId={card.planId}
                      commercialOption={card.commercialOption}
                      label={getBillingCheckoutActionLabel(
                        workspace.billing_status,
                      )}
                      showHint={false}
                    />
                  ) : (
                    <span className={profileStyles.packageButtonDisabled}>
                      Aktuell
                    </span>
                  )}
                </>
              ) : (
                <a
                  className={profileStyles.packageButton}
                  href={getPackageRequestHref(workspace, card)}
                >
                  {card.requestMode === "contact"
                    ? "Planwechsel anfragen"
                    : requestLabel}
                </a>
              )}
            </article>
          );
        })}
      </div>

      <div className={profileStyles.packageSectionHeader}>
        <div>
          <p className={profileStyles.invoiceLabel}>Zusatzpakete / Add-ons</p>
          <p className={profileStyles.invoiceValue}>
            KI Standard ist im Basispaket enthalten. KI Plus und KI Ultra sind
            separat berechnete Erweiterungen und bleiben bis zur Preis-,
            Kontingent- und Billing-Freigabe als Coming Soon markiert.
          </p>
        </div>
      </div>
      <div className={profileStyles.addOnGrid}>
        {ADD_ON_CARDS.map((addOn) => {
          const showStatusBadge = true;

          return (
            <article className={profileStyles.addOnCard} key={addOn.key}>
              <div className={profileStyles.packageCardTop}>
                <h3>{addOn.name}</h3>
                {showStatusBadge ? (
                  <span className={getAddOnChipClass(addOn.status)}>
                    {addOn.status}
                  </span>
                ) : null}
              </div>
              <p className={profileStyles.packageDescription}>{addOn.purpose}</p>
              {addOn.features ? (
                <ul className={profileStyles.packageFeatureList}>
                  {addOn.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              ) : null}
              <p className={profileStyles.addOnPrice}>{addOn.price}</p>
              {addOn.showComingSoonMark ? (
                <div className={profileStyles.cardMarkSlot}>
                  <ComingSoonMark
                    size="small"
                    className={profileStyles.settingsComingSoonMark}
                  />
                </div>
              ) : null}
              {addOn.status === "Aktiv" || addOn.showComingSoonMark ? null : (
                <a
                  className={profileStyles.packageButton}
                  href={getAddOnRequestHref(workspace, addOn, "add")}
                >
                  Anfragen
                </a>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function InvoicesSettingsSection({
  invoices,
  invoiceError,
  taxNote,
}: {
  invoices: CustomerInvoiceSummary[];
  invoiceError: string | null;
  taxNote: string | null;
}) {
  const hasDemoInvoices = invoices.some((invoice) => invoice.isDemo);

  return (
    <section
      className={profileStyles.invoiceTableSection}
      aria-labelledby="invoice-table-title"
    >
      <h2 id="invoice-table-title" className={profileStyles.visuallyHidden}>
        Rechnungsübersicht
      </h2>
      {invoiceError ? (
        <p className={dashboardStyles.error}>{invoiceError}</p>
      ) : null}
      {hasDemoInvoices ? (
        <p className={profileStyles.invoiceDemoNotice}>
          <span className={profileStyles.warningChip}>Demo</span>{" "}
          Beispielrechnung – keine echte Forderung
        </p>
      ) : null}
      <div className={profileStyles.invoiceTableWrap}>
        <table className={profileStyles.invoiceTable}>
          <thead>
            <tr>
              <th scope="col">Datum</th>
              <th scope="col">Rechnungsnummer / Stripe Invoice ID</th>
              <th scope="col">Status</th>
              <th scope="col">Betrag fällig</th>
              <th scope="col">Betrag bezahlt</th>
              <th scope="col">Steuer / USt-Hinweis</th>
              <th scope="col" className={profileStyles.invoiceActionsHeader}>
                Aktionen
              </th>
            </tr>
          </thead>
          <tbody>
            {invoices.length ? (
              invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{formatDate(invoice.created)}</td>
                  <td>
                    <strong>{invoice.number ?? invoice.id}</strong>
                    {invoice.description ? (
                      <small>{invoice.description}</small>
                    ) : (
                      <small>{invoice.number ? invoice.id : null}</small>
                    )}
                    {invoice.isDemo ? (
                      <span className={profileStyles.invoiceDemoBadge}>
                        Demo
                      </span>
                    ) : null}
                  </td>
                  <td>
                    <span className={profileStyles.softChip}>
                      {invoice.status ?? "offen"}
                    </span>
                  </td>
                  <td>{formatMoney(invoice.amountDue)}</td>
                  <td>{formatMoney(invoice.amountPaid)}</td>
                  <td>
                    {formatMoney(invoice.tax)}
                  </td>
                  <td>
                    <div className={profileStyles.invoiceTableActions}>
                      {invoice.hostedInvoiceUrl ? (
                        <a
                          href={invoice.hostedInvoiceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Ansehen
                        </a>
                      ) : (
                        <span
                          title={
                            invoice.isDemo
                              ? "Demo-Ansicht: keine echte Stripe-Rechnung."
                              : undefined
                          }
                        >
                          Ansehen
                        </span>
                      )}
                      {invoice.invoicePdf ? (
                        <a
                          href={invoice.invoicePdf}
                          target="_blank"
                          rel="noreferrer"
                        >
                          PDF
                        </a>
                      ) : (
                        <span title={invoice.pdfHint ?? undefined}>PDF</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className={profileStyles.invoiceEmptyCell}>
                  Noch keine Rechnungen vorhanden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {taxNote ? (
        <p className={profileStyles.invoiceFootnote}>{taxNote}</p>
      ) : null}
    </section>
  );
}
