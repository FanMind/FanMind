# #1425 catalogue evidence — 13 November 2026

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
