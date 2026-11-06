# ChatAdmin current interests — controlled source contract

Status: SOURCE_ONLY, DEFAULT_OFF, UNAPPLIED on Staging/Production. Date2026-10-18.
Existing PR1345 branch only. The branch includes reviewed1342 plus the1343 product
contract and1344 design. Retarget the same PR to main for the full existing CI;
no second implementation, merge, deploy or live target change.

## Representation and authority

`chat_character_current_facts` has at most eight closed topic keys per fan: music,
cats, dogs, travel, sports, photos, videos, cooking. Its primary key is
(workspace_id,character_id,fan_id,topic), with composite fan cascade and source FK
(workspace_id,character_id,fan_id,conversation_id,message_id,sequence). Literal
quote, polarity and statement index come from the actual saved fan_inbound
message, not caller claims. The source generation must have exactly its saved
inbound plus three suggestions. No drafts, incomplete or foreign generations.

Only complete supported DE/EN interest statements and existing safe
communication/boundary companion clauses qualify. Unknown, quoted, hypothetical,
sensitive, compound-interest and otherwise mixed unsupported context is declined.
All supported topics in a message are processed (not the v1 three-fact limit).
Last validated statement per topic wins; original quote is retained verbatim.
No invented residual compound quote and no general language interpretation.

The private SECURITY DEFINER operation locks live capability/owner and then
Character,Fan,Conversation in the existing order, requires active rows and exact
revisions, and holds FOR SHARE on the saved source until commit. Browser roles
have only RLS-protected SELECT; service_role only SELECT for the existing protected
export/absence-verification pipeline. No direct INSERT/UPDATE/DELETE grants.
The public RPC is SECURITY INVOKER with explicit execute grants. Source contents,
direction/generation cannot change behind a referenced fact; source deletion is
restricted, with deferred integrity allowing atomic fan/Character/Workspace cascade.

Newer source replaces its topic atomically. Older source is unchanged; exact
source+sequence+ordinal+quote replay is unchanged. Equal conflicting order fails
closed. Fan revision increments only on change and serializes concurrent writers.
A failed transaction commits neither fact changes nor revision. Manual notes,
commercial state and existing communication/boundary learning are independent.

## Compatibility and rendering

FANMIND_CHAT_ADMIN_CURRENT_FACTS_ENABLED defaults off. It gates only the application
reader/writer, NOT direct database RPC access. Installing the SQL grants authenticated
SELECT and RPC EXECUTE immediately; an enabled authorized ChatAdmin owner could call
the RPC directly through PostgREST regardless of the app flag. Before ANY installation,
the existing ChatAdmin capability MUST be disabled for affected Workspaces (or the
entire target must be isolated and synthetic), and remain disabled until independently
accepted activation. There is no separate database activation switch in this artifact.
With the application flag off, uncut-over fans
retain the v1 path. With it on, table-read failure blocks generation before provider
instead of falling back to stale knowledge. The new writer never writes interests
into notes; post-persist authority is rechecked. A recoverable store/CAS failure
returns not_saved, never false saved or a legacy interest fallback.

A valid literal v1 interest with positive safe source_sequence can remain for an
independent topic, explicitly marked legacy_opaque, without inventing a message FK.
Only one valid highest-order legacy fact per topic is exposed. New current rows
supersede matching legacy topics, so an old positive is never a second active
truth beside a current negative. Conflicting equal legacy facts fail closed.
Compound/invalid/unordered legacy facts are conservatively excluded; no real fan
backfill or migration is performed. The writer keeps a conservative existing-v1
ordering cutoff, including equal opaque order, to prevent a delayed first update
from overturning newer legacy evidence. This may decline unrelated delayed updates.

A durable fan current_facts_version marker changes0->1 on the first current-fact
write; it cannot be reset by ordinary writes. If the flag is then disabled, the new
binary refuses the cut-over fan instead of showing stale legacy interests. An
older binary necessarily does not understand the marker: BEFORE any old-binary
rollback the capability must be disabled under separate protected authorization.
Never roll back only the environment flag or delete topic rows to revive v1.

Full-context construction still honors the existing input budget and price/sales/
manual-send safeguards. Historical conversation remains separate source evidence,
not additional current preferences. A model can still misunderstand context;
synthetic tests do not accept real model quality. The dedicated store covers the
eight approved interest topics; the independent legacy notes path for communication,
protective boundaries and commercial state retains its existing capacity limits.

## Privacy, recovery and protected gates

The existing protected data disclosure includes all current rows with the same
Workspace filter and bounded pagination, including DE/EN PDF labels. Account
removal verifies absence of the new optional table after parent deletion. Fan,
Character and Workspace cascades remove facts and sources atomically. No new
analytics, provider, auto-send, retention worker or unbounded audit/history store.
Retention follows the existing fan/source lifecycle; individual referenced-source
removal is refused until its current knowledge lifecycle is deliberately reconciled.

