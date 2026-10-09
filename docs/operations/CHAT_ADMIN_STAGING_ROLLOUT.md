# ChatAdmin V1 — kontrollierter Staging-Rollout

## Persistente Character-Fans (27. September 2026)

Die additive Fan-Erweiterung besitzt einen eigenen, manuellen Staging-Kontrollpfad in
`.github/workflows/chat-admin-fan-staging-migration.yml`. Dieser Pfad ist nicht Teil
eines normalen Web-Deployments und darf Production nicht adressieren. Er bindet den
Dispatch an den exakten aktuellen `main`-Commit, das geschützte Environment `staging`,
den von Production verschiedenen API-/Supabase-/Datenbank-Target und TLS
`verify-full`. `VERIFY` ist read-only. `APPLY` benötigt zusätzlich die exakte
Bestätigung `apply-chat-admin-migration`, den Non-Production-Write-Acknowledge und
wendet ausschließlich die checksum-gepinnte Datei
`20260927200000_chat_admin_character_fans.sql` als deren eigene Transaktion an.

Der Postflight akzeptiert keine bloßen Objektzahlen: Er prüft Fan-Tabelle und
-Spalten, zusammengesetzte Foreign Keys, alle vier partiellen Unique-Indizes, RLS,
die Fan-Policy, entzogene direkte Conversation-/Message-Schreibrechte, die drei
atomaren RPCs, deren Rollenrechte und `security definer`/festen `search_path` sowie
den Readiness-RPC. Ausgabe und Fehler bleiben auf feste Zustände begrenzt. Ein
bereits vollständig verifiziertes Schema wird nicht erneut angewendet; ein partielles
Schema blockiert fail-closed.

Merge oder erfolgreiche lokale Checks autorisieren weder den Apply noch eine
Production-Aktivierung. Das Fan-Schema ist auf Staging bereits verifiziert und wird
nicht erneut angewendet. Mit dem Owner-Preview aus PR #1228 darf ausschließlich auf
`staging` der exakt konfigurierte Preview-Workspace/-User serverseitig die bestehende
ChatAdmin-Capability erhalten; derselbe Staging-Modus aktiviert dort den persistenten
Fan-Runtime-Pfad auch ohne den Production-Flag. Production bleibt unverändert
Capability-/Flag-gated und default-off.

Stand 29. September 2026: Das ChatAdmin-Schema ist auf Staging angewendet (Run `36235870895`); die getrennte synthetische DB/RLS-Abnahme ist bestanden (Run `36238536613`, Versuch 2). Beide Schritte sind verbraucht und werden nicht wiederholt. Der getrennte synthetische manuelle Staging-Anwendungsflow ist durch Run `36255475314`, Versuch 1, samt unabhängigem Cleanup-/Schema-/Session-/Production-Gegencheck abgenommen und verbraucht. Der historische DB-Workflow behält seinen begrenzten `CHAT_ADMIN_ACCEPTANCE_MANUAL_FLOW=OPEN`-Output. PR #1228 ergänzt ausschließlich den owner-sichtbaren Staging-Preview: nur der über `FANMIND_CHAT_ADMIN_PREVIEW_WORKSPACE_ID` und `FANMIND_CHAT_ADMIN_PREVIEW_USER_ID` exakt konfigurierte normale Workspace Owner kann auf Staging die Capability serverseitig erhalten und den persistenten Fan-Flow sehen. Beliebige andere Staging-Owner, Platform Admin und Production erhalten daraus keine Freigabe. ChatAdmin bleibt ausschließlich ein normaler Workspace Owner plus `chat_admin_multi_character=true`, niemals Platform Admin.

## Geschützter Ablauf

Für die Schema-/DB-Schritte ist der Einstieg `.github/workflows/chat-admin-staging-rollout.yml` auf dem exakten, reviewten `main`-Commit im geschützten Environment `staging`. Falsche Modus-/Bestätigungs-Paare brechen den Lauf ab. Der Workflow nutzt `verify-full` mit der reviewten Supabase-Root-CA, begrenzte Connection-/Lock-/Statement-/Job-Zeiten und eine an den ausgewählten Supabase-Projekt-Ref gebundene Datenbankidentität.

