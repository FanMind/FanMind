# FM-MOB-007 — Real Android Staging login diagnosis

- Started: 2026-09-05 Europe/Vienna
- Status: IN_PROGRESS
- Risk: R3
- Change request: FM-CR-018
- Parent: FM-MOB-001
- PR: #1054

## Scope
Diagnose the real-device Staging password-login failure on the already installed signed Android Preview without weakening Auth, exposing credentials, activating Production push, submitting a Store build or using an OTA update.

## Completed so far
- Confirmed exact existing signed Preview commit `700885307c265f8907cefe5f5b10499a5ea7b996` is installed on the owner's Android phone.
- Confirmed native requests hit isolated Staging Supabase and fail at the password token endpoint.
- Confirmed read-only that the owner-supplied password matches both Staging and Production Auth hashes.
- Confirmed Staging user and email identity shape match a normal working email user: confirmed, not banned/deleted, non-SSO/non-anonymous, correct instance/provider/provider-id/sub/email.
- Confirmed installed and current Mobile code do not mutate the password before `signInWithPassword`.
- Reproduced failure after manual entry/copy with password-manager uncertainty still not observable in the old UI.
- Prepared Staging-only safe diagnostic UI on branch `fix/mobile-staging-login-diagnostics-20260905` and PR #1054.
- TypeScript, Android/iOS JS export, native prebuild, Store readiness and Mobile boundary checks passed for the implementation.
- Rebased the Mobile branch on the main commit that contains the separately accepted Phase-8 English landing repair from PR #1055.
- Resolved the seven Expo SDK 57 patch drifts with `npm install --package-lock-only` on an isolated hosted GitHub runner and committed the generated `package.json` plus `package-lock.json` rather than suppressing Expo Doctor or inventing lock metadata.
- Removed the temporary lock-resolution workflow immediately after the generated manifests were committed; no temporary write-capable CI helper remains in the final PR diff.

## Failed attempt / rejected assumption
- Rejected: different bcrypt hash strings imply different passwords. Bcrypt salts make hash strings differ; direct read-only verification proved the same supplied password matches both environments.
- Password-recovery email is not a valid workaround for this incident: built-in Staging SMTP reached its email rate limit and the password itself is already proven correct.
- A temporary Staging HTTP-extension diagnostic was removed after the protected tool boundary prevented a credential-bearing outbound test; no such extension remains enabled from that attempt.

## Current CI reconciliation
- Project Memory is now present and the previous memory-only guard failure is resolved.
- Phase-8 English landing drift was repaired and merged separately through PR #1055.
- Expo SDK 57 patch drift is now reconciled to the versions required by Expo Doctor: `expo ~57.0.20`, `expo-constants ~57.0.17`, `expo-dev-client ~57.0.18`, `expo-linking ~57.0.9`, `expo-notifications ~57.0.17`, `expo-router ~57.0.19`, `expo-secure-store ~57.0.3`.

## Exact next step
Run exact-head CI on the final PR diff. If all repository and Mobile gates pass, merge PR #1054 through the PR flow and queue exactly one protected Android `preview` build from the resulting main commit.

## Owner action needed
Only after the replacement Preview exists: install the single new internal APK and perform one visible-diagnostic login attempt. No owner action is needed before that point.

## Success evidence
Repository gates + exact signed Preview receipt + real-device visible Staging/credential-input diagnostic + successful Auth session, followed by the separately gated Staging push-registration/provider/device evidence.

## Rollback
Revert the Mobile diagnostics PR. Do not submit/promote the diagnostic Preview. Production Auth, Production Push and Store state remain unchanged.
