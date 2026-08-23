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

- Current progression: `TARGET_COMPATIBLE`; the previously open receipt-bound extension-baseline prerequisite is now satisfied. `DB_RESTORED` was not reached.
- Immutable foundation: PR #943 merge `14a1e2d0e100f2ec8cfa14486c96f128fb431878`; Full Backup `b74c1c60-1d61-4a39-9f0d-648ec003a12c`; checksum Verification `006e6ab8-8f5c-43c1-ac68-6570e992a7a1`.
- Accepted transition evidence: protected read-only run `32582640853` on exact commit `b75f68ecc7999a9b492051aecc2421b9b597dd18`; jobs `97054217701`, `97054234003` and `97054248185` all succeeded. Checkout certificate verification passed with the pinned Ubuntu truststore; resource checksum-only readiness and PostgreSQL-17 baseline target compatibility with TLS `verify-full` passed; writes remained disabled.
- Consumed write attempt: exactly authorized run `32594374666` on commit `8bc8855a6de928cf38ef2e8fb9e9e0860fc477db` passed dispatch, Host-1, checkout, checksum readiness and baseline target compatibility, then protected Host-2 job `97082992861` failed at `database_authorization_preflight_failed` before the first target write and before `pg_restore`.
- Independent read-only reconciliation proved no listener/JIT/credential/plaintext residue, listener exit 0, TLS `verify-full`, unchanged empty target and retained connection-disabled quarantine after that failed database attempt.
- Subsequent separately authorized extension-only provisioning on exact `main` `c627fc2d8956768091c88e3a3baaf0b882b8d2d6` committed successfully. Its full receipt-bound read-only postchecks prove five required extensions, exact 97-record fingerprint `6704956613ca8e58a527336d67b622a043e48a568858873ca5a6fa6b8bd08012` and canonical schema-ACL fingerprint `abedaf76740b6a7fc1e53433a41337a2f8248d79abfac4ac22c9cf835a1373e3`; no database Restore, reset, JIT/workflow dispatch, Production write or Supabase-Staging write occurred.
- Both earlier authorizations are consumed. No retry or JIT reuse is permitted. A new database-Restore authorization may now be considered only after fresh mutable runner-policy/host/target/backup/TLS preflight.

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
