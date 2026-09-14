# Creator / Social: erster Übergabeumfang

FM-DEC-015, 2026-09-10: Creator und ausgewählte Social-Arbeit jetzt; Android danach.
Jeder Creator hat einen eigenen Account/Workspace. Keine neue Agency-Sammelinbox.

| Kanal | Vorhanden / jetzt ergänzt | Noch kein abgeschlossener Nachweis |
|---|---|---|
| Facebook | Bestehende Meta-OAuth-/Nachrichten-/Kommentar- und Kontextpfade wiederverwendet; Kanalansicht erklärt KI-Entwurf, Prüfung, Original öffnen und manuelles Senden. | Echte App-Review-/Berechtigungs-, Datenschutz- und Provider-E2E-Abnahme für den jeweiligen Account. |
| Instagram | Bestehende Meta-Account-/Konversationspfade wiederverwendet; dieselbe bestätigte manuelle Übergabe mit eigenem Creator-Kontext. | Reale Berechtigungen, freigegebener Account-/Messaging-Scope und E2E/Legal. |
| OnlyFans | Manuell vorliegende Nachrichten/CSV, Creator-Antwortentwurf und sicheres Öffnen eines ausdrücklich gespeicherten HTTPS-Originalziels. Ohne konkreten Link wird lediglich die Plattform geöffnet. | Zulässiger direkter API-/Partnerzugang und aktuelle rechtliche/providerseitige Freigabe; kein Abruf-/Sendekonnektor. |
| Website-KI | Bestehende Website-/Inbox-Grundlage; Anleitung für menschliche Übergabe im Kanalbereich. | Durchgängiger aktiver KI-Dialog mit Besuchern, Eskalation und Rückantwort bleiben eigener Ausbau. |

## Verbindungsprüfung am 14. September 2026

Bernds aktueller Auftrag priorisiert echte Facebook-, Instagram- und OnlyFans-
Nachrichten vor App-Abschluss und dem vorgeschlagenen Test mit zwölf Personen
über 14 Tage. Der Test hat noch nicht begonnen. Die folgende Beobachtung ist ein
Setup-Zwischenstand auf Main `4d6d0c4f0ba675f8b7d503ffa831264c54e4b61b`.

- **Facebook:** In FanMind meldet die Serverkonfiguration „bereit“. Der reale
  Verbindungsversuch endet bereits vor der Weiterleitung zu Meta mit
  `workspace_inactive`. Der serverseitige Workspace-Zugang muss zuerst geklärt
  werden; die Fehlermeldung belegt keinen bestimmten Zahlungs- oder Loginfehler.
  Die zentrale Meta-App ist im Entwicklungsmodus. Ihr vorhandener Callback zeigt
  auf `/api/webhooks/meta`; `messages` und `feed` sind mit v25.0 abonniert,
  `message_echoes` ist nicht abonniert. Es wurde kein Abo verändert.
- **Instagram:** FanMind meldet „Serverkonfiguration: noch unvollständig“.
  Der Code verwendet Instagram Login für Professional-Konten. Der dazu passende
  Meta-Anwendungsfall „Messaging und Content auf Instagram verwalten“ ist
  auswählbar und vorbereitet, aber nicht gespeichert: Die automatische
  Freigabeprüfung verlangt die ausdrückliche Bestätigung dieser konkreten
  Erweiterung der App-Berechtigungen. Die älteren Instagram-Einstellungen unter
  Messenger belegen keine fertige Konfiguration dieses Login-Pfads.
  Bernd hat das Hinzufügen anschließend ausdrücklich bestätigt. Der daraufhin
  einmal angeforderte Speichervorgang wurde erneut durch die automatische
  Freigabeprüfung abgelehnt: Sie verlangt nun ausdrücklich die Bestätigung,
  dass dieser gebündelte Anwendungsfall auch Content-Veröffentlichung umfasst.
  Es wurde weiterhin nichts gespeichert. Der vorhandene FanMind-Nachrichtenpfad
  fordert nur `instagram_business_basic` und `instagram_business_manage_messages`
  an; `instagram_business_content_publish` kommt im Anwendungscode nicht vor.
  Das belegt die Begrenzung des bestehenden OAuth-Pfads, aber keine getrennte
  Nachrichten-Auswahl im noch ungespeicherten Meta-Einrichtungsdialog.
- **Workspace-Zugang:** Der bestehende interne Testzugang-Knopf bestätigt zugleich
  die E-Mail administrativ, überschreibt Abrechnungsfelder und setzt unter anderem
  `no_expiry`. Er ist keine begrenzte 14-Tage-Freigabe und wurde nicht betätigt.
  Eine gezielte Freigabe bleibt offen; bezahlte Aktivierung wird nicht unterstellt.
