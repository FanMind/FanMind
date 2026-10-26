# Capacity package-source rebaseline — 26 October 2026

Status: **RELEASED_FOR_PR**  
Risk: **R3 / controlled repository source**  
Task: `FM-WEB-PRODUCTION-PATCHES-1359-20261026`  
Base: `b5a95069b4036d0c250bc4641bc1317f097cc7f3`  
Pull request: **#1374**

## Authorization and bounded source

The Owner explicitly authorized rebinding the existing full-file Capacity
`package.json` SHA-256 only for the already reviewed React and React DOM update
from 19.3.0 to 19.3.1. The full-file verifier remains mandatory and unchanged.

The complete package diff changes only `react` and `react-dom`. The lockfile
changes only their matching root declarations, exact package versions, registry
resolutions, integrity values and React DOM's React peer range. Next.js,
Playwright, Node types, pdfnative and every other dependency remain unchanged.

- Previous authorized `package.json` SHA-256:
  `12c48c3273402eb18dae36ad67a097c56267ffc6f4f78e9a9e619a51e170b654`
- Approved new `package.json` SHA-256:
  `a8b75fb01a5435e328c51e7d173c4abb97d7fecf4f9f47312ae5b74dea43442e`

Only that value changes in
`docs/operations/ai-capacity-staging-integration.json`. The other seventeen
controlled hashes, the verifier, workflow, SQL, preparation manifest, recovery
contract and tests remain byte-identical.

## Verification and countercheck contract

Merge requires exact-head 18/18 controlled-source consistency; PostgreSQL 17
Capacity reconciliation; Truth, lint, production build, Browser E2E, CodeQL,
Supply Chain and Project Memory gates; a complete final diff review; and an
independent R3 countercheck with no blocking finding. The previous
`capacity_checksum_invalid` and `SOURCE_CHECK:SOURCE_REJECTED` are the
required fail-closed negative evidence before this authorized source rebaseline.

## Boundary and recovery

No database or migration action, Staging/Production activation, deployment,
provider/customer action, verifier weakening, baseline change or unrelated
dependency update is included. Recovery is a separately reviewed repository
revert of React, React DOM, their lockfile entries and the corresponding manifest
hash as one source unit. No external cleanup is required.
