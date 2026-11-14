# FM-MONTHLY-RELEASE-20261114

Risk R2, repository-only preparation. Owner requests a bundled monthly release
with maximum 60-minute execution window. No Production deployment, protected
configuration, schema action, provider action, monetary write or extra resource.
Baseline Main bbe29a0924448330159996de8591f6654d493b3a.

Source inventory: deploy-fanmind.yml remains the only Production entry point;
current protected exact-Main/Owner/check/expected-base gates and
fanmind-production-deploy concurrency remain untouched. deploy-isolated-release.sh
builds in isolated directories, checks and rolls back the application switch;
subsequent host installations are outside that script's rollback scope. Historical
AGENTS sealing/legacy-fallback statements disagree with executable source.

Scope: deterministic source package, exact GitHub source/Staging evidence
references, changed-SQL inventory, conservative timing-only evaluator, no-secret
GitHub-hosted preparation workflow, focused negative/recovery tests and runbook.
Package preparation is not a release controller or protected attestation.
No existing deploy/DB/Backup/Restore controller or active task file changed.

Consumer impact: preparation reads the existing production-release-preflight
check-completeness function; it cannot alter it or its callers. Application,
schema and all seven FM-CONTRACT-* / FM-IGATE-* consumer boundaries are unchanged;
this PR does not revalidate or mark any of their external evidence VERIFIED.
Package evidence never manufactures God Mode ALLOW. Existing conservative
RELEASE_DECISION remains BLOCK. Recovery: revert preparation-only source; no
runtime rollback or SQL rollback is needed for this PR.

Source tests include actual temporary Git and CLI, immutable file creation,
tamper rejection, failed preparation followed by deterministic recovery, and
broken-check/target/run mutations. Existing isolated-deploy executed harness is
reused rather than creating another deployment harness.

Open work is explicit in docs/operations/MONTHLY_PRODUCTION_RELEASE.md:
protected controller package consumption/fresh backup integration, safe real
deadline enforcement, complete feature acceptance mapping and a full timed
nonproductive rehearsal including state-bound recovery. The new package cannot
be used to bypass these remaining steps. No 60-minute overall PASS is claimed.

Local verification: 45 focused package/preflight/deployment/supply-chain/CI-
ownership tests passed in 5.268 seconds. This includes the existing synthetic
deployment harness, not a real build/DB/host rehearsal. Production build and
TypeScript succeeded (Next compile 5.5 s, TypeScript 8.4 s; component times only).
Lint completed with zero errors and seven existing unrelated warnings.
All 162 God Mode/admission adversarial tests passed; registry preflight,
Project Memory quality/V8 and accepted-state drift checks passed. The checked-in
release decision correctly remains BLOCK, not Production authority.

Initial broad Operations run was not green: 2419 pass / 15 fail / 13 skip.
One new hosted-workflow count was corrected. A package.json hash dependency
was discovered and avoided entirely by importing the new release cases from
the existing required release-preflight test; package.json is byte-identical
to Main. Clean committed-source and hosted-CI results are still required;
local host ownership assumptions and absent rsync are not waived or fixed by
weakening tests. None of these local results is actual Staging/Production
acceptance or a full 60-minute rehearsal.
