# Durable current Fan facts — source-only receipt — 2026-10-18

Existing Draft PR1345, branch feat/chatadmin-current-facts-offline-contract-20261018, continues the1342–1344 stack. Fresh preflight main f36e630c73d3820a61aef593a705d241600e7f47; PR1342 f8abdad30702534ff6c200527daf8ed4c671e6d7; PR1343 6c753ef26ac37b70b327d00b7fc287e653c37e49; PR1344 acd01da527ea1bd1fde7d4fe8eb033797ac217e3; PR1345 initial ff38d5e93e781ad144aca039dcb5c43c25bb7503. All open Draft/unmerged; no competing source writer found. Same PR will target main for complete combined required CI.

Owner rule: one Fan/topic/current state, latest explicit stored source replaces prior current state. Supported literal DE/EN interests only,8 topics. Full saved source/binding and statement ordinal, late messages, equal-sequence conflicts and replay validated. Unknown context is not interpreted. Supported communication/boundary companion clauses remain possible.

Independent helper review first: baseline167 tests PASS; test-only commit e15e3a08 records red adversarial coverage before implementation. Duplicate-topic assertion, missing tenant/ordinal binding, invalid current rows and quoted context demonstrated. New default-off runtime uses dedicated source SQL; JavaScript is not a database authorization proof.

SQL SHA256 a980ccc6268e4515f71d2be2ce486d6fd3f7a38745d819b8cd83245505701947. Composite Fan/source references, owner-capability RLS, restricted grants, ordered locking/revision CAS, immutable source references and per-topic atomic upsert. Equal/older opaque legacy source cutoff protects uncertain history; independent safe legacy topics retained without invented references. Source rows remain auditable under existing authorized history, and parent Fan deletion cascades. Scoped export and deletion absence verification include new table.

Evidence before source handoff:
- Focused Knowledge/API/Policy/Quality/Disclosure/Delete/Creator/coverage:311/311 PASS before final checksum test addition. Final Knowledge suite including the checksum check96/96 PASS; exact-head CI lives in PR metadata.
- Native PostgreSQL17:2/2 PASS,0 skipped. Actual canonical base/fan SQL plus new controlled SQL in disposable local PostgreSQL17.11 container, no network/exposed ports. Proves4000 unchanged notes, negative then positive revisions, same-message ordinal, stale/replay noops, eight topics, legacy cutoff, stale CAS, foreign owner RLS/RPC denial, direct CRUD denial, source update/delete refusal, concurrent source lock and competing update retry, marker guard, rollback and Fan cascade.
- Independent Guardian:267/267 focused,7 own helper probes, actual-route dualread,2/2 native PASS. Source-ID and SQL KEYSHARE mutations detected. Equal opaque legacy and source-content concurrency flaws corrected and rechecked. No remaining proven source blocker at reviewed hashes.
- Governance adversarial tests162/162 PASS; memory quality/truth drift/preflight/NBA/v8 PASS (global release BLOCK retained).
- Full Next build/TypeScript PASS; lint0 errors/4 existing warnings; truth/checksum checks PASS.
- Broad local operations:2078 PASS,7 FAIL,8 skipped. Three dirty-checkout protected-control expectations; remaining root/permission behavior and absent age/rsync executables. Do not report this run as green; clean GitHub required checks are final authority.

SOURCE_ONLY_UNAPPLIED, application runtime default disabled. This app flag does not gate direct RPC: before any later SQL installation, existing ChatAdmin capability must be disabled for affected Workspaces or the target fully isolated/synthetic; installation grants SELECT/EXECUTE immediately. No live install/SQL, migration apply, provider, activation, merge, deployment or workflow dispatch. Generic deployment does not apply this SQL. Protected install profile and backup/security-definer topology must first be reconciled and independently reviewed, followed by exact-target Staging acceptance/postflight. Old-binary rollback requires disabling affected capability first. No fabricated backfill/history. Existing manual-notes capacity for noninterest communication/protective/commercial knowledge remains; no universal NLP/model-quality claim.

