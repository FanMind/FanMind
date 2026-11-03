# Offene Website-Chatfragen: Datenschutz- und Retentionvertrag

Status: Repository-Vertrag für PR #1411. Kein DB-Apply, keine Aktivierung und keine Rechtsgrundlagen-Freigabe.

## Zweck und Datenminimierung

`website_chat_open_questions` speichert nur Workspace-, Konversations- und Nachrichten-IDs, den Erkennungsgrund, Status und Zeitstempel. Der ursprüngliche Nachrichtentext wird nicht dupliziert. Die Adminansicht liest höchstens 100 explizit referenzierte Nachrichten eines ausgewählten Workspaces und wendet vor Anzeige und Gruppierung serverseitige Defense-in-depth-Maskierung an. Diese Maskierung ist keine Anonymisierung.

## Aufbewahrung und Löschung

- Kandidaten und Audit-Ereignisse werden per FK-Cascade entfernt, wenn Workspace, Konversation, Originalnachricht oder Kandidat gelöscht werden.
- Originalnachrichten bleiben Teil des bestehenden CRM-Vertrags. `trim_conversation_messages_to_latest_50()` begrenzt jede Konversation bei jedem Insert auf die 50 neuesten Nachrichten; das ist der derzeit ausführbare Löschmechanismus für diesen Datenbestand.
- Der vorhandene Website-Chat-Session-Retentionlauf löscht ausschließlich abgelaufene technische Sessions, Receipts und Handoff-Evidence. Er löscht absichtlich keine CRM-Kontakte, Konversationen oder Nachrichten.
- Betroffenenlöschung und Workspace-/Konversationslöschung wirken über die bestehenden FK-Cascades auf Kandidaten und Audit-Ereignisse. Backup-Aufbewahrung und Wiederherstellung folgen dem separaten Backup-/Restore-Vertrag und werden durch PR #1411 nicht geändert.
- Eine zusätzliche zeitbasierte Frist für CRM-Originalnachrichten oder eine neue Rechtsgrundlage wird hier nicht erfunden. Vor Aktivierung muss BT-051 die bestehende Begrenzung und Rechtsgrundlage fachlich bestätigen oder eine gesonderte Frist vorgeben.

## Verifikation und Aktivierungsgrenze

Repository-Nachweis:

```bash
node --test src/lib/openQuestionsRedaction.test.mjs tests/open-questions-privacy-contract.test.mjs
```

Der Contract-Test prüft, dass Rohtext nicht in der Kandidatentabelle dupliziert wird, Status und Audit atomar in einer Transaktion verbunden sind, Browserrollen keinen Tabellen-/RPC-Zugriff erhalten und die vorhandene Originalnachrichten-Begrenzung samt Cascade-Verknüpfung bestehen bleibt.

Eine isolierte Staging-Abnahme muss zusätzlich Statuswechsel, No-op-Wiederholung, Workspace-Negativfall, Audit-Ereignis, Lösch-Cascade und die installierte Retentionfunktion prüfen. Erst danach dürfen Security, Privacy und QA das Gate neu bewerten. Merge, DB-Apply, Aktivierung und Produktionsbetrieb bleiben getrennte Entscheidungen.