The checksum-pinned controlled SQL and manifest are offline source artifacts only.
Normal deploy and generic supabase db push MUST NOT apply them. Native disposable
PG17 evidence does not prove installed target state. Before any protected install:
first prove the existing ChatAdmin capability is disabled on the affected target
(or prove fully isolated synthetic scope); verify exact reviewed main/tree/SQL checksum
and target; update the separately
reviewed strict parent-schema/install profile and backup/restore inventory for the
new column,indexes,table,schema,functions,triggers; prove grants/RLS, source FK,
export/delete/retention, zero real-data backfill and a capability-disabled recovery.
An isolated Staging acceptance and independent postflight must precede any writer
or reader activation. No such target authorization or action occurred here.
Source recovery is a reviewed revert while uninstalled. After cutover, do not
re-enable old readers without a reviewed knowledge reconciliation/recovery plan.

## Executable evidence

Existing registered Knowledge/API suites cover full source/tenant/order validation,
old/equal/repeat, whole-message ordinals, unknown context, legacy dual-read,4000
manual characters, next context with no history and default-off/missing-schema/
cutover-failure behavior. Existing registered chat-admin-structured-offers-pg17
suite runs a separate disposable database from the actual base+fan+new SQL and
proves all eight topics, notes preservation, grants/RLS/CAS, concurrent opposite
updates, concurrent source mutation, idempotence, rollback, source immutability,
opaque legacy equal order and cascade. Protected target/runtime acceptance remains
separate. Exact final test/CI evidence is recorded in the existing PR metadata.


## Install-preparation assessment — 2026-10-18 — BLOCKED

The next-phase Owner task authorizes observation/preparation only, not installation.
Fresh Staging project identity is vshyhvgcmrlagvfnvomc (separate Supabase project;
the documented Web service shares the Production host with separate service/user).
Read-only observations at15:15–15:20UTC found all five parent tables present and
empty, zero capabilities and active ChatAdmin RPC sessions, all parent RLS enabled,
Offers/Tier columns installed, and the new relation/marker/private schema/RPC absent.
The existing composed base, Fan, Offers and Tier catalog postflights completed
without exception; no temporary helper or fixture was installed. This is a snapshot,
not proof of ongoing capability exclusion or of Web-runtime isolation.

IMPORTANT: ensureStagingChatAdminCapability in src/lib/chatAdmin.ts can automatically
upsert a capability for the configured preview Workspace/User. Zero stored capability
rows does NOT prove that this path is disabled. Before installation, independently
prove exact deployed release, target binding and preview/autogrant exclusion with a
protected host/configuration readback, and serialize all capability writers. The
managed environment currently provides no host credentials/readback for that proof.
Do not log preview IDs, secrets, passfiles or configuration contents.

A complete executable install profile is NOT prepared. The existing strict Fan
postflight rejects the added current_facts_version column/check, message source
unique index and two parent triggers. It must be composed with an exact opt-in
extension profile, preserving all existing parent checks and rejecting other extras;
locked harness/rollout paths must not be weakened or silently changed.

The existing pg_dump includes application schemas, so the new private schema is not
inherently omitted. The authorization contract's explicit definer topology checks
filter public, however. The three private definers apply_generation, guard_source,
and guard_authority_marker need exact owner/search_path/body/grant/signature coverage,
as do the three private invokers and public wrapper. No generic namespace/count
allowlist is sufficient. A native full dump/restore plus authorization roundtrip of
this extended profile, including source FK/data/marker/RLS/ACLs, remains unproven.
The Staging backup_runs ledger has zero staging-tagged DB/Full/verification receipts;
external artifacts were not examined. This does not assert that no backup exists.

The active historical Harness and Live-Repair locks remain unchanged. They require
explicit coordination before overlapping protected writes. No current-Facts SQL was
changed, installed or activated. Existing isolated native behavior tests are green;
they do not close the absent installation/backup/runtime proofs. Old-binary rollback
still requires capability/autogrant exclusion first and preservation of new facts.
See the dated install-preparation continuation in the existing source receipt.

## Offline prerequisite continuation — 2026-10-18

The offline profile and complete synthetic PG17 dump/restore are now documented
in [the checksum-bound offline profile](CHAT_ADMIN_CURRENT_FACTS_OFFLINE_PROFILE.md).
They close the source-only catalog/private-topology and synthetic-recovery evidence
gaps above. All four previous postflights remain unchanged; canonical SQL still
has SHA256 a980ccc6268e4515f71d2be2ce486d6fd3f7a38745d819b8cd83245505701947.
OFFLINE_PROFILE_READY does not change the BLOCKED installation/activation status:
real host/autogrant exclusion, hosted ownership/roles, installed backup worker,
actual backup artifacts/recovery and retained target-lock reconciliation remain
unverified. No remote database connection occurred during this continuation.
