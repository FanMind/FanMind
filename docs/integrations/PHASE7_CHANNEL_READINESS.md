# Phase-7a-Kanalbereitschaft

## Zweck und Grenze

FM-DEC-017 (11. September 2026) nimmt TikTok und X/Twitter in die aktuelle
Creator-/Social-Entwicklung auf. Der zusätzliche, standardmäßig ausgeschaltete
Staging-Pilot ist in [TIKTOK_X_CONNECTIONS.md](TIKTOK_X_CONNECTIONS.md) beschrieben:
TikTok-Profilanmeldung und X-Kontoanmeldung mit begrenzter DM-Lesevorschau.
Der unten beschriebene allgemeine Readiness-Vertrag bleibt unverändert fail closed;
der Pilot ist weder allgemeine Kanalaktivierung noch vollständiger CRM-Import.
Die aktuelle Entwicklungsreihenfolge folgt FM-DEC-015/017 und hat Vorrang vor der
nachfolgend historisch beschriebenen Reihenfolge FM-DEC-013.

Der Kanalabschnitt Phase 7a umfasst TikTok, X/Twitter, Discord und eine
unverbindliche OnlyFans-Evaluation. Diese Datei dokumentiert dessen technische
Vorbereitungsgrenze; sie aktiviert keinen Kanal. LinkedIn und weitere Kanäle
aus Phase 8 oder später sind ausdrücklich nicht Teil dieses Pakets.

Nach Abnahme der erforderlichen Phase-3-/Phase-7a-Kanäle folgt die technische
Verkaufsübergabe. Danach wird innerhalb von Phase 7b
[Creator Intelligence & Sales Assistance](../CREATOR_INTELLIGENCE.md) auf der
bestehenden FanMind-Architektur umgesetzt; erst anschließend folgt weitere
Phase-8-Arbeit (FM-DEC-013). Phase 7b ist keine Voraussetzung für die vorherige
Verkaufsübergabe. Die schon vorbereitete deaktivierte Website-KI-Grundlage
bleibt historisch dokumentiert. Dieser Kanalvertrag aktiviert auch keine
Creator-Funktion.

`src/lib/phase7ChannelReadiness.ts` hält den maschinenlesbaren, providerfreien
Fail-closed-Vertrag. Für alle vier Einträge bleiben Inbound, Outbound,
automatisches Senden, Scraping und Production-Nutzung ausgeschaltet. Der
Vertrag enthält keine Provider-Endpunkte, keine Zugangsdaten, keine Webhooks
und keine Tokenverarbeitung.

OnlyFans ist ausschließlich eine unverbindliche Evaluation und keine
zugesagte Integration. FanMind speichert dafür keine Zugangsdaten, baut keinen
Connector und verwendet kein Scraping.

## Abschlussklassen

### 1. Vollständig durch Code abschließbar

- Providerneutrale Kanal- und Capability-Verträge.
- Fail-closed Readiness mit festen, redigierten Blocker-Codes.
- Tests gegen automatisches Senden, Scraping, voreilige Production-Aktivierung
  und versehentliche Aufnahme von Phase-8-Kanälen.
- Für einen späteren Connector: workspacegebundene Autorisierung,
  Idempotenz, begrenzte Request-/Payloadgrößen, redigierte Diagnostik und
  Copy-&-Open als verbindlicher Outbound-Modus.

### 2. Staging-/Infrastrukturarbeit erforderlich

Für TikTok, X/Twitter oder Discord ist nach einer separat geprüften offiziellen
API-Implementierung jeweils ein isolierter Staging-Nachweis erforderlich. Er
muss Tenant-Isolation, RLS, Tokenverschlüsselung, Disconnect/Cleanup,
Rate-Limits und den ausgeschalteten Sendepfad beweisen. Bis dahin meldet der
Readiness-Vertrag `staging_acceptance_missing`.

### 3. Externe Freigabe oder Zugangsdaten erforderlich

Offizielle Provider-Apps, API-Produkte, Testkonten, Zugriffsfreigaben,
Vertragsbedingungen und rechtliche/Datenschutzfreigaben sind externe Gates.
Sie dürfen weder durch Fixtures ersetzt noch allein aufgrund vorhandenen Codes
als erledigt gelten. OnlyFans verbleibt unabhängig davon bei
`evaluation_only`.

### 4. Production-Aktivierung erforderlich

Nach Code-, Staging- und externem Abschluss bleibt eine getrennte,
workspacebezogene und auditierte Production-Aktivierung erforderlich. Der
vorliegende Vertrag kann diese Aktivierung absichtlich nie erteilen. Ein
späterer Aktivierungspfad benötigt einen Kill Switch und darf weder Scraping
noch automatisches Senden freischalten.
