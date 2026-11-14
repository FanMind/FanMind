# #1425 CRM media / Character mixer — 14 November 2026

Target: existing Staging only. Base: `d51724f210785408c604fc2d2ea561f9ba9da09f`,
retains CRM #1487 and Support #1488. No Production action.

## Reproduced failure

PASS (diagnosis): logged into existing Owner through secure browser auth. Model
is displayed as Aurela Foss, retains synthetic legacy bio and existing 12/10/15
EUR category offer. Abendkleidung exists and is preserved. A new neutral blue
PNG was selected through the normal file chooser and submitted to the existing
FM1425 synthetic folder. Application returned `media_upload_incomplete`.
Correlated Supabase Storage HTTP400 and PostgreSQL logs at 12:42:59 UTC identify
`permission denied for function chat_admin_media_writes_allowed`.
Two tombstoned metadata entries then existed. This session created only the
second; existing rows/Owner media were not destroyed.

PASS (bounded native diagnostic): actual Staging PG17 rollback transaction
with the proposed predicate grant permits the existing authorized Owner and
denies a foreign Workspace. A second rollback transaction executes the real
Storage insert guard under finalization service_role with retained Owner claims
and synthetic metadata; it succeeds. Both grants/inserts/revisions rolled back.
No permanent ACL/schema change or actual successful upload is implied.

## Source changes

- Precise legacy-extended-state detection and transactional delta; complete
  pre/post catalogue equality remains mandatory. Unknown/partial drift blocks.
- Internal finalization role may invoke only the existing boolean predicate;
  Owner/Workspace/deletion checks and invoker object guard remain intact.
- Existing media table gains original filename and nullable upload timestamp;
  existing timestamps remain unknown, new records default to database now().
- Explicit folder open/counts/breadcrumbs, gallery/list, private enlargement,
  metadata/price display, search/type/state/sort and safe existing deletion.
- Sequential batch progress, processing phase, failed-file retry, revision
  readback after partial commit, Storage probe before upload success.
- Existing playbook carries versioned independent mixer strengths. Legacy text,
  offers, limits, manual-send rules and isolation remain authoritative. Shared
  humor/directness aliases avoid two values for the same rule.
- Setup steps and expert inputs remain editable without hidden-field loss.
- AI comparison reuses the real reply pipeline, saved profile/prices/media and
  draft mixer, with current authority/revision checks and existing usage/rate
  controls. No real Fan selection, history, learning, settings or external send.

## Verification matrix

| Area | Status | Evidence / limit |
| --- | --- | --- |
| Existing main / latest protected deploy metadata | PASS | #1488 current Main; Staging run43594983953 success |
| Owner session, existing Model/folder visibility | PASS | Real browser interaction |
| Synthetic upload failure reproduction | PASS | Normal file chooser/form, app error + correlated database/Storage log |
| New source compilation/types/lint | PASS | Next build, generated route types, tsc, focused ESLint |
| Reply API and mixer negatives | PASS | Existing real-route harness plus draft/no-persistence/stale/malformed tests |
| Media API/policies/schema source checks | PASS | Focused local source suites; not target upload acceptance |
| Exact schema/legacy-delta isolated native CI | NOT_TESTED | Required on published head before merge |
| Hosted actual Chromium component tests | NOT_TESTED | Added mixer/reopen/nonpersisting comparison cases; local process launch denied by runtime |
| God Mode preflight / memory quality / drift | PASS | Conservative global release decision remains BLOCK; no fake ALLOW |
| Source safety/tenant regression | PASS, bounded source scope | Existing API tests, unchanged authorization; native/browser/target proofs still distinct |
| Real image/multiple-image/video successful lifecycle | NOT_TESTED | Requires reviewed delta and Staging deployment |
| Actual private playback/revocation/absence after delete | NOT_TESTED | Must follow successful target uploads |
| Actual saved mixer reload/model switch/AI style quality | NOT_TESTED | Must follow exact deployed release |
| Aurela identity | PASS | Owner explicitly confirmed existing Aurela Foss is the intended Faust/Voss persona; no new Character |
| Aurela configuration / prices | NOT_TESTED | Apply verified style after rollout; proposed intensities visibly labeled, preserve existing prices and biography |
| Synthetic cleanup | NOT_TESTED | New failed-upload tombstone retained for scoped cleanup; do not remove earlier Owner entries or Abendkleidung |
| Production | NOT_TESTED | Outside authorization; untouched |

Issue #1425 must remain open. This file is a source checkpoint, not a final
completion claim. Append exact PR/head/hosted/native/merge/target results only
when observed; preserve failed checkpoints.

Local final focused checkpoint: 295 tests, 294 PASS, 0 FAIL, one existing native skip. Build/types/lint passed before publication; hosted/native/target results still required.

Main advanced independently to733b4f5 (Support #1489 retirement). Merged its complete tree, preserved all Support changes and reconciled only the combined Source-of-Truth fingerprint. Source continuation is now based on that successor.

Published source head2f7e0f: native schema/delta/RLS suite43598599437 PASS, real synthetic video normalization PASS, Chromium Character components in job132458302720 PASS. General operations CI found the Capacity-pinned package.json changed by adding a test command. Reverted package.json exactly; new mixer tests are imported by the existing media test entry point instead. No Capacity binding or protected package source is rewritten. Required successor checks remain mandatory.
