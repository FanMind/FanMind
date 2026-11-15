# Capacity lifecycle controlled recovery contract

Preparation under FM-AI-001 / FM-CR-052; no target authorization or activation.

The immutable deployment input is the complete SHA-256-pinned lifecycle SQL from
reviewed source e9df302f1fd066e8396a385d875c1ff3f669f152. Its BEGIN/COMMIT are
part of those bytes. A future reviewed apply controller must verify those bytes,
remove ONLY the exact outer transaction delimiters, then execute precondition,
lifecycle body and exact postcondition in ONE transaction. Simply wrapping the
unmodified file in another BEGIN is invalid: its COMMIT would commit early.
No apply controller or runnable apply mode is supplied by this preparation.

Before any future apply: require its own current protected authorization, exact
merged main and controller commit/checksums, Staging project and TLS binding,
fresh preflight under the same target identity, current tested backup/recovery
and privacy/deletion inventory coverage. Serialize with policy/entitlement
writers and deployment work for the entire check/apply/postflight boundary.
The shared rollout-state path does not yet classify Capacity; extend/review it
before introducing an executable apply. Never infer apply from its PASS today.

First-install prerequisites are source-defined foundation plus activation guard,
policy revision 2, 15/30/50 EUR budgets, all flags off, freeze on, zero grants,
reservations, allocations and events, and absent lifecycle functions/overloads,
new columns, projection and unique included-period index. Any partial schema,
unexpected ACL/body/trigger, row or revision blocks. Do not repair the target,
seed data, modify policies, backfill provenance or overwrite existing RPCs.

If any in-transaction check fails, ROLLBACK restores the exact pre-apply schema,
ACL, policy and empty monetary state. The isolated preparation test proves that
installing the exact body followed by ROLLBACK reproduces the baseline catalog
digest. Lock/statement timeout, disconnect and errors cannot be called success.
Commit uncertainty requires a fresh read-only observation, never blind retry.

After COMMIT there is NO automatic down migration and NO generic DROP rollback.
Preserve the foundation, grants, allocations, ledger and all usage/provenance.
Keep switches off/freeze on through the separately authorized policy controller;
read-only reconcile committed state and review a forward repair. Even when empty,
removal would require separate exact-target approval, dependency/data checks and
recovery evidence. Never delete monetary history or repair migration-history rows.

Repository recovery is an ordinary reviewed source revert. It does not revert
database objects. Revert is not permission to touch Staging or Production.
D3 purchased-credit/top-up/refund correctness, the authoritative entitlement
writer/Stripe mapping, productive routes and activation remain separate.
