# Adminchat #1425 — existing hosted Staging media channel

Status: source preparation / review candidate. No target test has run from this
extension. A source/CI PASS is not the actual media E2E PASS. The guard is already
READY on Staging (Apply43710857955; independent Verify43710956187); this workflow
never applies SQL or enables a feature. Production is excluded.

## Reuse and scope

Extend only `chat-admin-manual-flow-staging.yml`. Its old `probe` and `acceptance`
modes retain their original runner and fixtures. Separate `media-probe` and
`media-acceptance` modes use its existing ubuntu-24.04 Hosted runner, protected
`staging` environment, locked dependencies, Chromium and existing primary and
secondary E2E credentials. No personal Chrome session, new account, service key,
server, database or Runner is needed. The media job holds the existing shared
`fanmind-staging-deploy` lease in addition to the existing manual-flow lease.

The only new protected configuration is
`vars.FANMIND_CHAT_ADMIN_MEDIA_CHARACTER_ID`: the actual existing UUID of
`FM1425-20261114-1945-A`, not the old manual-flow Character A or a copied real
Model ID. Do not automatically create/move a Model or change existing E2E
credentials to make the check pass.

## Required prewrite evidence

After regular review/merge and coordinated exact-Main Web rollout, dispatch
`media-probe` with reviewed_commit=that exact Main/live SHA and confirmation
`run-chat-admin-media-probe`. Content reads plus bounded normal login/logout are
allowed; media writes are not. The dedicated private passfile and frozen
verify-full connection execute only fixed, read-only verifier SQL.

The probe must prove:

- Exact repository, workflow_dispatch, Main, runtime Staging, Supabase project
  vshyhvgcmrlagvfnvomc, distinct Production target and live release.
- Full exact source-derived guard catalogue READY, including private bucket,
  grants/RLS; no guard mutation or partial-state exception.
- Existing fixed-name active Model belongs to the configured existing primary
  Workspace and Owner. That Workspace and existing primary/secondary accounts
  must satisfy the existing synthetic-fixture markers and identities; capability
  already exists. No capability provisioning is requested by this runner.
- Actual primary and secondary login responses match their protected user IDs.
  Foreign Owner is denied this Model. Catalogue/video/pricing flags already
  enabled; no activation is attempted.
- Existing Abendkleidung category is unique and retains its existing EUR25.00
  price. Every returned row is bound to the exact Model/Workspace. Any leftover
  FM1425-E2E run resources stop a new attempt.
- Canonical existing playbook and room for two files/three folders/two new
  prices; old unnormalized playbooks stop before writes.
- Pinned existing neutral.png/neutral.mp4 bytes and a clean baseline digest of
  existing Model fields, offers, folders, assets, policy and Storage inventory.

Unconfirmed now: the new Model UUID variable, actual relationship of that Model
with the old E2E primary Workspace/account, current secret availability, exact
Main/live equality after rollout, and target flag readiness. These are genuine
probe blockers, not authority inferred from a configured secret name. In
particular the previous interactive Operator account may differ from the old
synthetic Processing Acceptance Owner. A mismatch must report
`synthetic_owner_model_mapping`; it must not reassign anything.

## Separately confirmed write run

Only after a successful probe and approval of the exact source/target/test scope,
dispatch `media-acceptance`, confirmation `run-chat-admin-media-acceptance`, and
media_write_approval `approve-synthetic-media-lifecycle-and-cleanup`. The job
repeats preflight itself. No write is possible from `media-probe` or just a PR.

Before mutation, persist a bounded recovery artifact containing only synthetic
binding IDs, run/attempt/source identity, resource reservations and baseline
hashes. No cookie, token, email, price snapshot, private media, screenshot, trace,
provider output or database diagnostic goes into the artifact. Missing upload
ID/digest prevents the exercise. Normal failures run cleanup in finally and the
workflow retries that same cleanup once in its always step.

Prepared checks (not yet target evidence):

| Check | Actual application path |
|---|---|
| PNG and MP4 upload, exact folder/Model assignment | Chromium file input, normal catalogue POST, pinned neutral files |
| Private display, decoded PNG, advancing MP4 playback | Real HTML img/video plus normal authenticated preview GET; no mocked route response |
| Parent/child navigation | Actual media UI and back button |
| Create/rename/move category and empty-folder delete | Normal revision-bound catalogue PATCH plus independent reload |
| Category/file price save and persistence | Normal catalogue PATCH and refreshed Character offers; only new run-owned offers |
| Existing Abendkleidung25EUR | Prewrite, per-read and final preservation checks |
| Foreign Owner read/write and anonymous preview denial | Existing secondary login, normal media GET/DELETE |
| Private Storage presence and final absence | Existing server upload/delete performs real Storage access; fixed read-only database verifier checks assigned Owner/path and original inventory restoration |
| Cleanup | Normal authenticated media DELETE (including its independent server Storage absence probe), empty-only folder PATCH, revision-bound Model PATCH removing only this run's new offers |

These checks do not claim adversarial access through another real Model and do
not modify one. The existing native PG17 Cross-Character/Workspace/RLS proofs
remain separate evidence. Price/folder API checks are not described as visual
form-edit acceptance. Missing codec, selector, permission or flag causes BLOCKED.

## Cleanup and interruption limits

Only the exact run marker inside the fixed Model/Workspace qualifies for
cleanup. A current baseline mismatch, unexpected offer name, nonempty/foreign
folder, changed release or failed delete leaves the job red; it never restores
a stale whole-Model snapshot or deletes a foreign resource. The normal Model
PATCH is used only to remove this run's newly created offers while preserving
all other current fields and proving their original digest. No Model DELETE,
real price change, AI analysis, reply generation or provider action is allowed.

A hard runner loss can prevent both finally and always from running. The
prewrite artifact preserves the run marker and reserved folder IDs; media IDs
can be recovered from the exact application catalogue marker. This candidate
intentionally has no automatic cross-run artifact import or reset of run IDs.
A later run blocks on leftovers. Such a hard-loss recovery requires a separately
reviewed exact-receipt cleanup dispatch before further writes; do not rerun
acceptance blindly, erase the receipt or call SQL/Storage directly. Normal
successful cleanup proves the original Storage inventory and application
baseline, not merely a successful DELETE response.

## Reporting

Only fixed `CHATADMIN_MEDIA_*` statuses cross the runner log boundary. Raw
Playwright/SQL errors remain suppressed. PASS is emitted only after lifecycle,
cleanup and login-session retirement complete. Local source checks, old Hosted
Chromium/PG17, the Staging guard READY and actual media E2E must be listed
separately in Issue1425. A later Production release remains separately protected.
