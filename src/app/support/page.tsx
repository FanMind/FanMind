import type { Metadata } from "next";
import { FanMindLogo } from "@/components/FanMindLogo";
import styles from "../account-deletion/account-deletion.module.css";

export const metadata: Metadata = {
  title: "Support",
  description:
    "Hilfe, Kontakt und sichere Supportwege für die FanMind Web- und Mobile-App.",
};

const SUPPORT_MAIL =
  "mailto:kontakt@fanmind.ch?subject=FanMind%20App%20Support";

export default function SupportPage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <FanMindLogo href="/" ariaLabel="FanMind Startseite öffnen" />
          <p className={styles.eyebrow}>FanMind Support</p>
          <h1>Hilfe für Web- und Mobile-App</h1>
          <p>
            Hier findest du die direkten Wege für technische Fragen, Login-
            Probleme, Datenschutz und die Löschung deines FanMind-Accounts.
          </p>
        </header>

        <section className={styles.card} aria-labelledby="support-contact-title">
          <h2 id="support-contact-title">Support kontaktieren</h2>
          <p>
            Beschreibe kurz, auf welchem Gerät und bei welchem Schritt das Problem
            auftritt. Sende niemals dein Passwort, einen Recovery-Link, API-Schlüssel
            oder vollständige Kunden- und Kontaktdaten per E-Mail.
          </p>
          <div className={styles.actions}>
            <a className={styles.primary} href={SUPPORT_MAIL}>
              kontakt@fanmind.ch
            </a>
            <a className={styles.secondary} href="/login">
              Zum Login
            </a>
          </div>
        </section>

        <section className={styles.card} aria-labelledby="support-account-title">
          <h2 id="support-account-title">Account und Datenschutz</h2>
          <p>
            Passwort-Recovery beginnt über den Login. Die vollständige
            Account-Löschung kannst du in der App oder im geschützten Webbereich
            einleiten. Die öffentlichen Informationen sind ohne Login erreichbar.
          </p>
          <div className={styles.actions}>
            <a className={styles.secondary} href="/forgot-password">
              Passwort zurücksetzen
            </a>
            <a className={styles.secondary} href="/account-deletion">
              Account löschen
            </a>
            <a className={styles.secondary} href="/datenschutz">
              Datenschutz
            </a>
          </div>
        </section>

        <section className={styles.card} aria-labelledby="support-details-title">
          <h2 id="support-details-title">Hilfreiche Angaben</h2>
          <ul>
            <li>App-Version und Betriebssystem;</li>
            <li>Android oder iPhone beziehungsweise verwendeter Browser;</li>
            <li>der letzte sichtbare Schritt vor dem Fehler;</li>
            <li>eine anonymisierte Fehlermeldung ohne sensible Inhalte.</li>
          </ul>
          <p className={styles.note}>
            FanMind fordert dich im Support niemals zur Übermittlung deines
            Passworts oder eines vollständigen Recovery-Links auf.
          </p>
        </section>
      </div>
    </main>
  );
}
