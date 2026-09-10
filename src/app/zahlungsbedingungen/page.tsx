import type { Metadata } from "next";
import Link from "next/link";
import LegalTopHeader from "@/components/LegalTopHeader";
import type { ReactNode } from "react";
import { getCommercialTerms } from "@/lib/plans";
import styles from "./zahlungsbedingungen.module.css";

export const metadata: Metadata = {
  title: "Zahlungsbedingungen / Paket- und Vertragskonditionen | FanMind",
  description:
    "Preise, Laufzeiten, Zahlungsprozess, Freischaltung und Zahlungsstatus bei FanMind.",
};

const starterFlexTerms = getCommercialTerms("starter_paid_setup");
const starterCommitmentTerms = getCommercialTerms("starter_no_setup_commitment");

function euros(cents: number) {
  return `${cents / 100} €`;
}

type PackageCard = {
  title: string;
  badge: string;
  price: string;
  points: string[];
};

type PaymentSection = {
  title: string;
  content: ReactNode;
};

const trustItems = [
  "Nettopreise · Steuer im Checkout",
  "Keine Bankdaten in FanMind",
  "SEPA über Zahlungsdienstleister",
  "Zwei aktive Starter-Optionen",
];

const packageCards: PackageCard[] = [
  {
    title: "Starter Flex",
    badge: "Aktiv / Produktiv",
    price: `${euros(starterFlexTerms.setupFeeCents)} Setup + ${euros(starterFlexTerms.monthlyFeeCents)}/Monat`,
    points: [
      "Jederzeit zum Ende des bezahlten Abrechnungsmonats kündbar",
      "Angefangene Monate werden vollständig verrechnet",
      "Produktiver MVP-Workspace",
      "1 Profil",
      "Bis zu 1.000 Kontakte, sofern technisch/vertraglich so vorgesehen",
    ],
  },
  {
    title: "Starter 12 Monate",
    badge: "Aktiv / 12 Monate",
    price: `${euros(starterCommitmentTerms.setupFeeCents)} Setup + ${euros(starterCommitmentTerms.monthlyFeeCents)}/Monat`,
    points: ["12 Monate Mindestlaufzeit", "danach monatliche Verlängerung", "1 Profil", "Keine Einrichtungsgebühr"],
  },
  {
    title: "Growth / Agency",
    badge: "Coming Soon",
    price: "Coming Soon / individuelles Angebot",
    points: [
      "Nicht direkt produktiv buchbar",
      "Roadmap / Vorschau",
      "Technische und rechtliche Freigabe erforderlich",
    ],
  },
];


