# Audit root regression: CI and deployment boundary

SOURCE PREPARATION ONLY; central record #1512. Main is
045be972ce22364a2fdcd59aa54c98442174c3f3 after the authorized regular PR1538
merge. Its exact tree matched the approved PR and16checks passed.

The single authorized Staging rollout44393080155/attempt1 created its private
snapshot and then failed before release acceptance. The new root regression
required unrestricted sudo whenever GITHUB_ACTIONS=true, which also holds on
the deliberately restricted self-hosted Staging runner. Existing automatic
recovery reported PREVIOUS_RELEASE_RESTORED. Independent Staging HTTPS at
20:40:40UTC returned bbc30eb40c94cb9fac6cec961a72c0fe2793f7b9.
Do not retry that run or infer successful candidate deployment.

The smallest correction touches only the test boundary: when GitHub reports
RUNNER_ENVIRONMENT=self-hosted, skip this isolated root fixture before even
probing sudo. It belongs in the existing GitHub-hosted CI; there the existing
mandatory assertion and actual root/unprivileged full verification remain.
The added child-process regression executes this self-hosted path with
GITHUB_ACTIONS=true. No runner access, workflow, application, installer,
canonical verifier, Git protection, root mode/owner or rollback is changed.

Installer SHA256 remains
a1c3121c4b1ad2313113f46ef666c54319acf0ae5bb4a3350647c67c8cced80e.
Billing SQL remains
a8fcffc7d473f222129c95a581a3dc8a41460c3f0d8df260835a2821163abc1b.
Audit installation was not started because successful Staging is a prerequisite.
The Environment approval variable remains on its prior bbc30eb binding.

The one authorized Staging attempt is consumed. A new exact-head source merge
and one new guarded Staging rollout require Owner approval. Only after that
succeeds can the separately bound installation use the freshly confirmed new
Main. Keep existing snapshot/Billing/operator protection, exact-byte rollback
and the no-retry rule. Production SQL/deployment remain unapproved; existing
backup evidence is retained and actual restore/cleanup/countercheck proof is
still open. No optional functionality is added as an MVP dependency.
