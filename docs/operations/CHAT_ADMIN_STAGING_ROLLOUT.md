# ChatAdmin V1 — kontrollierter Staging-Rollout

Stand 20. September 2026: Source aus PR #1145 ist auf `main`; das Schema ist weiterhin **unapplied**, kein realer Workspace besitzt die Capability und Production-Aktivierung ist offen. ChatAdmin ist ausschließlich ein normaler Workspace Owner plus `chat_admin_multi_character=true`, niemals Platform Admin.

## Geschützter Ablauf

Einziger Einstieg ist `.github/workflows/chat-admin-staging-rollout.yml` auf dem exakten, reviewten `main`-Commit im geschützten Environment `staging`.

1. `VERIFY` + `verify-chat-admin-schema`: ausschließlich read-only. Ergebnis `ABSENT`, `PARTIAL` (Fehler) oder `VERIFIED`; bindet API, Supabase und DB an dasselbe von Production verschiedene Staging-Ziel und prüft den SQL-SHA-256 `9dd3674a3848303cd707aa89ad4b808c5bd9a12bfe3ff4b367e2c99121ad1e7b`.
2. `APPLY` + `apply-chat-admin-migration`: separat vom Owner freizugebender, transaktionsgebundener Apply ausschließlich dieser gepinnten Datei. Keine generische Migration, echten Daten oder Capability-Grants. In diesem Arbeitspaket nicht ausführen.
3. `ACCEPT` + `run-chat-admin-acceptance`: erst nach VERIFIED; ausschließlich markierte synthetische IDs, vollständige Transaktions-Rollback-Bereinigung. Ein Cleanup- oder Negativtestfehler macht den Lauf rot.

Der spätere echte Grant ist ein anderes Arbeitspaket: E-Mail einmalig sicher zu `user_id` und `workspace_id` auflösen und danach nur stabile IDs verwenden. Keine E-Mail gehört in SQL oder Architektur-IDs.

## Bildspeicher

Es existierte keine passende Storage-Policy. `20260920231000_chat_admin_profile_image_storage.sql` ist daher der kleinste **separate, unapplied** Vertrag: Er erstellt keinen Bucket, verlangt den bestehenden Bucket `chat-characters` ausdrücklich privat und bindet Objektpfade an `<workspace_id>/<character_id>/<filename>` sowie Capability, Owner und existierenden Character. Das gespeicherte Feld bleibt `chat-characters/<workspace_id>/<character_id>/<filename>`. Dieser Vertrag gehört nicht zum ChatAdmin-Schema-APPLY und benötigt später eigenen Review/Apply.

## Unveränderte Grenzen

Normale Creator, `creators.workspace_id UNIQUE`, normale Reply Suggestions, Registration, Admin CRM, Billing/Stripe, AI Cost Guard, Social und Mobile bleiben unverändert. Kein OnlyFans-Netzwerkaufruf, Scraping, Provider-Login oder automatisches Senden ist Teil des Rollouts. Der offene Production-Audit-Punkt `production_audit_backup_latest_stale_or_empty` bleibt ein separater Operations-Punkt und ist weder repariert noch ChatAdmin-Blocker.
