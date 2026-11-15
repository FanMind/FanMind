# ChatAdmin #1425 — private Storage finalization

Status: source preparation; database-function replacement UNAPPLIED; actual
PNG/MP4 Staging lifecycle NOT YET ACCEPTED. Production and nginx excluded.

## Proven failure and precise condition

The Owner's PNG reaches the catalogue route, is decoded/re-encoded as WebP,
and its metadata INSERT returns HTTP201. The following private Storage upload
returns HTTP500/P0001 in `chat_admin_media_object_guard`, with the fixed code
`media_object_binding_invalid`. The application then marks its metadata deleted,
unavailable and unreviewed. No private object row remained in the read-only
inspection. The old route leaves this cleanup tombstone instead of attempting
its existing verified Storage cleanup automatically.

Supabase Storage's observed application version is 1.94.2. Its tagged
`src/storage/uploader.ts` runs `completeUpload` in `db.asSuperUser().withTransaction`,
checks caller permission through a rolled-back `db.asCaller()` probe, then
writes the real object through the internal connection. In
`src/internal/database/pg-connection.ts`, `asSuperUser` selects the configured
super-user payload. This loses the caller `sub`; the API log's
`authenticated` label describes the incoming request, not this final DB scope.

The native regression uses the identical Workspace/Character/asset/path/Owner:
the original guard accepts the caller probe; its internal finalization has no
`auth.uid()`, so `chat_admin_media_writes_allowed` is false and the guard raises.
Changing bucket, file size, Base64, nginx or RLS cannot correct that predicate.
Hosted native test success, rather than this explanation alone, is required.

Upstream references (review only, never installed):
- https://github.com/supabase/storage/blob/v1.94.2/src/storage/uploader.ts
- https://github.com/supabase/storage/blob/v1.94.2/src/internal/database/pg-connection.ts

## Smallest bounded authorization correction

Only replace `public.chat_admin_media_object_guard()` (SECURITY INVOKER,
empty search_path). No helper function, new SECURITY DEFINER, grant, policy,
bucket, endpoint credential or service key is introduced.

Caller context still uses the existing Owner/Workspace/deletion predicate;
non-null object ownership must also match that caller. Only the actual internal
DB role `service_role`, service-role claims and absent caller sub may use the
Storage-assigned `owner_id`. That must equal the current Workspace Owner;
legacy owner, when present, must agree. The guard independently checks the
live capability grant to that same Owner and absence of processing account
deletion. Exact typed object path, existing nondeleted media row, active
Character and Character lock remain mandatory. No role-only success branch.
Client-supplied `user_metadata` is never an authority source. Browser and
application uploads retain their existing user JWT; native Storage performs
its own caller-RLS probe. Foreign callers cannot enter the internal branch by
forging JWT text, object owner or user metadata.

## Failed uploads

Both existing image/catalogue routes invoke the same existing-library helper:
mark unavailable/unreviewed/deleted, authenticated Storage DELETE, independent
exact absence proof, current Character authority recheck, then scoped DELETE
of the exact tombstone revision with an exact returned-row acknowledgement.
The upload remains a failure even when cleanup succeeds. If authorization is
revoked, Storage is unreachable, absence uncertain or the revision changed,
the tracked unavailable tombstone is retained and reported as cleanup pending;
never remove the last reference to bytes whose absence is unproven. Existing
UI deletion/retry remains the recovery path. No deletion of historical failed
uploads or real Models is authorized by applying this function correction.

## Protected Staging path and approval scope

New workflow `chat-admin-media-storage-staging.yml` reuses the existing
protected Staging environment, dedicated private passfile, verify-full TLS,
exact Main/reviewed/live SHA binding and shared `fanmind-staging-deploy`
concurrency. Preflight preserves exact Support/retention/media checks.
`verify` is read-only. `apply` additionally requires
`staging-media-storage-apply` and explicit nonproduction write acknowledgement.
The SQL checksum is pinned in `chat-admin-media-storage-finalization.mjs`.

Inside one bounded transaction, the runner takes the existing media-catalogue
advisory lock and Character/media/Storage table locks. It accepts only the
complete exact source-derived pre-repair or post-repair catalogue. It replaces
only the guard and requires the full exact post-repair catalogue before COMMIT.
Any error rolls back; already-ready may skip only with exact equality. Normal
Web deployment never calls the SQL. The existing media preflight admits only
the two pinned guard bodies; arbitrary function/grant/RLS drift still blocks.
Retention equivalence admits only this new checksum-pinned independent source;
native Support-catalogue/retention preservation remains mandatory.

**Required additional Owner decision before any target function mutation:**
approve this exact guard-only replacement on existing FanMind Staging, after
exact-head CI/nativePG17 review, regular merge and protected exact-version
Staging Web deployment. Preserve all grants/RLS/bucket/prices; no Production,
nginx, Support/Meta/Billing changes and no writes to real Models. No target
mutation is implied by source/merge/Web approval.

After approval: fresh Main/live/deployment-lock checks; reuse successful CI;
protected guard-only verify/apply/readback; synthetic PNG and MP4 lifecycle at
`FM1425-20261114-1945-A`, preserve `Abendkleidung` and 25 EUR. Prove actual
storage/display/playback/assignment, rejection, move/delete and persistence
before PASS. Synthetic testing must not wait on another personal image upload.

## Actual protected read-only preflight after Web deployment

PR1514 merged regularly as5fc2832b; protected Web rollout43704172145 succeeded
and HTTPS independently confirmed that exact Staging SHA. No guard Apply and
no nginx operation. Protected read-only guard verification43704593446 stopped
before the guard step: Support EXACT/PASS, common media preflight FAIL.

Independent complete live catalogue comparison is EXACT against the original
extended reference (integrity_ok=true); guard remains the old pinned body.
Fresh successful retention receipt15November09:38UTC still binds30a2da24.
The original source-equivalence function reproduced the block offline with full
Git history: the sole uncovered added file is the already-merged
`ai_capacity_entitlement_writer.sql`, SHA256
`536c15017c53a979d876d3b1174caecfbfb719ff49fc7b0262d174b1bb0128dc`.
No rerun, receipt rewriting, SQL exception by directory or target mutation.

A bounded follow-up adds only that exact ADD/mode/checksum source exception.
The native PG17 countercheck installs its unchanged original SQL after its
original dependencies inside the disposable fixture, verifies the full Support
catalogue and actual retention results before/after each addition, and confirms
zero entitlements and zero package mappings. Existing negatives still reject
modified known SQL, unknown SQL, permission/reference/runner changes and bad
source ancestry. This source equivalence never approves installing/activating
Capacity, Billing or Support on any target. The original guard-only additional
Owner approval remains required and its SQL checksum remains unchanged.