1. `VERIFY` + `verify-chat-admin-schema`: ausschließlich read-only. Ergebnis `ABSENT`, `PARTIAL` (Fehler) oder `VERIFIED`; bindet API, Supabase und DB an dasselbe von Production verschiedene Staging-Ziel und prüft den SQL-SHA-256 `9dd3674a3848303cd707aa89ad4b808c5bd9a12bfe3ff4b367e2c99121ad1e7b`. Der Verifier prüft die erforderlichen RLS-Policy-Definitionen, Rollen/Commands, Tenant-Composite-FKs, den globalen Unique-Index, RLS und Browser-Rechte; reine Objekt-/Policy-Anzahlen reichen nicht.
2. `APPLY` + `apply-chat-admin-migration`: separat vom Owner freizugebender, transaktionsgebundener Apply ausschließlich dieser gepinnten Datei. Keine generische Migration, echten Daten oder Capability-Grants. In diesem Arbeitspaket nicht ausführen.
3. `ACCEPT` + `run-chat-admin-acceptance`: nur wenn unmittelbar davor derselbe Lauf auf demselben Ziel `VERIFY` erfolgreich ausgeführt hat. Der Datenbankteil verwendet ausschließlich markierte, voneinander verschiedene synthetische IDs und vollständiges Transaktions-Rollback. Er setzt echte `authenticated`-RLS-Kontexte für Owner, Member, Fremd-Owner und eine getrennte Platform-Admin-Testidentität. Ein Cleanup-, Autorisierungs-, Isolation- oder Negativtestfehler macht den Lauf rot.

`ACCEPT` ist bewusst nur die **Datenbank-/RLS-Abnahme**. Der echte ChatAdmin-Anwendungsfluss (aktiver Character -> manuell eingefügte Fan-Nachricht -> exakt drei revisiongebundene Vorschläge -> Copy/Manual-Send-Handoff) wird hier nicht ausgeführt und muss als `CHAT_ADMIN_ACCEPTANCE_MANUAL_FLOW=OPEN` offen bleiben. Ein Kommentar oder statisches Testmuster darf diesen späteren Runtime-/Application-Layer-Beweis nicht als `PASS` ersetzen.

Für `ACCEPT` müssen die geschützten Staging-Variablen einen sauberen synthetischen Owner-Workspace, einen zweiten synthetischen Fremd-Owner-Workspace, einen normalen Member, eine getrennte Platform-Admin-Testidentität sowie getrennte Character-/Conversation-UUIDs referenzieren. Vorhandene Capability- oder Character-Testzeilen führen fail-closed zum Abbruch. Keine dieser Variablen ist eine Freigabe für reale Nutzer.

Der spätere echte Grant ist ein anderes Arbeitspaket: E-Mail einmalig sicher zu `user_id` und `workspace_id` auflösen und danach nur stabile IDs verwenden. Keine E-Mail gehört in SQL oder Architektur-IDs.

## Separater echter Anwendungsflow — abgenommen und verbraucht

Owner-Autorisierung `FM-AUTH-CHATADMIN-MANUAL-FLOW-20260926` ist `CONSUMED`. Der tatsächliche Lauf `36255475314` auf Release `9652ae62928c70d8f39d8f184857a34fcd4de74f` und der unabhängige Cleanup-/Schema-/Session-/Production-Gegencheck sind in `project-memory/receipts/chat-admin-manual-flow-36255475314-1-acceptance.json` als `ACCEPTED` gebunden. Die folgenden Absätze dokumentieren den ausgeführten Vertrag; sie sind keine neue Dispatch-Anweisung. Ein späterer anderer Scope benötigt einen eigenen begrenzten Vertrag. Der damalige Deploy verwendete `billing_write_freeze=preserve`; `/api/version` bestätigte den exakten Commit und `runtimeEnvironment=staging`.

