# FM-RST-001 — Isolated database Restore and ACL completion — 2026-08-28

- Task: `FM-RST-001`; Risk: R4.
- Source of runtime evidence: issue #944 comments `5453599115`, `5453727223` and final reconciliation `5453857592`.
- Isolated target only: `fanmind-restore-01`, PostgreSQL 17.11, database `fanmind_restore`.
- Original workflow run `33178878764`; database job `98874745740`.
- The reviewed `pg_restore --single-transaction` completed successfully and committed. The workflow's historical failed conclusion occurred afterwards in the schema-ACL recovery helper.
- Root cause: the generic target snapshot treated the target-only login/superuser `fanmind_restore_bootstrap` as a source role.
- Separate one-shot authorization `5453727223` was consumed by controller `FanMind-Restore-ACL-Completion-FM-RST-ACL-OWNER-008.ps1`, SHA-256 `ef26d1fe412268e6ad42a7f59e3396de109946b8132f920bc5cc063cfe489d76`.
- The bounded completion excluded only that proven target-only principal from the source projection and applied exactly eight missing schema-USAGE grants.
- Expected and projected-actual authorization fingerprint matched exactly: `0604dac8562a601e2d582f76aee4203825b826b302b9b0b93a92bdd2ca603052`.
- Core-table postcheck was `5|5|5|5`: all five core tables present, RLS enabled and policies present.
- ACL completion receipt SHA-256: `08e871ecc104d31b354851317d8075d1e7d3e250269f0aeae8be20e491a8b4c2`.
- Temporary plaintext cleanup: `PASS`.
- Database Restore repeated: `false`; completion workflow dispatch: `false`; active Restore workflows afterwards: none.
- Production and Supabase Staging were neither accessed nor modified.

## Classification

- The isolated database Restore itself reached committed technical completion and must not be repeated.
- This receipt does not by itself promote the entire `FM-RST-001` finishline gate to `ACCEPTED`; Storage, server-configuration, disposable-target cleanup and final aggregate evidence remain governed by the canonical state machine unless separately proven.
- Issue #944 remains open only for the permanent helper/runtime correction. PR #1075 implements that correction by preserving the strict unique external target-principal preflight and excluding exactly the connected target-only login from projected target snapshots.
- Until #1075 is merged and Project Memory is fully reconciled, overall Restore remains `PARTIAL`; no new Restore workflow, target reset, JIT runner or R4 database mutation is authorized by this receipt.
