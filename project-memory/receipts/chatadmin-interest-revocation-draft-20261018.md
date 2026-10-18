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
