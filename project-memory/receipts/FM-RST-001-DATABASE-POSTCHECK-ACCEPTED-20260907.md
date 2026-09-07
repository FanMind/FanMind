# FM-RST-001 — Database postcheck evidence acceptance — 2026-09-07

- Task: `FM-RST-001`; Risk: R4 evidence reconciliation.
- Scope: reconcile already-recorded evidence only. No runtime, database, Storage, provider, Production or Supabase-Staging action.
- Evidence source: issue #944 comments `5453497602`, `5453599115`, `5453727223`, `5453857592`, closure `5573957331`; workflow `33178878764` / job `98874745740`; #1075; #1077.
- Bound artifact/source/target: Full Backup `b74c1c60-1d61-4a39-9f0d-648ec003a12c`, Verification `006e6ab8-8f5c-43c1-ac68-6570e992a7a1`, source commit `14a1e2d0e100f2ec8cfa14486c96f128fb431878`, isolated `fanmind-restore-01` / PostgreSQL 17.11 / `fanmind_restore`.

## Transition predicate mapping

| Required predicate | Exact accepted evidence |
| --- | --- |
| Restore transaction | `pg_restore --single-transaction` committed; no repeat Restore |
| Ownership, object ACL and default ACL | Projected target contract equals expected fingerprint `0604dac8562a601e2d582f76aee4203825b826b302b9b0b93a92bdd2ca603052` after exactly eight bounded schema-USAGE grants |
| Roles | Source: 23 roles / 44 records; projection excludes only preflight-proven target-only `fanmind_restore_bootstrap` |
| Database container | Receipt-bound database-container fingerprint matched |
| Extensions | Five required extensions; exact 97-record fingerprint `6704956613ca8e58a527336d67b622a043e48a568858873ca5a6fa6b8bd08012` |
| Core tables | 5/5 present |
| RLS | 5/5 enabled |
| Policies | 5/5 covered |
| Application authorization | 120 core-table application grant tuples |
| Privileged-function boundary | 12 restricted SECURITY DEFINER functions |
| Receipt and cleanup | Receipt SHA-256 `08e871ecc104d31b354851317d8075d1e7d3e250269f0aeae8be20e491a8b4c2`; plaintext cleanup PASS |

## Countercheck and classification

The bounded completion was fail-closed: it required exact projected-contract equality and all five table/RLS/policy predicates after mutation and would revoke the same eight grants on failure. Final evidence records equality, `5|5|5|5`, receipt hash and cleanup PASS. PR #1075 preserves the projection rule; #1077 prevents stale readers from requesting another Restore.

Accepted progression: `DB_POSTCHECKED`.

Overall `FM-RST-001` remains `PARTIAL`; all later states remain separate. No runtime or provider action was performed by this reconciliation.
