# ChatAdmin #1425 actual Staging preparation — 13 November 2026

Status: SOURCE IMPLEMENTED / TARGET EXECUTION PENDING, no deployment/activation performed. This is a bounded proposed
action manifest and actual read-only evidence, not approval or live acceptance.
The prior Merge approval does not authorize this schema/bucket/runtime change.
No matching explicit approval for the extension was found in Issue #1425 or the
current instruction. Historical Production initial-media approval is unrelated.

## Executable continuation in existing PR #1471

The current continuation integrates the regularly merged Support PR #1470.
Fresh GitHub Main: `33e6569602e8fe910058e268b4f33c1879799869`; #1470 is CLOSED
and MERGED, not an outstanding merge dependency. Its approved head was
`7c9b932ae5ec92990ac2ea36154e8623f2043497`.

Existing PR #1471 started at `977f2fc4e0fdadeecfe510a696bce4a6432b20e0` on old
Main3912461e. Fresh GitHub reports `mergeable=true`, `mergeable_state=behind`:
strict up-to-date protection, not an actual content conflict. A genuine two-parent
merge of actual Main33e65696 into the SAME PR completed without content conflicts.
All eleven #1470 paths (including deployment/session admission, Expo patches and
Support runbooks) match Main byte-for-byte. Existing #1471 executable operational
checks and all earlier Facebook/Adminchat source are retained. Only operational
status/approval evidence is refreshed in addition to that incoming merge.

The earlier14/14 checks apply only to977f2fc4. The combined source requires new
exact-head CI; current head/tree and completed results are recorded in PR #1471.
No previous source/merge/deployment permission is transferred to the successor.
Actual HTTPS Staging at14:36:05 UTC /15:36:05 Vienna remains
`d34834979cef30c9c6af567d61b3df448901bfda`. No target mutation or host diagnostic.

Implemented:

- `chat-admin-media-schema-profile.mjs` plus the source-owned extended reference
  and expanded catalogue collector. Profiles are only `initial` or `extended`;
  the database state is `initial`, `extended` or `block`. No auto/loose profile.
  The initial reference and original collector remain byte-for-byte unchanged.
- Extended exact comparison covers all media tables/columns/defaults/column ACLs,
  constraints/indexes, RLS/force-RLS, policy predicates/roles, complete function
  definitions/owners/ACLs, user triggers and private bucket. Additional media
  relations and disabled internal RI triggers also fail closed. SQL SHA256 is
  pinned independently; references are regenerated only from controlled source
  in an isolated source database, never learned from live Staging.
- Existing activation preflight explicitly receives `media_schema_profile`;
  default is `initial`. Extended verification requires its exact25MiB WebP/MP4
  contract and the seven exact function bodies. Support Owner/retention/source,
  target/TLS and private connection checks remain. This is schema verification,
  not permission to apply SQL or enable catalogue/video flags. The legacy runtime
  controller still changes only its existing flags; no new activation is hidden.
- `.github/workflows/chat-admin-media-host-readiness.yml` is manual, Main- and
  exact-source-bound, protected by existing `staging`, same canonical Staging
  concurrency lease, and ONLY existing self-hosted Staging labels. No hosted
  fallback, dependency installation, deploy/restart/config write, sudo, DB or
  provider action, private environment-file read or secret input. Subprocess
  environments are constructed from a small non-secret allowlist.

Actual runner evidence: successful deploy43417498761/job131859019101 used
`fanmind-staging-01-exoscale`, groupDefault, all five required labels. Existing
provisioning source grants that account only nginx-test and the three named
Staging systemctl operations; it contains no namespace/cgroup-entry grant.
Historical runner success is not a fresh running-host permission attestation.
No existing workflow offers this bounded diagnostic without mutation, so the
new workflow is prepared but not dispatched or installed.

The diagnostic binds public HTTPS AND local127.0.0.1:3001 version to the requested
live SHA, checks fixed unit/PID/cwd, effective service user and UID/GID, actual
mount and cgroup membership (not merely cgroup namespace), kernel security
metadata/process limits, private temp access/free space, cgroup memory/CPU/tasks,
root-owned executable identity against the app root, tool versions and codecs.
Inspect can report metadata/tooling without claiming successful app conversion.
`probe` refuses all temporary writes unless the actual app context and bounded
resources are proven. It creates only a fresh0700 run/attempt directory, produces
neutral MP4/WebM with synthetic tone, normalizes both to H264/AAC, checks invalid
input rejection and proves deletion. Finally, signal and workflow-always cleanup
are implemented; an existing directory is refused. A changed process/release,
missing permission/tooling or cleanup failure is never relabeled PASS.

**Minimal remaining access if inspection confirms the source expectation:**
permission for one fixed reviewed diagnostic to EXECUTE as the existing service
UID/GID inside its actual mount/sandbox, cgroup and process limits. General SSH,
a password, a private key or unrestricted sudo is unnecessary. The prepared
workflow never grants that authority or changes systemd resource limits. A
root-owned bounded helper or supervised host-admin execution would need its own
specific source/installation/execution approval; none is assumed here. Merely
entering a cgroup namespace does not move a process into its resource cgroup.
Run `inspect` first to establish which exact effective boundary is missing.

## Earlier implementation verification (before the Main integration)

- Actual Staging read-only `initial` profile equality returned1 on13:22:59 UTC;
  no SQL/bucket/data mutation. This verifies the NEW initial profile on the real
  target; the real target still has no extension.
- Source recreation with local PGlite0.3.14/PostgreSQL17.5 WASM matched the retained
  initial reference, generated the extended reference and passed both profiles,
  original media/catalogue lifecycle and33 adverse drift groups (161 SQL calls).
  This is local PG17 WASM evidence, not native-host or Staging extension proof.
- Local58/58 focused API/schema/dispatch/context/video/runtime/Actions checks,
  zero skips, including real MP4/WebM audio conversion and failure cleanup PASS.
- Targeted ESLint, action pins, diff checks and structural governance PASS.
- Native PG17.11 source recreation/drift and actual local video helper tests are
  wired into the existing media CI jobs. Exact new-head hosted results are
  recorded on PR #1471 after completion; earlier results are not reused.
- No live host diagnostic, new actual media upload, revocation, provider call,
  deployment or activation has occurred in this continuation.

## Concrete next approvals and later Staging bundle

1. After exact-head CI/source review, approve the regular source merge of #1471
   at its actual recorded PR head, explicitly covering the manual read-only
   self-hosted diagnostic and the explicit schema-profile admission. No target
   deploy, SQL, flags, server installation or additional sudo authority.
2. After that merge, bind `reviewed_commit` to the ACTUAL merged Main SHA and
   `expected_live_commit` to a fresh Staging version. Approve/run ONLY
   `chat-admin-media-host-readiness.yml`, action `inspect`, confirmation
   `inspect-staging-media-host`, protected existing Staging runner. This is not
   `deploy-staging.yml`. The diagnostic may deliberately return BLOCK with the
   precise context/resource permission it could not establish. Probe requires
   separate `probe-staging-media-host` and proven context; never work around it.
3. #1470 is regularly merged at33e65696 and retained in this candidate. After
   #1471 source approval and its regular merge, independently read the ACTUAL
   resulting Main merge SHA and fresh live target/locks. That is the next common
   source candidate; compare every accumulated delta before the deployment bundle.

The final deployment approval is deliberately NOT executable yet: #1470 IS
merged, but #1471 is not, and no actual application-host result exists. A PR head or GitHub speculative merge commit is
not a usable approved Main deployment. Fill the ACTUAL common Main SHA only after
the #1471 source merge; revalidate any later successor. Do not approve a placeholder.

| Bundled Staging field | Exact prepared scope / execution gate |
| --- | --- |
| Deployment commit | Pending actual approved Main after #1471; foundation33e65696 already includes #1470 preservation but not these operational checks |
| Fresh baseline | Current observed d34834979cef30c9c6af567d61b3df448901bfda; re-read at execution |
| SQL target/hash | Existing vshyhvgcmrlagvfnvomc only; controlled/chat_admin_media_catalogue.sql;10626902dcd7e4ad35508191afad89aad25292f28965fae75351ec758c4248d2 |
| SQL checks | Exact `initial` preflight; atomic approved SQL; exact `extended` postflight; partial/drift => STOP |
| Private bucket | public=false retained;5242880 to26214400 bytes;image/webp toimage/webp+video/mp4 |
| Flags | Retain existing media flag; separate catalogue=true; video=true ONLY after actual host proof; analysis=false |
| Deployment preservation | #1470 exact preservation inputs, existing Operator alreadytrue; Billing preserve; no recovery/permission change; preserve Support/Meta and sessions |
| Synthetic acceptance | Only recorded FM1425 fixtures and scoped test capability; details below; separate text-provider/cost approval if needed |
| Recovery | Atomic SQL failure rollback; committed schema/data retained, owned catalogue/video flags off; exact synthetic cleanup; no destructive bucket shrink or blanket config restore |
| Excluded | Production, image/video provider analysis, real media, automatic external send, new DB/project/public bucket |

The following sections retain the original inspected baseline/action details as
historical observations and the still-valid bounded test/recovery plan.

## Historical source and target observations before the #1470 merge

| Item | Actual observation |
| --- | --- |
| Main and catalogue source | `3912461e1f88eb5cf2e621f23e4d6079409c20cc`, fresh GitHub branch read |
| Actual Staging baseline | `d34834979cef30c9c6af567d61b3df448901bfda`, HTTPS `/api/version`, 12:57:32 UTC / 13:57:32 Vienna |
| Last successful Staging deployment | run 43417498761, job 131859019101, success; same SHA |
| Active workflow runs | in_progress query empty at observation; queued results contained historical Production and CI jobs, no Staging deployment |
| Existing target only | `vshyhvgcmrlagvfnvomc`, existing private `chat-character-media` |
| Proposed deployment | No executable candidate yet. Main above contains the feature but cannot preserve the current Operator flag through the existing deploy controller. A successor is not implicitly approved. |
| Shared prerequisite | Draft #1470, head `900ce9454621696a761d94cef74070a075391fca`, base `6c1e376b788e9ef4d3d929a44214f8484e8610ba`, previously conflicted; current7c9b932a is mergeable |

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
This operational source work is implemented in PR #1471 above; it is not yet merged on Main.

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

At this historical checkpoint the bundled deployment approval was NOT READY.
The extension-aware profile is now implemented in this PR; #1470 is merged.
The actual #1471 Main merge SHA and effective-host evidence remain outstanding. No blanket permission question or guessed successor SHA is
substituted. Next approve and regularly merge the fully checked #1471 successor, propose the
exact merged-source host inspection and resolve its actual findings, then finalize the prepared exact
commit-bound Staging-only bundle above. Production remains outside this task.