Recovery is source revert while unused. Global release BLOCK and FM-DEC-031/Phase7b boundaries remain unchanged. Exact final remote head, required App-matched CI and independent CI binding are recorded in PR1345 metadata without changing evidence after CI.

Publication provenance: remote test-first commit4a6e0be3f00f2dd90f393dae16f10aeb58b917d9 has exactly the observed-red local test tree281826e8fcb0ebf8c41793b9da37a4d4b1219db0. Reviewed implementation tree90a7d36e68a0d81ea73196504e0b83282fae8a60 was published in the same existing Draft1345, now targeting main. Both specifically blocked documentation uploads were explicitly authorized by Owner before publication. This provenance-only continuation changes no runtime/SQL; final current-head Required CI and independent binding remain in PR metadata.

## Installation-preparation continuation — 2026-10-18 — BLOCKED

Task FM-CHATADMIN-CURRENT-FACTS-INSTALL-PREP-20261018, explicit new Owner task. Source preparation/read-only only; no SQL APPLY, activation, merge, deploy, feature/capability change, provider/model call or Production database query. Existing1345 branch retained; no new implementation/PR.

Fresh GitHub bindings: main f36e630c73d3820a61aef593a705d241600e7f47; PR1342 f8abdad30702534ff6c200527daf8ed4c671e6d7, PR1343 6c753ef26ac37b70b327d00b7fc287e653c37e49, PR1344 acd01da527ea1bd1fde7d4fe8eb033797ac217e3, PR1345 a7db84654b422262bee4fd81f68e432c7b34851c. All open Draft/unmerged. Active strict ruleset24945113 independently binds12/12 Required by Context+AppID (CodeQL57789, others15368),14/14 terminal success records. Documentation-only continuation final head/CI belongs to PR metadata. SQL SHA256 a980ccc6268e4515f71d2be2ce486d6fd3f7a38745d819b8cd83245505701947 unchanged, offline manifest checker PASS.

### Bound target and observed parent state

Only Supabase FanMind Staging vshyhvgcmrlagvfnvomc, observed ACTIVE_HEALTHY, PostgreSQL17.6, distinct project from Production. Documented Staging URL staging.fanmind.ch; separate service/user/ENV on shared Web host is not separate infrastructure. No fresh host/deployed-release/configuration isolation attestation is available in this managed environment (no host identity/credentials configured). Supabase connector supplies authorized catalog access, not host access.

Read-only repeatable-read aggregate observation15:15:22.656165UTC: capabilities0, active capabilities0, Characters0, Fans0, conversations0, messages0, active ChatAdmin RPC sessions0. New facts table, current_facts_version, private namespace and new public RPC all ABSENT. No Fan quotes, notes, identity or other customer contents read. Empty ChatAdmin tables do not classify unrelated Staging datasets.

Read-only catalog observation15:18:23.855836UTC: all five parents RLS enabled; sales_playbook/customer_tier present; current_facts_version absent; browser capability table-level mutation grants0; new private functions0. Actual source-bound composed base/Fan/Offers/Tier postflights all completed without exception; corresponding feature objects are present, so this is not an ABSENT early return. Reused profile query digests (psql directive removed; fixed success SELECT appended before rollback):
- base9deba5f55fc6d3b1313c815891093f90733be211bc83e784d92cb42415ea30d6
- Fan0d864eb6b8e0094fc70c91328daa236ba28bfa2126d42af24a78debb1ac6adea
- Offers5ecd4769857b1d3a7c6cba4cc157cd50165a39707ea63f1e82dcc0c034372e91
- Tier a54cf6f094e3e1f0aac437222afcee45437584b19d53b67f52b150f74ef07bd8
No DDL/helper/fixture was used on Staging. The observation does not prove installed new RLS/grants: new objects do not exist there. Their source behavior is supported by native tests only.

### Exact candidate scope, not an admitted install profile

