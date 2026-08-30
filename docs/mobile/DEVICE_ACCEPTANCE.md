# Private Android device acceptance

## Purpose and boundary

This runbook records the external real-device acceptance that repository tests
cannot prove. The current Store finishline uses exactly the existing signed
Android `production` AAB after Google Play installs it from the test track.
iOS/TestFlight and an iPhone record are Phase 8 and must not be started through
this Android handoff. The runbook does not queue a build, submit to a store,
change Supabase, enable push delivery, or run as a GitHub workflow.

Der Validator startet keinen Build und keinen GitHub-Workflow. Wenn Phase 8
später ausdrücklich startet, ist iOS in einer eigenen Datei und gegen einen
eigenen signierten iOS-Receipt zu dokumentieren.

Device records are private operational evidence. Use only a dedicated synthetic
account in the receipt-bound environment: Production for the Play-installed
AAB, Staging for a separate Preview install. Never record e-mail addresses,
recovery URLs, tokens, build IDs, artifact URLs, project IDs, device identifiers,
screenshots containing customer data, or secrets.

## Signed-build handoff

The controlled signed-build workflow emits one redacted, five-day artifact
named `fanmind-mobile-signed-build-receipt-<profile>-<platform>`. Its JSON binds
the successful signed artifact to the exact `main` commit, platform and
profile without retaining the EAS build ID or URL. Download it into a private
directory and keep mode `0600`:

```bash
install -d -m 700 docs/mobile/private-device-evidence
# Nach dem Download:
chmod 600 docs/mobile/private-device-evidence/signed-build-receipt.json
```

The preparer and validator support two explicit receipt classes: a
`preview`/`internal` receipt for a private Staging install, or an Android-only
`production`/`store` receipt for a Play-installed AAB. Both require
`available` plus disabled Submit and Update. A development, simulator, debug,
unsigned or iOS Store build is not an acceptable substitute.

Für die abschließende Play-Abnahme ist ausschließlich der unveränderte,
redacted Android-Production-Receipt aus Store-Build `33316172583` / Job
`99269924756` für Merge
`e96415035ffbe12f16dd3b81e13a5e62b2c4ac00` zu verwenden. Er bindet die private
19-Punkte-Abnahme über Receipt-SHA, Commit, Plattform, Profil, Distribution und
Build-Zeit genau an das AAB, das Google Play installiert hat.
Keinen neuen Build starten. Der frühere Preview-Receipt bleibt nur für getrennte
historische Staging-Abnahmen gültig und darf diesen Store-Nachweis nicht
zertifizieren.

The workflow never copies the signed AAB, APK or IPA into GitHub artifact
storage. For the current Store acceptance, install only through the Google Play
test track and retain only the redacted Production receipt privately. Do not
download another binary directly from EAS, do not re-upload it outside Play and
do not substitute the older Preview APK.

## Mandatory real-device checks

Use the Play-installed existing Android AAB on one real Android device with a
dedicated synthetic Production test account and create one Android evidence
file. All 19 checks are mandatory:

1. install the signed build;
2. login with the dedicated synthetic account in the receipt-bound environment;
3. open one valid `fanmind://reset-password` recovery link;
4. reject invalid, expired and already-used recovery links without revealing
   account state;
5. change the password and login again after a full app restart;
6. prove the offline contact fallback on a transport failure and that it stays
   read-only;
7. prove that auth, RLS and server failures never expose the cache;
8. reject expired cache data;
9. logout and prove session, Workspace and registered local cache state are
   purged;
10. visually verify the FanMind app icon and dark wordmark splashscreen;
11. create and cancel an account-deletion request through the authenticated
    Mobile flow.

FanMind must never send a reply automatically. No customer or Production data
may be used, and no secret may be recorded. Open issues make the acceptance
fail closed.

## Private preparation

Download the unchanged redacted Android Production receipt from Store-build
`33316172583` into the private directory. Then, only after the Play-test-track
install is present on the device, create a fail-closed worksheet directly from
that receipt:

```bash
install -d -m 700 docs/mobile/private-device-evidence
chmod 600 docs/mobile/private-device-evidence/signed-build-receipt-android.json
npm run mobile:device:acceptance:prepare -- \
  --signed-build-receipt docs/mobile/private-device-evidence/signed-build-receipt-android.json \
  --output "$PWD/docs/mobile/private-device-evidence/android.json" \
  --acceptance-id 2026-08-30-mobile-android-001
```

