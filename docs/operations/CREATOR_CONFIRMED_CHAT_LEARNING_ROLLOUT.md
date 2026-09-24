# Creator confirmed-chat learning — controlled schema rollout

## Status

`PREPARED_NOT_APPLIED`. This runbook covers the repository-controlled migration runner for `supabase/controlled/20260923023000_creator_confirmed_chat_learning.sql`. It does not authorize or perform Staging/Production APPLY, ACCEPT, customer mutation, provider activation or runtime learning activation.

The current source state remains `CONFIRMED_CHAT_LEARNING_SCHEMA_STATE="preinstall"`. While that is true, the runner is structurally incapable of applying the migration.

## Offline source check

Run only against the reviewed repository checkout:

```bash
node scripts/operations/creator-confirmed-chat-learning-migration-runner.mjs --check
```

The check pins the exact Git blob of the controlled SQL, validates the required schema/RLS/RPC/FK contract, reports a SHA-256 diagnostic and reads the explicit source rollout state. It has no database target and cannot mutate anything.

## Read-only target VERIFY contract

`--verify` is target-bound and read-only. It requires the reviewed checkout SHA, exact Supabase project-reference-to-URL binding, exact expected database host, TLS `verify-full`, an absolute CA path and a private `0600` passfile snapshot. It rejects partial schema state.

The verifier distinguishes:

- source `preinstall` + target absent: expected preparation state; no APPLY is allowed;
- source `preinstall` + target installed: fail closed because target state outran the reviewed source lifecycle;
- source `installed` + target absent: eligible for a separately authorized future Staging APPLY;
- source `installed` + target installed: exact postflight/ACL/RLS/function/trigger contract must pass.

A later protected workflow may supply these values from its environment. Do not put credentials, passfile contents or provider secrets in Git, logs, chat or workflow inputs.

## Mandatory ordering before any APPLY

1. Keep this runner/checksum source reviewed and merged while the lifecycle remains `preinstall`.
2. In a separate bounded PR, switch the shared source state to `installed`, pass exact-head CI/review and deploy the fail-closed disclosure/deletion readers first.
3. Run a fresh target-bound read-only VERIFY. `ABSENT` is the only acceptable pre-apply target state.
4. Obtain the separate action-time owner/protected-environment authorization.
5. Only on isolated Staging, use the exact reviewed checkout and the explicit apply confirmation plus non-Production write acknowledgement.
6. Require exact installed postflight plus negative authorization/tenant evidence. If the result is missing, partial or indeterminate, stop and VERIFY read-only; never blind-retry, drop or repair.
7. Runtime flag activation and real Creator quality/provider acceptance are later independent gates.

The runner structurally forbids Production `--apply`. Any future Production schema plan requires a separate reviewed scope and authorization rather than reusing Staging permission.

## Recovery boundary

The migration is transactional, but an interrupted/indeterminate external execution is not treated as rollback proof. The safe recovery action is read-only VERIFY and reconciliation. There is no automatic DROP/repair path in this runner. Normal Web deploy never applies this SQL.