Candidate target project and SQL are pinned above; future transport must bind postgres.vshyhvgcmrlagvfnvomc, Staging session pooler5432, TLSverify-full and protected staging environment, using then-current reviewed main and Production exclusion. No secrets/passfiles were created. Current1345 source is not merged into main, and no ready install runner/workflow/profile for this extension exists. No dispatch/apply command is supplied or authorized.

Required exact delta: fan current_facts_version column/check/guard; message full-source unique index and source guard; chat_character_current_facts table with all composite source/Fan constraints, policy and grants; private namespace with literal_interest/neutral_statement/source_interests invokers, apply_generation/guard_source/guard_authority_marker definers; public invoker wrapper and exact execute grants. No unrelated object, count widening or generic namespace approval.

### Blockers and security finding

1. Runtime capability exclusion UNVERIFIED: ensureStagingChatAdminCapability can upsert a capability for configured preview IDs. A zero-row observation is not a durable disabled state; exact deployed release plus preview/autogrant/other writer exclusion needs protected host readback. Appflagoff is not an RPC gate. No broad synthetic-only target claim.
2. Install profile MISSING: existing strict Fan checks reject the new column/check/index/two parent triggers. An exact opt-in extension composition must preserve all existing base/Fan/Offers/Tier checks and fail closed on extras. Existing locked harness must not be weakened.
3. Backup/private authorization profile INCOMPLETE: pg_dump covers application schemas and the general catalog fingerprint includes ACLs, but explicit security-definer topology checks filter public. Exact private function signatures/owner/search_path/body/execute grants need admission coverage; no blanket schema/count allowance.
4. Backup/restore acceptance MISSING: a full dump/restore plus extended authorization-contract roundtrip of the new facts/sources/marker/RLS/ACLs has not been executed. Existing functional SQL tests and parent cascade tests do not replace this evidence. Staging backup_runs read-only observation15:19:55.673218UTC reports0 staging-tagged rows, DB backups, Full backups and verifications. External artifacts were not accessed; no claim that no external backup exists.
5. Coordination OPEN: historical LOCK-FM-ADMINCHAT-STAGING-HARNESS-20261011 ACTIVE_STAGING_COMPLETION and LOCK-FM-CHATADMIN-LIVE-REPAIR-20261014 ACTIVE_SOURCE_REPAIR remain untouched. Their prior/consumed authorizations do not authorize this install; current instruction expressly forbids writes.
6. Rollback only partially evidenced: new binary fail-closed marker and source preservation pass tests. An old-binary rollback requires sustained capability/autogrant exclusion first; restoring old positive preferences by resetting marker/deleting facts/flag-only rollback is forbidden. Actual protected target recovery/backup attestation remains missing.

Independent Guardian adversarial review confirmed strict-profile rejection and public-only topology coverage, differentiated dump inclusion from security admission, and required coordinated locks and fresh capability proof. No remaining proven defect in current-fact source behavior is asserted; these are installation prerequisites. Independent Guardian target observation15:23:00.815794UTC separately confirms project identity/health,5 parent tables with RLS, all ChatAdmin/capability counts0 and all new objects ABSENT under repeatable-read READ ONLY. No Auth-session contents, Fan data or Production query. Guardian also verified all four query hashes and the preview autogrant path; BLOCKED classification confirmed.

Fresh tests actually run for this continuation: Knowledge+actual API integration185/185 PASS,0skip; native PG17 structured-offers/current-facts2/2 PASS,0skip in a fresh no-network/no-exposed-port local PostgreSQL17.11 container. The current-facts case proves4000 unchanged manual characters, one music state, later negative/positive, actual source/ordinal/order, no old-context preference, late/repeat rejection, foreign-owner RLS, direct CRUD denial, concurrency, rollback and cascade. No real model/provider call. The first local invocation used a container name instead of the required hexadecimal ID and failed before SQL; corrected ID run is the reported PASS. No controlled SQL or runtime source changed.

