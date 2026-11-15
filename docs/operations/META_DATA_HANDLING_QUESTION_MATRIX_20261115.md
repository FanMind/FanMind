# Meta-Datenverarbeitung: konkret gelesene Fragen und belegte Antworten

Stand15.11.2026, bestehender DraftPR1509 / #1480 / #1464.
Maßgeblich für den aktuellen Portalstand; frühere Anzeigen bleiben historisch.
Kein Reviewantrag eingereicht. Genau die drei bisherigen Instagram-Rechte.

**Neuester Owner-Stand15.11.2026:** vollständige Meta-Einreichung grundsätzlich
freigegeben, sobald alle echten Anforderungen erfüllt sind. Spätere
Integration-only-Production-Einführung bleibt Meta-, Staging- und allen
Release-/Backup-/Restore-Gates unterworfen; kein allgemeiner Release.
Icon der richtigen Review-App ist nach Neuladen und eigener App-Karte **PASS**.
Alle10Hosted-Prüfungen des bisherigen Heads3cb04a81 waren erfolgreich.
Der notwendige Dokumentationsabgleich mit Main5fc2832b erhält die parallele
Media-Storage-Arbeit unverändert und benötigt neue Head-Prüfungen.
Aktueller praktischer Blocker: Staging-Sitzung leitet erneut auf Login um;
Kommentar-Lesetest wurde noch nicht neu ausgeführt. Keine Erfolgserfindung.
Exoscale-/Supabase-/OpenAI-Vertrags-/Fernzugriffslücken bleiben einzeln offen.

## 1. Tatsächlicher Fragebogen

### Ergänzung: kontrollierter technischer Mediennachweis

Der bestehende eigene Medien-/Kommentar-Leselauf hat inzwischen tatsächlich
einen Beitrag und eine erfolgreiche leere Kommentarantwort geliefert.
Die Operator-Antwort hatte dabei nur Zähler und verlor die konkrete Medien-ID
und den Provider-Permalink. Die gezielte Ergänzung gibt ausschließlich die
validierte eigene Medien-ID, den bereits normalisierten öffentlichen
Instagram-Permalink und die nach erfolgreichem Kommentar-GET gesetzte
Bestätigung zurück. Keine neuen Provider-Aufrufe, gespeicherten Daten,
Berechtigungen, Tokenausgaben, Rohantworten oder Traces. Bestehende
Staging-/Operator-/Workspace-/Kontogrenzen bleiben erhalten.

Die synthetische Prüfung belegt die Rückgabe auch bei null Kommentaren,
verwirft ungültige IDs/fehlgeschlagene Antworten und unterdrückt fremde
Permalink-Hosts sowie URL-Querydaten. Das ist eine vorbereitete
Diagnoseergänzung, noch kein neuer bereitgestellter oder tatsächlicher
numerischer Live-Mediennachweis. Keine ID aus einem Shortcode errechnen.

Metas bis24Stunden dauernde Aktualisierungsfrist ist am15.11. noch nicht
abgelaufen. Eine einmalige Nachprüfung ist für16.11.2026 um13:00
Europe/Vienna eingerichtet; keine automatischen neuen Provider-Aufrufe oder
Autorisierungen. Der tatsächliche aktuelle0von1-Stand bleibt offen, bis Meta
den erforderlichen Kommentar-Test tatsächlich anerkennt. Die spätere
Automatisierung muss einen fehlenden autorisierten Zugang als Blocker melden.

Kontoabonnement bleibt getrennt: letzter echter GET und vorheriger POST
HTTP400/Code100/Subcode33, object_unavailable, trotz funktionierender eigener
Kommentar-Lesekante. Kein erneuter POST und kein spekulativer API-Fix.

Der aktuelle App-Review-Entwurf empfiehlt juristische/strategische Expertise
innerhalb der Organisation. Er verlangt hier keine externe anwaltliche
Bescheinigung. Die Owner-Entscheidung stellt diese Beauftragung zurück; sie
ersetzt weder offene Rechtsbeurteilungen noch tatsächliche Implementierung.
Meta verlangt vor Absenden die Prüfung aller vorausgefüllten Antworten.

