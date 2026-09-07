# FM-CR-018 — Android Staging login diagnosis and replacement Preview

- Date: 2026-09-05
- Updated: 2026-09-07
- Status: VERIFIED_NOT_ACCEPTED
- Source: owner continuation authorization
- Related task: FM-MOB-007 / FM-MOB-001 continuation
- Risk: R3
- PRs/commits: #1054 / #1057; FCM correction commits `1d15d8e4698392174ad7d5be23a7f174ebb2303d` and `547843cad7a1f6ecb3ba6131e155d9d068799c2b`; replacement APK built from descendant `6801d687cfe6048d6e32e63bcfe2862d2886fce0`.

## Request
The owner resumed real Android Staging acceptance because the signed Preview APK could be installed but `fanmind@fanmind.ch` could not complete password sign-in on the device. The goal was to diagnose that failure safely and, if needed, produce one replacement Preview without weakening Auth, exposing credentials, activating Production push, submitting a Store build or using an OTA update.

## Historical diagnosis
- Native Android requests reached isolated Staging Supabase `vshyhvgcmrlagvfnvomc` and `/auth/v1/token?grant_type=password`, but initially returned `invalid_credentials`.
- Read-only bcrypt verification proved the owner-supplied password matched the `fanmind@fanmind.ch` password hash in both Production and Staging; the hypothesis that the environments used different passwords was rejected.
- Staging Auth user/identity was confirmed, not banned/deleted/SSO/anonymous, used the normal `email` provider, had the canonical zero `instance_id`, and its identity provider id/sub/email matched the user row.
- The installed commit and Mobile code passed the password string unchanged to `supabase.auth.signInWithPassword`; only the email was trimmed/lower-cased.

## Bounded implementation and accepted diagnosis
PR #1054 added Staging-only, non-secret diagnostics to the login screen: visible `STAGING · TESTSYSTEM` binding, password show/hide, code-point length and hidden-character checks, and Staging password-manager/autofill suppression for the diagnostic run. It added no password logging, hashing, normalization, persistence or transmission change.

PR #1054 then merged, a signed Android `preview` was produced, and the owner installed it and confirmed successful Staging login. The password/login blocker is therefore resolved for this path.

## Runtime EAS/FCM continuation
After login succeeded, Push registration exposed a separate runtime EAS Project-ID binding error before permission/token registration. PR #1057 added the approved public EAS Project ID as a runtime fallback while keeping credential-bearing config out of raw `app.json`. Later owner evidence exposed that the installed candidate still lacked the required Firebase/Google-services binding for actual FCM registration.

That build step is now **superseded and complete**. The actual FCM binding/consent/build-preflight correction landed in commit `1d15d8e4698392174ad7d5be23a7f174ebb2303d` (`fix(mobile): add Android FCM binding for real push registration`) and the secret-metadata build preflight was tightened in `547843cad7a1f6ecb3ba6131e155d9d068799c2b` (`fix(mobile): verify FCM secret metadata before preview build`). Workflow `34037085683` / job `101497020224` then completed the exact signed Android `preview` from descendant commit `6801d687cfe6048d6e32e63bcfe2862d2886fce0`, version `1.0.0 (2)`, with Google Services processed. The private install link was delivered to the owner.

Commit `6801d687...` is the later Billing PR #1063 and is evidence only for the exact descendant commit used to build the APK; it is **not** the source of the FCM code correction. Do not queue the #1054/#1057 replacement plan again and do not rebuild older `700885...`, `dd01dc...` or `6d7f76cd...` candidates for Push registration.

## Remaining acceptance boundary
The repository/login/replacement-build scope of FM-CR-018 is verified. External real-device Push acceptance remains open under `FM-MOB-001`: install/use the existing `6801d687...` replacement, allow notifications, trigger `Push auf diesem Gerät vorbereiten`, and prove one active Staging registration before any separately authorized real provider send. Latest read-only Staging evidence still shows zero real Push registrations.

Google Play closed-Alpha cohort/19-check Recovery acceptance is separate. Production push, Store Submit/Update, OTA Update and iOS/TestFlight are not authorized by this change.

## Rollback
Revert the applicable Mobile diagnostic/runtime-binding/FCM commits only if their Mobile behavior is independently invalidated. Do not use Billing PR #1063 as the rollback for the FCM correction. No Production state was changed by this change request. Internal Preview artifacts must not be submitted or promoted automatically.
