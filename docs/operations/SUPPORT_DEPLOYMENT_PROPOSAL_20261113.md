# Support completion: coordinated deployment proposal — 13 November 2026

This is a reviewable proposal, not a deployment authorization. Other Work-tab
approvals remain limited to their own tasks. No deployment, live database write,
permission/secret/flag change, Stripe or Facebook mutation was performed by this
continuation. No new database or infrastructure is proposed.

## Confirmed merge and current versions

| Surface | Exact commit | Evidence |
| --- | --- | --- |
| PR1466 approved head | `7072b39d5f995a4ac72a37c3a24572645c26b8d7` | Fresh PR read,12 required/14 total checks PASS, no bypass |
| PR1466 actual merge/Main | `798fa177f052075e107faaddd37dc74df260d68b` | Merge response, independent Main ref, merged PR metadata, Git parents/tree |
| Previous Main | `4488fc0ff548e2ec2fc230a0403d1826849fd233` | First merge parent; second parent is the exact approved head |
| Actual Staging | `aae0003c6836ef73235c0d771d6387ee0e29f81b` | Browser `/api/version`,2026-11-13T09:19:33.274Z |
| Actual Production | `a798d7938bb4e7e168f615f0c32d1a603dd47d4a` | Browser `/api/version`,2026-11-13T09:19:41.232Z |

The merge tree equals the approved PR tree; no Facebook/Admin parallel branch
was overwritten. This task did not deploy the new Staging version: it is the
separate Work-tab rollout and supersedes the earlier6be52484 observation.

## Support acknowledgment correction

Production still contains the old comparison between the browser HTTPS Origin
and proxy-internal `nextUrl.origin`. The Main correction already exists; it must
be included in the eventual release rather than independently reimplemented.
Executed route tests reproduce old403/no RPC and current success behind the
internal proxy, then read the acknowledged state again through the actual GET.

A second defect was reproduced before correction: the actual acknowledgment
route returned200/ok even when `support_centre_ack` returned false. The follow-up
source requires the exact boolean true and an authorized inbox read confirming
the notification is absent. A newly reopened incident or unexpected RPC result
returns409; an unavailable readback returns503 without a success claim. A retry
uses the existing idempotent SQL function. No migration is needed.

Regression layers: actual transpiled route with canonical mutation policy and
request parser; real React OwnerInbox in desktop/mobile Chromium with persisted
fixture readback after a new mount; existing isolated PostgreSQL17 function
contract extended for missing IDs, Owner denial, successful readback and stable
timestamp on replay. Synthetic tests do not establish current live acknowledgment.
The existing Production test notification is not acknowledged again by this task,
because the current Owner instruction excludes live database changes.

## Parallel work that must be preserved

| Workstream | Observed source | Required coordination |
| --- | --- | --- |
| Public Support/Admin display fixes | PR1466 merged on Main | Preserve the merged contact and single-suggestion rendering fixes |
| New Support acknowledgment fix | This isolated source branch, based on798fa177 | Complete exact-head CI/independent QA, then a separate reviewed merge decision |
| Facebook discovery | Existing PR1463 /6be52484 lineage | Its responsible Work-tab owns review/merge; do not overwrite its deployed behavior |
| Staging Operator/Facebook continuation | PR1465 Draft, headaae0003c | Preserve deployed session renewal/comment-sync work; no merge or rollout authority borrowed here |
| ChatAdmin media deletion | PR1440 Draft, head2374ca26fb0e4c3ff1b86dc56ba86bb3725b4d63 | Separate Owner merge decision and final media acceptance; do not copy its changes |

## Proposed execution order after approvals

1. Review and merge the narrowly scoped acknowledgment follow-up after all exact
   head checks pass. No runtime action is coupled to that merge.
2. The responsible Facebook/Admin Work-tabs reconcile their accepted source into
   a common reviewed Main candidate. Preserve all independently authorized work;
   no force ref updates, branch substitution or implicit PR1440 merge. Record
   the resulting exact candidate SHA and a final target diff. That common SHA
   does not yet exist and must not be invented in an approval command.
3. Before Staging deployment, re-read actual Staging/Main/Production versions and
   active workflow leases. Review the complete diff against the actual Staging
   sourceaae0003c (or its freshly observed successor), including session renewal,
   media cleanup and Support consumers. If the target changed, rebase the proposal
   on that actual version; do not roll it back to798fa177 just to gain parity.
4. Obtain concrete Staging deployment approval for that exact common candidate
   using the existing protected deploy workflow and canonical deployment lock.
   Preserve the existing billing freeze and unrelated feature flags. No schema,
   secrets, permissions or provider image analysis are part of the web deploy.
5. On the deployed candidate, independently check HTTPS version/health and the
   real Support/ChatAdmin flows. For durable Owner acknowledgment use an existing
   explicitly approved test notification, or separately authorize one bounded
   synthetic fixture and cleanup if none exists. Live acknowledgment is a data
   write and is not authorized by the PR1466 merge permission.
6. Media activation remains a distinct protected action after its exact schema,
   Owner, retention and reviewed-Main/live-source gates pass. The existing runtime
   controller's `activate` changes Support/media flags while keeping image
   analysis disabled; it is not authority for AI analysis, custom-order promises
   or a real image. Its separately scoped Work-tab owns the approved synthetic
   upload/read/preview/isolation/delete/cleanup acceptance.
7. Only after accepted Staging evidence prepare the Production release request:
   exact common Main SHA, actual current Production SHA, complete scope including
   pre-existing Stripe/Meta differences, passing mandatory checks and existing
   release rollback. The Production controller is reviewed-Main-bound. An app
   release does not approve migrations or activate independent integrations.
   If the Owner still excludes those source differences, do not dispatch a
   wholesale Main release; reconcile the permitted release scope first.

## Completion evidence still required

- Exact final source and merge proofs for the acknowledgment follow-up.
- Real Staging and then authorized Production durable acknowledgment/fresh-read
  proof, without suppressing a new occurrence or claiming email delivery.
- Private media upload, preview, availability/revision, tenant/Character denial
  and actual deletion/cleanup on the approved common Staging release.
- Explicit separate approval and HTTPS readback for each target deployment.

Keep #1350 and #1425 open until their actual target evidence is complete.
