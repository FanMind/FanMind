# PR #1411 — Datenschutz- und Sicherheitsprüfplan (2026-11-03)

Status: **NOT TESTED / REVIEW REQUIRED**. Dies ist ein Prüfkatalog, keine unabhängige Abnahme. Kein Merge, kein Deployment, kein DB-Apply.

## Datenfluss und Befund
- `website_chat_open_questions` speichert IDs, Grund, Status und Zeitstempel, keine Kopie des Nachrichtentexts. Die Admin-Leseansicht holt Originaltext über `conversation_messages` mit Workspace-Filter und Service-Role. Vor Darstellung und Gruppierung erfolgt Muster-Maskierung im Servercode.
- Die Maskierung deckt gängige E-Mails, Links, lange Nummern und einige Tokenformen ab, aber nicht Namen, Adressen, frei formulierte Identifikatoren, sämtliche Secrets oder semantisch sensible Daten. **Restrisiko hoch**, keine Anonymisierungszusage.
- `updateOpenQuestionStatus` prüft Plattformadmin, UUIDs, Status-Whitelist und Workspace-ID im PATCH. Es fehlt ein separater Audit-Datensatz mit Akteur, Vorher-/Nachher-Wert und Zeitstempel.
- Löschung der Frage-Kandidaten erfolgt beim Löschen referenzierter Workspace-/Konversations-/Nachrichtenzeilen über FK-Cascade; Frist und tatsächlich ausgeführter Retention-Job für Originalnachrichten sind **nicht verifiziert**. Keine Freigabe allein aus FK-Cascade ableiten.

## Unabhängige Abnahmetests
1. Unberechtigter Benutzer: Server Action muss Statusänderung verweigern; nicht nur UI verstecken.
2. Fremd-Workspace-ID und fremde Frage-ID: PATCH muss 0 Treffer haben; keine Seiteneffekte.
3. Ungültige UUID, Statuswert, fehlende Felder: keine Datenbankänderung.
4. Gültige Änderung im eigenen Workspace: exakt ein Datensatz; verifizierter Vorher-/Nachher-Status.
5. Mehrfache identische Anfrage: kein unbeabsichtigter weiterer Effekt; Audit-Konzept prüfen.
6. Synthetische PII-Varianten (E-Mail, internationale Telefonnummern, Links, Adressen, Namen, Tokens): prüfen, was maskiert bleibt; unmaskierte Daten als Defekt bewerten.
7. Cross-Tenant-Gruppierung: identischer Fragetext in zwei Workspaces darf nicht zusammengezählt werden.
8. Aufbewahrung: schriftlichen Retention-Vertrag, Löschjob und kaskadierte Löschung im isolierten Staging nachweisen; keine produktiven Testdaten verwenden.
9. Logging: keine Rohtexte, Tokens oder vertrauliche Inhalte in Fehlerlogs/Telemetry.
10. E2E: Staging mit aktiviertem Flag erst nach gesonderter Freigabe und Migration-Review; Test mit synthetischen Daten.

## Freigabegates
- CI grün für aktuellen Commit einschließlich CodeQL und PostgreSQL-Autorisierung.
- Unabhängige Security-/Privacy-Review und QA durch andere verantwortliche Prüfer als Implementierer.
- Dokumentierte Retention und Löschung, Audit-Trail und Rest-Risiko-Entscheidung.
- Merge, Migration und produktive Aktivierung jeweils nur nach passenden Freigaben.
