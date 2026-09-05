# FM-CR-020 — Controlled Staging Billing write freeze

- Date: 2026-09-05
- Status: IN_PROGRESS
- Source: owner continuation authorization
- Related task: FM-AI-001 / FM-AI-OWNER-002
- Risk: R3

## Request
The owner prioritized completion of registration/login, Stripe/Abo and the Google Play handoff after the signed Android Preview and Push acceptance. The existing general Stripe Billing Event Ledger runbook requires an explicit Billing write freeze before the controlled Staging apply, but the runtime did not expose one common fail-closed switch for Checkout creation and legacy webhook Workspace projection.

## Duplicate check
- Reuse the existing general Billing Event Ledger control, checksum-pinned SQL, Staging-only apply workflow and capture-only cutover contract.
- Do not create a second ledger, second webhook path or alternate payment lifecycle.
- The AI-tier ledger remains separate and unchanged.

## Bounded implementation
Introduce the server-only runtime switch `FANMIND_STRIPE_BILLING_WRITE_FREEZE` with default/off semantics.

When and only when it is exactly `true`:
- new authenticated Checkout creation returns a retryable `503` before Stripe Session creation;
- the legacy Workspace Billing projection returns the existing retryable decision so a verified Stripe webhook is not acknowledged as successfully projected during the freeze;
- no Production activation, Stripe resource mutation, database migration or payment is performed by this repository change alone.

The switch exists only to make the documented Staging SQL-apply -> capture-only transition operationally safe. It is not a maintenance-mode feature for normal operation and must be returned to `false` after the capture-only runtime is verified.

## Acceptance plan
1. Exact-head repository, Billing, Security and Project Memory gates pass.
2. Merge only through PR.
3. On isolated Staging only, explicitly set the freeze to `true` and deploy/restart the reviewed commit.
4. Prove new Checkout is blocked and a handled signed webhook remains retryable rather than silently projected.
5. Run the existing `stripe-billing-event-ledger-staging.yml` controlled apply on the exact reviewed `main` commit.
6. Enable only the documented capture-only ledger gates while canonical projection stays disabled.
7. Verify capture-only runtime, then remove the write freeze.
8. Complete canonical cutover/reconciliation and one current Staging lifecycle acceptance before any final projection/Production decision.

## Hard boundaries
- no Production environment change;
- no direct SQL bypass of the controlled ledger workflow;
- no invented Stripe snapshot or reconciliation;
- no automatic payment, refund, cancellation or webhook replay;
- no enabling Plus/Ultra from this change.

## Rollback
Unset `FANMIND_STRIPE_BILLING_WRITE_FREEZE` (or leave it absent) and revert this PR if necessary. The default remains normal legacy behavior until the separately controlled ledger cutover is authorized and executed.
