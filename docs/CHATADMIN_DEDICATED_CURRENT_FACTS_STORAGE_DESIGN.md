# FanMind: Dedicated current fan knowledge — bounded storage design (2026-10-18)

**Status: DESIGN_ONLY / NOT IMPLEMENTED / NOT TARGET-APPROVED.** This design is stacked on Draft #1343, which depends on Draft #1342. No schema migration, data write, feature flag, API edit, model/provider call, CI dispatch, merge or deploy is authorized by this artifact.

## 1. Proven current implementation

- `public.chat_character_fans` owns the fan within `(workspace_id, character_id, id)`. Historical controlled schema `supabase/controlled/20260927200000_chat_admin_character_fans.sql` defines `notes text not null check (char_length(notes) <= 4000)`, `summary`, `revision`, composite fan identity, cascading Character FK and an RLS policy scoped by `is_current_chat_admin_workspace(workspace_id)`.
- `src/lib/chatAdmin.ts`: `getChatFan` reads the triple-bound row; `updateChatFan` PATCHes against workspace/character/fan/revision, raising on zero rows; `deleteChatFan` deletes with the same binding.
- On #1342, `src/lib/chatAdminKnowledge.mjs` stores manual text, `facts` (max 8, selected from at most three statements), commercial metadata and source/sequence in one appended v1 JSON envelope, totaling <= 4000 characters. The authenticated ChatAdmin route learns only from a persisted matching `fan_inbound` generation and reports unsuccessful storage as `not_saved`.
- Thus a large preserved manual note can crowd out even one explicit withdrawal. Increasing the v1 budget silently would disagree with the schema constraint and does not solve source-order durability.

These are **repository source facts**, not fresh proof of which optional ChatAdmin schema is currently installed on Staging or Production.

## 2. Required product behavior

One topic, one **currently valid** interest per fan. Newer explicit correction replaces rather than appends a contradictory active fact. Preserve the literal original confirmed message as its evidence; do not synthesize a replacement quote or treat earlier opinions as active truth. A genuinely later reconfirmation can update that same topic. A generic `Das stimmt nicht mehr` without an attributable topic cannot perform automatic revocation. Never remind a fan of their old preference without a specific justified conversational reason.

Separate manual notes capacity from persistent learned knowledge; a full notes field must not block a valid update to a stored current fact. Do **not** promise unbounded interest history or rely on context-window messages for durable recency.

## 3. Proposed *design*, to verify independently before writing schema SQL

Preferred eventual representation: **current-fact rows tied to the existing fan identity**, not a second general-purpose memory architecture.

Conceptual relation (not executable SQL; names and permissions not approved):

`(workspace_id, character_id, fan_id, topic_key, kind, assertion, source_message_id, source_sequence, updated_at)`

- Unique current row by `(workspace_id, character_id, fan_id, kind, topic_key)`.
- `assertion`: current statement with its **literal positive or negative** bound quote and a validated positive/negative classification; no inferred positive from a negative, and no two active states for one topic.
- Source binding MUST reference a stored fan inbound row belonging to the **same workspace, character, fan and conversation**, including stable `generation_id`/sequence; validate that the literal assertion is a complete recognized statement inside that inbound content. Do not accept arbitrary user-supplied source IDs, opaque `memory_source` alone, client-provided ordering or suggested/confirmed-outbound drafts.
- For historical v1 facts with no recoverable message FK, preserve the exact stored source and original `source_sequence` as a *legacy opaque provenance* state; do not fabricate a message FK. Separate migration acceptance is required before changing their classification.
- Atomic upsert with same-topic monotonic sequence guard (`incoming_sequence > stored_sequence`); on equal sequence, only exact idempotent replay of the same source/assertion is allowed. Contradictory equal-sequence writes require deterministic message/statement ordinal validated against the original text, **or fail closed** rather than inventing an ordering.
- A topic-specific sequence alone is insufficient if topic rows can be deleted/evicted. For any future eviction policy, a non-expiring topic-specific high-watermark or equivalent source-evidence rule is needed to prevent old generation resurrection. A full bounded store must not silently discard a current negative and then permit a stale positive.
- Preserve boundaries and communication dimensions separately from interest replacement; no interest update can remove a protective boundary.
- Continue to apply Creator/Character persona isolation, sales guards and human manual send.

**Critical open decision:** Does the existing ChatAdmin persisted fan-message schema expose an enforceable composite FK target for the source ID, including immutable ordering and deletion semantics? This MUST be verified against exact reviewed schema plus isolated PostgreSQL 17 tests, not inferred from repository prose.

## 4. Atomic authorization / API contract

Before any implementation, define one **reviewed write authority** that validates the current Workspace capability, active Character revision, fan/revision, conversation binding and the saved inbound generation. A separate direct client INSERT/UPDATE endpoint is forbidden.

