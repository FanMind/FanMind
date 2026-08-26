# Project Reconciliation

Mandatory consistency check between project memory and actual repository/runtime state.

## Invariants
1. Every active task (`IN_PROGRESS`, `PARTIAL`, `BLOCKED`, `IMPLEMENTED_NOT_VERIFIED`) has a matching `STARTED_WORK.md` record.
2. Every substantive active task has one current `WORK_LOCKS.md` lock or explicit no-lock rationale.
3. Every meaningful implementation session produces an `EXECUTION_RECEIPTS.md` receipt.
4. Merged/closed PR state must be reconciled back into the task; unfinished restore/mobile/AI/billing/social/security work may not disappear.
5. `ACCEPTED`/`PRODUCTION_CONFIRMED` requires matching evidence.
6. Open loops/dependencies remain visible until explicitly closed.
7. Any Git/PR/CI/runtime-memory mismatch creates an open reconciliation finding and blocks a clean completion claim.

Compare `TASK_LEDGER.md`, `STARTED_WORK.md`, `WORK_LOCKS.md`, `OPEN_LOOPS.md`, `DEPENDENCIES.md`, `EVIDENCE.md`, `EXECUTION_RECEIPTS.md`, open PRs/branches, CI and current runtime evidence at each substantial session boundary and during the daily review.

## Finding template
```text
## RECON-YYYY-NNN
- Detected:
- Task:
- Mismatch:
- Actual state:
- Memory state:
- Required correction:
- Status: OPEN|RESOLVED|SUPERSEDED
- Resolved:
```

## RECON-2026-010
- Detected: 2026-08-20 during the new-chat FanMind blind test after the mandatory project-entry preflight was enabled.
- Task: `FM-SEC-001` / Next-Best-Action orchestration.
- Mismatch: `CURRENT_STATE.md` and issue #982 identify `FM-SEC-001` as the exact first safe unproven step, while `NEXT_BEST_ACTIONS.json` omitted that task and the generator therefore selected `NBA-MOBILE-READONLY`.
- Actual state: the live Supabase security reconciliation is open and its next allowed action is read-only Production trigger-hardening verification plus Staging/Auth classification; no protected mutation is authorized by this finding.
- Memory state: the human restart truth had advanced to security-first, but the machine NBA catalog/handoff had not.
- Required correction: add a parallel-safe read-only `FM-SEC-001` NBA before Mobile, regenerate the selected NBA and automatic handoff, and fail Project Memory Quality when `CURRENT_STATE.md` first-safe task is absent from or disagrees with the generated NBA.
- Status: RESOLVED
- Resolved: PR #986 branch scope implements the catalog/handoff/validator alignment. Acceptance remains contingent on exact-head green checks and merge; no Production/Staging/Auth/provider mutation is part of this reconciliation.

## RECON-2026-011
- Detected: 2026-08-22 after exactly authorized database-Restore run `32594374666` failed closed.
- Task: `FM-RST-001`.
- Mismatch: Project Memory still named a database-Restore dispatch as the next transition after minimal `TARGET_COMPATIBLE`, while live receipt-bound authorization proved the empty target has only 2 of the selected backup's 5 required extensions.
- Actual state: run `32594374666` stopped before the first write; independent read-only reconciliation proves an empty, TLS-verified, clean target with retained quarantine and exactly three missing trusted extensions.
- Memory state: readiness evidence was valid but described only the smaller baseline contract; the database authorization owner action was still shown as unused/deferred.
- Required correction: mark the one-run authorization consumed fail-closed, preserve highest accepted state `TARGET_COMPATIBLE`, add side state `RECONCILIATION_REQUIRED`, route the next owner action to exact rollback-capable extension-baseline provisioning/full receipt postcheck, and prohibit automatic retry.
- Status: RESOLVED
- Resolved: PR #995 exact head `ce2b63c606ca1a9aa701d24a569e21d66cfe13ea` passed Guard/Status/Quality, Landing, FanMind CI including PostgreSQL 17, both Browser E2E jobs and CodeQL, then squash-merged as `86bf2657996c45bfe03fadd4af689ffa89e7ea6e`. Runtime Restore acceptance remains open and owner-deferred at `FM-RST-OWNER-003`.

## RECON-2026-012
- Detected: 2026-08-23 after the final ACL-fingerprint-corrected extension controller completed successfully.
- Task: `FM-RST-001`.
- Mismatch: Project Memory still records a 2-of-5 extension blocker and owner-deferred extension provisioning, while current bound runtime evidence proves five exact descriptors, 97 records and the canonical ACL fingerprint after a committed extension-only transaction.
- Actual state: extension provisioning and full receipt-bound read-only postchecks passed on exact `main` `c627fc2d8956768091c88e3a3baaf0b882b8d2d6`; no database Restore/reset/JIT/workflow or Production/Supabase-Staging write occurred.
- Memory state: highest accepted progression `TARGET_COMPATIBLE` plus stale side state `RECONCILIATION_REQUIRED` and pending `FM-RST-OWNER-003`.
- Required correction: mark `FM-RST-OWNER-003` completed/consumed, remove the stale extension blocker, preserve `TARGET_COMPATIBLE`, add `FM-RST-OWNER-004` for a new exact database-Restore authorization and record all success/rollback/negative evidence.
- Status: RESOLVED
- Resolved: PR #997 exact head `6642c3c95bbb33f9a4b5f5a36afa068798e252e8` passed Project Memory Guard/Status/Quality, Landing, FanMind CI, Browser E2E and CodeQL, then squash-merged as `733e2f12464f746ee5dff0be71defe22d18ce33a`. The evidence lock is released; `FM-RST-OWNER-004` remains the separate new database-Restore boundary.

## RECON-2026-013
- Detected: 2026-08-26 after the owner ran database-Restore controller SHA-256 `45054c41143e33fce4406aea30478e43ed5280a36e1b339d0cc9c38df71ae946`.
- Task: `FM-RST-001`.
- Mismatch: Project Memory still showed `FM-RST-OWNER-004` as deferred and unused, while the owner had authorized and attempted the exact controller. The attempt stopped at the first SSH connection and was never reconciled into GitHub/Project Memory.
- Actual state: local accepted-readiness/main-drift checks passed; SSH to `138.124.213.66:22` timed out before remote preflight, JIT, environment approval, workflow dispatch or PostgreSQL access. Current GitHub evidence contains no later Restore run.
- Memory state: highest accepted Restore state `TARGET_COMPATIBLE` remained correct, but the owner-action and exact-next-step records were stale.
- Required correction: mark `FM-RST-OWNER-004` consumed pre-dispatch fail-closed, add `FM-RST-OWNER-005` for owner-PC public-IP/TCP-22 evidence and possible separately authorized exact `/32` allowlist reconciliation, add `FM-RST-OWNER-006` for a later new exact Restore authorization/controller, record proof of forbidden non-actions and prohibit retry/reuse.
- Status: OPEN
- Resolved: pending exact-head repository checks, PR merge and issue #944 evidence comment; no runtime/provider mutation is part of this reconciliation.
