# AI Capacity Reserve / Settle / Release

Status: repository source only. Not applied to Production. Staging rollout is a separate protected action.

This increment implements the atomic money-movement lifecycle required by AI Capacity v2. It consumes the versioned OpenAI price catalog accepted in PR #1242 but does not yet switch productive AI routes to Capacity-v2.

## Flow

1. Resolve the FanMind quality mode and pinned OpenAI model.
2. Resolve the exact OpenAI price version for model, processing tier, context class and time.
3. Convert the conservative provider-cost reservation from USD micros to EUR microcents using an explicit versioned FX snapshot.
4. Reserve capacity atomically from the Workspace balance.
5. Execute the provider request in the later route-wiring increment.
6. On a successful response, normalize billing-grade OpenAI usage and calculate the actual provider cost from the same price version.
7. Settle the actual amount and release the unused reservation.
8. On a definitive provider failure, release the reservation.
9. On timeout/unknown outcome, keep the full reservation in `indeterminate` until reconciled.
10. If actual cost exceeds the conservative reservation, persist `reconciliation_required`; do not silently overdraw the balance.

## Bucket order

Reservations consume:
1. the matching included billing-period grant first;
2. purchased capacity second.

Included grants are bound to the authoritative billing-period key and package. Purchased grants may outlive a monthly reset according to their own expiry.

## Atomicity and idempotency

`supabase/controlled/ai_capacity_reserve_settle.sql` provides service-role-only RPCs:

- `ai_capacity_grant_credit`
- `ai_capacity_reserve`
- `ai_capacity_settle`
- `ai_capacity_release`
- `ai_capacity_mark_indeterminate`

Workspace advisory locks serialize competing reservations. Grant and generation keys are idempotent. Reusing a key with different immutable parameters fails closed.

The append-only ledger remains immutable. Reservation/allocation projections may change state, but every monetary transition appends ledger evidence.

## Provider accounting

`src/lib/aiCapacityAccounting.mjs` uses actual OpenAI provider usage for settlement. Monitoring estimates from `ai_usage_events` are not accepted as billing-grade settlement input.

Provider prices are USD. Ledger capacity is EUR microcents. FX therefore must be supplied as an explicit integer snapshot:

- `eurPerUsdNanos`: EUR per USD scaled by 1,000,000,000;
- `fxVersion`: immutable snapshot identifier.

There is no default FX rate. Missing FX or missing provider usage fails closed.

## Runtime boundary

`src/lib/aiCapacityRuntime.ts` coordinates admission, pricing, reservation and settlement. It is intentionally not imported by the existing productive AI routes in this increment because:

- Capacity-v2 customer package entitlement is not yet the active Production contract;
- exact included package budgets are still unset;
- Production Capacity-v2 schema/activation gates remain off.

The next bounded increment may wire this coordinator into productive AI routes only for explicitly resolved `capacity_v2` Workspaces after Staging acceptance.


## Customer percentage display

The server-side balance snapshot exposes only the data needed to derive the customer meter:

`remaining_percent = floor(spendable_active_capacity * 100 / active_capacity)`

Spendable capacity excludes settled consumption and currently held reservations, including indeterminate and reconciliation-required reservations. The display therefore cannot claim money that is already committed to an in-flight or unresolved provider call.

The customer UI shows this as **AI-Kapazität: N %**. Raw provider prices, token categories and internal monetary values remain server/accounting details.

At 25% and 10% the UI may warn that capacity is running low. At 0%, AI is blocked. There is no free or throttled fallback reserve and no automatic downgrade to a cheaper model.
