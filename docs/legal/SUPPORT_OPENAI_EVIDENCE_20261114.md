# OpenAI: allgemeine Bedingungen vs. FanMind-Beleg

Prüfstand14.11.2026, #1350. Kein neuer Vertrag angenommen, kein API-Schlüssel
angelegt/geändert, keine Datenkontrolle oder Region umgestellt.

| Gegenstand | Verifizierter Befund | Für FanMind noch erforderlich |
|---|---|---|
| Laufzeit-Code | Support verwendet `https://api.openai.com/v1/responses`, `store:false`, aktuelle Frage und höchstens2eigene frühere Frage-/Antwortpaare; keine automatischen Fan-/Character-/Medienabrufe. Kein expliziter Org-/Projekt-Header im Supportpfad | Verwendeten serverseitigen API-Schlüssel privat der tatsächlichen API-Organisation/dem Projekt und Betreibervertrag zuordnen; Schlüssel nie offenlegen |
| Vertragspartner / DPA | Veröffentlichte DPA wirksam ab01.01.2026 nennt für EWR-/Schweizer Kunden OpenAI Ireland Ltd.; DPA wird in das Services Agreement einbezogen und beschreibt Annahme auch durch Nutzung | Tatsächlicher Kunde, geltendes Services Agreement/ggf.Order Form, Fassung und Wirksamkeit für FanMind bestätigen. Keine pauschale Forderung nach zusätzlicher Unterschrift, wenn wirksame Einbeziehung belegt ist |
| Transfers | Veröffentlichte DPA enthält EU-Transferregelungen einschließlich SCC und benannter Rollen | Konkrete Empfänger/Transferkette, passende Module und erforderliche ergänzende Prüfung für das verwendete Konto bestätigen |
| Unterauftragnehmer | Öffentliche Liste mit Stand14.10.2026 enthält unterschiedliche Dienste, Standorte und Wahlmöglichkeiten | Relevante dienst-/kontobezogene Auswahl und geltende Änderungsinformation belegen; nicht jede gelistete Firma als tatsächlich an FanMind beteiligt behaupten |
| Datenverwendung / Aufbewahrung | API-Standard laut Dokumentation: kein Training ohne Opt-in; standardmäßige Missbrauchsprotokolle bis30Tage. `store:false` ist kein ZDR-Nachweis | Tatsächliche Sharing-/Retention-Einstellungen des FanMind-Projekts lesen; Ausnahmen/Löschregeln dokumentieren |
| Regionen / Datenkontrollen | Regionale Verarbeitung und besondere Retentionkontrollen sind abhängig von Berechtigung, Projektkonfiguration, Endpoint und Modell | Tatsächliche Projektregion, geeigneter Endpoint und konfigurierte Datenkontrollen bestätigen. Globaler Endpoint allein belegt keine EU-only-Verarbeitung. Verfügbarkeit einer Option ist kein Aktivierungsnachweis |
| Konto-Zugriff | OpenAI Platform unter Settings → Organization → Data controls leitet auf Login weiter | Owner meldet sich mit dem für FanMind verwendeten API-Konto an; private Belegprüfung fortsetzen |

## Tatsächlich geprüfte verfügbare Unterlagen

Repository: Anbieter-/Rechtsregister weiterhin mit offenen OpenAI-Kontobelegen.
Gezielte Suche in verbundenem Drive nach FanMind/DPA und in OpenAI-Absendermails
nach DPA/Retention/Services-Agreement ergab keinen passenden Vertrags-/Kontobeleg.
Dies beweist nicht, dass kein wirksamer Vertrag besteht. Eine generische alte
OpenAI-Notiz wurde nicht als FanMind-API-Vertrag interpretiert. ChatGPT-Business-
Nutzung oder ein verbundener Schlüssel-Setup-Dialog belegen nicht die Organisation
des auf dem FanMind-Server eingesetzten API-Schlüssels. Ohne private Zuordnung
bleiben diese Punkte BLOCKED, nicht rechtlich unzulässig behauptet.

Private Belege nach bestehendem Prozess prüfen, nur deren SHA256 und Status im
externen Freigaberegister erfassen. Keine Org-/Projektkennungen, Schlüssel,
Vertragsinhalte oder private Konto-Screenshots in öffentlichen GitHub-Berichten.

## Erneut gelesene Primärquellen

- https://openai.com/policies/data-processing-addendum/
- https://openai.com/policies/sub-processor-list/
- https://developers.openai.com/api/docs/guides/your-data
- https://developers.openai.com/api/docs/guides/data-residency

Veröffentlichte Anbieterbedingungen sind keine Bestätigung der privaten FanMind-
Kontokonfiguration. Die neue dauerhafte Kontoentscheidung bleibt bis zur getrennten
Freigabe aus; bestehende genehmigte Supportpfade werden nicht pauschal deaktiviert.
