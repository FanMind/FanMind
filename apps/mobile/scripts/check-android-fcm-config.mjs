import assert from "node:assert/strict";

import appConfig, {
  optionalAndroidGoogleServicesFile,
  RUNTIME_EAS_PROJECT_ID,
} from "../app.config.js";

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
  config: { android: { package: "ch.fanmind.app" }, extra: {} },
  environment: {},
});
assert.equal(withoutFirebase.extra.eas.projectId, RUNTIME_EAS_PROJECT_ID);
assert.equal(withoutFirebase.android.googleServicesFile, undefined);

const withFirebase = appConfig({
  config: { android: { package: "ch.fanmind.app" }, extra: {} },
  environment: { GOOGLE_SERVICES_JSON: FILE_PATH },
});
assert.equal(withFirebase.android.package, "ch.fanmind.app");
assert.equal(withFirebase.android.googleServicesFile, FILE_PATH);
assert.equal(withFirebase.extra.eas.projectId, RUNTIME_EAS_PROJECT_ID);

console.log("ANDROID_FCM_CONFIG_CONTRACT=PASS");
