const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const OWNER_PATTERN =
  /^[a-z0-9](?:[a-z0-9_-]{0,37}[a-z0-9])?$/iu;

const RUNTIME_EAS_PROJECT_ID = "df30aeb2-79d3-42bc-9fc1-e2d3f7e5666f";

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

module.exports = ({ config, environment = process.env }) => {
  const binding = optionalEasBinding(environment);
  const projectId = binding?.projectId ?? RUNTIME_EAS_PROJECT_ID;

  return {
    ...config,
    ...(binding ? { owner: binding.owner } : {}),
    extra: {
      ...(config.extra ?? {}),
      eas: {
        projectId,
      },
    },
  };
};

module.exports.optionalEasBinding = optionalEasBinding;
module.exports.RUNTIME_EAS_PROJECT_ID = RUNTIME_EAS_PROJECT_ID;
