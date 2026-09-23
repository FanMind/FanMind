# FM-CREATOR-001 — confirmed-chat persistence/API reconciliation — 2026-09-23

## Exact baseline and prior-scope consumption

- Canonical repository: `FanMind/FanMind`.
- Baseline main at scope start: `3532bd4b9a19400284443f35b9b94b2849393aeb`.
- PR #1162 is merged into that exact baseline. Its crash-safe account-deletion Workspace-inventory scope is **CLOSED** and must not be rebuilt.
- Old lock `LOCK-FM-CREATOR-DELETION-INVENTORY-20260922` is superseded/released by the #1162 merge evidence. Any older `IN_PROGRESS` wording for that exact scope is stale navigation text, not permission to reopen it.
- Alt-PR hygiene was rechecked before mutation: #1141 is closed/unmerged and superseded, #1135 is closed/unmerged and superseded, #1147 is merged; no competing open PR carries this confirmed-chat persistence scope.

## New bounded scope

- Task: `FM-CREATOR-001` / selected action `NBA-CREATOR-INTELLIGENCE`.
- Risk: `R3` (tenant-scoped personal chat-learning evidence and authorization contract; repository-only source preparation).
- Work lock: `LOCK-FM-CREATOR-CONFIRMED-CHAT-PERSISTENCE-20260923`.
- Branch: `feat/creator-confirmed-chat-persistence-api-20260923`.
- Purpose: continue the already verified pure confirmed-chat validator with a controlled persistence contract and authorized evidence API, without target activation.

Implemented source scope:

1. controlled table/RLS/RPC contract in `supabase/controlled/20260923023000_creator_confirmed_chat_learning.sql`;
2. server-only proposal registration helper in `src/lib/creatorConfirmedChatPersistence.ts`;
3. authenticated evidence-binding route at `/api/creators/learning/confirmed-chat`;
4. negative/static regression coverage in the existing CI-owned `creator-confirmed-chat-learning.test.mjs`;
5. explicit rollout boundary in `docs/operations/CREATOR_CONFIRMED_CHAT_LEARNING.md`;
6. automatic handoff/NBA reconciliation from closed #1162 to this bounded continuation.

## Security / evidence invariants

- Browser code cannot mint proposal/generation IDs: proposal creation RPC is `service_role` only.
- Authenticated users have tenant-scoped table read only; direct insert/update/delete remains revoked.
- Confirmation can bind only an existing server-originated proposal to an existing outbound message in the same Workspace/Fan/Conversation.
- Reaction can bind only an existing later inbound message in the same Workspace/Fan/Conversation.
- Purchase can bind only an independently confirmed `creator_commercial_events` purchase in the exact same Workspace/Creator/Fan/Conversation.
- Rebinding an already linked outbound/reaction/purchase to a different evidence row fails closed.
- Missing reaction/purchase stays unknown; no purchase causality is inferred.
- Existing pure normalization/edit-metric validator remains authoritative for learning semantics.

## Protected actions explicitly not performed

- No Staging/Production SQL APPLY or ACCEPT.
- No feature-flag activation.
- No Provider/Meta/OnlyFans/TikTok/X mutation or secret access.
- No customer/account/billing/Stripe/tax mutation.
- No Restore write and no Mobile work.
- No automatic send.
- No claim that source merge equals target activation or quality acceptance.

## Gates retained after source preparation

This package is intentionally **not apply-ready** until a later bounded scope adds/reconciles: disclosure-export inventory for the new personal-data family, account/contact deletion verification inventory, controlled migration runner/checksum and target VERIFY, target-bound negative/authorization evidence, protected APPLY authorization, and real quality acceptance. The schema's cascade constraints are defense-in-depth, not a substitute for deletion verification.

`RELEASE_DECISION` therefore remains conservative (`BLOCK`/protected action required); this source package does not change it to `ALLOW`.

## Current execution state

- Repository work is materially changed and pushed to this branch.
- Required next sequence: open one bounded PR -> exact-head CI -> exactly one independent review cycle -> resolve any findings on the same PR -> if all required current-head checks are green, open P1/P2 are zero, review threads are clear and GitHub reports mergeable, merge immediately -> post-merge verify -> release this lock -> select the next canonical Creator action.
- Until that convergence completes, status is `CODE_CHANGED`/`CI_WAITING`/`REVIEW_WAITING` as applicable, never target-accepted.
