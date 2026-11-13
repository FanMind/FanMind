# ChatAdmin #1425 actual Staging preparation — 13 November 2026

Status: BLOCKED, no deployment/activation performed. This is a bounded proposed
action manifest and actual read-only evidence, not approval or live acceptance.
The prior Merge approval does not authorize this schema/bucket/runtime change.
No matching explicit approval for the extension was found in Issue #1425 or the
current instruction. Historical Production initial-media approval is unrelated.

## Source and target bound observations

| Item | Actual observation |
| --- | --- |
| Main and catalogue source | `3912461e1f88eb5cf2e621f23e4d6079409c20cc`, fresh GitHub branch read |
| Actual Staging baseline | `d34834979cef30c9c6af567d61b3df448901bfda`, HTTPS `/api/version`, 12:57:32 UTC / 13:57:32 Vienna |
| Last successful Staging deployment | run 43417498761, job 131859019101, success; same SHA |
| Active workflow runs | in_progress query empty at observation; queued results contained historical Production and CI jobs, no Staging deployment |
| Existing target only | `vshyhvgcmrlagvfnvomc`, existing private `chat-character-media` |
| Proposed deployment | No executable candidate yet. Main above contains the feature but cannot preserve the current Operator flag through the existing deploy controller. A successor is not implicitly approved. |
| Shared prerequisite | Draft #1470, head `900ce9454621696a761d94cef74070a075391fca`, base `6c1e376b788e9ef4d3d929a44214f8484e8610ba`, currently conflicted |

Staging d348 is an ancestor of the observed Main. The inspected deploy workflow,
reviewed-source policy and Operator session source have no diff in that comparison.
This preserves source lineage but does not fix the known deployment admission
problem: `STAGING_OPERATOR_SESSION_ENABLED=true` is rejected for Main, while
default false is written to `.release.env`. Neither path is acceptable.
#1470 owns the correction. Its other-session source reconciliation, exact-head
checks and explicit source approval must precede its regular merge. Do not copy
its implementation here, merge it, change protected rules or disable sessions.
After that merge, reread the actual Main SHA and Staging version, compare the
complete accumulated delta and prepare a new exact-SHA deployment approval.

## Actual database preflight

Read-only SQL on the existing Staging database returned
`exact_initial_media_contract=true` against
`scripts/operations/chat-admin-media-runtime-catalogue.sql` and the complete
`docs/operations/chat-admin-media-runtime-reference.json`. This is exact JSONB
equality, including function definitions/owners/privileges, grants, indexes,
constraints, RLS policies/expressions, triggers and bucket, not table counts.

Separate read-only checks: `chat_character_media_folders` absent; extension
columns `media_type,folder_id,byte_size,duration_ms,price_rules` count=0; new
functions price_rules_valid/catalogue_guard/object_path/catalogue_write count=0.
Media assets=0, bucket objects=0, enabled multi-Character capabilities=1. No
personal data, secret values or auth sessions were exported or changed.
These checks establish an intact baseline; runtime isolation/revocation tests
remain pending. Security advisor's existing authenticated SECURITY DEFINER
helper finding matches the pinned, auth.uid()/Workspace-gated initial contract;
it was not waived by changing grants. Advisor documentation:
https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

## Exact proposed schema and bucket action

SQL: `supabase/controlled/chat_admin_media_catalogue.sql`.
SHA256: `10626902dcd7e4ad35508191afad89aad25292f28965fae75351ec758c4248d2`.
Use this atomic controlled transaction, never a generic migration push or Web
deploy. No extra database/project/bucket, no public access and no new user grants.

The SQL adds the scoped folder table with RLS, grants, parent/Character foreign
keys and indexes; adds five typed media columns and their constraints; adds
four invoker functions, three triggers and folder policy definitions; replaces
the existing object guard and four existing policies for typed object paths.
Folder/file operations retain Character locking/revisions and current authority.
Existing authenticated grants gain only the documented catalogue write columns
and invoker RPC, not service-role browser access.

Bucket change in this SAME SQL: `public=false` remains;
`file_size_limit: 5242880 -> 26214400` bytes;
`allowed_mime_types: ['image/webp'] -> ['image/webp','video/mp4']`.
WebM is accepted only as application input and normalized to MP4 before storage.
Images retain the application/schema 5 MiB bound; videos have the 25 MiB bound.

The existing activation preflight pins the INITIAL catalogue and 5 MiB bucket;
applying this extension will deliberately fail that check. Before approval,
prepare and review the extension-specific source-derived exact postflight and
checksum control, including folder grants/policies/triggers, and reconcile the
activation controller against that exact contract. Never adopt desired expected
state from the live target or weaken the initial reference to accept both states.
This operational source work is not yet implemented in the observed Main.

## Runtime prerequisites and intended flags

