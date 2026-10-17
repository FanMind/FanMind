# Contextual offer negation — source receipt, 2026-10-17

Tasks: FM-CREATOR-001 / FM-CHATADMIN-003. Risk R3 source.
FM-CONTRACT-CHATADMIN-AI-001 / FM-IGATE-CHATADMIN-AI-001; unchanged Creator
shared-price consumer retained. Base main `2bfbeb049f9cd5b49ba39a1b30410fec859216a1`.
Branch `fix/chatadmin-contextual-offer-negation`; Draft PR exact head and fresh CI
are bound in PR metadata after publication. No merge is authorized.

## Preflight and test-first evidence

Fetched current main and confirmed #1335–#1337 merged; no duplicate implementation.
Read AGENTS, Source of Truth, Execution Policy v6, Countercheck/God Mode policies,
relevant current/started-work/locks, previous offer receipts, resolver, fan/confirmed
follow-up context, route, knowledge/strategy, shared price and reply-quality paths.
Open-PR scan: unrelated docs/dependency work only. Historical1322 source repair
is merged;1335–1337 source handoffs consumed; target/harness locks remain separate
and unexecuted. Current bounded lock: LOCK-FM-CHATADMIN-CONTEXTUAL-NEGATION-20261017.

First commit `3276ff30` contains tests only. Of100 resolver/route tests,91 passed
and9 failed before changing source: six positive DE/EN questions, one positive
commercial-hold test control and two actual-route positive-price cases. All
new explicit/mixed/unclear refusal cases already passed. Tests use synthetic
Personas/Fans/articles and stubbed providers; no private corpus or real call.

## Proven defect and minimal correction

Whole-message token veto rejected “Nicht schlecht, was kostet das Foto?” and
“Not bad. How much is the photo?” despite an otherwise resolvable saved article.
Only two anchored grammar branches exempt complete appreciation + single
explicit media-price-question forms. Every active literal name match in this
exception must start inside the terminal media phrase and end at its noun;
appreciation/question-wording names and modifier-only names stay blocked.
Original text stays intact for all existing name/category/ambiguity checks. English photo uses a saved English name; existing
category vocabulary is unchanged. No unknown/inactive/confirmation-required or
duplicate article becomes eligible. Arbitrary prefix stripping was not used.

Additional sentences, quoted text, mixed offers/refusals, “Don't send a video”,
“No thanks, just chat”, and “Ich möchte nicht warten. Was kostet das Video?”
stay conservatively blocked. Appended “I decline”, “Ich lehne ab”, “Non merci”
or “No gracias” also fail the full-message shape, without inventing multilingual
semantic coverage. Original1336 ambiguity,1337 refusal tokens,1335 shared price
validator, commercial review/hold/cooldown/aftercare and manual-send rules remain.
No API/schema/model/provider/rollout/workflow or persistent event change.

## Implementation verification

- Standard Node runner:185/185 focused policy/offer/knowledge/actual ChatAdmin and
  Creator routes/Creator strategy/shared reply-quality cases PASS;0 failures/skips.
 57 added tests:50 structured-offer and7 actual-route cases. Final combined
 resolver/actual ChatAdmin route result117/117 PASS (initial test-first91/100).
- Production build incl TypeScript PASS; full ESLint PASS with4 existing warnings.
 Truth/referral/legal-structure/action-pins, memory quality, truth drift,
 accepted-state fingerprint, God Mode preflight and diff check PASS.
- God Mode adversarial162/162 PASS. Existing conservative release-decision
 baseline stays BLOCK; source tests never imply target/runtime acceptance.
- Local sandbox profile initially hid child Node test failures and broke the
 TypeScript subprocess. Supported additional-network execution profile resolved
 both; normal child test runner and full build then PASS. No test/source workaround.
- Current ruleset24945113 read back active/strict/no bypass:12 required contexts
 with app bindings. Fresh final-head checks and independent CI readback remain
 separate from these local results and are recorded in Draft metadata.

## Independent Guardian source evidence

Separate reviewer, tracked files read-only:208/208 tests PASS (includes23 manual-
flow tests);216 independently constructed prefix/suffix refusal probes with
DE/EN/FR/ES and six whitespace separators PASS again on repaired source. New535
exhaustive contiguous word-substring article-name probes across four DE/EN
public/private questions and five categories PASS: only names within terminal
media phrase and ending at its noun may become eligible. Six final-source
in-memory mutants killed: missing refusal veto, start-span bound, noun-end bound,
whole span veto, positive exception and original1336 ambiguity. No blocking final
Source findings. Final-source mutation evidence replaces the earlier five-mutant
result, which did not exercise the later-proven collision.

## Concrete countercheck findings corrected before completion

Initial source4edc allowed a sole custom article named “Not bad”/“Nicht schlecht”
to stand in for requested media. Separate Guardian confirmed P2; the initial
source PASS was revoked and the Draft explicitly marked reopened. Test-only
commit03e3ea7f first reproduced12/71 failing name-collision cases. An initial
start-span bound then still admitted a modifier-only article named “private”;
Guardian found it, test-only commite32fdc88 reproduced4/75 failures before the
noun-end bound was added. Both proven defects are fixed on final source; the
actual-route regression rejects a wrongly priced collision before persistence
or learning. All new tests pass, with no unrelated scope expansion. Old-head CI
is historical only and must never substitute for fresh final-head Required CI.

SHA256 bindings:
- Resolver: `615dbb79b5c9fe0fd3792ff7f37e1d1d14a02e8b75e23d21469f3862aaa175b0`
- Structured tests: `6d98881e3b7f794b56de4e745d74804508cc28d60ba7b5486e3f5ccdc0661dfd`
- Route tests: `7c8d5a93caae4c16ce8b1ad280b4ab209d8c3f3c0677a4e1122d0b1ad50fb51b`

## Recovery, remaining boundaries and next recommendation

Recovery: reviewed source revert; no external state or customer-data cleanup.
Phase7b/FM-CREATOR-001/FM-CHATADMIN-003 remain IN_PROGRESS overall. This is
bounded source/synthetic proof, no general NLP, real model-quality, Staging or
Production acceptance. Exact-head Required CI and final independent CI check
must pass before readiness; no automatic merge/deploy/dispatch/SQL/provider action.
FM-DEC-031 company-dependent Mobile/Store, Stripe/Billing, Social registration,
tax/business verification remain deferred, with existing evidence/gates retained.

Exactly one next candidate, recommendation only: confirmed communication
preferences through a topic change in the existing Character/Fan context. Map to
existing roadmap “Creator-Profile & getrenntes Fanwissen” and FM-CHATADMIN-003;
first test whether a newer confirmed short/no-emoji preference remains in the
actual route context after a topic change and history-budget truncation, while
foreign Character/Fan data and unused drafts stay excluded. Reuse existing
knowledge/context and replyQualityPolicy/repetition gate; no second architecture,
new provider evaluation or target activation. This candidate is not started.
