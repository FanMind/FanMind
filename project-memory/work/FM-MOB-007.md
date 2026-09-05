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

## Failed attempt / rejected assumption
- Rejected: different bcrypt hash strings imply different passwords. Bcrypt salts make hash strings differ; direct read-only verification proved the same supplied password matches both environments.
- Password-recovery email is not a valid workaround for this incident: built-in Staging SMTP reached its email rate limit and the password itself is already proven correct.
- A temporary Staging HTTP-extension diagnostic was removed after the protected tool boundary prevented a credential-bearing outbound test; no such extension remains enabled from that attempt.

## Current CI reconciliation
- Project Memory Guard failed only because the first code commit did not yet include a Project Memory update; FM-CR-018/FM-MOB-007 now records it.
- Mobile Expo Doctor reports seven SDK-57 patch releases behind the currently expected Expo versions; this is dependency drift independent of the login UI change and must be reconciled before a clean merge/build claim.
- The separate Phase-8 English landing defect was repaired and merged through PR #1055 before rebasing this Mobile branch.

## Exact next step
Reconcile Mobile dependency drift without suppressing Expo Doctor, rerun exact-head CI, then merge the reviewed Mobile PR and queue exactly one protected Android `preview` build.

## Owner action needed
Only after the replacement Preview exists: install the single new internal APK and perform one visible-diagnostic login attempt. No owner action is needed before that point.

## Success evidence
Repository gates + exact signed Preview receipt + real-device visible Staging/credential-input diagnostic + successful Auth session, followed by the separately gated Staging push-registration/provider/device evidence.

## Rollback
Revert the Mobile diagnostics PR. Do not submit/promote the diagnostic Preview. Production Auth, Production Push and Store state remain unchanged.
