# Staging Host-Evidence source preparation — issue #1346

Status: **BLOCKED**. Risk R3 source-only; task
FM-STAGING-HOST-EVIDENCE-SOURCE-20261018. This is a reviewed deliberately sealed
admission scaffold, not EVIDENCE_WORKFLOW_READY or HOST_EVIDENCE_READY.

## Exact scope and preflight

Main `f36e630c73d3820a61aef593a705d241600e7f47`, tree
`e44f3fd1aa4f11b79bf33e2540904b400c320d68`, independently checked before source
preparation. Existing PR #1345 remains at
`6307861c78460283cd471d89417c0442537cad09`, open/Draft, unmodified. New source
branch starts from main, not1345, and includes no Current-Facts implementation.
The exact final source commit/tree and Required CI are bound in the new Draft PR
and issue #1346 after publication.

Read AGENTS, Source of Truth, relevant Project Memory/failed attempts, Execution
Policy v6 and active Work-Locks. Before edits Guardian independently confirmed
new staging-host-evidence paths and static import in existing readiness tests do
not overlap concrete Harness/manual-flow or Live-Repair product reservations.
Both old locks and their source remain unchanged. No historical permission or
staging workflow authorization reused. New source lock releases only for PR review.

## Named execution blockers

1. **Private channel unverified:** Repository is public. No approved existing
   Host-Evidence destination, audience/ACL, retention, transfer credential provenance
   or independent verifier contract is bound. Normal Actions artifacts, ignored
   private local folders, short retention, mode0600, Environment approval and the
   separate encrypted offsite-backup contract are not that approval. No new private
   storage/permission system or unapproved upload endpoint was invented.
2. **Environment protection unverified:** The allowed GitHub connector rejects
   environments/staging metadata reads. Existing workflow source specifies staging
   but does not prove current approvals, branch policy or bypass protection.
3. **Runner scope unverified:** The same connector rejects actions/runners registry
   reads. Exact source labels/name are known; current group/repository/ref eligibility
   is not independently observable. Owner administration is not that evidence.

The restrictions were not bypassed. No collector or upload path is implemented;
this is the safe boundary, not an unnoticed unfulfilled collection claim. The
workflow cannot be unsealed by dispatch inputs, environment flags, a policy path,
CLI arguments, or changing the policy JSON alone. Even a future edited approved
policy has no collector branch in the present executable.

## Files and security binding

Only new workflow, two operations modules, fixed policy JSON, focused cases,
runbook, this receipt/minimum memory and one static readiness-suite import.
No other workflow/runtime/SQL/backup worker/package/controller changes. The four
large historical Memory files are unchanged in the published candidate.

SHA256 of independently reviewed files:

- workflow: `650dde6c5a65d30e81925864d836e469ef56dc68eb3de15a27dfe506d4d34df7`
- entrypoint: `67247e51a5ca048309568347e50c54339004c2010288fb2a6481336e60cfbc13`
- policy JSON: `368e0f65a1a386d05a3273f9861f89a3edca028aaff4142de6f811fa4e50dcde`
- policy loader: `d61368eb8e22bb1e156195b1773a28f47cc95b87a40f20c4070ef9a371c422f8`
- new tests: `3614cf71bdec6646954fd8df03e1891cb5d343a5469a98ea8a401fae47d0102c`

Manual dispatch only, staging Environment and exact required five runner labels;
source gates repo/name/ID, event, main/workflow ref, SHA/confirmation, runner identity
and run/attempt. Read-only repo permissions, pinned checkout with no retained
credential, clean allowlisted environment and protected bash startup. Existing
Staging-deploy concurrency key serializes only that group; not proof of all writers.
No auto trigger or public artifact/log containing host details. Public stdout is
exactly three fixed status lines. No receipt exists because no host was inspected.
Fresh current-main-after-queue binding, host collection, protected transport and
receipt provenance verification remain requirements of a later reviewed collector.

## Executed evidence and independent review

Tests were authored before implementation. Initial ordinary-sandbox Node test
worker/subprocess startup failed without test evidence and is NOT reported as
product RED. Authorized local synthetic rerun:13/13 registered tests PASS,0skip.
Coverage registration1/1 and God-Mode unittest discovery123/123 PASS; syntax,
Project Memory quality, Truth Drift and immutable Actions reference checks PASS.
Default-on integration or runtime acceptance is not inferred from these results.

Independent Guardian reran13/13,0skip;34 additional in-memory adversarial probes
PASS and an unsafe-success exitcode mutation was detected. Missing/malicious
bindings, workflow-command injection, policy overrides/tamper and a simulated
fully approved policy all remain blocked. Read-only source review finds no path
from input/ENV/CLI to READY, host read or transfer. All reviewed file hashes match.

Final applicable Required CI must be checked on the exact published source commit;
new workflow itself is NEVER dispatched as part of this task. Existing mandatory
CI uses hosted synthetic tests; it is not Staging/Production access or host evidence.

## One-time administrator handoff and receipt review

See docs/operations/STAGING_HOST_EVIDENCE.md for the concrete bounded future
contract and the issue #1346 comment for final immutable source/CI references.
First bind the already approved private channel and actual protection/runner
controls. Then separately review a functioning allowlisted collector and its CI;
this sealed scaffold is not eligible for an operational authorization by itself.

After separately authorized merge, the administrator records a dated, short-lived
single-attempt authorization for exact main SHA/repo/workflow/Staging project/
runner/channel/operator and both dated lock-holder acknowledgements. Existing
staging Environment approval remains required. Exclude every install/deploy/DB/
SQL/capability/flag/provider/decrypt/host-restore action. No automatic retry.

An independent reviewer must read the protected receipt and verify source/run/
attempt/target/host/release provenance, freshness, strict redaction, durable writer
exclusion, backup artifact metadata and permitted isolated recovery evidence,
channel access controls and holder signatures. Public issue receives only an
approved opaque receipt reference and safe summary; never sensitive host or backup
metadata. Only then may it become HOST_EVIDENCE_READY, never installation authority.

No dispatch, Staging/Production connection, installation, DB query/SQL, secrets
readout, actual Fan data, real capability/flag change, backup-content read/decrypt/
restore, merge, deployment or provider call in this source task. Recovery is a
reviewed source revert; no host cleanup exists. Global release BLOCK unchanged.


## Publication boundary — canonical reconciliation PARTIAL/BLOCKED

Automatic approval review rejected complete uploads of existing CURRENT_STATE.md
and STARTED_WORK.md because their historical payload contains internal operational
and infrastructure details. Main/public baseline hashes and preservation of every
old byte were checked; the complete uploads remained rejected. No indirect upload,
policy/checker change, credential workaround or publication of that old material
was performed. WORK_LOCKS.md and FAILED_ATTEMPTS.md are also excluded from this
safe candidate; their large history is not transferred as a substitute.

This new task-only record is the safe reviewable subset. It is NOT a claim that
receipt-only publication is fully equivalent to canonical Memory reconciliation.
STARTED_WORK rules require early entry and explicit closure; WORK_LOCKS rules
require StartedWork/receipt updates before release. Those entries were made
locally before source edits, independently coordinated and closed locally after
source review; the small unuploaded patch is retained in the execution workspace.
Canonical publication remains incomplete, not silently waived by green CI.

### Task-local started-work and source-lock record

- Task: FM-STAGING-HOST-EVIDENCE-SOURCE-20261018.
- Lock: LOCK-FM-STAGING-HOST-EVIDENCE-SOURCE-20261018.
- Risk: R3 source-only; Holder: Codex, explicit Owner assignment2026-10-18.
- Start: recorded in local canonical StartedWork/WorkLocks before implementation.
- Scope: only this new dispatch-only admission scaffold, synthetic tests, runbook
  and receipt; no pre-existing workflow/product/SQL/controller edits.
- Coordination: independent Guardian confirmed no concrete overlap with retained
  Harness/Live-Repair paths before edits; old locks unchanged.
- Result: source review13/13 plus34 own negative probes PASS; workflow BLOCKED.
- Local lock disposition: RELEASED_FOR_PR after StartedWork+receipt closeout; no
  active source writer remains. This does not release any target/other-holder lock.
- Canonical publication disposition: PARTIAL/BLOCKED pending specifically allowed
  complete StartedWork/WorkLocks updates; no source merge/execution authorization.
- Next: review this safe Draft and its exact CI; resolve required publication
  approval separately. Independently resolve private-channel, Environment and
  runner evidence before any functioning collector or administrator dispatch.
