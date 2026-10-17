# PR #1331 final review — 15 October 2026

Decision: **READY_FOR_MERGE** for the bounded development/source repair at exact
head `e9df302f1fd066e8396a385d875c1ff3f669f152` against current main
`dc269fd80407bfa2a3e1885e19e432b0ebaed68e`. No merge is performed or delegated.
The recommendation expires on a changed head, main, relevant finding or gate.
It is not runtime/commercial acceptance or protected target authorization.

## Bounded review and evidence

The reviewed base is the live GitHub main and freshly fetched origin/main, not
an old local tracking ref. The PR is open, non-draft, mergeable/clean and contains
only the two reviewed source commits. SQL SHA-256 remains
`f9d59b2e85aac51cc09782f8a7eab63120beff5668c63aeeff1d949e5d2dea99`.

The previously reproduced undeclared Grant variable/misplaced policy check and
ambiguous Settle SQL references are repaired. Reserve serializes by Workspace,
locks the entitlement and policy to transaction end, requires exact revisions,
checks global usage/freeze/mode and exact package/period, and checks time after
both lock waits. The source contract allows recovery of existing obligations
after freeze/revocation. Immutable replay evidence, included-before-purchased
allocation, ledger append-only behavior and consistent terminal lock ordering
have targeted native negative/concurrency evidence. No remaining critical
finding was found in these boundaries or their adapter/CI integration.

The independent reviewer re-read exact-head SQL/adapter/tests/CI and confirmed
that they are byte-identical to the independently executed 22/22 PG17.11 source
stand. The later head change is only the existing Next-Action projection. It did
not repeat the old suite unnecessarily. Original source receipt:
`project-memory/receipts/capacity-v2-lifecycle-repair-20261015.md`.

The GitHub PR/inline comments, submitted reviews and unresolved review-thread
collections are empty. Independent countercheck evidence is the separate agent
review/native execution and receipt; it is NOT represented as a submitted GitHub
approval. The active ruleset requires zero approving reviews but requires thread
resolution and strict current-base status checks. There are no bypass actors.

## Actual Required Checks

The active main ruleset is
[24945113](https://github.com/FanMind/FanMind/rules/24945113), not the legacy
branch-protection field. It requires **12 distinct contexts**, all successful on
the exact reviewed head with the configured integration IDs. Fourteen successful
check-run observations include duplicate Push/PR FanMind CI jobs.

| Required context | App ID | Successful check-run evidence |
| --- | --- | --- |
| Truth, lint, tests and build | 15368 | 116623367342; 116623482744 |
| CodeQL | 57789 | 116624131745 |
| JavaScript and TypeScript security analysis | 15368 | 116623088942 |
| PostgreSQL 17 authorization roundtrip | 15368 | 116623366819; 116623482430 |
| Synthetic regular-user core flow on local providers | 15368 | 116623222404 |
| Public no-write flows on desktop and mobile Chromium | 15368 | 116623222709 |
| Immutable Actions, dependency audit and CycloneDX SBOM | 15368 | 116623087159 |
| god-mode | 15368 | 116623085664 |
| language-runtime-guard | 15368 | 116623089071 |
| project-memory-guard | 15368 | 116623086042 |
| project-memory-quality | 15368 | 116623088211 |
| generate-status | 15368 | 116623088336 |

[Required PR PG17 job](https://github.com/FanMind/FanMind/actions/runs/38793288706/job/116623366819)
completed successfully, including its mandatory Capacity step: **48 passed,
0 failed,0 skipped**, of which22 are actual native lifecycle tests. The complete
[Truth/Lint/Operations/Build job](https://github.com/FanMind/FanMind/actions/runs/38793288706/job/116623367342)
also passed; Operations1827 passed/0 failed/7 expected skips. Native Capacity
coverage is separately mandatory and unskipped. Existing green tests/build were
consumed as exact-head evidence instead of needlessly rerun for this review.
Machine-readable bindings/check IDs: `ai-capacity-pr1331-final-review.json`.

## Separate Staging preparation

This preparation branch adds no commits to #1331. It supplies a pinned manifest,
read-only catalog/policy/empty-state query, offline-only validator/emitter,
recovery contract and focused tests. It introduces no target client, passfile
reader, executable apply or workflow dispatch. No Production/Staging/provider
request was performed. The existing FM-AI-001/FM-CR-052 scope is retained;
no parallel task registry, alternate Finishline or new task queue was created.

New preparation tests only: **28/28 passed**,0 failed/skip; independently also
28/28 in a distinct synthetic local database. Both runs reproduced the source
catalog fingerprint and proved real schema/ACL/column-ACL/RLS/policy/function/
overload/monetary/migration-marker negatives, non-bypass-RLS error, read-only
write rejection, complete transaction rollback and already-installed rejection.
Test databases and observer roles were removed. Targeted ESLint and Required-test
inventory1/1 passed. The separate preparation branch does not inherit a claim
of completed GitHub CI from #1331: its future source PR must pass its own gates.
Independent final preparation review: PASS, no open P0/P1/P2 in this packet.

Exact preflight/source-integration instructions:
`AI_CAPACITY_STAGING_PREFLIGHT_PREPARATION.md`; rollback contract:
`AI_CAPACITY_STAGING_RECOVERY.md`; all operational inputs pinned in
`ai-capacity-staging-preparation.json`.

## Remaining risks and next permitted step

The SQL is first-install-only. Native PG17/source review cannot establish an
actual target schema, deployment release, canonical commercial entitlement or
future privilege provenance. The productive projection writer/Stripe mapping,
privacy/deletion rollout, route wiring and activation remain unaccepted.
Over-reservation remains a durable reconciliation hold; no new monetary
adjustment/debt process is invented. D3 top-up/refund stays a separate follow-up.

Next: an authorized maintainer may review/merge #1331. Then review/integrate this
separate preparation into the EXISTING protected read-only Staging rollout path;
Capacity is not yet a supported family in that controller. Only after that
source integration and its current checks may a NEW protected-Staging approval
authorize the first read-only preflight, bound to actual merged main/controller,
SQL/query/recovery checksums and target `vshyhvgcmrlagvfnvomc`, explicitly apart
from Production `drqkpdvtbbrrdwmtrodz`. All flags must remain off and freeze on.
Any drift blocks. Apply is a different action requiring another current approval,
atomic pre/postflight controller and backup/privacy/recovery prerequisites.
