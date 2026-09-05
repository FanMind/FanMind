# FM-CR-018 — Android Staging login diagnosis and replacement Preview

- Date: 2026-09-05
- Status: IN_PROGRESS
- Source: owner continuation authorization
- Related task: FM-MOB-007 / FM-MOB-001 continuation
- Risk: R3
- PR: #1054, #1057

## Request
The owner resumed the real Android Staging acceptance because the already-signed Preview APK can be installed but `fanmind@fanmind.ch` cannot complete password sign-in on the device. The same credentials work on the web/Production path and the owner requires the app and website to become reliably usable rather than repeating manual login guesses.

## Preflight and duplicate check
- Reused the existing FM-MOB-001 Mobile release task, accepted FM-MOB-006 Delivery-Ledger gate, FM-DEP-002 and the existing signed Android Preview evidence instead of rebuilding the Mobile foundation.
- Exact installed artifact is the existing Android `preview` APK for commit `700885307c265f8907cefe5f5b10499a5ea7b996`.
- Production push remains structurally out of scope and disabled.
- No Store submit, OTA update, Production database mutation or Production Auth credential change is authorized by this change.

## Current evidence
- Native Android requests reach isolated Staging Supabase `vshyhvgcmrlagvfnvomc` and `/auth/v1/token?grant_type=password`, but return `invalid_credentials`.
- Read-only bcrypt verification proved the owner-supplied password matches the `fanmind@fanmind.ch` password hash in both Production and Staging; therefore the earlier hypothesis that the password differs between environments is rejected.
- Staging Auth user/identity is confirmed, not banned/deleted/SSO/anonymous, uses the normal `email` provider, has the canonical zero `instance_id`, and its identity provider id/sub/email match the user row.
- The installed commit and current `main` both pass the password string unchanged to `supabase.auth.signInWithPassword`; only the email is trimmed/lower-cased.
- Repeated real-device attempts remain reproducibly rejected, so the failure is not accepted as a user-password problem.

## Bounded implementation
PR #1054 adds Staging-only, non-secret diagnostics to the login screen:
- visible `STAGING · TESTSYSTEM` badge;
- password show/hide control;
- code-point length plus detection of leading/trailing whitespace and zero-width/control characters;
- Staging password-manager/autofill disabled for the diagnostic run;
- no password logging, hashing, normalization, persistence or transmission change.

## Acceptance plan
1. Exact-head repository CI and Project Memory gates must pass or unrelated baseline failures must be explicitly reconciled.
2. Merge only through PR; no direct `main` write.
3. Queue exactly one new signed Android `preview` build through the existing protected main-only workflow; no submit or OTA update.
4. Install that artifact on the owner's Android device and confirm the visible Staging binding plus non-secret password diagnostic.
5. Re-run login. If login succeeds, register the device for Follow-up Push and continue the already-separated Staging provider/device acceptance. If it still fails with the expected length/no hidden characters, treat client input/autofill as disproved and continue with Supabase Auth configuration/provider diagnostics rather than resetting the password again.

## 2026-09-05 continuation — login accepted, runtime EAS binding blocker found
- PR #1054 merged and exact signed Android `preview` build for main commit `dd01dc022f9006304b45ceee7b1787a07ef4908b` completed successfully.
- The owner installed that build and confirmed successful Staging login on the real Android device. The password/login blocker is therefore resolved for this acceptance path.
- Follow-up Push registration then failed before permission/token registration with the explicit client error `Der signierte FanMind-Build ist noch nicht mit dem freigegebenen EAS-Projekt verbunden.`
- Code inspection proves `enableMobilePushRegistration()` requires a runtime EAS Project ID from `Constants.easConfig.projectId` or `Constants.expoConfig.extra.eas.projectId`; both are absent in the installed build even though the protected build workflow independently verified the correct EAS project binding.
- Root cause: the protected workflow verifies the EAS identity, but the remote/runtime Expo config can be evaluated without the protected local workflow variables, leaving the signed artifact without a Project ID available to `expo-notifications`.
- PR #1057 adds the approved public EAS Project ID as a runtime fallback in `apps/mobile/app.config.js` while keeping raw `app.json` credential-free, plus a regression test that requires the runtime config to expose the Project ID without protected build variables.
- Production push delivery remains disabled and no Provider send, Store submit or OTA update is authorized by this change.

## Updated acceptance plan
1. PR #1057 exact-head CI and Project Memory gates must pass.
2. Merge #1057 only after green gates.
3. Queue exactly one replacement signed Android `preview` build from the reviewed merged main commit; no submit and no OTA update.
4. Install/update the owner device and repeat `Push auf diesem Gerät vorbereiten`.
5. Confirm one active Staging push registration exists before any real provider send is considered.

## Rollback
Revert PR #1054 and/or #1057 as applicable. No Production state is changed by the repository implementation. Any signed Preview remains an internal artifact only and must not be submitted or promoted automatically.