Der abgeschlossene Ablauf startete `.github/workflows/chat-admin-manual-flow-staging.yml` auf `main` mit dem exakten `reviewed_commit` und `confirmation=run-chat-admin-manual-flow`. `mode=probe` ist der Standard: Er prüft echte Logins, erwartete IDs, Admin-Zugriff, ChatAdmin-Sperre und Session-Logout ohne DB-Passfile, Fixture oder KI-Aufruf. Die vollständige autorisierte Abnahme verlangt ausdrücklich `mode=acceptance`; derselbe Lauf muss zuerst den Probe bestehen. Der Probe-Beleg ist an Run, Versuch, Commit, Ziel und aktuellen Quellcode gebunden und kann nicht aus einem früheren Lauf übernommen werden.

Die bestehenden zehn geschützten Fixture-UUIDs werden im Runner und Browser gemeinsam kanonisch normalisiert (äußere Leerzeichen/CR entfernen, Kleinbuchstaben, anschließend strikte UUID-Prüfung). Zugangsdaten und Auth-Identitäten werden weder neu angelegt noch rotiert. Private Diagnose-Dateien enthalten ausschließlich gebundene Metadaten und fest erlaubte Phase-/Status-/Netzwerk-/Session-Ergebnisse. Bei Browserfehlern gibt der Parent nur diese überprüften Enum-Werte aus; rohe Browser-Ausgabe, Fehlertexte, Tokens, E-Mails und Antwortinhalte bleiben unterdrückt.

Beim Beenden meldet der Browser alle erfassten Sessions ab, blockiert neue erlaubte Browser-Anfragen und wartet auf bereits gestartete Route-Handler. Erst danach werden die Kontexte geschlossen und die endgültigen Netzwerk-Zähler geprüft. Die Boundary bleibt bis zum Schließen installiert; echte Transport-, Redirect-, Origin- und Write-Fehler bleiben Abnahmefehler. Ein früherer fehlgeschlagener Probe wird durch diese Korrektur nicht nachträglich akzeptiert.

Der Runner prüft Schema, genaue synthetische Identitäten, Workspace-Zuordnung und leere ChatAdmin-Tabellen. Ein privater laufgebundener Receipt wird vor dem Commit der temporären Capability, zwei eigenen Characters und eines tatsächlich vorhandenen Fremd-Characters gespeichert. Ein separater Recovery-Beleg mit ausschließlich synthetischen IDs, Marker, Zeit-, Run- und Commit-Bindung muss zuvor erfolgreich als kurzlebiges GitHub-Artefakt gesichert sein; fehlgeschlagene Sicherung sperrt jede Fixture-Mutation. Die echte Browser-Oberfläche meldet sich an, erzeugt für die eigenen Characters A/B jeweils drei echte KI-Vorschläge, prüft Copy und Context-Wechsel und übt anonyme, fremde, inaktive, falsche Revision und Origin-Negativpfade. Der Fremd-Character gehört exakt dem zweiten synthetischen Workspace; sein Zugriff wird aus der Capability-berechtigten primären Session abgewiesen. Member-/Admin-/Tenant-RLS wird zusätzlich direkt geprüft. Die Admin-ID muss zur geschützten Admin-Testidentität und konfigurierten Allowlist gehören; eine echte Admin-Session bestätigt den Admin-Zugriff und die getrennte ChatAdmin-Sperre. Die gemeinsame Anwendungs-Autorisierung weist Platform Admin anhand von `FANMIND_ADMIN_EMAILS` ausdrücklich ab, auch wenn Owner-Rolle und eine Capability sonst vorliegen würden; ausführbare Tests gegen die tatsächliche Autorisierung prüfen diese Kombination.

