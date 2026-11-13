# Support #1350 — private Staging release recovery

The Owner authorized full completion after reviewing the concrete Staging
rollout, snapshot/restore prerequisite and disposable alarm acceptance. This
extends the existing deployment workflow, not the Support product. No schema,
bucket, credential, permission, provider, Billing or feature activation occurs.

Main Operator-preserving deployments now require `expected_current_release` as
well as exact reviewed Main, manual dispatch, Billing `preserve`, true Operator
input and `preserve-approved-operator-session`. Existing named feature branches
are unchanged. Source guards still reject off/missing/unsafe continuation state.

Before source copy/build, the protected existing self-hosted Staging job checks
the exact live old SHA/health, current regular metadata, true continuation,
existing unit/configuration and build, and free local disk space. It copies the
current runtime (including dependencies, build and release metadata) into the
runner's private `~/.fanmind-staging-recovery/<run-id>/runtime`. Git, private
environment/recovery configuration and mutable Next cache are excluded. Both
copy directions use rsync content checksums: equal size/mtime is not sufficient.
The real-copy test deliberately changes same-size files at identical mtimes. No file
is uploaded. Modes700/600 and ownership, symlink boundaries, bounded tree size,
before/after file identities and source/copy fingerprints are checked. The
receipt is committed only after both old-target observations agree.

File reads use no-follow, nonblocking file descriptors, require a regular file,
and compare device/inode/size/change times before consuming and after hashing
bytes. The regression rejects replaced identities, symlinks and special files.
This addresses the actual CodeQL file-check/open race; no alert is suppressed.

The whole deployment remains under `fanmind-staging-deploy`. After successful
build/switch/smoke, the new exact version, health and unchanged configuration/
release flags are checked before the private receipt is marked accepted. The
receipt and old runtime stay available; no backup purge is performed here.

Failure/cancellation invokes the same helper. It restores only a complete
receipt bound to that exact old/new SHA pair and run. It first refuses changed
configuration/unit, unsafe paths, corrupt snapshot, different current release
metadata or altered non-version flags. It copies back the old runtime, restarts
the existing service and proves old HTTPS version/health and unchanged private
configuration. Database/provider/Auth sessions are never restored. A failure
before any committed snapshot reports `NO_SNAPSHOT_NO_RESTORE`, not rollback
success. Interrupted jobs retain the private receipt; do not blindly redeploy.

The same workflow has an explicit `support_release_action=restore` path:
`confirmation=restore-staging-support-release`, `reviewed_commit=<same Main
SHA that created the snapshot>`, `expected_current_release=<old SHA>` and
`recovery_run_id=<original deployment run>`. It retains the protected staging
environment, exact Main source and shared lease. A later Main change blocks
this original-source recovery and needs deliberate source reconciliation; no
branch move, SSH bypass or wildcard admission is installed.

Automated source/filesystem tests exercise old/new build restoration, exact
metadata, private modes, replay/source/run binding, drift/corruption rejection
and preservation of configuration. Hosted CI also runs the actual rsync case.
Local absence of rsync is a disclosed SKIP, never a passing copy proof. These
tests are not evidence that a live host snapshot or rollout already occurred.

After the protected rollout, continue the existing Issue1350 real Owner alarm
acknowledgment, fresh read/reload/reopen, stable replay timestamp, auth/tenant
negatives and exact synthetic-tuple cleanup. Do not activate media catalogue,
video, analysis or automatic Facebook ingress. Production uses its separate
existing isolated-release controller and remains a distinct target acceptance.

## Existing Production Help UI build

Authenticated baseline inspection found no Hilfe button on Production. Its
isolated build previously relied on an absent public build flag. The existing
Production workflow now offers explicit `support_help_ui=true` (default false).
It builds the already implemented launcher only when the existing shared Support
setting parses exactly true, and rejects the Support-must-stay-disabled guard.
It changes no server setting, permission or unrelated feature. Default false
retains the previous build behavior. The existing executed rolling-release
harness proves refusal before switch when Support is disabled, the true public
build flag when enabled, and unchanged isolated-release/rollback behavior.
