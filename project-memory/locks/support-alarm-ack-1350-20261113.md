# SUPPORT-ALARM-ACK-1350-20261113

Owner authorizes exact PR1466 merge only, then Support acknowledgment source
repair, independent tests and a coordinated deployment proposal. Other Work-tab
authorizations are not inherited. Risk R2 source; no live DB, grant, schema,
secret, runtime flag or deployment mutation authorized or performed here.

PR1466 regular protected merge:798fa177f052075e107faaddd37dc74df260d68b,
parents4488fc0ff548e2ec2fc230a0403d1826849fd233 and approved
7072b39d5f995a4ac72a37c3a24572645c26b8d7. All12 current ruleset-required checks
and14 total exact-head checks were successful immediately before merge. Ruleset
24945113 active, strict, no bypass. Independent Main ref/PR metadata/local Git
parents and tree verified the merge; no other source files overwritten.

The historical Production proxy-Origin bug is already fixed on Main in4b917976,
but absent from livea798d793. An executed actual-route mutation reproduces403
before RPC for the old comparison and successful persisted acknowledgment/fresh
read for the configured HTTPS origin. No duplicate Origin implementation.

Additional concrete source defect reproduced on798fa177: RPC false still returned
HTTP200/ok. Fix requires exact true plus a fresh authorized inbox read without
that notification. A recurrence or malformed/false result conflicts; a failed
readback stays unavailable. Existing idempotent RPC permits safe retry. No SQL or
ACL change. Tests cover actual route, origin/Owner/body/rate/feature denial,
reopened alert and ambiguous committed acknowledgment/readback retry. Extend the
existing isolated PG17 contract proof for true/false/Owner/stable repeat timestamp;
browser tests cover fresh mount and failed acknowledgment without auto retry.

Fresh runtime reads09:19UTC: Stagingaae0003c6836ef73235c0d771d6387ee0e29f81b
(other Work-tab rollout), Productiona798d7938bb4e7e168f615f0c32d1a603dd47d4a.
Preserve Staging; do not deploy Main over that separate #1463/#1465 source.
PR1440 remains separate Draft2374ca26; its media cleanup is not copied/merged.
See docs/operations/SUPPORT_DEPLOYMENT_PROPOSAL_20261113.md for source/target
coordination and explicit remaining approval/acceptance boundaries.
