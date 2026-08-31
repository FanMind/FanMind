# FM-CR-011 — Nachrichten-Push + Production/Test-Datengrenze

- Date: 2026-08-31
- Related task: FM-MOB-005
- Related issue: #1049
- Status: IN_PROGRESS
- Risk: R3

## Request
Owner wants FanMind to use the waiting time for Google Play approval to finish the separation of Production and test data and add push reminders for incoming messages.

## Accepted scope
- keep current separate Production and Staging targets;
- make synthetic/test-data rules explicit and machine-checkable;
- no destructive Production cleanup in this change;
- add `message_reminder` policy on top of existing dormant push foundation;
- privacy-minimal notification content and direct fan/message navigation;
- immediate notification plus bounded single delayed reminder with aggregation/idempotency;
- preserve existing Follow-up reminder path;
- no provider send, DB migration apply, Production activation, Store submit/update or new Android build.

## Acceptance
Focused tests and fail-closed negatives, documentation/source-of-truth synchronization, exact-head CI and independent countercheck.
