# Capacity v2 protected read-only integration — source receipt

- Existing task FM-AI-001 / FM-CR-052, same lock/continuation, R4 contract minimum.
- Live main checked: dc269fd80407bfa2a3e1885e19e432b0ebaed68e.
- PR1331 remains OPEN, not merged, exact e9df302f1fd066e8396a385d875c1ff3f669f152.
- Reused preparation:38c15520376c35d3fedf8fd547b322221def755b, original manifest
  f81fd4e0f4bb1f3f0539805d9b90a9b54c6bf4ba63db07cf4251cc0439ba8725.
- Branch feat/capacity-v2-staging-readonly; dependent development PR, no merge.
- Contract/gate FM-CONTRACT-AI-BILLING-001 / FM-IGATE-AI-BILLING-001.

## Implementation boundary

The existing staging-database-rollout-state workflow/runner owns the explicit
Capacity scope, existing protected environment/concurrency/passfile/client and
cleanup. No alternate workflow, database client or authorization route is added.
Capacity bypasses generic action derivation and emits only READONLY_BASELINE_MATCH
or BLOCK. Current main is fetched before credentials/query; exact source/target,
committed blobs, nested manifests, CA, strict environment, response shape/labels,
private exact-entry passfile,45s SIGKILL timeout and64KiB buffers are enforced.

The original query,28-test file, policy/catalog expected values, controlled SQL
and recovery bytes are unchanged. The preparation manifest is cryptographically
normalized against its original digest allowing only the emitter hash update.
That necessary interface correction uses the fixed reviewed three-SQL hash
vector plus current/committed HEAD equality rather than e9 ancestry, preserving
source identity across normal/squash merges and shallow CI checkouts.

## Verification and independent evidence

- Local implementation5252d2f980a3c34b6f3efe86251a28280c26c5d4.
- 31/31 new CLI/source/target/TLS/CA/checksum/live-main/shape/timeout/output/passfile
  and cleanup tests passed; local transport doubles only, no real endpoint.
- 20/20 existing shared rollout regression tests passed; Required inventory1/1.
- 28/28 original native PG17.11 preparation tests passed,0 failures/skips; existing
  CI-pinned image and --network none local container, synthetic DB/roles only.
  DB/observer cleanup asserted. Older lifecycle suite not manually repeated.
- Targeted ESLint, offline nested-control verification, Memory Quality, drift,
  selector and Memoryv8 checks passed. Exact GitHub Required CI is separate and
  must be consumed from the published final head, not inferred from local tests.
- Independent reviewer capacity_countercheck reran31/31 new tests and20/20 shared
  regressions; independently inspected exact implementation/source/docs and
  unchanged original query/tests. P1 inherited secrets in the psql --version
  child was fixed using the same safe environment and proved by its own captured
  child environment. Final bounded source review: PASS, no open P0/P1/P2.

No target query, Staging mutation, SQL apply, Production access, Stripe/provider
call, payment, customer/price/Finishline change, merge or workflow dispatch was
performed. Historical authorizations remain historical and are not consumed.
No second queue/task registry is created. Audit1330 and D3 top-up/refund remain
separate. Productive entitlement writer/Stripe mapping/routes remain unaccepted.

## Handoff and recovery

The dependent PR includes already reviewed1331/preparation ancestry while those
sources are not on main. Review the integration delta against38c15520; do not
rebuild the dependency or merge this increment ahead of1331. Future retargeting/
rebase/merge requires current head/main/Required-check reconciliation.

Only after reviewed source merges and a NEW protected authorization bound to the
then-current merged main/controller/query/recovery checksums and exact Staging
target may the first scope=capacity read-only preflight be dispatched. No approval
for that action is provided here. A baseline match never authorizes Apply or
activation; any deviation blocks. Runtime/release context remains separate proof.
Recovery is reviewed source revert, session ROLLBACK and local password cleanup;
the pinned recovery contract preserves monetary history and offers no drop/down
or automatic repair. Apply needs a separate future reviewed atomic controller
and fresh target/backup/privacy/recovery authorization.