| Formularfrage | Optionen / Folgefelder | Antwortvorschlag und konkreter Nachweis | Implementierungsstatus / notwendiger Abschluss | Schon verwendbar? |
| --- | --- | --- | --- | --- |
| processor-0: Gibt es Auftragsverarbeiter oder Dienstleistungsanbieter (einschließlich deiner eigenen Unternehmen), die Zugriff auf die von Meta bereitgestellten Plattformdaten haben werden? | Ja / Nein. Ja öffnet processor-2. Plattformdaten umfassen auch API-Tokens und App-Geheimcode. | **Ja / Yes.** Bestehendes Hosting verarbeitet die App; Datenbank/Auth/Storage sind angebunden. `AVV_WORKING_DRAFT.md`, bestehende Integration und zentrale Datenbankanbindung. | Providerzugriff architektonisch belegt; vollständige konkrete Empfängerliste noch nicht abgeschlossen. | **Ja; Ja im offiziellen Entwurf gespeichert und zurückgelesen.** |
| processor-2: Gib alle Auftragsverarbeiter oder Dienstleistungsanbieter (inklusive deiner eigenen Unternehmen) an, die Zugriff auf die Plattformdaten erhalten werden, die du auf Meta erfasst. | Pro Anbieter Name, Dienstkategorien und Länder; siehe unten. | Hosting: Exoscale; Datenbank/Auth/Storage: Supabase; bei freigegebener KI-Verarbeitung: tatsächlich konfigurierte OpenAI-Vertragseinheit. Nur tatsächlich geplante Meta-Empfänger aufnehmen. | Genaue kontobezogene Vertragspartner, relevante Dienste und vollständige Fernzugriffsländer fehlen teilweise. Kein bloßes Markenverzeichnis als vollständig erklärt. | **Nein, vollständige Liste offen.** |
| responsible-1: Welche natürliche oder juristische Person trägt die Verantwortung für alle durch Meta geteilten Plattformdaten? | Freitext; Meta erläutert die Zwecke/Mittel bestimmende natürliche oder juristische Person. | Verifizierte rechtliche Betreiberin laut bestehendem Betreiberregister; genaue Schreibweise ausschließlich geschützt. Operativer Ansprechpartner wird nicht an ihre Stelle gesetzt. | Identität und Verantwortlichkeit aus vorhandener Governance übernommen; keine neue DSB-Ernennung oder Vertragsänderung. | **Ja; im offiziellen Entwurf gespeichert und zurückgelesen.** |
| responsible-2: Wähle das Land aus, in dem sich diese Person oder Einheit befindet. | Länderauswahl. | **Österreich / Austria.** Bestehendes Betreiberregister und verifiziertes Unternehmen. | Betreiberland ist nicht das Land aller Datenempfänger. | **Ja; Österreich gespeichert und zurückgelesen.** |
| requests-3: Hast du in den letzten 12 Monaten im Rahmen von Anfragen zur nationalen Sicherheit personenbezogene Nutzer*innendaten oder ‑informationen an Behörden weitergegeben? | Nein; Ja bis etwa10 / 11–100 / 101–1.000 / mehr als1.000 Nutzer*innen; Antwort gesetzlich/unternehmensintern untersagt. Ausgenommen sind laut Meta Durchsuchungsbefehle/gerichtliche Entscheidungen bei strafrechtlichen Ermittlungen. | **No. FanMind has not disclosed Meta user personal data to government authorities in response to national security requests during the specified 12-month period.** Explizite Owner-Bestätigung14.11.2026 für14.11.2025–einschließlich14.11.2026, `META_NATIONAL_SECURITY_ATTESTATION_20261114.md`. | Begrenzter historischer Tatsachennachweis; keine neue allgemeine Abfrage. Bei späterer tatsächlicher Einreichung nur die zeitliche Aktualität des inzwischen vergangenen Zusatzzeitraums prüfen. | **Ja für den bestätigten Zeitraum; bisheriges Nein im Entwurf erhalten. Kein neuer Zeitraum bestätigt.** |
| requests-4: Welche der folgenden Richtlinien oder Prozesse zum Umgang mit behördlichen Auskunftsersuchen in Bezug auf personenbezogene Nutzer*innendaten oder ‑informationen gibt es in deiner Organisation? Bitte wähle alle zutreffenden Antworten aus. | Vier Sachoptionen, Nichts davon, oder Antwort gesetzlich/unternehmensintern untersagt; genaue Sachoptionen unten. | Jede Option einzeln gegen SOP v1.0, aktuellen Teilfreigabestatus und betriebliche Nachweise bewerten. | Betreiberzustimmung unter Vorbehalten und operative Übernahme vorhanden; acht Assistenz-Tischfälle/Fallraum vorbereitet. Kein vollständiger menschlicher Betriebs-/Transfernachweis. | **Noch keine pauschale Bestätigung der vier Prozesse; alle sechs Kästchen unverändert leer.** |

### processor-2: tatsächlich angezeigter Anbieter-Dialog

