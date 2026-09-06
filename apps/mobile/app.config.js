const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const OWNER_PATTERN =
  /^[a-z0-9](?:[a-z0-9_-]{0,37}[a-z0-9])?$/iu;

const RUNTIME_EAS_PROJECT_ID = "df30aeb2-79d3-42bc-9fc1-e2d3f7e5666f";
const FCM_CONSENT_PLUGIN = "./plugins/with-fcm-consent-boundary.cjs";

function optionalEasBinding(environment = process.env) {
  const owner = String(
    environment.FANMIND_MOBILE_EXPECTED_EAS_OWNER ?? "",
  ).trim();
  const projectId = String(
    environment.FANMIND_MOBILE_EXPECTED_EAS_PROJECT_ID ?? "",
  )
    .trim()
    .toLowerCase();

  if (!owner && !projectId) return null;
  if (
    !OWNER_PATTERN.test(owner) ||
    /^(?:owner|example|placeholder|fanmind)$/iu.test(owner) ||
    !UUID_PATTERN.test(projectId)
  ) {
    throw new Error("FANMIND_MOBILE_EAS_BINDING_INVALID");
  }
  return { owner, projectId };
}

function optionalAndroidGoogleServicesFile(environment = process.env) {
  const value = String(environment.GOOGLE_SERVICES_JSON ?? "").trim();
  if (!value) return null;
  if (/\r|\n|\0/u.test(value)) {
    throw new Error("FANMIND_MOBILE_GOOGLE_SERVICES_FILE_INVALID");
  }
  return value;
}

function withFcmConsentPlugin(plugins = []) {
  if (plugins.some((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return name === FCM_CONSENT_PLUGIN;
  })) {
    return plugins;
  }
  return [...plugins, FCM_CONSENT_PLUGIN];
}

module.exports = ({ config, environment = process.env }) => {
  const binding = optionalEasBinding(environment);
  const projectId = binding?.projectId ?? RUNTIME_EAS_PROJECT_ID;
  const googleServicesFile = optionalAndroidGoogleServicesFile(environment);

  return {
    ...config,
    ...(binding ? { owner: binding.owner } : {}),
    plugins: withFcmConsentPlugin(config.plugins ?? []),
    android: {
      ...(config.android ?? {}),
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
    extra: {
      ...(config.extra ?? {}),
      eas: {
        projectId,
      },
    },
  };
};

module.exports.optionalEasBinding = optionalEasBinding;
module.exports.optionalAndroidGoogleServicesFile = optionalAndroidGoogleServicesFile;
module.exports.withFcmConsentPlugin = withFcmConsentPlugin;
module.exports.RUNTIME_EAS_PROJECT_ID = RUNTIME_EAS_PROJECT_ID;
module.exports.FCM_CONSENT_PLUGIN = FCM_CONSENT_PLUGIN;
