# FM-MONTHLY-AUDIT-EVIDENCE-20261115

Risk R3 diagnostic source preparation, existing monthly release/audit only.
Main4577f4c338ad19035a16f1cb11aa5a5e57524d14. Owner requests actual release-drift
cause before correction. Historical43711512421 lacks rawtuple/installed hashes;
collector0, validatorrelease_drift, noartifact, rawtemp deleted. Do not infer
which field differs or install/disable anything to make CI green.

Scope lock: existing production-readonly-audit.yml observation, its existing
workflow harness tests and runbook. No canonical validator, collector, monthly
adapter, Sourcecheck policy, installer, protected config or feature edits.
Independent Guardian required. Existing old PR1255 concerns trigger restoration
on an October base; do not overwrite that unrelated open work. PR1517 is merged,
so a new narrow diagnostic PR is necessary; no second audit/release system.

Evidence: actual official43711512421 log/artifact metadata, independent current
HTTPSbb799466, authenticated portal and unauthenticated OS console observed.
No console keystroke, credential access, new host channel or target mutation.
Root hashes remain unknown until protected observation; repository four-file
closure equal between Production source and Main does not prove installation.
Source positive/negative tests preserve red drift, badbackup, realRuntimeDrift,
missing/duplicate/forged evidence, exact monthly candidate/resume and all-checks
failure. No old PG17/SQL/backup suites changed or manually replayed.

Rollback: revert source PR only. No target state exists to recover. Mandatory
CI and Guardian precede technical-ready status; live production gate staysBLOCK.
Status IMPLEMENTED_AWAITING_REVIEW_CI; next owner decision is diagnostic-source
merge, then the existing protected read-only evidence action, never installation.
