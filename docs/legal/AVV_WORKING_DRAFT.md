# FanMind AVV – geprüfte Arbeitsfassung

Stand: 30. Juli 2026

Diese Arbeitsfassung bereitet die technischen und fachlichen Anlagen einer
Auftragsverarbeitungsvereinbarung vor. Sie ist **nicht unterschriftsreif**,
keine Rechtsberatung und keine bereits geschlossene AVV. Vor Verwendung sind
insbesondere Parteien, Anbieter-Verträge, Verarbeitungsregionen,
Drittlandgrundlagen, Haftung, Fristen und die vollständige Vertragsfassung
durch Rechtsberatung und die beteiligten Parteien zu bestätigen.

Rechtlicher Orientierungsrahmen ist insbesondere
[Art. 28 DSGVO](https://eur-lex.europa.eu/eli/reg/2016/679/oj), der für eine
Auftragsverarbeitung unter anderem Gegenstand und Dauer, Art und Zweck,
Datenarten, betroffene Personengruppen sowie Pflichten und Rechte des
Verantwortlichen verlangt.

## 1. Rollen und Parteien

- **Auftragsverarbeiter:** Bernd Guggenberger, Einzelunternehmen unter der
  Geschäftsbezeichnung FanMind, Turnerstraße 18, 2345 Brunn am Gebirge,
  Österreich.
- **Verantwortlicher:** der im jeweiligen FanMind-Vertrag ausgewiesene
  B2B-Kunde beziehungsweise die dort ausgewiesene Organisation.
- FanMind verarbeitet die vom Kunden in seinem Workspace bereitgestellten
  personenbezogenen Daten ausschließlich zur Bereitstellung der vereinbarten
  FanMind-Funktionen und nach dokumentierter Weisung.
- Der Kunde bleibt für Rechtsgrundlage, Transparenz, Datenminimierung und die
  Rechtmäßigkeit der in FanMind eingegebenen oder importierten Daten
  verantwortlich.

## 2. Gegenstand, Zweck und Dauer

Gegenstand ist die technische Bereitstellung eines mandantengetrennten CRM und
Copy-&-Open-Assistenten für Kontaktverwaltung, Nachrichtenkontext,
Kontaktwissen, Follow-ups und manuell ausgelöste KI-Antwortvorschläge.

FanMind versendet keine Nachrichten automatisch. Nutzer prüfen, kopieren,
ändern oder verwerfen KI-Ausgaben und versenden final selbst im Originalkanal.

Die Verarbeitung läuft für die Dauer des Kundenvertrags beziehungsweise des
freigegebenen Zugangs. Rückgabe, Export, Löschung, gesetzlich erforderliche
Aufbewahrung und die Behandlung verschlüsselter Backups sind vor
Vertragsschluss anhand des
[technischen Retention-Registers](RETENTION_REGISTER.md) verbindlich
festzulegen.

## 3. Art der Verarbeitung

Je nach aktivierter Funktion umfasst die Verarbeitung Erheben, Erfassen,
Ordnen, Speichern, Auslesen, Abfragen, Verknüpfen, Berichtigen, Exportieren,
Löschen und die begrenzte Übermittlung an bestätigte
Unterauftragsverarbeiter. Automatisches Senden, Scraping und autonome
Entscheidungen mit rechtlicher oder ähnlich erheblicher Wirkung gehören nicht
zum vereinbarten Produktumfang.

## 4. Datenarten

- Account- und Nutzerdaten: Name, E-Mail-Adresse, Authentifizierungs- und
  Session-Metadaten, Rolle, Sprache und Workspace-Zuordnung;
- Organisations- und Vertragsdaten: Workspace, Paket, Vertrags- und
  Abrechnungsstatus sowie freigegebene Unternehmensstammdaten;
- Kontakt- und Community-Daten: Name, Anzeigename, Handle, Plattform,
  Sprache, Status, Tags, Zusammenfassung und interne Notizen;
- Kommunikationsdaten: eingefügte oder gespeicherte Nachrichten,
  Nachrichtenkontext, Quellhinweise, Richtung und Zeitstempel;
- Kontaktwissen und Follow-ups: Inhalte, Priorität, Status, Fälligkeit und
  Kontaktbezug;
- KI-Verarbeitungsdaten: begrenzter, vom Nutzer ausgelöster Kontext und
  Antwort-, Kontaktwissen- oder Follow-up-Vorschläge;
- technische Daten: interne IDs, Zeitstempel, minimierte Diagnosemerkmale,
  Sicherheits- und Fehlerklassen;
- optional aktivierte Zahlungs- und Integrationsmetadaten, jedoch keine
  vollständigen Bankdaten oder Plattform-Passwörter im FanMind-Klartext.

## 5. Betroffene Personengruppen

- Nutzer, Mitglieder und Administratoren des Kunden-Workspace;
- Kontakte, Fans, Community-Mitglieder, Interessenten und Kunden des
  FanMind-Kunden;
- Ansprechpersonen von Support-, Demo- und Vertragsanfragen;
- Vertreter und Beschäftigte von Geschäftskunden, soweit deren Daten im
  Workspace verarbeitet werden.

FanMind ist nicht für besondere Kategorien personenbezogener Daten nach
Art. 9 DSGVO oder Daten Minderjähriger ausgelegt. Der Kunde darf solche Daten
nur bei eigener tragfähiger Rechtsgrundlage und gesondert geprüfter
Erforderlichkeit verarbeiten.

## 6. Weisungen und Vertraulichkeit

- Vertrag, bestätigte Anlagen und sichere Produktkonfiguration bilden die
  dokumentierten Weisungen.
- Neue Zwecke, automatisches Senden, zusätzliche Datenkategorien oder neue
  produktive Integrationen erfordern eine gesonderte, dokumentierte Freigabe.
- Zugriffsberechtigte Personen werden auf Vertraulichkeit verpflichtet.
- Hält FanMind eine Weisung für datenschutzwidrig, wird der Kunde informiert
  und die betroffene Verarbeitung bis zur Klärung nicht erweitert.

## 7. Technische und organisatorische Maßnahmen

Der aktuell belegte technische Mindeststand umfasst:

- HTTPS/TLS und ausschließlich serverseitige Verwendung privilegierter API-
  und Service-Role-Schlüssel;
- Supabase Auth, geschützte Sessions, Workspace-Autorisierung und
  Row-Level-Security für mandantenbezogene Daten;
- rollen- und ressourcenbezogene Prüfung geschützter API-Mutationen;
- verschlüsselte, prüfsummengeschützte Backups und getrennte Offsite-Kopien;
- begrenzte Request-Größen, Rate Limits und minimierte Diagnoseereignisse;
- keine Prompt- oder Antwortvolltexte in KI-Kostenereignissen;
- manuelle Freigabe vor Nutzung jeder KI-Antwort;
- zentrale Secret-, Dependency-, RLS-, Release-, Health- und
  Product-Truth-Prüfungen;
- dokumentierter Löschanfrageprozess, Datenauskunft und begrenzte
  technische Retention;
- getrennte Entwicklungs-, Staging- und Produktionsgrenzen, soweit die
  jeweiligen externen Ressourcen bereitgestellt sind.

Die tatsächliche RLS-Abdeckung, Restore-Fähigkeit, Host-Konfiguration,
Produktionsregionen und Anbieter-Verträge müssen vor Kunden-Onboarding erneut
gegen den dann produktiven Stand geprüft werden.

## 8. Unterstützungspflichten

FanMind unterstützt den Kunden im angemessenen und technisch möglichen Umfang
bei:

- Auskunft, Berichtigung, Löschung, Einschränkung,
  Datenübertragbarkeit, Widerspruch und Widerruf;
- Prüfung und Meldung von Datenschutzverletzungen;
- Datenschutz-Folgenabschätzung und Behördenkonsultation, soweit für den
  FanMind-Verarbeitungsumfang erforderlich;
- Nachweis der vereinbarten technischen und organisatorischen Maßnahmen.

Betroffenenanfragen und Sicherheitsvorfälle werden an
`fanmind@fanmind.ch` gerichtet und gegen den betroffenen Workspace geprüft.

## 9. Löschung und Rückgabe

- FanMind stellt einen workspace-begrenzten Datenauskunfts-Export bereit.
- Eine bestätigte Account-Löschanfrage hat technisch ein reguläres
  Bearbeitungsziel von höchstens 30 Tagen; laufende Verträge,
  Eigentumsübertragung, gesetzliche Pflichten oder Sicherungszyklen können
  einzelne Teile begründet verzögern.
- Nach Vertragsende werden Kundendaten nach bestätigter Weisung gelöscht oder
  zurückgegeben, soweit keine gesetzliche Aufbewahrungspflicht entgegensteht.
- Verschlüsselte Backups folgen einer gesonderten Retention- und
  Wiederherstellungsregel. Eine zeitlich konkrete, vollständig ausgeführte
  Offsite-Löschregel ist vor Vertragsfreigabe noch extern zu belegen.

## 10. Sicherheitsvorfälle und Nachweise

FanMind dokumentiert Sicherheitsereignisse datenarm, begrenzt Zugriff und
Aufbewahrung und informiert den Kunden nach Bestätigung eines relevanten
Vorfalls ohne unangemessene Verzögerung mit den verfügbaren Informationen.
Eine verbindliche Meldefrist, Kommunikationskette und Verantwortungsmatrix
sind in der finalen AVV festzulegen.

Nachweise erfolgen vorrangig durch vorhandene technische Dokumentation,
Prüfberichte, CI-Ergebnisse, Health-/Version-Nachweise sowie angemessene
Fragebögen. Auditrecht, Frequenz, Vertraulichkeit und Kostenregelung bleiben
Teil der extern zu prüfenden Vertragsfassung.

## 11. Unterauftragsverarbeiter und weitere Empfänger

| Dienst | Technischer Zweck | Aktueller technischer Status | Vor Vertragsfreigabe extern zu bestätigen |
| --- | --- | --- | --- |
| Exoscale / Akenes SA | Produktionshosting, Server und lokale Erzeugung verschlüsselter Backups | produktiver Host dokumentiert | im Konto gespeichertes DPA-Annahmedatum, konkrete Compute-Zone sowie Region und Anbieter des getrennten Offsite-Ziels |
| Supabase | Authentifizierung, PostgreSQL, RLS, REST und Storage | produktiv erforderlich | über den Dashboard-Legal-Bereich angeforderte und unterzeichnete PandaDoc-DPA, Projektregion und aktuelle Unterauftragsliste |
| OpenAI Ireland Ltd. | manuell ausgelöste KI-Vorschläge und Analysen | produktiv erforderlich, API serverseitig, `store: false` | kontobezogener DPA-/Vertragsnachweis, Region des tatsächlich verwendeten API-Projekts, Transfergrundlage und aktuelle Unterauftragsliste |
| Stripe Payments Europe, Limited | Checkout, Abonnement und Abrechnung | produktiver Konfigurationspfad vorhanden | Konto-Vertragspartner, Rollen je Datenfluss, DPA-Fassung, globale Transfergrundlagen und aktuelle Service-Provider-Liste; keine erfundene einzelne Speicherregion |
| Meta Platforms Ireland Limited | consent-gesteuerte öffentliche Marketing-Messung | nur nach Einwilligung; keine CRM-/Prompt-/Zahlungsinhalte | Business-/Pixel-Eigentümer, akzeptierte Business-Tools-Bedingungen, Rollenverteilung und Transfergrundlage |
| Resend / Plus Five Five, Inc. | optionale transaktionale E-Mail | Codepfad optional; aktiver Produktionsanbieter noch zu belegen | tatsächliche Aktivierung, DPA-Nachweis, Senderegion, US-Speicherung von Konto-/E-Mail-Metadaten, Unterauftragsliste und Transfergrundlage |

GitHub und GitHub Actions verarbeiten Quellcode und Deployment-Metadaten, sind
aber nicht als regulärer Empfänger von Workspace-Inhalten vorgesehen. Wird
diese Grenze geändert, ist die Liste neu zu bewerten.

Aktuelle offizielle Anbieter-Unterlagen als Prüfeinstieg:

- [Exoscale DPA](https://www.exoscale.com/dpa/)
- [Supabase DPA](https://supabase.com/legal/dpa)
- [OpenAI DPA](https://openai.com/de-DE/policies/data-processing-addendum/)
- [Stripe Österreich DPA](https://stripe.com/at/legal/dpa)
- [Meta Data Processing Terms](https://www.facebook.com/legal/terms/dataprocessing)
- [Resend DPA](https://resend.com/legal/dpa)

Ein öffentlicher Link belegt noch nicht, dass das jeweilige FanMind-Konto die
richtige Fassung wirksam abgeschlossen hat.

Das konto- und versionsbezogene Nachweisverfahren steht in
[`EXTERNAL_APPROVAL_REGISTER.md`](EXTERNAL_APPROVAL_REGISTER.md). Signierte
Dokumente und Konto-Screenshots bleiben außerhalb von GitHub; das
maschinenlesbare Register übernimmt nur Status, Datum und Beweis-Hash.

## 12. Noch erforderliche Abschlussentscheidungen

1. finale Kunden- und Betreiberangaben in der Vertragsurkunde;
2. rechtsgeprüfte Hauptklauseln einschließlich Haftung, Audit,
   Sicherheitsvorfall und Kündigungsfolgen;
3. bestätigte Anbieter-DPAs, Unterauftragslisten, Regionen und
   Drittlandgrundlagen;
4. fachlich und steuerlich bestätigte Aufbewahrungs- und Löschfristen;
5. isolierter Restore-/Lösch-Nachweis für verschlüsselte Backups;
6. Unterschrift beziehungsweise wirksame elektronische Annahme durch beide
   Parteien.

## 13. Empfohlener Prüf- und Unterschriftsweg

Die Steuerberatung bestätigt Betreiber-/UID-/Registerangaben,
Rechnungsdarstellung und steuerliche Aufbewahrungsfristen. Die
unterzeichnungsfähige AVV sollte zusätzlich durch Rechts- beziehungsweise
qualifizierte Datenschutzberatung aus dieser Arbeitsfassung erstellt werden.

Nach externer Freigabe unterschreibt oder akzeptiert Bernd Guggenberger für
FanMind. Der jeweilige B2B-Kunde unterschreibt oder akzeptiert für seine
Organisation. Eine Steuerberaterin oder ein Steuerberater ist nicht allein
durch die fachliche Prüfung Vertragspartei der Kunden-AVV.
