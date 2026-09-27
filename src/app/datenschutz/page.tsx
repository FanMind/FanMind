import type { Metadata } from "next";
import Link from "next/link";
import LegalTopHeader from "@/components/LegalTopHeader";
import styles from "./datenschutz.module.css";

export const metadata: Metadata = {
  title: "Datenschutzerklärung | FanMind",
  description:
    "Transparenz zur Verarbeitung personenbezogener Daten bei FanMind.",
};

type PrivacySection = {
  id: string;
  icon: string;
  title: string;
  content: React.ReactNode;
};

const sections: PrivacySection[] = [
  {
    id: "verantwortlicher",
    icon: "⌂",
    title: "Verantwortlicher",
    content: (
      <>
        <p>
          Verantwortlich für diese Website und die beschriebenen FanMind-Dienste ist:
        </p>
        <address className={styles.addressBlock}>
          <strong>FanMind</strong>
          <span>
            Bernd Guggenberger, Einzelunternehmen – Geschäftsbezeichnung FanMind
          </span>
          <span>Turnerstraße 18</span>
          <span>2345 Brunn am Gebirge</span>
          <span>Österreich</span>
          <span>
            E-Mail: <a href="mailto:kontakt@fanmind.ch">kontakt@fanmind.ch</a>
          </span>
          <span>
            Website: <a href="https://fanmind.ch">https://fanmind.ch</a>
          </span>
        </address>
        <p>
          Inhaber und vertretungsberechtigt ist Bernd Guggenberger. Die
          vollständigen Anbieter- und Betreiberangaben ergeben sich ergänzend
          aus dem <Link href="/impressum">Impressum</Link>.
        </p>
        <p>
          Datenschutzanfragen können an <a href="mailto:kontakt@fanmind.ch">kontakt@fanmind.ch</a>
          gerichtet werden.
        </p>
      </>
    ),
  },
  {
    id: "gegenstand",
    icon: "i",
    title: "Worum es in dieser Datenschutzerklärung geht",
    content: (
      <>
        <p>
          Diese Datenschutzerklärung beschreibt, wie FanMind personenbezogene Daten im Zusammenhang
          mit der Website, Registrierung, Demo- und Login-Funktionen, geschützten Workspaces,
          Kontaktverwaltung, CSV-Import, KI-Vorschlägen, Kontaktwissen, Notizen, Follow-ups, Roadmap,
          Support sowie gegebenenfalls Zahlungs- und Abrechnungsprozessen verarbeitet.
        </p>
        <p>
          FanMind ist ein KI-gestütztes CRM und ein Copy-&-Open-Assistent für Fan-, Kunden- und
          Community-Beziehungen. FanMind unterstützt Nutzerinnen und Nutzer dabei, Kontakte zu
          verwalten, Kontextinformationen zu speichern, KI-gestützte Antwortvorschläge zu erstellen
          und Follow-ups manuell zu organisieren. FanMind ist kein Bot und versendet keine
          Nachrichten automatisch. Antwortvorschläge werden vom Menschen geprüft, kopiert,
          angepasst oder verworfen; der finale Versand erfolgt manuell außerhalb von FanMind oder
          über den jeweils genutzten Kanal, soweit ein Kanal produktiv verbunden ist.
        </p>
      </>
    ),
  },
  {
    id: "begriffe",
    icon: "§",
    title: "Begriffe",
    content: (
      <>
        <ul>
          <li><strong>Personenbezogene Daten</strong> sind Informationen, die sich auf eine identifizierte oder identifizierbare Person beziehen.</li>
          <li><strong>Verarbeitung</strong> meint jeden Umgang mit solchen Daten, etwa Erheben, Speichern, Ändern, Auslesen, Übermitteln oder Löschen.</li>
          <li><strong>Verantwortlicher</strong> entscheidet über Zwecke und Mittel der Verarbeitung.</li>
          <li><strong>Auftragsverarbeiter</strong> verarbeitet Daten im Auftrag und nach Weisung eines Verantwortlichen.</li>
          <li><strong>Nutzer / Kunde</strong> bezeichnet Personen oder Organisationen, die FanMind verwenden oder einen Workspace betreiben.</li>
          <li><strong>Kontakt / Fan / Community-Mitglied</strong> bezeichnet Dritte, deren Daten von Nutzern in FanMind eingetragen, importiert oder gespeichert werden.</li>
        </ul>
      </>
    ),
  },
  {
    id: "serverdaten",
    icon: "▦",
    title: "Website- und Serverdaten",
    content: (
      <>
        <p>
          Beim Aufruf der Website und der Anwendung können technische Zugriffsdaten verarbeitet
          werden, insbesondere IP-Adresse, Datum und Uhrzeit, aufgerufene Seiten, Browser,
          Gerätetyp, Betriebssystem, Referrer, Statuscodes sowie Fehler- und Sicherheitslogs.
        </p>
        <p>
          Zwecke sind die Auslieferung der Website, Sicherheit, Fehleranalyse,
          Missbrauchsprävention und Stabilität. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO.
          Minimierte Webhook- und Serverfehler-Diagnosen werden im technischen Standard höchstens
          30 Tage vorgehalten. PM2-Anwendungslogs werden täglich rotiert und in höchstens 14
          Rotationen gehalten; journald ist auf höchstens 14 Tage begrenzt. Bei einem bestätigten
          Sicherheitsvorfall kann eine gesonderte, erforderliche Beweissicherung länger bestehen.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    icon: "◌",
    title: "Cookies, Sessions und vergleichbare Technologien",
    content: (
      <>
        <p>
          FanMind verwendet technisch notwendige Cookies und vergleichbare Speicherungen, darunter
          <code>fanmind_sb_access_token</code>, <code>fanmind_sb_refresh_token</code>,
          <code>fanmind_locale</code> sowie gegebenenfalls weitere technisch notwendige
          Session- oder Login-Informationen.
        </p>
        <p>
          Diese Speicherungen dienen Login, Session-Verwaltung, geschütztem Workspace,
          Spracheinstellung, Sicherheit sowie Demo- und Login-Funktion. Rechtsgrundlagen sind
          Art. 6 Abs. 1 lit. b DSGVO für Login und Account sowie Art. 6 Abs. 1 lit. f DSGVO für
          Sicherheit und stabile Bereitstellung.
        </p>
        <p>
          Optionale Marketing-Messung wird erst nach einer ausdrücklichen Einwilligung aktiviert.
          Die Auswahl wird im Cookie <code>fanmind_marketing_consent</code> höchstens 180 Tage
          gespeichert. Sie kann jederzeit über die dauerhaft erreichbaren
          Datenschutz-Einstellungen geändert werden. Ohne Einwilligung lädt FanMind keinen Meta
          Pixel und baut hierfür keine Verbindung zu Meta auf.
        </p>
      </>
    ),
  },
  {
    id: "marketing-messung",
    icon: "◉",
    title: "Optionale Marketing-Messung mit Meta Pixel",
    content: (
      <>
        <p>
          FanMind kann den Meta Pixel von Meta Platforms Ireland Limited einsetzen, um nach
          ausdrücklicher Marketing-Einwilligung Vorgänge auf freigegebenen öffentlichen Seiten
          von <code>fanmind.ch</code> zu messen.
          Dafür wird das Script <code>connect.facebook.net/en_US/fbevents.js</code> erst nach der
          Einwilligung geladen. Im aktuell freigegebenen Stand wird ausschließlich das Standardevent
          <code>PageView</code> für zulässige öffentliche Seitenaufrufe und ohne zusätzliche
          FanMind-Eventparameter ausgelöst.
        </p>
        <p>
          Zweck ist die grundlegende Messung der Wirksamkeit von FanMind-Marketing. Rechtsgrundlage
          ist die Einwilligung nach Art. 6 Abs. 1 lit. a DSGVO. Dabei können technisch bedingt unter
          anderem IP-Adresse, Browser- und Geräteinformationen, Referrer, aufgerufener Pfad,
          Zeitstempel sowie von Meta gesetzte Kennungen verarbeitet werden. Eine Verarbeitung durch
          Meta außerhalb der EU/des EWR kann nicht ausgeschlossen werden und richtet sich nach den
          anwendbaren Meta-Datenschutz- und Transferregelungen.
        </p>
        <p>
          FanMind übermittelt über diese Integration keine E-Mail-Adressen, Namen, Telefonnummern,
          Account-, Workspace-, Kontakt-, CRM-, Nachrichten-, Prompt-, KI- oder Zahlungsinhalte.
          Geschützte CRM-, Admin-, Einstellungen-, Billing- und dynamische Kontaktrouten sowie
          unsichere Query- oder Fragmentwerte sind von der Pixel-Ausführung ausgeschlossen. Gleiches
          gilt für same-origin Referrer aus solchen geschützten oder nicht freigegebenen FanMind-Seiten.
          Erweitertes Matching, automatische Nutzerzuordnung, Conversions API und serverseitiges
          Meta-Tracking sind nicht aktiviert. Die vorbereiteten Eventnamen für spätere
          Conversion-Messungen werden ohne gesonderte fachliche und datenschutzrechtliche Prüfung
          nicht ausgelöst.
        </p>
        <p>
          Die Einwilligung kann jederzeit über den Button
          <strong> Datenschutz-Einstellungen</strong> mit Wirkung für die Zukunft widerrufen werden.
          FanMind blockiert danach weitere Pixel-Events und entfernt die bekannten, für den aktuellen
          Host zugänglichen First-Party-Meta-Cookies <code>_fbp</code> und <code>_fbc</code>. Bereits
          bei Meta verarbeitete Daten werden durch den lokalen Widerruf nicht rückwirkend gelöscht.
        </p>
      </>
    ),
  },
  {
    id: "registrierung",
    icon: "☉",
    title: "Registrierung und Nutzerkonto",
    content: (
      <>
        <p>
          Bei Registrierung und Nutzung eines Nutzerkontos können Name, E-Mail-Adresse,
          Authentifizierungsdaten, Organisation, Agentur, Club- oder Creator-Name, Rolle,
          optionale Nachricht, Sprache, Plan, Paket, Commercial Option, Zustimmung zu
          Zahlungsbedingungen, Zustimmungszeitpunkt, Nutzer-ID, Workspace-Zuordnung sowie
          Login- und Sessiondaten verarbeitet werden.
        </p>
        <p>
          Passwörter werden nicht im Klartext durch FanMind verarbeitet, sondern über die
          eingesetzte Authentifizierungsinfrastruktur verarbeitet. Zwecke sind Kontoerstellung,
          Login, Workspace-Anlage, Zugriffsschutz, Paket-/Planlogik, Support und
          Vertragsdurchführung. Rechtsgrundlagen sind Art. 6 Abs. 1 lit. b DSGVO sowie Art. 6
          Abs. 1 lit. f DSGVO für Sicherheit und Missbrauchsprävention.
        </p>
      </>
    ),
  },
  {
    id: "demo",
    icon: "▶",
    title: "Demo-Zugang",
    content: (
      <>
        <p>
          FanMind kann öffentliche oder temporäre Demo-Zugänge bereitstellen. Nutzerinnen und
          Nutzer sollen keine echten personenbezogenen Daten in öffentliche Demo-Zugänge eingeben.
          Demo-Inhalte können für andere Demo-Nutzer sichtbar sein, falls ein öffentlicher
          Demo-Modus genutzt wird.
        </p>
        <p>
          Der aktuelle temporäre Demo-Zugang ist auf eine Stunde begrenzt und wird danach zur
          Bereinigung vorgemerkt. Ein pseudonymer Browser-Schutz-Cookie kann zur
          Missbrauchsprävention bis zu 30 Tage bestehen. Echte Account-Verbindungen sind im
          Demo-Modus deaktiviert. Zwecke sind Produktdemonstration, Testzugang und
          Missbrauchsschutz.
        </p>
      </>
    ),
  },
  {
    id: "workspace",
    icon: "▣",
    title: "Workspace- und Profildaten",
    content: (
      <p>
        FanMind verarbeitet Workspace-ID, Workspace-Name, owner_user_id, Mitglieder, Rollen,
        Plan-ID, Paketstatus, gegebenenfalls Billing-Status, Sprache, Einstellungen und
        Profilinformationen. Diese Daten dienen Mandanten- und Workspace-Zuordnung,
        Zugriffskontrolle, Produktbereitstellung, Paketlogik und Support.
      </p>
    ),
  },
  {
    id: "kontakte",
    icon: "☷",
    title: "Kontakt-, Fan- und Community-Daten",
    content: (
      <>
        <p>
          Nutzer können Kontaktdaten wie Anzeigename, Display Name, Handle, Benutzername,
          Plattform, Quelle, Sprache, Status, Tags, Zusammenfassung, interne Notizen, Kontakt-ID,
          Workspace-ID, Reply-Target-URL und Zeitstempel speichern.
        </p>
        <p>
          Zwecke sind Kontaktverwaltung, Kontextspeicherung, Vorbereitung von Antworten,
          Nachvollziehbarkeit, manuelle Follow-ups und Fan-/Kundenbeziehungsmanagement. Wenn
          Nutzer oder Kunden Daten Dritter in FanMind eintragen oder importieren, sind sie dafür
          verantwortlich, dass sie dafür eine Rechtsgrundlage haben und betroffene Personen
          ordnungsgemäß informieren.
        </p>
      </>
    ),
  },
  {
    id: "csv",
    icon: "⇧",
    title: "CSV-Import",
    content: (
      <>
        <p>
          Der CSV-Import verarbeitet Daten, die Nutzer einfügen oder hochladen. Unterstützte Felder
          sind <code>name</code> / <code>display_name</code>, <code>handle</code>,
          <code>platform</code> / <code>source_platform</code>, <code>language</code>,
          <code>status</code>, <code>tags</code> und <code>summary</code>. Tags können per
          Semikolon getrennt sein. Duplikate können anhand von Handle und Plattform erkannt und
          übersprungen werden.
        </p>
        <p>
          Nutzer sollen keine sensiblen Daten, keine Daten Minderjähriger und keine unnötigen
          personenbezogenen Daten importieren, sofern keine klare Rechtsgrundlage besteht.
        </p>
      </>
    ),
  },
  {
    id: "nachrichten",
    icon: "✉",
    title: "Nachrichten, Kontexte und manuelle Eingaben",
    content: (
      <p>
        FanMind kann eingehende Nachrichten, ausgehende manuelle Nachrichten, Entwürfe, Notizen,
        eingefügten Chat-Kontext, Plattform, Quelle, Richtung wie inbound, outbound oder note,
        Autorlabel, Originaltextauszüge, Links, Quell-URLs, Anhänge-Metadaten soweit vorhanden
        und Zeitstempel verarbeiten. Diese Daten werden zur manuellen Bearbeitung und
        KI-Unterstützung verarbeitet. FanMind sendet keine Nachrichten automatisch.
      </p>
    ),
  },
  {
    id: "kontaktwissen",
    icon: "◷",
    title: "Kontaktwissen, Notizen und Follow-ups",
    content: (
      <>
        <p>
          Kontaktwissen-Einträge können Inhalt, Typ, Wichtigkeit, Kontaktbezug und Zeitstempel
          enthalten. Follow-ups können Grund, Fälligkeitsdatum, Priorität, Status, Kontaktbezug
          und Zeitstempel enthalten.
        </p>
        <p>
          Zwecke sind Erinnerung, Beziehungskontext, manuelle Nachverfolgung und strukturierte
          Arbeit im Workspace.
        </p>
      </>
    ),
  },
  {
    id: "ki",
    icon: "✧",
    title: "KI-Funktionen mit OpenAI",
    content: (
      <>
        <p>
          FanMind nutzt OpenAI über serverseitige API-Aufrufe, soweit eine KI-Funktion ausgelöst
          wird. Bei KI-Antwortvorschlägen können Kontakt-ID, Anzeigename, Handle, Quelle,
          Plattform, Sprache, Status, Tags, Fan-Zusammenfassung, interne Notizen, eingefügter
          Chat-Kontext, eingehende
          Nachricht, gewünschter Antwortmodus und vorhandener Analysebericht verarbeitet werden.
        </p>
        <p>
          Bei Kontaktanalysen können Kontaktdaten, interne Notizen, Kontaktwissen, gespeicherte
          Nachrichten oder Kontexte, ausgewählte Nachrichtenhistorie, Anhänge nur als Hinweis und
          ein generierter Analysebericht verarbeitet werden. Es wird keine Bildanalyse behauptet.
        </p>
        <p>
          Der OpenAI API-Key wird nur serverseitig verwendet und darf niemals im Browser erscheinen.
          Produktive KI-Anfragen verwenden <code>store: false</code>. Eingabelängen werden
          begrenzt. KI-Funktionen liefern Vorschläge, Entwürfe,
          Zusammenfassungen und Analysen; es findet keine automatische Entscheidung mit rechtlicher
          Wirkung und keine automatische Nachrichtenversendung statt. Nutzer prüfen und verwenden
          Vorschläge eigenverantwortlich.
        </p>
        <p>
          Rechtsgrundlagen sind Art. 6 Abs. 1 lit. b DSGVO, soweit die KI-Funktion Teil des
          Vertrags oder Funktionsumfangs ist, sowie Art. 6 Abs. 1 lit. f DSGVO für Sicherheit,
          Fehleranalyse, Missbrauchsprävention und Qualitätssicherung.
        </p>
      </>
    ),
  },
  {
    id: "automatisierte-entscheidung",
    icon: "⚖",
    title: "Keine automatisierte Entscheidung",
    content: (
      <p>
        FanMind trifft keine ausschließlich automatisierten Entscheidungen, die gegenüber
        betroffenen Personen rechtliche Wirkung entfalten oder sie in ähnlicher Weise erheblich
        beeinträchtigen. KI-Funktionen erstellen Vorschläge, Entwürfe, Zusammenfassungen und
        Analysen. Die Entscheidung über Nutzung, Anpassung oder Versand liegt beim Menschen.
      </p>
    ),
  },
  {
    id: "kanaele",
    icon: "⌁",
    title: "Kanäle, Integrationen und externe Plattformen",
    content: (
      <>
        <p>
          FanMind kann Kanäle und Integrationen anzeigen, vorbereiten oder — soweit produktiv
          freigegeben und vom Nutzer verbunden — verarbeiten. Manuelle Eingaben und CSV-Import sind
          live nutzbar. Instagram, TikTok, WhatsApp, Facebook, X/Twitter, Discord, Telegram und
          weitere Kanäle werden nicht pauschal als produktiv aktive Synchronisierung dargestellt.
        </p>
        <p>
          Wenn Facebook/Meta, Telegram, WhatsApp oder andere Anbieter produktiv aktiviert sind,
          können je nach Verbindung Plattform, Account- oder Page-ID, Page-Name, externe Thread-,
          Message- oder Comment-IDs, Sender-/Recipient-ID, Nachrichteninhalte, Kommentartexte,
          Event- oder Webhook-Daten, Zeitstempel, Scope-Informationen, Verbindungsstatus,
          Token-Metadaten wie <code>token_last_four</code> und verschlüsselt gespeicherte Access
          Tokens verarbeitet werden, soweit erforderlich.
        </p>
        <p>
          FanMind behauptet kein Scraping, keine autonome Kommunikation und keine automatische
          Versendung über diese Kanäle.
        </p>
      </>
    ),
  },
  {
    id: "zahlung",
    icon: "▭",
    title: "Zahlungs- und Abrechnungsdaten",
    content: (
      <>
        <p>
          Die Registrierung selbst löst keine Zahlung aus. Soweit Zahlungen produktiv aktiviert
          sind oder über FanMind gestartet werden, kann FanMind Stripe als Zahlungsdienstleister
          einsetzen. Derzeit ist eine Zahlung nur verfügbar, soweit der Checkout produktiv
          konfiguriert und freigeschaltet ist.
        </p>
        <p>
          Mögliche Daten sind Nutzer-ID, Workspace-ID, E-Mail-Adresse, Plan, Paket, Commercial
          Option, Preis-ID, Setup-Gebühr, monatliche Gebühr, Laufzeit, Commitment, Stripe Checkout
          Session ID, Stripe Customer ID, Stripe Subscription ID, Zahlungsstatus, Rechnungsstatus,
          Rechnungsbetrag, Link zu Rechnung oder PDF, Rechnungsadresse, Steuer-ID oder UID sowie
          SEPA-Lastschriftmandat und Zahlungsdaten, soweit bei Stripe eingegeben.
        </p>
        <p>
          FanMind speichert keine vollständigen Bankdaten oder IBAN im Klartext in der Anwendung.
          Zahlungsdaten werden, soweit aktiviert, durch den Zahlungsdienstleister verarbeitet.
          Rechtsgrundlagen sind Art. 6 Abs. 1 lit. b DSGVO für Vertrag und Zahlung sowie Art. 6
          Abs. 1 lit. c DSGVO für gesetzliche Aufbewahrungs- und Steuerpflichten.
        </p>
      </>
    ),
  },
  {
    id: "support",
    icon: "?",
    title: "Kontakt, Support und Pilot-/Demo-Anfragen",
    content: (
      <p>
        Bei Kontakt-, Support-, Pilot- oder Demo-Anfragen können Name, E-Mail-Adresse,
        Unternehmen, Organisation, Rolle, Nachricht, Kommunikationsverlauf, technische Metadaten
        und Supportanliegen verarbeitet werden. Zwecke sind Beantwortung der Anfrage, Vorbereitung
        von Demo oder Pilot, Vertragsanbahnung, Support und Nachweisführung. Rechtsgrundlagen sind
        Art. 6 Abs. 1 lit. b DSGVO bei Vertrags- oder Pilotbezug und Art. 6 Abs. 1 lit. f DSGVO
        bei allgemeiner Kommunikation.
      </p>
    ),
  },
  {
    id: "email",
    icon: "@",
    title: "E-Mail-Versand und Systembenachrichtigungen",
    content: (
      <>
        <p>
          Für transaktionale E-Mails und Benachrichtigungen können E-Mail-Dienstleister eingesetzt
          werden, soweit dies für Betrieb, Registrierung, Support oder Benachrichtigungen
          erforderlich ist. Im Code ist Resend als optionaler Dienst für Pilot-Anfragen vorbereitet.
        </p>
        <p>
          Soweit Resend tatsächlich konfiguriert ist, kann die Versandregion der Domain gewählt
          werden. Nach den aktuellen Anbieterangaben werden Konto-, E-Mail-Metadaten, Logs und
          API-Aufzeichnungen jedoch unabhängig von dieser Senderegion in den USA gespeichert.
          Eine EU-Senderegion ist daher kein Nachweis für EU-Datenspeicherung; DPA,
          Unterauftragsliste und Transfergrundlage werden kontobezogen geprüft.
        </p>
      </>
    ),
  },
  {
    id: "empfaenger",
    icon: "↗",
    title: "Empfänger und Auftragsverarbeiter",
    content: (
      <>
        <p>
          Daten können an Dienstleister und Empfänger übermittelt werden, soweit dies für Betrieb,
          Vertrag, Support, Sicherheit oder gesetzliche Pflichten erforderlich ist.
        </p>
        <ul>
          <li>Exoscale als Hosting-/Serveranbieter, soweit FanMind produktiv auf Exoscale betrieben wird.</li>
          <li>Supabase für Authentifizierung, Datenbank, PostgREST und Session-/Account-Verwaltung.</li>
          <li>OpenAI für KI-Antwortvorschläge und Analysefunktionen, soweit ausgelöst.</li>
          <li>Stripe für Zahlungsabwicklung, soweit Checkout produktiv aktiviert ist.</li>
          <li>E-Mail-Dienstleister, soweit aktiv.</li>
          <li>Meta/Facebook für den consent-gesteuerten Meta Pixel ausschließlich nach ausdrücklicher Marketing-Einwilligung sowie für Kanäle nur, soweit ein Nutzer sie produktiv verbindet oder eine Integration produktiv freigegeben ist.</li>
          <li>GitHub/GitHub Actions für Code und Deployment, nicht als regulärer Empfänger von Workspace-Inhalten.</li>
          <li>Steuerberatung, Buchhaltung, Rechtsberatung, Behörden oder Gerichte, soweit erforderlich.</li>
        </ul>
      </>
    ),
  },
  {
    id: "drittland",
    icon: "◎",
    title: "Drittlandübermittlungen",
    content: (
      <>
        <p>
          Einige Dienstleister können Daten außerhalb der EU/des EWR verarbeiten. Eine Übermittlung
          erfolgt nur, soweit hierfür eine datenschutzrechtliche Grundlage besteht, zum Beispiel ein
          Angemessenheitsbeschluss, Standardvertragsklauseln oder sonstige geeignete Garantien.
          Für aktive Anbieter werden Vertragsfassung, Rollen, Verarbeitungsregion,
          Unterauftragsverarbeiter und Transfergrundlage vor echtem Drittpersonen-Onboarding
          anhand des jeweiligen FanMind-Kontos geprüft. Eine bloß öffentlich verfügbare
          Anbieter-DPA ersetzt diesen kontobezogenen Nachweis nicht.
        </p>
      </>
    ),
  },
  {
    id: "speicherdauer",
    icon: "◴",
    title: "Speicherdauer",
    content: (
      <ul>
        <li>Minimierte Webhook- und Serverfehler-Diagnosen werden standardmäßig nach 30 Tagen gelöscht. PM2-Anwendungslogs werden täglich rotiert und in höchstens 14 Rotationen gehalten; journald ist auf 14 Tage begrenzt.</li>
        <li>Die Marketing-Consent-Auswahl wird höchstens 180 Tage gespeichert und kann jederzeit geändert werden. Meta-Pixel-Daten entstehen bei FanMind erst nach Einwilligung; für eine weitere Verarbeitung bei Meta gelten die dortigen Aufbewahrungsregeln.</li>
        <li>Temporäre öffentliche Demo-Zugänge laufen nach einer Stunde ab und werden zur Bereinigung vorgemerkt. Der pseudonyme Browser-Schutz-Cookie bleibt höchstens 30 Tage bestehen.</li>
        <li>Account- und Workspace-Daten werden für die Dauer des Nutzerkontos, Vertrags oder freigegebenen Zugangs gespeichert. Bestätigte Account-Löschanfragen haben ein reguläres Bearbeitungsziel von höchstens 30 Tagen; laufende Verträge, notwendige Eigentumsübertragung oder gesetzliche Pflichten können einzelne Schritte begründet blockieren.</li>
        <li>Kontakt-, Fan-, Nachrichten-, Kontaktwissen- und Follow-up-Daten bleiben für die Dauer des Workspace oder bis zur Löschung durch Nutzer oder Kunde gespeichert, soweit keine Pflichten entgegenstehen.</li>
        <li>KI-Ausgaben und Analyseberichte werden gespeichert, solange sie im Workspace vorhanden sind oder für Nachvollziehbarkeit, Support und Produktfunktion erforderlich sind.</li>
        <li>Die verschlüsselte Mobile-Offline-Kontaktübersicht ist auf 50 Einträge und 24 Stunden begrenzt. Die vorbereitete, noch zustellungsfreie Mobile-Push-Registrierung läuft 30 Tage nach der letzten bestätigten Aktivität ab.</li>
        <li>Zahlungs- und Rechnungsdaten werden gemäß gesetzlichen Aufbewahrungspflichten gespeichert.</li>
        <li>Verschlüsselte lokale Backups werden zählerbasiert gehalten: je ein täglicher, wöchentlicher und monatlicher Stand für Datenbank, Storage und Serverkonfiguration sowie je ein wöchentlicher und monatlicher Full-Stand. Für Offsite-Backups ist dieselbe Auswahl derzeit nur als read-only Löschplan geprüft; eine vollständig ausgeführte zeitliche Offsite-Löschregel bleibt vor Vertragsfreigabe nachzuweisen.</li>
        <li>Wo noch keine verbindliche Endfrist festgelegt ist, gelten Zweckfortfall, veranlasste Löschung, Vertragsende und gesetzliche Pflichten als Kriterien. Die konkreten Fristen für CRM-, Support-, Rechnungs-, Vertrags- und KI-Kostenereignisse werden vor echtem Drittpersonen-Onboarding rechts- beziehungsweise steuerfachlich bestätigt.</li>
      </ul>
    ),
  },
  {
    id: "sicherheit",
    icon: "◇",
    title: "Datensicherheit",
    content: (
      <>
        <p>
          FanMind setzt technische und organisatorische Maßnahmen ein, um personenbezogene Daten zu
          schützen. Dazu gehören HTTPS/TLS, serverseitige API-Keys, keine OpenAI-Keys im Browser,
          Supabase Auth, Session-Cookies, Workspace-Zuordnung, Zugriffsbeschränkungen,
          RLS-/Workspace-Trennung soweit technisch umgesetzt, Service-Role-Key nur serverseitig,
          verschlüsselte Speicherung externer Tokens soweit produktiv genutzt,
          Eingabelängenbegrenzung bei KI, keine automatische Sendefunktion,
          Protokollierung sicherheitsrelevanter Ereignisse, Backups und regelmäßige technische
          Prüfung.
        </p>
      </>
    ),
  },
  {
    id: "besondere-daten",
    icon: "!",
    title: "Besondere Kategorien personenbezogener Daten",
    content: (
      <p>
        FanMind ist nicht dafür vorgesehen, besondere Kategorien personenbezogener Daten nach
        Art. 9 DSGVO zu verarbeiten. Nutzer sollen keine sensiblen Daten wie Gesundheitsdaten,
        politische Meinungen, religiöse oder weltanschauliche Überzeugungen,
        Gewerkschaftszugehörigkeit, sexuelle Orientierung oder biometrische Daten eingeben oder
        importieren, sofern hierfür keine ausdrückliche Rechtsgrundlage besteht und dies nicht
        erforderlich ist.
      </p>
    ),
  },
  {
    id: "minderjaehrige",
    icon: "⌾",
    title: "Minderjährige",
    content: (
      <p>
        FanMind richtet sich nicht gezielt an Minderjährige. Nutzer dürfen Daten Minderjähriger nur
        eintragen oder importieren, wenn sie dafür eine ausreichende Rechtsgrundlage haben und dies
        erforderlich ist.
      </p>
    ),
  },
  {
    id: "kundendaten",
    icon: "☑",
    title: "Verantwortlichkeit von Kunden für Daten Dritter",
    content: (
      <>
        <p>
          Wenn Kunden oder Nutzer Daten von Fans, Kontakten, Community-Mitgliedern oder sonstigen
          Dritten in FanMind eingeben, importieren oder speichern, bleiben sie für die
          Rechtmäßigkeit dieser Verarbeitung verantwortlich. Sie müssen insbesondere eine
          Rechtsgrundlage haben, betroffene Personen informieren, keine unnötigen Daten importieren,
          Lösch- und Auskunftsrechte beachten und keine sensiblen Daten ohne klare Rechtsgrundlage
          verarbeiten.
        </p>
        <p>
          Soweit FanMind personenbezogene Daten im Auftrag eines Kunden verarbeitet, wird die
          Auftragsverarbeitung bei Bedarf individuell vertraglich geregelt.
        </p>
      </>
    ),
  },
  {
    id: "rechte",
    icon: "♢",
    title: "Betroffenenrechte",
    content: (
      <>
        <p>
          Betroffene Personen haben nach Maßgabe der DSGVO Rechte auf Auskunft, Berichtigung,
          Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit, Widerspruch, Widerruf von
          Einwilligungen und Beschwerde bei einer Aufsichtsbehörde. Anfragen können an
          <a href="mailto:kontakt@fanmind.ch"> kontakt@fanmind.ch</a> gerichtet werden.
        </p>
        <p>
          Zuständige Aufsichtsbehörde in Österreich ist die Österreichische Datenschutzbehörde,
          Barichgasse 40-42, 1030 Wien, Österreich, E-Mail: <a href="mailto:dsb@dsb.gv.at">dsb@dsb.gv.at</a>,
          Telefon: +43 1 52 152-0.
        </p>
      </>
    ),
  },
  {
    id: "widerruf",
    icon: "↺",
    title: "Widerruf und Widerspruch",
    content: (
      <p>
        Einwilligungen können mit Wirkung für die Zukunft widerrufen werden. Gegen Verarbeitungen
        auf Grundlage berechtigter Interessen kann aus Gründen der besonderen Situation
        widersprochen werden. Direktwerbung kann jederzeit widersprochen werden.
      </p>
    ),
  },
  {
    id: "aenderungen",
    icon: "✎",
    title: "Änderungen dieser Datenschutzerklärung",
    content: (
      <p>
        Wir können diese Datenschutzerklärung anpassen, wenn sich FanMind, technische Funktionen,
        eingesetzte Dienstleister oder rechtliche Anforderungen ändern. Die aktuelle Fassung ist
        unter <Link href="/datenschutz">/datenschutz</Link> abrufbar.
      </p>
    ),
  },
];

export default function DatenschutzPage() {
  return (
    <main id="top" className={styles.page}>
      <div className={styles.watermark} aria-hidden="true" />
      <div className={styles.dotPattern} aria-hidden="true" />
      <LegalTopHeader active="datenschutz" />
      <div className={styles.shell}>
        <section className={styles.hero} aria-labelledby="privacy-title">
          <h1 id="privacy-title">Datenschutzerklärung</h1>
          <p>Transparenz zur Verarbeitung personenbezogener Daten bei FanMind</p>
          <span className={styles.statusPill}>▣ Stand: Juli 2026</span>
        </section>

        <article className={styles.timeline} aria-label="Datenschutzerklärung Inhalt">
          {sections.map((section, index) => (
            <section className={styles.section} id={section.id} key={section.id} aria-labelledby={`${section.id}-title`}>
              <div className={styles.iconWrap} aria-hidden="true">{section.icon}</div>
              <div className={styles.sectionBody}>
                <h2 id={`${section.id}-title`}>{index + 1}. {section.title}</h2>
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
