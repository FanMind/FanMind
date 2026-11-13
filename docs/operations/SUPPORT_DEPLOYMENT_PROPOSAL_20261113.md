# Support completion: coordinated deployment proposal — 13 November 2026

This is a reviewable proposal, not a deployment authorization. Other Work-tab
approvals remain limited to their own tasks. No deployment, live database write,
permission/secret/flag change, Stripe or Facebook mutation was performed by this
continuation. No new database or infrastructure is proposed.

## Prepared common source and confirmed versions

| Surface | Exact commit | Evidence |
| --- | --- | --- |
| Current Main / actual PR1467 merge | `0def924beb080dde9b7bd9fb4d514f5cca2ac291` | Fresh Main ref, merged PR metadata and local Git parents/tree |
| Approved PR1467 head | `43a9b301341d9bfa61ba1e708b47d9c683ae6393` |12 required/14 total exact-head checks passed immediately before regular protected merge |
| Prior approved PR1466 merge | `798fa177f052075e107faaddd37dc74df260d68b` | First parent of PR1467 merge; public contact and single-suggestion fixes retained |
| Actual Staging | `aae0003c6836ef73235c0d771d6387ee0e29f81b` | Browser `/api/version`,2026-11-13T09:57:27.937Z |
| Actual Production | `a798d7938bb4e7e168f615f0c32d1a603dd47d4a` | Browser `/api/version`,2026-11-13T09:57:40.946Z |

An isolated common-source candidate is prepared on
`chore/support-common-release-20261113`. Its parents are exactly Main0def924b
and deployed Stagingaae0003c. No Main/parallel branch or runtime was moved.
The only merge conflict was the Source of Truth blob fingerprint; the document
itself merged cleanly. Both histories are retained and the fingerprint is
reconciled to the actual combined blob, not copied from either parent.

Byte comparisons verified all13 Main-side and33 Staging-side changed files
outside the combined truth/fingerprint and updated release-proposal documents against their exact
parent versions. No Facebook/Stripe/session/media implementation was edited.
The common candidate preserves the deployed session/connection source plus both
Support corrections.192 focused cross-stream tests and the full Next/TypeScript
webpack build passed locally; final candidate CI remains a separate gate.
The initial checkout was shallow; its history was deepened to prove the genuine
4488fc0f merge base. No unrelated-history or force merge was used.

Newer Facebook Draft1465 head17ade824 and separate media Draft1440 are **not**
included. They remain owned by their other Work-tabs and must not be silently
substituted or marked accepted. This snapshot is a concrete pre-release source,
not the final Production release or an approval to merge the Facebook PRs.
Historical source-preparation wording imported from the deployed Staging parent
is not evidence of current runtime activation; only the observations above are.

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
| Support acknowledgment fix | PR1467 merged as0def924b, independent9/9 CI/100 browser tests/native PG17 PASS | Retain merged source; target acknowledgment still needs authorized rollout and live acceptance |
| Facebook discovery | Existing PR1463 /6be52484 lineage | Its responsible Work-tab owns review/merge; do not overwrite its deployed behavior |
| Staging Operator/Facebook continuation | Deployedaae0003c; newer Draft head17ade824fd48dc38a9caf308d6e7554e332d211d | Candidate retains deployed source only; newer chat/post separation and renewal changes require their own acceptance/merge decisions |
| ChatAdmin media deletion | PR1440 Draft, head2374ca26fb0e4c3ff1b86dc56ba86bb3725b4d63 | Separate Owner merge decision and final media acceptance; do not copy its changes |

## Proposed execution order after approvals

1. The acknowledgment follow-up is already merged as0def924b after explicit
   exact-head Owner approval and fresh required-check verification. No runtime
   action was coupled to that merge.
2. The responsible Facebook/Admin Work-tabs reconcile their accepted source into
   a common reviewed Main candidate. Preserve all independently authorized work;
   no force ref updates, branch substitution or implicit PR1440 merge. Record
   the resulting final candidate SHA and target diff. The isolated snapshot above
   is available for review/CI but does not settle the newer unfinished drafts;
   its immutable commit is recorded in the release PR rather than invented in
   a deployment command.
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

- Final common-source CI/approval and reconciliation with any later accepted
  parallel source. The acknowledgment source merge itself is complete.
- Real Staging and then authorized Production durable acknowledgment/fresh-read
  proof, without suppressing a new occurrence or claiming email delivery.
- Private media upload, preview, availability/revision, tenant/Character denial
  and actual deletion/cleanup on the approved common Staging release.
- Explicit separate approval and HTTPS readback for each target deployment.

Keep #1350 and #1425 open until their actual target evidence is complete.