- **Name des Auftragsverarbeiters oder Dienstleisters**: Freitext.
- **Für welche Dienstkategorie wird der Auftragsverarbeiter oder Dienstleister
  von Meta empfangene Plattformdaten verarbeiten? Bitte wähle alle zutreffenden
  Antworten aus.** Sieben Optionen: Analysen und Messungen; Werbung; Verkauf
  von Waren und Dienstleistungen; IT-Lösungen und -Dienstleistungen, etwa
  Cloud-Speicher und Datenverarbeitung; Justiz- und Strafverfolgungsbehörden;
  Forschung und Wissenschaft; Sonstiges.
- **Gib alle Länder an, in denen dieser Auftragsverarbeiter oder Dienstleister
  von Meta empfangene Plattformdaten verarbeiten wird. Dazu zählen auch alle
  Standorte, von denen der Auftragsverarbeiter oder Dienstleister remote per
  Internet auf die Daten zugreifen wird. Bitte wähle alle zutreffenden Antworten aus.**
  Länder-Mehrfachauswahl. Nicht auf Primärhosting reduzieren.

Für Hosting/DB/KI ist nach dem belegten Dienst zunächst die Kategorie
IT-Lösungen/-Dienstleistungen passend; keine Werbung/Analytics hinzuerfinden.
Der Dialog wurde ohne unvollständigen oder geratenen Anbietereintrag geschlossen.

### requests-4: Einzelbewertung der sechs angezeigten Optionen

| Exakter Optionstext | Nachweis | Tatsächlicher Stand und eng begrenzte Restmaßnahme |
| --- | --- | --- |
| Erforderliche Überprüfung der Rechtmäßigkeit dieser Anfragen. | SOP2/4, Stopregel bei ungeklärter Grundlage, Tischfälle01/03/04 | Vorgabe ausgearbeitet und Zustimmung unter Vorbehalten; menschlichen Prüf-/Eskalationsweg konkret betriebsfähig machen. Kein positives externes Gutachten erforderlich, um diese Vorgabe zu beschreiben; dessen Vorliegen wird nicht behauptet. |
| Bestimmungen zur Anfechtung potenziell rechtswidriger Anfragen. | SOP5, Tischfälle02/03 | Kriterien und menschliche Entscheidung vorbereitet; zuständige erreichbare rechtlich befugte Entscheidung/Vertretung bleibt konkret nachzuweisen. Keine automatische gerichtliche Eingabe. |
| Richtlinie zur Datenminimierung – die Offenlegung von möglichst wenigen, erforderlichen Informationen. | SOP6, Tischfälle02/04/06; vorhandene Workspace-Grenzen | Schriftliche Vorgabe und synthetische Umfangsentscheidung vorhanden; praktische Einweisung und kontrollierter Ausführungs-/Transferweg fehlen. Kein unfreigegebener CRM-Export zum Nachweis. |
| Dokumentation dieser Anfragen inklusive deiner Antworten und der rechtlichen Begründungen sowie aller Beteiligten. | SOP7, vorhandene Registervorlage, neu eingerichteter eingeschränkter Übungsordner mit Rücklesen | Synthetischer Register-/Ablagenachweis vorhanden; tatsächliche menschliche Fallbearbeitung, autorisierte weitere Rollen, Entzug/Recovery und Retentionbetrieb nicht vollständig geprüft. |
| Nichts davon. | Kein positiver Nachweis für diese pauschale Aussage | Nicht als Ersatz für ungeklärte/teilweise eingeführte Prozesse auswählen. |
| Die Beantwortung dieser Frage ist uns gesetzlich oder durch Unternehmensrichtlinien untersagt. | Kein solches Verbot belegt | Nicht auswählen. |

Die Frage spricht von Richtlinien **oder** Prozessen. Weder eine Anwaltsurkunde
noch alle27 globalen Legal-Controls sind automatisch Meta-Pflichtfelder. Die
teilweise Einführung wird dennoch nicht zur vollständig betriebenen Praxis
umgedeutet. Vor Auswahl jede konkret beanspruchte Richtlinie gegen ihre
verbleibenden Freigabevorbehalte und tatsächliche Anwendbarkeit abgleichen.

## 2. Konkrete Anbieter- und Betriebsnachweise

Supabase-Projektmetadaten15.11.2026: beide bestehenden FanMind-Projekte nutzen
`eu-west-3`. Laut offizieller Regionenreferenz ist das Paris/Frankreich.
Das bestätigt Primärhosting, nicht sämtliche Support-/CDN-/Fernzugriffsländer.
Die offizielle Transfers-FAQ nennt globale Supportzugriffe, Singapur/USA und
konfigurationsabhängiges CDN. Kontobezogene Vertrags-/Transfernachweise bleiben
gezielt offen; kein Regionenwechsel oder neuer Datenbankdienst wurde ausgeführt.

