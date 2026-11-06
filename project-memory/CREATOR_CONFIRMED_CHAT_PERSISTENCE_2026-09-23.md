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
- PR: `#1163`.
- Purpose: continue the already verified pure confirmed-chat validator with a controlled persistence contract and authorized evidence API, without target activation.

Implemented source scope:

1. controlled table/RLS/RPC contract in `supabase/controlled/20260923023000_creator_confirmed_chat_learning.sql`;
2. server-only proposal registration helper in `src/lib/creatorConfirmedChatPersistence.ts`;
3. authenticated evidence-binding route at `/api/creators/learning/confirmed-chat`;
4. current Creator fan-data read now exposes opaque commercial-event IDs required for explicit purchase evidence linking;
5. negative/static regression coverage in the existing CI-owned `creator-confirmed-chat-learning.test.mjs`;
6. explicit rollout boundary in `docs/operations/CREATOR_CONFIRMED_CHAT_LEARNING.md`;
7. bounded Project Memory reconciliation without modifying generated NBA/handoff outputs.

## Independent-review reconciliation on #1163

The required independent reviews identified additional evidence-boundary defects. They were fixed on the same bounded PR rather than creating parallel scope:

- Provider/imported outbound provenance cannot be inferred from `direction='outbound'`. The controlled schema now adds a server-owned `creator_learning_manual_send` marker on `conversation_messages`. A database trigger stamps it only for a new authenticated human outbound insert, rejects `manual_note` and service/provider context, and preserves it only across unrelated updates where every evidence-defining field remains identical. Any later text/scope/provenance/external-identity/timestamp rewrite clears the marker permanently. Existing historical rows are intentionally not backfilled.
- Outcome-link mutation no longer trusts application-route authorization alone. It enforces the canonical database-side `workspace_owner_active_mutation_allowed(workspace_id)` guard plus the Creator Workspace gate. A non-owner member and a read-only/expired/archived Workspace therefore fail closed even on direct RPC invocation.
- Outbound confirmation now closes both the direct-RPC bypass and the grapheme-count mismatch. The application reads the exact owner-visible stored outbound, validates the authoritative <=4,000 JavaScript-code-unit and <=512 NFC-grapheme contract, then invokes a service-role-only confirmation RPC. That RPC rechecks the supplied authenticated actor against Workspace ownership, re-evaluates the canonical database processing predicate, requires the exact measured text to match the current stored message, and then persists it. Authenticated/browser callers have no direct EXECUTE grant on the confirmation RPC.
- Outbound confirmation also rejects a persisted message timestamp more than 30 seconds ahead of database statement time. This closes the direct-insert future-time path and keeps durable `confirmed_at` evidence inside the pure validator's accepted bounded clock skew.
- PostgreSQL `length()` counts Unicode code points rather than extended grapheme clusters. The controlled table and service-only proposal RPC therefore use a 4,000-code-point storage envelope instead of a false <=512-code-point approximation. This cannot reject text accepted by the authoritative <=4,000-code-unit application bound, including multi-code-point emoji; the exact <=512-grapheme rule remains server-owned.
- Reaction outcome linking now rejects internal `manual_note` rows so FanMind-authored notes cannot masquerade as fan reaction evidence. The reaction timestamp must be at or after the confirmed outbound and no more than 30 seconds ahead of database statement time, matching the pure validator's bounded future-clock skew.
- The existing purchase writer can leave `conversation_id` null. Explicit linking accepts that shape only after exact Workspace/Creator/Fan, purchase-kind, durable-confirmation and timestamp checks. `getCreatorFanData()` now exposes each event `id` so the application can supply the opaque `purchaseEventId` required for that explicit association.
- Both outbound and purchase `confirmed_by` values are audit metadata with `ON DELETE SET NULL`. Retained evidence remains valid after historical actor deletion because the durable confirmation facts are `confirmed_at` plus the immutable outbound/event bindings; a null actor is the anonymized historical state, not evidence loss.

## Security / evidence invariants

- Browser code cannot mint proposal/generation IDs: proposal creation RPC is `service_role` only.
- Authenticated users have tenant-scoped learning-table read only; direct learning-table insert/update/delete remains revoked.
- Confirmation can bind only an existing server-originated proposal to an existing outbound message in the same Workspace/Fan/Conversation carrying the server-stamped human-send marker.
- Confirmation is service-route mediated: the exact stored text is authenticated-user-readable and grapheme-validated before the service-only RPC; the RPC then verifies exact text equality plus actor ownership, active processing, and the 30-second future-clock bound. No service-role credential is exposed to the browser.
- Outcome mutation is owner-only and requires the canonical active-processing database contract; application authorization is defense-in-depth, not the sole gate.
- Reaction can bind only an existing later inbound message in the same Workspace/Fan/Conversation that is not an internal manual note and is not beyond the accepted 30-second future-clock skew.
- Purchase can bind only an independently confirmed `creator_commercial_events` purchase in the exact same Workspace/Creator/Fan, with exact conversation match when the event already carries one. Historical confirmer deletion does not invalidate a retained event because `confirmed_at` survives while `confirmed_by` is anonymized.
- Rebinding an already linked outbound/reaction/purchase to different evidence fails closed.
- Missing reaction/purchase stays unknown; no purchase causality is inferred.
- Notes and provider/service-role outbound imports cannot feed voice learning.
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

- Repository work is materially changed and pushed on PR #1163.
- The review findings above are source-reconciled but are not accepted merely by this note. Final exact-head CI and exactly one independent review of the materially changed head remain mandatory.
- Required next sequence: exact-head CI -> exactly one independent review cycle for the current material head -> resolve any findings on the same PR -> if all required current-head checks are green, open P1/P2 are zero, review threads are clear and GitHub reports mergeable, merge immediately -> post-merge verify -> consume the exact merged source scope -> release this lock -> select the next canonical Creator action.
- Until that convergence completes, status is `CODE_CHANGED`/`CI_WAITING`/`REVIEW_WAITING` as applicable, never target-accepted.