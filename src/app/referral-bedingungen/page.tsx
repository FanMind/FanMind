import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import LegalTopHeader from "@/components/LegalTopHeader";
import styles from "../zahlungsbedingungen/zahlungsbedingungen.module.css";

export const metadata: Metadata = {
  title: "Referral-Teilnahmebedingungen | FanMind",
  description:
    "Programmlogik, Teilnahmevoraussetzungen und Rabattgrenzen des FanMind Referral Growth Window.",
};

const ruleCards = [
  {
    title: "5 % je aktiver Empfehlung",
    text: "Jeder aktive, zahlende und wirksam zugeordnete geworbene Workspace zählt mit 5 Prozent Rabatt.",
  },
  {
    title: "Maximal 20 / 100 %",
    text: "Es zählen höchstens 20 aktive Empfehlungen. Der Rabatt kann die Starter-Grundgebühr höchstens auf 0 Euro reduzieren.",
  },
  {
    title: "Nur die Grundgebühr",
    text: "Rabattfähig ist ausschließlich die Starter-Grundgebühr von 312 Euro pro Monat. Einrichtung, KI-Add-ons, Connection-Pakete und Agency-Erweiterungen sind ausgeschlossen.",
  },
];

type ReferralSection = {
  title: string;
  content: ReactNode;
};

const sections: ReferralSection[] = [
  {
    title: "Anbieter und Geltungsbereich",
    content: (
      <>
        <p>
          Anbieter ist Bernd Guggenberger, Einzelunternehmen unter der
          Geschäftsbezeichnung FanMind, Turnerstraße 18, 2345 Brunn am Gebirge,
          Österreich. Das Referral-Programm richtet sich ausschließlich an
          Unternehmer und geschäftliche FanMind-Kunden.
        </p>
        <p>
          Ergänzend gelten die <Link href="/agb">AGB</Link>, die{" "}
          <Link href="/zahlungsbedingungen">Zahlungsbedingungen</Link> und die{" "}
          <Link href="/datenschutz">Datenschutzerklärung</Link>.
        </p>
      </>
    ),
  },
  {
    title: "Teilnahmevoraussetzungen",
    content: (
      <>
        <ul>
          <li>aktiver, zahlender Starter-Workspace</li>
          <li>gültiger persönlicher Referral-Code oder Referral-Link</li>
          <li>keine kostenlose Demo und kein interner Test-Workspace</li>
          <li>kein gesperrter, überfälliger, gekündigter oder rückerstatteter Zugang</li>
        </ul>
        <p>
          Die technische Berechtigung richtet sich nach dem aktuellen
          Abrechnungsstatus des Workspaces. FanMind kann eine Teilnahme bei
          Missbrauch, Sicherheitsrisiken oder widersprüchlichen Zahlungsdaten
          aussetzen und manuell prüfen.
        </p>
      </>
    ),
  },
  {
    title: "Zuordnung einer Empfehlung",
    content: (
      <>
        <p>
          Eine Empfehlung wird über einen gültigen Code oder Link bei der
          Registrierung beziehungsweise im freigegebenen Zuordnungsprozess erfasst.
          Die erste gültige Zuordnung ist maßgeblich. Ein späterer Wechsel zu einem
          anderen Empfehlenden ist grundsätzlich ausgeschlossen.
        </p>
        <p>
          Eigenempfehlungen, Mehrfachkonten, künstlich erzeugte Kundenkonten,
          irreführende Werbung sowie jede Umgehung technischer Schutzmaßnahmen sind
          unzulässig. FanMind kann solche Zuordnungen ablehnen, deaktivieren und
          dokumentieren.
        </p>
      </>
    ),
  },
  {
    title: "Rabattberechnung",
    content: (
      <>
        <ul>
          <li>5 % je aktivem, zahlendem geworbenem Workspace</li>
          <li>maximal 20 aktive Empfehlungen beziehungsweise 100 %</li>
          <li>Rabatt ausschließlich auf die Starter-Grundgebühr von 312 €/Monat</li>
          <li>kein Rabatt auf Einrichtung, nachgekaufte AI-Kapazität, Connections oder Agency-Erweiterungen</li>
          <li>Referral und Agency-Mengenrabatt sind nicht kombinierbar</li>
          <li>keine Barauszahlung, keine Übertragung und kein negativer Betrag</li>
        </ul>
        <p>
          Der für eine Rechnung maßgebliche Rabatt wird nach der freigegebenen
          Billing-Logik vor dem Rechnungslauf ermittelt und als Abrechnungsstand
          dokumentiert. Individuelle Gutschriften oder Kulanzentscheidungen bleiben
          davon getrennt.
        </p>
      </>
    ),
  },
  {
    title: "Aktivierung und Wegfall",
    content: (
      <>
        <p>
          Eine Empfehlung wird erst rabattwirksam, wenn der geworbene Workspace die
          freigegebene Zahlungs- und Aktivierungsregel erfüllt. Registrierung oder
          eine ausstehende Zahlung allein begründen noch keinen Rabatt.
        </p>
        <p>
          Bei Kündigung, dauerhaftem Zahlungsausfall, Rückerstattung, Chargeback,
          Sperre oder sonstiger Inaktivität entfällt der zugehörige 5-Prozent-Anteil
          für künftige Rechnungen. Eine spätere wirksame Reaktivierung kann den Anteil
          nach erneuter Prüfung wieder aktivieren.
        </p>
      </>
    ),
  },
  {
    title: "Globales Growth Window",
    content: (
      <>
        <p>
          Das Referral Growth Window ist für neue rabattwirksame Zuordnungen auf
          insgesamt 2.000 aktive zahlende FanMind-Workspaces begrenzt. Nach Schließung
          entstehen keine neuen zusätzlichen Rabattprozente, sofern FanMind das
          Programm nicht ausdrücklich wieder öffnet.
        </p>
        <p>
          Bereits aktive Ansprüche können bestehen bleiben, solange die zugrunde
          liegenden geworbenen Workspaces weiterhin aktiv und zahlend sind. Fällt ein
          solcher Workspace nach Programmschluss weg, kann der verlorene Anteil nicht
          automatisch durch eine neue Empfehlung ersetzt werden.
        </p>
      </>
    ),
  },
  {
    title: "Datenschutz und Transparenz",
    content: (
      <p>
        Empfehlenden werden nur die für ihren Programmstatus notwendigen Status- und
        Rabattinformationen angezeigt. Fremde Kontakt-, Vertrags- oder Zahlungsdaten
        werden nicht offengelegt. Weitere Informationen stehen in der{" "}
        <Link href="/datenschutz">Datenschutzerklärung</Link>.
      </p>
    ),
  },
  {
    title: "Programmstatus und Änderungen",
    content: (
      <p>
        Die technische Grundlage ist vorbereitet; die produktive automatische Rabattverrechnung bleibt bis zum erfolgreichen Stripe-Sandbox-Lifecycle-Test, zur steuerlichen Prüfung und zur ausdrücklichen Production-Freigabe deaktiviert. FanMind darf das Programm für die Zukunft anpassen, pausieren oder schließen, soweit bestehende wirksame Abrechnungsstände und zwingende gesetzliche Vorgaben beachtet werden.
      </p>
    ),
  },
  {
    title: "Kontakt",
    content: (
      <p>
        Fragen zum Referral-Programm bitte an{" "}
        <a href="mailto:kontakt@fanmind.ch">kontakt@fanmind.ch</a> richten.
      </p>
    ),
  },
];

