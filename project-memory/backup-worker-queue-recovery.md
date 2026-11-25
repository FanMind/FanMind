# Backup worker recovery on fanmind-prod-01

## Evidence before production activation

The production database reported PostgreSQL 17.6, max_prepared_transactions=0 and no outstanding prepared transactions on 2026-11-25. The protected controller uses a committed CHECK constraint scoped to active backup jobs. Two short NOWAIT DDL transactions acquire and remove the constraint. Concurrent backup inserts or status updates that match it receive a constraint error. Other job types can continue. After a controller crash the guard remains until verified recovery. A fresh run must never remove it on an unknown host state.

## Bindings for the protected operation

| Item | SHA |
| --- | --- |
| Original private preparation | c58cf0fc95deccfac60a78dad3805ed049e7d94f |
| Application | bb799466d2c235195fedcb4d80568f9f0bd56969 |
| Worker source | 690ab046d537d6cb910496302208e722054e0d80 |
| Target module | 2a3203b46dd72d114c73ed006bbf637bffd2c9dcc46657493273fd62b90478bc |
| Prepared module preimage | 2f8e2d82f5f0eb2c070f22a7c035feaf1e4112a918853bea76b9fa769be8b441 |
| New install controller | a37e7304be60702e59fb251824dbdd9eded52e516908a0904d3a4062f131d25d |
| New policy | d6cb694b920bbbc60d4ebd1f6f1ea10985a2ae1c18f9809a9c0d28ad8170d46b |
| Fixed wrapper | cd3d53e02f8997e8e9fa7dd89d182bb18a75f28cd5d1387e338a7e9455c41306 |
| Protected inspector | 7ca24d2abe36561434e382e4e6f1ff2dd8cfb683dca40cc21210d2b41fc3cc08 |

1. Resolve the actual merged Main SHA and verify it still heads the protected branch. Approval must bind that SHA, these bytes, host and backup-production-recovery, the temporary backup-only database constraint, controller update, install and controlled rollback. Existing host authorization is bound to the previous controller.
2. Run protected inspect. Require preparedCopy.matchesInstalledBytes=true, the exact prepared preimage, the original COMPLETED receipt and the expected application, controller and bundle hashes. Abort on drift or competing runs. Never rerun preparation.
3. Under the existing installation lock, preserve the actual old controller, policy and authorization privately and verify their bytes. Stage the two new pinned controller files in the same filesystem, verify before and after atomic replacement, and issue fresh bounded authorization with preparationCommit equal to the original preparation. On partial failure reconcile exact saved and staged hashes before restoring. Use update-prepared-controllers in the existing protected bootstrap workflow. Its confirmation is backup-worker-update-prepared-controllers. The environment variable must bind this action to the final protected Main, worker and application. The update takes a separate private snapshot of both old controllers and the exact prior authorization, verifies each readback and publishes the new two-hour authorization last. The snapshot directory is published atomically. On a separately reviewed repeat, the original published new authorization and exact new controllers return ALREADY_COMPLETED without extending the expiry. Before that commit point, restore only known old/new bytes, authorization first. An unknown state requires reconciliation.
4. Submit one install through the existing protected workflow and capture its run ID. The wrapper holds the installation lock. The controller checks the queue, saves and verifies rollback bytes, acquires the persistent backup-only guard, rechecks the queue, swaps the module, verifies live state and releases the guard. On uncertain interruption, preserve the guard and receipt. Only reconcile exact known bytes and a verified private copy.
5. Require successful install, verified module hash, healthy worker and absent database guard before starting one existing DB job and one full backup. Record job IDs, verified encryption, independent offsite receipts and backup freshness, then run the existing read-only production audit. Restore writes, general SQL apply and production application deployment are outside this operation.
