# FanMind Change Requests

Capture new ideas before changing active scope. Classify each as ACCEPTED, DEFERRED, REJECTED, DUPLICATE or merged into an existing task.

## FM-CR-001
- Date: 2026-08-19
- Status: ACCEPTED
- Source: owner
- Idea: Introduce a durable project-memory, duplicate-check and change-intake mechanism for ongoing development.
- Classification: New governance capability.
- Affected areas: repository governance, PR workflow, engineering execution.
- Related task: FM-MEM-001
- Decision: Implement Project Memory Protocol v1 across active FanMind/WellFit repositories.

## FM-CR-002
- Date: 2026-08-29
- Status: ACCEPTED
- Source: owner
- Idea: The authenticated demo account must show the already stored sample messages for all demo contacts directly in the Mobile contact detail.
- Classification: Bounded Mobile product correction and replacement Android preview build.
- Affected areas: `apps/mobile` contact detail/data access, Mobile documentation, regression tests and signed Android preview evidence.
- Existing task/decision checked: FM-MOB-001, FM-DEC-003, FM-DEP-002, ASM-FM-005 and FM-LOOP-003.
- Dependencies: Existing RLS-protected `conversation_messages` rows, current Mobile Supabase binding, exact-head repository checks and a new exact-commit Android internal build.
- Decision: Track the implementation and replacement build as FM-MOB-002 without reopening or replacing the native Mobile foundation.
- Related task: FM-MOB-002

## FM-CR-003
- Date: 2026-08-29
- Status: ACCEPTED
- Source: owner
- Idea: Mobile must let every fan switch among all stored message platforms, use the account start screen as a dashboard containing only fans with unseen inbound messages, remove the owner's explicitly rejected placeholder logo symbol, and let an owner create a manual Follow-up directly on a fan from the phone.
- Classification: Bounded Mobile core-demo workflow correction and replacement Android preview build.
- Affected areas: Mobile dashboard, contact detail, authenticated Supabase reads/seen update, Follow-up form, policy tests, Mobile documentation and signed Android preview evidence.
- Existing task/decision checked: FM-MOB-001/002, FM-DEC-003, FM-DEP-002, FM-LOOP-003, existing web `seen_at` semantics and owner-only Mobile mutation boundary.
- Dependencies: current RLS-protected `conversation_messages`/`contacts`/`followups` contracts, exact-head CI and one new exact-commit Android preview.
- Decision: implement together as FM-MOB-003 because the three changes form one phone demo loop: unseen fan -> channel-specific history -> manual Follow-up.
- Related task: FM-MOB-003

## FM-CR-004
- Date: 2026-08-29
- Status: ACCEPTED
- Source: owner
- Idea: Move `iOS-TestFlight` out of Phase 6 and into Phase 8.
- Classification: Roadmap and current-finishline scope reclassification; no runtime or provider mutation.
- Affected areas: canonical roadmap, Mobile finishline/dependencies, external acceptance wording and central reader/tests.
- Existing task/decision checked: FM-MOB-001, FM-DEP-002, FM-LOOP-003, EXT-MOBILE-IOS, `FINISHLINE_STATE.json`, `FANMIND_FINISHLINE.md` and the current Phase-8 boundary.
- Dependencies: Phase 8 must remain not started during the current finishline; existing iOS code/build foundations remain untouched.
- Decision: Phase 6 no longer requires iOS/TestFlight acceptance. `iOS-TestFlight` becomes a Phase-8 roadmap item and is not a blocker for the current through-Phase-7 finishline. This reclassification does not start Phase 8 and does not remove native iOS support or CI/build foundations.
- Related task: FM-MOB-001

## Intake template

```text
## FM-CR-XXX
- Date: YYYY-MM-DD
- Status: NEW
- Source: owner/team/agent
- Idea:
- Classification:
- Affected areas:
- Existing task/decision checked:
- Dependencies:
- Decision:
- Related task:
```
