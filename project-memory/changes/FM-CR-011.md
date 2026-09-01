# FM-CR-011 — Nachrichten-Push + Production/Test-Datengrenze

- Date: 2026-08-31
- Related task: FM-MOB-005
- Related issue: #1049
- Status: COUNTERCHECKED_MERGE_PENDING
- Risk: R3

## Request
Owner wants FanMind to use the waiting time for Google Play approval to finish the separation of Production and test data and add push reminders for incoming messages.

## Accepted scope
- keep current separate Production and Staging targets;
- make synthetic/test-data rules explicit and machine-checkable;
- no destructive Production cleanup in this change;
- add `message_received` plus at most one bounded `message_reminder` policy on top of the existing dormant push foundation;
- privacy-minimal notification content and authenticated exact-fan `Nachrichten` navigation;
- deterministic aggregation/idempotency and strict malformed/stale/future-state rejection;
- current message events are Owner-only until a per-recipient/member acknowledgement model exists;
- preserve the existing Follow-up reminder path;
- no provider send, DB migration apply, Production activation, Store submit/update or Android build.

## Counterchecked result
- Production/Staging/test-data separation is explicit and machine checked, including independent expected-target binding and ASCII-only synthetic marker namespaces.
- Message policy is Staging-only, recipient/workspace/device/EAS-bound, freshness-bounded, microsecond-stable for newest-message selection, and fails closed on malformed prior-delivery state.
- A delayed reminder requires a terminal accepted initial delivery and remains limited to one.
- Android message alerts use the dedicated `message-alerts` channel.
- Mobile tap handling authenticates and opens the exact fan's `Nachrichten` section before consuming the notification intent.
- `seen_at` is changed only for the exact loaded fan while the settled `Nachrichten` section is displayed; route reuse cannot acknowledge another fan early.
- Root/mobile product readers preserve the distinction between the existing Android `1.0.0` Play baseline AAB and the later signed build required for real message-push acceptance.

## Acceptance boundary
Repository implementation can reach `COUNTERCHECKED` after exact-final-head CI, completed exact-head review, zero unresolved valid review findings and final diff inspection. This change does not self-accept real provider delivery, a Delivery-Ledger migration, Production activation, Store state or signed-device message-push behavior.

## Rollback
Revert the bounded repository merge. No provider, database, Production, Store or signed-artifact state is mutated by this change.
