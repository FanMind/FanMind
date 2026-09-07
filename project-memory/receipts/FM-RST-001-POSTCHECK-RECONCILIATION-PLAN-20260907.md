# FM-RST-001 — DB_POSTCHECKED bounded reconciliation plan — 2026-09-07

## Exact objective
Advance no state by assumption. Determine whether retained immutable/private evidence already satisfies every `DB_RESTORED -> DB_POSTCHECKED` predicate in `RESTORE_STATE_MACHINE.md`.

## Order
1. Bind the exact database-phase evidence chain: Full Backup `b74c1c60-1d61-4a39-9f0d-648ec003a12c`, Verification `006e6ab8-8f5c-43c1-ac68-6570e992a7a1`, workflow `33178878764`, job `98874745740`, ACL completion `5453727223`, final reconciliation `5453857592`, accepted database receipt and PR #1075 projection correction.
2. Map retained receipt fields to owner/ACL/default-ACL/roles/database-container/extensions and schema/data/accounting/core-table/RLS/policy/authorization predicates.
3. Classify each predicate `PROVEN`, `MISSING_EXPLICIT_RECEIPT_EVIDENCE` or `CONTRADICTED`; do not treat a generic smoke result as proof.
4. If and only if a genuine evidence gap remains, design a separate read-only target proof bound to the existing isolated target. No Restore, no reset, no JIT reuse and no write is authorized by this plan.
5. Promote `DB_POSTCHECKED` only after every predicate is explicit and independently counterchecked. Then prepare the separately scoped `STORAGE_RESTORED` transition.

## Hard safety boundary
- no database Restore or retry;
- no target reset;
- no Production or Supabase-Staging access/write;
- no provider/firewall/SSH mutation;
- no Storage restore, server-config restore or disposable-target cleanup yet;
- no state promotion from this plan alone.
