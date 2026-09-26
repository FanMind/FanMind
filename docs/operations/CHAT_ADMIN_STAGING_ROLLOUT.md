# ChatAdmin V1 — kontrollierter Staging-Rollout

Stand 20. September 2026: Source aus PR #1145 ist auf `main`; das Schema ist weiterhin **unapplied**, kein realer Workspace besitzt die Capability und Production-Aktivierung ist offen. ChatAdmin ist ausschließlich ein normaler Workspace Owner plus `chat_admin_multi_character=true`, niemals Platform Admin.

## Geschützter Ablauf

Einziger Einstieg ist `.github/workflows/chat-admin-staging-rollout.yml` auf dem exakten, reviewten `main`-Commit im geschützten Environment `staging`. Falsche Modus-/Bestätigungs-Paare brechen den Lauf ab. Der Workflow nutzt `verify-full` mit der reviewten Supabase-Root-CA, begrenzte Connection-/Lock-/Statement-/Job-Zeiten und eine an den ausgewählten Supabase-Projekt-Ref gebundene Datenbankidentität.

1. `VERIFY` + `verify-chat-admin-schema`: ausschließlich read-only. Ergebnis `ABSENT`, `PARTIAL` (Fehler) oder `VERIFIED`; bindet API, Supabase und DB an dasselbe von Production verschiedene Staging-Ziel und prüft den SQL-SHA-256 `9dd3674a3848303cd707aa89ad4b808c5bd9a12bfe3ff4b367e2c99121ad1e7b`. Der Verifier prüft die erforderlichen RLS-Policy-Definitionen, Rollen/Commands, Tenant-Composite-FKs, den globalen Unique-Index, RLS und Browser-Rechte; reine Objekt-/Policy-Anzahlen reichen nicht.
2. `APPLY` + `apply-chat-admin-migration`: separat vom Owner freizugebender, transaktionsgebundener Apply ausschließlich dieser gepinnten Datei. Keine generische Migration, echten Daten oder Capability-Grants. In diesem Arbeitspaket nicht ausführen.
3. `ACCEPT` + `run-chat-admin-acceptance`: nur wenn unmittelbar davor derselbe Lauf auf demselben Ziel `VERIFY` erfolgreich ausgeführt hat. Der Datenbankteil verwendet ausschließlich markierte, voneinander verschiedene synthetische IDs und vollständiges Transaktions-Rollback. Er setzt echte `authenticated`-RLS-Kontexte für Owner, Member, Fremd-Owner und eine getrennte Platform-Admin-Testidentität. Ein Cleanup-, Autorisierungs-, Isolation- oder Negativtestfehler macht den Lauf rot.

`ACCEPT` ist bewusst nur die **Datenbank-/RLS-Abnahme**. Der echte ChatAdmin-Anwendungsfluss (aktiver Character -> manuell eingefügte Fan-Nachricht -> exakt drei revisiongebundene Vorschläge -> Copy/Manual-Send-Handoff) wird hier nicht ausgeführt und muss als `CHAT_ADMIN_ACCEPTANCE_MANUAL_FLOW=OPEN` offen bleiben. Ein Kommentar oder statisches Testmuster darf diesen späteren Runtime-/Application-Layer-Beweis nicht als `PASS` ersetzen.

Für `ACCEPT` dürfen entweder alle zehn expliziten geschützten Fixture-Variablen gesetzt sein **oder alle zehn leer sein**. Bei vollständig leeren Werten löst der Acceptance-Runner die bereits vorhandenen kanonischen Staging-Fixtures read-only über ihre eindeutigen Datenbankmarker auf: Primary/Secondary `staging_synthetic_fixture`, der markierte `ai_member` sowie der interne `staging_operator_workspace`. Die vier Character-/Conversation-UUIDs werden für genau diesen rollback-only Lauf neu erzeugt. Teilweise gesetzte, mehrdeutige, fremde oder überlappende Fixture-Werte brechen fail-closed ab. Vorhandene Capability- oder Character-Testzeilen führen ebenfalls zum Abbruch. Keine Fixture ist eine Freigabe für reale Nutzer.

Der spätere echte Grant ist ein anderes Arbeitspaket: E-Mail einmalig sicher zu `user_id` und `workspace_id` auflösen und danach nur stabile IDs verwenden. Keine E-Mail gehört in SQL oder Architektur-IDs.

## Bildspeicher

Es existierte keine passende Storage-Policy. `20260920231000_chat_admin_profile_image_storage.sql` ist daher der kleinste **separate, unapplied** Vertrag: Er erstellt keinen Bucket, verlangt den bestehenden Bucket `chat-characters` ausdrücklich privat und bindet Objektpfade an `<workspace_id>/<character_id>/<filename>` sowie Capability, Owner und existierenden Character. Malformed/Legacy-Pfade werden ohne unsicheren UUID-Cast abgewiesen; auch ein UPDATE-Ziel muss weiterhin einen existierenden Character referenzieren. Das gespeicherte Feld bleibt `chat-characters/<workspace_id>/<character_id>/<filename>`. Dieser Vertrag gehört nicht zum ChatAdmin-Schema-APPLY und benötigt später eigenen Review/Apply.

## Unveränderte Grenzen

Normale Creator, `creators.workspace_id UNIQUE`, normale Reply Suggestions, Registration, Admin CRM, Billing/Stripe, AI Cost Guard, Social und Mobile bleiben unverändert. Kein OnlyFans-Netzwerkaufruf, Scraping, Provider-Login oder automatisches Senden ist Teil des Rollouts. Der offene Production-Audit-Punkt `production_audit_backup_latest_stale_or_empty` bleibt ein separater Operations-Punkt und ist weder repariert noch ChatAdmin-Blocker.
