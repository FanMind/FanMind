# FanMind Support-KI — prüffähiger Datenschutzentwurf, 14.11.2026

**ENTWURF – keine Rechtsfreigabe, keine neuen veröffentlichten AGB.**
Verantwortliche laut bestehenden bestätigten Betreiberangaben: Brigitte Erika
Guggenberger, Einzelunternehmen FanMind. Bezug: Issue1350. Gegenstand ausschließlich
Plattformhilfe; keine Fan-Konversationen, Personas, Medien oder Character-Verwaltung.

## Befund der vorhandenen Implementierung

AGB verweisen auf Datenschutz und berechtigte Nutzung eingegebener Daten; daraus
folgt keine dokumentierte freiwillige Zustimmung zur optionalen Support-KI.
RegisterClient zeigt Datenschutzhinweise, erstellt zunächst ein Auth-Konto und
fasst keine Support-KI-Zustimmung. Nachgelagerte Zahlungsbedingungen haben einen
anderen Zweck. Website-Marketing-Cookie und Website-Chat-Besuchersitzungen sind
keine Einwilligung angemeldeter Supportnutzer. Der bisherige Dashboard-Support
fragt separat pro Sitzung. Keine dieser Altdaten wird in ein positives neues
Consent-Flag umgewandelt. Die Datenschutzerklärung beschreibt die bisherige
wiederholte Abfrage; für den neuen Modus ist die Ersatzfassung unten zu prüfen.

## Verarbeitung und vorgeschlagene Grundlage

Die Zuordnung ist eine konkrete Prüfposition, keine verbindliche Rechtsentscheidung.

| Verarbeitung | Daten und Zweck | Prüfposition zur Grundlage |
| --- | --- | --- |
| Registrierung, Authentifizierung, Workspace-Zuordnung | Konto-/Sitzungsdaten zur angefragten Plattformnutzung | Art6(1)b für Vertrag/vorvertragliche Maßnahmen auf Nutzeranfrage; technische Missbrauchsabwehr gesondert Art6(1)f mit Interessenabwägung |
| Eigene Plattformhilfe und gespeicherter Supportverlauf | Eigene Frage/Antwort, Nutzer-/Workspace-Zuordnung; Hilfe und Wiederaufnahme | Art6(1)b bei Vertragsbezug; sonst Art6(1)f nur nach dokumentierter Abwägung. Kein pauschaler Verzicht auf Rechte |
| Optionale externe Support-KI | Aktuelle eigene Supportfrage + bis zu2eigene frühere Frage-/Antwortpaare, ohne automatische CRM-/Konto-ID-Kontexte | Im implementierten optionalen Modus Art6(1)a. Keine automatische Umdeutung in Vertragserfüllung, solange objektive Erforderlichkeit ungeklärt und lokale Alternative vorhanden |
| Zustimmungsnachweis und Widerrufsstatus | Aktuelle Entscheidung, Nutzer, feste Textversion, serverseitige Zeitpunkte, Revision, Request-UUID | Art6(1)c i.V.m.Art7(1) für erforderliche Nachweisführung; darüber hinausgehende Beweissicherung nur mit konkret geprüfter Grundlage/Frist. Keine unbegrenzte Archivbehauptung |
| Berechtigte technische Diagnose | Coarse Verbindungsstatus/Fehler, angefragte sichere Nachprüfung | Art6(1)b für angeforderte Hilfe; erforderliche Sicherheit Art6(1)f. Keine Diagnosefreigabe für fremde Workspaces |
| Nutzungs-/Kosten-/Rate-Messung | Minimierte technische Zähler, keine Nachrichtentexte in Kostenevents | Art6(1)f für Betrieb/Sicherheit mit Abwägung, vorhandene Fristen prüfen |
| Ausdrückliche Support-Übergabe | Freigegebener eigener Verlauf, abgegrenzter Freigabestand | Art6(1)b bei angeforderter Hilfe/Vertrag, sonst geprüfte Grundlage; Übergabefreigabe bleibt eigenständig und erlaubt keine weitere KI-Nutzung |
| Datenexport, Löschung und Bearbeitung von Betroffenenrechten | Eigenes Supportkonto und Nachweise | Art6(1)c i.V.m.Art12/15/17, soweit die jeweilige Pflicht besteht |

Vertrag und Einwilligung sind zweckbezogen zu trennen. Eine AGB-Klausel macht eine
nicht erforderliche optionale Verarbeitung nicht objektiv vertragsnotwendig.
Besondere Kategorien nach Art9 sind nicht vorgesehen; keine sensiblen Daten in
Supportfragen eingeben. Neue Zwecke benötigen eine erneute Prüfung.

## Ersatztext für Datenschutz – noch freizugeben

