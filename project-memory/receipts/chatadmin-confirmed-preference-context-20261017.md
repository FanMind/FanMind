# Confirmed preference retention across topics — source receipt, 2026-10-17

Tasks FM-CREATOR-001 / FM-CHATADMIN-003. Risk R3 source.
Base main `2be45e2602d65e9c670c25975245f3fd406f2f9e` confirms PR1338 merged
from5aa4b7b9; its offer/price/ambiguity/negation work is retained, not repeated.
Branch `fix/chatadmin-confirmed-preference-context`.
Affected consumer boundary: FM-CONTRACT-CHATADMIN-AI-001 / FM-IGATE-CHATADMIN-AI-001.
Notes format/CAS/authority and image-storage contract remain unchanged; the
image-specific FM-CONTRACT/IGATE-CHATADMIN-STORAGE-001 is not this memory boundary.

## Scope, preflight and proven failure

Owner supplied bounded preference/topic-change brief. Current main, AGENTS,
Source of Truth/readers, Execution/Countercheck/God Mode/Protocol, relevant
current/started/locks/failed attempts and full knowledge/context/route/shared
quality paths read. Open PR scan found unrelated docs/dependencies/control work;
1338 source handoff lock is consumed by merge, protected target locks remain
separate/unexecuted. Existing tasks only, no new queue or target authority.
Lock: LOCK-FM-CHATADMIN-CONFIRMED-PREFERENCE-20261017.

First commit `d654c961` changes only synthetic tests. Three relevant suites
ran103 cases:86 PASS/17 expected failures before production changes. An older
communication fact and its source_sequence disappeared when eight newer interests
filled the existing eight-fact store. Context truncation could not recover missing
knowledge; a supported older-generation communication replay could then be accepted
because the newer communication source_sequence was no longer stored.

Only one production expression changes: existing non-boundary retention candidates
are grouped as interests followed by communication before selecting the final slots.
Protective boundaries keep their existing first priority, current communication uses
remaining space before the newest interests. The same marker, eight-fact/4000-char
limits, source order, latest communication, exact quote/direction/vocabulary checks,
manual notes/commercial data and guarded saving path remain. No migration/backfill,
new field, second memory, new output checker or extra provider call.

## Requested scenario findings

- Context truncation alone ALREADY preserved learned facts outside recent_messages;
  green controls cover no pressure, zero/1200/10000 extra history characters and
  both existing sales-boundary states. The defect is prior knowledge eviction.
- Communication use: the real route now receives the retained DE/EN preference
  after topic pressure/history loss; existing Character style and prompt rules
  remain. Stub outputs prove context delivery, NOT semantic model compliance.
- Interest relevance: existing guidance already says use facts only when relevant,
  do not list notes/re-ask known facts. No forced relevance-classification defect
  is claimed from stubs and no second semantic system is added.
- Summary/manual guesses remain separate untrusted text, not commercial events,
  purchase intent, automatic customer tier or learned communication authority.
  Unsupported/draft/sensitive inputs are rejected as before. The demonstrated
  older-replay avenue after eviction is now closed by retaining the original fact.
- Boundaries and explicit sales refusals keep priority and still block a requested
  article/provider price. Eight legacy protective facts outrank communication.
- Foreign Workspace/Character/Fan/Conversation tuples fail before trimming, including
  drafts. Separate bound Fans retain different preferences and Character styles.

## Implementation verification

-29 new tests:7 knowledge,14 policy/context and8 actual-route regressions.
 Final104/104 in the three directly affected suites;214/214 seven-suite focused
 regression PASS,0 failures/skips, including all previous offer/negation/shared
 price/Creator/shared-quality tests. Original first-test103/86/17 is not relabelled
 as the later final104-case run.
- Actual old-generation retry: saved inbound sequence10 vs retained newer preference20
 after eight interests yields200/unchanged memory/provider0/usage0/writes0.
 Topic-change route cases use one existing provider attempt/one usage event, no
 new memory write on unrelated current question, <=80000 context characters and
 complete original history IDs for atomic persistence despite model-side filtering.
- Production build/TypeScript PASS. Full ESLint PASS with4 unchanged existing
 warnings; targeted lint of the additional retry test PASS. Truth/action pins,
 memory quality, truth drift, accepted-state fingerprint and diff check PASS.
- God Mode preflight and162 adversarial tests PASS; global release decision stays
 BLOCK with its existing inputs/gates, no invented acceptance. Fresh current
 ruleset24945113 is active/strict/no bypass with12 required contexts and expected
 app bindings. Final exact-head CI follows publication, not older-head evidence.

## Independent Guardian evidence

Separate reviewer, tracked files read-only:237/237 relevant eight-suite tests
PASS (214 focused plus23 manual-flow),0 failures/skips.108 independent pressure
probes over DE/EN,0–8 stored boundaries and0/1/7/8/9/24 newer interest additions
PASS, including source age/replay and no inferred purchases. Four additional
invalid direction/source/sensitive negatives PASS. Six in-memory mutants killed:
old eviction, removed sequence, removed direction, removed exact source quote,
removed supported vocabulary and removed boundary priority. No source blocker.

An exploratory wider dirty-checkout migration-test run rejected checkout_dirty
before its expected missing-passfile condition; its dirty-checkout guard was not
changed. Final relevant source suites pass; clean-head CI owns broad migration
checks. This is not a product regression or a claimed successful dirty migration.

Final SHA256 bindings:
- Knowledge source: `eb823462d62b6e14f3d4e76789bc73fca3b9481922ec0cb2d35e8b13e5ede242`
- Knowledge tests: `4ac5db39844ce7eb4a10da9f25ce48432fb8e1021fa4a24462b9a0334d1b13b8`
- Policy tests: `8b6233d3512e065768c7f55111f6f2423a00b1c18a93c6d0d3fe77bcb7a4c464`
- Route tests: `58e45d50c09deaac65e5897b94d566bccda35ac70edb1c43bdfb5a1cd98b4b56`

## Recovery, remaining risks and handoff

Recovery: reviewed source revert; no external/customer-data cleanup. Already lost
preferences are not reconstructed. A fully occupied legacy store of eight
protective boundaries still leaves no room for communication; do not weaken
boundaries to make space. Supported normal source-backed learning still uses the
same latest-communication and bounded fact rules, without a new learning vocabulary.
Real short/emoji-free/relevant model responses require separate later multi-turn
quality evaluation, not deterministic claims from provider stubs.

Source/independent tests are complete; exact Draft/head/fresh Required CI and
final independent Source/CI binding live in PR metadata after publication.
Phase7b/FM-CREATOR-001/FM-CHATADMIN-003 remain IN_PROGRESS overall. No merge,
Staging/Production, deploy, controlled dispatch, SQL-apply, real provider, Stripe,
Social registration, company or Mobile activation. FM-DEC-031 dependencies remain
documented/deferred. Global God Mode is unchanged. No target/gate acceptance claim.

Exactly one next independent Phase7b candidate, recommendation only: test the
existing newest-communication rule for independently stated length and emoji
preferences across later messages (e.g. known short replies, then no emojis),
first proving whether one explicit update incorrectly drops a compatible known
preference. Use the existing knowledge kind/source model and shared reply-quality
path; no second memory or new provider activation. Not started in this increment.