Der bestehende Code `src/app/api/ai/reply-suggestions/route.ts` überträgt bei
manueller KI-Nutzung ausgewählten Kommunikationskontext an die Responses API
mit `store:false`. Daraus folgen weder EU-Residenz noch völlige Empfängerfreiheit.
Stripe/optionale E-Mail-Dienste werden nicht allein wegen ihrer Existenz als
Meta-Empfänger eingetragen. Eine spätere Ablage echter Meta-bezogener Fälle in
Drive benötigt ihre eigene Empfänger-/Länder-/Vertragsbewertung; dort liegen
in dieser Vorbereitung ausschließlich synthetische Fälle.

Unter dem vorhandenen Unternehmensordner wurde ein nicht geteilter Fallraum
angelegt, ohne Rechte zu erweitern. Metadaten zeigen nur den vorhandenen Owner;
dieser stimmt mit dem angemeldeten operativen Konto überein. Dessen Google-
Sicherheitsseite zeigt aktive Zwei-Faktor-Authentifizierung. Das synthetische
Übungsprotokoll wurde hochgeladen, mit gleicher Zugriffsliste zurückgelesen
und inhaltlich abgeglichen. Keine Credentials/Personendaten aus Nebenunterlagen
geöffnet. Der veröffentlichte Kontakt ist im bestehenden Datenschutztext belegt;
ein tatsächlich überwachtes Postfach/Vertretung ist damit nicht nachgewiesen.

Acht Tischfälle wurden durch die Assistenz anhand SOP10 durchgeführt:
gefälschte Behörde; Vollauskunft; Drittstaatenorder; enge Anfrage ohne echte
getrennte Freigaben; Eilfall ohne Vertretung; Tokenanforderung; abgelaufene
Löschsperre; Fehlversand. Alle Entscheidungen sind vertraulich dokumentiert.
Keine reale Behörde, qualifizierte menschliche Prüfung, menschliche Teilnahme,
Versendung oder positive End-to-End-Betriebsabnahme wird daraus abgeleitet.

## 3. Instagram: frisch bestätigte API-Anzeigen und Diagnosegrenze

| Recht | Tatsächliche Meta-Testanzeige15.11.2026 | Nicht daraus ableiten |
| --- | --- | --- |
| instagram_basic | **Abgeschlossen** | Kein Beweis einer beliebigen konkreten Konto-/Tokenbindung oder Advanced Access |
| instagram_manage_messages | **1 API-Testaufruf(e)** | Kein Beweis automatischen DM-Eingangs oder Kontoabonnement-PASS |
| instagram_manage_comments | **0 von1 API-Aufruf(e) erforderlich** | Kein Kommentaraufruf erfüllt |

Die Reviewauswahl enthält weiterhin exakt diese drei Rechte. Andere in der
Testübersicht angezeigte Rechte werden nicht zusätzlich beantragt.
Die Unternehmensverifizierung zeigt weiterhin FanMind/Verifiziert.

Offizielle Unified-Referenz bestätigt BISU/System-user-Token und
`graph.facebook.com/v27.0/<Instagram-professional-account-ID>/subscribed_apps`
mit POST. Der bestehende Unified-Code verwendet diesen Host/Objekttyp; die
gespeicherte Konto-ID stammt aus `me/assigned_instagram_accounts`, nicht aus
einer Facebook-Seiten-ID. Die bestehenden geschützten Diagnosen bestätigten
SYSTEM_USER und Token/App/Kontobindung. Kein neuer Token wurde ausgelesen.

**Letzter tatsächlich bekannter Kontoabonnementbefund:** GET/POST HTTP400,
Code100/Subcode33, `object_unavailable`; Fehlerphase Kontoabonnement. Kein neuer
Abonnementaufruf wurde wiederholt. Die Ursache bleibt unbewiesen. Die aktuellen
App-weiten API-Badges grenzen dies weiter von einer pauschal nicht verwendeten
App ab, beweisen aber nicht den Erfolg der gesperrten Konto-Kante.

Standard Access erlaubt laut Unified-Permissionsreferenz Tests mit App-Rollen;
externe Creator benötigen Advanced Access/App Review. Die Webhook-Referenz
nennt zusätzlich Advanced Access für Kommentarbenachrichtigungen. Das ist eine
konkrete spätere Anforderung, erklärt jedoch nicht nachgewiesen genau100/33.
Weder zurückgestellte Anwaltsprüfung noch Betreiber-Fragebogen sind als Ursache
dieses Objektfehlers belegt. Keine neue Codekorrektur auf Verdacht.

