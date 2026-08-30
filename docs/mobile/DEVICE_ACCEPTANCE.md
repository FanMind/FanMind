# Private Android device acceptance

## Purpose and boundary

This runbook records the external real-device acceptance that repository tests
cannot prove. The current finishline uses the already accepted signed Android
`preview` build. iOS/TestFlight and an iPhone record are Phase 8 and must not be
started through this Android handoff. The runbook does not queue a build,
submit to a store, change Supabase, enable push delivery, or run as a GitHub
workflow.

Der Validator startet keinen Build und keinen GitHub-Workflow. Wenn Phase 8
später ausdrücklich startet, ist iOS in einer eigenen Datei und gegen einen
eigenen signierten iOS-Receipt zu dokumentieren.

Device records are private operational evidence. Use synthetic Staging users
and content only. Never record e-mail addresses, recovery URLs, tokens, build
IDs, artifact URLs, project IDs, device identifiers, screenshots containing
customer data, or secrets.

## Signed-build handoff

The controlled signed-build workflow emits one redacted, five-day artifact
named `fanmind-mobile-signed-build-receipt-<profile>-<platform>`. Its JSON binds
the successful internal artifact to the exact `main` commit, platform and
profile without retaining the EAS build ID or URL. Download it into a private
directory and keep mode `0600`:

```bash
install -d -m 700 docs/mobile/private-device-evidence
# Nach dem Download:
chmod 600 docs/mobile/private-device-evidence/signed-build-receipt.json
```

The receipt must use `preview`, `internal`, `available`, and disabled Submit and
Update boundaries. A development, simulator, debug or unsigned build is not an
acceptable substitute.

Für den aktuellen Android-Lauf ist der redacted Receipt des bereits gebauten
Preview-Laufs `33298699290` / Jobs `99222705186` für Merge
`6a2f5b6c9bac1607ecc2ccae11c6ade3cb418522` zu verwenden. Der Production-AAB-
Receipt ist absichtlich kein Ersatz: Das AAB bleibt für Google Play erhalten,
während die private 19-Punkte-Abnahme an den installierbaren Preview-Build
gebunden ist. Keinen neuen Build starten.

The workflow never copies the signed APK or IPA into GitHub artifact storage.
Open the protected EAS project as an authorized operator, select the exact
successful `preview` build for the receipt-bound `main` commit and platform,
and transfer its internal install artifact directly to the test device. Keep
the downloaded binary private, do not re-upload it, and delete the local copy
after acceptance. This handoff is an internal installable build, not a Play or
App Store release.

## Mandatory real-device checks

Use the existing signed Android build on one real Android device and create one
Android evidence file. All 19 checks are mandatory:

1. install the signed build;
2. login with a synthetic Staging account;
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

Download the unchanged redacted Android Preview receipt into the private
directory. Then create a fail-closed worksheet directly from that receipt:

```bash
install -d -m 700 docs/mobile/private-device-evidence
chmod 600 docs/mobile/private-device-evidence/signed-build-receipt-android.json
npm run mobile:device:acceptance:prepare -- \
  --signed-build-receipt docs/mobile/private-device-evidence/signed-build-receipt-android.json \
  --output "$PWD/docs/mobile/private-device-evidence/android.json" \
  --acceptance-id 2026-08-30-mobile-android-001
```

The preparer validates the exact signed Preview boundary, copies only the
receipt-bound commit and timestamps, calculates the receipt SHA-256 and writes
the worksheet once with mode `0600`. Every real-device field remains
`"pending"` and `completedAt` remains a replacement marker. It never reports a
device PASS. Start it immediately before the test, replace a check with
`"passed"` only after observing it and set the real UTC completion timestamp
after the last check. If the date or sequence changes, use a new acceptance ID
and a new output file; the preparer refuses to overwrite prior evidence.

## Evidence schema

Write a flat JSON object using schema version `1`. Timestamps are UTC ISO-8601;
`releaseCommit` is the full 40-character receipt-bound reviewed merge SHA;
`signedBuildReceiptSha256` is the SHA-256 of the unchanged redacted receipt.
Every mandatory check uses `"passed"`.

```json
{
  "schemaVersion": 1,
  "acceptanceId": "2026-08-07-mobile-android-001",
  "startedAt": "2026-08-07T09:00:00Z",
  "completedAt": "2026-08-07T10:00:00Z",
  "environment": "staging",
  "platform": "android",
  "releaseCommit": "0000000000000000000000000000000000000000",
  "buildProfile": "preview",
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

Push remains optional for this acceptance until the separate Staging gates have
actually passed. Only then may `pushTested` be `true`. Bind the evidence to the
unchanged private Staging-gate JSON with `pushStagingGateSha256` and mark the
four permission opt-in, permission denial, registration and opt-out checks as
`"passed"`.

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
  --expected-main-commit 6a2f5b6c9bac1607ecc2ccae11c6ade3cb418522
```

For an already approved Push Staging gate, append:

```bash
--push-staging-gate docs/mobile/private-device-evidence/push-staging-gate.json
```

The validator outputs only redacted counts and the device-evidence SHA-256. It
never outputs commit, platform, acceptance ID, EAS values or private file
content. A passing record is still not TestFlight, Google Play, store privacy,
legal or Production approval.