const sections: PaymentSection[] = [
  {
    title: "Geltungsbereich",
    content: (
      <>
        <p>Diese Zahlungsbedingungen gelten für Starter- und künftig freigegebene Pakete von FanMind, soweit keine abweichende individuelle Vereinbarung getroffen wurde.</p>
        <p>Sie ergänzen die AGB / Vertragsbedingungen. Bei Widersprüchen gehen individuelle Angebote oder Auftragsbestätigungen vor.</p>
      </>
    ),
  },
  {
    title: "Preise und Umsatzsteuer",
    content: (
      <>
        <p>Die veröffentlichten Beträge sind Nettopreise. Für steuerpflichtige Umsätze in Österreich werden 20 % Umsatzsteuer hinzugerechnet. Bei internationalen Verkäufen wird der anwendbare Steuersatz oder eine Reverse-Charge-Behandlung anhand der Rechnungsadresse und des steuerlichen Kundenstatus ermittelt und in Checkout sowie Rechnung ausgewiesen.</p>
        <p>Growth und Agency sind derzeit Coming Soon oder auf Anfrage und begründen kein verbindliches Leistungs- oder Preisversprechen.</p>
      </>
    ),
  },
  {
    title: "Starter Flex",
    content: <p>Starter Flex kostet {euros(starterFlexTerms.setupFeeCents)} einmalige Einrichtung plus {euros(starterFlexTerms.monthlyFeeCents)}/Monat. Es kann jederzeit gekündigt werden; die Kündigung wirkt zum Ende des laufenden, bereits bezahlten Abrechnungsmonats. Angefangene Monate werden vollständig verrechnet. Das Paket umfasst einen produktiven MVP-Workspace für ein Profil. Externe Integrationen bleiben Roadmap/Preview, soweit sie nicht ausdrücklich produktiv freigegeben und verbunden sind.</p>,
  },
  {
    title: "Starter 12 Monate",
    content: <p>Starter 12 Monate kostet {euros(starterCommitmentTerms.setupFeeCents)} Setup plus {euros(starterCommitmentTerms.monthlyFeeCents)}/Monat. Die Mindestlaufzeit beträgt {starterCommitmentTerms.commitmentMonths} Monate. Danach verlängert sich der Vertrag jeweils um einen Monat, sofern er nicht gekündigt wird. Die Setup-Gebühr entfällt aufgrund der Mindestlaufzeit.</p>,
  },
  {
    title: "KI-Stufen und Referral-Rabatte",
    content: <p>KI Standard ist in der Starter-Grundgebühr von 312 €/Monat enthalten. KI Plus kostet zusätzlich 100 €/Monat, KI Ultra zusätzlich 200 €/Monat. Referral-Rabatte gelten ausschließlich auf die Starter-Grundgebühr von 312 €. Einrichtungsgebühren und KI-Add-ons sind nicht rabattfähig.</p>,
  },
  {
    title: "Growth und Agency",
    content: <p>Growth und Agency sind derzeit Coming Soon, Roadmap oder individuelles Angebot. Sie sind nicht direkt produktiv buchbar, solange sie nicht ausdrücklich freigeschaltet sind. Preise, Laufzeiten, Leistungsumfang, Nutzer-/Profilgrenzen, Rollen, Integrationen und Analytics werden individuell oder später produktseitig festgelegt. Keine Aussage auf dieser Seite stellt Growth/Agency als bereits aktiv verfügbares Paket dar.</p>,
  },
  {
    title: "Registrierung und Zahlungsstart",
    content: <p>Die Registrierung selbst löst keine Zahlung aus. Bei Starter wird ein Workspace vorbereitet. Der Zahlungsprozess startet erst, wenn Nutzerinnen und Nutzer den Zahlungsprozess aktiv fortsetzen oder eine individuelle Zahlungsvereinbarung getroffen wurde. Bei Starter müssen Zahlungsbedingungen akzeptiert werden. Demo-User und temporäre Demo-Workspaces können keinen Checkout starten.</p>,
  },
  {
    title: "Zahlungsabwicklung über Stripe",
    content: <p>Soweit der Zahlungsprozess produktiv aktiviert ist, setzt FanMind Stripe für die Zahlungsabwicklung ein. Stripe zeigt im Checkout nur die für Land, Währung, Gerät und wiederkehrende Zahlung kompatiblen aktivierten Karten-, Wallet- und Bankzahlarten. Für Starter wird ein Subscription-Modell verwendet; Starter Flex enthält zusätzlich eine einmalige Einrichtungsgebühr. Bei asynchronen Bankzahlarten kann die endgültige Bestätigung mehrere Geschäftstage dauern. FanMind speichert keine vollständigen Karten- oder Bankdaten und keine IBAN in der Anwendung. Der Checkout ist nur verfügbar, wenn Schlüssel, Webhook, Preise und Stripe Tax vollständig bestätigt sind.</p>,
  },
  {
    title: "Freischaltung und Zahlungsstatus",
    content: (
      <>
        <p>Nach erfolgreicher Zahlung oder Zahlungsbestätigung kann der Workspace freigeschaltet werden. Bei ausstehenden Zahlungen bleibt der Status offen oder in Bearbeitung. Bei asynchronen Zahlungsarten kann die Freischaltung verzögert erfolgen.</p>
        <ul className={styles.statusList}>
          <li>Zahlung offen</li><li>SEPA-Bestätigung offen</li><li>aktiv</li><li>überfällig</li><li>Zahlung fehlgeschlagen</li><li>gesperrt</li><li>gekündigt</li><li>abgelaufen</li>
        </ul>
      </>
    ),
  },
  {
    title: "Fehlgeschlagene Zahlungen und Sperrung",
    content: <p>Wenn Zahlungen fehlschlagen, ausbleiben oder zurückgegeben werden, kann FanMind den Kunden informieren und eine erneute Zahlung verlangen. FanMind kann den Zugang bis zur Klärung einschränken oder sperren, soweit dies vertraglich und gesetzlich zulässig ist. Offene Zahlungsansprüche bleiben bestehen. Eine manuelle Sperrung kann bei Missbrauch, Sicherheitsrisiken oder ungeklärten Zahlungsvorgängen erfolgen.</p>,
  },
  {
    title: "Kündigung",
    content: <p>Starter Flex kann jederzeit zum Ende des laufenden, vollständig zu bezahlenden Abrechnungsmonats gekündigt werden. Starter 12 Monate hat eine Mindestlaufzeit von zwölf Monaten und verlängert sich danach jeweils um einen Monat. Kündigungen müssen in Textform erfolgen, sofern kein anderer Kündigungsprozess bereitgestellt wird. Kündigung an: <a href="mailto:kontakt@fanmind.ch">kontakt@fanmind.ch</a>. Individuelle Angebote können abweichende Kündigungsregeln enthalten.</p>,
  },
  {
    title: "Rückerstattung und Gutschriften",
    content: <p>Rückerstattungen erfolgen nur, soweit gesetzlich vorgeschrieben oder individuell vereinbart. Setup-Leistungen, Pilot-/Einrichtungsleistungen und bereits bereitgestellte Leistungen sind grundsätzlich nicht automatisch erstattungsfähig, soweit gesetzlich zulässig. Kulanzregelungen bleiben möglich. Bei fehlerhaften Abbuchungen oder Doppelzahlungen soll der Kunde FanMind unter <a href="mailto:kontakt@fanmind.ch">kontakt@fanmind.ch</a> kontaktieren.</p>,
  },
  {
    title: "Rechnungen und Aufbewahrung",
    content: <p>Rechnungen werden elektronisch oder über den Zahlungs-/Rechnungsprozess bereitgestellt. Kunden sind für richtige Rechnungsdaten verantwortlich. Rechnungs- und Buchhaltungsdaten werden entsprechend gesetzlichen Aufbewahrungspflichten gespeichert. Steuer-ID, UID oder Rechnungsadresse können im Zahlungsprozess abgefragt werden. FanMind darf Rechnungs- und Zahlungsinformationen zur Erfüllung gesetzlicher Pflichten speichern.</p>,
  },
  {
    title: "B2B-Hinweis",
    content: <p>FanMind richtet sich ausschließlich an Unternehmer, Unternehmen, Creator-Teams, Clubs, Vereine, Agenturen, Organisationen und selbstständig beruflich Tätige. Ein Vertragsabschluss durch Verbraucher ist nicht vorgesehen.</p>,
  },
  {
    title: "Änderungen von Preisen und Paketen",
    content: <p>FanMind kann Preise, Pakete und Leistungsumfänge für die Zukunft ändern. Bestehende individuelle Vereinbarungen bleiben nach Maßgabe der jeweiligen Vereinbarung unberührt. Änderungen werden rechtzeitig kommuniziert, soweit sie bestehende Verträge betreffen. Coming-Soon-Funktionen begründen keinen Anspruch auf bestimmte Preise oder Termine.</p>,
  },
  {
    title: "Verhältnis zu AGB und Datenschutz",
    content: <p>Die <Link href="/agb">AGB</Link> regeln die allgemeinen Vertragsbedingungen. Die <Link href="/datenschutz">Datenschutzerklärung</Link> informiert über Datenverarbeitung. Soweit FanMind personenbezogene Daten im Auftrag eines Kunden verarbeitet, wird die Auftragsverarbeitung bei Bedarf individuell vertraglich geregelt. Ergänzende Anbieterangaben stehen im <Link href="/impressum">Impressum</Link>. Die Zahlungsbedingungen ergänzen diese Dokumente.</p>,
  },
  {
    title: "Kontakt",
    content: <p>Fragen zu Zahlungen, Rechnungen, Paketwechsel, Kündigung oder Freischaltung bitte an: <a href="mailto:kontakt@fanmind.ch">kontakt@fanmind.ch</a>.</p>,
  },
];

