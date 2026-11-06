"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  FANMIND_MARKETING_CONSENT_COOKIE,
  FANMIND_MARKETING_CONSENT_MAX_AGE_SECONDS,
  isMetaPixelEnabled,
  isMetaPixelPageViewAllowed,
  isMetaPixelReferrerAllowed,
  normalizeMarketingConsent,
  normalizeMetaPixelId,
  type FanMindMarketingConsent,
} from "@/lib/metaPixelPolicy.mjs";
import {
  revokeMetaPixelConsent,
  setFanMindMarketingConsent,
} from "@/lib/metaPixel";
import { MetaPixelLoader } from "./MetaPixelLoader";
import styles from "./marketing-consent.module.css";

type FanMindLocale = "de" | "en";

type ConsentCopy = {
  settings: string;
  eyebrow: string;
  title: string;
  description: string;
  limitation: string;
  privacy: string;
  reject: string;
  accept: string;
  close: string;
  statusGranted: string;
  statusDenied: string;
};

const COPY: Record<FanMindLocale, ConsentCopy> = {
  de: {
    settings: "Datenschutz-Einstellungen",
    eyebrow: "Optionale Einwilligung",
    title: "Marketing-Messung mit Meta Pixel",
    description:
      "FanMind lädt den Meta Pixel erst, wenn du Marketing ausdrücklich erlaubst. Ohne Zustimmung wird keine Verbindung zu Meta aufgebaut.",
    limitation:
      "Aktiv ist ausschließlich PageView auf freigegebenen öffentlichen Seiten und ohne zusätzliche Eventparameter. FanMind sendet keine E-Mail-Adressen, Namen, CRM-, Kontakt- oder Nachrichteninhalte und verwendet kein erweitertes Matching.",
    privacy: "Details in der Datenschutzerklärung",
    reject: "Nur notwendige",
    accept: "Marketing erlauben",
    close: "Schließen",
    statusGranted: "Aktuelle Auswahl: Marketing erlaubt",
    statusDenied: "Aktuelle Auswahl: nur notwendige Funktionen",
  },
  en: {
    settings: "Privacy settings",
    eyebrow: "Optional consent",
    title: "Marketing measurement with Meta Pixel",
    description:
      "FanMind loads Meta Pixel only after you explicitly allow marketing. Without consent, no connection to Meta is established.",
    limitation:
      "Only PageView on approved public pages is active and it uses no additional event parameters. FanMind does not send email addresses, names, CRM, contact or message content and does not use advanced matching.",
    privacy: "Details in the privacy policy",
    reject: "Necessary only",
    accept: "Allow marketing",
    close: "Close",
    statusGranted: "Current choice: marketing allowed",
    statusDenied: "Current choice: necessary functions only",
  },
};

function persistConsent(consent: Exclude<FanMindMarketingConsent, "unset">) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${FANMIND_MARKETING_CONSENT_COOKIE}=${consent}; Path=/; Max-Age=${FANMIND_MARKETING_CONSENT_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

export function MarketingConsentManager({
  initialConsent,
  pixelId,
  locale,
}: {
  initialConsent: FanMindMarketingConsent;
  pixelId: string;
  locale: FanMindLocale;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const [locationHash, setLocationHash] = useState<string | null>(null);
  const [documentReferrer, setDocumentReferrer] = useState<string | null>(null);
  const normalizedInitialConsent = normalizeMarketingConsent(initialConsent);
  const [consent, setConsent] = useState<FanMindMarketingConsent>(
    normalizedInitialConsent,
  );
  const [panelOpen, setPanelOpen] = useState(
    normalizedInitialConsent === "unset",
  );
  const copy = COPY[locale];
  const pixelConfigured = normalizeMetaPixelId(pixelId) !== null;
  const routeEligible =
    locationHash !== null &&
    documentReferrer !== null &&
    isMetaPixelPageViewAllowed({
      pathname,
      search,
      hash: locationHash,
    }) &&
    isMetaPixelReferrerAllowed({
      referrer: documentReferrer,
      origin: typeof window === "undefined" ? "" : window.location.origin,
    });
  const pixelEnabled = useMemo(
    () => isMetaPixelEnabled({ pixelId, consent }) && routeEligible,
    [consent, pixelId, routeEligible],
  );

  useEffect(() => {
    setFanMindMarketingConsent(consent);
  }, [consent]);

  useEffect(() => {
    let active = true;
    const syncLocationContext = () => {
      if (!active) return;
      setDocumentReferrer(document.referrer);
      setLocationHash(window.location.hash);
    };

    queueMicrotask(syncLocationContext);
    window.addEventListener("hashchange", syncLocationContext);
    return () => {
      active = false;
      window.removeEventListener("hashchange", syncLocationContext);
    };
  }, []);

  useEffect(() => {
    if (
      pixelConfigured &&
      locationHash !== null &&
      documentReferrer !== null &&
      !routeEligible
    ) {
      revokeMetaPixelConsent();
    }
  }, [documentReferrer, locationHash, pixelConfigured, routeEligible]);

  function chooseDenied() {
    persistConsent("denied");
    setFanMindMarketingConsent("denied");
    revokeMetaPixelConsent();
    setConsent("denied");
    setPanelOpen(false);
  }

  function chooseGranted() {
    persistConsent("granted");
    setFanMindMarketingConsent("granted");
    setConsent("granted");
    setPanelOpen(false);
  }

  if (
    !pixelConfigured ||
    locationHash === null ||
    documentReferrer === null ||
    !routeEligible
  ) {
    return null;
  }

  return (
    <>
      {pixelEnabled ? (
        <MetaPixelLoader pixelId={pixelId} />
      ) : null}

      {panelOpen ? (
        <section
          className={styles.banner}
          role="region"
          aria-label={copy.settings}
          aria-live="polite"
          data-fanmind-marketing-consent="panel"
        >
          <div className={styles.copyColumn}>
            <p className={styles.eyebrow}>{copy.eyebrow}</p>
            <h2 className={styles.title}>{copy.title}</h2>
            <p className={styles.description}>{copy.description}</p>
            <p className={styles.limitation}>{copy.limitation}</p>
            {consent === "granted" ? (
              <p className={styles.status}>{copy.statusGranted}</p>
            ) : consent === "denied" ? (
              <p className={styles.status}>{copy.statusDenied}</p>
            ) : null}
            <Link className={styles.privacyLink} href="/datenschutz#marketing-messung">
              {copy.privacy}
            </Link>
          </div>
          <div className={styles.actions}>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={chooseDenied}
            >
              {copy.reject}
            </button>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={chooseGranted}
            >
              {copy.accept}
            </button>
            {consent !== "unset" ? (
              <button
                className={styles.closeButton}
                type="button"
                onClick={() => setPanelOpen(false)}
              >
                {copy.close}
              </button>
            ) : null}
          </div>
        </section>
      ) : (
        <button
          className={styles.preferencesButton}
          type="button"
          onClick={() => setPanelOpen(true)}
          data-fanmind-marketing-consent="settings"
        >
          {copy.settings}
        </button>
      )}
    </>
  );
}
