# LOCK-FM-MOB-005-MESSAGE-PUSH-DATA-BOUNDARY-20260831

- Task: FM-MOB-005
- Status: ACTIVE_MERGE_PENDING
- Holder: ChatGPT Mobile message-push/data-boundary continuation 2026-08-31 / 2026-09-01
- Branch/PR: `feat/mobile-message-push-data-boundary-20260831` / #1050
- Base main: `91f92acd715a2bcc0a29e4bb715f8e9dc6997aa2`
- Risk: R3
- Scope: repository-only message notification/reminder policy plus machine-checked Production/Staging/test-data boundary; no provider send, DB migration apply, Production mutation, Store action or Android rebuild.
- Counterchecked implementation: strict target/marker boundaries; Staging-only Owner message eligibility; recipient/workspace/device/EAS idempotency; bounded accepted-initial-delivery reminder semantics; strict timestamp/freshness and PostgreSQL microsecond ordering; dedicated Android message channel; exact-fan authenticated navigation; exact-contact/settled-route `seen_at` acknowledgement; synchronized canonical readers.
- Merge gate: keep this lock active until #1050 has terminal-green exact-final-head CI, completed exact-head review, zero unresolved valid review finding and clean final diff, then merge SHA-bound and release through post-merge Project Memory reconciliation.
- External boundary: real message provider delivery, Delivery-Ledger migration/apply, Push Staging mutation/acceptance, signed message-push build/device acceptance, Production activation and Store actions remain outside this lock.
- Resume from: issue #1049, `project-memory/work/FM-MOB-005.md` and `project-memory/receipts/FM-MOB-005-20260831.md`; do not repeat already-resolved review fixes or create another Android baseline AAB.
