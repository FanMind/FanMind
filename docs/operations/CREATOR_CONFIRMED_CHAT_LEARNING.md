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
   `service_role`; the browser cannot mint proposal identities.
2. A human confirmation may bind one proposal only to an **already stored
   outbound** `conversation_messages` row in the same
   Workspace/Fan/Conversation that carries durable manual-send provenance:
   `direction='outbound'`, `message_type='manual'` and `source_type='manual'`.
   A provider-imported outbound is therefore not learnable merely because it is
   marked outbound. Rebinding to a different outbound fails closed.
3. A reaction may only be an independently stored **inbound** message in the
   same Workspace/Fan/Conversation after that outbound.
4. A purchase may only be an independently confirmed
   `creator_commercial_events` purchase for the exact same Workspace/Creator/Fan
   after that outbound. If the existing event already has a `conversation_id`,
   it must match. Current `record_creator_fan_review` events may have a null
   `conversation_id`; for those, the explicit authenticated `link_outcomes`
   action plus the learning row's exact conversation/proposal/purchase IDs is the
   durable conversation association. A purchase event can be linked to only one
   learning row.
5. Missing reaction or purchase evidence remains unknown. The persistence
   contract does not infer outcome, intent, attribution, causality, or revenue
   from text.

The existing pure validator in `src/lib/creatorConfirmedChatLearning.mjs`
remains the metric/summary boundary. Persistence adds durable evidence identity;
it does not weaken the validator.

## Authorization and isolation

- Direct authenticated table writes are revoked. Authenticated users have only
  tenant-scoped `SELECT` through RLS.
- Proposal registration is server-only (`service_role`) and independently
  checks Creator revision plus Workspace/Fan/Conversation scope.
- Outbound confirmation and outcome linking require an authenticated Workspace
  owner/member, active Workspace access and exact tenant/contact/proposal scope.
- Manual-send provenance is read from the durable message row; a later UI click
  cannot turn a generic provider-imported outbound into learning evidence.
- Purchase linking requires an independently confirmed purchase event for the
  same Workspace/Creator/Fan. A non-null foreign conversation is rejected; an
  unbound event is associated only by the explicit authenticated link and cannot
  be reused by another learning record.
- The application API additionally requires the normal trusted mutation/session
  boundary, active processing entitlement, Creator Intelligence availability and
  the dedicated rollout flag.
- No browser route imports or receives the service-role key.

## Runtime API

`POST /api/creators/learning/confirmed-chat`

The route does **not** create proposals. It supports only evidence enrichment for
an existing server-originated proposal:

- `action=confirm_outbound`: requires `contactId`, `proposalId`,
  `outboundMessageId`.
- `action=link_outcomes`: requires `contactId`, `proposalId` and at least one of
  `reactionMessageId` or `purchaseEventId`.

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
