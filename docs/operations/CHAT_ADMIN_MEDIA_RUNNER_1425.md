# Adminchat #1425 — existing hosted Staging media channel

Status: source preparation / review candidate. No target test has run from this
extension. A source/CI PASS is not the actual media E2E PASS. The guard is already
READY on Staging (Apply43710857955; independent Verify43710956187); this workflow
never applies SQL or enables a feature. Production is excluded.

## Reuse and scope

Extend only `chat-admin-manual-flow-staging.yml`. Its old `probe` and `acceptance`
modes retain their original runner and fixtures. Separate `media-probe` and
`media-acceptance` modes use its existing ubuntu-24.04 Hosted runner, protected
`staging` environment, locked dependencies, Chromium and existing Admin-E2E and
secondary E2E credential references. The media job uses the existing Admin-E2E credential
references for the primary login and verifies that the returned user is exactly
the existing Operator; an admin role alone is insufficient. No personal Chrome session, new account, service key,
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
- Existing fixed-name active Model and exact UUID belong to the existing Operator
  Workspace and Owner pinned in `src/lib/stagingOperatorIdentity.mjs`. Verify the
  exact Workspace name and `staging_operator_workspace=true`, existing granted
  Owner capability and no processing account deletion. The secondary identity
  retains its synthetic-fixture checks. No capability provisioning is requested.
- Actual primary login matches the source-pinned Operator ID and secondary
  login matches its protected foreign Owner ID.
  Foreign Owner is denied this Model. Catalogue/video/pricing flags already
  enabled; no activation is attempted.
- Existing Abendkleidung category is unique and retains its existing EUR25.00
  price. Every returned row is bound to the exact Model/Workspace. Any leftover
  FM1425-E2E run resources stop a new attempt.
- Canonical existing playbook and room for two files/three folders/two new
  prices; old unnormalized playbooks stop before writes.
- Pinned existing neutral.png/neutral.mp4 bytes and a clean baseline digest of
  existing Model fields, offers, folders, assets, policy and Storage inventory.

## Proven binding correction — 15 November 2026

PR1522 was regularly merged as b517916fc560d333ebaf150457443cc79218bbf3.
Read-only Staging proved exactly one active Model with UUID
`32d3f909-715d-46c2-a708-a65f745d2afc`, bound to the exact existing Operator
identity/workspace and its existing `staging_operator_workspace=true` marker.
Its primary/secondary Processing-Acceptance fixtures are different owners and
workspaces. Operator synthetic-fixture/version markers are NULL. That is why the
old primary configuration and `synthetic_owner_model_mapping` could not pass.
The full unmodified source-derived guard catalogue is READY; no apply is needed.

The media-only correction pins that existing Operator/Workspace/Model tuple,
reuses the existing Operator identity constants and requires the actual login
response to match. It does not treat the Operator account as a synthetic Creator
or general synthetic fixture. Only this named synthetic Model is eligible.
The legacy manual-flow job and its Primary E2E secrets/variables stay unchanged.
The media job reads the already existing Admin-E2E secret references; their
current contents and Operator compatibility are **NOT VERIFIED**. A wrong or
missing credential blocks; no fallback to the old primary, privileged session
minting, global logout or copied browser session is allowed. No secret is changed.
If those references do not already authenticate the exact Operator, report
`login_identity`/`credentials_missing`/`login` and hand the protected credential
binding back to the existing Adminchat session. Do not replace secrets here.

**Protected Staging step:** no existing test data change is required or
performed. In particular, do not set synthetic markers, move the Model, reassign
an Owner, grant capabilities or reapply the database guard. After regular review
and merge, coordinate the exact successor Main/live rollout with the existing
Adminchat work session and the shared deployment lock. Confirm the protected
Model variable equals the pinned UUID, then separately run read-only media-probe.
Current Runtime flags, protected variable and successful login remain unverified.
Staging live was still499ae5c at the read-only observation; source merge alone
cannot authorize execution. Actual acceptance requires its separate approval.

| Reproducible boundary case | Expected result / evidence layer |
|---|---|
| Existing Operator + exact synthetic Model + marked Workspace + capability | Native PG17 mapping count1; target probe still required |
| Wrong Workspace/Owner, arbitrary Model, missing/inactive Model, removed Operator marker or capability, processing deletion | Native PG17 mapping count0; no write |
| Unrelated manual-flow Primary configuration | Cannot replace the media job's source-pinned Owner/Workspace |
| Wrong bucket, path/extension, Workspace prefix or Storage owner; missing/duplicate object | Native PG17 Storage proof blocks |
| Duplicate upload result, unavailable/deleted/foreign upload | Runner blocks upload_binding; no retry that hides duplicates |
| Exercise failure or cleanup failure | Failure propagates; cleanup attempted; no E2E PASS |
| Safe cleanup | Existing marker+Model+Workspace ownership, receipt/source binding and baseline tests; actual target lifecycle remains NOT TESTED |

Duplicate-result detection is a runner safety property, not a claim that repeated
HTTP upload requests are globally idempotent. The existing upload API generates
a fresh media UUID and uses x-upsert:false; this correction does not change that
contract or introduce retries. Existing native media/RLS/Storage lifecycle proofs
and the new binding SQL cases run together in the existing media CI workflow.

Local verification on this correction: 107/107 targeted manual-flow, Actions
supply-chain and Operator/session tests; 78/78 executed media/API tests (one
optional real-video case skipped); 4/4 native PostgreSQL17 suites including the
new exact-binding/Storage cases; 162/162 God Mode/adversarial tests; targeted
ESLint, production build, governance preflight and memory-quality check passed.
The canonical release decision remains BLOCK, as expected without target
release evidence. These results do not authorize rollout or actual media tests.

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


## Runner revision correction after43741422477

The existing one-off acceptance failed at the first upload after API folder
changes left the already mounted UI on an older Character revision. Its cleanup
and independent inventory comparison passed; the MP4 step was never reached.
See Issue1425 comment6898540307. The old run did not retain HTTP status/error/
duration, so409/stale_media_context remains the expected rejection, not a
recorded response from that run.

Complete create/rename/move operations before loading the media UI. Capture the
exact Model-library GET that populates the new UI, validate its binding and
compare its Character revision with the current API library before each upload.
After PNG, use its successful response library as the next UI revision baseline;
wait for the upload control to be enabled before checking and clicking again.
A changed revision blocks rather than modifying the server guard or retrying.
Folder navigation now expects the final renamed child.

Upload failures emit only CHATADMIN_MEDIA_UPLOAD_FAILURE with numeric HTTP
status, an allowlisted structured error code and completed HTTP request duration
in milliseconds. Unknown/malformed/non-JSON/oversized errors become unclassified;
missing status/duration use0/-1. No request body, response body, headers, URL,
filename, token or media bytes are emitted. No new acceptance run or deployment
is authorized by this source correction; the prior one-off write approval is
consumed. Regular source review/merge and a fresh concrete test approval remain
separate. Local scope: only the existing media-runner regression file plus
syntax/lint; required GitHub checks belong to the new source head.
