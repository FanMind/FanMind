# AI Capacity Billing v2

Status: DESIGN_ACCEPTED_IMPLEMENTATION_PENDING  
Owner decision date: 2026-09-30  
Risk: R3

## Product contract

FanMind replaces the former customer-facing AI Plus/Ultra add-on model with package-bound AI capacity.

- Base packages: EUR 99 / EUR 199 / EUR 312.
- Every package contains a monthly AI cost budget. Exact included budget values remain intentionally unset until measured FanMind usage and current provider pricing are reviewed.
- User-selectable quality modes: Fast, Balanced, Premium.
- Usage is charged internally from actual model/token/provider cost, not request count.
- Included monthly capacity expires at the monthly reset and is never carried forward.
- Separately purchased capacity is stored independently, survives the monthly reset and receives an explicit validity rule before activation.
- Consumption order: included monthly capacity first, purchased capacity second.
- Capacity top-ups target approximately 33% gross margin; no customer-facing top-up price is activated until the cost basis and tax/billing contract are accepted.
- Customer UI should expose AI capacity / remaining capacity. Internal accounting retains model, token categories, provider cost and monetary value.
- A later FanMind Auto mode may select the economically appropriate model while preserving the user's quality-mode choice.

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

## Required ledger contract

The implementation must provide an atomic workspace/month ledger before capacity enforcement can be enabled.

Minimum logical balances:
1. included_monthly_budget
2. included_monthly_consumed
3. purchased_capacity_available
4. purchased_capacity_consumed

Every charge records at least:
- workspace_id;
- idempotency key / generation reference;
- model/provider;
- input, cached-input, cache-write, output and reasoning token categories where available;
- resolved provider-cost basis;
- charged monetary cost;
- source bucket: included or purchased;
- occurred_at.

Rules:
- reserve/charge atomically before or with the provider operation so concurrent requests cannot overspend;
- duplicate/idempotent retries cannot double-charge;
- monthly reset only resets the included bucket;
- purchased capacity is never erased by monthly reset;
- missing price resolution fails closed for billable cost accounting;
- no browser/client value is authoritative for balance or entitlement.

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
- current provider pricing is pinned server-side;
- atomic ledger/RPC, idempotency, concurrency and reset tests pass;
- Staging schema/RLS/negative acceptance passes;
- Stripe top-up lifecycle and webhook ordering/idempotency pass;
- Legal/Tax/receipt/invoice treatment is accepted for the intended seller/customer population;
- Production activation has a distinct current authorization.

## Non-goals for this increment

- no real Production payment activation;
- no invented included budget amounts;
- no automatic conversion of existing customers;
- no deletion of historical Plus/Ultra records needed for audit/migration;
- no client-side token/cost authority.
