export const AI_COMPANY_PROMPT_MAX_CHARS: 3000;
export const AI_PROMPT_PROFILE_MAX_CHARS: 1500;
export const AI_PROMPT_PROFILE_NAME_MAX_CHARS: 80;
export const AI_PROMPT_PROFILE_MAX_COUNT: 8;

export type AiPromptProfile = {
  id: string;
  name: string;
  instruction: string;
  isActive: boolean;
  isDefault: boolean;
};

export type AiPromptSettings = {
  companyPrompt: string;
  profiles: readonly AiPromptProfile[];
};

export type AiPromptContext = {
  companyPrompt: string | null;
  profileId: string | null;
  profileName: string | null;
  profilePrompt: string | null;
};

export class AiPromptPolicyError extends Error {
  code: string;
  constructor(message: string, code?: string);
}

export function normalizeAiPromptSettings(
  input: unknown,
  options?: { assignIds?: boolean },
): AiPromptSettings;

export function selectAiPromptContext(
  settings: unknown,
  requestedProfileId: unknown,
): AiPromptContext;
