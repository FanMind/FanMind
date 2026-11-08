"use client";

import { useState } from "react";
import { capacityRegistrationPackages, capacityDataPackages, resolveCapacityRegistrationPackage } from "@/lib/capacityRegistrationPolicy.mjs";
import styles from "@/app/register/register.module.css";

/** Local preference only. No Workspace write, payment consent or Checkout. */
export function CapacityPackageSelection({ language = "de", preference }: { language?: string; preference?: unknown }) {
  const [selected, setSelected] = useState(resolveCapacityRegistrationPackage(preference));
  const english = language === "en";
  return <section>
    <fieldset className={styles.commercialOptions}>
      <legend>{english ? "Monthly packages" : "Monatspakete"}</legend>
      {capacityRegistrationPackages(language).map(plan => <label key={plan.id} className={`${styles.optionCard} ${selected === plan.id ? styles.optionCardSelected : ""}`}>
        <input type="radio" name="capacityPackagePreference" value={plan.id} checked={selected === plan.id} onChange={() => setSelected(plan.id)} />
        <span className={styles.optionMarker} aria-hidden="true">✓</span>
        <span><strong>{plan.name} · {plan.price}</strong><small>{plan.setup}</small>
          {selected === plan.id && <em className={styles.selectedOptionLabel}>{english ? "Selected" : "Ausgewählt"}</em>}
        </span>
      </label>)}
    </fieldset>
    <p>{english ? "Net prices; applicable tax is shown before payment. Paid activation is being prepared. This selection starts no subscription and does not change your existing contract." : "Nettopreise; anwendbare Steuern werden vor der Zahlung ausgewiesen. Die bezahlte Aktivierung wird vorbereitet. Diese Auswahl startet kein Abo und ändert keinen bestehenden Vertrag."}</p>
    <p>{english ? "The packages include monthly AI capacity. Fast, Balanced and Premium use the same capacity pool. No fixed number of messages is promised." : "Die Pakete enthalten monatliche KI-Kapazität. Schnell, Ausgewogen und Premium nutzen denselben Kapazitätspool. Es wird keine feste Anzahl an Nachrichten zugesagt."}</p>
    <h3>{english ? "One-time data packages" : "Einmalige Datenpakete"}</h3>
    <ul>{capacityDataPackages(language).map(plan => <li key={plan.id}>{plan.name}: {plan.price} · {english ? "one-time, no subscription" : "einmalig, kein Abo"}</li>)}</ul>
    <p>{english ? "Data package sales are being prepared and require separate confirmation." : "Der Verkauf der Datenpakete wird vorbereitet und erfordert eine gesonderte Bestätigung."}</p>
  </section>;
}
