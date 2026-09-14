"use client";

import { FormEvent, use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient, syncSupabaseSessionForServer } from "@/lib/supabase/client";
import { isPlanId, resolvePlanId, type CommercialOption, type ProductiveCommercialOption } from "@/lib/plans";
import { buildRegistrationAccountMetadata, buildWebRegistrationRedirect, registrationErrorMessage } from "@/lib/webRegistrationPolicy.mjs";
import { isPublicDailyRegistrationRequest } from "@/lib/publicDailyPlanPolicy.mjs";
import type { PlanId } from "@/config/plans";
import FeatureStatusLabel, { type FeatureStatusLabelVariant } from "@/components/FeatureStatusLabel";
import { FanMindLogo } from "@/components/FanMindLogo";
import { fanmindCopy, getFanMindLanguage, landingPath, localizedPath, type FanMindLanguage } from "@/lib/fanmindCopy";
import { ComingSoonMark } from "@/components/ComingSoonMark";
import {
  buildRegistrationHref,
  isDailyTestRegistration,
  isProductiveRegistrationEntry,
  normalizeStarterOfferOption,
} from "@/lib/registrationEntryPolicy.mjs";
import styles from "./register.module.css";

type RegisterPlanId = PlanId;
type StarterOfferOptionId = "starter_paid_setup" | "starter_no_setup_commitment";

type RegisterPageProps = {
  searchParams: Promise<{ lang?: string | string[]; plan?: string | string[]; option?: string | string[]; ref?: string | string[]; referral_code?: string | string[]; test_plan?: string | string[] }> | { lang?: string | string[]; plan?: string | string[]; option?: string | string[]; ref?: string | string[]; referral_code?: string | string[]; test_plan?: string | string[] };
  enablePublicDailyTestPlan: boolean;
  paidActivationAvailable: boolean;
};

type PlanSelectionCopy = {
  label: string;
  badge: string;
  title: string;
  price: string;
  description: string;
  bullets: string[];
  href: string;
  cta: string;
};

function planStatusVariant(planId: RegisterPlanId): FeatureStatusLabelVariant {
  if (planId === "growth") return "preview";
  if (planId === "agency") return "roadmap";
  return "active";
}

type StarterOptionCopy = {
  id: StarterOfferOptionId;
  title: string;
  price: string;
  description: string;
  bullets: string[];
  badge?: string;
};

const ACTIVE_REGISTER_PLANS: RegisterPlanId[] = ["starter"];

function firstParamValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function planCommercialOption(planId: RegisterPlanId, starterOption: StarterOfferOptionId): CommercialOption | StarterOfferOptionId {
  if (planId === "pilot") return "pilot_only";
  if (planId === "starter") return starterOption;
  if (planId === "growth") return "growth_preview";
  return "agency_preview";
}

function LanguageSwitch({
  language,
  planId,
  starterOption,
  referralCode,
  testPlan,
}: {
  language: FanMindLanguage;
  planId: RegisterPlanId;
  starterOption: StarterOfferOptionId;
  referralCode: string;
  testPlan?: "daily";
}) {
  return (
    <div className={styles.languageSwitch} aria-label={language === "en" ? "Language selection" : "Sprachauswahl"}>
      <a className={language === "de" ? styles.languageActive : undefined} href={buildRegistrationHref({ language: "de", planId, starterOption, referralCode, testPlan })} aria-current={language === "de" ? "true" : undefined}>DE</a>
      <span>|</span>
      <a className={language === "en" ? styles.languageActive : undefined} href={buildRegistrationHref({ language: "en", planId, starterOption, referralCode, testPlan })} aria-current={language === "en" ? "true" : undefined}>EN</a>
    </div>
  );
}

function isPreviewPlan(planId: RegisterPlanId) {
  return planId === "growth" || planId === "agency";
}

function showPlanStatusBadge(planId: RegisterPlanId) {
  return !isPreviewPlan(planId);
}

