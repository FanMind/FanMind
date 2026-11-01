import Script from "next/script";

import styles from "./PublicSupportAssistant.module.css";

const INSTALLATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function PublicSupportAssistant({ language }: { language: "de" | "en" }) {
  const installationId =
    process.env.NEXT_PUBLIC_FANMIND_SUPPORT_CHAT_INSTALLATION_ID?.trim() ?? "";
  const consentVersion =
    process.env.NEXT_PUBLIC_FANMIND_SUPPORT_CHAT_CONSENT_VERSION?.trim() ?? "";
  const configured =
    INSTALLATION_ID_PATTERN.test(installationId) &&
    consentVersion.length > 0 &&
    consentVersion.length <= 80;

  if (!configured) {
    const label = language === "en" ? "Help & Support" : "Hilfe & Support";
    return (
      <a className={styles.fallback} href="/support" aria-label={label}>
        {label}
      </a>
    );
  }

  return (
    <Script
      id="fanmind-public-support-assistant"
      src="/website-chat/widget.js"
      strategy="afterInteractive"
      data-installation-id={installationId}
      data-consent-version={consentVersion}
    />
  );
}
