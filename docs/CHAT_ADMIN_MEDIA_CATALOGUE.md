# Character media catalogue continuation — #1425

Merged source, 13 November 2026: PR #1469 is on Main at
`3912461e1f88eb5cf2e621f23e4d6079409c20cc`. This does not establish deployed
acceptance. Fresh read-only Staging preparation is recorded in
`docs/operations/CHAT_ADMIN_MEDIA_STAGING_PREPARATION_20261113.md`.
Extends the existing #1427 library. #1440 remains unmerged; its authenticated
post-delete absence check is retained in this continuation without merging that PR.

## Existing implementation versus extension

| Area | Existing source | This continuation |
| --- | --- | --- |
| Private image storage | Character/Workspace metadata, WebP normalization, authorized preview, tombstones | Same table, bucket and authorization; independent authenticated404 after deletion |
| Folders | Flat optional `folder` string, tags | Two virtual roots Bilder/Videos; nested scoped folders, rename, empty-only delete, move, search/filter, maximum8 levels/100 folders |
| Prices | Existing Character sales playbook: start/min/max/currency/confirmation | Folder references, nearest ancestor inheritance, explicit file override; negotiation/discount switches; atomic catalogue+playbook save |
| AI price authority | Fixed approved offer price | Server computes bounded counteroffer; manual confirmation withholds price; inactive/invalid override never falls back |
| Negotiation follow-up | Content questions only | Bare currency amount binds only immediate used offer, retained scoped history, current Character revision, explicit named positive priced response |
| Inventory | Reviewed available images and verified actual storage | Reviewed images/videos; type separated; conservative exact-term matching across descriptions/tags/folder paths; uncertain matches require clarification |
| Image analysis | Separate default-off consent/cost gate, neutral description/tags, review required | Reused; video explicitly rejected; no provider activation performed |
| Videos | Missing | Same private library, MP4/WebM input, H264/AAC MP4 normalization, duration, private preview, metadata, pricing and deletion |
| Video analysis | Missing | Still unavailable; no frame extraction/provider analysis capability claimed |
| Erasure/export | Existing media files and metadata | Video paths and folder dataset; new optional folder absence check; native cascade proof required |

No example prices are defaults. Price data stays in `sales_playbook.offers`;
folders/files hold offer IDs and switches only. Existing limit:20 priced offers
per Character. Removing a price reference does not destroy a shared offer.
Explicit file override > closest priced ancestor > no price authority. An invalid
explicit binding blocks fallback. Special discounts never authorize going below
minimum. Arbitrary currency-free amounts/ranges/percent proposals are not parsed
as authorized counteroffers. Generated text is checked again; natural-language
checks are conservative controls, not a universal proof of semantic correctness.

Any catalogue mutation increments Character revision. Existing generation,
replay and confirmation compare revisions. The media-enabled UI re-reads the
Character before clipboard use and disables archived drafts from another
revision. Clipboard and remote database confirmation cannot be one atomic
transaction; no automatic external send exists.

## Video processing boundary

Maximum25MiB input/output,300seconds, one video stream, at most3 audio/video
streams,3840x2160 input. Output at most1280x720/30fps. Fixed system ffmpeg/ffprobe
binaries are required; missing codecs/tooling fail closed. Self-contained MP4 and
WebM only; no playlists, user paths, external data references, subtitles or data
streams. Secrets are excluded from child environment; metadata/chapters removed;
30second process timeout, one concurrent process per application process,
2 workspace conversions/minute, temporary cleanup in finally.

Preview is same-origin authorized/no-store with single-range responses and a
12 requests/minute Workspace budget. Current bounded implementation reads the
complete object per accepted range (at most300MiB/minute/Workspace); it is not
an efficient Storage range proxy. Syntax-invalid ranges are refused before
Storage. This limitation must be assessed on Staging before enabling video.
No image/video analysis processing is included in video upload.

## Controlled rollout: not executed

New source gates default false:
`FANMIND_CHAT_ADMIN_MEDIA_CATALOGUE_ENABLED`,
`FANMIND_CHAT_ADMIN_MEDIA_VIDEO_ENABLED`. Existing library and image-analysis
gates remain separate. Disabling catalogue after videos exist hides catalogue
controls but does not delete files or change existing authorization.

`supabase/controlled/chat_admin_media_catalogue.sql` is an atomic, unapplied
extension, never a Web-deploy migration. It adds folders, typed metadata,
invoker RPC, same-Character tree locks/revisions and extends the existing private
bucket from5MiB WebP to25MiB WebP/MP4. No public bucket or second database.
The existing initial-media catalogue reference must not be silently relaxed:
it intentionally detects this extension as drift. Before application prepare
reviewed extension checksums/catalogue pre/postflight and reconcile the existing
activation controller against the exact approved extension and live Staging SHA.

Latest observed Staging schema: no folder table; existing private bucket5MiB,
WebP only; Operator capability enabled. This source has not been deployed,
uploaded or activated there. Parallel Facebook Staging must be preserved.
Latest Main ref observed during work:0def924beb080dde9b7bd9fb4d514f5cca2ac291
(includes Support#1467); source started on798fa177. Those disjoint Support files
must be preserved in the eventual PR tree.

Detailed execution receipt: `docs/operations/CHAT_ADMIN_MEDIA_CATALOGUE_QA_20261113.md`.

## Validation and remaining acceptance

Local policy/API/video tests cover tree bounds, isolation, price precedence,
minimum/discount/negotiation/manual gates, real synthetic MP4/WebM normalization,
invalid/oversized/truncated inputs, revocation after processing, stale revisions,
false stock/payment/delivery claims and follow-up refusal. New nativePG17 cases
are wired into the existing isolated CI database test (not executed locally).
The desktop component suite includes category form/private video checks but
requires a functioning Chromium runner. No phone app changes.

Independent source QA found and drove fixes for video stock/type claims,
completed transactions, counteroffer follow-up, negative claims, preview budget
and erasure inventory. Native SQL, exact-head CI, real desktop browser/Staging,
revocation, upload/read/move/pricing/delete/cleanup evidence remain required.
Source tests alone do not establish those results.

Required decisions after source/CI review: protected merge (including explicit
resolution of#1440), exact candidate Staging deployment, controlled schema+private
bucket extension, reconciled activation preflight and catalogue/video flags.
Existing permission for synthetic Staging media testing does not authorize the
new schema/bucket expansion. Image analysis additionally needs explicit provider,
privacy and cost approval; video analysis is unimplemented. Production is
unchanged and requires its own future release/activation approval.
