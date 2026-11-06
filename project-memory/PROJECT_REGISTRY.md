# Project Registry

This registry prevents cross-project work from disappearing or being implemented in the wrong repository.

## FM
- Repository: `FanMind/FanMind`
- Ownership: FanMind product, web/mobile/backend/infrastructure as defined by its canonical architecture
- Local memory prefix: `FM-`
- Cross-project rule: External dependencies or work delegated to another repository must receive a cross-project ID and local dependency/open-loop references.

## WF-WEB
- Repository: `Bernds-tech/WellFit-now`
- Ownership: WellFit web/backend/product technique
- Local memory prefix: `WFN-`

## WF-UI
- Repository: `Bernds-tech/WellFit`
- Ownership: WellFit visual/landing/UI work
- Local memory prefix: `WF-`

## WF-BUDDY
- Repository: `Bernds-tech/WellFit-Buddy`
- Ownership: native mobile/AR/buddy work
- Local memory prefix: `WFB-`

## Cross-project IDs
Use `XPROJ-YYYY-NNN` for work spanning two or more repositories. The same cross-project ID may be referenced in each repository, but local implementation subtasks retain their repository-specific IDs.

Before creating a new cross-project item, search all relevant repositories for the feature/idea and existing IDs to classify it as `NEW`, `EXISTS_PARTIALLY`, `DUPLICATE`, `DEFERRED` or `REJECTED`.