The preparer validates the exact Android Production/Store boundary, copies only
the receipt-bound commit, platform, profile, distribution and timestamps,
calculates the receipt SHA-256 and writes the worksheet once with mode `0600`.
All 19 real-device checks and the four
safety observations remain `"pending"`; `completedAt` remains a replacement
marker. It never reports a device PASS. Start it immediately before the test,
replace a check with `"passed"` only after observing it, explicitly set the four
safety fields to `false` only after confirming that no automatic sending,
customer-data use, secret recording or push delivery occurred, and set the real
UTC completion timestamp after the last check. If the date or sequence changes,
use a new acceptance ID and a new output file; the preparer refuses to overwrite
prior evidence.

## Evidence schema

Write a flat JSON object using schema version `2`. Timestamps are UTC ISO-8601;
`releaseCommit` is the full 40-character receipt-bound reviewed merge SHA;
`signedBuildReceiptSha256` is the SHA-256 of the unchanged redacted receipt.
Every mandatory check uses `"passed"`.

```json
{
  "schemaVersion": 2,
  "acceptanceId": "2026-08-07-mobile-android-001",
  "startedAt": "2026-08-07T09:00:00Z",
  "completedAt": "2026-08-07T10:00:00Z",
  "environment": "production",
  "platform": "android",
  "releaseCommit": "0000000000000000000000000000000000000000",
  "buildProfile": "production",
  "distribution": "store",
  "signedBuildCompletedAt": "2026-08-07T08:00:00Z",
  "signedBuildReceiptSha256": "0000000000000000000000000000000000000000000000000000000000000000",
  "signedBuildInstalled": "passed",
  "login": "passed",
  "recoveryValidLink": "passed",
  "recoveryInvalidLinkRejected": "passed",
  "recoveryExpiredLinkRejected": "passed",
  "recoveryUsedLinkRejected": "passed",
  "passwordChanged": "passed",
  "restartLogin": "passed",
  "offlineTransportFallback": "passed",
  "offlineReadOnly": "passed",
  "offlineAuthFailureClosed": "passed",
  "offlineRlsFailureClosed": "passed",
  "offlineServerFailureClosed": "passed",
  "offlineExpiredCacheRejected": "passed",
  "logoutPurge": "passed",
  "appIconBranding": "passed",
  "splashBranding": "passed",
  "accountDeletionRequest": "passed",
  "accountDeletionCancel": "passed",
  "pushTested": false,
  "pushStagingGateSha256": null,
  "pushPermissionOptIn": "not_tested",
  "pushPermissionDenial": "not_tested",
  "pushRegistration": "not_tested",
  "pushOptOut": "not_tested",
  "automaticSendingObserved": false,
  "customerDataUsed": false,
  "secretsRecorded": false,
  "pushDeliveryObserved": false,
  "issues": []
}
```

## Optional push checks

Push remains disabled and `pushTested` must stay `false` for the current
Production/Store acceptance. A separate Preview/Staging acceptance may set it
to `true` only after the Staging gates have actually passed, and must then bind
the unchanged private Staging-gate JSON with `pushStagingGateSha256`.

The Staging-gate record must bind the same commit and prove resource readiness,
migration apply and rollback-only acceptance. Production targets, real push
tokens and delivery must all remain `false`. This validator does not authorize
or test push delivery.

## Verification

Keep the evidence, receipt and optional gate private with mode `0600`, then run:

```bash
npm run mobile:device:acceptance:verify -- \
  --input docs/mobile/private-device-evidence/android.json \
  --signed-build-receipt docs/mobile/private-device-evidence/signed-build-receipt-android.json \
  --expected-main-commit e96415035ffbe12f16dd3b81e13a5e62b2c4ac00
```

Only for a separate Preview/Staging acceptance with an already approved Push
Staging gate, append:

```bash
--push-staging-gate docs/mobile/private-device-evidence/push-staging-gate.json
```

The validator outputs only redacted counts and the device-evidence SHA-256. It
never outputs commit, platform, acceptance ID, EAS values or private file
content. A passing record is still not TestFlight, Google Play, store privacy,
legal or Production approval.