Fixture, Capability und die eindeutig zugeordneten ChatAdmin-Usage-Zeilen werden auch bei Fehlern nur nach Identitätsprüfung entfernt; fremde Daten führen zum Abbruch. Erfolgreiche Abnahme benötigt `CHAT_ADMIN_MANUAL_BROWSER=PASS`, `CHAT_ADMIN_MANUAL_VERIFY=PASS`, `CHAT_ADMIN_MANUAL_CLEANUP=PASS`, `CHAT_ADMIN_MANUAL_ABSENCE=PASS` und `CHAT_ADMIN_ACCEPTANCE_MANUAL_FLOW=PASS` sowie unabhängigen Gegencheck. Abgebrochene oder unklare laufende Requests dürfen keine vollständige Cleanup-/Abnahmebehauptung erzeugen. HMAC-basierte Rate-Limit-Telemetrie bleibt unter ihrer normalen TTL und ist kein langlebiger Fixture-Datensatz. Browser-Traces, Screenshots, Videos, private Antworten und Credentials werden nicht als CI-Artefakte veröffentlicht. Der einzige veröffentlichte Recovery-Beleg enthält keine E-Mail, Passwörter, Tokens oder Nachrichten. Bei rotem/abgebrochenem Lauf diesen Beleg aus genau diesem Run sichern und vor Ablauf der Aufbewahrung geschützt anhand der gebundenen Identitäten gegenprüfen. Unklare laufende Requests benötigen eigenständige Prüfung; `inFlightUncertain` darf nicht nur für ein grünes Ergebnis umgeschrieben werden.

## Bildspeicher

Es existierte keine passende Storage-Policy. `20260920231000_chat_admin_profile_image_storage.sql` ist daher der kleinste **separate, unapplied** Vertrag: Er erstellt keinen Bucket, verlangt den bestehenden Bucket `chat-characters` ausdrücklich privat und bindet Objektpfade an `<workspace_id>/<character_id>/<filename>` sowie Capability, Owner und existierenden Character. Malformed/Legacy-Pfade werden ohne unsicheren UUID-Cast abgewiesen; auch ein UPDATE-Ziel muss weiterhin einen existierenden Character referenzieren. Das gespeicherte Feld bleibt `chat-characters/<workspace_id>/<character_id>/<filename>`. Dieser Vertrag gehört nicht zum ChatAdmin-Schema-APPLY und benötigt später eigenen Review/Apply.

## Unveränderte Grenzen

Normale Creator, `creators.workspace_id UNIQUE`, normale Reply Suggestions, Registration, Admin CRM, Billing/Stripe, AI Cost Guard, Social und Mobile bleiben unverändert. Kein OnlyFans-Netzwerkaufruf, Scraping, Provider-Login oder automatisches Senden ist Teil des Rollouts. Der offene Production-Audit-Punkt `production_audit_backup_latest_stale_or_empty` bleibt ein separater Operations-Punkt und ist weder repariert noch ChatAdmin-Blocker.

## Reconciliierter Browser-Fehllauf 36250479400/1

Der Lauf auf `0a368095790cf6ff297d6735569c4edb03186efb` bereitete seine synthetische Fixture vor, scheiterte dann aber vor ChatAdmin-Navigation und KI-Erzeugung: Alle elf tatsächlichen Job-Umgebungsbeobachtungen der Owner-ID enthalten ein nachgestelltes U+000D; der damalige Browser verglich die rohe ID unmittelbar nach dem Login, während der SQL-Runner normalisierte. Zwei unabhängige Reproduktionen mit den historischen Helfern bestätigen den zwingenden Assertion-Abbruch und anschließenden Logout beider Sessions. Frische Tabellen-/Usage-/Session-Zählungen sind null; der vollständige Schema- und Production-Gegencheck ist bestanden.

Der Originalbeleg behält `inFlightUncertain=true` als historische Beobachtung. Die separate Reconciliation in `project-memory/receipts/chat-admin-manual-flow-36250479400-1-reconciliation.json` schließt die Unsicherheit durch diesen Ablaufnachweis. Der Fehllauf zählt ausdrücklich nicht als erfolgreiche manuelle Abnahme. Die spätere korrigierte Abnahme wurde nach Review, CI, Merge und exakter Bereitstellung durch Lauf `36255475314` erfolgreich abgeschlossen und unabhängig gegengeprüft; die frühere fehlgeschlagene Ausführung bleibt unverändert ein Fehllauf.

