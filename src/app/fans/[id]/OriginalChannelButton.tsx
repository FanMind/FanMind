"use client";

import { useState } from "react";
import type { FanMindLanguage } from "@/lib/fanmindCopy";
import dashboardStyles from "../../dashboard/dashboard.module.css";
import styles from "./fan-detail.module.css";

type OriginalChannelButtonProps = {
  href: string | null;
  label: string;
  locale: FanMindLanguage;
  demoConnectionsDisabled: boolean;
};

export function OriginalChannelButton({
  href,
  label,
  locale,
  demoConnectionsDisabled,
}: OriginalChannelButtonProps) {
  const [message, setMessage] = useState<string | null>(null);

  const closeLabel = locale === "en" ? "Got it" : "Verstanden";
  const demoMessage =
    locale === "en"
      ? "You are not redirected because you are in the demo version. In a real workspace, FanMind would open the matching original channel here."
      : "Sie werden nicht weitergeleitet, da Sie sich in der Demoversion befinden. In einem echten Workspace würde FanMind hier den passenden Originalkanal öffnen.";
  const unavailableMessage =
    locale === "en"
      ? "Original channel link is not available yet."
      : "Originalkanal-Link noch nicht verfügbar.";

  function handlePreparedClick() {
    setMessage(demoConnectionsDisabled ? demoMessage : unavailableMessage);
  }

  return (
    <>
      {href && !demoConnectionsDisabled ? (
        <a
          className={dashboardStyles.secondaryButton}
          href={href}
          rel="noreferrer"
          target="_blank"
        >
          {label}
        </a>
      ) : (
        <button
          className={dashboardStyles.secondaryButton}
          onClick={handlePreparedClick}
          type="button"
        >
          {label}
        </button>
      )}
      {message ? (
        <div
          aria-labelledby="original-channel-dialog-title"
          aria-modal="true"
          className={styles.originalChannelModalBackdrop}
          role="dialog"
        >
          <div className={styles.originalChannelModal}>
            <h4 id="original-channel-dialog-title">
              {locale === "en" ? "Original channel" : "Originalkanal"}
            </h4>
            <p>{message}</p>
            <button
              className={dashboardStyles.primaryButton}
              onClick={() => setMessage(null)}
              type="button"
            >
              {closeLabel}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
