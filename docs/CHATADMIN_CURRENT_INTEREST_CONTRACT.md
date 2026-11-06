# ChatAdmin — one topic, one current interest (source-only contract)

Date: 2026-10-18. Scope: product definition and acceptance criteria for the existing ChatAdmin contact-knowledge path. This document is **not** runtime, migration, model, or end-to-end acceptance.

## Owner product decision

When a fan explicitly corrects an interest, FanMind replaces the superseded current interest rather than retaining two simultaneously valid opinions.

Example:
- Saved earlier: original source `Ich liebe Musik.` -> current interest music=positive.
- Newer authenticated, saved fan message: `Ich mag Musik nicht mehr.` -> current interest music=negative with the new **literal** source quote and order.
- The earlier positive interest is no longer a current fact in the generated model context.
- A still later `Ich liebe Musik.` can become current again only with a newer genuine authorized source.
- The previous statement belongs in the existing authorized conversation/audit evidence where available; it is **not** a second current preference and is not automatically reintroduced into conversation.

Do not invent a normalized fan quote (`Der Fan mag keine Musik`) or infer a new preference from ambiguous input. Wording for model display can be derived from source evidence but must not overwrite the verbatim source or imply more certainty than the fan expressed.

## Current source behavior to preserve

PR #1342 (dependency, Draft as observed 2026-10-18): `src/lib/chatAdminKnowledge.mjs` extracts bounded explicit DE/EN preferences and withdrawals, sorts by saved generation sequence, removes overlapping old interests, retains newest verbatim negative, and admits later positive reconfirmation. `src/lib/chatAdminPolicy.mjs` forwards retained facts to the model context; the existing `/api/chatadmin/reply-suggestions` route requires the same bound workspace, character, fan, saved `fan_inbound`, sequence, revision/CAS, and post-check authorization. Only the current knowledge facts are model-current; previous dialogue remains a separate, possibly truncated history. All operations continue to require manual sending.

Existing `readChatAdminKnowledge` uses the fan notes v1 marker. `writeChatAdminKnowledge` caps **the whole serialized fan.notes** at 4,000 characters and learned facts at eight; extraction selects at most three statements. A 4,000-character cap is **per fan notes field**, not per interest or pooled across fans.

## Safety-critical update contract

1. Identify the topic and explicit positive/negative assertion only within the approved, non-sensitive vocabulary. A generic `Das stimmt nicht mehr` without grounded topic does not update a current fact.
2. Validate the exact verbatim source against the bound saved inbound message, its fan/workspace/character/conversation and source sequence, and prevent delayed replay from overwriting a newer claim.
3. For a valid newer contradictory assertion about a topic: atomically **replace** the prior topic's current interest; do not append two active states or invent a residual quote from a compound statement.
4. Preserve unrelated current interests, manual notes, independent communication preferences, all protective boundaries, commercial state, original source evidence and source order.
5. Expose only the new currently valid fact to downstream answer context; never use a stale positive fact as a second current truth. Do not proactively remind the fan of past preferences.
6. Retry/idempotence and failed CAS checks must not promote a stale or cross-tenant update.
7. If the replacement cannot fit within the current 4,000-character notes envelope *without deleting preserved data*, return explicit `not_saved` / recoverable failure; never claim the old value was replaced.
8. No automatic sending, model/provider activation, extra API retry, change to shared price/quality contract, or external connector work.

## Explicit capacity blocker and smallest safe next design

A 3,990-character **manual** note cannot necessarily accommodate even one serialized fact plus source metadata under the 4,000-character *shared* limit. Replacing the old positive fact rather than appending already saves space where possible, but does not guarantee capacity. Deleting manual notes, silently dropping unrelated protective boundaries, removing provenance, or incorrectly reporting success is unacceptable.

The separately reviewed next decision should **first** assess whether existing authorized fan storage supports a backward-compatible dedicated current-fact field/row per fan with protected RLS and atomic source ordering. Only if necessary should it propose a tightly scoped controlled migration. This must be treated as a separate R3 source / R4 protected target task; no SQL apply or target assumption is authorized here. The source specification must cover old v1 notes compatibility, dual-read transition, one-topic-one-current-state enforcement, deletion/export/retention, tenant isolation, concurrency/CAS, history availability, bounded model-context rendering, and failure/retry semantics.

No guarantee of unlimited historical knowledge or future model quality is made by merely separating capacity. The full data-model design is *not* approved solely by this document.

## Evidence and non-goals

Existing #1342 tests in `tests/chat-admin-knowledge.test.mjs` and `tests/chat-admin-api-integration.test.mjs` already check source-ordered interest replacement, later reconfirmation, historical context truncation, stale replay, limited extraction, tenant binding, and explicit overflow failure. Independent reported source checks and exact-head CI for #1342 are linked in its PR description. The feature remains PARTIAL; #1341 anti-redundant-question acceptance is separate and unresolved.

Acceptance of a later implementation must include RED/GREEN tests for same-topic replacement and replay, unchanged unrelated notes/boundaries, near/full manual notes, concurrent generation ordering, durable source provenance and revision conflict, authorized read/write/delete/export, and actual-route context after history trimming. Never reclassify existing green diagnosis tests as a product acceptance.

No code, database, provider, staging, production, Stripe, social, mobile or company-data operations are in this documentation-only follow-up.
