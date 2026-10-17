# Known Fan questions — findings-only receipt, 2026-10-17

Tasks FM-CREATOR-001 / FM-CHATADMIN-003. Explicit Owner bounded Phase7b task.
Risk R3, FM-CONTRACT-CHATADMIN-AI-001 / FM-IGATE-CHATADMIN-AI-001.
Base main `f36e630c73d3820a61aef593a705d241600e7f47`; integrated1335-1340 consumed.
Branch fix/chatadmin-known-fact-questions; lock LOCK-FM-CHATADMIN-KNOWN-FACT-QUESTIONS-20261017.
Outcome: COUNTERCHECKED_DIAGNOSTIC_NOT_FIXED. Product request remains UNRESOLVED.
Owner explicitly authorizes findings/tests only when no robust bounded correction
is safe with existing data; this is that fallback, not a successful product fix.

## Preflight

Fresh GitHub main/open PR scan, relevant Source of Truth/decisions, current/started
work/locks/failed attempts, Execution/Countercheck/Protocol/God Mode and AI contracts
read/reconciled. No competing source PR. Prior merged source handoffs consumed;
retained harness/protected target scopes grant no execution. Full Knowledge/Policy,
shared reply-quality and actual ChatAdmin route examined, general CRM/Creator/
Copilot/Mobile consumers reviewed. Their common quality contract remains unchanged.
No new task queue, integration acceptance or protected authority is created.

## Red evidence before decision

Test-only commit `87536c35` changes only the actual-route test file/harness.62 API
cases:59 PASS/3 RED before any decision/source change. In each synthetic real-handler
case, learned_preferences contains the source-backed interest, but no old history:
- Ich liebe Musik + Was machst du am Wochenende? -> Magst du Musik? accepted200.
- Ich mag Reisen + Was gefällt dir an meinem Profil? -> Magst du Reisen? accepted200.
- I love music + What do you do at the weekend? -> Do you like music? accepted200.
The desired rejection502 failed because the existing Quality gate allowed the
three distinct stub replies. One existing provider attempt/usage event, no extra
knowledge write. This proves route acceptance, NOT that real models habitually
produce this output, nor a new runtime-regression claim.

Original RED expectation is immutable in87536c35; final tests explicitly assert
and name the unresolved existing behavior for a diagnostic baseline. Green final
characterization is NOT a repaired acceptance test, and no feature is marked done.
No failing expectation is hidden as a successful product correction or skipped.

## Concrete reason not to add a superficial guard

The existing interest grammar learns explicit positives only. Newer 'Ich mag keine
Musik mehr' / 'I do not like music anymore' and generic retractions 'Das stimmt
inzwischen nicht mehr' / 'That is no longer true' yield no learned revocation.
The old positive/source/sequence remains in notes. After21 identical later turns,
source and retraction are absent from recent_messages; current and superseded
histories yield byte-identical complete built contexts, including learned_preferences.
Test4 retraction variants x budgets0/1000/10000 demonstrate this with current source.

A deterministic checker of these same inputs cannot prove different currentness.
Excluding later literal topic mentions misses pronoun/generic retractions, and
when the source is trimmed there is no trustworthy complete subsequent interval.
Manual notes or summaries must not be promoted to currentness authority. Whole
question regexes also cannot establish relevance of details, quoted examples or
confirmation requests in general. Narrow isolated patterns alone would not meet
the requested stale/unknown+trimming safeguards. No such production guard is added.

Existing prompts already say not to reask known facts or force old interests into
new replies. No duplicate prompt/quality architecture, new data lifecycle, model
call or expanded retry is invented. Detail questions remain allowed because music
genre/artists are not supplied by the broad stored interest. True model relevance
and response quality remain outside what synthetic stubs can establish.

## Final implementation/diagnostic evidence

