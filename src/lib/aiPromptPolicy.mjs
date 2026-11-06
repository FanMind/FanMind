import { randomUUID } from "node:crypto";

export const AI_COMPANY_PROMPT_MAX_CHARS = 3_000;
export const AI_PROMPT_PROFILE_NAME_MAX_CHARS = 80;
export const AI_PROMPT_PROFILE_MAX_CHARS = 1_500;
export const AI_PROMPT_PROFILE_MAX_COUNT = 8;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export class AiPromptPolicyError extends Error {
  constructor(code) {
    super(code);
    this.name = "AiPromptPolicyError";
    this.code = code;
  }
}

function normalizedText(value) {
  return typeof value === "string"
    ? value.replace(/\r\n?/gu, "\n").trim()
    : "";
}

function boundedText(value, maximum, code, { required = false } = {}) {
  const normalized = normalizedText(value);
  if (required && !normalized) throw new AiPromptPolicyError(code);
  if (normalized.length > maximum) throw new AiPromptPolicyError(code);
  return normalized;
}

function normalizedProfile(profile, assignIds) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    throw new AiPromptPolicyError("profile_invalid");
  }

  const suppliedId = normalizedText(profile.id);
  const id = UUID_PATTERN.test(suppliedId)
    ? suppliedId.toLowerCase()
    : assignIds
      ? randomUUID()
      : "";
  if (!id) throw new AiPromptPolicyError("profile_id_invalid");

  const isActive = profile.isActive !== false;
  const isDefault = profile.isDefault === true;
  if (isDefault && !isActive) {
    throw new AiPromptPolicyError("default_profile_must_be_active");
  }

  return Object.freeze({
    id,
    name: boundedText(
      profile.name,
      AI_PROMPT_PROFILE_NAME_MAX_CHARS,
      "profile_name_invalid",
      { required: true },
    ),
    instruction: boundedText(
      profile.instruction,
      AI_PROMPT_PROFILE_MAX_CHARS,
      "profile_instruction_invalid",
      { required: true },
    ),
    isActive,
    isDefault,
  });
}

export function normalizeAiPromptSettings(input, { assignIds = false } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new AiPromptPolicyError("settings_invalid");
  }
  const source = input;
  if (
    Object.hasOwn(source, "companyPrompt") &&
    typeof source.companyPrompt !== "string"
  ) {
    throw new AiPromptPolicyError("company_prompt_invalid");
  }
  if (Object.hasOwn(source, "profiles") && !Array.isArray(source.profiles)) {
    throw new AiPromptPolicyError("profiles_invalid");
  }

  const rawProfiles = source.profiles ?? [];
  if (rawProfiles.length > AI_PROMPT_PROFILE_MAX_COUNT) {
    throw new AiPromptPolicyError("too_many_profiles");
  }

  const profiles = rawProfiles.map((profile) =>
    normalizedProfile(profile, assignIds),
  );
  const ids = new Set(profiles.map((profile) => profile.id));
  if (ids.size !== profiles.length) {
    throw new AiPromptPolicyError("profile_ids_not_unique");
  }
  if (profiles.filter((profile) => profile.isDefault).length > 1) {
    throw new AiPromptPolicyError("multiple_default_profiles");
  }

  const activeProfiles = profiles.filter((profile) => profile.isActive);
  let normalizedProfiles = profiles;
  if (
    activeProfiles.length > 0 &&
    !activeProfiles.some((profile) => profile.isDefault)
  ) {
    const firstActiveId = activeProfiles[0].id;
    normalizedProfiles = profiles.map((profile) =>
      Object.freeze({
        ...profile,
        isDefault: profile.id === firstActiveId,
      }),
    );
  }

  return Object.freeze({
    companyPrompt: boundedText(
      source.companyPrompt,
      AI_COMPANY_PROMPT_MAX_CHARS,
      "company_prompt_invalid",
    ),
    profiles: Object.freeze(normalizedProfiles),
  });
}

export function selectAiPromptContext(settings, requestedProfileId) {
  const normalized = normalizeAiPromptSettings(settings);
  const activeProfiles = normalized.profiles.filter(
    (profile) => profile.isActive,
  );
  const requestedId = normalizedText(requestedProfileId).toLowerCase();
  const selected =
    activeProfiles.find((profile) => profile.id === requestedId) ??
    activeProfiles.find((profile) => profile.isDefault) ??
    activeProfiles[0] ??
    null;

  return Object.freeze({
    companyPrompt: normalized.companyPrompt || null,
    profileId: selected?.id ?? null,
    profileName: selected?.name ?? null,
    profilePrompt: selected?.instruction ?? null,
  });
}
