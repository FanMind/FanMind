# Support #1350: authenticated Creator capacity

Owner instruction: no timed Support/consent shutdown. Closing/reopening Help
does not revoke the persisted account choice. There is no 30-day usage ban.
Retention after an actual withdrawal remains a separate unresolved legal decision.

Authenticated AI Support must spend the authenticated Creator's capacity, never
the platform owner's balance. The existing conversation endpoint derives the
actor and Workspace, checks consent, rate and retained request IDs, and invokes
the existing Capacity reserve/settle/release runtime. The anonymous endpoint
retains its existing platform-owner operational attribution. Both use one
server-only provider transport and the existing bounded public Support
instructions. No CRM/Fan/Character content or billing identifiers enter the
provider payload. No second Support platform, consent store or export is added.

## Source behavior

- Reauthorize the active owning Creator before reading the existing canonical
  capacity entitlement projection and immediately before provider execution.
  The read is explicitly projected and filtered to that Workspace; reject
  absent/foreign/duplicate/inactive/expired/legacy rows. No projection writer,
  grant seed, package migration or monetary-table write is introduced.
- Reserve with a Workspace-scoped `support:<actor>:<requestId>` generation key,
  exact entitlement revision and authoritative billing period. Reuse the
  existing policy gates, pinned model/price catalog and included-first allocation.
  A replay that did not create a new reservation cannot call the provider again.
- Revalidate the current consent revision after reservation and before provider
  execution. Cancellation/account switch/withdrawal before execution releases
  the unused reservation. The conversation route rechecks consent/scope after
  completion before delivery or Support persistence.
- Settle real provider usage before returning an answer. The same accounting
  functions handle cached/reasoning categories and exact integer FX. Actual
  billable work is still settled if the account/consent changes while in flight;
  the result is suppressed by the conversation route. A failed delivery never
  makes real provider work free.
- Definitive request rejection releases. Network/timeout/server uncertainty
  retains an indeterminate hold; missing usage follows the existing indeterminate
  path. An unknown settlement reply is not refunded or automatically regenerated.
  Stored Support replies replay without a new generation. A charged result whose
  later conversation write failed needs the existing reconciliation/operator
  handling; this change does not pretend to recover an unpersisted answer.
- Monitoring records the actual Creator user/Workspace and Support route after
  settlement. Monitoring is best-effort and is not the monetary source of truth.
- Knowledge/catalogue replies without a provider call consume no AI capacity.
  No anonymous fallback or platform-owner subsidy is available to authenticated
  AI requests when entitlement, balance or accounting prerequisites are missing.

## Required protected rollout prerequisites — NOT ACTIVATED

This correction is **source only**. The existing Capacity-v2 lifecycle is not
the accepted active Production contract. See AI_CAPACITY_RESERVE_SETTLE.md and
AI_CAPACITY_BILLING_V2.md. The canonical entitlement writer/mapping, target
schema/postflight, lawful commercial treatment and actual reserve/settle
Staging acceptance remain separate. Do not deploy this corrected authenticated
AI path to a target lacking those prerequisites: it deliberately fails closed.
Keep the current approved live Support unchanged until a combined release is
reviewed. A PR merge is not permission for a target schema/apply/activation.

Protected server configuration also needs:

- `FANMIND_SUPPORT_AI_QUALITY_MODE`: one reviewed existing mode (`fast`,
  `balanced` or `premium`). No new model or automatic quality downgrade.
- `FANMIND_AI_CAPACITY_FX_SNAPSHOT`: reviewed JSON containing positive integer
  `eurPerUsdNanos`, immutable `version`, and UTC `validFrom`/`validUntil`.
  No default FX rate, client input or stale snapshot is accepted. The runtime
  stores the pinned FX basis with the reservation for later settlement.

These values are not configured by this change. No Production/Stripe/DB/secret
operation, monetary fixture, provider call or Retention mutation is authorized
by these source tests. At zero available balance new AI reservations are denied
under the existing commercial contract, while consent remains unchanged and
local Help remains available. This is not a timed Support shutdown.

## Validation and recovery

`tests/support-creator-capacity.test.mjs` is included in required `test:ai-capacity`.
It executes the real Capacity runtime, accounting, admission and shared provider
transport against isolated synthetic authorization/DB/provider adapters. Tests
cover identity/entitlement negatives, real usage settlement, duplicate concurrent
requests, cancellation/withdrawal, rejection versus unknown outcome, missing
usage and unsafe output. Existing public-route/consent/disclosure tests remain.
No synthetic adapter result is target installation or monetary live acceptance.

Affected contracts: FM-CONTRACT-AI-BILLING-001 / FM-IGATE-AI-BILLING-001, existing
auth/Workspace/AI-context and disclosure consumers. R4 source scope; all real
monetary/schema/release gates remain unsatisfied until separately evidenced.
Rollback is a source revert before release; after real reservations exist,
preserve ledger/holds and reconcile them with the original pinned evidence.
Never DROP monetary history or release an unknown outcome to make a retry pass.

Central PDF download remains under Profile & account → GDPR. The previously
observed Browser timeout is retained as an open Live-file proof; no duplicate
export or unnecessary Browser retry is part of this correction. Mobile live:
VERSCHOBEN – APP-ABNAHME; automated security/responsive checks remain required.
