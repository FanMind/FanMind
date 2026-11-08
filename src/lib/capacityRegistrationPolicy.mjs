import { STRIPE_AI_TOPUP_OPTIONS } from "./stripeAiTopupPolicy.mjs";
import { AI_CAPACITY_PUBLIC_PACKAGES, AI_CAPACITY_PACKAGE_IDS } from "../config/aiCapacityPackages.mjs";

// A public selection is an account preference, never a paid entitlement.
export function isCapacityRegistrationPackage(value) {
  return AI_CAPACITY_PACKAGE_IDS.includes(value);
}

export function resolveCapacityRegistrationPackage(value) {
  return isCapacityRegistrationPackage(value) ? value : "capacity_99";
}

export function capacityRegistrationPackages(language = "de") {
  const english = language === "en";
  return AI_CAPACITY_PACKAGE_IDS.map((id) => {
    const price = AI_CAPACITY_PUBLIC_PACKAGES[id].monthlyPriceCents / 100;
    return Object.freeze({
      id,
      name: `FanMind ${price}`,
      price: english ? `€${price}/month` : `${price} €/Monat`,
      setup: english ? "€0 setup" : "0 € Einrichtung",
      status: english ? "Paid activation in preparation" : "Bezahlte Aktivierung in Vorbereitung",
    });
  });
}

export function capacityRegistrationHref({ packageId, language = "de", referralCode = "" } = {}) {
  const query = new URLSearchParams({ plan: resolveCapacityRegistrationPackage(packageId) });
  if (language === "en") query.set("lang", "en");
  if (typeof referralCode === "string" && referralCode.trim()) query.set("ref", referralCode.trim());
  return `/register?${query}`;
}

export function capacityLandingPlans(language = "de") {
  const english = language === "en";
  return capacityRegistrationPackages(language).map((plan, index) => ({
    icon: ["♙", "◎", "◇"][index],
    name: plan.name,
    eyebrow: plan.setup,
    audience: english ? "Create your free account and save your package preference." : "Lege dein kostenloses Konto an und merke dein gewünschtes Paket vor.",
    pricePrefix: "",
    price: plan.price,
    cadence: english ? "monthly · no setup fee" : "monatlich · keine Einrichtungsgebühr",
    cta: english ? "Create free account" : "Kostenloses Konto anlegen",
    href: capacityRegistrationHref({ packageId: plan.id, language }),
    tone: ["blue", "green", "purple"][index],
    featured: index === 1,
    status: english ? "Preview" : "Vorschau",
    features: [plan.setup, plan.status,
      english ? "No subscription starts with registration" : "Kein Abo durch die Registrierung",
      english ? "No automatic sending" : "Kein automatischer Versand"],
  }));
}

export function capacityDataPackages(language = "de") {
  return Object.entries(STRIPE_AI_TOPUP_OPTIONS).map(([id, option]) => ({
    id, name: `FanMind Datenpaket ${id.slice(6)}`,
    price: new Intl.NumberFormat(language === "en" ? "en-IE" : "de-AT", {style: "currency", currency: "EUR"}).format(option.saleAmountCents / 100),
    type: "one_time",
  }));
}

export function capacityPricingKnowledge() {
  return `${capacityRegistrationPackages().map(p => `${p.name}: ${p.price}`).join("; ")}. Alle drei Monatspakete ohne Einrichtungsgebühr. Nettopreise; anwendbare Steuern werden vor Zahlung ausgewiesen. ${capacityDataPackages().map(p => `${p.name}: ${p.price} einmalig`).join("; ")}. Registrierung kostenlos, kein Abo. Kostenpflichtige Aktivierung und Datenpaketverkauf werden vorbereitet und benötigen gesonderte Bestätigung. Bestehende Verträge bleiben unverändert. Keine zugesagten Nachrichtenmengen oder neuen Mindestlaufzeiten.`;
}
