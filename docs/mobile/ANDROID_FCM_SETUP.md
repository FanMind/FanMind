# Android FCM setup for FanMind Push

Status: **required external binding before the next real Android Push acceptance**.

FanMind uses `expo-notifications` for Android remote Push. The signed Android app package is `ch.fanmind.app`. The EAS project identity alone is not sufficient: the native Android build also needs the Firebase/FCM application configuration for that exact package.

## Required EAS/Firebase bindings

1. In Firebase, create or select the FanMind Firebase project and register an Android app with package name exactly `ch.fanmind.app`.
2. Download that Android app's `google-services.json`.
3. In the FanMind EAS project, create a secret **FILE** environment variable named exactly `GOOGLE_SERVICES_JSON` for the `preview` environment. The dynamic Expo config maps the file path supplied by EAS to `android.googleServicesFile`.
4. In EAS Android credentials for `ch.fanmind.app`, configure the FCM V1 service-account credential belonging to the same Firebase project. Never commit that service-account JSON to Git.
5. Only after both bindings are present may a replacement signed Android `preview` build be queued.

## Repository boundary

`apps/mobile/app.config.js` reads only the file path exposed by EAS. It does not contain Firebase JSON contents, a server key or a service-account key. When `GOOGLE_SERVICES_JSON` is absent, normal local/CI prebuild remains possible but a build must not be accepted for real Android remote-Push testing.

`apps/mobile/src/lib/mobilePushRegistration.ts` obtains the native device push token first. If Android cannot obtain that token, FanMind reports the fixed non-secret diagnostic that Firebase/FCM is not fully connected instead of collapsing the failure into an ambiguous generic registration error.

## Acceptance after binding

- exact reviewed signed Preview build installs on the physical Android device;
- Staging login succeeds;
- notification permission is granted;
- FanMind obtains a native Android push token and then an Expo push token;
- `/api/mobile/push-registration` stores exactly one active encrypted Staging registration;
- no token or credential is exposed in logs, screenshots, Git or chat;
- actual provider sending remains separately gated and Staging-only until its ticket/receipt acceptance.
