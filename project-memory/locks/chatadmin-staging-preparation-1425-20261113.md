# CHATADMIN-STAGING-PREPARATION-1425-20261113

Risk: R3 source-only Staging operational verification; existing Issue #1425 and
Draft PR #1471, sole writer current ChatAdmin session. Owner explicitly requests
the exact extension activation check and a narrowly scoped manual existing-runner
diagnostic. No other-agent delegation requested. No target mutations authorized.

Affected FM-CONTRACT-CHATADMIN-STORAGE-001 / FM-IGATE-CHATADMIN-STORAGE-001;
FM-CONTRACT-CHATADMIN-AI-001 remains unchanged and provider activation excluded.
Keep initial exact reference and default initial profile; add source-recreated
extended exact reference, read-only state classification and explicit profile.
No SQL edit, generic migration, public bucket or relaxed policy/privilege check.

Diagnostic source uses existing protected staging environment and exact existing
runner labels, Main/manual/exact-source plus expected-live SHA, shared Staging
lease and no secrets/installation/restart/configuration action. Same runner is
not application-context proof: UID/GID, mount, actual cgroup membership, kernel
security metadata and limits must agree before private synthetic probes.
Missing entry authority or finite resource limits stays BLOCK; no sudo or
capability expansion. Source merge and protected diagnostic execution remain
Owner-gated. Existing provisioning grants do not include namespace/cgroup entry.

Support #1470 is maintained by its other session. Fresh head7c9b932a is Draft,
open, mergeable; no copy or merge of its deployment fixes here. Source Main
3912461e and live Stagingd3483497 are current starting observations, not approval
to deploy either source or any unreviewed successor.

Verification: local source-recreated PostgreSQL17.5 WASM exact initial/extended
catalogues and33 drift groups, real local synthetic video success/error cleanup,
dispatch/context/negative unit checks, existing media/Support/Actions regression,
lint and governance. Native PG17.11 source reconstruction/drift tests are wired
into existing media CI; exact-head CI result must be recorded separately.
No independent review or live host acceptance is inferred from self-tests.

Recovery: source-only revert before protected use; diagnostic writes only its
fresh0700 synthetic directory, finally/signal cleanup and always cleanup step.
Unsafe/existing directory or changed source/live process fails closed. Schema,
bucket, flags, Operator sessions, Support, Facebook, Billing and Production are
untouched. Future runtime recovery retains committed schema/data and disables
only owned catalogue/video flags; never blanket rollback concurrent settings.
