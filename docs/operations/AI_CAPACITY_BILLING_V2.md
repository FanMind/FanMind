# AI Capacity Billing v2

Status: DESIGN_ACCEPTED_IMPLEMENTATION_PENDING  
Owner decision date: 2026-09-30  
Risk: R4  
Registered contract: FM-CONTRACT-AI-BILLING-001  
Integration gate: FM-IGATE-AI-BILLING-001

## Product contract

FanMind replaces the former customer-facing AI Plus/Ultra add-on model with package-bound AI capacity.

- Base packages: EUR 99 / EUR 199 / EUR 312.
- Every package contains a monthly AI cost budget. Exact included budget values remain intentionally unset until measured FanMind usage and current provider pricing are reviewed.
- User-selectable quality modes: Fast, Balanced, Premium.
- Usage is charged internally from actual model/token/provider cost, not request count.
- Included monthly capacity expires at the end of the authoritative subscription billing period and is never carried forward.
- Separately purchased capacity is stored independently, survives the monthly reset and receives an explicit validity rule before activation.
- Consumption order: included monthly capacity first, purchased capacity second.
- A single generation may split atomically across both buckets when the included remainder is insufficient.
- Capacity top-ups target approximately 33% gross margin; no customer-facing top-up price is activated until the cost basis and tax/billing contract are accepted.
- Customer UI should expose AI capacity / remaining capacity. Internal accounting retains model, token categories, provider cost and monetary value.
- A later FanMind Auto mode may select the economically appropriate model while preserving the user's quality-mode choice.

## Current-active versus accepted target

The accepted target described here is not yet the active Production billing contract.

Current Production-compatible source may still contain Starter / KI Standard / KI Plus / KI Ultra terminology and legacy Stripe identifiers. Those are migration inputs only and must not be interpreted as the target product after this decision.

Until the v2 activation gates below are satisfied:
- no Production package is changed to EUR 99/199/312;
- no Plus/Ultra customer is automatically migrated;
- no AI-capacity top-up is sold;
- no package-budget value is invented;
- existing paid subscriptions keep their current contractual treatment.

## Migration boundary

Existing Standard/Plus/Ultra source is migration input, not the new product contract. It must not be deleted blindly.

Reuse:
- server-side model/price resolution;
- usage-event instrumentation;
- workspace isolation/RLS;
- existing cost calculation and provider-usage fields;
- existing Stripe/billing lifecycle controls where compatible.

Replace or supersede:
- customer-facing Plus/Ultra entitlement semantics;
- fixed paid AI tier add-ons;
- any assumption that request count is the billable unit.

## Authoritative package entitlement

Capacity may be created or reserved only from a server-owned, allowlisted mapping from the workspace's active commercial entitlement to exactly one approved base package.

Before every reservation, the server must atomically revalidate:
- workspace authorization;
- active subscription/package identity;
- authoritative Stripe Price/package mapping where Stripe-backed;
- billing-period identity and lifecycle state;
- cancellation, suspension, failed-payment and access restrictions;
- the currently approved included-budget value for that package.

Client/browser plan names, amounts, balances or package IDs are never authoritative.

## Monetary unit, precision and FX

The capacity ledger settles in EUR using a fixed-precision integer accounting unit smaller than one cent. The initial implementation contract uses EUR microcents: 1 EUR = 100,000,000 microcents. No floating-point arithmetic is permitted in ledger state.

Provider costs retain:
- provider billing currency;
- provider-native fixed-precision amount;
- pricing-table/version identifier;
- FX source/version when conversion to EUR is required;
- FX timestamp/effective period;
- converted EUR microcent amount before settlement.

Rounding occurs only at explicitly defined presentation/invoice boundaries, never per AI call in a way that can turn a non-zero cost into zero.

## Billing-period identity and reset

The included budget belongs to the authoritative subscription billing period, not to a calendar month.

Each period has an immutable unique key derived from the workspace entitlement plus exact UTC period_start and period_end instants. Reset/grant creation is idempotent on that period key.

Rules:
- no calendar-month reset for subscription-backed packages;
- included capacity expires at period_end;
- purchased capacity is not reset by a base-package period transition;
- plan changes create a new entitlement revision with explicit effective time;
- upgrades/downgrades do not retroactively rewrite settled usage;
- proration or mid-period allowance changes remain disabled until an explicit policy is owner-approved and tested;
- duplicate reset/grant workers cannot create duplicate allowance.

## Two-phase reservation and settlement

Actual output/reasoning cost is known only after provider completion, therefore capacity uses a two-phase idempotent lifecycle.

### 1. Reserve
Before the provider call, FanMind atomically reserves a conservative server-computed upper bound using the exact workspace, entitlement revision, quality-mode policy, model/provider allowlist and bounded request limits.

