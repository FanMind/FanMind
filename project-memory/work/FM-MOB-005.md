# FM-MOB-005 — Nachrichten-Push + Production/Test-Datengrenze

- Started: 2026-08-31 Europe/Vienna
- Status: COUNTERCHECKED_MERGE_PENDING
- Risk: R3
- Issue: #1049
- Branch: `feat/mobile-message-push-data-boundary-20260831`
- Base main: `91f92acd715a2bcc0a29e4bb715f8e9dc6997aa2`
- Lock: `LOCK-FM-MOB-005-MESSAGE-PUSH-DATA-BOUNDARY-20260831`

## Scope
1. Repositoryseitige Production/Test-Datengrenze explizit und maschinenprüfbar machen. Keine destructive Production-Datenbereinigung.
2. Bestehende dormant Mobile-Push-Grundlage um datenschutzarme `message_received`-/`message_reminder`-Policy für ungesehene eingehende Nachrichten erweitern.
3. Sofort-Hinweis plus höchstens eine verzögerte Erinnerung als idempotente/aggregierte Policy vorbereiten; sichtbare Payload ohne Fanname, Nachrichtentext oder CRM-Inhalt.
4. Tap-Ziel authentifiziert an den betroffenen Fan und den Bereich `Nachrichten` binden.
5. Bestehenden Follow-up-Push-Vertrag erhalten; realer Provider-Send, Delivery-Ledger-Migration und Production-Aktivierung bleiben getrennte geschützte Gates.
6. Kein Android-Build und keine Google-Play-/Store-Aktion in diesem Repository-Change.

## Implemented result
- Production/Staging/test-data boundary is explicit and machine checked; Production formatting variants fail closed.
- Message push policy is Staging-only, recipient-bound, freshness-bounded, deterministic and limited to one reminder.
- Native notification handling validates the minimal payload, waits for authentication and opens the exact fan's `Nachrichten` section before consuming the intent.
- Canonical Mobile and Push documentation is synchronized without claiming provider delivery or Production activation.
- Redundant temporary checkpoint/marker files were removed before final merge.

## Artifact boundary
The existing verified Android `1.0.0` AAB on `e96415035ffbe12f16dd3b81e13a5e62b2c4ac00` remains for the pending Google Play baseline and the already-defined baseline Android acceptance. It predates the new native message-notification handler and cannot prove `message_received` / `message_reminder` behavior.

Final real-device message-push acceptance requires a separately reviewed signed Android build bound to a source commit containing the merged handler, after the Push Staging resource/migration/rollback-only and atomic Delivery-Ledger gates are satisfied. That later protected build is outside this task's repository-only scope.

## Completion evidence required before merge
- all exact-final-head GitHub workflows terminal green;
- completed exact-final-head Codex/countercheck with no unresolved valid finding;
- final changed-file/diff inspection remains inside the declared repository-only scope;
- no provider, database, Production, Store or signing mutation occurred.

## Rollback
Revert the bounded repository merge. No database rows, provider state, signed artifact or Production runtime is mutated by this change.
