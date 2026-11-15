# FM-MONTHLY-RELEASE-20261114 — PR1512 continuation

Initial R2 package-only head d332c4401cba7c12199a60b1b871e96ac7230dbe is retained.
Current explicit Owner continuation upgrades source work to R3: complete existing
controller binding, timing, negative/recovery and integrated nonproductive proof.
Current Main55a0df4 is integrated by ancestry; its already merged media reload
source/receipts/tests are preserved unchanged. No new PR or second deploy system.

## Source implementation

- Optional package-hash mode in existing deploy-fanmind.yml. Existing hosted
  Owner/current-Main/merge/required-check gate, protected Production environment
  and fanmind-production-deploy concurrency remain. Extra local host lock.
- One canonical marked Deployment body remains in that workflow. The monthly
  adapter extracts and executes it, reusing deploy-isolated-release.sh plus
  existing host installs and existing app rollback.
- Fixed separately installed root read-only evidence wrapper, pre-import root
  ownership/closure verification and exact reviewed-code hashes. Complete actual
  private restore/report/SQL receipt bytes are read, frozen and verified. No
  new secret, server, service, resource, database or permission is installed.
- Fresh existing Production audit before/after, real GitHub source/Staging/
  native-rehearsal evidence and per-file acceptance mapping. Actions token is
  removed before deployment/PM2 child processes.
- SQL is never applied here. Registered existing verifier path/workflow and
  canonical SQL digest plus actual fresh protected verify evidence are required;
  unknown/modified/unapplied SQL blocks. Existing source/live binding can prevent
  preverification of new SQL. This is an explicit external protected prerequisite,
  not claimed support for arbitrary new schema releases.
- Monotonic10/20/15/15-minute budgets; safe read/build/test subprocess timeouts,
  five-minute pre-switch reserve and cooperative host boundaries. Never kills
  database commits, PM2 rollback or privileged protective writes for budget.
  Over-budget protective settling is NOT a completed <=60-minute release.
- Atomic private Latest state plus immutable per-attempt events. Blind rejected
  retry preserves the original interrupted evidence. Resumption requires exact
  package/candidate, fresh proof and protected prior-attempt inspection approval.
- Offline private admission proposal generator computes hashes/copies and checks
  existing canonical receipts. No root execution, protected write or self-approval.

## Synthetic integration evidence and independent countercheck

The existing deployment harness was factored into one shared fixture. The full
probe uses the actual createProductionAdapter, subprocess/token/deadline logic,
full extracted workflow body and actual isolated shell with monthly mode ON.
Git archives and child HTTP applications are real; privileged host, process-
manager and external GitHub/root proof transports are synthetic and bounded.
The required native CI step reuses the existing disposable PostgreSQL17 service,
executes a separate synthetic idempotent migration/rollback/preserved-data proof
and removes only its test-created schema. It does not apply Production SQL or
use any existing real Restore target/data. Report source/elapsed/PG17/negative/
Recovery fields are retained as a pinned Actions artifact.

Local focused result:49/49 PASS, ~13.4 seconds. This is not a real FanMind host
capacity measurement and the local run lacks PG17. Final native CI and all
required checks on the committed final Head remain required; terminal results
are recorded on PR1512 without fabricating a Production acceptance.

Separate Guardian reproduced and blocked four P2 findings, then implementation
closed delayed-save false success, rejected-retry journal loss, arbitrary SQL
proof/digest acceptance and disconnected synthetic E2E. Regressions exercise
these failures, canonical SQL pinning and apply-only receipt rejection.
Final independent source review: PASS, no remaining concrete P2. Independent
integrated run4/4 groups PASS, full rehearsal13050ms, all negative/Recovery/cleanup
flags true, PG17 still pending hosted CI. Final hosted native result remains an
explicit acceptance gate. All seven FM-CONTRACT/FM-IGATE application consumers remain
unchanged; no external gate is marked VERIFIED from a local source test.
God Mode baseline remains BLOCK; source checks never grant runtime authority.

## External protected boundary — no duplicate Operations work

Read-only official evidence still finds last scheduled audit43590551891 failed:
DB226.04h>36h and Full321.04h>192h; Storage/config10.04h within36h. Post-deploy
43590220136 also failed. These are historical results, not a fresh direct host
inspection. Exact current worker cause remains unproven; do not re-label the
historical20/13 guard mismatch as today's diagnosis or claim worker disabled.

Existing responsible path is backup-worker-production-control.yml, protected
backup-production-recovery, shared Production lock and fixed existing root
controller. No verify/install/queue/backup/restore run is started by this task.
Restore state remains accepted DB_POSTCHECKED / overall PARTIAL. Resource
readiness43638416183 is already queued at its host step. Consume its results;
do not dispatch another readiness/restore or reset real data.

Private verifier/admission installation and a fully valid current backup/restore
chain remain protected prerequisites to actual monthly use. No Production,
Staging rollout, DB mutation, Billing/Meta/Support change or protected config
change occurred. Source recovery is ordinary reviewed source revert; no target
undo is needed. R3 source merge and every Production release remain distinct.

## First hosted gate correction

Head405175d3 retained all Main ancestry but hosted Operations exposed the prior
explicit input-list assertion in production-readonly-audit.test.mjs. The test
now explicitly admits and validates only the optional monthly hash string with
empty legacy default; no runtime/security assertion was removed.

CodeQL reported one new high finding; its aggregate alert remained blocking.
Outbound SQL-log redirect destinations are now strictly bounded to expected
GitHub log storage, the synthetic HTTP proxy uses a fixed endpoint, and the
executed Production body is read directly from the exact candidate Git object.
The CodeQL workflow retains identical security-extended queries/upload/gates
and now prints bounded rule/path/line diagnostics for connector-readable
follow-up; no alert dismissal or suppression is used. Final CodeQL must pass.

Synthetic PM2 state writes became atomic and fixture teardown now removes its
root only after callback cleanup, avoiding read/cleanup races. Post-correction
local23/23 focused checks PASS, full adapter rehearsal12198ms. These are source
regressions only; final exact-head native/full CI remains required.

The bounded CodeQL diagnostic located the new alert exactly as
js/file-system-race in the optional synthetic command-log debug reader. It now
reads from the same already opened read/write descriptor with a bounded explicit
offset, never reopens the filename. No alert is dismissed/suppressed. Existing
unrelated baseline findings are outside this task. Final exact-head CodeQL and
native CI are still required.
