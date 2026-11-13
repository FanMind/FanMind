# ChatAdmin media cleanup verification

Task: `FM-CHATADMIN-MEDIA-CLEANUP-20261107`, continuation of #1425.
Base: `d8d84629720fb5ace25140f3d5f0682926fb7d54`.
Scope: bounded repository-only deletion verification and synthetic regressions.

## Finding and correction

The normal private-media helper accepted a matching Storage DELETE response
without the subsequent authenticated GET-404 check already required for an
empty-result retry and by the account-deletion processor. This is a missing
independent API-level absence observation, not demonstrated data loss.

Both accepted DELETE responses now use the same exact-object absence check.
Malformed or ambiguous acknowledgments, non-404 probes and transport errors
fail closed. The route retains its revoked metadata for a later retry.
The SQL tombstone visibility and storage-object metadata-deletion guard remain
unchanged. An authenticated 404 is not a claim of physical backup erasure.

Affected boundaries: `FM-CONTRACT-CHATADMIN-STORAGE-001` /
`FM-IGATE-CHATADMIN-STORAGE-001` and deletion verification under
`FM-CONTRACT-DISCLOSURE-DELETE-001` / `FM-IGATE-DISCLOSURE-DELETE-001`.
No account-deletion processor, SQL, RLS, grants, paths or provider logic changed.

## Source evidence

- Baseline source: two of the three new test groups fail, demonstrating the
  missing probe and false success for an object still readable after DELETE.
- Patched source: three test groups / 26 scenarios pass with zero skips.
- Independent countercheck repeated those tests and syntax checks without a
  blocking finding. Local Node is 24.22.1.
- Cases are imported by the existing CI-owned media API suite; the direct
  helper harness uses Node's built-in TypeScript stripping (supported from
  repository minimum Node 22.13.0). It replaces imports only, with synthetic
  cookies, configuration and fetch, and executes the actual helper source.
- Full API tests, lint, build and native PG17 remain dependent on exact-head
  CI, including the pinned Node 22.13.1. Local dependencies are absent, so
  those stages are not claimed as locally passed.

## Remaining boundary

No target transaction, real image upload, image-provider call, flag change,
schema apply, deployment or new access occurred in this continuation. The
existing Production writer remains paused for the existing ChatAdmin Owner
login, as recorded in #1425 comment 6664320600; this is not a second runtime
writer. Preserve that existing target handoff instead of provisioning another
account or repeating the schema installation.

Owner-authenticated real Storage upload/read/isolation/delete acceptance,
library activation, and separate image-analysis provider/privacy/cost
approval remain distinct. Source CI and Main integration do not close them.
Recovery before runtime rollout is a source revert; no data/schema deletion
is part of this patch.
