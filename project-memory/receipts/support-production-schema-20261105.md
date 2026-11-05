# Support #1350 — Production schema execution, 2026-11-05

Status: APPLIED_AND_VERIFIED; independent target countercheck pending.
Risk: R4. Task/lock: SUPPORT-PRODUCTION-SCHEMA-1350-20261105.
Holder: current interactive Codex root; apply complete, no active schema writer; database advisory lease (1350,1417) released at transaction completion.
Owner authorization: current direct Owner instruction requests the Support database objects directly on the real Production database from main, replacing Staging as the selected schema-installation target. This does not authorize Owner assignment, retention execution/schedule or application activation/deployment.
Source: reviewed main 0a965fd49d9552326c2ff96952b37282b7dac63a, PR #1417 merged normally after all 12 required app/context pairs passed and independent Guardian countercheck.
Target: Supabase FanMind Production drqkpdvtbbrrdwmtrodz, ACTIVE_HEALTHY, PostgreSQL17.6.

## Exact payload and execution path

This is a new explicit connector-based Production operation; the Staging runner/workflow is neither modified nor invoked against Production. Use Supabase apply_migration for DDL, with migration-history bookkeeping.
Generate installSql from unchanged scripts/operations/support-centre-schema.mjs and docs/operations/support-centre-reference.json on the source commit.
Remove only the psql client directive; add a current_user=postgres/current_database=postgres assertion inside the transaction.
Prepared payload SHA256: 775b70528fb10f76c1abc00eb90fa8c304a42577c34e92fe6c218c38ef2fec2c.
Source SQL SHA256: support_centre.sql 051fa0253bb6a815820d825ca4c1c35a70405a25de59e8dc0d7e899ef5179a30; support_centre_operations.sql c8bb1c8be779d0cfd64797bdc9fe2f4248abbdb201e0959bcc8e6ebe90be8633.
Independent synthetic PG17 reference SHA256: 95083136b610c0fbe2822a3dee309038f7aacb18e4eed344654dd7d5eba60472.

## Fresh read-only prerequisite evidence

- Full reserved-prefix catalogue ABSENT; no Support relations/functions/triggers/sequences.
- current_user/current_database postgres; transaction_read_only on; effective anon/authenticated/service_role boundary true.
- Required auth.users/workspaces UUID primary keys and social_connections UUID/text dependencies present.
- No held Support advisory lock.
- Latest three Production backup records succeeded/validation passed/offsite uploaded, finished 2026-11-05 01:30UTC. This is backup metadata evidence, not a new restore claim.
- Security advisors contain existing unrelated INFO10/WARN5; no new Support finding exists before installation.
- Separate Guardian reviewed unchanged SQL, installer, role/reference/absence guards and new connector execution shape; no source-level blocker.

## Boundaries and recovery

Creates seven empty tables, twenty functions, two triggers on new Support tables and one sequence. Existing support_repair_audit, Auth/customer/workspace/social rows are unchanged.
The transaction retains advisory lock, five-second lock timeout, sixty-second statement timeout, repeated absence/role checks and full pinned body/ACL/catalogue equality before COMMIT.
Unexpected default ACLs, partial objects, ownership or catalogue drift abort; do not relax the reference or change global/default privileges to force installation.
Failure before COMMIT rolls back atomically. Any later rollback requires exact-catalogue and empty-row checks using existing rollbackSql, without CASCADE. Never drop populated objects.
Postflight must independently prove EXACT, all new tables empty, RLS enabled, browser access denied, operator-only purge, Owner unset and no schedule/activation.
No schema result may be called complete Support runtime or Production product acceptance.

Staging verify42021541799 on the same source correctly reported ABSENT/schema_not_exact with private-file cleanup successful; no Staging apply was run.

## Actual execution and postflight

- Supabase apply_migration succeeded for Production target drqkpdvtbbrrdwmtrodz.
- Migration history version20261105115731, name support_centre_reviewed_main_0a965fd4; one installed migration row independently read back.
- First platform confirmation expired before execution. Fresh catalogue still ABSENT; a second confirmation completed the same scoped operation successfully. No unchanged SQL retry after an executed failure and no duplicate install.
- Root fresh read-only full catalogue exactly equals the pinned independent PG17 reference:7tables/20functions/2triggers/1sequence, all owned by postgres, all7 tables RLS-enabled.
- All7 tables have zero rows, including platform Owners and retention receipts. No Owner grant, retention/deletion execution, schedule activation, provider invocation or application deploy/flag change occurred.
- Security advisor delta is exactly7 INFO rls_enabled_no_policy findings for the intentionally policy-free/browser-denied Support tables; full ACL/reference equality confirms intentional server/operator-only access. Five pre-existing unrelated security-definer warnings remain unchanged. Reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy .
- Main source remained0a965fd49d9552326c2ff96952b37282b7dac63a throughout execution.
- Scope complete after independent target countercheck: Production Support SCHEMA only. Full Support runtime activation/identity/consent/privacy/retention/end-to-end acceptance remains open under Issue1350.
