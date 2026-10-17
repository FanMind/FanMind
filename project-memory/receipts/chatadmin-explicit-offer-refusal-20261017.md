# Explicit current offer refusal — source receipt, 2026-10-17

Tasks: FM-CREATOR-001 / FM-CHATADMIN-003. Risk R3 under
FM-CONTRACT-CHATADMIN-AI-001 / FM-IGATE-CHATADMIN-AI-001; existing Creator
strategy/price consumers retained as regressions.
Base main `cb6ff77aefcaaa473c8ad5cd527f3504c0880161` (Owner-accepted #1334).
Branch `fix/chatadmin-explicit-offer-refusal`, directly from main.

## Serial scope and defect

PR #1336 was first normally reconciled to main and independently Source/CI
checked on `20415954f869230ac2511a3a0d727fa51336a35f`: all12 Required contexts,
14/14 Check-Runs passed. It stays a separate unmerged Draft; no merge approval
is inferred. Only after that completion did this source increment begin.
It does not copy the unmerged distinct-named-offer guard or its tests/docs.

The old resolver selected Foto/private media for explicit current refusals;
new resolver/context regression tests were red before the fix. Existing null
results for messages without a recognized offer and confirmed persistent
refusal cooldowns/holds were already covered; these are not new features.

Five source lines add a whole-message, word-bounded DE/EN negation veto before
name/category selection. Current requestedOffer becomes null and allowed offers
empty. This includes postposed refusals/custom names and mixed positive wishes.
Mixed, quoted or otherwise scoped negations are conservatively unresolved;
no partial positive selection or general semantic-language claim is made.
No API/error/price policy, schema, persistently confirmed event or hold changes.
The current incoming text alone never becomes a purchase or durable refusal.

## Evidence

- Local focused resolver/context/actual ChatAdmin route/knowledge/policy and
  Creator policy/actual-route regressions:114/114 PASS,0 fail/skip.
- Targeted ESLint, production build/TypeScript and product truth PASS.
- Drift/Memory quality and existing selector snapshot checked at source handoff.
- Independent reviewer:55/55 actual resolver/route cases PASS; one in-memory
  removal of the veto re-enabled seven previously selecting refusal cases,
  detected7/7. An already-null English private-photo case was a non-sensitive
  control, not claimed as mutation evidence. No reviewer checkout edits.
- Independent source check confirms unchanged #1334 Admin, #1335 price guard,
  Creator strategy, tenant/Character/style/manual-send, holds and aftercare.
- Final exact-head Required CI and independent final documentation/CI verdict
  are recorded in Draft PR metadata; local PASS does not pre-claim CI success.

## State boundaries and recovery

Source: implemented. Focused tests: passed. This source merge: not performed.
Staging acceptance: not performed. Productive activation: not performed.
Phase7b and real conversational quality remain open. Existing D3, Capacity
Staging BLOCK, rollout and company-dependent external scopes remain separate.
FM-DEC-031 company/ATU/UID/provider/store/billing work stays open and deferred.

Recovery is a reviewed source revert; no external state was mutated and no
external cleanup is required. No protected dispatch, target query, provider
call, SQL/migration, deployment, payment, activation or automatic merge.
No new task queue or third independent implementation is created.
