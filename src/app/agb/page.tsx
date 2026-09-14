import type { Metadata } from "next";
import Link from "next/link";
import LegalTopHeader from "@/components/LegalTopHeader";
import styles from "./agb.module.css";

export const metadata: Metadata = {
  title: "AGB / Vertragsbedingungen | FanMind",
  description:
    "Professionelle Vertragsbedingungen für die Nutzung von FanMind als KI-gestützter Antwort- und Memory-Assistent.",
};

type TermsSection = {
  title: string;
  content: React.ReactNode;
};

const sections: TermsSection[] = [
  {
    title: "Vertragspartner und Vertragsgegenstand",
    content: (
      <>
        <p>
          Vertragspartner ist Bernd Guggenberger, Einzelunternehmen unter der Geschäftsbezeichnung FanMind, Turnerstraße 18, 2345 Brunn am Gebirge, Österreich. Inhaber und vertretungsberechtigt ist Bernd Guggenberger.
        </p>
        <p>
          FanMind ist ein KI-gestützter Antwort- und Memory-Assistent für Fan-, Kunden- und
          Community-Beziehungen. FanMind stellt Werkzeuge zur Kontaktverwaltung,
          Kontextspeicherung, KI-gestützten Antwortvorbereitung, Memory-Verwaltung,
          Follow-up-Organisation und zum CSV-Import bereit.
        </p>
        <p>
          FanMind ist kein Bot und keine autonome Versandlösung. FanMind versendet keine
          Nachrichten automatisch.
        </p>
      </>
    ),
  },
  {
    title: "Geltungsbereich",
    content: (
      <>
        <p>
          Diese Bedingungen gelten für die Nutzung von FanMind durch geschäftliche Nutzer,
          Creator-Teams, Agenturen, Clubs, Vereine, Organisationen und Pilotkunden.
        </p>
        <p>
          FanMind richtet sich ausschließlich an Unternehmer, Unternehmen, Vereine, Organisationen, Creator-Teams und selbstständig beruflich Tätige. Ein Vertragsabschluss durch Verbraucher ist nicht vorgesehen.
        </p>
        <p>Abweichende individuelle Vereinbarungen gehen diesen Bedingungen vor.</p>
      </>
    ),
  },
  {
    title: "Vertragsschluss",
    content: (
      <>
        <p>
          Die Darstellung auf der Website ist kein rechtlich bindendes Angebot, sondern eine
          Einladung zur Registrierung, Demoanfrage oder Angebotsanfrage.
        </p>
        <p>
          Ein Vertrag kommt zustande durch Annahme der Registrierung, Freischaltung eines Zugangs,
          Bestätigung eines Angebots, Abschluss eines Zahlungsprozesses oder individuelle
          Vereinbarung.
        </p>
        <p>
          FanMind kann Registrierungen ablehnen, wenn technische, rechtliche oder wirtschaftliche
          Gründe entgegenstehen.
        </p>
      </>
    ),
  },
  {
    title: "Nutzerkonto und Zugangsdaten",
    content: (
      <>
        <p>
          Für geschützte Bereiche ist ein Nutzerkonto erforderlich. Nutzer müssen richtige und
          aktuelle Angaben machen. Zugangsdaten sind vertraulich zu behandeln.
        </p>
        <p>
          Kunden sind für Aktivitäten in ihrem Workspace verantwortlich, soweit sie diese veranlasst
          oder ermöglicht haben. Eine Weitergabe des Zugangs an unberechtigte Dritte ist nicht
          gestattet.
        </p>
        <p>
          Bei Verdacht auf Missbrauch oder unberechtigten Zugriff muss FanMind unverzüglich
          informiert werden.
        </p>
      </>
    ),
  },
  {
    title: "Leistungsumfang",
    content: (
      <>
        <p>
          Der konkrete Leistungsumfang ergibt sich aus der aktuellen Produktbeschreibung, dem
          gebuchten Paket, dem Angebot, der Auftragsbestätigung oder einer individuellen
          Vereinbarung.
        </p>
        <h3>Aktive Funktionen können insbesondere sein:</h3>
        <ul>
          <li>Login / Registrierung und Dashboard</li>
          <li>Kontaktverwaltung, Kontaktprofile und manuelle Kontaktanlage</li>
          <li>CSV-Import sowie Nachrichten- und Kontextfelder</li>
          <li>KI-gestützte Antwortvorschläge</li>
          <li>Memory / Notizen und Follow-ups</li>
          <li>Roadmap sowie manuelle oder vorbereitete Kanäle</li>
        </ul>
        <h3>Nicht im aktiven Leistungsumfang enthalten, solange nicht ausdrücklich freigeschaltet:</h3>
        <ul>
          <li>automatische Nachrichtenversendung, Scraping oder autonome Kommunikation</li>
          <li>vollständige Social-Media-Synchronisierung oder Kampagnenversand</li>
          <li>vollständige Analytics-Suite oder Enterprise-Rollen/Rechte</li>
          <li>produktive Integrationen, die nur als Coming Soon oder Roadmap gekennzeichnet sind</li>
        </ul>
      </>
    ),
  },
  {
    title: "KI-Funktionen",
    content: (
      <>
        <p>
          FanMind kann KI-gestützte Antwortvorschläge, Memory-Vorschläge, Follow-up-Vorschläge und
          Analysefunktionen bereitstellen. KI-Ausgaben sind Entwürfe und Hilfestellungen.
        </p>
        <p>
          Nutzer müssen KI-Ausgaben vor Verwendung prüfen. FanMind garantiert keine fehlerfreien KI-Antworten und übernimmt keine Garantie für Richtigkeit, Vollständigkeit, Aktualität, rechtliche Zulässigkeit, wirtschaftliche Wirkung oder Angemessenheit von KI-Ausgaben.
        </p>
        <p>
          KI-Ausgaben dürfen nicht ungeprüft für rechtlich, medizinisch, finanziell oder sonstig
          sensible Entscheidungen verwendet werden. Der Mensch bleibt Entscheider.
        </p>
      </>
    ),
  },
  {
    title: "Manuelle Kommunikation / keine automatische Sendefunktion",
    content: (
      <>
        <p>
          FanMind versendet keine Nachrichten automatisch. Antworten werden vorbereitet, kopiert,
          angepasst oder als Entwurf übernommen.
        </p>
        <p>
          Der finale Versand erfolgt manuell durch Nutzerinnen und Nutzer im jeweiligen Kanal.
          Kunden bleiben für Inhalt, Tonalität, Timing und Rechtmäßigkeit ihrer Kommunikation
          verantwortlich.
        </p>
      </>
    ),
  },
  {
    title: "Kundendaten und Verantwortung des Kunden",
    content: (
      <>
        <p>
          Kunden sind dafür verantwortlich, dass sie personenbezogene Daten, Fan-Daten,
          Kontaktinformationen, Nachrichteninhalte, Notizen, Memories, Follow-ups und CSV-Daten
          rechtmäßig in FanMind eingeben, importieren oder verarbeiten.
        </p>
        <p>
          Kunden müssen sicherstellen, dass sie dafür eine geeignete Rechtsgrundlage haben. Kunden
          dürfen keine rechtswidrigen, diskriminierenden, beleidigenden, täuschenden,
          belästigenden oder Rechte Dritter verletzenden Inhalte verarbeiten.
        </p>
        <p>
          Kunden dürfen keine sensiblen Daten oder Daten Minderjähriger verarbeiten, sofern dafür
          keine klare Rechtsgrundlage besteht und dies nicht erforderlich ist.
        </p>
      </>
    ),
  },
  {
    title: "CSV-Import und Datenqualität",
    content: (
      <>
        <p>
          FanMind stellt einen CSV-Import als pragmatischen Importweg bereit. Kunden sind für
          Inhalt, Qualität, Rechtmäßigkeit und Aktualität importierter Daten verantwortlich.
        </p>
        <p>
          FanMind kann Duplikate nur begrenzt erkennen. Fehlerhafte, unvollständige oder
          ungeeignete CSV-Daten können zu unvollständigen oder fehlerhaften Ergebnissen führen.
        </p>
      </>
    ),
  },
  {
    title: "Verbotene Nutzung",
    content: (
      <>
        <p>Nicht gestattet ist insbesondere:</p>
        <ul>
          <li>Nutzung für rechtswidrige Zwecke</li>
          <li>Umgehung technischer Schutzmaßnahmen</li>
          <li>Scraping oder automatisierte Massennutzung ohne Freigabe</li>
          <li>Spam, Massenversand oder belästigende Kommunikation</li>
          <li>Upload rechtswidriger oder Rechte Dritter verletzender Inhalte</li>
          <li>Versuch, API-Keys, Systemprompts, interne Mechanismen oder Sicherheitsfunktionen auszulesen</li>
          <li>Nutzung für Malware, Phishing, Betrug oder Täuschung</li>
          <li>Nutzung zur automatisierten Kommunikation entgegen der Produktgrenze</li>
          <li>Missbrauch von Demo-Zugängen</li>
          <li>Eingabe unnötiger sensibler Daten</li>
        </ul>
      </>
    ),
  },
  {
    title: "Demo, Pilot und Testzugänge",
    content: (
      <>
        <p>
          Demo- und Pilotzugänge dienen der Prüfung und Demonstration von FanMind. Öffentliche
          Demo-Zugänge dürfen nicht mit echten personenbezogenen Daten befüllt werden.
        </p>
        <p>
          Demo-Inhalte können für andere Demo-Nutzer sichtbar sein, wenn ein öffentlicher
          Demo-Modus verwendet wird. FanMind kann Demo- oder Testzugänge zeitlich beschränken,
          ändern oder deaktivieren.
        </p>
        <p>Der kostenlose Demo-Zugang löst keine Zahlung aus. Für einen kostenpflichtigen Zugang stehen Starter Flex, Starter 12 Monate und Daily zur Auswahl. Eine Kontoerstellung startet noch kein Abo.</p>
      </>
    ),
  },
  {
    title: "Pakete, Preise und Zahlungsbedingungen",
    content: (
      <>
        <p>
          Es gelten die auf der Website oder im Angebot angegebenen Preise und Pakete. Ergänzende
          Informationen stehen unter <Link href="/zahlungsbedingungen">/zahlungsbedingungen</Link>.
          Alle veröffentlichten Beträge sind Nettopreise. Bei steuerpflichtigen
          Umsätzen in Österreich werden 20 % Umsatzsteuer berechnet. Bei
          internationalen Verkäufen bestimmt der Zahlungsprozess den
          anwendbaren Steuersatz oder eine Reverse-Charge-Behandlung anhand der
          Rechnungsadresse und des steuerlichen Kundenstatus.
        </p>
        <ul>
          <li><strong>Starter Flex:</strong> 990 € einmalige Einrichtung + 312 €/Monat; jederzeit zum Ende des laufenden, bereits bezahlten Abrechnungsmonats kündbar.</li>
          <li><strong>Starter 12 Monate:</strong> 0 € Setup + 312 €/Monat; 12 Monate Mindestlaufzeit, danach Verlängerung um jeweils einen Monat.</li>
          <li><strong>Daily:</strong> 0 € Setup + 1 €/Tag; tägliche Abrechnung, täglich zum Ende des bereits bezahlten Abrechnungstags kündbar; kein Referral-Rabatt.</li>
          <li><strong>KI Standard:</strong> in der Starter-Grundgebühr enthalten.</li>
          <li><strong>KI Plus:</strong> zusätzlich 100 €/Monat.</li>
          <li><strong>KI Ultra:</strong> zusätzlich 200 €/Monat.</li>
          <li><strong>Growth / Agency:</strong> Coming Soon, auf Anfrage oder individuelles Angebot.</li>
        </ul>
        <p>
          Zahlungen erfolgen nur, soweit der Zahlungsprozess produktiv aktiviert ist oder eine
          individuelle Vereinbarung getroffen wurde. FanMind speichert keine vollständigen Bankdaten
          oder IBAN in der Anwendung.
        </p>
      </>
    ),
  },
  {
    title: "Laufzeit und Kündigung",
    content: (
      <>
        <p>
          Die Laufzeit richtet sich nach dem gebuchten Paket oder individuellen Angebot. Starter Flex kann jederzeit gekündigt werden; die Kündigung wirkt zum Ende des laufenden, vollständig zu bezahlenden Abrechnungsmonats. Starter 12 Monate hat eine Mindestlaufzeit von zwölf Monaten und verlängert sich danach jeweils um einen Monat, sofern nicht gekündigt wird.
        </p>
        <p>
          Kündigungen müssen in Textform erfolgen, sofern kein anderer Prozess bereitgestellt wird.
          Außerordentliche Kündigungsrechte aus wichtigem Grund bleiben unberührt.
        </p>
      </>
    ),
  },
  {
    title: "Verfügbarkeit, Wartung und Änderungen",
    content: (
      <>
        <p>
          FanMind bemüht sich um stabilen Betrieb. Wartung, Updates, Sicherheitsmaßnahmen,
          technische Störungen oder Drittanbieterprobleme können die Verfügbarkeit vorübergehend
          einschränken.
        </p>
        <p>
          Konkrete Service-Level gelten nur, wenn sie ausdrücklich vereinbart wurden. FanMind darf
          Funktionen weiterentwickeln, ändern, ersetzen oder deaktivieren, soweit dies für
          Sicherheit, Stabilität, Produktentwicklung oder rechtliche Anforderungen erforderlich ist.
        </p>
        <p>
          Coming-Soon-Funktionen begründen keinen Anspruch auf bestimmte Umsetzung oder einen
          bestimmten Zeitpunkt.
        </p>
      </>
    ),
  },
  {
    title: "Drittanbieter und Integrationen",
    content: (
      <>
        <p>
          FanMind kann Dienstleister und Drittanbieter einsetzen, insbesondere für Hosting,
          Authentifizierung, Datenbank, KI, E-Mail und Zahlungsabwicklung.
        </p>
        <p>
          Integrationen mit externen Plattformen sind nur nutzbar, soweit sie produktiv
          freigeschaltet und vom Kunden verbunden sind. Externe Plattformen können eigene
          Bedingungen, Einschränkungen, APIs und Datenschutzregelungen haben.
        </p>
        <p>
          FanMind übernimmt keine Verantwortung für Änderungen, Ausfälle oder Beschränkungen
          externer Plattformen. Keine Integration darf als aktiv dargestellt werden, wenn sie nur
          geplant oder vorbereitet ist.
        </p>
      </>
    ),
  },
  {
    title: "Rechte an Inhalten und Nutzungsrechte",
    content: (
      <>
        <p>
          Kunden behalten ihre Rechte an eigenen Inhalten und Kundendaten. Kunden räumen FanMind die
          erforderlichen Rechte ein, um die eingegebenen Daten im Rahmen der vertraglichen Leistung
          technisch zu verarbeiten, anzuzeigen, zu speichern, zu analysieren und KI-Funktionen
          bereitzustellen.
        </p>
        <p>
          FanMind behält alle Rechte an Software, Design, Marke, Funktionen, Dokumentation,
          Workflows, Datenmodellen und sonstigen Bestandteilen der Plattform. Eine Vervielfältigung,
          Nachahmung, Weitergabe, Reverse Engineering oder unberechtigte Nutzung der Plattform ist
          nicht gestattet.
        </p>
      </>
    ),
  },
  {
    title: "Datenschutz und Auftragsverarbeitung",
    content: (
      <>
        <p>
          Informationen zur Verarbeitung personenbezogener Daten stehen unter{" "}
          <Link href="/datenschutz">/datenschutz</Link>. Soweit FanMind personenbezogene Daten im
          Auftrag eines Kunden verarbeitet, wird die Auftragsverarbeitung bei Bedarf individuell
          vertraglich geregelt. Kunden dürfen personenbezogene Daten Dritter nur einbringen, wenn
          sie dazu berechtigt sind.
        </p>
      </>
    ),
  },
  {
    title: "Support und Kommunikation",
    content: (
      <>
        <p>
          Support- und Vertragsanfragen können an{" "}
          <a href="mailto:kontakt@fanmind.ch">kontakt@fanmind.ch</a> gerichtet werden.
          Reaktionszeiten sind nicht garantiert, sofern keine Service-Level vereinbart sind.
        </p>
        <p>
          FanMind kann wichtige Informationen zu Konto, Sicherheit, Zahlung, Vertrag oder Produkt per
          E-Mail senden.
        </p>
      </>
    ),
  },
  {
    title: "Sperrung und Beendigung",
    content: (
      <>
        <p>
          FanMind kann Zugänge vorübergehend sperren oder beenden, wenn Nutzer gegen diese
          Bedingungen verstoßen, Sicherheitsrisiken entstehen, Zahlungen ausbleiben, Missbrauch
          vorliegt oder rechtliche Gründe dies erfordern.
        </p>
        <p>
          Vor einer dauerhaften Beendigung wird FanMind den Kunden, soweit zumutbar, informieren.
          Zahlungs- und gesetzliche Ansprüche bleiben unberührt.
        </p>
      </>
    ),
  },
  {
    title: "Haftung",
    content: (
      <>
        <p>
          FanMind haftet nach den gesetzlichen Vorschriften für Vorsatz und grobe Fahrlässigkeit.
          Bei leichter Fahrlässigkeit haftet FanMind nur bei Verletzung wesentlicher
          Vertragspflichten und begrenzt auf den vertragstypischen, vorhersehbaren Schaden, soweit
          gesetzlich zulässig.
        </p>
        <p>
          Eine Haftung für mittelbare Schäden, entgangenen Gewinn, Datenverlust oder Folgeschäden
          ist ausgeschlossen, soweit gesetzlich zulässig und nicht ausdrücklich anders vereinbart.
          Zwingende gesetzliche Haftung, insbesondere für Personenschäden, bleibt unberührt.
        </p>
        <p>
          Kunden sind für eigene Inhalte, rechtliche Zulässigkeit ihrer Kommunikation und Nutzung der
          KI-Ausgaben verantwortlich.
        </p>
      </>
    ),
  },
  {
    title: "Schlussbestimmungen",
    content: (
      <>
        <p>
          Es gilt österreichisches Recht, soweit dem keine zwingenden gesetzlichen Vorschriften
          entgegenstehen. Für Streitigkeiten mit Unternehmern ist, soweit zulässig, das sachlich
          zuständige Gericht am Sitz des Betreibers zuständig.
        </p>
        <p>
          Sollten einzelne Bestimmungen unwirksam sein, bleibt die Wirksamkeit der übrigen
          Bestimmungen unberührt. Änderungen dieser Bedingungen können erforderlich werden, wenn sich
          Produkt, Rechtslage oder technische Abläufe ändern.
        </p>
        <p>Die jeweils aktuelle Fassung ist unter /agb abrufbar.</p>
      </>
    ),
  },
];

function sectionId(index: number) {
  return `abschnitt-${index + 1}`;
}

export default function AgbPage() {
  return (
    <main id="top" className={styles.page}>
      <div className={styles.shapeOne} aria-hidden="true" />
      <div className={styles.shapeTwo} aria-hidden="true" />
      <LegalTopHeader active="agb" />
      <div className={styles.shell}>
        <header className={styles.hero}>
          <h1>AGB / VERTRAGSBEDINGUNGEN</h1>
          <p className={styles.subtitle}>für die Nutzung von FanMind</p>
          <p className={styles.stand}>Stand: Juli 2026</p>
          <p className={styles.intro}>
            Diese Vertragsbedingungen regeln das Vertragsverhältnis zwischen FanMind und Kundinnen
            und Kunden, Pilotkunden sowie registrierten Nutzerinnen und Nutzern, soweit keine
            abweichende individuelle Vereinbarung getroffen wurde. Abweichende Angebote,
            Auftragsbestätigungen oder Einzelvereinbarungen gehen diesen Bedingungen vor.
          </p>
        </header>

        <article className={styles.document} aria-label="AGB und Vertragsbedingungen für FanMind">
          {sections.map((section, index) => (
            <section className={styles.section} id={sectionId(index)} key={section.title}>
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