„Die KI-Beantwortung im angemeldeten FanMind-Support ist freiwillig. Bei ihrer
Aktivierung verarbeiten wir Ihre aktuelle Supportfrage und höchstens zwei frühere
eigene Frage-/Antwortpaare über OpenAI. Private Fan-Nachrichten, Model-Einstellungen
und Medien werden nicht automatisch geladen. Ohne Aktivierung bleibt die lokale
Hilfe verfügbar. Wir speichern Ihre Entscheidung mit Textversion und Zeitpunkt
kontobezogen und verwenden eine weiterhin gültige Zustimmung bei späterer Nutzung.
Sie können sie unter KI & Datenschutz im Support oder Einstellungen → Support-KI
jederzeit für die Zukunft widerrufen. Eine bereits vor Widerruf übermittelte Anfrage
kann nicht zurückgerufen werden. Künftige KI-Anfragen werden dann unterbunden.
Das Löschen eines Gesprächsverlaufs und der Widerruf der Kontoentscheidung sind
getrennte Funktionen. Nachrichten unterliegen der bisherigen Supportaufbewahrung
von bis zu30Tagen. Der minimale aktuelle Zustimmungs-/Widerrufsnachweis wird nach
der vorgeschlagenen technischen Fassung bis zur Kontolöschung vorgehalten; diese
Frist und die benötigte Nachweisaufbewahrung sind vor Production zu bestätigen.“

Die tatsächlich vorgeschlagene technische Frist ist damit ausdrücklich sichtbar,
nicht als abschließend rechtmäßig bestätigt. Ein kürzeres Widerrufs-/Nachweisziel
kann eine zusätzliche kontrollierte Löschregel erfordern; keine solche Löschregel
wurde stillschweigend aktiviert. Auth-Kontolöschung entfernt den Datensatz per FK.
Nur der aktuelle Nachweis wird gespeichert, kein vollständiges historisches Journal.

## Registrierung und bestehende Nutzer

Gewählt wird die erstmalige freiwillige Aktivierung, nicht ein neuer obligatorischer
Registrierungsschritt. Erstregistrierung und bestehende Nutzer starten bei fehlendem
Nachweis gleich mit KI aus. Keine Vorauswahl. Die aktive Checkbox im Konto zeigt
später die gespeicherte echte Entscheidung an; dies ist keine vorausgewählte neue
Einwilligung. Bei Text-/Zweckänderung ist die alte Version ungültig. Ohne neue
positive Entscheidung keine Provider-Anfrage. Kein erfundenes rückwirkendes Datum.
Die mögliche Alternative einer zwingend vertragsnotwendigen KI-Leistung wäre ein
eigener rechtlicher/fachlicher Beschluss und ist nicht implementiert.

## Anbieter und Transfers

OpenAI-API-Eingaben werden laut offizieller Dokumentation standardmäßig nicht zum
Training verwendet, sofern nicht gesondert eingewilligt. store:false beseitigt nicht
alle möglichen Sicherheits-/Missbrauchsprotokolle; die Dokumentation nennt für die
Standard-Responses-API grundsätzlich bis zu30Tage Abuse-Monitoring-Retention.
Kein ungeprüftes ZDR-/EU-only-/Regionenversprechen. Tatsächlicher Vertragspartner,
wirksame DPA, Unterauftragnehmer, Region, Transfers/SCC und ggf. ergänzende Maßnahmen
müssen kontobezogen belegt werden. Ein Codecheck oder ein Consent-Häkchen beweist
weder DPA noch Transferfreigabe. Das bestehende externe Freigaberegister enthält
hierzu offene Punkte; nur betroffene neue Production-Verarbeitung bleibt gesperrt.
Die bisher separat genehmigte Supportfunktion wird nicht pauschal stillgelegt.

## Primärquellen der Prüfung

- DSGVO, insbesondere Art5/6/7/12/13/15/17/28/44:
  https://eur-lex.europa.eu/eli/reg/2016/679/oj
- EDPB Guidelines05/2020, Version1.1: Freiwilligkeit, Granularität, Nachweis,
  Widerruf, Trennung von Vertragsnotwendigkeit und Einwilligung:
  https://www.edpb.europa.eu/system/files/documents/files/file1/edpb_guidelines_202005_consent_en.pdf
- OpenAI Data Controls (Providerstandard, kein Kontokonfigurationsbeweis):
  https://developers.openai.com/api/docs/guides/your-data

Vor neuer Production-Aktivierung erforderlich: fachlich/rechtlich freigegebener
Zweck/Grundlage und Informationstext, konkrete Nachweisfrist, Provider-/DPA-/Transfer-
belege sowie explizite Owner-Freigabe des exakten Releases und der Aktivierung.
Keine Vertragsannahme durch diese Arbeitsfassung.
