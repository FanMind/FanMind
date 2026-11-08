# Sandbox data-package lifecycle — 8 November 2026

Scope: FM-CONTRACT-AI-BILLING-001 / FM-IGATE-AI-BILLING-001, R4.
Source implementation and target acceptance are separate. Existing products,
prices, policy, balance reader and purchased-credit RPC are reused.

## Existing versus corrected

Starting main: d51bc747bfea55c4882b051b24868696ea6da030. The previous PR #1442
already verifies eight configured test prices and binds the four Staging GitHub
environment mappings. Catalog and webhook-endpoint read-only checks passed;
neither executes a payment or writes capacity. There was no top-up Checkout.

| Package | EUR net sale | EUR provider capacity | Ledger microcents |
| --- | ---: | ---: | ---: |
| Datenpaket 10 | 14.99 | 10 | 1,000,000,000 |
| Datenpaket 25 | 37.49 | 25 | 2,500,000,000 |
| Datenpaket 50 | 74.99 | 50 | 5,000,000,000 |
| Datenpaket 100 | 149.00 | 100 | 10,000,000,000 |

The previous Top-up policy used 1,000,000 units/EUR instead of the Capacity
ledger's 100,000,000 units/EUR. Amounts now match the existing included-budget
and accounting contract. No historical grant is rewritten. Staging has zero
grants at the read-only observation.

## Checkout and authorization

`POST /api/billing/topup` accepts only a package key and UUID request identity.
Client Workspace, credit, price and amount fields have no authority. It requires
same-origin mutation, bounded body, authenticated non-demo Workspace Owner,
current server-side payment terms, shared rate limit, no billing freeze,
active paid Workspace and current server-owned capacity_v2 entitlement. The
existing policy must enable capacity and top-up sales with emergency freeze off.

The implementation is structurally restricted to the existing Staging hostname
and a test Stripe key. Production and live keys cannot create this Checkout.
It retrieves the allowlisted existing Price with Product and validates amount,
EUR, one_time, exclusive, metadata, provider value and an explicit product tax
code. It verifies active Sandbox tax settings and at least one active Sandbox
registration in addition to the existing tax readiness gate. No registration
or classification is created or inferred from these checks. Customer-address
taxability remains part of the actual transaction acceptance.

Checkout uses payment mode, quantity one, no promotion codes, dynamic payment
methods, an explicit existing Customer, Workspace client_reference_id and
matching explicit Session and PaymentIntent metadata. The stable Workspace/
request idempotency key makes retrying the same attempt safe; separate purchases
need distinct attempts. There is no Subscription, saved off-session payment
request or automatic repurchase. The browser return page grants nothing.

Four package choices appear only on Staging in the existing AI usage settings;
they remain disabled while admission is closed. Only sale prices reach this UI.

## Fulfillment

The existing signed webhook delegates marked purchases before generic billing
projection. Both checkout.session.completed and async_payment_succeeded use
canonical retrieved Session, expanded line items and PaymentIntent. Unpaid or
failed events grant nothing. Validation binds the stored Customer mapping to
the explicit Workspace and checks test mode, payment mode, no Subscription,
one configured line at quantity one, metadata, EUR, exact net subtotal, zero
discount/shipping, total = subtotal + tax and succeeded/received PaymentIntent
amount. Tax never becomes capacity. Missing reads or grant failures return
retryable 503/no-store; no raw provider/database messages are exposed.

The purchased grant key is the PaymentIntent identity, independent of event ID,
so sync/async/replayed/concurrent events use the existing atomically locked RPC
once. No current sales switch is required to fulfill an already paid purchase;
the global billing write freeze still blocks grant/reversal writes.

Marked Session/PaymentIntent/refund events do not mutate the base Subscription,
last invoice, billing suspension/access or Referral projection. Untagged base,
Daily, invoice, subscription and tax events retain their original handler.
Refund classification uses canonical PaymentIntent metadata; an untagged base
payment is never sent to the capacity reversal RPC.

The existing conservative refund/dispute rule revokes remaining unconsumed,
unreserved capacity, including for a partial refund. It does not reconstruct
consumed/held debt or restore a won dispute. A grant replay after a canonical
refund/dispute is denied. Out-of-order risk events before grant require
reconciliation; no fabricated grant or destructive repair is used. Full
proportional refund/debt/dispute recovery acceptance remains a separate gate
before any commercial activation.

## Executed tests and limits

- Actual module execution covers all four sale/provider amounts, taxed and
  zero-tax totals, async completion/failure, shared PI identity, environment,
  taxonomy/registration, amounts, currencies, metadata, customer/Workspace,
  quantity and refunded/disputed replay negatives.
- Transpiled actual API routes test CSRF, anonymous/member/terms/rate/freeze
  denial, bounded input, ignored client commercial authority, real synthetic
  HMAC signature verification, no base/referral side effects and grant failure
  -> retry behavior.
- The existing required isolated PostgreSQL17 CI suite now executes this
  fulfillment against the real grant RPC and tests durable/concurrent replay,
  exact provider-value balance and immutable changed-amount rejection.
- Synthetic provider responses are not a hosted Stripe Checkout or real webhook
  delivery receipt. A skipped local PG parent is not a database proof; required
  CI is authoritative for that isolated database test.

## Actual Staging blockers

Read-only target: existing FanMind Staging vshyhvgcmrlagvfnvomc; Production
drqkpdvtbbrrdwmtrodz was not written. Entitlement projection, grant RPC and
reverse RPC are absent; grants=0. Policy revision2 has 15/30/50 EUR budgets,
all capacity/sales/quality/readiness switches false and emergency freeze true.

The unchanged pinned Capacity preflight reports BLOCK: schema digest
b598194f234d2510930c605a5ba5251b differs from the reviewed reference
e3b71e6b343c161ebabf1fc34739a837, including budget-default differences and two
historical name-only migration markers:

- 20260930153422 / ai_capacity_billing_v2_base_20260930;
- 20260930153430 / ai_capacity_billing_v2_activation_gates_20260930.

Provider-normalized function security and RLS/ACL checks pass. These markers
and differences must be reconciled with their actual historical definitions,
not deleted or changed to manufacture a baseline match. No controlled Capacity
APPLY controller exists. The registered recovery contract additionally requires
exact reviewed-main/target/TLS/checksum binding, current backup/recovery,
privacy/deletion coverage, one-transaction precondition/body/postcondition and
rollback proof before first installation. A normal app deployment cannot do it.

The new runtime files also require the four STRIPE_PRICE_TOPUP_* values on the
Staging host; their GitHub environment presence alone does not install them in
the host's protected runtime file. Product tax-code classification remains open,
as do operator Steuernummer/UID and real payment/grant/consumption acceptance.
No tax/legal/activation flag is changed by this source package.

Recovery: reviewed source revert. Keep target schema/history and provider
objects intact; no down migration or deletion of payment history.
