"use client";

import { useState } from "react";
import styles from "./BillingCheckoutButton.module.css";

export function BillingPortalButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function openPortal() {
    setBusy(true);
    setError(false);
    try {
      const response = await fetch("/api/billing/portal", { method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: "{}" });
      const payload = await response.json() as { url?: string };
      const url = new URL(payload.url ?? "");
      if (!response.ok || url.origin !== "https://billing.stripe.com" || url.username || url.password) throw new Error();
      window.location.assign(url.href);
    } catch { setError(true); } finally { setBusy(false); }
  }
  return <div className={styles.wrap}>
    <button type="button" className={styles.button} onClick={openPortal} disabled={busy}>
      {busy ? "Rechnungsportal wird geöffnet …" : "Rechnungsportal öffnen"}
    </button>
    {error ? <p className={styles.error} role="alert">Das Rechnungsportal konnte nicht geöffnet werden. Bitte erneut versuchen.</p> : null}
  </div>;
}
