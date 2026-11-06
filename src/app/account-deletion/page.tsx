import type { Metadata } from "next";
import { FanMindLogo } from "@/components/FanMindLogo";
import styles from "./account-deletion.module.css";

export const metadata: Metadata = {
  title: "FanMind Account löschen",
  description:
    "Öffentlicher Einstieg zum authentifizierten Löschen eines FanMind-Accounts und der zugehörigen Daten.",
};

const LOGIN_AND_DELETE_HREF =
  "/login?returnTo=%2Fsettings%2Faccount-deletion";

export default function AccountDeletionPage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <FanMindLogo href="/" ariaLabel="FanMind Startseite öffnen" />
          <p className={styles.eyebrow}>Datenschutz & Account</p>
          <h1>FanMind-Account vollständig löschen</h1>
          <p>
            Du kannst die vollständige Löschung deines FanMind-Accounts direkt in
            der mobilen App oder über den authentifizierten Webbereich einleiten.
            Eine bloße Deaktivierung ist nicht der angebotene Löschprozess.
          </p>
        </header>

        <section className={styles.card} aria-labelledby="deletion-process-title">
          <h2 id="deletion-process-title">So funktioniert die Löschanfrage</h2>
          <ol>
            <li>Melde dich mit dem betroffenen FanMind-Account an.</li>
            <li>Bestätige deine Account-E-Mail und die angezeigte Löschphrase.</li>
            <li>
              FanMind nimmt die vollständige Löschanfrage auf und nennt den
              Bearbeitungsstatus sowie die maximale Bearbeitungsfrist von 30 Tagen.
            </li>
            <li>
              Solange die Bearbeitung noch nicht begonnen hat, kannst du die
              Anfrage nach erneuter Anmeldung widerrufen.
            </li>
          </ol>
          <div className={styles.actions}>
            <a className={styles.primary} href={LOGIN_AND_DELETE_HREF}>
              Anmelden und Löschung einleiten
            </a>
            <a className={styles.secondary} href="/datenschutz">
              Datenschutzerklärung
            </a>
          </div>
        </section>

        <section className={styles.card} aria-labelledby="deletion-scope-title">
          <h2 id="deletion-scope-title">Was gelöscht wird</h2>
          <ul>
            <li>der FanMind-Login und das Nutzerprofil;</li>
            <li>
              der eigene Workspace einschließlich Kontakte, Nachrichtenkontext,
              Kontaktwissen, Follow-ups und gespeicherter KI-Arbeitsdaten, sofern
              der Account alleiniger Owner ist;
            </li>
            <li>
              bei reiner Workspace-Mitgliedschaft die eigene Mitgliedschaft und
              das persönliche Nutzerkonto, ohne fremde Workspace-Daten zu löschen.
            </li>
          </ul>
          <p>
            Hat ein eigener Workspace weitere Mitglieder, muss die Verantwortung
            zuerst geklärt oder übertragen werden. Ein aktives oder noch laufendes
            Abo wird vor der destruktiven Bearbeitung ebenfalls geklärt, damit keine
            unbeabsichtigte Weiterbelastung entsteht.
          </p>
        </section>

        <section className={styles.card} aria-labelledby="retention-title">
          <h2 id="retention-title">Aufbewahrungsgrenzen</h2>
          <p>
            Nicht gesetzlich aufzubewahrende Kontodaten werden aus dem aktiven
            FanMind-System entfernt. Rechnungs- und steuerrechtliche Nachweise sowie
            technisch nicht selektiv bearbeitbare Sicherungskopien können den
            veröffentlichten gesetzlichen beziehungsweise technischen
            Aufbewahrungsfristen unterliegen.
          </p>
          <p className={styles.note}>
            Es ist kein Telefonanruf und keine unstrukturierte Support-E-Mail nötig,
            um die Löschung einzuleiten.
          </p>
        </section>
      </div>
    </main>
  );
}
