import type { Metadata } from "next";
import Link from "next/link";
import LegalTopHeader from "@/components/LegalTopHeader";
import styles from "../impressum/impressum.module.css";

export const metadata: Metadata = {
  title: "Auftragsverarbeitungsvereinbarung (AVV) | FanMind",
  description:
    "Status, Anforderung und Mindestinhalte der Auftragsverarbeitungsvereinbarung für FanMind.",
};

const avvMailto =
  "mailto:fanmind@fanmind.ch?subject=AVV%20f%C3%BCr%20FanMind%20anfordern&body=Bitte%20sendet%20mir%20die%20aktuelle%20Auftragsverarbeitungsvereinbarung%20f%C3%BCr%20meinen%20FanMind-Workspace.%0A%0AUnternehmen%20%2F%20Organisation%3A%0AAnsprechperson%3A%0AWorkspace%20oder%20Pilot%3A%0AGew%C3%BCnschter%20Starttermin%3A";

export default function AvvPage() {
  return (
    <main id="top" className={styles.page}>
      <div className={styles.watermark} aria-hidden="true" />
      <LegalTopHeader active="avv" />
      <div className={styles.shell}>
        <header className={styles.hero}>
          <h1>AVV</h1>
          <p className={styles.eyebrow}>
            Auftragsverarbeitungsvereinbarung
          </p>
          <p>
            Klare Vertragsgrundlage, bevor echte Kontaktdaten im Auftrag eines
            FanMind-Kunden verarbeitet werden.
          </p>
        </header>

        <article
          className={styles.legalContent}
          aria-label="Status und Anforderung der FanMind AVV"
        >
          <section className={styles.section} aria-labelledby="avv-status">
            <h2 id="avv-status">Aktueller Status</h2>
            <p>
              Diese Seite ersetzt keine unterschriebene AVV. Sie beschreibt
              transparent, wie die aktuelle Vertragsfassung angefordert wird
              und welche Mindestinhalte vor einer produktiven Verarbeitung
              echter Drittpersonendaten geklärt sein müssen.
            </p>
            <p>
              Die jeweils verbindliche Fassung wird vor Unterzeichnung mit den
              dann freigegebenen Betreiberangaben, Leistungen und
              Unterauftragsverarbeitern bereitgestellt.
            </p>
          </section>

          <section className={styles.section} aria-labelledby="avv-wann">
            <h2 id="avv-wann">Wann wird eine AVV benötigt?</h2>
            <p>
              Eine AVV ist insbesondere vor einem Pilot- oder Produktivbetrieb
              mit echten Kontakt-, Nachrichten- oder Follow-up-Daten zu prüfen,
              wenn FanMind diese Daten im Auftrag des jeweiligen Kunden
              verarbeitet.
            </p>
            <p>
              Für reine öffentliche Produktdemos mit Beispieldaten gilt
              weiterhin: Keine echten personenbezogenen Daten eingeben.
            </p>
          </section>

          <section className={styles.section} aria-labelledby="avv-inhalte">
            <h2 id="avv-inhalte">Vorgesehene Mindestinhalte</h2>
            <p>
              Die Vertragsfassung soll insbesondere Gegenstand und Dauer der
              Verarbeitung, Weisungsbindung, Datenarten und Personengruppen,
              Vertraulichkeit, technische und organisatorische Maßnahmen,
              Unterauftragsverarbeiter, Unterstützung bei Betroffenenrechten
              und Sicherheitsvorfällen sowie Löschung oder Rückgabe der Daten
              regeln.
            </p>
            <p>
              Maßgeblich sind ausschließlich die Inhalte der von beiden Seiten
              bestätigten Vertragsfassung.
            </p>
          </section>

          <section className={styles.section} aria-labelledby="avv-anfordern">
            <h2 id="avv-anfordern">AVV anfordern</h2>
            <p>
              Sende Unternehmen beziehungsweise Organisation, Ansprechperson,
              gewünschten FanMind-Plan und geplanten Starttermin an unser Team.
            </p>
            <p>
              <a href={avvMailto}>Aktuelle AVV per E-Mail anfordern</a>
            </p>
            <p>
              Ergänzende Informationen findest du in der{" "}
              <Link href="/datenschutz">Datenschutzerklärung</Link> und im{" "}
              <Link href="/impressum">Impressum</Link>.
            </p>
          </section>
        </article>
      </div>
      <a
        className={styles.backToTop}
        href="#top"
        aria-label="Zurück nach oben"
      >
        ↑
      </a>
    </main>
  );
}
