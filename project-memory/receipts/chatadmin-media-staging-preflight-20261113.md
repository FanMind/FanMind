# #1425 Staging preparation — 13 November 2026

Status: PREPARATION_BLOCKED, no deployment/schema/bucket/flag mutation authorized or performed.
This receipt supersedes historical target/source observations below; it does not
replace the successful source/CI evidence for merged PR1469.

## Fresh source and target evidence

- Main: 3912461e1f88eb5cf2e621f23e4d6079409c20cc, independently fetched.
- Actual Staging HTTPS /api/version at 2026-11-13T12:51:25.043Z:
  d34834979cef30c9c6af567d61b3df448901bfda, runtimeEnvironment=staging.
  environment=production denotes Next.js build mode, not the runtime target.
- Latest visible direct Staging deployment: run43417498761, completed success;
  workflow list had95runs, with no newer direct deploy listed at observation.
  This is not an assertion about every independent controller/queued run.
- Existing authenticated /chatadmin opened with the Operator session without
  login/logout/refresh manipulation. Character list empty; no test record created.
- PR1470 remains Draft/open at900ce9454621696a761d94cef74070a075391fca,
  mergeable=false against newer Main. The owning Support Work-session retains
  its implementation and merge decision; this session does not edit or merge it.

## Actual read-only Staging database proof

Existing project vshyhvgcmrlagvfnvomc only. Catalog reads used READ ONLY
transactions; no database was created and no production target queried.

At2026-11-13T12:52:47.218649Z and12:54:51.552022Z:
- Existing chat-character-media bucket private,5242880bytes,image/webp only.
- Existing media and media-policy tables have RLS; authenticated scoped policies,
  composite Workspace/Character bindings and managed Storage ownership retained.
- Exact complete catalogue equals docs/operations/chat-admin-media-runtime-reference.json
  in all five sections: tables, functions, policies, triggers, bucket.
- Source baseline SQL SHA256:
  3c4fa2214b5721dd8a7bc85d9ea3ef3b6b8c592c5305315eb623cf99cf1d59fe.
- Folder table, five typed media columns and catalogue-write RPC absent.
- Exactly one FanMind Staging Operator workspace and one enabled existing
  chat_admin_multi_character capability. No capability write performed.
- Existing media metadata0, media policies0, bucket objects0.
- Existing-schema catalogue equality is not post-extension acceptance and is
  not a substitute for authenticated foreign-user negative tests.

## Source and server readiness blockers

1. Main deploy policy rejects STAGING_OPERATOR_SESSION_ENABLED=true on Main.
   Executed the current exact policy: preserve=true denied, false admitted.
   The normal workflow would write false when using its default. Do not deploy
   that path and disable existing continuation. Reuse PR1470 preservation logic
   after its owner integrates/reviews it against latest Main. No duplicate fix.
2. Existing staging-support-media-runtime controller manages legacy media/
   Support/analysis flags only, not catalogue/video flags. Its existing
   activate/deactivate action couples legacy media with Support. Do not use that
   action as a catalogue/video controller or disable Support for media rollback.
3. Existing activation preflight intentionally pins old5MiB/WebP schema and
   exact baseline catalogue. The extension would be detected as drift. Reviewed
   extension-aware pre/postflight and a media-only flag control must exist before
   apply/activation; do not delete or loosen the baseline assertions.
4. Actual application-host ffmpeg/ffprobe, codecs, writable private temp,
   resources and cleanup remain UNVERIFIED. No configured SSH agent/managed
   remote execution tool was available. The new source-only chat-admin-media-host-inspection workflow/script prepares
   that missing diagnostic, guarded by protected Main, exact source/live SHA and
   shared Staging lease. It has NOT been run on the target; normal source review/
   approval/merge is required first. No deployment/provisioning or Production
   workflow was repurposed. Inspection performs no temporary/media/config writes.
   It observes actual service PrivateTmp permissions/headroom and binary/codecs;
   actual conversion and reliable cleanup remain later synthetic acceptance.
   Source service has PrivateTmp=true,UMask0077,NoNewPrivileges=true,
   ProtectSystem=strict. It declares no media-specific MemoryMax/CPUQuota.
   These source settings do not prove live unit state, headroom or codecs.

## Fixed schema/storage package, still UNAPPLIED

Path: supabase/controlled/chat_admin_media_catalogue.sql
Git blob: f21e290d619de14443067c924c92f2a6801732d4
SHA256: 10626902dcd7e4ad35508191afad89aad25292f28965fae75351ec758c4248d2

Adds the scoped folder table with same-Character parents, kind/tree/depth/name
constraints, folder RLS/grants; media_type,folder_id,byte_size,duration_ms,
price_rules with bounds/composite FK; typed object-path and rule validation,
catalogue tree guards/revisions, atomic SECURITY INVOKER catalogue-write RPC.
Replaces the existing image-only Storage bindings/object guard with exact typed
same-Workspace/Character bindings. Extends ONLY the same existing private bucket
to26214400bytes and MIME image/webp,video/mp4. No public access, new DB or provider.

Source controls to change only after exact-source approval and postflight:
FANMIND_CHAT_ADMIN_MEDIA_ENABLED=true (preserve if already true);
FANMIND_CHAT_ADMIN_MEDIA_CATALOGUE_ENABLED=true;
FANMIND_CHAT_ADMIN_MEDIA_VIDEO_ENABLED=true only after host conversion proof;
FANMIND_CHAT_ADMIN_MEDIA_ANALYSIS_ENABLED=false.
No video-analysis capability exists.

## Host preflight required before any video activation

On the actual fanmind-staging.service application host, using its effective
service identity and private temp namespace:
- Confirm fixed executable /usr/bin/ffmpeg and /usr/bin/ffprobe; collect bounded
  versions only, no environment/config/credential dumps.
