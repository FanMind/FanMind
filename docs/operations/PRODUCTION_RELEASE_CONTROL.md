# Production Release Control

Status: repository preparation only. No Production release is authorized or activated by this document.

## Boundaries

Merging to `main` and releasing to Production are separate operations. Staging remains on its existing `deploy-staging.yml` path and is not called by the Production workflow. In particular, the protected Creator target transition, database transition, runtime activation and recovery chain remains manual and unchanged.

`Deploy FanMind` has no `push` trigger. It accepts only a manual dispatch on the exact current `main` commit. A GitHub-hosted authorization job completes all repository and evidence checks before the `production` environment or the self-hosted `fanmind-prod` runner is requested. A risk input and confirmation text are metadata and typo guards; neither grants authorization.

The gate requires all of the following:

- `FANMIND_PRODUCTION_RELEASE_GATE_ENABLED` is exactly `true` and `FANMIND_PRODUCTION_OWNER_LOGIN` is configured as repository variables;
- the requested commit is the workflow's exact dispatch SHA and the current `main` SHA;
- the commit has exactly one merged `main` pull request;
- the final PR head has an independent approval and no reviewer's current state is `CHANGES_REQUESTED`;
- all nine repository PR workflows are complete and successful on the exact reviewed PR head, and every applicable workflow on the exact `main` push is complete and successful: `FanMind Browser E2E`, `FanMind CodeQL`, `FanMind God Mode Gate`, and `FanMind Supply Chain Security`;
- the configured owner authored an exact issue comment binding task ID, release SHA, risk and `authorization=approve`;
- a successful read-only Production audit is at most 48 hours old, has its exact commit-bound receipt and names the same commit currently returned by Production `/api/version`;
- the `production` environment gate is approved; and
- isolated release deployment is enabled on the host. The legacy in-place fallback is removed.

The owner comment must contain exactly:

```text
FM_PRODUCTION_RELEASE_AUTHORIZATION
task_id=<FM task ID>
release_commit=<40-character current main SHA>
risk=<R1|R2|R3|R4>
authorization=approve
```

R1/R2 automatic release remains disabled. Any later automation requires its own reviewed change and must not infer authorization from the risk field.

## Evidence and recovery

The hosted gate uploads a sanitized manifest containing the task, risk, exact release and reviewed-head SHAs, source PR, independent review, exact CI run IDs, owner comment, recovery audit and previous deployed commit. The Production job uploads a sanitized result receipt. Neither artifact contains secrets.

The isolated deploy script builds a separate release directory, switches the `current` link only after preflight and build, and can switch the application back to the previous release when runtime health or smoke checks fail. The recovery audit receipt identifies that previous deployed commit. Rollback is application-only and commit-bound: it does not restore a database, reverse migrations or delete data. Database recovery or any destructive action remains a separate protected procedure.

The latest known audit at repository-preparation time, run `38133448434`, failed because the database backup was about 538 hours old against a 36-hour limit and the full backup about 681 hours old against a 192-hour limit. It is not Production-readiness evidence and cannot satisfy the release gate. Backup and recovery readiness must be restored and proven by a new successful audit under separate authorization.

## First cutover

GitHub evaluates a push using the workflow file from the pushed commit. Therefore an atomic merge containing the removal of the `push/main` trigger does not itself start the new `Deploy FanMind` workflow. This repository property alone is insufficient: queued or running old runs and reruns retain the old event SHA/ref and old workflow definition, and old dispatchable revisions can remain hazardous while a matching privileged runner exists.

The first cutover needs a separately approved platform window. Before merge, the platform owner must:

1. establish a Production change freeze and verify that no Production deployment is permitted during the window;
2. enumerate and resolve every queued, waiting and running `Deploy FanMind` run, including rerunnable historical runs that still target `[self-hosted, fanmind-prod, exoscale, linux, x64]`;
3. prevent the old runner registration or host identity from accepting historical workflow jobs. Removing GitHub secrets is insufficient because the current runner has local `.env.production`, `sudo`, PM2 and systemd access;
4. verify the `production` environment has the required independent reviewer, self-review prevention, `main`-only deployment branch policy and no bypass path available to the dispatcher; these settings are currently unproven;
5. keep `FANMIND_PRODUCTION_RELEASE_GATE_ENABLED` absent or not `true` and configure the exact owner login only after the control and environment settings have been independently checked;
6. obtain a fresh successful read-only audit and validate current backup/recovery evidence; and
7. independently approve the exact cutover commit and confirm all applicable PR checks are successful.

During the authorized cutover, merge only the exact reviewed commit. Then verify on `main` that `deploy-fanmind.yml` has no push trigger, no `Deploy FanMind` run exists for the merge SHA, and all four applicable main-push workflows succeeded. Do not restore privileged runner availability or enable the release gate until the old workflow-run hazard is eliminated and the new environment protection is independently confirmed.

There is no purely repository-side guarantee that an old rerun cannot reach an already registered, privileged runner. The owner must choose and approve the external containment: retire/re-register the old runner identity with a nonmatching release boundary, or keep it unavailable through the historical rerun window while required Production audit capabilities are migrated. Until that choice is implemented and verified, Production activation is blocked.

## Dispatch contract after activation

A later, separately authorized release dispatch must select `main` at the exact release SHA and provide `release_commit`, `task_id`, `risk`, `authorization_comment_id`, `recovery_audit_run_id` and confirmation `release-production`. Missing, stale, mismatched or failed evidence stops on the GitHub-hosted job. A successful `Deploy FanMind` run always means the Production job ran; there is no successful no-op route that could spuriously trigger the read-only audit or final go-live readiness workflows.

The follow-up audit and readiness workflows bind their target to the successful deployment run's `head_sha`. Scheduled audits resolve the actually installed release from `/api/version`, so `main` may advance without falsely claiming that unreleased code is deployed.

References:

- GitHub workflow version and event SHA/ref semantics: https://docs.github.com/en/actions/concepts/workflows-and-actions/workflows
- Reruns retain the original `GITHUB_SHA` and `GITHUB_REF`: https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs
- Environment protection is evaluated before a job is sent to a runner: https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments
