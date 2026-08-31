# FM-MOB-005 — Nachrichten-Push + Production/Test-Datengrenze

- Started: 2026-08-31 Europe/Vienna
- Status: IN_PROGRESS
- Risk: R3
- Issue: #1049
- Branch: `feat/mobile-message-push-data-boundary-20260831`
- Base main: `91f92acd715a2bcc0a29e4bb715f8e9dc6997aa2`
- Lock: `LOCK-FM-MOB-005-MESSAGE-PUSH-DATA-BOUNDARY-20260831`

## Scope
1. Repositoryseitige Production/Test-Datengrenze explizit und maschinenprüfbar machen. Keine destructive Production-Datenbereinigung.
2. Bestehende dormant Mobile-Push-Grundlage um datenschutzarme `message_reminder`-Policy für ungesehene eingehende Nachrichten erweitern.
3. Sofort-Hinweis plus höchstens eine verzögerte Erinnerung als idempotente/aggregierte Policy vorbereiten; sichtbare Payload ohne Fanname, Nachrichtentext oder CRM-Inhalt.
4. Tap-Ziel authentifiziert an den betroffenen Fan und den Bereich `Nachrichten` binden.
5. Bestehenden Follow-up-Push-Vertrag erhalten; realer Provider-Send, Delivery-Ledger-Migration und Production-Aktivierung bleiben getrennte geschützte Gates.
6. Kein neuer Android-Build, keine Google-Play-/Store-Aktion.

## Evidence plan
- focused unit/policy tests including duplicate/seen/stale/wrong-workspace/wrong-environment fail-closed paths;
- source-of-truth + Push runbook + data-boundary documentation synchronized;
- exact PR-head CI/countercheck before merge;
- no provider/db/Production mutation claimed by this repository change.

## Rollback
Revert the bounded repository commit/PR. No database rows, provider state, signed artifact or Production runtime is mutated by this change.
