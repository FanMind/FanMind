# #1425 catalogue evidence — 13 November 2026

## Resumed exact-source review (supersedes pending source/CI notes below)

Resumed from 27d00fa123170fc158d93a3ba256bba94f4bcd65, no reimplementation.
All 18 GitHub check records were independently read as successful, including
both push/PR media PG17/video jobs, general PG17 roundtrips, Chromium, build,
God Mode and CodeQL. A successful CodeQL check still contained alert72.

Alert72 (`js/file-access-to-http`) was traced in GitHub from the fresh private
temporary `normalized.mp4` to the authorized upload. The route accepts bounded
media with rights confirmation and capability/Character checks, normalizes it,
then rechecks authority/revision. Storage destination is server configuration,
bucket constant and UUID-only scoped object path; session JWT/RLS and redirect
denial remain. This is intended media upload, not arbitrary local-file access.
Triaged false positive with recorded explanation; review thread resolved.
No query suppression, check disabling or runtime code change was necessary.

Independent focused rerun: 47/47 passed, zero skips, including actual synthetic
MP4/WebM normalization, invalid/concurrent input cleanup, catalogue price/tree,
API authority/revision controls and authenticated post-delete absence proof.
Exact SQL SHA256 remains
`10626902dcd7e4ad35508191afad89aad25292f28965fae75351ec758c4248d2`.

Main advanced through #1465 to e8178adaae2b21f6d63f6930718c5c5fe7a09442.
Integrate its eight changed paths in this same PR, preserving accepted Facebook
source/evidence and combining the internal catalogue Source of Truth addition.
Only the reviewed combined documentation fingerprint is reconciled. Successor
CI is required; old-head success does not establish new-head success.

Video runtime prerequisites: fixed `/usr/bin/ffmpeg` and `/usr/bin/ffprobe`,
libx264/AAC encoders, MOV/Matroska-WebM demuxers, required input decoders, writable
private temporary space and cleanup, and sufficient resources for the existing
30-second limits. Actual conversion passes locally and in CI. These environments
do not prove tooling on the Staging application host. No protected Staging-host
runtime evidence was available in this continuation; verify there before video
activation. No deployment, SQL/bucket mutation, feature activation, provider call
or real customer-media test is part of this review. Independent actual Staging
upload/display/move/prices/isolation/revocation/delete/cleanup remains pending.

PR: https://github.com/FanMind/FanMind/pull/1469 (Draft, unmerged).
First implementation223263b47116760e5c6de483f84e684a0205a353;
complete browser fixture/documentation fixa80396f86212b10804d181e1d5d05f2b79f531de.
Current follow-up additionally covers actual helper deletion probes, video
preview/provider denial and MP4 account erasure, cascade verification and stale
clipboard prevention. Exact final-head CI must supersede earlier runs.

## Executed local evidence

- 165 passed,1 skipped,0 failed: `node --test tests/chat-admin-media*.test.mjs
 tests/chat-admin-api-integration.test.mjs tests/chat-admin-model-upgrade.test.mjs
 tests/account-deletion-service-policy.test.mjs
 tests/data-disclosure-auth-projection.test.mjs`.
- Real generated neutral color MP4 and WebM decoded/re-encoded by system
 ffmpeg/ffprobe; duration, stripped metadata, invalid/oversized/truncated files,
 concurrent limit and temporary cleanup checked.
- `npx tsc --noEmit`:PASS; targeted ESLint:PASS; `git diff --check`:PASS.
- `npx next build --webpack`:PASS, optimized build and routes completed.
- God Mode preflight, reviewed documentation drift preflight and project-memory
 quality:PASS.123 God Mode adversarial tests:PASS. These validate governance
 controls; they are not a release decision or protected-action permission.
- Local Chromium launch blocked by socket permission; no local browser PASS.

## Independent source countercheck

Separate read-only reviewer `media_security_qa` executed adverse probes and
identified video/type false claims, completed transaction wording, price-only
follow-up, rejection/negation handling, preview budget and erasure inventory.
All reported P1 claim/follow-up cases have regression fixes and passed reviewer
recheck (11 catalogue groups). This does not substitute for native RLS or target
acceptance. Full-object preview range reads remain a documented bounded cost.

## CI observed, exact version retained

GitHub job131833706993 on a80396f86212b10804d181e1d5d05f2b79f531de
completed the actual ChatAdmin Chromium component isolation regressions
successfully, including the catalogue form/private video case. It uses synthetic
local providers, not Staging. The subsequent stale-clipboard case requires the
new final-head rerun. Earlier223263 browser failure was an incomplete synthetic
policy fixture; no failing result is relabeled PASS.

The first documentation checksum failure was corrected after reviewing the exact
SOURCE_OF_TRUTH addition. SQL/PG17, final-head full CI and actual Staging remain
open until their own results exist. No provider, Storage/schema, Production or
Staging runtime mutation performed by this continuation.

## Protected action manifest (unapplied)

SQL `supabase/controlled/chat_admin_media_catalogue.sql` SHA256:
`10626902dcd7e4ad35508191afad89aad25292f28965fae75351ec758c4248d2`.
Target only existing Staging project `vshyhvgcmrlagvfnvomc` and existing private
`chat-character-media` bucket. Adds folders/typed metadata/RPC/revision guards;
extends private allowance from5MiB WebP to25MiB WebP/MP4. No public access, new
DB or provider activation. Catalogue/video flags are separate and default off.
Main-bound protected rollout and existing activation preflight must be reconciled
before target apply; this manifest does not bypass those checks.

A dedicated isolated PostgreSQL17 CI job executes the media contract without
waiting for the unrelated backup/restore prelude. Existing required roundtrip
checks remain intact. Native cases explicitly cover depth8/9, subtree moves,
failed-RPC atomicity, capability withdrawal/recovery and Character folder cascade.
No application database or remote project is created by that CI job.

CI reconciliation: source-owned case modules are imported by the existing required
media API test. The general package manifest and general CI workflow are preserved
byte-for-byte, including unrelated Capacity source pins. A separate media-only
workflow installs ffmpeg for actual video processing and runs isolated PG17.
This does not relax any prior checksum or required general test.

Common Main reconciliation: Main advanced to6c1e376b788e9ef4d3d929a44214f8484e8610ba
through Owner-approved#1468. Its Support/Facebook code, package and Capacity pin
are preserved; only README/Source of Truth additions and their reviewed fingerprint
are combined. No deployed branch is overwritten. The feature-branch merge and
new exact-head CI remain separate from a protected Main merge or deployment.
