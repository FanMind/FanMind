# FM-OPS-001 — Production backup 116-grant ACL contract source repair (2026-11-23)

- **Status:** SOURCE_PATCH_PREPARED / CI_AND_INDEPENDENT_REVIEW_PENDING / TARGET_UNCHANGED
- **Existing authority and tracker:** #1512, Production diagnosis [comment 7112604198](https://github.com/FanMind/FanMind/pull/1512#issuecomment-7112604198); memory-only companion #1547. This receipt does not create a new active implementation assignment, authorization, or production execution.
- **Source baseline:** main `8e9f3f6721b36575b228983c180f5e581a3c0d36`; PR #1548 is strictly a reviewed source proposal.

## Root cause
Production `backup_database` 22/23 November and `backup_full` 22 November were scheduled, claimed and failed `authorization_core_grant_matrix_invalid`. The existing worker expects 120 direct core table grants; the verified protected Workspace field ACL intentionally removed precisely four table-level anon/authenticated INSERT/UPDATE grants, leaving 116, preserving ten authenticated UPDATE columns and owner-scoped restrictive RLS. The failure is therefore not evidence of missing timers or an authorization to regrant unsafe writes.

## Narrow repair
- Preserve exact historical 120 direct-grant profile and historical Full Receipt v2 fields.
- Add read-only SQL classifier for the exact hardened 116 profile: original core grant selection/row count and zero grant options, no effective browser INSERT/table UPDATE, ten exact authenticated UPDATE columns, service-role writes, RLS and exact restrictive owner boundary.
- Both profiles keep their actual core grant counts and full authorization fingerprint; no count substitution or fallback on mismatch.
- Existing restore postcheck receipt validator accepts only 120/116 and continues matching exact source/target hashes and identities.
- Add synthetic negative tests for bad count, type, grant options, profile boolean and receipt count; older 120 tests remain.

## Mandatory technical gates
Hosted source CI and PostgreSQL 17 dump/restore tests must validate both profiles with no skips; independent security countercheck must include extra/missing table and column ACL, RLS/policy changes and receipt tampering. Any failed check must be fixed in this source PR and rerun on its new exact head. Current test and review outcome must be read from the corresponding GitHub workflows, not assumed from this preparation.

## Protected installation boundary
Neither this PR nor a source merge authorizes Worker/Root/SQL/Production/Backup/Restore mutations. Before any installation, inspect exact current root-owned installed module hashes and safe rollback copy on the named Production host, verify shared Production lock and existing backup-production-recovery protected environment, bind fresh source and target state and obtain the required bounded Owner approval. Verify exactly one authorized fresh encrypted backup, checksums, independent offsite confirmation and read-only audit after installation. Preserve already accepted security and recovery evidence.

- **Action:** Continue existing Operations/Recovery owner lane. No automatic dispatch/restart/repair from this receipt.
