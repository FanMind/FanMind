# FM-MOB-005 — Nachrichten-Push + Production/Test-Datengrenze

- Started: 2026-08-31 Europe/Vienna
- Closed: 2026-09-01 Europe/Vienna
- Status: ACCEPTED
- Risk: R3
- Issue: #1049 — CLOSED `completed`
- Implementation branch/PR: `feat/mobile-message-push-data-boundary-20260831` / #1050
- Final PR head: `09ec3c8a73d57f7a0f0552e6ba89440b27e89ec7`
- Squash merge: `953fcc56de0d02d5c2c5d41468226ba051624b53`
- Base main: `91f92acd715a2bcc0a29e4bb715f8e9dc6997aa2`
- Lock: `LOCK-FM-MOB-005-MESSAGE-PUSH-DATA-BOUNDARY-20260831` RELEASED through post-merge closeout.

## Scope
1. Repositoryseitige Production/Test-Datengrenze explizit und maschinenprüfbar machen. Keine destructive Production-Datenbereinigung.
2. Bestehende dormant Mobile-Push-Grundlage um datenschutzarme `message_received`-/`message_reminder`-Policy für ungesehene eingehende Nachrichten erweitern.
3. Sofort-Hinweis plus höchstens eine verzögerte Erinnerung als idempotente/aggregierte Policy vorbereiten; sichtbare Payload ohne Fanname, Nachrichtentext oder CRM-Inhalt.
4. Tap-Ziel authentifiziert an den betroffenen Fan und den Bereich `Nachrichten` binden.
5. Bestehenden Follow-up-Push-Vertrag erhalten; realer Provider-Send, Delivery-Ledger-Migration und Production-Aktivierung bleiben getrennte geschützte Gates.
6. Kein Android-Build und keine Google-Play-/Store-Aktion in diesem Repository-Change.

## Accepted repository result
- Production/Staging/test-data boundary is explicit and fail-closed: the selected target must equal an independently expected non-Production ref and differ from normalized Production; synthetic markers use a nonempty bounded ASCII namespace.
- Message push policy is Staging-only and currently Owner-only, with canonical workspace/user/registration/EAS/contact/message binding and recipient-specific idempotency.
- Initial notifications reject malformed, impossible, future and stale timestamps. Aggregation preserves PostgreSQL microsecond precision and uses UUID only for truly identical timestamps.
- A delayed reminder is allowed only after the terminal accepted initial-delivery state, within the bounded delay/freshness window, and at most once. Malformed falsy prior-delivery values fail closed instead of reopening an initial send.
- Reminder causality, freshness, due-time and expiry checks preserve PostgreSQL microsecond precision.
- Android uses the dedicated `message-alerts` / `Nachrichten` channel.
- Native response parsing accepts only the minimal message payload, waits for authentication and opens the exact fan's `Nachrichten` section before consumption.
- `seen_at` is mutated only for the exact loaded contact while the settled `Nachrichten` route/section is displayed; load/refresh and route reuse cannot acknowledge messages from the wrong fan or from `Follow-ups`/`Kontaktwissen`.
- Root and canonical Mobile/Push readers are synchronized without claiming provider delivery, Delivery-Ledger Apply or Production activation.
- Redundant temporary checkpoint/marker files were removed. One accidental one-byte temporary marker created during connector handling was immediately deleted before merge and is absent from the merged diff; it caused no runtime/provider/database state change.

## R3 acceptance evidence
- All eight workflows on exact final PR head `09ec3c8a73d57f7a0f0552e6ba89440b27e89ec7` completed `success`: Project Memory Guard `33493784038`, Project Memory Quality `33493784036`, Project Memory Status `33493784050`, Landing Language CI `33493784093`, FanMind CI `33493783962`, Browser E2E `33493784004`, CodeQL `33493783996`, Mobile CI `33493783974`.
- Exact-head Codex review completed at 2026-09-01T09:50:09Z.
- All inline review threads are resolved.
- Final PR inventory contains exactly 27 expected repository code/test/doc/Project-Memory files and no provider route/timer/worker, migration-apply, Production, Store or build activation.
- PR #1050 was squash-merged SHA-bound from the exact final head as `953fcc56de0d02d5c2c5d41468226ba051624b53`; merged `main` was re-read and contains the final microsecond-precise fail-closed policy.
- Issue #1049 was closed `completed` only for this bounded repository scope.

## Artifact / external acceptance boundary
The existing verified Android `1.0.0` AAB on `e96415035ffbe12f16dd3b81e13a5e62b2c4ac00` remains for the pending Google Play baseline and the already-defined baseline Android acceptance. It predates the new native message-notification handler and cannot prove `message_received` / `message_reminder` behavior.

Final real-device message-push acceptance requires a separately reviewed signed Android build bound to a source commit containing the merged handler, after the Push Staging resource/migration/rollback-only and atomic Delivery-Ledger gates are satisfied. Real provider delivery, Production push, Google Play and signed-device message-push acceptance remain OPEN under FM-MOB-001 / external acceptance and are not accepted by FM-MOB-005.

## Exact next step
Keep FM-MOB-005 closed. Do not reopen it for provider delivery or signed-device acceptance; continue those through FM-MOB-001 and the later Push Staging / Delivery-Ledger gates. Do not rebuild the existing Play-baseline AAB merely because this repository task is accepted.

## Rollback
Revert merge `953fcc56de0d02d5c2c5d41468226ba051624b53` if the bounded repository implementation must be withdrawn. No database rows, provider state, signed artifact or Production runtime was mutated by this task.