No correction implemented. Production src, API/runtime contracts, package.json,
Capacity checksum pins, workflows, schema and knowledge format byte-identical to
base. Only existing registered tests, focused docs and canonical memory changed.
29 new tests:11 actual-route,12 policy/context collision,6 shared-quality cases.
297/297 focused seven-suite cases PASS;298/298 with suite-coverage control PASS,
0 failures/skips/todos. Existing Knowledge/communication-dimension/price/offer/
negation/hold/aftercare/repetition/Creator cases remain green. Actual route detail,
manual/unconfirmed notes, source availability, isolation and provider counts covered.

Build/TypeScript, full ESLint(0 errors/4 existing warnings), Truth/actions pins,
memory quality/truth drift/accepted fingerprint, God Mode preflight/release check
and162 God Mode adversarial tests PASS. NBA check reconciles on source-lock release.
Global release stays BLOCK unchanged; no aggregate or target acceptance claim.
Final exact-head Required CI and independent live binding follow in Draft metadata.

## Independent countercheck evidence

Separate Guardian320/320 relevant eight-suite tests incl23 manual-flow PASS,
0 failures/skips.24 own DE/EN music/travel explicit/generic-retraction collisions
with budgets0/800/12000 independently reproduce identical contexts and stalepositive.
4 bounded in-memory mutations killed: erased learned facts, removed Workspace
binding, removed history slicing (contexts become distinguishable), removed existing
duplicate-variant guard. These prove diagnostic/existing-protection sensitivity,
NOT a new anti-reasking protection. No source/currentness solution is claimed.
Independent review agrees findings-only fallback is warranted; product gap remains open.

Final SHA256 bindings:
- tests/chat-admin-api-integration.test.mjs: `2a55c409dfa2fd0775cd9522553c93c175b0b9069c5783f8ca39a73b52c9727e`
- tests/chat-admin-policy.test.mjs: `89283ff9b4209d2cc7a219a778d239926eccde1121f0e819cb2ef4c1e7f5bae8`
- tests/reply-quality-policy.test.mjs: `51c2e6131d95d81d579d5921753e9887e6be57faf7ed8d0b8dccbee7527629f1`
- src/lib/chatAdminKnowledge.mjs: `19fe3dee693e6ff7951cede8523befba8df6c170b5ac947b30a2fe22964a7852`
- src/lib/chatAdminPolicy.mjs: `b9051d72984c377cc7eae91ff9947fa49fd739426d3864a174b4477eaee1c120`
- src/lib/replyQualityPolicy.mjs: `8898a3c2dd6b579042e8e6da1b2e2b87c7744c72e93961347bb1c7e32b4c383c`

## Limits, recovery and handoff

Known-only questions can still be returned. Old interests can remain after an
unsupported retraction. Byte-identical clipped inputs cannot establish freshness;
there is no expiry/revocation state invented here. Actual model semantics and
whether any real response unnecessarily mentions an old interest remain unproved.
There is no new product release blocker claimed outside this requested feature;
the feature itself remains UNRESOLVED, while bounded diagnostic handoff is complete.

Recovery: reviewed tests/docs revert; no runtime/data cleanup because none changed.
Isolation, Creator/Character styles, protection/communication priority, eightfacts/
4000chars, prices/offers/cooldowns/aftercare/holds, common Quality retry atmost2 and
manual-send remain unchanged. Image-storage contract unaffected. No target/DB/SQL,
provider, Stripe/Social/Mobile, deploy/dispatch/merge or company-dependent action.
FM-DEC-031 deferrals and global God Mode BLOCK preserved. Phase7b remains IN_PROGRESS.

Source lock released for Draft handoff. Final exact PR/head/12 Required contexts
and independent Source/CI binding are recorded in PR metadata after publication;
no stale head or module green is promoted to target/currentness acceptance.

Exactly one next independent Phase7b candidate, recommendation only: investigate
source-ordered explicit retraction of an already learned broad interest in the
existing Knowledge path (e.g. 'Ich mag Musik nicht mehr'). Test first whether
existing fields can safely represent withdrawal without new Memory architecture,
invented replacement preferences or weakening protective boundaries. Not started.
