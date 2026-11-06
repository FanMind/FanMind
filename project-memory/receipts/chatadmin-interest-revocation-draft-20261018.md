# ChatAdmin explicit interest withdrawal — draft source receipt (2026-10-18)

Status: DRAFT_NOT_ACCEPTED. Task: FM-CHATADMIN-INTEREST-REVOCATION-20261018. Risk: R3 source-only.

## Verified preflight
- Canonical main at work start: `f36e630c73d3820a61aef593a705d241600e7f47` (GitHub branch read).
- PR #1341: open/Draft/unmerged, head `d38670ec73fdbbe4d005ad933ea3f0440dc993c3`; diagnostic only, explicitly no actual feature repair.
- Read: `AGENTS.md`, `project-memory/{CURRENT_STATE,WORK_LOCKS,STARTED_WORK,NEXT_BEST_ACTION,DECISIONS}.md`, existing `src/lib/chatAdminKnowledge.mjs` + declaration, `src/lib/chatAdminPolicy.mjs`, actual `src/app/api/chatadmin/reply-suggestions/route.ts`, existing knowledge tests, relevant quality/ChatAdmin documentation.
- Distinct branch: `fix/chatadmin-interest-revocation-20261018`. Initial RED-intent test-only commit: `3209a9751cedb7515c1f6999f25b9c81a7cf26c0`. No pre-change test runner was available in the current execution environment; this is a test-first commit, not a claimed observed red run.

## Narrow source design
- Preserve existing Fan notes v1 marker, 8 facts, 4,000-char envelope, `source`/`source_sequence` provenance, manual notes, commercial state and RLS/storage lifecycle.
- Extract only explicit, grammatically bounded DE/EN revocations of single named supported non-sensitive interests. Generic ambiguous changes remain unsupported.
- Persist the literal negative quote as the current `interest` fact; remove overlapping older positive fact, decline stale/replayed source sequence, permit a strictly newer explicit positive reassertion. Do not synthesize leftover components of multi-interest quotes.
- Existing real route continues to require authority, persisted `fan_inbound` content, generation ID, recorded sequence, CAS fan revision, and post-save authority check.
- Keep workspace/character/fan isolation, boundaries, current Creator writing style, human manual send, price gates, rate/usage/model retry semantics unchanged.

## Open verification / limits
- No live model quality evidence; no claim that generic revocations can be disambiguated, or that anti-redundant-question behavior is corrected.
- Full tests / API regression / CI / independent review on final PR SHA still required. No acceptance until witnessed; no external runtime or Production/Staging write.
- Eight-fact capacity remains finite. A long sequence exceeding the bounded knowledge store cannot give an indefinite full-history guarantee.
- Recovery: reviewed source/docs/test revert if CI, review or adversarial tests expose regressions.
- No merge, auto-merge, deployment, workflow dispatch, Supabase/schema apply, provider call, Stripe, social connections, mobile, or company-data actions authorized or performed.


## Continuation / independent evidence — 18 October 2026

Status: PARTIAL, no runtime acceptance. Prior statements are historical evidence.
GitHub main was freshly f36e630c73d3820a61aef593a705d241600e7f47; existing Draft head
cb01c2ee8923b94829a010baf5448625bd8b9899. Current Required Truth+PG17 logs reproduce
capacity_checksum_invalid. Five initial blob hashes and full tree0298a060 match
GitHub; shell Git transport failed at the proxy, so the connector is used.

Observed test-first local commit1bff960b:17 tests/8PASS/9FAIL before correction.
Additional protective-priority negative:83 tests/82PASS/1FAIL before correction.
Changes stay in existing Knowledge/actual route: full literal interest provenance,
DE/EN negations, ordered same-source corrections, protective/withdrawal extraction
priority, existing fact sequence cutoff and explicit overflow not_saved. No new
table, general memory architecture, provider call, quality guard or runtime gate.
Tests consolidated in already registered Knowledge suite. package.json exactly
matches freshly fetched GitHub-main and its existing Capacity checksum.

Builder:306/306 focused tests PASS (Knowledge, actual API, Policy, Quality,
registration, offers, Creator API/Policy); zero skips/failures. Initial five-suite
baseline174/174 PASS. Original standalone7 tests were actually run before merging
them into Knowledge. Actual-route tests use synthetic stubs only and prove negative
persisted quote/source/sequence, current revision arguments, idempotent generation
retry, saved direction/content/sequence, failed persistence/CAS, authority loss,
Quality denial, foreign fan binding, and the next context without history.

Separate Guardian, no source writes:140/140 API/Knowledge/revocation regression,
6/6 own targeted probes PASS. Independent findings reproduced actual-route
fourth-clause loss, same-event correction failure, full8 eviction+older replay and
4000 unchanged false status; final own probes confirm repairs. In-memory removal
of both ordering checks is detected by an independently written replay assertion.
Foreign workspace/fan/history denied before provider or writes. Final Source/CI
binding is separately recorded in PR metadata after publishing the final head.

Functional limits remain explicit:
-4000 chars: if the literal withdrawal cannot fit while preserving manual notes,
 the old positive remains. Route reports not_saved. Universal persistent revocation
 is NOT proven or accepted; safe follow-up needs a bounded storage-conflict design.
-Max3 selected facts per incoming message and8 stored facts, no unbounded history.
-Protective boundaries first, then withdrawals under extraction pressure.
-Conservative cutoff may decline an unrelated delayed interest update.
-No inference from vague/conditional/quoted/unsupported changes; no real model
 quality, generic anti-reasking, external runtime or deployment acceptance.

Recovery: reviewed repository revert of this bounded source/test/doc change, no
external cleanup needed. FM-CONTRACT-CHATADMIN-AI-001 and both ChatAdmin AI/storage
integration boundaries are exercised synthetically, not marked runtime VERIFIED.
Global God Mode remains BLOCK; no Owner action for a protected boundary is needed.

Local project checks: full ESLint PASS (0 errors/4 existing warnings), verify:truth
PASS, memory quality/truth drift/updated SoT drift fingerprint PASS. God Mode
preflight and release-decision --check PASS with unchanged baseline BLOCK;
162 governance adversarial tests PASS. Production build compiles successfully,
then fails because this executor denies Node spawnSync (EPERM) for TypeScript
--showConfig. Two manual-flow child-CLI tests fail for the same local restriction;
no passing local build/manual-flow claim. Final GitHub CI must independently run
those paths. The expanded eight-suite306/306 proof uses --test-isolation=none to
execute all assertions despite the same child-process restriction.

Final independent source review:204/204 focused,7/7 own probes incl protective extraction priority and next-route sales hold PASS; in-memory removal of ordering guards detected again. No new Source regression; PARTIAL limits retained. Final SHA256: knowledge dda5245bab093f5df72f33e4c652db46c504b11749fb469855e6f8190701097f; route d66c6391678cc1aa0427afafb2393988e3bf6f4ac4bb6baec63da45433bf6c2d; Knowledge test ad583bf39a517d8944ba35ffe9a422d85c9b9ac94a1e4345ab694824dd174d85; API test19c9c0bf096781446ea7518eed140a408e9a6046bff302bfa370791e593aa23c. Source lock RELEASED_FOR_PR_PARTIAL. No independent worker retains a write reservation.
