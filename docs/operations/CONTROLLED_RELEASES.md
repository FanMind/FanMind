# Controlled Staging and Production Releases

## Purpose

Repository integration and runtime publication are separate decisions. A merge
to `main` may establish a release candidate, but it never authorizes or starts
a Production deployment.

## Observed path before decoupling

At baseline commit `707d22702a784e3b9999d1c9ae9c1e11c096a1bc`:

1. every push to `main` started `Deploy FanMind`;
2. that workflow ran directly on the Production self-hosted runner and changed
   the application checkout, build, PM2 runtime and installed operations files;
3. successful completion triggered `FanMind Final Go-Live Readiness` and
   `FanMind Read-only Production Audit` through `workflow_run`;
4. `Deploy FanMind Staging` was already a separate manual/reusable,
   exact-main and `staging`-environment-bound path;
5. no other workflow called `deploy-fanmind.yml` as a reusable workflow.

The primary risk was that repository integration and the R4 Production mutation
were one event. A normal merge could update or restart Production before a
separate release decision, environment approval or release-specific evidence
review. The downstream audit and readiness runs detected results after the
mutation; they did not prevent it.

## Staging path

`Deploy FanMind Staging` remains separate from Production. It requires:

- a manual dispatch or an explicitly reviewed reusable caller;
- the exact `main` commit and the `deploy-staging-only` confirmation;
- the protected `staging` environment and isolated staging runner;
- Staging/Production target-separation checks;
- preflight, truth, lint, operations, integration, build, health and smoke
  checks before success is reported.

Staging success is evidence. It is not Production authorization.

## Production path

`Deploy FanMind` has only `workflow_dispatch`. It has no `push`,
`workflow_run`, `workflow_call` or scheduled trigger.

The operator supplies:

- `deployment_mode`: `release` or `rollback`;
- `release_commit`: exact lowercase 40-character SHA;
- `confirmation`: `deploy-fanmind-production` or
  `rollback-fanmind-production`.

A GitHub-hosted preflight runs before any Production runner or environment is
entered. The dispatch and the executed control code must themselves come from
the exact current `main` SHA. For a release it requires that same current
`main` SHA and successful
`FanMind CI` plus `FanMind CodeQL` push runs on that SHA. For a rollback it
requires a commit reachable from current `main`, a prior successful
`Deploy FanMind` run and successful `FanMind CodeQL` evidence on that SHA.

Only after preflight does the job enter the GitHub `production` environment
and the Production runner. Environment reviewers and deployment-branch rules
are configured in GitHub and remain an external protected control; repository
code must not assume they exist merely because the workflow names the
environment.

The workflow summary records mode, immutable SHA, evidence run IDs and target.
The application exposes the deployed SHA through `/api/version`. Final
readiness and the read-only audit observe a successful deployment but cannot
invoke one.

## CI and future candidate automation

`FanMind CI` and `FanMind CodeQL` run on pushes to `main`. This creates
immutable, exact-SHA evidence that a later release controller may consume.
Automated R1/R2 candidate selection can be added later by dispatching the same
manual gate with independently verified scope and authorization. No such caller
or automatic Production dispatch exists now.

Branch protection and repository rulesets are external repository settings.
This change neither weakens nor edits them. At the baseline observation, the
GitHub branch response reported `main` as unprotected, so enabling appropriate
required checks and review rules remains an owner/admin action outside this
repository change.

## Rollback and recovery

The isolated release script retains immutable releases and switches the stable
`/var/www/fanmind-current` link only after build and smoke checks. On a failed
switch it restores the prior target and reloads the prior PM2 release.

For an operator-initiated rollback:

1. select the last known-good SHA from a successful `Deploy FanMind` run;
2. confirm that it is still an ancestor of current `main` and that CodeQL
   evidence exists;
3. dispatch `Deploy FanMind` with `rollback`, that SHA and
   `rollback-fanmind-production`;
4. approve the exact protected deployment in the `production` environment;
5. verify `/api/version`, public health/smoke, Final Go-Live Readiness and the
   read-only Production audit.

Database, provider, Billing, secret and destructive rollback actions are not
part of this Web release workflow and require their own protected procedures.