Nächster Kommentar-Nachweis: nur ein bereits rechtmäßig zugängliches eigenes
Medium derselben gespeicherten Bindung über den bestehenden Lesepfad verwenden.
`fetchInstagramOwnComments` ruft die Kommentar-Kante nur bei nicht leerer
Medienliste auf. Der vorhandene Null-Lauf kann daher0von1 nicht erfüllen.
Keine geratenen Objekt-IDs, fremden Medien, unnötigen Wiederholungen oder
neuen Testkommentare vor Abonnement-PASS. Bestehenden geschützten Supportfall
um aktuellen Basic-/Nachrichtennachweis und die dokumentierte Unified-
POST-Referenz ergänzen; Meta nach dem konkreten Objekt-/Asset-Zugriffsgrund
fragen. Trace-IDs bleiben ausschließlich geschützt.

## 4. Reviewer und tatsächliche nächste Grenzen

Der Reviewer-Abschnitt verlangte zunächst eine Plattform in den allgemeinen
App-Einstellungen. Für die bestehende Staging-App wurde ausschließlich
Website `https://staging.fanmind.ch/` ergänzt und Kategorie **Unternehmen und
Seiten** gespeichert und nach Neuladen zurückgelesen. Kein Login-/Token-/Scope-
oder Production-App-Eingriff. Zusätzlich verlangt die App ein1024×1024-Symbol.
Vorhandenes unverändertes FanMind-App-Icon liegt im Repository; der offizielle
Upload öffnete den Zuschneidedialog, zeigte aber einen Ladefehler. Keine
ungeprüfte Bildrechtebestätigung abgegeben und kein Erfolg behauptet.

Der bestehende ausführbare Screencastplan bleibt in
`META_APP_REVIEW_READINESS_20261114.md` Abschnitt5. Reihenfolge: tatsächliche
Staging-Anmeldung, vorhandene Kontobindung, Abonnement mit richtiger App und
beiden Feldern, reales Profil/Medium, erst dann neue DM/Kommentarprobe,
automatischer Eingang, Kontakte, Kanaltrennung und Wiederholung ohne Dubletten.
Zu jedem der drei Rechte ein echter passender Film; keine Mock-Demo.
Reviewer-Zugang darf keine Operator-/Fremdworkspace-Rechte erweitern und muss
vor Einreichung reproduzierbar getestet werden. Das ist derzeit kein PASS.

Die Website-Testanweisungen sind inzwischen als **DRAFT – NOT READY FOR
SUBMISSION** gespeichert und durch erneutes Öffnen zurückgelesen. Sie nennen
Staging-URL, getrennte FanMind-Anmeldung/Unified-Verbindung und die konkreten
fehlenden Nachweise; keine Zugangsdaten erfunden. Der offizielle Dialog fragt
nach App-URL, Zugangsanleitung, Facebook-Login ja/nein und gegebenenfalls
Testzugang bei Bezahl-/Mitgliedschaftszugang, Geschenkcodes bei kostenpflichtigem
App-Download sowie geografischen Zugriffseinschränkungen. Die Hinweise auf
Facebook-Testnutzer sind keine Erlaubnis, für die Unified-Instagram-Demo
ungeeignete synthetische Meta-Identitäten anzulegen.

Bestehende Staging-Operator-Anmeldung praktisch übernommen: Dashboard → Kanäle
→ Instagram-Details funktioniert; vorhandenes Konto, vier gespeicherte Scopes,
serverseitige Verschlüsselung und **Webhook noch nicht aktiv** sichtbar.
Kein Sync-/Freigabe-/Providerknopf betätigt. Versionsantwort um10:01UTC:
releaseCommit63e8b0d656c4d0f14eaaa500a16cac65116380ee,
runtimeEnvironmentstaging; `environment` zeigt den Node-Produktionsmodus.
Frischer Main-Fetch bestätigt denselben63e8b0d6 nach parallel gemergtemPR1513.
Das ist keine durch diesen Auftrag ausgeführte Bereitstellung.

Quellen:
- https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login
- https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/authentication
- https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/permissions
- https://developers.facebook.com/documentation/instagram-platform/webhooks/setup
- https://supabase.com/docs/guides/platform/regions
- https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq

Die zehn Hosted-Prüfungen des übernommenen Heads46674b2 sind erfolgreich.
Eine Dokumentationsfortschreibung benötigt ihre eigenen Prüfungen; daraus
folgen keine Meta-Freigabe, Rechtsfreigabe oder Produktionsaktivierung.
