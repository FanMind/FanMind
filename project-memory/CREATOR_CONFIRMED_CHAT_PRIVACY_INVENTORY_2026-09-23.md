# FM-CREATOR-001 — confirmed-chat privacy inventory — 2026-09-23

## Consumed predecessor

- Canonical repository: `FanMind/FanMind`.
- Exact post-merge baseline: `63475a1fbb02dc3ce7fff3c7668c55c4357a3e5c`.
- PR #1163 is merged and closed. Its controlled confirmed-chat persistence/API source scope is **CONSUMED** and must not be reopened or hardened retroactively in this follow-up.
- The merged source remains unapplied. Merge is not Staging/Production activation or acceptance.

## Bounded follow-up scope

- Task: `FM-CREATOR-001` / `NBA-CREATOR-INTELLIGENCE`.
- Risk: R3 source preparation touching the R4 privacy contract `FM-CONTRACT-DISCLOSURE-DELETE-001`.
- Work lock: `LOCK-FM-CREATOR-CONFIRMED-CHAT-PRIVACY-INVENTORY-20260923`.
- Branch: `feat/creator-confirmed-chat-privacy-inventory-20260923`.
- Purpose: reconcile the newly introduced `creator_confirmed_chat_learning` personal-data family into FanMind's complete owner disclosure inventory before any target schema apply.

Implemented repository-only scope:

1. add `creator_confirmed_chat_learning` to the workspace-scoped complete disclosure dataset inventory;
2. make its temporary missing-schema compatibility depend on the explicit source-controlled `CONFIRMED_CHAT_LEARNING_SCHEMA_STATE`, which is outside Supabase/PostgREST schema caching;
3. keep that state at `preinstall` for the current unapplied source and fail closed on authorization/read errors;
4. add explicit German/English disclosure section labels;
5. extend disclosure regressions to prove workspace scoping, deterministic ordering, the source-controlled preinstall policy, fail-closed denial and PDF inclusion.

## Deferred follow-up gates

This PR intentionally does **not** claim the entire privacy/apply gate complete. The next bounded repository step after this disclosure slice is account/contact deletion verification inventory for `creator_confirmed_chat_learning`, followed separately by controlled migration runner/checksum and target-bound VERIFY/negative authorization evidence. Protected APPLY/ACCEPT and runtime activation remain owner/environment gated.

The controlled schema rollout has an additional fail-closed ordering invariant: **no target schema APPLY is allowed while `CONFIRMED_CHAT_LEARNING_SCHEMA_STATE` remains `preinstall`**. Before any protected APPLY, a bounded reviewed repository change must switch that state to `installed`, pass exact-head CI/review, and deploy the fail-closed disclosure reader. In the `installed` state a missing/stale PostgREST table can no longer be treated as an optional preinstall absence. The later migration runner/checksum gate must enforce this ordering; schema-cache observations are not accepted as rollout-state evidence.

## Safety boundary

No Staging/Production SQL was applied. No real customer, account, contact, provider, Billing/Stripe/Tax, Restore, Mobile or ChatAdmin data was mutated. No runtime feature flag was enabled and no automatic send capability was added.

## Convergence

The branch must land as exactly one bounded PR. Require all mandatory exact-current-head checks and one independent review cycle for each materially new head. Resolve findings on the same PR. When current-head checks are green, open P1/P2 are zero, blocking threads are clear, scope/dependencies remain valid and GitHub reports mergeable, merge immediately through the normal PR path without another voluntary review cycle. After merge, verify exact main, consume this disclosure slice, release the lock and select the deletion-verification inventory as the next safe Creator action.