function sectionId(index: number) {
  return `abschnitt-${index + 1}`;
}

export default function ZahlungsbedingungenPage() {
  return (
    <main id="top" className={styles.page}>
      <div className={styles.shapeOne} aria-hidden="true" />
      <div className={styles.shapeTwo} aria-hidden="true" />
      <div className={styles.dotPattern} aria-hidden="true" />
      <LegalTopHeader active="zahlungsbedingungen" />
      <div className={styles.shell}>
        <header className={styles.hero}>
          <h1>ZAHLUNGSBEDINGUNGEN</h1>
          <p className={styles.subtitle}>Preise, Laufzeiten, Zahlungsprozess und Freischaltung bei FanMind</p>
          <p className={styles.stand}>Stand: Juli 2026</p>
          <p className={styles.intro}>Diese Zahlungsbedingungen ergänzen die AGB / Vertragsbedingungen und beschreiben Preise, Pakete, Laufzeiten, Zahlungsabläufe, Freischaltung und Zahlungsstatus bei FanMind. Abweichende individuelle Angebote, Auftragsbestätigungen oder Vereinbarungen gehen diesen Zahlungsbedingungen vor.</p>
          <div className={styles.trustBox} aria-label="Wichtige Zahlungs-Hinweise">
            {trustItems.map((item) => <span key={item}>✓ {item}</span>)}
          </div>
        </header>

        <section className={styles.packageGrid} aria-label="Paketübersicht">
          {packageCards.map((card) => (
            <article className={styles.packageCard} key={card.title}>
              <span className={styles.cardBadge}>{card.badge}</span>
              <h2>{card.title}</h2>
              <p className={styles.cardPrice}>{card.price}</p>
              <ul>{card.points.map((point) => <li key={point}>{point}</li>)}</ul>
            </article>
          ))}
        </section>

        <article className={styles.document} aria-label="Paket- und Zahlungsbedingungen für FanMind">
          {sections.map((section, index) => (
            <section className={styles.section} id={sectionId(index)} key={section.title}>
              <div className={styles.number} aria-hidden="true">{index + 1}</div>
              <div className={styles.sectionBody}>
                <h2>{section.title}</h2>
                {section.content}
              </div>
            </section>
          ))}
        </article>
      </div>
      <a className={styles.backToTop} href="#top" aria-label="Zurück nach oben">↑</a>
    </main>
  );
}
