# Creator confirmed-chat learning — controlled schema rollout

## PR #1204 source accepted; actual catalog observation reconciled

Actual read-only Staging catalog observed `2026-09-26T18:24:28.937033Z`; application release probe UNAVAILABLE; historical release `9652ae62928c70d8f39d8f184857a34fcd4de74f` observed `2026-09-26T16:27:14.666Z` is context only from `project-memory/receipts/chat-admin-manual-flow-36255475314-1-acceptance.json`, not a current release binding; query SHA256 `252951c7b64adda2e52c92f2d2b141390e79275db61d09460d92bb7509ff2436`, private catalog SHA256 `c004ae7e7feacb2c286cc6cfe53f479b2fe3677663118011ee9deaed8ca651bc`. Classifier outcome `INCOMPLETE`; blockers `reference_pin_missing,auth_uid_provider_contract_missing`; trusted comparison not performed because reference/profile evidence is missing; the classifier returned an empty differingSections list, which is not a no-drift verdict. Credential disposition `NOT_CREATED` and private artifact disposition recorded at `2026-09-26T18:33:33.512088Z`. Actual redacted receipt: `project-memory/receipts/creator-foundation-staging-catalog-observation.json`; immutable source acceptance: `project-memory/receipts/creator-foundation-preflight-pr1204-source.json`.

Creator aggregate stays IN_PROGRESS; learningState=UNDETERMINED, targetAccepted=false, applyAllowed=false and runtimeActivated=false. A catalog classifier outcome is a scoped observation, never target acceptance, learning-schema ABSENT/INSTALLED proof or authority to write. The catalog action and broad NBA-CREATOR-INTELLIGENCE remain consumed; no unchanged retry.

Continue only `NBA-CREATOR-FOUNDATION-PROFILE-TRANSITION-DESIGN`. Bounded repository/offline source work at priority 2 under existing user authorization and FM-DEC-024. Independently reconcile supported provider/role and installed-parent source profiles using the already captured private observation and separately pinned source evidence. Never use target-derived expected values. Design a source-defined forward transition with exact preconditions, supported baseline, authorization boundaries, atomicity, cleanup/recovery and meaningful isolated tests. No APPLY, runtime activation, target calls, provider calls, workflow dispatch, target DDL/data/role changes, temporary target helper or customer fixture. Bounded completion: publish independently supported profile inputs and a reviewable source transition design, or record PARTIAL with the exact missing external provenance. If external input blocks completion, make the specific action requires_owner=true and link an exact owner/evidence item so existing selection reports OWNER_ACTION_REQUIRED; do not call PARTIAL completed or keep a generic executable placeholder. No repeated permission question for already authorized safe offline work. Creator aggregate stays IN_PROGRESS; learningState=UNDETERMINED, targetAccepted=false, applyAllowed=false and runtimeActivated=false. A catalog classifier outcome is a scoped observation, never target acceptance, learning-schema ABSENT/INSTALLED proof or authority to write. The catalog action and broad NBA-CREATOR-INTELLIGENCE remain consumed; no unchanged retry.

### Historical source/admission receipt — superseded as a next action

