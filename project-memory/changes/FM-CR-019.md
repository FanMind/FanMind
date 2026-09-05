# FM-CR-019 — Phase 8 English landing translation repair

- Date: 2026-09-05
- Status: IN_PROGRESS
- Source: agent reconciliation during owner-requested App/Website reliability work
- Related task: FM-WEB-005
- Risk: R2

## Problem
The current `main` Phase-8 roadmap strings were added in German but were not added to the landing English-copy map. The Landing Language CI therefore reports twelve visible nodes that are identical in German and English.

## Scope
- Add exact English translations for the twelve existing Phase-8 German roadmap title/status/item strings.
- Do not alter the canonical German roadmap, Phase-8 status, runtime behavior, Website Chat activation, provider state, database state or Production infrastructure.
- Keep the correction separate from FM-CR-018 Android login diagnostics.

## Evidence plan
- Landing Language CI must report zero unexpected identical visible nodes.
- Root build/type/tests and Project Memory checks must remain green.
- Diff must be limited to the English copy map plus this Project Memory record.

## Rollback
Revert the translation commit. No runtime/provider/database state is mutated by this repository-only repair.
