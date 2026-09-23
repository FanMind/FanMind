# Creator confirmed-chat persistence — controlled rollout contract

Status: **repository-only design / NOT APPLIED / NOT ACTIVATED**.

This scope extends the existing pure `creatorConfirmedChatLearning` validator with a controlled persistence contract and an authenticated server endpoint. It does not apply SQL to Staging or Production, does not activate a new learning loop, does not call a provider or model, does not send a message, and does not change Creator voice, prices or playbooks automatically.

## Purpose

Persist only evidence that is explicitly linked as:

`proposal + generation + Creator/prompt revision -> human-confirmed outbound -> optional inbound reaction -> optional independently confirmed purchase event`.

Unknown reaction or purchase remains `NULL`. Temporal proximity is not a conversion claim. A purchase is stored as linked learning evidence only when it points to an existing `creator_commercial_events` purchase with the same Workspace, Creator, Fan, evidence reference and occurrence time.

## Repository contract

- Controlled SQL: `supabase/controlled/20260923011500_creator_confirmed_chat_learning.sql`.
- Server helper: `src/lib/creatorConfirmedChatPersistence.ts`.
- Owner-active API: `POST /api/creators/confirmed-chat-learning?contactId=<uuid>`.
- Pure validation/measurement remains in `src/lib/creatorConfirmedChatLearning.mjs`.
- Focused negative proof: `tests/creator-confirmed-chat-persistence.test.mjs`.

The database writer is monotonic and idempotent for identical evidence. Proposal identity/text/revisions cannot be rewritten. Once outbound, reaction or purchase evidence exists, it cannot be retracted or replaced through the RPC. Stable evidence IDs are unique per Workspace. The caller cannot choose `confirmedBy`; the server binds the authenticated user and the database rechecks it against `auth.uid()`.

Direct authenticated table writes stay revoked. The RPC itself requires the current Workspace owner and the existing Creator foundation access gate. The route additionally requires the active authorized Workspace/contact boundary and same-origin mutation protection. This intentionally does not widen team-member mutation capability.

## Explicit activation blockers

Merging this repository scope is **not** permission to apply the SQL. Before any target APPLY/ACCEPT, a separate protected rollout must prove all of the following on the exact target and exact commit:

1. The Creator foundation tables/functions and their composite parent identities exist with the expected definitions.
2. Data disclosure/export includes `creator_confirmed_chat_learning` with a bounded, credential-free projection.
3. Account/contact deletion verification knows the new data family in addition to relying on database cascades.
4. Target JWT/RLS tests prove cross-Workspace read/write denial and exact owner-only RPC behavior.
5. Duplicate proposal/generation/outbound/reaction/purchase IDs, scope mismatches, evidence rewrites/retractions and unlinked purchase attempts fail closed.
6. Any APPLY is followed by independent read-only schema/postflight evidence. No generic Web deploy or ordinary DB push may execute this controlled SQL.

Until those gates are satisfied, the correct target decision is **BLOCK / OWNER_REQUIRED for APPLY**, while repository CI may still accept the unapplied source contract.

## Recovery

Before target APPLY, recovery is a normal source revert. After a separately authorized target APPLY, rollback requires its own reviewed database plan; this document authorizes no automatic table drop or destructive retry.
