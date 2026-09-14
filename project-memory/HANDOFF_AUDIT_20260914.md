# FanMind: belastbarer Stand vor der Übergabe

Stand: 14. September 2026. FM-SALES-001 / FM-CR-038 / FM-DEC-019.
Geprüfte Codebasis: `4d6d0c4f0ba675f8b7d503ffa831264c54e4b61b`,
am selben Tag gegen GitHub `main` bestätigt. Grundlage sind Code,
vorhandene Abschlussbelege, aktuelle öffentliche Oberfläche, frühere
Projektgespräche und die vom Betreiber gelieferten Serverausgaben.
Dies ist eine Bestandsaufnahme; sie behauptet keinen neuen vollständigen
Kunden-, Zahlungs-, Restore- oder Neustarttest.

## Direkte Antworten

| Bereich | Belegt vorhanden / abgeschlossen | Konkreter Rest |
| --- | --- | --- |
| Anmeldung und Registrierung | Login, Kontoregistrierung und Bestätigungsablauf sind implementiert und veröffentlicht (#1095/#1096). Der Betreiber konnte sich in dieser Sitzung bereits anmelden. Die aktuelle öffentliche Registrierung bietet ein kostenloses Konto an. | Kostenpflichtiger Workspace-Zugang ist ein eigener, noch nicht abgeschlossener Aktivierungsweg. Ein frischer vollständiger Durchlauf mit neuem Konto, zugestellter Mail und aktivem Kunden-Workspace wurde in diesem Audit nicht ausgeführt. Kein Neubau des Logins. |
| Zahlungen | Die vereinbarten Preise und Stripe-Grundlagen existieren; Test-Checkout und belegte Staging-Ledger-Arbeit bleiben abgeschlossen. | Der öffentliche Neukundenweg ist aktuell noch nicht vollständig als bezahlter Zugang nutzbar. Die Live-Seite sagt ausdrücklich, dass kostenpflichtige Aktivierung noch vorbereitet wird. Verbleiben Workspace-Rollout, passende Vertragsannahme, kanonische Billing-Verarbeitung und die tatsächlichen Steuer-/Provider-Voraussetzungen. |
| KI und Tarife | Standard-Antworten, Analyse, Verbrauchsprotokoll, Kontext-/Ausgabelimits und kurzfristige Ratenbegrenzung sind implementiert. Plus/Ultra-Preise und technische Berechtigungs-/Stripe-Grundlagen sind angelegt. | Plus und Ultra sind weiterhin `Coming Soon`, `not_configured` und nicht automatisch buchbar. Monatslimits und Modellklasse sind `null`; die produktiven Aufrufstellen verwenden eine gemeinsame Modelleinstellung. Ein verbindliches Monatsbudget mit Sperre/Nachkauf ist damit nicht fertig. |
| Server und Neustart | Production läuft auf dem geprüften Release. Installierter Audit vom 14. September, Lauf 34762468006/Versuch 7, ist erfolgreich. Autostartkorrekturen, Runner-Neustart, geschützte Referenz und vorhandene Backup-Prüfungen sind belegt. | Der Ubuntu-Neustart selbst ist nicht erfolgt. Letzter Betreiberbeleg: `DRY_RUN_EXIT=1`, `LOGIN_SESSION_WARNING=true`, `REBOOT_NOT_REQUESTED=true`; Boot-ID unverändert. Erst Sitzungswarnung auflösen, dann vorhandenen normalen Neustartweg mit frischen Vorbedingungen einmal ausführen und den neuen Boot nachprüfen. |
| Restore | Isolierter Datenbank-Restore und `DB_POSTCHECKED` sind ausdrücklich abgenommen. | Nur tatsächlicher Datei-/Storage-Restore auf dem getrennten Ziel, Konfigurationsnachweis, Bereinigung und gemeinsamer Abschlussbeleg fehlen. Controller-/Quellcodetests ersetzen diesen Rest nicht. Der erfolgreiche Datenbank-Restore wird nicht wiederholt. |

Die erneute Stripe-Abfrage scheiterte in diesem Audit an einer abgelaufenen
Connector-Anmeldung. Deshalb wird weder ein aktueller Live-Zahlungseingang noch
die Abwesenheit früherer Zahlungen behauptet. Die in
[`RELEASE_ACCEPTANCE_20260910.md`](../docs/operations/RELEASE_ACCEPTANCE_20260910.md)
dokumentierten fehlenden Tax-Registrierungen, Workspace-Funktionen,
Vertragsversion und Production-Ledger sind datierte Befunde. Ihre aktuellen
Zielwerte müssen vor dem jeweiligen Rollout gezielt abgeglichen werden;
erfolgreich installierte Bestandteile werden dabei nicht erneut installiert.

Die vorhandene FanMind-Browsersitzung führte beim erneuten Profilaufruf zum
Login. Das ist kein Beleg für einen kaputten Login und ersetzt keinen frischen
Anmeldetest. Die Registrierung wurde anschließend öffentlich neu gelesen.

## Warum der Eindruck eines endlosen Neubaus entstand

1. **Zu große Abschlussbehauptungen.** Preisanlage, Test-Checkout und
   Datenbank-Restore wurden in Zusammenfassungen mit einer vollständigen
   Kundenaktivierung bzw. einem vollständigen System-Restore vermischt.
2. **Gegenteiliger Fehler bei offenen Punkten.** Später wurde wieder der ganze
   Bereich als offen genannt, obwohl nur ein bestimmter Rest fehlte.
3. **Aktuelle Belege und alte Aufgaben widersprechen sich.** Oben in
   `SESSION_HANDOFF.md`, `CURRENT_STATE.md` und dem Finishline-Board standen
   noch PR-1117-Vorbedingungen, die spätere Server-/GitHub-Belege bereits
   geschlossen hatten. Eine abgelaufene Zustandsprüfung darf einen historischen
   Abschluss nicht in unerledigte Implementierung zurückverwandeln.
4. **Tatsächliche Integrationslücken.** Ein Tarifkatalog verbindet noch kein
   Modell und kein Monatsbudget mit dem Kundenabo. Das ist verbleibende
   Engineering-Arbeit, nicht pauschal eine fehlende Zustimmung des Betreibers.
5. **Neustarthelfer und Reihenfolge.** Frühere Zeitfenster liefen ab, bevor der
   Betreiber den Befehl ausführte. Der aktuelle Helfer scheitert konkret an
   angemeldeten Sitzungen. Außerdem war Mobile trotz der neuen Priorität noch
   eine maschinelle Voraussetzung der Übergabe.

Diese Analyse behebt die Dokumentations-/Prioritätswidersprüche. Sie aktiviert
keine gesperrte Funktion und erklärt keine unbelegte Gesamtabnahme für fertig.

## KI-Abrechnung: vorhandene Entscheidung und fehlende Umsetzung

Die Preise bleiben erhalten: Starter enthält Standard für **312 EUR/Monat**;
Plus ist **+100 EUR/Monat**, Ultra **+200 EUR/Monat**. Die bestehenden
Setup-/Laufzeitoptionen bleiben erhalten. Die mündlichen rund 300 EUR ersetzen
diese Preise nicht. Die genannten **1 / 1,5 / 2 Millionen Token sind Beispiele**,
keine bereits beschlossene oder aktive Mengenstaffel.

OpenAI rechnet Ein- und Ausgabetoken getrennt ab. Eingaben enthalten auch
mitgeschickten Kontext; viele Analysen können dasselbe Material wiederholt
verarbeiten. Beispiel ausschließlich zur Kalkulation: GPT-5.2 kostet laut
[offizieller Modellseite](https://developers.openai.com/api/docs/models/gpt-5.2)
1,75 USD je Million Eingabetoken und 14 USD je Million Ausgabetoken.
Eine Million insgesamt bei 80 % normalem Input und 20 % Output ergibt
**4,20 USD** reine Textmodellkosten. Das ist weder die tatsächliche
FanMind-Modellkonfiguration noch eine vollständige Betriebskostenrechnung.
Bei angenommenen 10.000 Token je Vorgang wären eine Million etwa 100 Vorgänge;
ein tragfähiges Monatskontingent lässt sich daher nicht allein aus der runden
Millionenzahl ableiten.

Empfohlener Abschluss des vorhandenen Produkts: ein guter Standard für alle,
klar benanntes monatliches KI-Budget je Tarif, sichtbarer Restverbrauch,
Warnung vor Verbrauchsende und ausdrücklich gekaufter Nachkauf. Ein besseres
Modell bzw. zusätzlicher Analyseumfang muss als tatsächliche Mehrleistung
verdrahtet und verglichen werden; mehr Token allein garantieren keine bessere
Antwort. Dafür fehlen die serverseitige Budgetreservierung vor einem Aufruf,
verbrauchsgenaue Abrechnung, periodische Erneuerung, parallele/idempotente
Verarbeitung und verlässliche Tarif-/Nachkaufzuordnung. Das bestehende
Verbrauchsprotokoll wird wiederverwendet; Preise und Stripe-Produkte werden
nicht neu gebaut.

Codebelege: [`aiTiers.mjs`](../src/config/aiTiers.mjs),
[`aiUsage.ts`](../src/lib/aiUsage.ts),
[`reply-suggestions/route.ts`](../src/app/api/ai/reply-suggestions/route.ts),
[`analysisActions.ts`](../src/app/fans/[id]/analysisActions.ts).
Die Aufrufstellen verwenden den aufgelösten Tarif für Kontextgrenzen,
aber `getFanMindAiModel()` für das Modell. Kosten-/Verbrauchsprotokollierung
ist keine verbindliche monatliche Nutzungsbegrenzung.

## Verbindliche Reihenfolge und Abschlussregeln

- **Technische Übergabe zuerst; Android und Push danach** (FM-DEC-019).
  Mobile bleibt offen, blockiert diese Übergabe aber nicht mehr. Vorhandene
  Builds und Abnahmen bleiben erhalten. Der App-Test und Store-Zugang werden
  später mit echten Nutzern bearbeitet.
- Als nächster zusammenhängender technischer Abschluss wird der bestehende
  Kundenweg Konto -> Workspace -> Paket -> Zahlung/Webhook -> Nutzungsrecht
  fertiggestellt. Die echten Steuer-/Vertragsfakten bleiben separat sichtbar;
  sie verhindern nicht die Vorbereitung fehlender Engineering-Schritte.
- Die KI-Tarife werden an diesen bestehenden Weg angeschlossen, einschließlich
  Monatsbudget und Nachkauf. Es wird kein zweites Billing-System aufgebaut.
- Beim Server bleibt nur der normale Neustart samt Nachprüfung als konkreter
  Vorgang. Produktions- und Staging-Runner teilen den Host; ihre laufenden Jobs
  bleiben vor einem Neustart zu berücksichtigen. Kein erzwungener Neustart,
  kein pauschales Beenden fremder Sitzungen und keine neue Backup-/Restore-Runde.
- Restore wird ausschließlich ab dem fehlenden Storage-/Konfigurationsrest
  fortgesetzt. Danach erhält jeder Rest einen eindeutigen Abschlussbeleg.
- Die bereits beauftragten Plattformverbindungen behalten ihre eigenen
  tatsächlichen Zugangsvoraussetzungen. Der Instagram-Anwendungsfall wurde
  am 14. September in der zentralen Meta-App gespeichert
  ([Nachweis](https://github.com/FanMind/FanMind/pull/1121#issuecomment-5662337495));
  eine erneute Zustimmung zum Speichern ist nicht nötig. Ein verbundenes Konto
  mit empfangenen Nachrichten ist damit noch nicht bewiesen.

Künftige Statusberichte nennen pro Bereich **funktioniert / konkret fehlt /
nächster Abschlussbeleg**. Kein erneutes Öffnen erledigter Preisanlage,
Staging-Einrichtung, Datenbank-Restore oder veröffentlichter Autostartkorrekturen
ohne einen neuen konkreten Defekt. Keine Gesamt-Fertigmeldung aus Teiltests.

Weitere Belege: [PR #1096](https://github.com/FanMind/FanMind/pull/1096),
[PR #1117](https://github.com/FanMind/FanMind/pull/1117),
[installierter Production-Audit](https://github.com/FanMind/FanMind/actions/runs/34762468006/attempts/7),
[Datenbank-Restore](receipts/FM-RST-001-ISOLATED-DATABASE-RESTORE-ACCEPTED-20260828.md),
[Datenbank-Nachprüfung](receipts/FM-RST-001-DATABASE-POSTCHECK-ACCEPTED-20260907.md).
