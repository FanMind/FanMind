# Creator confirmed-chat learning — controlled persistence/API boundary

## Status

Repository preparation only. The controlled schema in
`supabase/controlled/20260923023000_creator_confirmed_chat_learning.sql` is **not**
part of generic Web, Staging or Production deployment. The runtime switch
`FANMIND_CREATOR_CONFIRMED_CHAT_LEARNING_ENABLED` is fail-closed unless it is
exactly `true`.

This package does not claim Staging or Production activation, real quality
acceptance, provider evidence, automatic sending, profile mutation, or purchase
causality.

## Evidence chain

The persisted chain is deliberately narrower than "the model suggested it, so it
worked":

1. A server-only proposal registration RPC records exactly three already
   validated Creator reply texts (`recommended`, `softer`, `stronger`). The RPC
   creates proposal/generation identifiers and is executable only by
   `service_role`; the browser cannot mint proposal identities. Proposal text is
   bounded by the authoritative server validator to at most 4,000 JavaScript
   code units and 512 NFC extended grapheme clusters. PostgreSQL `length()` counts
   Unicode code points rather than grapheme clusters, so the controlled table
   deliberately uses only a 4,000-code-point storage envelope. This envelope
   cannot reject a value accepted by the authoritative 4,000-code-unit validator;
   the exact 512-grapheme rule remains server-owned instead of being approximated
   incorrectly by SQL.
2. A human confirmation may bind one proposal only to an **already stored
   outbound** `conversation_messages` row in the same
   Workspace/Fan/Conversation carrying the server-owned
   `creator_learning_manual_send=true` marker. The controlled trigger stamps this
   marker only for a new authenticated human outbound write, excludes
   `manual_note`, and refuses provider/service-role imports. Unrelated later row
   updates preserve the marker only while every evidence-defining field remains
   identical; changing text, scope, provenance, external identity or message time
   clears the marker permanently. Existing historical rows are deliberately not
   backfilled. Before confirmation, the FanMind server reads that exact
   owner-visible message with the authenticated session, applies the same
   4,000-code-unit / 512-NFC-grapheme validator, then invokes the confirmation RPC
   with `service_role`. The RPC independently rechecks the actor's Workspace
   ownership and processing entitlement and requires the persisted message text to
   equal the exact text the server measured. The confirmation RPC is not granted
   to `authenticated`, so a browser cannot bypass the grapheme validator by
   calling Supabase directly. Rebinding to a different outbound fails closed.
3. A reaction may only be an independently stored **inbound** message in the
   same Workspace/Fan/Conversation after that outbound. Internal `manual_note`
   rows are never fan-reaction evidence, and the persisted reaction timestamp may
   be at most 30 seconds ahead of database statement time, matching the pure
   validator's bounded future-clock skew.
4. A purchase may only be an independently confirmed
   `creator_commercial_events` purchase for the exact same Workspace/Creator/Fan
   after that outbound. If the existing event already has a `conversation_id`,
   it must match. Current `record_creator_fan_review` events may have a null
   `conversation_id`; for those, the explicit owner `link_outcomes` action plus
   the learning row's exact conversation/proposal/purchase IDs is the durable
   conversation association. `getCreatorFanData()` exposes each event's opaque
   `id`, so the current application read flow can supply the required
   `purchaseEventId`. A purchase event can be linked to only one learning row.
   `creator_commercial_events.confirmed_at` is the durable confirmation fact;
   `confirmed_by` is deletable audit metadata and may become null after the
   original confirmer account is removed.
5. The learning row's own `confirmed_by` is likewise audit metadata. If the
   confirming account is later deleted, its FK becomes null by design while
   `confirmed_at` plus the immutable outbound binding keep the already-valid
   historical evidence usable in anonymized form.
6. Missing reaction or purchase evidence remains unknown. The persistence
   contract does not infer outcome, intent, attribution, causality, or revenue
   from text.

The existing pure validator in `src/lib/creatorConfirmedChatLearning.mjs`
remains the metric/summary boundary. Persistence adds durable evidence identity;
it does not weaken the validator.

## Authorization and isolation

- Direct authenticated table writes to the learning table are revoked.
  Authenticated users have only tenant-scoped `SELECT` through RLS.
- Proposal registration is server-only (`service_role`) and independently
  checks Creator revision plus Workspace/Fan/Conversation scope.
- Outbound confirmation is also server-only. The application first authenticates
  and authorizes the current owner, measures the exact persisted outbound, then
  the service-role RPC independently binds `p_actor_user_id` to the Workspace
  owner and re-evaluates the canonical processing predicate before accepting the
  exact measured text. No service-role credential is exposed to the browser.
- Outcome linking remains browser-callable but enforces the canonical
  `workspace_owner_active_mutation_allowed(workspace_id)` contract **inside the
  database RPC**, plus the Creator Workspace gate. A non-owner member or a
  read-only/expired/archived Workspace cannot bypass the application route by
  calling that RPC directly.
- Human-send provenance is created by a database trigger from authenticated
  insertion context and cannot be manufactured by later row updates. Unrelated
  updates preserve it only when every evidence-defining field is unchanged; an
  evidence-defining rewrite clears it permanently. Provider/service-role imports
  and manual-note rows are not eligible.
- Purchase linking requires an independently confirmed purchase event for the
  same Workspace/Creator/Fan. A non-null foreign conversation is rejected; an
  unbound event is associated only by the explicit owner link and cannot be
  reused by another learning record. Deletion of the historical confirmer does
  not invalidate the event because `confirmed_at` remains non-null and immutable
  for that retained row while `confirmed_by` is anonymized to null.
- The application API additionally requires the normal trusted mutation/session
  boundary, active processing entitlement, Creator Intelligence availability and
  the dedicated rollout flag.
- No browser route imports or receives the service-role key.

## Runtime API

`POST /api/creators/learning/confirmed-chat`

The route does **not** create proposals. It supports only evidence enrichment for
an existing server-originated proposal:

- `action=confirm_outbound`: requires `contactId`, `proposalId`,
  `outboundMessageId`. The server resolves the exact persisted outbound through
  the authenticated session; callers do not supply or attest its text.
- `action=link_outcomes`: requires `contactId`, `proposalId` and at least one of
  `reactionMessageId` or `purchaseEventId`. Purchase IDs are exposed by the
  existing Creator fan-data read result, not invented by the client.

Detailed database/tenant diagnostics are never returned to the caller.

## Deliberately not activated by this package

`registerCreatorConfirmedChatProposals()` is a server-only helper prepared for a
later bounded integration into the AI reply-generation path. It is intentionally
**not wired into reply generation in this package**. That later integration must
bind the effective prompt revision and exact current Creator revision before any
proposal IDs are returned to the UI.

No controlled SQL may be applied merely because this repository package merges.
Before any target APPLY/ACCEPT, the following must be completed as separate
current-evidence gates:

- controlled migration runner/checksum and target preflight/postflight,
- disclosure inventory/export inclusion for the new personal-data family,
- account/contact deletion verification inclusion in addition to the schema's
  cascade constraints,
- exact-head CI and independent review with tenant/cross-tenant negatives,
- target-bound schema VERIFY before APPLY,
- explicit protected-environment authorization,
- activation of the dedicated rollout flag only after the target contract is
  present and verified.

Until then, merge means source preparation only; it is not activation or
acceptance.