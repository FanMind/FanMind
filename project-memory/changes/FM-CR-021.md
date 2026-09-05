# FM-CR-021 — Android Push native FCM binding

- Date: 2026-09-05
- Status: IN_PROGRESS
- Source: owner real-device acceptance
- Related task: FM-MOB-001 / Follow-up Push
- Risk: R3

## Real-device evidence
The owner installed the exact signed Android `preview` build for main commit `6d7f76cd6bf2e70df7110a01b236d21a3fc02a0f` after Google Play Protect scanned it and allowed installation. Staging password login succeeds on the physical Android device.

Pressing `Push auf diesem Gerät vorbereiten` now passes the earlier runtime EAS-project check but ends with the generic local registration failure. Fresh Staging logs at the same time show the successful Android Auth request and normal Staging reads, followed by the server-side registration-status read, but no registration insert/upsert. Therefore the failure occurs before FanMind receives an Expo registration token; the Staging registration API/database is not the failing boundary.

## Root cause and bounded fix
Repository inspection found that the Android Expo app has the `expo-notifications` plugin and the correct package `ch.fanmind.app`, but no `android.googleServicesFile` binding. Android remote notifications require a native Firebase/FCM app configuration before `expo-notifications` can obtain the device push token.

This change:
- consumes an EAS secret-file environment variable named `GOOGLE_SERVICES_JSON` through dynamic Expo config and maps it only to `android.googleServicesFile`;
- keeps `google-services.json` out of Git and never embeds a service-account credential in application source;
- explicitly obtains the native device push token before requesting the Expo push token;
- reports fixed, non-secret failure classes for local notification-channel, permission, native FCM-token and Expo-token stages instead of one ambiguous catch-all message;
- retains the already accepted public runtime EAS project ID binding and the existing Staging-only server registration contract.

## External prerequisites before a replacement build
1. The Firebase project must contain an Android app whose package is exactly `ch.fanmind.app`.
2. Its `google-services.json` must be stored in EAS as the secret FILE variable `GOOGLE_SERVICES_JSON` for the `preview` environment (and later separately for Production as approved).
3. The FCM V1 service-account credential for the same Firebase project/package must be uploaded to the FanMind EAS Android credentials.
4. Only after those bindings are present may one replacement signed Android `preview` build be queued from the merged reviewed commit.

## Acceptance
- exact-head Mobile/native/general CI and Project Memory gates green;
- replacement signed Android Preview installs and logs in;
- `Push auf diesem Gerät vorbereiten` creates exactly one active Staging registration;
- no token, Firebase credential or provider payload is logged or committed;
- real provider delivery remains a separate Staging-only acceptance with ticket/receipt evidence and no Production activation.

## Hard boundaries
No Production Push activation, no Store submit, no OTA update, no Firebase service-account key in Git, no Production customer data and no provider send are authorized by this repository fix.
