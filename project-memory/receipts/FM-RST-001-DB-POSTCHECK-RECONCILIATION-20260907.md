# FM-RST-001 — DB_POSTCHECKED evidence reconciliation — 2026-09-07

- Risk: R4.
- Repository base: `b3debab3483682a78d42046d77f0eeb5b6f409fb` (`#1077`).
- Scope: repository/receipt reconciliation only. No database connection, Restore, target reset, JIT, SSH/provider mutation, Storage action, Production access or Supabase-Staging access/write.
- Current accepted Restore progression remains `DB_RESTORED` until the receipt-completeness gap below is closed.

## Binding evidence chain

- Full Backup: `b74c1c60-1d61-4a39-9f0d-648ec003a12c`.
- Checksum Verification: `006e6ab8-8f5c-43c1-ac68-6570e992a7a1`.
- Real isolated database Restore: workflow `33178878764`, database job `98874745740`; `pg_restore --single-transaction` committed before the later helper failure.
- ACL completion authorization: `5453727223`.
- ACL completion controller: `FanMind-Restore-ACL-Completion-FM-RST-ACL-OWNER-008.ps1`, SHA-256 `ef26d1fe412268e6ad42a7f59e3396de109946b8132f920bc5cc063cfe489d76`.
- ACL completion receipt SHA-256: `08e871ecc104d31b354851317d8075d1e7d3e250269f0aeae8be20e491a8b4c2`.
- Final issue reconciliation: #944 comment `5453857592`.
- Permanent projection correction: PR #1075, merge `e3009134f87dc4b197c518cb097ceee867b0c7f8`.
- Project-Memory closeout: PR #1076, merge `a66b3051dc7feb533f7f2d261485e6db9db928ea`.
- Obsolete rerun controls retired: PR #1077, merge `b3debab3483682a78d42046d77f0eeb5b6f409fb`.

## Exact DB_RESTORED -> DB_POSTCHECKED predicate matrix

| Predicate | Existing evidence | Reconciliation |
|---|---|---|
| Exact isolated target / PostgreSQL 17 | `fanmind-restore-01`, PostgreSQL 17.11, `fanmind_restore` in the final #944 chain | PROVEN |
| Transactional database Restore | workflow `33178878764` / job `98874745740` committed `pg_restore --single-transaction` | PROVEN |
| No repeated Restore | ACL completion result explicitly records `Database restore repeated=false` and no active Restore workflow afterwards | PROVEN |
| Ownership / ACL / default-ACL contract | the bounded completion first projected out only the proven target-only bootstrap principal, then required the projected target authorization contract to equal the private Full Backup contract exactly; post-completion expected/actual fingerprint is `0604dac8562a601e2d582f76aee4203825b826b302b9b0b93a92bdd2ca603052` | PROVEN |
| Exact schema-ACL delta | eight missing schema-USAGE grants across `graphql` / `graphql_public` were the only ACL delta and were applied once; rollback was required on any postcheck mismatch | PROVEN |
| Role contract | source contract is 23 roles / 44 records; the only target delta was the isolated bootstrap login/superuser. The corrected helper proves that this connected principal is the unique login/superuser outside the source role component before excluding exactly it from projected snapshots | PROVEN_PROJECTED |
| Database-container contract | final pre-completion reconciliation reports the database-container fingerprint already matched exactly; ACL completion does not mutate the database container | PROVEN |
| Extension contract | five required extensions and fingerprint `6704956613ca8e58a527336d67b622a043e48a568858873ca5a6fa6b8bd08012` already matched exactly; ACL completion does not mutate extensions | PROVEN |
| Core tables | post-completion core result `5|5|5|5`: all five required core tables present | PROVEN |
| RLS | same `5|5|5|5`: all five required core tables RLS-enabled | PROVEN |
| Policies | same `5|5|5|5`: all five required core tables have at least one policy | PROVEN |
| Core application grants | count 120 matched the receipt-bound contract before ACL completion; the completed projected authorization contract then matched the Full Backup contract exactly | PROVEN |
| Restricted SECURITY DEFINER execution boundary | count 12 matched the receipt-bound contract before ACL completion; completed projected authorization contract matched exactly | PROVEN |
| Temporary plaintext cleanup | completion recorded `PASS` | PROVEN |
| Production / Supabase-Staging isolation | final chain records no Production or Supabase-Staging access/write | PROVEN |

## Remaining receipt-completeness gap

The historical protected workflow failed in the schema-ACL recovery helper **after** the transactional Restore but **before** its normal `restore-runner-receipt.mjs` and `restore-database-postcheck-receipt.mjs` completion path. The later one-shot ACL completion generated its own private receipt and proves the semantic postcheck predicates above, but the repository currently contains only its SHA/redacted outcome, not the private receipt body needed to independently verify every identity-binding field expected by the canonical `restore-database-postcheck-receipt.mjs` format.

Therefore this reconciliation does **not** synthesize or fabricate the missing canonical private receipt and does **not** promote `DB_POSTCHECKED` yet.

## Exact next step

1. Prefer the retained private ACL-completion/Restore evidence if it is still available: verify its target, drill, backup/receipt and production-commit bindings against the canonical DB-postcheck receipt requirements.
2. If those identity bindings cannot be proven from retained private evidence, acquire a separately bounded **read-only** proof on the existing isolated target. Do not repeat the Restore or reset the target merely to recreate a receipt.
3. Promote `DB_POSTCHECKED` only when this identity-binding/receipt-completeness gap is explicit and independently counterchecked.
4. Only afterwards begin the separately scoped `STORAGE_RESTORED` transition.

## Falsification question

What would prove this reconciliation wrong? Any retained private receipt or fresh read-only target evidence showing a role/container/extension/ACL/owner/core-table/RLS/policy/application-grant/SECURITY-DEFINER mismatch, target identity mismatch, or evidence that the accepted Restore/ACL completion was not bound to the selected Full Backup would invalidate the matrix and keep `DB_POSTCHECKED` blocked.