export default function ReferralTermsPage() {
  return (
    <main id="top" className={styles.page}>
      <div className={styles.shapeOne} aria-hidden="true" />
      <div className={styles.shapeTwo} aria-hidden="true" />
      <div className={styles.dotPattern} aria-hidden="true" />
      <LegalTopHeader active="referral" />

      <div className={styles.shell}>
        <header className={styles.hero}>
          <h1>REFERRAL-TEILNAHMEBEDINGUNGEN</h1>
          <p className={styles.subtitle}>
            Beschlossene Programmlogik, Teilnahmevoraussetzungen und klare Grenzen
          </p>
          <p className={styles.stand}>Stand: Juli 2026</p>
          <p className={styles.intro}>
            Diese Seite beschreibt die aktuell beschlossene Logik des FanMind Referral
            Growth Window. Eine automatische Rabattverrechnung ist erst aktiv, wenn
            FanMind das Programm in der Nutzeroberfläche ausdrücklich als aktiv ausweist
            und die technische Billing-Freigabe erfolgt ist.
          </p>
          <div className={styles.trustBox} aria-label="Wichtige Referral-Hinweise">
            <span>✓ Nur B2B-Kunden</span>
            <span>✓ Keine Barauszahlung</span>
            <span>✓ Kein negativer Rechnungsbetrag</span>
            <span>✓ Keine Rabatte auf AI-Kapazitäts-Top-ups</span>
          </div>
        </header>

        <section className={styles.packageGrid} aria-label="Referral-Kernregeln">
          {ruleCards.map((card) => (
            <article className={styles.packageCard} key={card.title}>
              <span className={styles.cardBadge}>Programmlogik</span>
              <h2>{card.title}</h2>
              <p>{card.text}</p>
            </article>
          ))}
        </section>

        <article
          className={styles.document}
          aria-label="FanMind Referral-Teilnahmebedingungen"
        >
          {sections.map((section, index) => (
            <section className={styles.section} key={section.title}>
              <div className={styles.number} aria-hidden="true">
                {index + 1}
              </div>
              <div className={styles.sectionBody}>
                <h2>{section.title}</h2>
                {section.content}
              </div>
            </section>
          ))}
        </article>
      </div>

      <a className={styles.backToTop} href="#top" aria-label="Zurück nach oben">
        ↑
      </a>
    </main>
  );
}
