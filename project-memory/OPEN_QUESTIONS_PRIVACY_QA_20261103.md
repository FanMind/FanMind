# PR #1411 — Datenschutz- und Sicherheitsprüfplan (2026-11-03)

Status: **IMPLEMENTED / INDEPENDENT RETEST REQUIRED**. Dies ist Implementierungs-Evidence, keine unabhängige Abnahme. Kein Merge, kein Deployment, kein DB-Apply.

## Datenfluss und Befund

- `website_chat_open_questions` speichert IDs, Grund, Status und Zeitstempel, keine Kopie des Nachrichtentexts. Die Admin-Leseansicht holt Originaltext über `conversation_messages` mit Workspace-Filter und Service-Role. Vor Darstellung und Gruppierung erfolgt serverseitige Defense-in-depth-Maskierung.
- Die Ableitung führt Credential-Regeln vor generischen Zahlenregeln aus, erkennt die bestätigten synthetischen Grenzfälle und gibt anschließend ausschließlich ein festes, datenschutzgeprüftes Themenlabel aus. Ungeprüfter Rohtext, Namen im Satz und freie Identifikatoren gelangen nicht in Standardanzeige oder Gruppierung. Dies ist Datenminimierung, keine Anonymisierungszusage.
- `updateOpenQuestionStatus` prüft Plattformadmin, UUIDs, Status-Whitelist und Workspace-ID und ruft eine service-role-only SQL-Funktion auf. Statuswechsel und Append-only-Audit-Ereignis mit Workspace, Akteur-ID, Vorher-/Nachherstatus und Zeitstempel laufen atomar; identische No-op-Wiederholungen erzeugen kein weiteres Ereignis.
- Kandidaten und Audit-Ereignisse folgen FK-Cascades. Originalnachrichten werden durch den bestehenden Insert-Trigger auf die neuesten 50 je Konversation begrenzt. Der rollback-only Staging-Harness prüft Status/Audit, Cascade, Trigger und Recovery. Backup-/Ausnahmegrenzen und die noch erforderliche BT-051-Entscheidung stehen in `docs/operations/OPEN_QUESTIONS_PRIVACY_RETENTION.md`.

## Unabhängige Abnahmetests

1. Unberechtigter Benutzer: Server Action muss Statusänderung verweigern; nicht nur UI verstecken.
2. Fremd-Workspace-ID und fremde Frage-ID: RPC muss 0 Treffer/Fehler haben; keine Status- oder Audit-Nebenwirkung.
3. Ungültige UUID, Statuswert, fehlende Felder: keine Datenbankänderung.
4. Gültige Änderung im eigenen Workspace: exakt ein Datensatz und exakt ein Audit-Ereignis mit verifiziertem Akteur und Vorher-/Nachherstatus.
5. Mehrfache identische Anfrage: Status bleibt stabil und es entsteht kein doppeltes Audit-Ereignis.
6. Synthetische PII-Varianten: E-Mail, internationale Telefonnummer, eingebettete URL, Adresse, Name, mehrere Tokenklassen und definierte Gesundheitsdaten müssen maskiert sein; unbekannte freie Inhalte bleiben als Restrisiko dokumentiert.
7. Cross-Tenant-Gruppierung: identischer maskierter Fragetext in zwei Workspaces darf nicht zusammengezählt werden.
8. Aufbewahrung: Repository-Vertrag, 50-Nachrichten-Begrenzung, Kandidaten-/Audit-Cascade und Betroffenenlöschung in isoliertem Staging nachweisen; Backup-Ausnahmen und BT-051-Entscheidung separat bestätigen.
9. Logging: keine Rohtexte, Tokens oder vertrauliche Inhalte in Fehlerlogs/Telemetry.
10. E2E: Staging mit aktiviertem Flag erst nach gesonderter Freigabe und Migration-Review; ausschließlich synthetische Daten.

## Lokale Regression

```bash
node --test src/lib/openQuestionsRedaction.test.mjs src/lib/openQuestionsGrouping.test.mjs tests/open-questions-privacy-contract.test.mjs
```

## Freigabegates

- CI grün für aktuellen Commit einschließlich CodeQL und PostgreSQL-Autorisierung.
- Unabhängige Security-/Privacy-Review und QA durch andere verantwortliche Prüfer als Implementierer.
- BT-051 bestätigt Rechtsgrundlage/Frist oder fordert eine gesonderte Änderung; Repository-Code behauptet keine neue Rechtsfreigabe.
- Merge, Migration, Staging-Apply und produktive Aktivierung bleiben jeweils getrennt freigabepflichtig.
