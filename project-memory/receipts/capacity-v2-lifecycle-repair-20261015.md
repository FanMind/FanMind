# Capacity v2 lifecycle source repair receipt

- Task: FM-AI-001 / FM-CR-052, existing continuation.
- Risk: R4 contract minimum; repository and isolated local PostgreSQL only.
- Base: dc269fd80407bfa2a3e1885e19e432b0ebaed68e.
- Branch: fix/capacity-v2-lifecycle-repair. Audit PR #1330 is separate.
- Controlled lifecycle SQL SHA-256: f9d59b2e85aac51cc09782f8a7eab63120beff5668c63aeeff1d949e5d2dea99.
- Source state: VERIFIED locally and independently counterchecked; GitHub exact-head CI/merge remain separately observable. Overall AI/Billing and target acceptance are not closed.

## Cause and bounded correction

The original grant function used undeclared v_policy and two nonexistent
parameters. Its policy block belonged in Reserve, where it was absent.
A real PostgreSQL 17.11 first-install reproduction failed with
`"v_policy" is not a known variable`. Native execution then exposed ambiguous
reservation_id references in Settle/reconciliation, also corrected here.

Reserve now atomically locks/checks policy and the dormant server-owned
Workspace entitlement projection, exact revision/package/period/time binding,
global/freeze/mode switches and immutable provider/price/FX provenance. Grants
have existing-Workspace binding and exact approved included-budget checks.
Terminal RPCs preserve recovery obligations after freeze/revoke, reject changed
settlement evidence and use consistent Workspace-before-reservation lock order.
No new refund/Stripe/customer price behavior is implemented.

The projection is RLS-protected, inactive by default and read-only to service_role;
no productive writer, Stripe resolver or route activation is provided. Its mere
presence is not canonical commercial entitlement. Those integrations and target
controls remain separate activation blockers. SQL is first-install-only, not a
migration-history backfill or automatic deploy step.

## Implementation evidence

- Existing CI-pinned postgres:17.11-trixie image, digest
  sha256:e38411452a464af89e5adadb8d223bf53b898d47d6ef918b2d58c08707350449.
- Local container started with --network none, no published ports and no provider credentials.
- Exact future Required command: npm run test:ai-capacity, with native-required=true and the existing local PG17 container transport.
- 48/48 tests passed: 15 existing Capacity policy, 11 existing/extended accounting/CI policy, and 22 actual PG17 lifecycle tests (parent plus 21 subtests). No native skip.
- Real SQL foundation/activation/lifecycle installation; grant/reserve/settle/release/indeterminate reconciliation, exact replays/conflicts, concurrent grants/reserves/settle-release, tenant/privilege negatives, freeze/revision, split/period rollover, missing usage, timeout/recovery, over-reservation durable hold and rollback after partial allocation.
- Lock barriers prove policy change, revocation, entitlement expiry and purchased expiry during a wait cannot bypass admission. A real CREATE OR REPLACE mutation removing the freeze guard makes the original negative assertion fail; restoration makes it pass again.
- Fresh test database removed and absence asserted by the runner.
- Build (webpack), generated-type TypeScript check, targeted lint, product/referral/legal-schema/Action-pin truth, Memory Quality, drift and God Mode preflight passed.
- Initial broad Operations runs exposed the stale imports created by renaming; those imports are removed now that the cases have explicit Required roots. Other local broad-suite failures were dirty-checkout, missing rsync and umask=0077 environment prerequisites. Final clean-checkout/GitHub results must be consumed separately, never claimed from these partial runs.

## Independent countercheck

Reviewer capacity_countercheck performed independent read-only SQL/adapter/CI
and documentation review and an independent actual PG17.11 run in a separate
database with distinct barrier application names. Final native result: 22/22,
zero fail/skip, successful database cleanup. Cost engine 13/13 and inventory 1/1
were independently rerun. Concrete findings for exact grant/entitlement bounds
and expiry while locks wait were fixed and negatively proven. No remaining
P0/P1/P2 in the bounded reviewed implementation/docs/CI delta.

The watched Source-of-Truth Git-blob fingerprint was independently checked.
This is source acceptance evidence, not a God Mode runtime ALLOW, protected
Staging authorization or commercial activation.

## Coordination and follow-up

Budget lock FM-CR-056 is reconciled as consumed by merged #1248. Existing
FM-CR-052 was resumed by this explicit repair request; open PR/legacy branch
inspection found no competing active Lifecycle scope. No second queue was made.
The first audit incorrectly described missing CI ownership: Capacity cases were
already indirectly imported by ai-cost-engine.test.mjs. That audit passage is
corrected separately on #1330. Here the existing cases are explicitly registered
and real native execution is mandatory, with stale imports removed.

Next target action after reviewed merge: prepare/review the missing checksum-
and exact-target-bound Capacity verifier/control; then a freshly authorized
Staging-only READONLY preflight of foundation/gates, absent new lifecycle/
projection/columns/old overload, empty monetary tables and all switches OFF.
See docs/operations/AI_CAPACITY_RESERVE_SETTLE.md for exact contract and blockers.
APPLY, synthetic target acceptance, canonical entitlement writer/Stripe mapping,
privacy/deletion inventory rollout, productive route wiring and audit D3
Top-up/Refund work remain separate. No old protected authorization is reused.
Recovery of this source package is an ordinary source revert; future target
writes require transactional recovery and preservation of monetary history.

No Production/Staging APPLY, provider call, real payment, customer migration,
product price change or Finishline change occurred.