Terminal state BLOCKED for installation preparation, not INSTALL_PREPARED. Owner instruction says stop if prerequisites cannot be verified; therefore no new install architecture, no profile weakening, target mutation or substitute protected task is attempted. The bounded task stops with evidence/Runbook/Project Memory reconciliation.

Next: first obtain/read existing protected host evidence for exact release, preview/autogrant exclusion and isolation, coordinate locks, then complete separately reviewed exact extension/backup/restore admission preparation. Current Owner task already authorizes suitable read-only inspection; technical access/evidence is missing, not an inferred need to reauthorize the same SELECTs. Only after all prerequisites and exact-main/source/target binding are green would a fresh explicit one-time Staging-only install authorization be appropriate, with protected environment approval, immediate exclusion recheck, verified backup and independent pre/postflight. That later authorization must exclude activation/provider/Production writes; changing a flag/capability or restoring data needs its own exact protected scope. No such authorization is requested or implied now.

## Offline profile and synthetic full recovery — 2026-10-18

Task FM-CHATADMIN-CURRENT-FACTS-OFFLINE-PROFILE-20261018; R3. Status
OFFLINE_PROFILE_READY; real installation and activation remain BLOCKED.
Existing Draft1345 only, continuation parent3471b1d6e80fc38679e0914d572a9de6976f417a;
mainf36e630c73d3820a61aef593a705d241600e7f47. Preflight re-read GitHub head,
AGENTS, Execution Policy v6, Project Memory and all locks. No competing source
writer in new Current-Facts files; same-holder continuation and independent
Guardian established narrow boundary before writing. Retained Harness/Live-Repair
locks and protected old source remain unchanged. Final immutable commit and
Required CI are bound in the existing PR description after publication.

### Source/checksum contract

- Controlled SQL unchanged:
  `a980ccc6268e4515f71d2be2ce486d6fd3f7a38745d819b8cd83245505701947`.
- Read-only catalog SQL:
  `7db4480ceb0af094bc91ae8d910782321961b191293d767d6a9a565fa6792f0c`.
- Fixed golden JSON:
  `86a00c2039c841dbde3cd8d28f64a8bec1d8c889621b6e04e9ba6c2e234ed5ab`.
- Verifier source:
  `050f87a28edc0f1948e563e605d6118c87b361a91c8afe954319dd2e0f8ab71f`.
- Native/unit cases source:
  `1841e8794d564179f99581b97c3cd73ceb6b2ea0bfab598b613d121af303e5dd`.

The pure offline verifier pins four canonical parents, all four existing verifier
modules, composed Base, existing backup authorization contract and original
synthetic fixture. All these files remain byte-identical. Static import in the
already registered PG17 suite owns new cases; package/workflows are unchanged.
Fixed baseline328 and current413 records include every canonical parent/new scoped
object, complete definitions and ACLs, private topology and database/schema/role
privilege facts. Unknown scoped additions and changed properties fail closed.
No actual-target catalog becomes its own expected reference. See the dedicated
operations profile for exact boundary and narrowly accepted PG17 CHECK rendering.

### Executed native evidence

Final run follows the existing unmodified FanMind PG17 ICU initialization exactly:
`--encoding=UTF8 --locale-provider=icu --icu-locale=en-US --locale=en_US.UTF-8`.
Pinned provider i, locale en-US, null custom ICU rules and collation version153.128;
locale/rules/version mutation tests fail closed. Earlier successful libc-image
default runs are superseded for architecture binding. No hosted locale was read.

Pinned PostgreSQL17.11 image digest
`e38411452a464af89e5adadb8d223bf53b898d47d6ef918b2d58c08707350449`.
Two distinct fresh containers, network none, no published ports/host mounts;
anonymous PGDATA volumes removed with containers. Synthetic fixture only.
Full custom pg_dump, unfiltered owner/ACL/schema/data, same archive restored by
pg_restore exit-on-error/single-transaction into an empty different container.
Restored complete rows and sequence state compare exactly to source; strict
current catalog passes. A second empty restore copy removes only known extension
objects with RESTRICT and executes all four literal unchanged read-only original
postflights, then matches baseline328. Actual restored extended state remains intact.

