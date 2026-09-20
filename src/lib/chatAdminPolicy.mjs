export const CHAT_ADMIN_CAPABILITY = "chat_admin_multi_character";
export const CHAT_ADMIN_MAX_TEXT = 4_000;

export class ChatAdminPolicyError extends Error {
  constructor(code) {
    super(code);
    this.name = "ChatAdminPolicyError";
    this.code = code;
  }
}

export function assertChatAdminCharacterInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ChatAdminPolicyError("invalid_character");
  const textFields = ["display_name", "bio", "personality", "writing_style", "emoji_style", "sentence_style", "flirt_style", "sales_rules"];
  for (const field of textFields) {
    if (typeof input[field] !== "string" || !input[field].trim() || input[field].length > CHAT_ADMIN_MAX_TEXT) {
      throw new ChatAdminPolicyError(`invalid_${field}`);
    }
  }
  if (!Number.isInteger(input.public_age) || input.public_age < 18 || input.public_age > 99) throw new ChatAdminPolicyError("public_age_must_be_adult");
  for (const field of ["languages", "typical_phrases", "forbidden_phrases", "example_messages"]) {
    if (!Array.isArray(input[field]) || input[field].length > 30 || input[field].some((value) => typeof value !== "string" || !value.trim() || value.length > 500)) {
      throw new ChatAdminPolicyError(`invalid_${field}`);
    }
  }
  if (input.profile_image_path != null && (typeof input.profile_image_path !== "string" || !/^chat-characters\/[0-9a-f-]+\/[0-9a-f-]+\/[A-Za-z0-9._-]+$/u.test(input.profile_image_path))) {
    throw new ChatAdminPolicyError("invalid_profile_image_path");
  }
  return {
    display_name: input.display_name.trim(), profile_image_path: input.profile_image_path ?? null,
    public_age: input.public_age, bio: input.bio.trim(), location: typeof input.location === "string" && input.location.trim() ? input.location.trim() : null,
    languages: input.languages.map((v) => v.trim()), personality: input.personality.trim(), writing_style: input.writing_style.trim(),
    emoji_style: input.emoji_style.trim(), sentence_style: input.sentence_style.trim(), typical_phrases: input.typical_phrases.map((v) => v.trim()),
    forbidden_phrases: input.forbidden_phrases.map((v) => v.trim()), flirt_style: input.flirt_style.trim(), sales_rules: input.sales_rules.trim(),
    example_messages: input.example_messages.map((v) => v.trim()), status: input.status === "inactive" ? "inactive" : "active",
  };
}

export function buildChatAdminCharacterContext(character, incomingMessage, fanLabel = "") {
  if (!character || character.status !== "active" || !Number.isInteger(character.revision) || character.revision < 1) throw new ChatAdminPolicyError("character_unavailable");
  if (typeof incomingMessage !== "string" || !incomingMessage.trim() || incomingMessage.length > CHAT_ADMIN_MAX_TEXT) throw new ChatAdminPolicyError("invalid_incoming_message");
  const context = {
    character_id: character.id, character_revision: character.revision,
    persona: { display_name: character.display_name, public_age: character.public_age, bio: character.bio, location: character.location, languages: character.languages, personality: character.personality },
    style: { writing: character.writing_style, emoji: character.emoji_style, sentences: character.sentence_style, typical_phrases: character.typical_phrases, forbidden_phrases: character.forbidden_phrases },
    rules: { flirt: character.flirt_style, sales: character.sales_rules, examples: character.example_messages },
    fan: fanLabel ? { user_provided_label: fanLabel.slice(0, 120) } : null,
    incoming_message: incomingMessage.trim(),
  };
  return JSON.stringify(context);
}
