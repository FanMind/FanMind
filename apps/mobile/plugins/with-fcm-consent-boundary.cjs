const { withAndroidManifest } = require("@expo/config-plugins");

const FCM_AUTO_INIT_KEY = "firebase_messaging_auto_init_enabled";
const FIREBASE_ANALYTICS_COLLECTION_KEY = "firebase_analytics_collection_enabled";

function upsertBooleanMetaData(application, name, value) {
  const current = Array.isArray(application["meta-data"])
    ? application["meta-data"]
    : [];
  const filtered = current.filter(
    (entry) => entry?.$?.["android:name"] !== name,
  );
  filtered.push({
    $: {
      "android:name": name,
      "android:value": String(value),
    },
  });
  application["meta-data"] = filtered;
}

module.exports = function withFcmConsentBoundary(config) {
  return withAndroidManifest(config, (androidConfig) => {
    const application = androidConfig.modResults.manifest.application?.[0];
    if (!application) {
      throw new Error("FANMIND_MOBILE_ANDROID_APPLICATION_MISSING");
    }

    upsertBooleanMetaData(application, FCM_AUTO_INIT_KEY, false);
    upsertBooleanMetaData(
      application,
      FIREBASE_ANALYTICS_COLLECTION_KEY,
      false,
    );

    return androidConfig;
  });
};

module.exports.FCM_AUTO_INIT_KEY = FCM_AUTO_INIT_KEY;
module.exports.FIREBASE_ANALYTICS_COLLECTION_KEY =
  FIREBASE_ANALYTICS_COLLECTION_KEY;
module.exports.upsertBooleanMetaData = upsertBooleanMetaData;
