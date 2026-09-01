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

## Counterchecked repository result
- Production/Staging/test-data boundary is explicit and fail-closed: the selected target must equal an independently expected non-Production ref and differ from normalized Production; synthetic markers use a nonempty bounded ASCII namespace.
- Message push policy is Staging-only and currently Owner-only, with canonical workspace/user/registration/EAS/contact/message binding and recipient-specific idempotency.
- Initial notifications reject malformed, impossible, future and stale timestamps. Aggregation preserves PostgreSQL microsecond precision and uses UUID only for truly identical timestamps.
- A delayed reminder is allowed only after the terminal accepted initial-delivery state, within the bounded delay/freshness window, and at most once. Malformed falsy prior-delivery values fail closed instead of reopening an initial send.
- Android uses the dedicated `message-alerts` / `Nachrichten` channel.
- Native response parsing accepts only the minimal message payload, waits for authentication and opens the exact fan's `Nachrichten` section before consumption.
- `seen_at` is mutated only for the exact loaded contact while the settled `Nachrichten` route/section is displayed; load/refresh and route reuse cannot acknowledge messages from the wrong fan or from `Follow-ups`/`Kontaktwissen`.
- Root and canonical Mobile/Push readers are synchronized without claiming provider delivery, Delivery-Ledger Apply or Production activation.
- Redundant temporary checkpoint/marker files were removed. One accidental one-byte temporary marker created during the final connector session was immediately deleted on the same PR branch and is absent from the final diff; it caused no runtime/provider/database state change.

## Artifact boundary
The existing verified Android `1.0.0` AAB on `e96415035ffbe12f16dd3b81e13a5e62b2c4ac00` remains for the pending Google Play baseline and the already-defined baseline Android acceptance. It predates the new native message-notification handler and cannot prove `message_received` / `message_reminder` behavior.

Final real-device message-push acceptance requires a separately reviewed signed Android build bound to a source commit containing the merged handler, after the Push Staging resource/migration/rollback-only and atomic Delivery-Ledger gates are satisfied. That later protected build is outside this task's repository-only scope.

## Completion evidence required before merge
- all workflows triggered on the exact final PR head are terminal green;
- completed exact-final-head Codex/countercheck with zero unresolved valid finding;
- final changed-file/diff inspection remains inside the declared repository-only scope and contains no transient marker;
- no provider, database, Production, Store or signing mutation occurred.

## Exact next step
Complete the final-head CI/review/diff countercheck and merge #1050 only if every R3 gate remains green. After merge, re-read `main`, close #1049 for the repository-only scope, and keep real message-push delivery/device acceptance open under FM-MOB-001 and the later Delivery-Ledger/Staging gates.

## Rollback
Revert the bounded repository merge. No database rows, provider state, signed artifact or Production runtime is mutated by this change.
