# Web dependency consolidation source receipt — 26 October 2026

Status: **RELEASED_FOR_PR**  
Risk: **R3 / controlled repository source**  
Task: `FM-WEB-DEPENDENCY-CONSOLIDATION-20261026`  
Base: `fcaf7bd85801c35332d0725a833defafac23f23b`  
Sources: **#1360, #1361, #1300**

## Bounded integration

Execution Policy v6 permits one bounded task to consume several source PRs when
they form one coherent technical state. These three updates modify the same root
web manifest/lockfile and require one shared Capacity full-file source binding,
one CI matrix and one atomic repository-revert recovery unit.

The integrated structural delta is exactly the disjoint union of the rebased
source PRs:

- @playwright/test, playwright and playwright-core 1.62.1 -> 1.64.1; the new
  Playwright package no longer declares fsevents, so its obsolete lock node is
  removed.
- @types/node 26.2.0 -> 26.6.5 and its required undici-types 8.3.0 -> 8.9.0.
- pdfnative 1.6.0 -> 1.8.0.
- Root declarations change only @playwright/test and pdfnative; @types/node stays
  within its existing `^26` range.
- Unrelated Dependabot Sharp `optional` key-order churn is excluded.

Root Node `>=22.13.0` satisfies Playwright `>=20` and pdfnative `>=22`.
Next 16.4.3 accepts @playwright/test `^1.51.1`.

## Controlled source authorization

The Owner authorized only the exact `package.json` source rebaseline necessary
for this reviewed bundle. Full-file SHA-256 enforcement is unchanged.

- Previous SHA-256:
  `a8b75fb01a5435e328c51e7d173c4abb97d7fecf4f9f47312ae5b74dea43442e`
- New SHA-256:
  `1bb80fae820419cfda6f8f748b4bfd1d40253e07e9e706f3858f4f8e598f824c`

No other controlled source, verifier, workflow, SQL, baseline or security
assertion is changed. The only test delta updates the hard-coded Playwright pin
expectation from 1.62.1 to 1.64.1; all no-write and security assertions remain
unchanged.

## Verification and recovery

Merge requires 18/18 controlled-source consistency; deterministic install and
lock integrity; pdfnative disclosure regressions; Playwright Browser E2E;
TypeScript, Truth, lint, Operations and build; PostgreSQL 17 Capacity; CodeQL,
Supply Chain, Project Memory and God Mode; plus independent exact-head R3 review.

Recovery is a separately reviewed repository revert of all three dependency
updates, their lockfile state and the matching manifest hash as one unit. No
database, migration, provider, Staging/Production activation or deployment action
is included.
