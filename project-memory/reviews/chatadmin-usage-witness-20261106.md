# ChatAdmin usage witness – 6 November 2026

Task: continue the directly assigned Staging acceptance repair, without delegation.
Scope R3; reuse the existing ChatAdmin Staging write concurrency lease and recovery
receipt. No new parallel writer or independent roadmap task is admitted.
Contracts: FM-CONTRACT-CHATADMIN-AI-001, FM-CONTRACT-CHATADMIN-STORAGE-001.
Gates: FM-IGATE-CHATADMIN-AI-001, FM-IGATE-CHATADMIN-STORAGE-001.

## Observed cause

Owner approved regular merge of PR1434, Staging-only deployment, further necessary
Staging tests and targeted corrections. PR1434 exact head 34c0d85e passed all 14
checks, including native PG17. It merged as
a45a6586f34fe707a9460b844982df85311f62e4. The preceding native image test fixture
now waits for a fixed readiness marker; image/alias/tamper assertions remain.

Staging deployment: https://github.com/FanMind/FanMind/actions/runs/42185237492
SUCCESS; HTTPS release matches Main. Public smoke: 14 routes PASS, seven required
health components healthy. Optional email configuration remains unknown/disabled.

Instrumented live acceptance:
https://github.com/FanMind/FanMind/actions/runs/42185770137
FAIL. Browser/invented_price, release, cleanup and absence PASS. Counts:
characters 3/3; fans 2/2; conversations 2/2; messages 41/41; usage_ok 10/10;
usage_error expected 2, actual 0. Thus this run proves an invalid fixed retry-count
assumption, not missing persisted replies or successful usage records. Do not
rewrite the historical 42107187544 counters, which were never recorded.

## Deterministic replacement

The server assigns a random event UUID to each actual provider attempt before
best-effort usage storage and returns only these IDs/fixed outcomes in an
authenticated response header. The existing usage table receives the same UUID;
generic callers retain its existing default UUID behavior. No migration is needed.
The response body, quality gate, provider request count, rate limit, tenant checks
and manual-send boundary remain unchanged.

The browser stores ten request-bound, unique generation witnesses privately under
its exact run/attempt/source/target binding. The verifier keeps all existing fixed
resource counts and ten successful events. Only the expected error count comes
from the independent attempt witnesses. It additionally requires every exact
event UUID/status/synthetic user/workspace/route/time binding and rejects any
extra scoped usage row. An unrelated row cannot substitute for a missing event
even if all six totals still match. Missing/invalid/incomplete witnesses fail
closed. Diagnostics expose only six expected/actual numeric counts; no UUIDs,
credentials, model names, prompts or replies are logged. Cleanup stays independent
of witness completeness and retains the original recovery/uncertainty contract.

## Validation and limits

Focused API tests cover one attempt, a quality rewrite, ignored client witnesses,
logger no-write and event-ID transport/default compatibility. Pure browser tests
cover private binding, duplicate IDs and missing/invalid witnesses. Native PG17
cases require exact success for 0, 2 and 10 rewrites and reject same-count event
replacement, wrong status/workspace, extra and skipped rows. Native execution is
mandatory in CI; a local skip is never PASS. The Current-Facts source pin includes
the changed verifier and its new witness validator; schema/reference pins stay.

Source correction and exact-head CI are separate from live Staging acceptance.
After green checks and regular permitted merge, deploy the resulting Main only
to Staging and rerun the complete protected acceptance/cleanup. Never bypass
branch protection, use branch source in the protected Main workflow or enable
Production. No Production, secret, permission or provider configuration change.

Known separate Support boundary: Staging support_repair_audit retains the older
11-column shape; Production lacks it and has additional Character/Fan fields.
Do not copy those schemas, apply the staged audit upgrade or activate real repair
merely because ChatAdmin passes. Full Support/runtime parity remains unproven
until its specific protected prerequisites and actual tests are satisfied.
