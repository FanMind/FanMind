# FM-CR-011 — Nachrichten-Push + Production/Test-Datengrenze

- Date: 2026-08-31
- Closed: 2026-09-01
- Related task: FM-MOB-005
- Related issue: #1049 — CLOSED `completed`
- Status: ACCEPTED
- Risk: R3
- PR: #1050
- Final PR head: `09ec3c8a73d57f7a0f0552e6ba89440b27e89ec7`
- Squash merge: `953fcc56de0d02d5c2c5d41468226ba051624b53`

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

## Accepted repository result
- Production/Staging/test-data separation is explicit and machine checked, including independent expected-target binding and ASCII-only synthetic marker namespaces.
- Message policy is Staging-only, recipient/workspace/device/EAS-bound, freshness-bounded, and PostgreSQL-microsecond-precise for newest-message selection plus reminder causality/due/expiry checks.
- Malformed prior-delivery state fails closed; a delayed reminder requires a terminal accepted initial delivery and remains limited to one.
- Android message alerts use the dedicated `message-alerts` channel.
- Mobile tap handling authenticates and opens the exact fan's `Nachrichten` section before consuming the notification intent.
- `seen_at` is changed only for the exact loaded fan while the settled `Nachrichten` section is displayed; route reuse cannot acknowledge another fan early.
- Root/mobile product readers preserve the distinction between the existing Android `1.0.0` Play baseline AAB and the later signed build required for real message-push acceptance.
- Exact final head passed all eight triggered workflows, exact-head Codex review completed, and all review threads were resolved before SHA-bound squash merge.

## Acceptance boundary
FM-CR-011 / FM-MOB-005 is `ACCEPTED` only for this repository implementation scope. It does not accept or activate real provider delivery, a Delivery-Ledger migration/apply, Push Staging mutation/acceptance, Production push, Store state or signed-device message-push behavior. Those remain separate FM-MOB-001 / external acceptance gates.

## Rollback
Revert squash merge `953fcc56de0d02d5c2c5d41468226ba051624b53`. No provider, database, Production, Store or signed-artifact state was mutated by this change.
