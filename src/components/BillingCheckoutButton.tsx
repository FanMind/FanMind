"use client";

import Link from "next/link";
import { useState } from "react";
import type { PlanId } from "@/config/plans";
import styles from "./BillingCheckoutButton.module.css";

type CheckoutErrorKind = "session" | "payment" | "plan" | "generic";

type CheckoutMessage = {
  kind: CheckoutErrorKind;
  text: string;
};

function getCheckoutMessage(status: number, error?: string, code?: string): CheckoutMessage {
  if (status === 401) {
    return { kind: "session", text: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an, um die Zahlung fortzusetzen." };
  }

  if (status === 503 && code === "stripe_billing_write_frozen") {
    return {
      kind: "payment",
      text: error ?? "Zahlungen sind während eines kurzen Wartungsfensters vorübergehend pausiert. Bitte versuche es gleich erneut.",
    };
  }

  if (status === 503) {
    return { kind: "payment", text: "Die Zahlung ist aktuell noch nicht vollständig konfiguriert. Bitte kontaktiere FanMind." };
  }

  if (status === 400) {
    return { kind: "plan", text: "Deine Zahlungsoption konnte nicht eindeutig zugeordnet werden. Bitte kontaktiere FanMind." };
  }

  return { kind: "generic", text: error ?? "Die Zahlung konnte nicht gestartet werden. Bitte kontaktiere FanMind." };
}

export function BillingCheckoutButton({ planId, commercialOption, label = "Weiter zur Zahlung", showHint = true, hint = "Du wirst zur sicheren Zahlungsseite weitergeleitet." }: { planId: PlanId; commercialOption: string; label?: string; showHint?: boolean; hint?: string }) {
  const [message, setMessage] = useState<CheckoutMessage | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (planId !== "pilot" && planId !== "starter") return null;
  if (!["pilot_only", "starter_paid_setup", "starter_no_setup_commitment"].includes(commercialOption)) return null;

  async function startCheckout() {
    setIsLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ planId, commercialOption }),
      });
      const payload = await response.json().catch(() => ({})) as { url?: string; error?: string; code?: string };
      if (payload.url) {
        window.location.href = payload.url;
        return;
      }
      setMessage(getCheckoutMessage(response.status, payload.error, payload.code));
    } catch {
      setMessage({ kind: "generic", text: "Die Zahlung konnte nicht gestartet werden. Bitte kontaktiere FanMind." });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <button className={styles.button} type="button" onClick={startCheckout} disabled={isLoading}>
        {isLoading ? "Zahlung wird vorbereitet …" : label}
      </button>
      {showHint ? <p className={styles.hint}>{hint}</p> : null}
      {message ? (
        <div className={styles.error} role="alert">
          <p>{message.text}</p>
          {message.kind === "session" ? <Link className={styles.loginLink} href="/login?returnTo=/billing/start">Erneut anmelden</Link> : null}
        </div>
      ) : null}
    </div>
  );
}