- Prefer a transactionally atomic, narrowly scoped, SECURITY INVOKER server/RPC path if actual SQL and privileges prove this is possible. Never add SECURITY DEFINER merely to bypass an authorization error.
- New relation: RLS enabled from creation; **no default public/anon grants**. Check grants and policies independently, including authenticated user behavior, not just `TO authenticated`.
- Direct writes must not bypass stored-message provenance, source order, Workspace/Character/Fan isolation, manual-note preservation or revision/CAS requirements.
- Any privileged helper needs separate review for function execute grants, `search_path`, row locks, malicious arguments and tenant cross-binding. Never treat service-role access as equivalent to user authorization.
- One transaction must either persist the corrected current fact (and required fan knowledge state) or make **no change**. A stale CAS/source mismatch fails explicitly and must not be misreported as success.
- Keep the v1 `notes` field and its <= 4000 limit for manual notes/legacy until the canonical compatibility plan is proven. Do not overwrite or delete v1 data during a failed transition.

## 5. Phased rollout / backward compatibility

**Phase A — offline-only specification and negative tests.** Prove current table constraints, grants, RLS and message identity/sequence contracts from source; build a controlled SQL proposal and isolated PostgreSQL 17 tests with disposable fixtures. No target API or SQL APPLY.

**Phase B — controlled additive schema:** only after architecture, SQL hash, install profile, migration/recovery and independent security review. New data relation disabled for reads/writes by default, existing application and manual notes unchanged. Separate protected authorization required to install anywhere.

**Phase C — dual-read shadow verification:** only when the installed schema and release identities are proven, compare v1 facts and candidate current rows for synthetic, authorized fans. Never concatenate contradictory v1 and v2 assertions or issue duplicate active interests. Legacy facts with ambiguous source order remain conservative. No actual fan data copied before distinct approved migration.

**Phase D — narrowly scoped writer cutover:** after negative security/sequence tests, idempotence, disclosure/export/delete/retention and independent CI/staging acceptance. The writer chooses exactly one authoritative source per fan/topic; avoid dual writes that can independently succeed and diverge. A rollback must not resurrect a stale v1 positive on reactivating the old reader.

**Phase E — post-cutover retirement:** only after explicit approval, backup/restore and legal retention review. Historical v1 notes must remain available or be reconciled with auditable migration receipts; no speculative destructive cleanup.

## 6. Required test matrix

1. User with 3,990 manual-note characters, valid positive music fact, later explicit negative: manual note remains byte-identical and negative becomes the only current topic state.
2. Newer opposite source followed by delayed older generation: no resurrection; duplicate identical generation returns unchanged.
3. Two claims about same topic in one generation: last *validated* statement wins using recorded within-message ordinal; impossible ordinal fails closed.
4. Boundaries, communication length/style/emoji, commercial holds and unrelated topics unchanged.
5. Max configured topic count and persistence budget: explicit policy, no hidden silent loss of revocations; no conflation with separate notes cap.
6. Workspace A cannot select, mutate, enumerate or delete fan facts of Workspace B; wrong Character/Fan/conversation relation denied.
7. Suggested replies, fabricated message IDs, quoted phrases, unsaved inbound, null/missing sequence, malicious arbitrary topic and sensitive free text cannot become learned knowledge.
8. Fan revision conflict, parallel opposite updates, message deletion, Character deletion, disabled fan, canceled request and transaction failure all have deterministic results with no partial commit.
9. DELETE cascade, full data export, account deletion, retention and restore coverage include the new relation; no orphaned fan facts or unexpected disclosure.
10. Existing actual ChatAdmin API, unchanged CRM, reply-quality/price/usage limits, model-context truncation, manual send and God Mode/Truth guards remain green.

Required: targeted RED then GREEN locally, native PG17 policy/privilege roundtrip, entire affected suite, exact-head Required CI and independent adversarial review. No pass claims from this design.

## 7. Admission gates and explicit blockers

- #1342 is Draft / PARTIAL; #1343 is a dependent Draft. Do not build or deploy a writer that assumes either is merged.
- Existing Creator foundation target drift/activation remains owner-gated; do not use this design as permission for Creator R4 transition.
- Prior to schema implementation, inspect the **actual latest GitHub main**, all relevant schema/contracts, current Project Memory and active source locks; assign one bounded R3 source owner. Protected Staging/Production observation or APPLY needs separate precise R4 authority.
- If the schema cannot enforce saved-message provenance and strictly ordered same-topic updates without altering protected database contracts, return **BLOCKED_SCHEMA_CONTRACT** with exact missing source proof. Do not substitute regexes, prompts or external memory.
- Recovery for this source-only document is deletion/revert of this file; no external target changes have been made.

**Current output:** reviewable proposed design only. No migrations, SQL execution, code changes, new provider calls, live model tests, Staging/Production access or acceptance claims.


## Implementation continuation — 2026-10-18, same PR1345 branch
The design-only status above records the original1344 artifact. Owner continuation
now implements a source-only additive current-interest relation, private checked
writer/public invoker RPC, full composite saved-message identity, immutable source,
per-topic order and same-source statement ordinal. The SQL is a controlled artifact,
not a generic migration, and remains unapplied outside disposable local/CI PG17.
Native tests execute the actual reviewed parent SQL and new SQL; no JavaScript-only
security claim. Operational install, old strict parent-verifier extension profiles,
backup/restore topology reconciliation, protected activation and old-binary rollback
remain explicit admission gates in operations/CHAT_ADMIN_CURRENT_FACTS.md.
