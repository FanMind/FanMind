# Offene Website-Chatfragen: Datenschutz- und Retentionvertrag

Status: Repository-Implementierung der Owner-Entscheidung Option A für PR #1411. Kein DB-Apply, keine Aktivierung und kein Staging-Lauf.

## Zweck und Datenminimierung

`website_chat_open_questions` speichert nur Workspace-, Konversations- und Nachrichten-IDs, Erkennungsgrund, Status und Zeitstempel. Der ursprüngliche Nachrichtentext wird nicht dupliziert. Die Adminansicht liest höchstens 100 explizit referenzierte Nachrichten eines ausgewählten Workspaces und gibt in der Standardansicht ausschließlich feste, datenschutzgeprüfte Themenlabels aus. Das ist Datenminimierung, keine Anonymisierungszusage.

## Option-A-Fristen

Das kontrollierte Delta `supabase/controlled/website_chat_open_questions_option_a_retention.sql` setzt die bestätigten Höchstfristen technisch um:

- CRM-Originalnachrichten: 24 Monate nach der Nachricht oder 30 Tage nach Vertragsende bzw. bestätigter Löschinstruktion.
- Aufgelöste Kandidaten: 30 Tage nach letzter Statusänderung.
- Offene oder in Prüfung befindliche Kandidaten: 180 Tage ab Anlage; eine Verlängerung wirkt nur mit dokumentiertem Grund und konkretem Endzeitpunkt.
- Audit-Ereignisse: spätestens nach 12 Monaten gelöscht; frühere FK-Cascades bei Kandidaten-, Nachrichten-, Konversations- oder Workspace-Löschung bleiben zulässig.
- Ein aktiver, dokumentierter Legal Hold stoppt für den Workspace den gesamten Retention-Lauf. Fehlende Workspace-Konfiguration bricht fail-closed ab.
- Jeder Lauf ist an genau eine Workspace-ID gebunden. Die wiederholte Ausführung nach erfolgreicher Löschung ist ein No-op.

Der bestehende Insert-Trigger begrenzt jede Konversation zusätzlich auf die 50 neuesten Nachrichten. Kandidaten und Audit-Ereignisse folgen den vorhandenen FK-Cascades.

## Nicht technisch behauptete Grenzen

Backups bleiben außerhalb des normalen Produktzugriffs und benötigen einen getrennten Runoff-Vertrag von maximal 90 Tagen. Eigene Support-/Vertragsanfragen ohne Vertrag, die unabhängige BT-051-Rollen- und Rechtsprüfung, Kundeninstruktionen und Transparenztexte sind nicht vollständig aus diesem Schema ableitbar; das Repository behauptet dafür keine technische Vollständigkeit. Marketing, Profiling, Modelltraining und Cross-Workspace-Nutzung sind durch diesen Retention-Lauf nicht autorisiert.

## Verifikation und Aktivierungsgrenze

Repository-Nachweis:

```bash
node --test src/lib/openQuestionsRedaction.test.mjs src/lib/openQuestionsGrouping.test.mjs tests/open-questions-privacy-contract.test.mjs
node scripts/operations/open-questions-retention-staging-acceptance.mjs --check
```

Der rollback-only Harness lädt das kontrollierte Delta ausschließlich in seiner Testtransaktion. Er prüft atomaren Status/Audit, 52→50/Cascade, exakte 30-/180-Tage- und 12-/24-Monatsgrenzen, dokumentierte Verlängerung, Vertragsende, Legal Hold, Workspace-Isolation, No-op-Wiederholung und vollständigen Rollback.

`docs/operations/OPEN_QUESTIONS_RETENTION_STAGING_READINESS.md` ist der verbindliche Preflight. Der spätere Staging-Lauf bleibt blockiert, bis tatsächlicher Executor, isoliertes Ziel, Production-Negativbindung, stabile Commit-Bindung, synthetische Fixture und Rollback-Read-back belegt sind. Merge, Deployment, generisches DB-Apply, Aktivierung und Produktionsbetrieb bleiben getrennte Entscheidungen.
