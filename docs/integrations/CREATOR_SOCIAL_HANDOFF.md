# Creator / Social: erster Übergabeumfang

FM-DEC-015, 2026-09-10: Creator und ausgewählte Social-Arbeit jetzt; Android danach.
Jeder Creator hat einen eigenen Account/Workspace. Keine neue Agency-Sammelinbox.

| Kanal | Vorhanden / jetzt ergänzt | Noch kein abgeschlossener Nachweis |
|---|---|---|
| Facebook | Bestehende Meta-OAuth-/Nachrichten-/Kommentar- und Kontextpfade wiederverwendet; Kanalansicht erklärt KI-Entwurf, Prüfung, Original öffnen und manuelles Senden. | Echte App-Review-/Berechtigungs-, Datenschutz- und Provider-E2E-Abnahme für den jeweiligen Account. |
| Instagram | Bestehende Meta-Account-/Konversationspfade wiederverwendet; dieselbe bestätigte manuelle Übergabe mit eigenem Creator-Kontext. | Reale Berechtigungen, freigegebener Account-/Messaging-Scope und E2E/Legal. |
| OnlyFans | Manuell vorliegende Nachrichten/CSV, Creator-Antwortentwurf und sicheres Öffnen eines ausdrücklich gespeicherten HTTPS-Originalziels. Ohne konkreten Link wird lediglich die Plattform geöffnet. | Zulässiger direkter API-/Partnerzugang und aktuelle rechtliche/providerseitige Freigabe; kein Abruf-/Sendekonnektor. |
| Website-KI | Bestehende Website-/Inbox-Grundlage; Anleitung für menschliche Übergabe im Kanalbereich. | Durchgängiger aktiver KI-Dialog mit Besuchern, Eskalation und Rückantwort bleiben eigener Ausbau. |

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
