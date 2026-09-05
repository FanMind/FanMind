import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

import appConfig, {
  FCM_CONSENT_PLUGIN,
  optionalAndroidGoogleServicesFile,
  RUNTIME_EAS_PROJECT_ID,
  withFcmConsentPlugin,
} from "../app.config.js";

const require = createRequire(import.meta.url);
const {
  FCM_AUTO_INIT_KEY,
  FIREBASE_ANALYTICS_COLLECTION_KEY,
  upsertBooleanMetaData,
} = require("../plugins/with-fcm-consent-boundary.cjs");

const FILE_PATH = "/tmp/fanmind-google-services.json";

assert.equal(optionalAndroidGoogleServicesFile({}), null);
assert.equal(
  optionalAndroidGoogleServicesFile({ GOOGLE_SERVICES_JSON: FILE_PATH }),
  FILE_PATH,
);
assert.throws(
  () => optionalAndroidGoogleServicesFile({ GOOGLE_SERVICES_JSON: "bad\npath" }),
  /FANMIND_MOBILE_GOOGLE_SERVICES_FILE_INVALID/u,
);

const withoutFirebase = appConfig({
  config: { android: { package: "ch.fanmind.app" }, extra: {}, plugins: [] },
  environment: {},
});
assert.equal(withoutFirebase.extra.eas.projectId, RUNTIME_EAS_PROJECT_ID);
assert.equal(withoutFirebase.android.googleServicesFile, undefined);
assert.deepEqual(withoutFirebase.plugins, [FCM_CONSENT_PLUGIN]);

const withFirebase = appConfig({
  config: { android: { package: "ch.fanmind.app" }, extra: {}, plugins: [] },
  environment: { GOOGLE_SERVICES_JSON: FILE_PATH },
});
assert.equal(withFirebase.android.package, "ch.fanmind.app");
assert.equal(withFirebase.android.googleServicesFile, FILE_PATH);
assert.equal(withFirebase.extra.eas.projectId, RUNTIME_EAS_PROJECT_ID);
assert.deepEqual(
  withFcmConsentPlugin([FCM_CONSENT_PLUGIN]),
  [FCM_CONSENT_PLUGIN],
  "FCM consent plugin must remain idempotent.",
);

const application = {
  "meta-data": [
    {
      $: {
        "android:name": FCM_AUTO_INIT_KEY,
        "android:value": "true",
      },
    },
  ],
};
upsertBooleanMetaData(application, FCM_AUTO_INIT_KEY, false);
upsertBooleanMetaData(application, FIREBASE_ANALYTICS_COLLECTION_KEY, false);
assert.equal(
  application["meta-data"].filter(
    (entry) => entry.$["android:name"] === FCM_AUTO_INIT_KEY,
  ).length,
  1,
);
assert.ok(
  application["meta-data"].some(
    (entry) =>
      entry.$["android:name"] === FCM_AUTO_INIT_KEY &&
      entry.$["android:value"] === "false",
  ),
);
assert.ok(
  application["meta-data"].some(
    (entry) =>
      entry.$["android:name"] === FIREBASE_ANALYTICS_COLLECTION_KEY &&
      entry.$["android:value"] === "false",
  ),
);

const registrationSource = await readFile(
  new URL("../src/lib/mobilePushRegistration.ts", import.meta.url),
  "utf8",
);
const revokeHelperStart = registrationSource.indexOf(
  "async function revokeNativePushRegistration()",
);
const autoRegistrationDisable = registrationSource.indexOf(
  "setAutoServerRegistrationEnabledAsync(false)",
  revokeHelperStart,
);
const nativeUnregister = registrationSource.indexOf(
  "unregisterForNotificationsAsync()",
  autoRegistrationDisable,
);
assert.ok(revokeHelperStart >= 0, "FCM revoke helper must exist.");
assert.ok(
  autoRegistrationDisable > revokeHelperStart,
  "Expo automatic native-token registration must be disabled on revoke.",
);
assert.ok(
  nativeUnregister > autoRegistrationDisable,
  "Automatic registration must be disabled before deleting the native token.",
);

const backendRegisterStart = registrationSource.indexOf(
  "const result = await callPushApi(accessToken, {",
);
const backendRegisterReturn = registrationSource.indexOf(
  "return result;",
  backendRegisterStart,
);
assert.ok(backendRegisterStart >= 0 && backendRegisterReturn > backendRegisterStart);
assert.doesNotMatch(
  registrationSource.slice(backendRegisterStart, backendRegisterReturn),
  /revokeNativePushRegistration|unregisterForNotificationsAsync/u,
  "An indeterminate backend registration result must not invalidate the consented native token.",
);

for (const functionName of [
  "disableMobilePushRegistration",
  "bestEffortDisableMobilePushRegistration",
]) {
  const functionStart = registrationSource.indexOf(`function ${functionName}`);
  const nextFunction = registrationSource.indexOf("\nexport ", functionStart + 1);
  const functionSource = registrationSource.slice(
    functionStart,
    nextFunction === -1 ? undefined : nextFunction,
  );
  assert.ok(functionStart >= 0, `${functionName} must exist.`);
  assert.match(
    functionSource,
    /revokeNativePushRegistration\(\)/u,
    `${functionName} must revoke Expo auto-registration and the native token.`,
  );
}

console.log("ANDROID_FCM_CONFIG_CONTRACT=PASS");