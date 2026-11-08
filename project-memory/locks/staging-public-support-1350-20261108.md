# STAGING-PUBLIC-SUPPORT-1350-20261108

Risk R3, holder interactive root. Direct Owner continuation of #1350. Base
204a98354fa2a013a14c295d74c784e974a585e5. Scope: public support panel consent and
composer; existing protected Staging runtime control extended with support-only
verify/activate/deactivate. No Production, keys, schema, Stripe or Admin Chat
behavior changes. Both media flags remain byte-preserved by support-only writes.
PR1442 has a separate Support privacy TypeScript correction; that file is not
modified here. Historical public landing implementation is reused, not rebuilt.

Observed Staging: exact204a9835; valid public POST503, anonymous conversation
GET404; exact source maps404 to disabled Support before authentication. Owner1,
owned workspace1; no public usage/rate buckets. Health reports existing OpenAI
and shared limiter configuration present. No provider request is inferred.

FM-CONTRACT-DISCLOSURE-DELETE-001 and the public landing-to-provider/usage/rate
consumers retain scope/consent/authority boundaries. No integration gate is marked
VERIFIED by source tests. Source build,93website tests,6runtime tests and focused
lint PASS. Local browser NOT_RUN successfully: Chromium download failed, all8
attempted cases failed at browser launch. Exact-head CI plus actual Staging host
flag readback, activation/rollback gates and two real replies remain required.

Recovery: existing byte-exact env rollback, restart and effective flag readback.
No new IAM, key provisioning, migrations or customer fixtures. New consent UI
invalidates pending generations and aborts on explicit withdrawal; no automatic
retries or persistent browser consent. Keep #1350 OPEN until actual acceptance.

Continuation: PR1443 merged/deployed as d51bc747; all exact-head checks passed,
including88browser cases. Host verify42497071320 confirmed disabled Support and
present Owner/workspace/provider/limiter configuration. Retention42496709137
succeeded with zero deletions. Activation42497173076 failed rollback verification
within0.44seconds; independent host readback42497360607 confirms Support=false
and the same source. Follow-up bounds application startup/rollback readiness,
adds fixed stage diagnostics and checks existing restart authority before writes.
Seven runtime cases pass. Actual activation and two real replies still pending.
