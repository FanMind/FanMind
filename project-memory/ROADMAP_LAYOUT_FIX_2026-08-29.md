# FanMind Landing Roadmap Layout Fix — 2026-08-29

- Status: IMPLEMENTED_NOT_VERIFIED
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

## Success evidence

1. Final PR diff contains only this bounded layout implementation plus this project-memory record.
2. Exact-head FanMind CI, Landing Language CI, Project Memory Guard/Quality/Status, CodeQL and Browser E2E are green.
3. Countercheck confirms only Phase `05`–`08` receive the new content-fit classes and no roadmap copy/state changes are present.

## Falsification check

This fix is not accepted if the final diff changes roadmap wording/state, applies the new fit behavior to phases outside 5–8, or any exact-head required CI/security/browser gate is red.
