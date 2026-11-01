# Creator target PG17 reference refresh — 2026-11-01

- Task: `FM-CREATOR-001 / creator-target-reference-refresh`
- Risk: `R3`
- PR: `#1396`
- Trigger failure: read-only diagnosis run `41245773828`, job `124668809803`, failed before database connection with `reference_metadata_unavailable`.
- Failed recovery attempt: original isolated PG17 job `108490997482` could not be rerun because GitHub rejected runs older than one month.
- Replacement source: branch commit `36b17e16fc2bb7b145fa9aa9a518cd202f8fc362`, FanMind CI run `41295151183`, PostgreSQL 17 job `124814337617`.
- Replacement artifact: ID `13079301340`; name `fanmind-creator-foundation-reference-96332518aba47b0fac0825b56dfd3eb2ebc6a3d8`; digest `sha256:287c0a1e6a0015dbe67353da640503227c7f6be958f8c5d51497a1a9c91b1ac1`; expires `2026-11-08T10:05:52Z`.
- Positive evidence: PG17 authorization backup/restore, Capacity reconciliation, Creator workspace isolation/rollback and artifact upload all passed; broad product truth, lint, Operations, integration and build checks passed in the same run.
- Negative evidence: the one-time replacement retains the base-branch 7-day expiry because PR workflows use the workflow definition from current `main`. The PR raises future Creator-reference retention to 90 days after merge.
- Binding: drift diagnosis, transition/runtime and admission recovery must all verify the same artifact ID, name, source run, source head and archive digest before extracting private JSON.
- Boundary: no Staging/Production database access, SQL APPLY, deploy, runtime activation, provider action, customer mutation or secret publication was performed by this refresh.
- Recovery: revert PR #1396. This restores the known expired reference and therefore blocks diagnosis fail-closed; it does not authorize replay of any consumed command.
- Next: complete exact-head CI and the required independent R3 countercheck. After merge, request a distinct fresh exact-main Owner authorization for one bounded read-only diagnosis.
