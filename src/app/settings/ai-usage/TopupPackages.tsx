"use client";

import { useRef, useState } from "react";

export function TopupPackages({ enabled, locale, options }: {
  enabled: boolean; locale: "de" | "en"; options: Array<{ key: string; label: string; amountCents: number }>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const attempt = useRef<{ key: string; id: string } | null>(null);
  const text = (de: string, en: string) => locale === "en" ? en : de;
  async function buy(key: string) {
    if (pending) return;
    setPending(true); setError("");
    if (attempt.current?.key !== key) attempt.current = { key, id: crypto.randomUUID() };
    try {
      const response = await fetch("/api/billing/topup", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ topupKey: key, requestId: attempt.current.id }) });
      const result = await response.json();
      if (!response.ok || typeof result.url !== "string" || new URL(result.url).origin !== "https://checkout.stripe.com") throw new Error();
      window.location.assign(result.url);
    } catch {
      setError(text("Der Kauf konnte nicht gestartet werden. Bitte erneut versuchen.", "Checkout could not be started. Please try again."));
      setPending(false);
    }
  }
  return <section aria-labelledby="topup-title">
    <h3 id="topup-title">{text("Datenpakete", "Data packages")}</h3>
    <p>{text("Einmaliger Kauf, kein Abo und keine automatische Nachladung. Preise zuzüglich anwendbarer Umsatzsteuer. Guthaben wird erst nach bestätigter Zahlung gutgeschrieben.",
      "One-time purchase, no subscription or automatic repurchase. Prices exclude applicable VAT. Capacity is credited only after confirmed payment.")}</p>
    {!enabled && <p>{text("Der Datenpaketkauf ist noch nicht freigegeben.", "Data package purchases are not enabled yet.")}</p>}
    <ul>{options.map(option => <li key={option.key}>
      <strong>{option.label}</strong>{" · "}{new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(option.amountCents / 100)}{" "}
      <button type="button" disabled={!enabled || pending} onClick={() => buy(option.key)}>
        {text("Einmalig kaufen", "Buy once")}
      </button>
    </li>)}</ul>
    {error && <p role="alert">{error}</p>}
  </section>;
}