- **OnlyFans:** Ein offizieller oder vertraglich zugelassener direkter
  Nachrichtenzugang ist weiterhin nicht belegt. Die geprüfte Drittanbieter-
  Dokumentation beschreibt Reverse Engineering, gespeicherte Plattform-Zugangsdaten
  und automatisierten Login. Dieser Weg wurde nicht verwendet. Der bestehende
  manuelle Import bleibt vom automatischen Empfang getrennt.

Die Kanalansicht erhält für den bereits vorhandenen Fehlercode
`workspace_inactive` eine konkrete Anleitung zur Klärung des Workspace-Zugangs.
Die Start-/Callback-, Verarbeitungs- und Berechtigungsprüfungen bleiben wirksam.
Vor einer Abnahme fehlen weiterhin jeweils die autorisierte Kontoverbindung,
App-Review bzw. zulässige Testrollen und ein tatsächlich empfangenes Ereignis mit
Zuordnungs-, Duplikat- und Widerrufsnachweis. Zentrale App-Konfiguration und lokale
Tests sind kein Nachweis, dass zwölf externe Tester bereits Nachrichten empfangen
können. Der separate Ubuntu-Neustart ist weiterhin nicht erfolgt.

Prüfquellen: authentifizierte Meta-/FanMind-Oberflächen, Start-Routen und
`workspaceProcessingPolicy.mjs` / `adminBilling.ts`; ergänzend die
[offizielle Meta-Instagram-Sammlung](https://www.postman.com/meta/instagram/collection/6yqw8pt/instagram-api),
die [technische Einführung des Drittanbieters](https://docs.onlyfansapi.com/introduction)
und dessen [Account-Verbindungsanleitung](https://docs.onlyfansapi.com/introduction/guides/connect-onlyfans-account).
Die Drittanbietertexte sind keine OnlyFans-Freigabe. Die offizielle OnlyFans-
Nutzungsbedingungsseite war bei der erneuten Prüfung nicht abrufbar.

## Tatsächlicher Nutzerablauf

1. Fan im zugehörigen Creator-Account öffnen, gespeicherte Nachricht prüfen.
2. Entwürfe mit der freigegebenen eigenen Stimme erzeugen; Empfehlung, Variante
   und gegebenenfalls das separat angezeigte Angebot prüfen.
3. Passenden Text bearbeiten/kopieren und den Originalkanal öffnen.
4. Nutzer sendet selbst auf der Plattform. Nur tatsächlich gesendeten Text als
   Ausgang dokumentieren. Nur ein tatsächlicher Kaufbeleg erzeugt Kaufdaten.

Copy, Original öffnen und Entwurfsauswahl sind weder Sendebeleg noch Kauf.
Es gibt keinen neuen Auto-Send, keine Browserautomatisierung bei Fan-Accounts,
kein Scraping und keine Abfrage von Creator-Passwörtern oder Session-Cookies.
OnlyFans-Links erlauben ausschließlich HTTPS und die exakten Hosts onlyfans.com /
www.onlyfans.com ohne Zugangsdaten, Ports, Query oder Fragment. Ein gültiger Host
beweist keine existente Conversation; die UI verspricht kein garantiertes Deep Link.

## Technische / rechtliche Prüfung

Die bestehenden Implementierungen und Grenzen wurden im Repository geprüft.
Die aktuelle externe Prüfung bleibt ausdrücklich offen: Am 2026-09-10 lieferten
Abrufe der offiziellen Meta-Messaging-Dokumentation HTTP 429; der Abruf der
OnlyFans-Nutzungsbedingungen war nicht verfügbar. Diese Fehler sind keine
positive oder negative Aussage über einen erlaubten OnlyFans-API-Zugang.

Offizielle Prüfstellen für die nächste verfügbare Prüfung:
- https://developers.facebook.com/docs/messenger-platform/overview/
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/
- https://onlyfans.com/terms

Vor direkter Anbindung: konkrete offizielle/vertragliche Zugriffsmöglichkeit,
erlaubter Nachrichten-/Kommentar-/Medienumfang, Account-Zustimmung, App Review,
Zweck/Rechtsgrundlage, Transparenz, Aufbewahrung, Export/Löschung und echte
positive/negative Provider-Proben dokumentieren. Die manuelle Produktfunktion
ersetzt diese Bestätigung nicht. Keine Plattform wird durch einen Roadmap-Status
oder vorhandene Tokens als abgenommen/produktiv erklärt. FM-DEC-017 erweitert
den aktuellen Entwicklungsumfang anschließend um TikTok und X/Twitter:
offizielle Profilanmeldung und begrenzte X-DM-Lesevorschau gemäß
[TikTok/X-Vertrag](TIKTOK_X_CONNECTIONS.md). Ein echter Provider-/Staging-Abschluss
ist weiterhin offen. Discord und sonstige spätere Kanäle bleiben zurückgestellt.
