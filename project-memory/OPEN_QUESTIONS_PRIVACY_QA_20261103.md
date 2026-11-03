# PR #1411 — Datenschutz- und Sicherheitsprüfplan (2026-11-03)

Status: **IMPLEMENTED / INDEPENDENT RETEST REQUIRED**. Dies ist Implementierungs-Evidence, keine unabhängige Abnahme. Kein Merge, kein Deployment, kein DB-Apply.

## Datenfluss und Befund

- `website_chat_open_questions` speichert IDs, Grund, Status und Zeitstempel, keine Kopie des Nachrichtentexts. Die Admin-Leseansicht holt Originaltext über `conversation_messages` mit Workspace-Filter und Service-Role. Vor Darstellung und Gruppierung erfolgt serverseitige Defense-in-depth-Maskierung.
- Die Ableitung führt Credential-Regeln vor generischen Zahlenregeln aus, erkennt die bestätigten synthetischen Grenzfälle und gibt anschließend ausschließlich ein festes, datenschutzgeprüftes Themenlabel aus. Ungeprüfter Rohtext, Namen im Satz und freie Identifikatoren gelangen nicht in Standardanzeige oder Gruppierung. Dies ist Datenminimierung, keine Anonymisierungszusage.
- `updateOpenQuestionStatus` prüft Plattformadmin, UUIDs, Status-Whitelist und Workspace-ID und ruft eine service-role-only SQL-Funktion auf. Statuswechsel und Append-only-Audit-Ereignis mit Workspace, Akteur-ID, Vorher-/Nachherstatus und Zeitstempel laufen atomar; identische No-op-Wiederholungen erzeugen kein weiteres Ereignis.
- Option A ist als kontrolliertes, nicht aktiviertes SQL-Delta umgesetzt: 30/180 Tage für Kandidaten, 12 Monate für Audit, 24 Monate bzw. 30 Tage nach Vertragsende/Löschinstruktion für Originalnachrichten, dokumentierte Verlängerung und fail-closed Legal Hold. Der rollback-only Harness prüft Grenzen, Workspace-Isolation, No-op, 52→50/Cascade und Recovery. Backup-/externe Rechtsgrenzen stehen in `docs/operations/OPEN_QUESTIONS_PRIVACY_RETENTION.md`.

## Unabhängige Abnahmetests

1. Unberechtigter Benutzer: Server Action muss Statusänderung verweigern; nicht nur UI verstecken.
2. Fremd-Workspace-ID und fremde Frage-ID: RPC muss 0 Treffer/Fehler haben; keine Status- oder Audit-Nebenwirkung.
3. Ungültige UUID, Statuswert, fehlende Felder: keine Datenbankänderung.
4. Gültige Änderung im eigenen Workspace: exakt ein Datensatz und exakt ein Audit-Ereignis mit verifiziertem Akteur und Vorher-/Nachherstatus.
5. Mehrfache identische Anfrage: Status bleibt stabil und es entsteht kein doppeltes Audit-Ereignis.
6. Synthetische PII-Varianten: E-Mail, internationale Telefonnummer, eingebettete URL, Adresse, Name, mehrere Tokenklassen und definierte Gesundheitsdaten müssen maskiert sein; unbekannte freie Inhalte bleiben als Restrisiko dokumentiert.
7. Cross-Tenant-Gruppierung: identischer maskierter Fragetext in zwei Workspaces darf nicht zusammengezählt werden.
8. Aufbewahrung: exakte Option-A-Grenzen, dokumentierte Verlängerung, Legal-Hold-No-op, 50-Nachrichten-Begrenzung, Cascades, Idempotenz und Workspace-Negativfall im isolierten rollback-only Staging nachweisen; Backup-Ausnahmen separat bestätigen.
9. Logging: keine Rohtexte, Tokens oder vertrauliche Inhalte in Fehlerlogs/Telemetry.
10. E2E: Staging mit aktiviertem Flag erst nach gesonderter Freigabe und Migration-Review; ausschließlich synthetische Daten.

## Lokale Regression

```bash
node --test src/lib/openQuestionsRedaction.test.mjs src/lib/openQuestionsGrouping.test.mjs tests/open-questions-privacy-contract.test.mjs
```

## Freigabegates

- CI grün für aktuellen Commit einschließlich CodeQL und PostgreSQL-Autorisierung.
- Unabhängige Security-/Privacy-Review und QA durch andere verantwortliche Prüfer als Implementierer.
- Owner-Option A ist im Repository umgesetzt; BT-051 muss die unabhängige Rechts-/Privacy-Nachprüfung auf dem stabilen Head und den späteren Staging-Nachweis durchführen.
- Merge, Migration, Staging-Apply und produktive Aktivierung bleiben jeweils getrennt freigabepflichtig.

## Staging-Readiness

`docs/operations/OPEN_QUESTIONS_RETENTION_STAGING_READINESS.md` steht auf **BLOCKED**: In dieser Builder-Laufzeit sind weder ein berechtigter Staging-Executor noch isoliertes Ziel und Production-Negativbindung nachgewiesen. Es wurde kein Staging-Lauf gestartet. Wiederaufnahme erst nach vollständigem Read-back auf stabilem Head.
