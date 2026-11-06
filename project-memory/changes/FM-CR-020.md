# FM-CR-020 — Controlled Staging Billing write freeze

- Date: 2026-09-05
- Updated: 2026-09-07
- Status: SUPERSEDED
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

## Historical acceptance plan
1. Exact-head repository, Billing, Security and Project Memory gates pass.
2. Merge only through PR.
3. On isolated Staging only, explicitly set the freeze to `true` and deploy/restart the reviewed commit.
4. Prove new Checkout is blocked and a handled signed webhook remains retryable rather than silently projected.
5. Run the existing `stripe-billing-event-ledger-staging.yml` controlled apply on the exact reviewed `main` commit.
6. Enable only the documented capture-only ledger gates while canonical projection stays disabled.
7. Verify capture-only runtime, then remove the write freeze.
8. Complete canonical cutover/reconciliation and one current Staging lifecycle acceptance before any final projection/Production decision.

This plan is historical and must not be executed again as a sequence. The applicable bounded steps were completed by the later evidence below.

## Hard boundaries
- no Production environment change;
- no direct SQL bypass of the controlled ledger workflow;
- no invented Stripe snapshot or reconciliation;
- no automatic payment, refund, cancellation or webhook replay;
- no enabling Plus/Ultra from this change.

## Rollback
The freeze implementation remains revertible as application code, but the historical operational sequence above must not be replayed or reversed merely to revert documentation. Current Billing runtime state is governed by the later accepted evidence and exact current configuration; Production projection and paid-tier activation remain separately gated.

## Review continuation — 2026-09-06
The previous head's API-only freeze did not enforce the advertised shared boundary. The follow-up guards `createStripeCheckoutSession()` before loading the Stripe client and handles the fixed result in API, payment page, redirect route and internal admin checkout. The payment page displays the temporary maintenance message without a new payment link. Tests execute the actual shared module for both Starter plans and the internal test plan, prove zero provider access while frozen, and prove normal recovery after unfreeze. Deliberately removing the guard makes all three negative cases fail. Existing Stripe sessions are not expired by this switch. No payment, migration or runtime activation occurred in this repository correction alone.

## Fresh review and owner activation — 2026-09-06
The owner explicitly requested merge and Staging activation. Before merging, review `PRRT_kwDOSxGqmc6frbTm` identified that ledger Apply trusted the runbook instead of proving an active freeze. The follow-up shares the Staging deployment concurrency group with Apply, preserves existing freeze state by default, and requires an HTTPS exact-release/503/retry-code/version postcheck immediately before SQL. The same no-credential/no-plan runtime proof gates a frozen deployment's completion. Tests reject unfrozen/generic-maintenance/Production/old-or-changing-release results and malformed preserved state.

## Superseding completion evidence — 2026-09-07
- PR #1058 merged as `157983d62afce572bfdf79374a0a5c5fd096b7db`; Staging run `34032100988` / job `101483398784` proved the freeze active with exact-release HTTP `503`, `stripe_billing_write_frozen` and `Retry-After=60`.
- The controlled general Billing ledger was later installed on isolated Staging by Apply run `34040107219`.
- Durable capture proof `34043010578` passed and explicit unfreeze deployment `34043148548` passed. The old freeze proof is historical and must not be treated as current runtime state.
- Exact isolated-Staging deploy `34058028839` and rollback-only canonical Billing acceptance `34058118450` / job `101553652111` passed on `62e6a11858e85996af03f6740819b0fc6194b4a4` with rollout `PASS`, Billing ledger `verify`, cutover pending `0`, uninventoried `0`, full transaction rollback and cleanup `PASS`.
- AI-tier rollback acceptance `34039968946` / job `101504820898` separately passed its Plus -> Ultra/paused -> Starter/canceled ledger lifecycle, browser boundary and full rollback.

Therefore the freeze/apply/capture/unfreeze/canonical-acceptance plan in FM-CR-020 is **superseded and closed as an execution sequence**. Do not repeat it. Remaining AI/Billing work is only the genuinely open product/private quality-cost decisions, provider-side inbound/current lifecycle evidence not already covered, failed-payment/order/idempotency/conflict/downstream reconciliation where still unproven, Legal/Tax, Production runtime integration and explicit activation under their existing owner/external controls. Canonical Production projection and Plus/Ultra remain disabled; no live payment is authorized by this closeout.
