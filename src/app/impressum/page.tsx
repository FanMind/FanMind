import type { Metadata } from "next";
import Link from "next/link";
import LegalTopHeader from "@/components/LegalTopHeader";
import styles from "./impressum.module.css";

export const metadata: Metadata = {
  title: "Impressum / Offenlegung | FanMind",
  description: "Impressum, Offenlegung und rechtliche Hinweise für FanMind.",
};

const operatorRows = [
  {
    label: "Betreiber / Vertragspartner",
    value: "Brigitte Erika Guggenberger, Einzelunternehmen – Geschäftsbezeichnung FanMind",
  },
  {
    label: "Geschäftsanschrift / Sitz",
    value: (
      <>
        Bahnstraße 11, Stiege 2, Tür 1
        <br />
        2351 Wiener Neudorf
        <br />
        Österreich
      </>
    ),
  },
  {
    label: "Inhaber und vertretungsberechtigt",
    value: "Brigitte Erika Guggenberger",
  },
  {
    label: "Zuständige Gewerbebehörde",
    value: "Bezirkshauptmannschaft Mödling",
  },
  {
    label: "GISA-Zahl",
    value: "40314440",
  },
  {
    label: "Operativer Ansprechpartner",
    value: "Bernd Guggenberger",
  },
  {
    label: "Kammerzugehörigkeit",
    value: "Wirtschaftskammer Niederösterreich",
  },
  {
    label: "E-Mail",
    value: <a href="mailto:fanmind@fanmind.ch">fanmind@fanmind.ch</a>,
  },
  {
    label: "Telefon",
    value: <a href="tel:+436765367236">+43 676 5367236</a>,
  },
  {
    label: "Website",
    value: <a href="https://fanmind.ch">https://fanmind.ch</a>,
  },
];

