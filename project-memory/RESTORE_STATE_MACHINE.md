# FanMind Restore R4 State Machine

Task: `FM-RST-001`. This is the only valid progression for the real isolated recovery drill.

## States

1. `BACKUP_ACCEPTED`
2. `HOST_REVALIDATED`
3. `RUNNER_POLICY_REVALIDATED`
4. `RESOURCE_READY`
5. `TARGET_COMPATIBLE`
6. `DB_RESTORED`
7. `DB_POSTCHECKED`
8. `STORAGE_RESTORED`
9. `CONFIG_RESTORED`
10. `DISPOSABLE_TARGET_CLEANED`
11. `COUNTERCHECKED`
12. `ACCEPTED`

No state may be skipped. A later state does not retroactively prove an earlier state if its evidence is stale or bound to another commit/target/artifact.

## Current state

- Current accepted progression: `DB_POSTCHECKED`. Issue #944 comments `5453497602`, `5453599115`, `5453727223` and `5453857592` bind the exact Full Backup/source/isolated target, prove the PostgreSQL 17 Restore committed, and prove every database postcheck predicate through the bounded completion receipt. The database Restore must not be repeated.
- Immutable foundation remains PR #943 merge `14a1e2d0e100f2ec8cfa14486c96f128fb431878`, Full Backup `b74c1c60-1d61-4a39-9f0d-648ec003a12c` and checksum Verification `006e6ab8-8f5c-43c1-ac68-6570e992a7a1`.
- The workflow's historical failed conclusion occurred after successful `pg_restore --single-transaction`, when schema-ACL recovery compared the source contract with a target snapshot that incorrectly included target-only login/superuser `fanmind_restore_bootstrap`.
- Separate exact one-shot authorization `5453727223` completed the already restored target without a second Restore or workflow dispatch: exactly eight schema-USAGE grants, projected expected/actual authorization fingerprint `0604dac8562a601e2d582f76aee4203825b826b302b9b0b93a92bdd2ca603052`, core-table result `5|5|5|5` and plaintext cleanup `PASS`.
- Production and Supabase Staging were not accessed or modified. All Restore authorizations/controllers in this evidence chain are consumed; active Restore workflows afterwards were none.
- Permanent helper correction closed: PR #1075 keeps raw source capture unchanged, proves the connected Restore principal is the unique external login/superuser, then excludes exactly that principal from projected target comparisons; it squash-merged as `e3009134f87dc4b197c518cb097ceee867b0c7f8`, and issue #944 is closed `completed`.
- `DB_POSTCHECKED` is accepted by `receipts/FM-RST-001-DATABASE-POSTCHECK-ACCEPTED-20260907.md`: owner/object ACL/default ACL/roles/database-container/extensions match the receipt-bound expected contract; five core tables exist with RLS and policy coverage; application grants equal 120; restricted SECURITY DEFINER functions equal 12. The projected target excludes only the proven target-only bootstrap login.
- Repository-only Storage control is accepted: PR #1081 merged the private exact artifact/receipt preparation; PR #1085 final head `7d32f5a0c29b8ab581a736b0744bfdcf41f5eddb` passed seven workflows, zero unresolved threads and exact-head review before squash merge `0ccf38e5f1afdd0b5f3495a137a5d360dd214ae7`. The fail-closed controller proves target-empty, Production/Staging denial, exact path/size/hash postcheck, durable receipts, rollback and recovery behavior against synthetic provider doubles only.
- Overall `FM-RST-001` remains `PARTIAL`. Storage, server-config, disposable-target cleanup, independent countercheck and final aggregate acceptance remain separate.
- Exact next step: Bernd resumed real isolated Storage completion on 2026-09-08; `FM-RST-OWNER-007` is `OWNER_ACTION_REQUIRED` for the distinct target/cost and exact artifact authorization. Do not rebuild or dispatch the accepted controller. A new action-time owner decision, distinct isolated non-Production target and exact R4 authorization are required before any Storage mutation. No database Restore, target reset, JIT reuse or automatic retry is authorized.

## Transition contract

### BACKUP_ACCEPTED -> HOST_REVALIDATED
Require current evidence for Ubuntu 24.04, PG 17.11 toolchain/target, Node 24.19.0, fixed host gate, dedicated no-sudo restore user, private temp/workspace boundaries and no unexpected privileged capability.

### HOST_REVALIDATED -> RUNNER_POLICY_REVALIDATED
Require independent current evidence that repository/organization runner-group routing and exact workflow restrictions are correct. Labels alone never prove authorization.

### RUNNER_POLICY_REVALIDATED -> RESOURCE_READY
Run the reviewed read-only resource readiness against the exact selected encrypted Full Backup and isolated targets. No decryption/write.

### RESOURCE_READY -> TARGET_COMPATIBLE
Run fixed read-only PostgreSQL catalog compatibility with TLS `verify-full`; prove PG17, required roles/extensions and dedicated bootstrap-superuser contract. No creation/migration/restore.

### TARGET_COMPATIBLE -> DB_RESTORED
Requires protected R4 write authorization and exact artifact/receipt binding. Restore only into the empty isolated self-controlled target. Production and Supabase Staging are forbidden.

### DB_RESTORED -> DB_POSTCHECKED
Require receipt-bound owner/ACL/default-ACL/roles/database-container/extensions plus core table/RLS/policy/authorization postchecks. A generic schema smoke is insufficient.

### DB_POSTCHECKED -> STORAGE_RESTORED
Restore and verify Storage only into the distinct isolated test Storage target with manifest/path/size/hash evidence.

### STORAGE_RESTORED -> CONFIG_RESTORED
Restore/verify server configuration only into a non-Production verification boundary. Never activate Production services/webhooks/secrets from restored config.

### CONFIG_RESTORED -> DISPOSABLE_TARGET_CLEANED
Prove the disposable database/application/Storage verification targets and transient plaintext/private material are cleaned according to the runbook. Never claim cleanup without evidence.

### DISPOSABLE_TARGET_CLEANED -> COUNTERCHECKED
Independent evidence review: exact commit, exact artifact, exact targets, negative/fail-closed paths, no Production/Staging mutation, required receipts complete and no unresolved contradiction.

### COUNTERCHECKED -> ACCEPTED
R4 quorum from `QUALITY_CONTROL.md` satisfied and final evidence/receipt is recorded in Project Memory and #874/#944.

## Reset / regression rules

- Material host drift resets to at most `BACKUP_ACCEPTED` until host revalidation passes.
- Runner-group/workflow policy drift resets to at most `HOST_REVALIDATED`.
- New backup artifact requires resource/target/write evidence to be rebound; never reuse another artifact's restore evidence.
- Target recreation or TLS identity change requires Resource/Compatibility revalidation.
- Any unexpected Production/Supabase-Staging target match is immediate `BLOCKED` and abort.
- Any indeterminate write result becomes `RECONCILIATION_REQUIRED`, never automatic retry.