Existing `FANMIND_CHAT_ADMIN_MEDIA_ENABLED` must remain enabled for the library;
its actual process value was not read here. Separately proposed:
`FANMIND_CHAT_ADMIN_MEDIA_CATALOGUE_ENABLED=true`, then only after host proof
`FANMIND_CHAT_ADMIN_MEDIA_VIDEO_ENABLED=true`.
`FANMIND_CHAT_ADMIN_MEDIA_ANALYSIS_ENABLED=false` must remain; no image-provider
approval or calls, and no video-analysis capability is claimed.

Host evidence is REQUIRED before video activation. Check `/usr/bin/ffmpeg` and
`/usr/bin/ffprobe`, libx264/AAC encoders, MOV/Matroska-WebM demuxers and the input
decoders h264/hevc/av1/vp8/vp9 plus accepted audio. Run neutral MP4 AND WebM
through the actual application normalizer, including audio and invalid input;
record duration, output format/bounds, time and cleanup. A version/encoder list
alone does not prove successful conversion in the application service context.

Inspect EFFECTIVE service user, private temp mount/permissions/writable space,
umask, cgroup memory/CPU/tasks limits and available capacity, process limits,
30-second child timeout, concurrency/rate limits and cleanup after errors.
Source unit declares `PrivateTmp=true`, `UMask=0077`, `NoNewPrivileges=true`,
`ProtectSystem=strict`, application-only writable source path; this is source,
not an effective-host attestation. Current code bounds one video process per
application process, two Workspace conversions/minute, 25 MiB, 300 seconds,
3840x2160 input and 1280x720/30fps output. It does not establish an OS aggregate
memory/CPU quota. Missing codecs or unsafe/insufficient resources block videos.
Assess full-object video range preview: at most 12 reads/minute, potentially
300 MiB/minute/Workspace. Keep video disabled if target capacity is inadequate.

This pass could not execute on that host: no configured SSH identity or CLI
login, no connector dispatch action, browser setup timed out. Existing protected
runtime workflow has no read-only video-host action. Need an authorized existing
server session or a separately reviewed protected host diagnostic path; no new
privilege, debug endpoint or arbitrary SQL OS execution was attempted.

## Bounded proposed acceptance data and cleanup

Use only dedicated synthetic test Characters/fans in the authorized existing
Staging test Workspace; do not repurpose Facebook/support records. Reserve the
fixture prefix `FM1425-20261113` and record created UUIDs privately. No new real
account or capability grant is proposed. A second independently authorized test
Workspace is required for actual cross-Workspace negatives; absence is a blocker,
not grounds to widen authority. Character separation uses two fixture Characters.

Create neutral color/shape images, a one-second color MP4 with synthetic tone
and a one-second WebM. No people/customer media. Include malformed/truncated,
wrong MIME/signature, image over 5 MiB and video over 25 MiB rejection fixtures.
Create nested image/video folders, move files/subtrees, check empty-only delete,
category inheritance and per-file override. Synthetic EUR test offers only:
start 12, minimum 10, maximum 15; counteroffer 11 allowed if enabled, 9 refused;
test negotiation off, special discount off/on and manual confirmation separately.
No payment or delivery is performed. Distinguish present reviewed media, absent
media and uncertain requests; do not treat local grounding tests as real provider
reply acceptance. Any provider-based text test must stay within its existing
explicit authorization and cost controls; otherwise report it blocked.

In desktop and mobile Chromium verify upload/list/private preview/prices/move,
invalid input, stale revision and auth/isolation negatives. For revocation,
temporarily withdraw ONLY the identified existing test capability after separate
bounded approval, record its prior exact state and restore it in finally; never
withdraw the shared Facebook Operator session or log out its account.

Delete each test object via the normal authorized media API; prove independent
authenticated 404, no private object, then delete fixture metadata/folders/fans/
Characters in safe dependency order. Keep a private UUID ledger and compare exact
fixture counts before/after. Inspect the service's actual temporary namespace for
the recorded conversion directories after success, errors and rejected input;
prove absence. Do not claim reliable cleanup from `finally` source inspection.

## Recovery and approval boundary

Before writes, record redacted effective feature flags and private configuration
fingerprints, preserve Support/Meta/Stripe/Billing settings and existing Operator
continuation, verify current backups and acquire the shared Staging deployment
lock. Recheck Main, target version and running/queued deployments immediately.
Stop if another work session advanced the target; never overwrite its successor.

SQL failure rolls back its atomic transaction. After a committed extension or
test media, disable video/catalogue on failed acceptance, preserve schema/data,
and remove only the recorded synthetic fixtures. Do not drop the table/bucket
or shrink the bucket while videos remain. Restore only owned flag edits when
their config fingerprint still matches, never clobber concurrent changes.
Code rollback must use the supported exact reviewed release and retain current
Operator/Support/Facebook/Billing state; do not assume the present deploy script
is an already verified rollback controller.

The requested bundled deployment approval is NOT READY: its exact deployable
successor, extension-aware pre/postflight/controller and effective-host evidence
are outstanding. No blanket permission question or guessed successor SHA is
substituted. Next coordinate #1470's reconciled reviewed source, obtain the
authorized host diagnostic access, finish those controls, then present the exact
commit-bound Staging-only bundle. Production remains outside this task.