- Final registered native suite, including both unchanged native tests:44/44 PASS,
  0fail/0skip;40 native mutations. Dump SHA256
  `1bc7e11f93bdb6b6c69f2dbad0cf661c8326d3d0645461f6af45b40de767cb58`.
- Independent final ICU review and archive digest are recorded in the closeout
  below. Guardian regenerates the fixed reference separately and adds three own
  Character RLS/public-CREATE/neutral-view-rule probes to the complete final source.

Archive hashes differ between independently created synthetic databases/runs;
each individual run verifies the exact bytes it restores. No hash is represented
as a real Staging backup artifact. Temporary archives stay in process memory.
Post-restore behavior proves negative music replaces positive beside4000unchanged
manual notes, old source persists, authority/revision state persists, denied foreign
owner/cross-Fan/direct write, private ACL/body identity, immutable source and marker,
late/replayed no-op, newer positive replacement, Fan/Character/Workspace cascades
and unrelated Fan preservation. Constraint deferral is forced before cascade PASS.

All40 native profile mutations are successful DDL followed by explicit verifier
rejection and full rollback checks. They cover new/altered relations/columns,
constraints, triggers, indexes, RLS, routines/signatures/bodies/owners/search_path,
ACLs/grant options/column grants/defaults, schema/database ownership, role bypass
and transitive membership, neutral disclosures, CHECK changes and sequence drift.
Unit mutations additionally reject changed source/query/reference checksums,
missing/extra catalog entries, wrong PG major and caller-supplied fake reference.
Independent native findings were reproduced RED and corrected: neutral views,
incoming role grants, public CREATE/DBowner and singular-prefix Character omission.
No syntax error or child-test failure is accepted as successful mutation rejection.

### Honest remaining boundary

No Staging/Production connection in this continuation; no target SQL apply, real
fan rows, real capability/flag writes, deploy, merge, workflow dispatch or provider
call. Capability fixture writes exist solely in synthetic throwaway databases.
This profile proves a logical offline contract, not entire hosted role topology or
unrelated dynamic SQL. Existing backup-worker implementation is unchanged.

Still required before any later protected installation: current deployed host/
release and sustained preview/autogrant/capability exclusion; exact hosted role/
owner/default acceptance; applicable retained lock coordination; protected install
and installed worker/private-function authorization integration; actual current
backup artifact provenance/retention and independent full recovery evidence for
that actual backup. Historical target observations above were not refreshed here.
No claim that actual Staging backups or running host configuration were tested.
Global release BLOCK and FM-DEC-031 remain unchanged. Recovery here is source
revert and removal of owned disposable containers only.

Local closeout checks: suite-registration1/1 and God-Mode unittest discovery123/123
PASS; Project Memory quality, Truth Drift, NBA manager/check, Memoryv8 and product/
referral/legal/action-pin truth verification PASS. Expected negative God-Mode unit
fixtures still print BLOCK; the global release decision was not changed.


### Final canonical ICU independent closeout

Independent Guardian final run45/45 PASS,0fail/0skip,43 native mutations (40final
source plus3 own probes), full cross-container dump/restore, separate inverse copy
and all4 original postflights, post-restore RPC/4000notes/replay/marker/cascades PASS.
Independent archive SHA256
`617d5dba925b5e6e64f92bdf6974d0abdb07c1f486dac718ea5453ee181afb7b`.
Independent golden regeneration exactly328/413 under the canonical ICU arguments;
query7db4480c/ref86a00c20/checker050f87a2/tests1841e879 match the full hashes above.
No remaining concrete blocker in the bounded offline profile. Final exact-head CI
must bind this ICU correction, not the preceding libc-only source commitf826a651.
Work-lock released only for the existing DraftPR; no target lock or protected gate
released. Status OFFLINE_PROFILE_READY; actual host/backup/install remains BLOCKED.