function getPlanSelectionCopy(
  language: FanMindLanguage,
  enablePublicDailyTestPlan: boolean,
  starterOption: StarterOfferOptionId,
  referralCode: string,
): PlanSelectionCopy[] {
  if (language === "en") {
    return [
      {
        label: "1",
        badge: "Active",
        title: "Choose Starter",
        price: "€312/month",
        description: "Two options for your productive start.",
        bullets: ["Starter Flex: €990 setup", "Starter 12 months: €0 setup"],
        href: buildRegistrationHref({ language, planId: "starter", starterOption, referralCode }),
        cta: "Choose Starter",
      },
      ...(enablePublicDailyTestPlan ? [{
        label: "3",
        badge: "Daily",
        title: "Daily",
        price: "€0 setup + €1/day",
        description: "Daily billing with no setup fee.",
        bullets: ["cancel daily", "no referral discount"],
        href: buildRegistrationHref({ language, planId: "pilot", referralCode, testPlan: "daily" }),
        cta: "Choose Daily",
      }] : []),
      {
        label: enablePublicDailyTestPlan ? "4" : "3",
        badge: "Preview",
        title: "Growth",
        price: "Coming Soon",
        description: "Roadmap preview.",
        bullets: ["Roadmap"],
        href: buildRegistrationHref({ language, planId: "growth", referralCode }),
        cta: "Learn more",
      },
      {
        label: enablePublicDailyTestPlan ? "5" : "4",
        badge: "Demo",
        title: "Agency",
        price: "Coming Soon",
        description: "Roadmap preview.",
        bullets: ["Roadmap"],
        href: buildRegistrationHref({ language, planId: "agency", referralCode }),
        cta: "Learn more",
      },
    ];
  }

  return [
    {
      label: "1",
      badge: "Aktiv",
      title: "Starter wählen",
      price: "312 €/Monat",
      description: "Zwei Optionen für deinen Produktivstart.",
      bullets: ["Starter Flex: 990 € Setup", "Starter 12 Monate: 0 € Setup"],
      href: buildRegistrationHref({ language, planId: "starter", starterOption, referralCode }),
      cta: "Starter wählen",
    },
    ...(enablePublicDailyTestPlan ? [{
      label: "3",
      badge: "Tagestarif",
      title: "Daily",
      price: "0 € Setup + 1 €/Tag",
      description: "Tägliche Abrechnung ohne Einrichtungsgebühr.",
      bullets: ["täglich kündbar", "kein Referral-Rabatt"],
      href: buildRegistrationHref({ language, planId: "pilot", referralCode, testPlan: "daily" }),
      cta: "Daily wählen",
    }] : []),
    {
      label: enablePublicDailyTestPlan ? "4" : "3",
      badge: "Vorschau",
      title: "Growth",
      price: "Coming Soon",
      description: "Roadmap-Vorschau.",
      bullets: ["Roadmap"],
      href: buildRegistrationHref({ language, planId: "growth", referralCode }),
      cta: "Mehr erfahren",
    },
    {
      label: enablePublicDailyTestPlan ? "5" : "4",
      badge: "Demo",
      title: "Agency",
      price: "Coming Soon",
      description: "Roadmap-Vorschau.",
      bullets: ["Roadmap"],
      href: buildRegistrationHref({ language, planId: "agency", referralCode }),
      cta: "Mehr erfahren",
    },
  ];
}

function getStarterOptionsCopy(language: FanMindLanguage): StarterOptionCopy[] {
  if (language === "en") {
    return [
      {
        id: "starter_paid_setup",
        title: "Starter Flex",
        price: "€990 setup + €312/month",
        description: "Cancel any time at the end of the paid billing month",
        bullets: ["€990 one-time setup", "full current month remains payable"],
      },
      {
        id: "starter_no_setup_commitment",
        title: "Starter 12 months",
        price: "€0 setup + €312/month",
        description: "12-month minimum term, then renews monthly",
        bullets: ["no setup fee", "monthly renewal after month 12"],
      },
    ];
  }

  return [
    {
      id: "starter_paid_setup",
      title: "Starter Flex",
      price: "990 € Setup + 312 €/Monat",
      description: "Jederzeit zum Ende des bezahlten Abrechnungsmonats kündbar",
      bullets: ["990 € einmalige Einrichtung", "laufender Monat wird vollständig bezahlt"],
    },
    {
      id: "starter_no_setup_commitment",
      title: "Starter 12 Monate",
      price: "0 € Setup + 312 €/Monat",
      description: "12 Monate Mindestlaufzeit, danach monatliche Verlängerung",
      bullets: ["keine Einrichtungsgebühr", "nach 12 Monaten monatlich verlängerbar"],
    },
  ];
}

