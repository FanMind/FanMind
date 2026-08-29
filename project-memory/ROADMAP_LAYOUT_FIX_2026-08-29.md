# FanMind Landing Roadmap Layout Fix — 2026-08-29

- Status: ACCEPTED
- Risk: R1
- Source: owner screenshot/request on 2026-08-29
- Scope: presentation-only correction for the landing-page roadmap cards Phase 5–8.
- Branch: `fix/landing-roadmap-phase-5-8-layout-20260829`
- Pull request: #1024

## Observed defect

At the owner-observed desktop width, Phase 5–8 contained longer titles, phase-status text and item-status badges than the already-correct surrounding roadmap cards. Those intrinsic text widths could exceed the fixed card content width and were visibly clipped at the right card boundary.

## Implemented correction

- Apply the fit behavior only to Phase 5–8; leave the already-correct roadmap cards unchanged.
- Constrain long titles to the card width and allow balanced wrapping.
- Constrain the phase-status pill to the card width and allow safe wrapping.
- Allow long per-item status badges to shrink/wrap with the item label instead of overflowing the card.
- Keep phase order, wording, states, Coming Soon treatment and all product/finishline semantics unchanged.

## Boundaries

No database, Supabase, provider, billing, signing, Mobile build, runtime activation, Production data or roadmap-scope mutation is part of this change. Phase 8 remains not started.

## Verification and countercheck

- Implementation head `8b883d507a029b55448dc0e988bd0f7ebc86aa31` passed all seven PR gates: Project Memory Guard, Project Memory Quality, Project Memory Status, FanMind Landing Language CI, FanMind CI, FanMind Browser E2E and FanMind CodeQL.
- Final diff countercheck confirms the content-fit condition is exactly `["05", "06", "07", "08"]` and no roadmap copy, item state, phase state or phase order changed.
- The new CSS constrains title/status/item intrinsic width and changes overflow behavior only for those four cards; it does not change the fixed marquee/card structure used by the already-correct phases.
- The final memory-only closeout commit must pass the same exact-head gates before merge; a red final-head gate invalidates this acceptance.

## Falsification check

This fix is not accepted if the final diff changes roadmap wording/state, applies the new fit behavior to phases outside 5–8, or any final exact-head required CI/security/browser gate is red.

## Recovery

Repository-only rollback is a revert of PR #1024. No external or data rollback is required because the change has no provider/database/runtime-state mutation.
