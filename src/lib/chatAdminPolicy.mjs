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

export function assertChatAdminFanInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ChatAdminPolicyError("invalid_fan");
  const bounded = (field, required = false, max = 4_000) => {
    const value = input[field];
    if (value == null || value === "") {
      if (required) throw new ChatAdminPolicyError(`invalid_${field}`);
      return null;
    }
    if (typeof value !== "string" || !value.trim() || value.length > max) throw new ChatAdminPolicyError(`invalid_${field}`);
    return value.trim();
  };
  const status = input.status ?? "active";
  if (!['active', 'inactive'].includes(status)) throw new ChatAdminPolicyError("invalid_fan_status");
  return {
    display_name: bounded("display_name", true, 120),
    handle: bounded("handle", false, 120),
    platform: bounded("platform", true, 40),
    language: bounded("language", false, 40),
    status,
    summary: bounded("summary", false) ?? "",
    notes: bounded("notes", false) ?? "",
  };
}

export function buildChatAdminFanContext(character, fan, conversation, messages, incomingMessage, maxChars = Number.POSITIVE_INFINITY) {
  if (!fan || fan.workspace_id !== character.workspace_id || fan.character_id !== character.id || fan.status !== "active") throw new ChatAdminPolicyError("fan_unavailable");
  if (!conversation || conversation.workspace_id !== character.workspace_id || conversation.character_id !== character.id || conversation.fan_id !== fan.id) throw new ChatAdminPolicyError("conversation_unavailable");
  if (!Array.isArray(messages) || messages.some(message => message.workspace_id !== character.workspace_id || message.character_id !== character.id || message.fan_id !== fan.id || message.conversation_id !== conversation.id)) throw new ChatAdminPolicyError("message_context_mismatch");
  const base = JSON.parse(buildChatAdminCharacterContext(character, incomingMessage));
  base.fan = { id: fan.id, display_name: fan.display_name, handle: fan.handle, platform: fan.platform, language: fan.language, summary: fan.summary, notes: fan.notes, memory: fan.memory ?? null };
  base.conversation = { id: conversation.id, recent_messages: [] };
  const candidates = messages.slice(-20).map(({ direction, content, created_at }) => ({ direction, content, created_at }));
  // Prefer the newest complete turns. Never cut a message in the middle: if the
  // fixed Character/Fan/incoming context itself is too large, the caller rejects it.
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    base.conversation.recent_messages.unshift(candidates[index]);
    if (JSON.stringify(base).length > maxChars) { base.conversation.recent_messages.shift(); break; }
  }
  return JSON.stringify(base);
}