## Strukturierte Character-Angebote (Oktober 2026)

Die additive Spalte `chat_characters.sales_playbook` hat einen eigenen kontrollierten
Staging-Pfad. Ziel ist ausschließlich FanMind Staging unter
`https://staging.fanmind.ch` und Supabase-Projekt `vshyhvgcmrlagvfnvomc`.
Production `drqkpdvtbbrrdwmtrodz` ist ausgeschlossen. Der Workflow
`.github/workflows/chat-admin-structured-offers-staging-migration.yml` darf nur
manuell auf dem exakten, reviewten aktuellen `main`-Commit im geschützten Environment
`staging` laufen. Bereits verbrauchte ChatAdmin-Autorisierungen gelten nicht für
diese Migration; VERIFY oder APPLY benötigen eine frische, ziel- und commitgebundene
Freigabe nach der aktuellen Execution Policy.

Der einzige Apply-Vertrag ist
`supabase/controlled/20261007190000_chat_admin_structured_offers.sql` mit SHA-256
`01104f6e1e2a4edfda8ec2c50af784fad89f234ed3f0a9bfaf827eacb9803421`.
Kein `supabase db push`, keine generische Migration und kein anderer SQL-Text ist
zulässig.

### Preflight und Apply

1. `VERIFY` mit Bestätigung `verify-chat-admin-structured-offers` prüft read-only:
   exakter aktueller `main`-Commit, Staging-/Production-Trennung, TLS `verify-full`,
   bestehende Character-Tabelle mit RLS, Owner und exakter Workspace-Policy sowie den
   Zustand `ABSENT`, `PARTIAL` oder `VERIFIED`. `PARTIAL` blockiert.
2. Vor APPLY muss die verantwortliche Person eine aktuelle Staging-Backup- und
   Restore-Bereitschaft nach der kanonischen Operations-Policy bestätigen. Fehlende
   oder veraltete Recovery-Evidence blockiert; dieser Workflow behauptet selbst kein
   Provider-Backup.
3. `APPLY` mit Bestätigung `apply-chat-admin-structured-offers` ist eine getrennt
   autorisierte Protected Action. Sie ist nur aus `ABSENT` zulässig, führt exakt die
   gepinnte Transaktion aus und prüft danach Typ, NOT NULL, kanonischen Default,
   Größen-/Objekt-Constraint, Kommentar, ACLs, gültige Zeilen sowie eine unveränderte
   Anzahl von Character-Zeilen. Bereits `VERIFIED` wird nicht erneut angewendet.
4. Nach erfolgreichem Apply folgen auf dem exakt bereitgestellten Commit synthetische
   Anwendungstests: vier Angebotskategorien speichern und neu laden, Character- und
   Workspace-Isolation, korrektes Offer im Reply-Kontext und fehlender Preis ohne
   erfundenen Betrag. Diese Anwendungstests sind keine Erlaubnis für reale Fan-Daten
   oder externe Nachrichten.

### Recovery und Rollback

Ein SQL-Fehler rollt durch die eingeschlossene Transaktion automatisch vollständig
zurück; der Postflight muss danach wieder `ABSENT` oder den zuvor verifizierten
Zustand melden. Nach einem erfolgreichen Commit ist die Spalte additiv und besitzt
einen rückwärtskompatiblen Default. Bei einem Anwendungsfehler wird zuerst die
Anwendung auf den letzten bekannten Commit zurückgesetzt; die ungenutzte Spalte darf
bestehen bleiben. Ein `drop column`, Restore Write oder sonstiger destruktiver
Rollback ist ein neues geschütztes Arbeitspaket und benötigt vorab Dateninventar,
aktuelle Backup-/Restore-Evidence, eigenen SQL-Vertrag und eigene Autorisierung.

