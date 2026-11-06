# LOCK-FM-MOB-005-MESSAGE-PUSH-DATA-BOUNDARY-20260831

- Task: FM-MOB-005
- Status: RELEASED
- Holder: ChatGPT Mobile message-push/data-boundary continuation 2026-08-31 / 2026-09-01
- Implementation branch/PR: `feat/mobile-message-push-data-boundary-20260831` / #1050
- Final PR head: `09ec3c8a73d57f7a0f0552e6ba89440b27e89ec7`
- Squash merge: `953fcc56de0d02d5c2c5d41468226ba051624b53`
- Base main: `91f92acd715a2bcc0a29e4bb715f8e9dc6997aa2`
- Risk: R3
- Scope: repository-only message notification/reminder policy plus machine-checked Production/Staging/test-data boundary; no provider send, DB migration apply, Production mutation, Store action or Android rebuild.
- Counterchecked implementation: strict target/marker boundaries; Staging-only Owner message eligibility; recipient/workspace/device/EAS idempotency; bounded accepted-initial-delivery reminder semantics; strict timestamp/freshness plus PostgreSQL microsecond ordering and reminder causality; dedicated Android message channel; exact-fan authenticated navigation; exact-contact/settled-route `seen_at` acknowledgement; synchronized canonical readers.
- Release evidence: exact final head passed all eight triggered workflows; exact-head Codex review completed; zero unresolved review threads remained; the 27-file final diff stayed within declared repository scope; #1050 was squash-merged SHA-bound as `953fcc56de0d02d5c2c5d41468226ba051624b53`; merged `main` was re-read; issue #1049 was closed `completed` only for this bounded scope.
- Released: 2026-09-01 Europe/Vienna through post-merge Project Memory closeout.
- External boundary: real message provider delivery, Delivery-Ledger migration/apply, Push Staging mutation/acceptance, signed message-push build/device acceptance, Production activation and Store actions remain outside this released lock and stay open under FM-MOB-001 / external acceptance.
- Do not resume: a later delivery/ledger/device task requires its own Task ID/change scope/lock. Do not repeat already-resolved FM-MOB-005 review fixes or create another Android Play-baseline AAB.
