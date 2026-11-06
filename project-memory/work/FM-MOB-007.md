# FM-MOB-007 — Real Android Staging login diagnosis

- Started: 2026-09-05 Europe/Vienna
- Updated: 2026-09-07 Europe/Vienna
- Status: VERIFIED_NOT_ACCEPTED
- Risk: R3
- Change request: FM-CR-018
- Parent: FM-MOB-001
- PRs/commits: #1054 / #1057; FCM correction commits `1d15d8e4698392174ad7d5be23a7f174ebb2303d` and `547843cad7a1f6ecb3ba6131e155d9d068799c2b`; replacement APK built from descendant commit `6801d687cfe6048d6e32e63bcfe2862d2886fce0`.

## Scope
Diagnose the real-device Staging password-login failure on the signed Android Preview and carry the correction only through one replacement FCM-bound Preview, without weakening Auth, exposing credentials, activating Production push, submitting a Store build or using an OTA update.

## Completed result
- The original password-login diagnosis is resolved. PR #1054 merged; its replacement Preview was installed by the owner and real Staging login succeeded.
- The next observed blocker was runtime EAS Project-ID binding for Push registration. PR #1057 added the approved public runtime fallback.
- The actual Android FCM binding/consent/build-preflight correction is commit `1d15d8e4698392174ad7d5be23a7f174ebb2303d` (`fix(mobile): add Android FCM binding for real push registration`), followed by `547843cad7a1f6ecb3ba6131e155d9d068799c2b` (`fix(mobile): verify FCM secret metadata before preview build`).
- The current signed Push-registration candidate is the completed replacement Preview at exact descendant commit `6801d687cfe6048d6e32e63bcfe2862d2886fce0`, workflow `34037085683`, job `101497020224`. The protected workflow and authenticated EAS countercheck verified Android `preview`, version `1.0.0 (2)` and Google Services processing. A private install link was delivered to the owner.
- Commit `6801d687...` itself is the later Billing PR #1063 and is recorded here only as the exact descendant commit from which the replacement APK was built; reverting #1063 would not revert the FCM correction commits.
- This completed replacement **supersedes** the older `700885...`, `dd01dc...` and `6d7f76cd...` candidates for Push registration. Do not queue another Preview merely to continue FM-MOB-007.
- Repository/CI, login diagnosis and signed replacement-build work are therefore closed for this task. The wider `FM-MOB-001` external acceptance remains open.

## Failed attempt / rejected assumption history
- Rejected: different bcrypt hash strings imply different passwords. Bcrypt salts make hash strings differ; direct read-only verification proved the same supplied password matches both environments.
- Password-recovery email was not a valid workaround for the incident: built-in Staging SMTP reached its email rate limit and the password itself was already proven correct.
- A temporary Staging HTTP-extension diagnostic was removed after the protected tool boundary prevented a credential-bearing outbound test; no such extension remains enabled from that attempt.

## Exact next step
Use the already delivered `6801d687cfe6048d6e32e63bcfe2862d2886fce0` replacement on the owner's Android device, allow notifications and run the bounded Staging Push-registration observation. Current Staging evidence still shows zero real Push registrations. Real provider delivery is a separate protected/external acceptance step and is not authorized by this task.

## Owner action needed
Install/use the existing FCM replacement APK, opt in to notifications and trigger `Push auf diesem Gerät vorbereiten`. No rebuild, Store submit or OTA update is needed.

## Success boundary
FM-MOB-007 itself is `VERIFIED_NOT_ACCEPTED`: diagnosis and replacement artifact are verified, while real registration/provider acceptance stays open under `FM-MOB-001` / `EXT-MOBILE-PUSH-STORE`. A real Staging registration must exist before any provider-send acceptance is considered.

## Rollback
Revert the applicable Mobile diagnostic/runtime-binding/FCM commits only if their Mobile behavior is independently invalidated. Do not use Billing PR #1063 as the rollback for the FCM correction. Do not submit/promote any diagnostic Preview. Production Auth, Production Push and Store state remain unchanged.