export default function RegisterClient({ searchParams, enablePublicDailyTestPlan, paidActivationAvailable }: RegisterPageProps) {
  const params = searchParams instanceof Promise ? use(searchParams) : searchParams;
  const language = getFanMindLanguage(params.lang);
  const rawPlan = firstParamValue(params.plan);
  const referralCodeFromUrl = firstParamValue(params.ref) ?? firstParamValue(params.referral_code) ?? "";
  const dailyRequested = isPublicDailyRegistrationRequest({ planId: rawPlan, testPlan: firstParamValue(params.test_plan) });
  const requestedTestPlan = dailyRequested ? "daily" : firstParamValue(params.test_plan);
  const requestedStarterOption = normalizeStarterOfferOption(firstParamValue(params.option));
  const hasInvalidPlan = Boolean(rawPlan && rawPlan !== "daily" && !isPlanId(rawPlan));
  const resolvedPlanId = dailyRequested ? "pilot" : resolvePlanId(rawPlan, "starter");
  const isDailyTestPlanSelected = isDailyTestRegistration({
    enabled: enablePublicDailyTestPlan,
    planId: resolvedPlanId,
    testPlan: requestedTestPlan,
  });
  const isRetiredPilotRequested = resolvedPlanId === "pilot" && !isDailyTestPlanSelected;
  const selectedPlanId = isRetiredPilotRequested ? "starter" : resolvedPlanId;
  const isProductiveRegistration =
    ACTIVE_REGISTER_PLANS.includes(selectedPlanId) ||
    isProductiveRegistrationEntry({
      enabled: enablePublicDailyTestPlan,
      planId: selectedPlanId,
      testPlan: requestedTestPlan,
    });
  const copy = fanmindCopy[language].register;
  const setupHref = language === "en" ? "/workspace/setup?lang=en" : "/workspace/setup";
  const loginHref = `${localizedPath("/login", language)}${language === "en" ? "&" : "?"}returnTo=${encodeURIComponent(setupHref)}`;
  const paymentTermsHref = language === "en" ? "/zahlungsbedingungen?lang=en" : "/zahlungsbedingungen";
  const starterOptionsCopy = getStarterOptionsCopy(language);
  const [starterOption, setStarterOption] =
    useState<StarterOfferOptionId>(requestedStarterOption);
  const planSelectionCopy = getPlanSelectionCopy(
    language,
    enablePublicDailyTestPlan,
    starterOption,
    referralCodeFromUrl,
  );
  const [success, setSuccess] = useState(false);
  const [awaitingEmailConfirmation, setAwaitingEmailConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [resendReady, setResendReady] = useState(false);
  useEffect(() => {
    if (!pendingEmail || resendReady) return;
    const timer = window.setTimeout(() => setResendReady(true), 60_000);
    return () => window.clearTimeout(timer);
  }, [pendingEmail, resendReady]);
  const router = useRouter();
  const commercialOption = isDailyTestPlanSelected ? "internal_daily_test" : planCommercialOption(selectedPlanId, starterOption);

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || success) return;
    if (!isProductiveRegistration || (selectedPlanId !== "pilot" && selectedPlanId !== "starter")) {
      setError(language === "en" ? "Please select Starter to create an account." : "Bitte wähle Starter, um ein Konto anzulegen.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const commercialOptionValue = String(formData.get("commercialOption") ?? starterOption);
    const selectedCommercialOption: ProductiveCommercialOption | StarterOfferOptionId = isDailyTestPlanSelected
      ? "internal_daily_test"
      : normalizeStarterOfferOption(commercialOptionValue);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: buildWebRegistrationRedirect(window.location.origin, language),
          data: buildRegistrationAccountMetadata({
            name: formData.get("name"), organization: formData.get("organisation"),
            role: formData.get("rolle"), message: formData.get("nachricht"),
            language, planId: selectedPlanId, commercialOption: selectedCommercialOption,
            referralCode: String(formData.get("referralCode") ?? referralCodeFromUrl),
          }),
        },
      });
      if (authError) { setError(registrationErrorMessage(authError, language)); return; }
      if (!data.user) { setError(registrationErrorMessage(null, language)); return; }
      // Supabase deliberately obfuscates an already registered account. Do not
      // claim a newly created account until a real authenticated session exists.
      setSuccess(true);
      setAwaitingEmailConfirmation(!data.session);
      if (!data.session) { setPendingEmail(email); return; }
      try {
        await syncSupabaseSessionForServer(data.session);
        router.push(setupHref);
        router.refresh();
      } catch {
        setError(language === "en"
          ? "Your account is ready. Please sign in to continue. Do not register again."
          : "Dein Konto ist bereit. Bitte melde dich an, um fortzufahren. Registriere dich nicht erneut.");
      }
    } catch (authError) {
      setError(registrationErrorMessage(authError, language));
    } finally { setIsSubmitting(false); }
  }

  async function resendConfirmation() {
    if (!pendingEmail || !resendReady || isSubmitting) return;
    setResendReady(false);
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await createSupabaseBrowserClient().auth.resendSignup({
        email: pendingEmail,
        emailRedirectTo: buildWebRegistrationRedirect(window.location.origin, language),
      });
      if (result.error) setError(registrationErrorMessage(result.error, language));
    } catch (error) { setError(registrationErrorMessage(error, language)); }
    finally { setIsSubmitting(false); }
  }

  return (
    <main className={styles.page}>
      <div className={styles.gridPattern} aria-hidden="true" />
      <section className={styles.shell} aria-label={language === "en" ? "FanMind access" : "FanMind Zugang"}>
        <header className={styles.header}>
          <FanMindLogo className={styles.logo} compact href={landingPath(language)} ariaLabel={language === "en" ? "Open FanMind homepage" : "FanMind Startseite öffnen"} />
          <nav className={styles.topLinks} aria-label="Registrierung Navigation">
            <LanguageSwitch
              language={language}
              planId={selectedPlanId}
              starterOption={starterOption}
              referralCode={referralCodeFromUrl}
              testPlan={isDailyTestPlanSelected ? "daily" : undefined}
            />
            <span>{copy.loginPrompt}</span>
            <a href={loginHref}>{copy.loginLink}</a>
          </nav>
        </header>

        <div className={styles.authGrid}>
          <aside className={styles.visualPanel} aria-label={language === "en" ? "Package logic" : "Paketlogik"}>
            <div className={styles.planIntro}>
              <p className={styles.eyebrow}>{language === "en" ? "Your FanMind account" : "Dein FanMind-Konto"}</p>
              <h1>{language === "en" ? "Choose your package" : "Wähle dein Paket"}</h1>
              <p>{language === "en" ? "Your choice is saved as a preference. You confirm the package after signing in." : "Deine Auswahl wird vorgemerkt. Du bestätigst das Paket nach der Anmeldung."}</p>
            </div>

            {hasInvalidPlan && (
              <p className={styles.warning} role="status">
                {language === "en" ? `Unknown package “${rawPlan}”. Starter is shown instead.` : `Unbekanntes Paket „${rawPlan}“. Starter wird stattdessen angezeigt.`}
              </p>
            )}
            {isRetiredPilotRequested && (
              <p className={styles.warning} role="status">
                {language === "en" ? "The former paid pilot offer is closed. Starter is shown instead." : "Das frühere entgeltliche Pilotangebot ist geschlossen. Stattdessen wird Starter angezeigt."}
              </p>
            )}

            <div className={styles.planSelection}>
              {planSelectionCopy.map((plan) => {
                const planId = plan.href.match(/plan=([^&]+)/)?.[1] as RegisterPlanId;
                const isSelected = isDailyTestPlanSelected ? plan.href.includes("plan=daily") : planId === selectedPlanId;
                return (
                  <a
                    key={plan.title}
                    className={`${styles.planCard} ${isSelected ? styles.planCardSelected : ""} ${isPreviewPlan(planId) ? styles.cardWithComingSoon : ""}`}
                    href={plan.href}
                    aria-current={isSelected ? "page" : undefined}
                  >
                    <div className={styles.planCardHeader}>
                      <span className={styles.planNumber}>{plan.label}</span>
                      {showPlanStatusBadge(planId) ? (
                        <FeatureStatusLabel variant={planStatusVariant(planId)}>{plan.badge}</FeatureStatusLabel>
                      ) : null}
                    </div>
                    <h2>{plan.title}</h2>
                    <strong>{plan.price}</strong>
                    <p>{plan.description}</p>
                    <ul>
                      {plan.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                    </ul>
                    <span className={styles.planCta}>{plan.cta} →</span>
                    {isPreviewPlan(planId) ? <ComingSoonMark size="small" className={styles.comingSoonImage} /> : null}
                  </a>
                );
              })}
            </div>
          </aside>

          {isProductiveRegistration ? (
            <form className={styles.formCard} onSubmit={handleRegister}>
              <div className={styles.formHeader}>
                <p className={styles.eyebrow}>{language === "en" ? "1 · Create account" : "1 · Konto anlegen"}</p>
                <h1>{language === "en" ? "Create your FanMind account" : "Erstelle dein FanMind-Konto"}</h1>
                <p>{language === "en" ? "Create your account for free and confirm your email address. You choose and activate your paid package separately after signing in." : "Lege dein Konto kostenlos an und bestätige deine E-Mail-Adresse. Dein kostenpflichtiges Paket bestätigst und aktivierst du anschließend separat."}</p>
              </div>
              {!paidActivationAvailable && <p className={styles.notice}>
                {language === "en" ? "Account registration is available. Paid package activation is still being prepared; your account does not start a subscription." : "Du kannst dich bereits registrieren. Die Aktivierung kostenpflichtiger Pakete wird noch vorbereitet; dein Konto startet kein Abo."}
              </p>}
              {isDailyTestPlanSelected && <p className={styles.notice}>
                <strong>{language === "en" ? "Daily · €0 setup + €1/day" : "Daily · 0 € Setup + 1 €/Tag"}</strong><br />
                {language === "en" ? "Daily billing, cancel daily. No referral discount. Your choice is saved for account setup; registration starts no subscription." : "Tägliche Abrechnung, täglich kündbar. Kein Referral-Rabatt. Deine Auswahl wird für die Einrichtung vorgemerkt; die Registrierung startet kein Abo."}
              </p>}

              {selectedPlanId === "starter" && (
                <fieldset className={styles.commercialOptions}>
                  <legend>{language === "en" ? "Starter options" : "Starter-Optionen"}</legend>
                  {starterOptionsCopy.map((option) => (
                    <label key={option.id} className={`${styles.optionCard} ${option.id === starterOption ? styles.optionCardSelected : ""}`}>
                      <input
                        type="radio"
                        name="commercialOption"
                        value={option.id}
                        checked={starterOption === option.id}
                        onChange={() => setStarterOption(option.id)}
                      />
                      <span className={styles.optionMarker} aria-hidden="true">{option.id === "starter_paid_setup" ? "A" : "B"}</span>
                      <span>
                        <span className={styles.optionTitleRow}>
                          <strong>{option.title}</strong>
                        </span>
                        <b>{option.price}</b>
                        {option.id === starterOption ? <em className={styles.selectedOptionLabel}>{language === "en" ? "Selected" : "Ausgewählt"}</em> : null}
                        <small>{option.description}</small>
                        <ul>
                          {option.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                        </ul>
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}

              {selectedPlanId !== "starter" ? <input type="hidden" name="commercialOption" value={commercialOption} /> : null}

              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>{copy.name}</span>
                  <div className={styles.inputWrap}>
                    <span aria-hidden="true">♙</span>
                    <input type="text" name="name" maxLength={120} placeholder={language === "en" ? "Your name" : "Dein Name"} autoComplete="name" />
                  </div>
                </label>

                <label className={styles.field}>
                  <span>{copy.email}</span>
                  <div className={styles.inputWrap}>
                    <span aria-hidden="true">✉</span>
                    <input type="email" name="email" maxLength={254} placeholder={language === "en" ? "Your email address" : "Deine E-Mail-Adresse"} autoComplete="email" required />
                  </div>
                </label>
              </div>

              <label className={styles.field}>
                <span>{copy.password}</span>
                <div className={styles.inputWrap}>
                  <span aria-hidden="true">▣</span>
                  <input type={showPassword ? "text" : "password"} name="password" maxLength={128} placeholder={language === "en" ? "Choose a secure password" : "Wähle ein sicheres Passwort"} autoComplete="new-password" minLength={8} required />
                  <button
                    className={styles.passwordToggle}
                    type="button"
                    aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? "◉" : "◌"}
                  </button>
                </div>
              </label>

              <div className={styles.formGrid}>
                <label className={styles.field}>
                <span>{copy.organization}</span>
                <div className={styles.inputWrap}>
                  <span aria-hidden="true">▤</span>
                  <input type="text" name="organisation" maxLength={160} placeholder={language === "en" ? "e.g. Team Arena, club or creator name" : "z. B. Team Arena, Club oder Creator-Name"} autoComplete="organization" required />
                </div>
              </label>

              <label className={styles.field}>
                <span>{copy.role}</span>
                <div className={styles.inputWrap}>
                  <span aria-hidden="true">◇</span>
                  <select name="rolle" defaultValue="" required>
                    <option value="" disabled>{language === "en" ? "Please select" : "Bitte auswählen"}</option>
                    <option>Creator</option>
                    <option>{language === "en" ? "Club or association" : "Club oder Verein"}</option>
                    <option>{language === "en" ? "Event team" : "Event-Team"}</option>
                    <option>Fan-Community</option>
                    <option>{language === "en" ? "Agency" : "Agentur"}</option>
                  </select>
                </div>
              </label>

              </div>

              <label className={`${styles.field} ${styles.referralField}`}>
                <span>{language === "en" ? "Referral code" : "Referral-Code"}</span>
                {referralCodeFromUrl ? (
                  <div className={styles.referralDetected}>
                    <strong>{language === "en" ? "Referral code detected" : "Referral-Code erkannt"}</strong>
                    <small>{language === "en" ? `Referred by ${referralCodeFromUrl}` : `Geworben durch ${referralCodeFromUrl}`}</small>
                  </div>
                ) : null}
                <div className={styles.inputWrap}>
                  <span aria-hidden="true">%</span>
                  <input type="text" name="referralCode" maxLength={80} defaultValue={referralCodeFromUrl} placeholder={language === "en" ? "Optional, e.g. FM-ABC123" : "Optional, z. B. FM-ABC123"} autoComplete="off" />
                </div>
              </label>

              <label className={styles.field}>
                <span>{copy.message}</span>
                <div className={styles.textareaWrap}>
                  <textarea name="nachricht" maxLength={2000} placeholder={language === "en" ? "What would you like to improve first with FanMind?" : "Was möchtest du mit FanMind zuerst verbessern?"} rows={1} />
                </div>
              </label>

              <p className={styles.notice}>
                {language === "en" ? "Information about how we handle your account data:" : "Informationen zum Umgang mit deinen Kontodaten:"}{" "}
                <a href={language === "en" ? "/datenschutz?lang=en" : "/datenschutz"} target="_blank" rel="noreferrer">
                  {language === "en" ? "Privacy policy" : "Datenschutzhinweise"}
                </a>
              </p>

              <button className={styles.primaryButton} type="submit" disabled={isSubmitting || success}>
                {isSubmitting ? (language === "en" ? "Creating account…" : "Konto wird erstellt…") : copy.submit} <span>→</span>
              </button>

              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}

              {success && <div className={styles.success} role="status">
                {awaitingEmailConfirmation
                  ? (language === "en"
                    ? "Please check your inbox and spam folder. Open the confirmation link, then continue with your account. If this email already has an account, please sign in or reset your password."
                    : "Bitte prüfe dein Postfach und den Spam-Ordner. Öffne den Bestätigungslink und fahre anschließend mit deinem Konto fort. Falls für diese E-Mail bereits ein Konto besteht, melde dich an oder setze dein Passwort zurück.")
                  : (language === "en" ? "Your account is ready. Continue with setup." : "Dein Konto ist bereit. Weiter zur Einrichtung.")}
                <p><a href={awaitingEmailConfirmation ? loginHref : setupHref}>{language === "en" ? "Continue with my account" : "Mit meinem Konto fortfahren"}</a></p>
                {awaitingEmailConfirmation && <button type="button" className={styles.secondaryButton}
                  disabled={!resendReady || isSubmitting} onClick={resendConfirmation}>
                  {resendReady ? (language === "en" ? "Resend confirmation email" : "Bestätigungs-E-Mail erneut senden")
                    : (language === "en" ? "Resend available after 60 seconds" : "Erneut senden nach 60 Sekunden möglich")}
                </button>}
                <p><a href={localizedPath("/forgot-password", language)}>{language === "en" ? "Forgot password?" : "Passwort vergessen?"}</a></p>
              </div>}
              <p className={styles.notice}>{language === "en" ? "Registration is free. No payment details are required. The package choice and payment terms are confirmed separately before paid activation." : "Die Registrierung ist kostenlos. Du brauchst keine Zahlungsdaten. Paketwahl und Zahlungsbedingungen bestätigst du separat vor der kostenpflichtigen Aktivierung."}</p>

              <div className={styles.footerLinks}>
                <a href={loginHref}>{copy.loginPrompt} {copy.loginLink}</a>
                <a href={landingPath(language)}>{copy.landing}</a>
                <a href={paymentTermsHref}>{language === "en" ? "Payment terms" : "Zahlungsbedingungen"}</a>
              </div>
            </form>
          ) : (
            <section className={`${styles.previewCard} ${styles.cardWithComingSoon}`} aria-label={selectedPlanId === "growth" ? "Growth Vorschau" : "Agency Demo"}>
              <p className={styles.eyebrow}>{selectedPlanId === "growth" ? (language === "en" ? "Growth preview" : "Growth Vorschau") : (language === "en" ? "Agency demo" : "Agency Demo/Erstgespräch")}</p>
              <h1>{selectedPlanId === "growth" ? "Growth" : "Agency"}</h1>
              <p>{selectedPlanId === "growth" ? (language === "en" ? "Growth is visible for planning, but it is not directly available as a productive registration in the Produkt start." : "Growth ist für die Planung sichtbar, aber zum Produkt-Start noch nicht direkt produktiv registrierbar.") : (language === "en" ? "Agency starts with a demo/intro call. It is not directly available as a productive registration in the Produkt start." : "Agency startet mit Demo/Erstgespräch. Zum Produkt-Start ist es noch nicht direkt produktiv registrierbar.")}</p>
              <div className={styles.previewNotice}>
                <FeatureStatusLabel variant={selectedPlanId === "growth" ? "preview" : "roadmap"}>
                  {selectedPlanId === "growth" ? (language === "en" ? "Preview" : "Vorschau") : "Roadmap"}
                </FeatureStatusLabel>
                <span>{language === "en" ? "Growth and Agency remain Coming Soon / roadmap previews and are not productively activated here." : "Growth und Agency bleiben Coming Soon / Roadmap-Vorschau und werden hier nicht produktiv freigeschaltet."}</span>
              </div>
              <div className={styles.previewActions}>
                <a className={styles.primaryLink} href={buildRegistrationHref({ language, planId: "starter", starterOption, referralCode: referralCodeFromUrl })}>{language === "en" ? "Start with Starter" : "Mit Starter starten"}</a>
                <a className={styles.secondaryLink} href="mailto:kontakt@fanmind.ch?subject=FanMind%20Demo%20anfragen">{language === "en" ? "Request demo" : "Zugang anfragen"}</a>
              </div>
              {error && <p className={styles.error} role="alert">{error}</p>}
              <p className={styles.notice}>{language === "en" ? "No productive Growth/Agency activation, no payment and no subscription billing are created here." : "Hier wird keine produktive Growth-/Agency-Freischaltung, keine Zahlung und keine Subscription-Abrechnung erstellt."}</p>
              <ComingSoonMark size="medium" className={styles.comingSoonImage} />
              <div className={styles.footerLinks}>
                <a href={loginHref}>{copy.loginPrompt} {copy.loginLink}</a>
                <a href={landingPath(language)}>{copy.landing}</a>
                <a href={paymentTermsHref}>{language === "en" ? "Payment terms" : "Zahlungsbedingungen"}</a>
              </div>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