> PR #1204 final head `092e89ebb9757af2046f174796282bb237ddadd8`, source tree `2edf4d31418183fdddb71bd1cd7e95cad1933415`, verified merge `2a3af587593035a2975992744b2a9bf7a7f59783` at `2026-09-26T18:17:04Z`; final CI run `36261538537`, attempt 1 / job `108458188956` on tested checkout `f8d6083423bba16794896e64f6922f666debbee2` succeeded; independent final review had no P1/P2. CI reference artifact `10912722295` / SHA256 `26696239c1e7086faad0d461aaf5f68b41d237f66e3c2c4ca43a7be2b0bbcbd9`. Receipt: `project-memory/receipts/creator-foundation-preflight-pr1204-source.json`.
>
> Only the PR #1204 repository source package is accepted. Provider-profile trust and actual target catalogs remain separate; missing references or profile coverage yield INCOMPLETE. Creator aggregate stays IN_PROGRESS; learning schema remains UNDETERMINED. No target acceptance, APPLY, runtime activation or provider action is inferred.
>
> Bounded owner-authorized read-only Staging catalog observation under FM-AUTH-CREATOR-FOUNDATION-STAGING-CATALOG-20260926, priority 2 under FM-DEC-024. Use only the reviewed PR #1204 catalog SELECT in its repeatable-read, read-only transaction against FanMind Staging vshyhvgcmrlagvfnvomc; bind fresh Staging project identity/health and exact reviewed source/query. Application-release context is separate: the live version probe is unavailable (browser ERR_BLOCKED_BY_CLIENT and public retrieval unavailable); retain only historical release 9652ae62928c70d8f39d8f184857a34fcd4de74f observed 2026-09-26T16:27:14.666Z with release_fresh=false and release_probe=UNAVAILABLE. This read-only database catalog observation does not depend on app runtime and provides no fresh deployed-version or runtime acceptance. Validate the actual successful final-head CI run/job and reference artifact, tested checkout and PR-head identities, manifest/source/query/catalog/provider/parent pins and hashes, parent RLS and authority-helper contracts, and independently reviewed Supabase provider-role provenance plus the full supported provider contract. Build/classify references offline with their SHA256 recorded outside the reference. CI fixture roles and the target under test are never their own approved provider-role reference. Missing or untrusted reference/profile/coverage means INCOMPLETE; the supported upstream provider profile is not a Hosted-default claim. Preserve actual LEGACY_EXACT/CURRENT_EXACT/DRIFT/INCOMPLETE without promoting it to feature acceptance. Keep targetAccepted=false, applyAllowed=false, learningState=UNDETERMINED and runtimeActivated=false. Record an actual separately dated observation receipt and private credential/artifact cleanup; no result is claimed yet. No schema APPLY, target DDL/data/role changes, temporary helper, customer fixture, runtime activation, provider/model call, workflow dispatch or Production/Billing/Restore/Mobile mutation. Existing user authorization covers this narrow read-only continuation; no repeated permission question. Keep NBA-CREATOR-INTELLIGENCE CONSUMED and the failed learning VERIFY consumed.

## Status

`STAGING_SOURCE_INSTALLED_PRODUCTION_PREINSTALL_FOUNDATION_MISSING`. This runbook covers the repository-controlled migration runner for `supabase/controlled/20260923023000_creator_confirmed_chat_learning.sql`. It does not authorize or perform Staging/Production APPLY, ACCEPT, customer mutation, provider activation or runtime learning activation.

The reviewed **Staging** source state is now `CONFIRMED_CHAT_LEARNING_STAGING_SCHEMA_STATE="installed"`. Runtime readers resolve that state to `installed` only when `FANMIND_RUNTIME_ENVIRONMENT=staging`; Production, unknown and other runtimes remain `preinstall`. This prevents an ordinary Production deploy from requiring a controlled table that has not been installed there. The Staging state only makes Staging disclosure/deletion readers fail closed when the table is absent. It does **not** prove that any target contains the schema and does **not** authorize APPLY. A fresh exact-target read-only VERIFY must still prove the isolated Staging target `ABSENT`.

## Actual read-only observation — 2026-09-26

Protected run `36254337623`, attempt1 / job `108438159538`, on reviewed/deployed `d91405d67792aa65a14964553a09a36fa0c87de0`, passed the pinned offline source checks, then failed with `verify_query_failed`. Private password-file cleanup succeeded. Independent execution of the exact full verifier reproduces `creator_learning_foundation_missing`: at `2026-09-26T16:09:35.118261Z`, Staging lacks `public.creator_workspace_access_allowed(uuid)`. The learning-schema state is therefore not established as ABSENT or INSTALLED. A separately bounded foundation diagnosis/reconciliation must precede any learning-schema APPLY path; this observation does not authorize replaying an already consumed installation or weakening the verifier.