- Confirm libx264/AAC encoders, MOV/Matroska-WebM demuxers and the required input
  decoders; prove actual neutral MP4/WebM decode/re-encode with the source helper.
- Verify private0700temporary directory/0600files, write/read/remove, successful
  and malformed-input cleanup, service hardening and available memory/temp disk.
- Preserve source30second process timeout, max_alloc64MiB, one concurrent
  conversion/process,2Workspace conversions/minute,25MiB/300second bounds,
  output1280x720/30fps, stripped metadata/chapters and restricted file protocols.
- Missing dependency means STOP. Any installation or unit/resource adjustment
  must name exact packages/changes and needs the concrete Staging approval.

## Source-only host diagnostic and its separate merge decision

Prepared scripts/operations/chat-admin-media-host-inspection.mjs and
.github/workflows/chat-admin-media-host-inspection.yml. No dependency, app route,
provider, migration or existing deploy/session-controller changes. The self-hosted
workflow inventory explicitly covers its pinned checkout and protected Main/
Staging/shared-lease boundaries; existing workflow checks remain mandatory.
The process must belong to the Staging service identity/cgroup, with pinned
release/runtime/origin/database values and stable process identity before/after.
No sudo, install, restart, environment dump, secret input or network call except
fixed Staging /api/version is permitted. Only exact allowlisted flag booleans,
codec capabilities, temp metadata and bounded resource values are emitted.

After separately approved source merge, record its actual Main SHA. Dispatch only
that Main SHA with expected_live_commit freshly confirmed asd3483497 or a
reconciled successor, confirmation inspect-staging-media-host. A changed live SHA,
service/process or missing read privilege stops the probe without target writes.
Source tests and mocked service observations do not count as a host PASS. Output
always retains video_activation_ready=false; inspection does not prove actual
conversion, cleanup or schema/activation acceptance.

## Frozen approval cannot yet name an executable deployment commit

3912461e is the current integration starting point, NOT an approved deployable
candidate. The final exact Main SHA must be recorded after PR1470 reconciliation
and the media controls above; it cannot be predicted or approved by wildcard.
Immediately before proposing/using it, reread Main, live Staging, deployment
queue/lease and exact flags. Any newer Staging source invalidates the frozen
baseline until reconciled. Never restore an older source merely for parity.

Future bounded operation order:
1. Fresh target/lease and private effective-flag comparison; preserve existing
   Support/widget/diagnostics, Facebook credentials/page binding and Operator
   continuation; Billing preserve, no release-state recovery.
2. Read-only actual-host preflight. Deploy only exact approved common Main with
   new catalogue/video flags off; confirm HTTPS SHA and Support/Facebook smoke.
3. Exact baseline equality plus checksum-bound atomic schema/bucket extension;
   verify exact post-extension catalog/RLS/grants/policies/function bodies.
4. Separate guarded catalogue/video enablement with private before/after state,
   unrelated-field byte preservation and effective-process readback.
5. Execute bounded synthetic acceptance and cleanup below. Only an explicit
   source/target-scoped approval authorizes these writes.

## Synthetic acceptance manifest for later approval

Use only existing authorized Operator/test workspace and reserved neutral test
Characters. At most2new Characters with per-run IDs; one synthetic Fan/dialogue;
at most4folders and4assets. Foreign negatives use an already authorized existing
foreign fixture identity/workspace; no new user/privilege/Workspace grant.
No actual customer media/messages exported or processed.

Fixtures: neutral generated color/grid PNG/WebP; neutral <=1second MP4 and WebM,
no people/audio/private metadata; malformed/truncated bytes and26MiB test input.
Temporary files are private and removed in finally.
Prices are fixture-only EUR start12,min8,max16 with child/file overrides,
not product/default prices. Test inheritance, explicit invalid binding denial,
negotiation/discount switches and below-minimum/above-maximum proposals.
Use provider-free regression where appropriate; any actual text-AI generation
stays within already approved provider/cost/rate gates and needs a bounded
acceptance budget in the final grant. Image analysis remains disabled.

Prove upload, authorized private preview/ranges, nested folder create/move/search,
reviewed available/missing media claims, stored category/file prices and bounded
counteroffers. Negative cases: foreign Workspace/Character/anon, capability
withdrawal, stale revisions, invalid/oversized files, revoked preview, video
processing concurrency and temporary cleanup. No messages automatically sent.
Desktop and mobile Chromium both required.

Cleanup: revoke/tombstone assets before object deletion; authenticated404 absence
proof; verify metadata and Storage object absence, remove folders/Fan/Characters
and temporary files by tracked run IDs only. Restore original test capability
exactly after withdrawal proof and verify unrelated rows/flags unchanged.
Do not delete existing data or disable the Operator capability globally.

## Recovery and preservation

Before target mutation, retain private exact config snapshot and existing
approved backup reference; no secret/config/media artifact in Git.
The controlled SQL transaction rolls back on error. After successful apply,
retain schema and private objects and keep catalogue/video disabled on failed
acceptance; never drop used tables/bucket. Use media-only guarded deactivation,
preserving Support, legacy library and Operator continuation.
Clean tracked synthetic records through authorized delete/absence paths.
After schema apply, old image-only rollback may break erasure/export for MP4;
do not blindly redeploy pre-extension code. Prefer flags-off forward recovery.
Any code rollback must be separately reconciled/approved for compatible schema,
live Staging source and exact preservation settings. Concurrent config change
stops automatic rollback instead of overwriting another Work-session.

No final Staging acceptance PASS, live upload/video/toolchain PASS, provider
activation or Production action is claimed. Issue1425 stays open.