export default function ImpressumPage() {
  return (
    <main id="top" className={styles.page}>
      <div className={styles.watermark} aria-hidden="true" />
      <LegalTopHeader active="impressum" />
      <div className={styles.shell}>
        <header className={styles.hero}>
          <h1>Impressum / Offenlegung</h1>
          <p className={styles.eyebrow}>Betreiber der Website</p>
          <dl className={styles.operatorList}>
            {operatorRows.map((row) => (
              <div className={styles.operatorRow} key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </header>

        <article
          className={styles.legalContent}
          aria-label="Impressum und Offenlegung für FanMind"
        >
          <section
            className={styles.section}
            aria-labelledby="rechtlicher-abschlussstatus"
          >
            <h2 id="rechtlicher-abschlussstatus">
              Rechtlicher Abschlussstatus
            </h2>
            <p>
              FanMind wird von Brigitte Erika Guggenberger als Einzelunternehmerin
              unter der Geschäftsbezeichnung FanMind betrieben. Bernd Guggenberger ist operativer Ansprechpartner; die rechtliche Betreiberin und Vertragspartnerin bleibt Brigitte Erika Guggenberger. Eine
              Firmenbuchnummer, ein Firmenbuchgericht und eine UID werden erst
              angeführt, sobald sie tatsächlich vorhanden und bestätigt sind.
            </p>
            <p>
              Der Rechtsformzusatz „e.U.“ wird erst nach bestätigter Eintragung
              in das österreichische Firmenbuch verwendet.
            </p>
          </section>

          <section
            className={styles.section}
            aria-labelledby="grundlegende-richtung"
          >
            <h2 id="grundlegende-richtung">
              Grundlegende Richtung der Website
            </h2>
            <p>
              Diese Website informiert über FanMind, die angebotenen
              Funktionen, Pilotangebote, Produktentwicklung, Roadmap und
              Kontaktmöglichkeiten.
            </p>
            <p>
              FanMind ist ein KI-gestützter Antwort- und
              Kontaktwissen-Assistent für Fan-, Kunden- und
              Community-Beziehungen. FanMind unterstützt Teams dabei, Kontakte
              zu verwalten, Kontextinformationen zu speichern,
              KI-gestützte Antwortvorschläge zu erstellen und Follow-ups
              manuell zu organisieren.
            </p>
          </section>

          <section className={styles.section} aria-labelledby="produktstatus">
            <h2 id="produktstatus">Produktstatus und Leistungsgrenzen</h2>
            <p>
              FanMind befindet sich in einer Produkt- und Pilotphase. Der
              aktuelle Funktionsumfang umfasst insbesondere Login, Dashboard,
              Kontaktverwaltung, Kontaktprofile, KI-gestützte
              Antwortvorschläge, Kontaktwissen, Follow-ups, CSV-Import und
              Roadmap-Ansichten.
            </p>
            <h3>Keine automatische Kommunikation</h3>
            <p>
              FanMind versendet keine Nachrichten automatisch.
              Antwortvorschläge werden von Nutzerinnen und Nutzern geprüft,
              kopiert, übernommen oder verworfen. Der finale Versand erfolgt
              manuell durch die Nutzerinnen und Nutzer.
            </p>
            <h3>Integrationen und Abrechnung</h3>
            <p>
              Produktive Social-Media-Synchronisierungen sind nur dort
              verfügbar, wo sie ausdrücklich als freigegeben ausgewiesen
              werden. Scraping, autonome Kommunikation und automatischer
              Nachrichtenversand sind nicht Bestandteil des
              Standard-Workflows. Freigegebene Checkout-, Zahlungs- und
              Rechnungsprozesse werden getrennt vom Kommunikationsworkflow über
              den jeweils ausgewiesenen Zahlungsanbieter abgewickelt.
            </p>
            <h3>Roadmap</h3>
            <p>
              Geplante Integrationen und Erweiterungen werden als „Geplant“,
              „Coming Soon“ oder „In Arbeit“ gekennzeichnet. Sie werden erst
              nach technischer, rechtlicher und produktseitiger Prüfung
              umgesetzt.
            </p>
          </section>

          <section
            className={styles.section}
            aria-labelledby="rechtliche-hinweise"
          >
            <h2 id="rechtliche-hinweise">Rechtliche Hinweise</h2>
            <h3>1. Haftung für Inhalte</h3>
            <p>
              Die Inhalte dieser Website werden mit größtmöglicher Sorgfalt
              erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der
              bereitgestellten Informationen kann jedoch keine Gewähr
              übernommen werden. Rechtlich zwingende Haftungstatbestände
              bleiben unberührt.
            </p>
            <h3>2. Urheberrecht</h3>
            <p>
              Die auf dieser Website veröffentlichten Inhalte, Texte,
              Grafiken, Markenbestandteile und sonstigen Materialien sind
              urheberrechtlich geschützt, soweit sie nicht ausdrücklich anders
              gekennzeichnet sind. Eine Nutzung, Vervielfältigung, Bearbeitung
              oder Weitergabe außerhalb der gesetzlichen Grenzen bedarf der
              vorherigen Zustimmung des jeweiligen Rechteinhabers.
            </p>
            <h3>3. Haftung für externe Links</h3>
            <p>
              Diese Website kann Links zu externen Websites enthalten. Auf
              deren Inhalte haben die Betreiber von FanMind keinen Einfluss.
              Für die Inhalte verlinkter Seiten ist stets der jeweilige
              Anbieter oder Betreiber der verlinkten Seite verantwortlich. Bei
              Bekanntwerden rechtswidriger Inhalte werden entsprechende Links
              entfernt.
            </p>
          </section>

          <section className={styles.section} aria-labelledby="datenschutz">
            <h2 id="datenschutz">Datenschutz und AVV</h2>
            <p>
              Informationen zur Verarbeitung personenbezogener Daten enthält
              die Datenschutzerklärung unter{" "}
              <Link href="/datenschutz">/datenschutz</Link>.
            </p>
            <p>
              Der Status und die Anforderung einer
              Auftragsverarbeitungsvereinbarung sind unter{" "}
              <Link href="/avv">/avv</Link> beschrieben.
            </p>
            <p>
              Datenschutzanfragen können gerichtet werden an:{" "}
              <a href="mailto:fanmind@fanmind.ch">fanmind@fanmind.ch</a>.
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