Reservation:
- is keyed by an immutable idempotency/generation key;
- may allocate across included and purchased capacity in required order;
- prevents concurrent requests from spending the same balance;
- fails closed when the combined available capacity is insufficient.

### 2. Settle
After a valid provider response with valid usage metadata, FanMind computes the actual provider cost from the pinned price/FX basis and atomically:
- settles the actual amount;
- releases unused reserved amount;
- records immutable allocation rows for every bucket used;
- records actual token/usage categories and pricing provenance.

### Failure and indeterminate recovery
- Definitive provider failure before billable completion releases the reservation idempotently.
- A timeout or unknown provider outcome moves the reservation to INDETERMINATE, not silently released or charged.
- INDETERMINATE reservations remain unavailable until reconciliation proves whether billable provider work occurred.
- Reconciliation is idempotent and may settle or release exactly once.
- No retry may create a second reservation for the same generation key.

## Missing or malformed usage data

If a provider response is successful or indeterminate but usage data required for actual cost calculation is missing, malformed, inconsistent or untrusted:
- the generation is not finalized as normally settled;
- the reservation moves to RECONCILIATION_REQUIRED / INDETERMINATE;
- the conservative reservation remains held;
- further delivery/charging behavior follows the fail-closed recovery path;
- no zero-cost settlement is permitted merely because usage metadata is absent.

## Required ledger contract

Balances are derived from immutable ledger events plus bounded materialized projections; mutable balance fields are never the audit source of truth.

Minimum logical states:
1. included_period_grant
2. included_reserved
3. included_settled
4. purchased_credit_grant
5. purchased_reserved
6. purchased_settled
7. purchase_reversal / dispute adjustment
8. reservation_release
9. reconciliation state

Every reservation/settlement records at least:
- workspace_id;
- entitlement revision and billing-period key;
- idempotency/generation key;
- quality mode;
- model/provider;
- input, cached-input, cache-write, output and reasoning token categories where available;
- pricing/FX version;
- reserved EUR microcents;
- settled EUR microcents;
- bucket allocations;
- occurred_at and terminal state.

Rules:
- reserve atomically before provider execution;
- settle/release atomically and idempotently;
- duplicate retries cannot double-reserve or double-charge;
- one generation may have multiple bucket allocation rows under the same idempotency key;
- purchased capacity is never erased by period reset;
- missing price or FX resolution fails closed;
- no browser/client value is authoritative for balance or entitlement.

## Purchased-capacity credit and reversal lifecycle

Purchased capacity is granted only from an immutable, idempotent billing event keyed to the authoritative Stripe payment/checkout/invoice event identity.

A repeated Stripe webhook cannot grant credit twice.

Refund, dispute or chargeback handling must append an immutable reversal/adjustment event; prior ledger history is never deleted or rewritten.

Policy before activation:
- unconsumed purchased capacity attributable to the reversed purchase becomes unavailable;
- already-consumed capacity is not retroactively deleted from AI usage history;
- any resulting negative commercial position is recorded as a reconciliation/debt state and handled by an explicit billing policy rather than silently changing historical usage;
- further top-up spending may fail closed while that reconciliation is unresolved.

## Quality-mode contract

Fast, Balanced and Premium are policy labels, not hard-coded provider model names. Server configuration maps each mode to an allowed model/service-tier policy. Premium may consume capacity faster because actual provider cost is higher.

No mode may bypass:
- workspace authorization;
- context/input safety limits;
- capacity reservation;
- cost logging;
- provider/model allowlists.

## Activation gates

Do not activate real paid capacity/top-ups until all are true:
- exact included budgets for EUR 99/199/312 are owner-approved from measured usage;
- current provider pricing and FX basis are pinned server-side;
- authoritative package/Price resolver is implemented and lifecycle-aware;
- atomic reserve/settle/release/reconcile ledger passes concurrency and idempotency tests;
- split-bucket allocation, missing-usage and indeterminate-outcome tests pass;
- authoritative billing-period/reset/plan-change tests pass;
- Staging schema/RLS/negative acceptance passes;
- Stripe top-up grant, webhook ordering/idempotency, refund/dispute/chargeback reversal lifecycle passes;
- FM-CONTRACT-AI-BILLING-001 / FM-IGATE-AI-BILLING-001 required evidence is satisfied at R4;
- Legal/Tax/receipt/invoice treatment is accepted for the intended seller/customer population;
- Production activation has a distinct current authorization.

## Non-goals for this increment

- no real Production payment activation;
- no invented included budget amounts;
- no automatic conversion of existing customers;
- no deletion of historical Plus/Ultra records needed for audit/migration;
- no client-side token/cost authority.
