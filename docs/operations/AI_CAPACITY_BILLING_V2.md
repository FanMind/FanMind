# AI Capacity Billing v2

Status: DESIGN_ACCEPTED_IMPLEMENTATION_PENDING  
Owner decision date: 2026-09-30  
Risk: R4  
Registered contract: FM-CONTRACT-AI-BILLING-001  
Integration gate: FM-IGATE-AI-BILLING-001

## Product contract

FanMind replaces the former customer-facing AI Plus/Ultra add-on model with package-bound AI capacity.

- Base packages: EUR 99 / EUR 199 / EUR 312.
- Setup / installation fee: EUR 0 for every Capacity-v2 base package. The former one-time setup/pilot products are retired for new business.
- Live Stripe catalog prepared on 2026-09-30:
  - capacity_99 -> `price_1ULRNOAOA7p70TO9Y8Vf6J3d`
  - capacity_199 -> `price_1ULRNVAOA7p70TO9obAZlCZM`
  - capacity_312 -> `price_1ULRRQAOA7p70TO9Y7UWOP2g`
  These Price objects are catalog inputs only until the remaining activation gates are accepted.
- Every package contains an owner-approved monthly AI cost budget for the authoritative billing period:
  - EUR 99 package -> EUR 15 included AI cost budget;
  - EUR 199 package -> EUR 30 included AI cost budget;
  - EUR 312 package -> EUR 50 included AI cost budget.
  These are starting commercial allowances and may be reviewed later from measured billing-grade usage without retroactively rewriting settled periods.
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
- package budgets use only the owner-approved EUR 15 / 30 / 50 values;
- existing paid subscriptions keep their current contractual treatment.
- every Workspace is resolved through an immutable billing-contract discriminator (`legacy_v1` or `capacity_v2`); absence/ambiguity fails closed and never auto-migrates a legacy subscription.
- `legacy_v1` continues to use the existing Starter/Plus/Ultra resolver until that exact Workspace is explicitly migrated; `capacity_v2` alone may use the 99/199/312 capacity resolver.

## Migration boundary

Existing Standard/Plus/Ultra source is migration input, not the new product contract. It must not be deleted blindly.

The historical 990-EUR Pilot/Setup and Starter-Setup products and the historical Starter 312-EUR product were retired from new sale in Stripe on 2026-09-30 by marking their Products inactive. Existing subscription/audit references remain migration evidence and are not rewritten.

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
- a reservation remains permanently bound to the exact originating period grant even when settlement/reconciliation happens after `period_end`; it may settle/release only against that originating grant and can never debit the next period's included allowance.
- expiry prevents new reservations from an old included grant but does not erase or invalidate already-created reservations or their reconciliation duty.

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

## Referral coexistence

The existing referral program remains a legacy-v1 commercial rule while the capacity-v2 package mapping is introduced.

- `legacy_v1` keeps the current documented Starter referral treatment until separately changed.
- No EUR 99/199/312 capacity-v2 base package is referral-discount eligible by inference.
- Capacity-v2 referral eligibility is **UNDECIDED / default-off** until the Owner explicitly maps eligibility for each target package and the Referral/Billing/Legal readers are reconciled.
- AI capacity top-ups are not referral-discount eligible unless a later explicit decision says otherwise.
- The package resolver must never reuse the legacy EUR-312 referral rule for capacity-v2 merely because one target package has the same numeric price.

## Platform-Admin control contract

The AI-capacity product is server-owned and must be operable from the existing FanMind Platform-Admin area without editing environment variables or customer records by hand.

Admin controls are split into global and package policy. Every mutation requires Platform-Admin authorization, same-origin protection, immutable audit evidence and server-side validation.

Required controls:
- global AI-capacity admission: on/off for new capacity-backed usage;
- Fast, Balanced and Premium modes: independently on/off, with at least one allowed mode required before capacity-backed AI can be enabled;
- top-up sales: on/off independently from ordinary included-capacity usage;
- each base package (EUR 99 / 199 / 312): independently on/off for new commercial admission;
- included AI budget for each package: configurable only after the budget value is owner-approved; unset remains fail-closed;
- top-up products/amounts: separately enabled only after price, margin, Tax and Stripe lifecycle gates pass;
- emergency spend freeze: blocks new reservations immediately without deleting balances, usage history or existing commercial records.

Semantics:
- switching a package off stops new admission; it does not silently cancel or rewrite existing subscriptions;
- switching top-ups off stops new purchases but does not erase already purchased capacity;
- switching a quality mode off prevents new reservations in that mode but never rewrites settled generations;
- global/emergency off blocks new AI reservations while preserving ledger and reconciliation state;
- no Admin switch may bypass Legal/Tax, Stripe, package-entitlement, balance, model allowlist or Staging/Production activation gates;
- every Admin change records actor, timestamp, previous value, new value and policy revision;
- browser-provided package IDs, balances, prices, provider models or monetary amounts are never trusted directly.

The first implementation may prepare these controls and persistence default-off. Production activation remains a separate protected action.

## Activation gates

Do not activate real paid capacity/top-ups until all are true:
- exact included budgets for EUR 99/199/312 are owner-approved (EUR 15 / 30 / 50 respectively);
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


## Versioned OpenAI provider price catalog

FanMind now pins provider model selection and OpenAI token prices in
`src/config/openAiPriceCatalog.mjs`; the human-readable source record is
`docs/operations/OPENAI_PRICE_CATALOG.md`.

Current customer-mode mapping is:
- Schnell -> `gpt-6-luna` with low reasoning;
- Ausgewogen -> `gpt-6.1-sol` with medium reasoning;
- Premium -> `gpt-6-astra` with max reasoning.

These labels are stable customer concepts; model IDs are versioned server-side
implementation details. Premium means the strongest suitable model explicitly
approved in the current FanMind catalog version, never an unpinned provider
`latest` alias. A later better model requires a reviewed catalog-version
change before Premium moves.

All three profiles currently use OpenAI Standard processing. FanMind "Schnell"
must not be confused with OpenAI Fast processing. Unsupported processing tiers,
regional uplifts or missing price versions fail closed.

The provider-cost resolver distinguishes short and long context at OpenAI's
published >272,000 input-token boundary and returns exact integer USD
micro-units. This catalog becomes the provider price source for the subsequent
Reserve -> Settle/Release -> capacity-consumption runtime increment.


## Customer capacity display and exhaustion behavior

The customer-facing balance is shown as **remaining AI capacity in percent**. FanMind does not expose raw token balances as the primary commercial meter because Schnell, Ausgewogen and Premium have materially different provider costs for the same token count.

- 100% means the full currently active spendable Capacity-v2 balance is available.
- Reserved, indeterminate and reconciliation-required amounts are treated as unavailable until released or settled.
- Included and purchased capacity are combined for the visible percentage, while the ledger keeps their accounting buckets separate.
- The percentage is rounded down so FanMind never overstates remaining capacity.
- The same percentage pool funds both communication analysis and reply generation.
- The user's selected quality mode determines how quickly the percentage falls because actual provider cost is charged.

**There is no free or throttled reserve.** At 0%, new Capacity-v2 AI reservations are denied. The user must either obtain additional paid capacity or wait for the next authoritative billing-period grant. FanMind does not silently downgrade Premium/Ausgewogen to Schnell at exhaustion and does not continue AI work for free.