The bounded observation is now RECONCILED, preserving the workflow FAILURE, under `project-memory/receipts/creator-confirmed-chat-verify-36254337623-1.json`. Read-only counterchecks through `2026-09-26T16:14:52.671432Z` also find two rejected platform-role membership conditions and missing current helper guards on `creators_member_read` and `creator_commercial_events_member_read`. The helper and policy/RPC changes originated in PR #1134 (2026-09-19), after the accepted 2026-09-11 foundation. The old consumed PT409 upgrade neither admits this historical baseline nor updates all four policies. PR #1204 source and its actual catalog observation are consumed; continue only `NBA-CREATOR-FOUNDATION-PROFILE-TRANSITION-DESIGN` for independently evidenced offline profiles and a bounded source transition design. No target action or feature acceptance is implied. No helper-only install, role revocation or unchanged VERIFY replay is implied.

## Offline source check

Run only against the reviewed repository checkout:

```bash
node scripts/operations/creator-confirmed-chat-learning-migration-runner.mjs --check
```

The check pins the exact Git blob of the controlled SQL, validates the required schema/RLS/RPC/FK contract, reports a SHA-256 diagnostic and reads the explicit source rollout state. It has no database target and cannot mutate anything.

## Protected Staging VERIFY entrypoint

The repository-owned entrypoint for the next target observation is
`.github/workflows/creator-confirmed-chat-learning-staging-verify.yml`.
It is intentionally VERIFY-only: there is no APPLY input or branch. A dispatch
must target exact `main`, bind `reviewed_commit == github.sha`, use the
protected `staging` environment, the isolated Staging Supabase/database
bindings, TLS `verify-full`, a private `0600` passfile and the exact
confirmation `verify-creator-confirmed-chat-learning`.

This workflow is repository preparation only until it is actually dispatched.
Merging it does not prove Staging deployment or target schema state. The generic
runner still rejects `--apply`; a future APPLY requires a separate reviewed
protected path after a deployed Staging release and fresh `ABSENT` VERIFY
evidence plus action-time owner/environment authorization.

## Read-only target VERIFY contract

`--verify` is target-bound and read-only. It requires the reviewed checkout SHA, exact Supabase project-reference-to-URL binding, exact expected database host, TLS `verify-full`, an absolute CA path and a private `0600` passfile snapshot. It rejects partial schema state.

The verifier distinguishes:

- source `preinstall` + target absent: expected preparation state; no APPLY is allowed;
- source `preinstall` + target installed: fail closed because target state outran the reviewed source lifecycle;
- source `installed` + target absent: eligible for a separately authorized future Staging APPLY;
- source `installed` + target installed: exact postflight/ACL/RLS/function/trigger contract must pass.

A later protected workflow may supply these values from its environment. Do not put credentials, passfile contents or provider secrets in Git, logs, chat or workflow inputs.

## Mandatory ordering before any APPLY

1. Preserve the reviewed runner/checksum and the now-merged disclosure/deletion reader chain.
2. Keep the reviewed Staging source state `installed` while Production remains `preinstall`, and pass exact-head CI/review/deploy for this target-aware reader state before relying on it.
3. Run a fresh target-bound read-only VERIFY. `ABSENT` is the only acceptable pre-apply target state.
4. Build and review a separate protected, release-bound APPLY path that consumes the exact deployed Staging release, a fresh `ABSENT` VERIFY receipt, and action-time owner/environment authorization. The generic runner in this scope rejects `--apply` with `apply_protected_path_required`.
5. Only that later protected path may unlock the isolated-Staging write after binding all prerequisites; static confirmation strings alone are insufficient.
6. Require exact installed postflight plus negative authorization/tenant evidence. If the result is missing, partial or indeterminate, stop and VERIFY read-only; never blind-retry, drop or repair.
7. Runtime flag activation and real Creator quality/provider acceptance are later independent gates.

The generic runner structurally forbids every `--apply` in this scope. Any future Staging APPLY or Production schema plan requires a separate reviewed protected path and authorization.

## Recovery boundary

The migration is transactional, but an interrupted/indeterminate external execution is not treated as rollback proof. The safe recovery action is read-only VERIFY and reconciliation. There is no automatic DROP/repair path in this runner. Normal Web deploy never applies this SQL.