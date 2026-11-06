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
- exact included package budgets are owner-approved at EUR 15 / 30 / 50 for capacity_99 / capacity_199 / capacity_312;
- Production Capacity-v2 schema/activation gates remain off.

The next bounded increment may wire this coordinator into productive AI routes only for explicitly resolved `capacity_v2` Workspaces after Staging acceptance.


## Customer percentage display

The server-side balance snapshot exposes only the data needed to derive the customer meter:

`remaining_percent = floor(spendable_active_capacity * 100 / active_capacity)`

Spendable capacity excludes settled consumption and currently held reservations, including indeterminate and reconciliation-required reservations. The display therefore cannot claim money that is already committed to an in-flight or unresolved provider call.

The customer UI shows this as **AI-Kapazität: N %**. Raw provider prices, token categories and internal monetary values remain server/accounting details.

At 25% and 10% the UI may warn that capacity is running low. At 0%, AI is blocked. There is no free or throttled fallback reserve and no automatic downgrade to a cheaper model.


## Lifecycle repair — 15 October 2026

FM-AI-001 / FM-CR-052 repairs the grant compilation error and puts policy
revision/global/freeze/mode checks inside the workspace-serialized Reserve RPC.
The dormant `ai_capacity_workspace_entitlements` projection is the authoritative
workspace/contract/package/period/revision boundary. It has an existing-Workspace
foreign key, RLS, inactive-by-default state, an explicit capacity_v2 discriminator
and a source fingerprint. Browser roles have no access; service_role may only
read it. No projection writer, Stripe mapping or runtime activation is provided.
A separately reviewed canonical Billing projection must establish and maintain
this snapshot (including suspension/revocation); the table alone is not proof of
commercial entitlement and must not be populated from browser plan/amount data.

Reserve requires `p_expected_entitlement_revision`, locks the entitlement and
policy until transaction end, and rechecks current time after both lock waits.
Missing/inactive/future/expired/contradictory entitlement, changed revision,
disabled usage/mode or emergency freeze denies new reservation atomically.
A same-key included grant must match exact package/start/end. Included grants
must match the current approved budget on creation. Disabling new package sales
does not cancel already entitled usage. Purchased-credit acquisition/refund
business rules remain the separate audit D3 follow-up.

Reservations retain policy/entitlement revision and provider/model/price/FX
provenance. Reserve and settlement replays reject changed immutable evidence,
including usage changes and zero-cost settlement. Settle/release acquire the
Workspace lock before the reservation row lock. Existing obligations can still
settle/release after freeze or entitlement revocation. Reconciliation of an
indeterminate outcome uses the existing settle (actual validated usage) or
release (proven non-billable failure) RPC; it is not an automatic retry.
An actual amount above the held reservation persists reconciliation_required
and keeps the hold. It cannot be silently released or overdrawn; a future
reviewed monetary adjustment procedure remains separate.

`npm run test:ai-capacity` reuses the existing policy/accounting tests (now
.test.mjs) and the existing Docker/psql PostgreSQL-17 transport. The required
PG17 CI job sets FANMIND_CAPACITY_PG17_REQUIRED=true and supplies its isolated
source container. Missing/wrong container or wrong PostgreSQL major fails;
normal Operations runs may skip only the database-dependent parent. Tests
install the real controlled foundation, activation guard and lifecycle SQL in a
fresh local database, execute real concurrent sessions and remove the database.
They include an actual SQL guard mutation and lock-wait expiry/revocation tests.
No real provider or Supabase target is contacted.

## Next protected Staging action after reviewed merge

The next target action is a NEW exact-main, Staging-only read-only preflight on
vshyhvgcmrlagvfnvomc, explicitly different from Production drqkpdvtbbrrdwmtrodz.
Bind the merged SQL SHA-256, current release/target, workspace parent contract,
existing foundation and activation-gate object definitions/ACL/RLS, absent
lifecycle RPCs (including absence of the old Reserve overload), absent new
projection/columns, and zero reservations/allocations/ledger events. Verify the
15/30/50 budgets and all activation switches OFF with emergency freeze ON.
Do not read customer content. Any partial/drifted state blocks, not an APPLY.

The existing protected staging-database-rollout-state workflow now has an explicit
Capacity read-only scope reusing the pinned preparation query, evaluator and
recovery contract. Its only Capacity result is READONLY_BASELINE_MATCH or BLOCK;
it does not enter generic apply/skip classification. See
AI_CAPACITY_STAGING_READONLY_INTEGRATION.md. No Capacity apply controller exists;
do not invent a generic db-push or direct-psql APPLY command.
An eventual APPLY is a different, freshly authorized transaction; the lifecycle
SQL is first-install-only and deliberately refuses existing projection/column
state rather than backfilling missing monetary provenance. Reconcile source,
fixture cleanup, current backup/recovery and privacy/deletion inventory impacts
before such rollout. No policy readiness, entitlement row, provider call,
package/top-up sale or productive route is enabled by source merge or schema.

Recovery for this repository package is an ordinary source revert. Future
controlled target work must preserve the installed foundation and historical
ledger, use transactional rollback, and never silently drop monetary history.
