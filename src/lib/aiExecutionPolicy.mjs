import {
  AI_MAX_CONTEXT_MESSAGE_LIMIT,
  AI_TIER_CONTEXT_MESSAGE_LIMITS,
} from "../config/aiTiers.mjs";

export const AI_ANALYSIS_RATE_LIMIT_MAX = 10;
export const AI_ANALYSIS_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
export const AI_ANALYSIS_INPUT_CHAR_LIMIT = 100_000;
export const AI_ANALYSIS_OUTPUT_TOKEN_LIMIT = 2_048;
export const AI_ANALYSIS_MESSAGE_ROW_LIMIT =
  AI_TIER_CONTEXT_MESSAGE_LIMITS.standard;
export const AI_ANALYSIS_MAX_MESSAGE_ROW_LIMIT =
  AI_MAX_CONTEXT_MESSAGE_LIMIT;
export const AI_ANALYSIS_MEMORY_ROW_LIMIT = 20;
export const AI_REPLY_ANALYSIS_REPORT_CHAR_LIMIT = 12_000;
export const AI_REPLY_INPUT_CHAR_LIMIT = 80_000;
export const AI_REPLY_OUTPUT_TOKEN_LIMIT = 2_048;
export const AI_REPLY_RESPONSE_MODE_CHAR_LIMIT = 80;
export const AI_REPLY_COMPANY_PROMPT_CHAR_LIMIT = 3_000;
export const AI_REPLY_PROMPT_PROFILE_NAME_CHAR_LIMIT = 80;
export const AI_REPLY_PROMPT_PROFILE_CHAR_LIMIT = 1_500;

const AI_ANALYSIS_MESSAGE_CONTEXT_CHAR_LIMIT_PER_50_MESSAGES = 21_000;
const AI_REPLY_CONVERSATION_CONTEXT_CHAR_LIMIT_PER_50_MESSAGES = 12_000;
const AI_ANALYSIS_MEMORY_CONTEXT_CHAR_LIMIT = 7_000;
const AI_ANALYSIS_CONTACT_CONTEXT_CHAR_LIMIT = 7_000;

const TEXT_LIMITS = Object.freeze({
  instruction: 500,
  displayName: 160,
  handle: 160,
  sourcePlatform: 80,
  language: 32,
  status: 40,
  tag: 80,
  summary: 2_000,
  internalNotes: 4_000,
  messageDirection: 32,
  messageChannel: 80,
  messageOrigin: 80,
  messageAuthor: 160,
  messageText: 2_000,
  messageCreatedAt: 64,
  memoryType: 64,
  memoryContent: 1_000,
  memoryImportance: 32,
  memoryCreatedAt: 64,
});

function normalizeText(value, maximum) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.slice(0, maximum);
}

function normalizeNullableText(value, maximum) {
  const normalized = normalizeText(value, maximum);
  return normalized || null;
}

function normalizeTags(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((tag) => normalizeText(tag, TEXT_LIMITS.tag))
    .filter(Boolean)
    .slice(0, 20);
}

function serializedChars(value) {
  return JSON.stringify(value).length;
}

function fitStringField(object, key, maximumSerializedChars) {
  const value = object[key];
  if (typeof value !== "string" || serializedChars(object) <= maximumSerializedChars) {
    return;
  }

  let low = 0;
  let high = value.length;
  let best = "";

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    object[key] = value.slice(0, middle);
    if (serializedChars(object) <= maximumSerializedChars) {
      best = object[key];
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  object[key] = best;
}

function fitContactContext(contact) {
  const bounded = {
    displayName: normalizeNullableText(
      contact?.displayName,
      TEXT_LIMITS.displayName,
    ),
    handle: normalizeNullableText(contact?.handle, TEXT_LIMITS.handle),
    sourcePlatform: normalizeNullableText(
      contact?.sourcePlatform,
      TEXT_LIMITS.sourcePlatform,
    ),
    contactLanguage: normalizeNullableText(
      contact?.contactLanguage,
      TEXT_LIMITS.language,
    ),
    status: normalizeNullableText(contact?.status, TEXT_LIMITS.status),
    tags: normalizeTags(contact?.tags),
    summary: normalizeNullableText(contact?.summary, TEXT_LIMITS.summary),
    internalNotes: normalizeText(
      contact?.internalNotes,
      TEXT_LIMITS.internalNotes,
    ),
  };

  fitStringField(
    bounded,
    "internalNotes",
    AI_ANALYSIS_CONTACT_CONTEXT_CHAR_LIMIT,
  );
  fitStringField(
    bounded,
    "summary",
    AI_ANALYSIS_CONTACT_CONTEXT_CHAR_LIMIT,
  );

  while (
    serializedChars(bounded) > AI_ANALYSIS_CONTACT_CONTEXT_CHAR_LIMIT &&
    bounded.tags.length
  ) {
    bounded.tags.pop();
  }

  for (const key of [
    "displayName",
    "handle",
    "sourcePlatform",
    "contactLanguage",
    "status",
  ]) {
    fitStringField(
      bounded,
      key,
      AI_ANALYSIS_CONTACT_CONTEXT_CHAR_LIMIT,
    );
  }

  if (serializedChars(bounded) > AI_ANALYSIS_CONTACT_CONTEXT_CHAR_LIMIT) {
    throw new RangeError("AI analysis contact context exceeds its budget.");
  }

  return bounded;
}

function normalizeMessage(message) {
  return {
    direction: normalizeText(
      message?.direction,
      TEXT_LIMITS.messageDirection,
    ),
    channel: normalizeText(message?.channel, TEXT_LIMITS.messageChannel),
    origin: normalizeText(message?.origin, TEXT_LIMITS.messageOrigin),
    author: normalizeNullableText(message?.author, TEXT_LIMITS.messageAuthor),
    text: normalizeText(message?.text, TEXT_LIMITS.messageText),
    mediaPresent: Boolean(message?.mediaPresent),
    createdAt: normalizeNullableText(
      message?.createdAt,
      TEXT_LIMITS.messageCreatedAt,
    ),
  };
}

function normalizeMemory(memory) {
  return {
    type: normalizeText(memory?.type, TEXT_LIMITS.memoryType),
    content: normalizeText(memory?.content, TEXT_LIMITS.memoryContent),
    importance: normalizeText(
      memory?.importance,
      TEXT_LIMITS.memoryImportance,
    ),
    createdAt: normalizeNullableText(
      memory?.createdAt,
      TEXT_LIMITS.memoryCreatedAt,
    ),
  };
}

function normalizeMessageLimit(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return AI_ANALYSIS_MESSAGE_ROW_LIMIT;
  return Math.max(
    1,
    Math.min(AI_ANALYSIS_MAX_MESSAGE_ROW_LIMIT, Math.trunc(number)),
  );
}

function scaledContextCharLimit(baseLimit, messageLimit) {
  return Math.round(
    baseLimit * (normalizeMessageLimit(messageLimit) / 50),
  );
}

function fitRecentMessages(messages, messageLimit) {
  const normalizedMessageLimit = normalizeMessageLimit(messageLimit);
  const bounded = (Array.isArray(messages) ? messages : [])
    .slice(-normalizedMessageLimit)
    .map(normalizeMessage);

  while (
    serializedChars(bounded) >
      scaledContextCharLimit(
        AI_ANALYSIS_MESSAGE_CONTEXT_CHAR_LIMIT_PER_50_MESSAGES,
        normalizedMessageLimit,
      ) &&
    bounded.length
  ) {
    bounded.shift();
  }

  return bounded;
}

function fitRecentMemories(memories) {
  const bounded = (Array.isArray(memories) ? memories : [])
    .slice(0, AI_ANALYSIS_MEMORY_ROW_LIMIT)
    .map(normalizeMemory);

  while (
    serializedChars(bounded) > AI_ANALYSIS_MEMORY_CONTEXT_CHAR_LIMIT &&
    bounded.length
  ) {
    bounded.pop();
  }

  return bounded;
}

export function buildBoundedFanAnalysisPayload(input) {
  const payload = {
    language: input?.language === "en" ? "en" : "de",
    analysisMode:
      input?.analysisMode === "standard" ||
      input?.analysisMode === "detailed"
        ? input.analysisMode
        : "short",
    additionalInstruction:
      normalizeNullableText(
        input?.additionalInstruction,
        TEXT_LIMITS.instruction,
      ),
    contact: fitContactContext(input?.contact),
    contactKnowledge: fitRecentMemories(input?.contactKnowledge),
    messages: fitRecentMessages(input?.messages, input?.messageLimit),
  };
  const inputChars = serializedChars(payload);

  if (inputChars > AI_ANALYSIS_INPUT_CHAR_LIMIT) {
    throw new RangeError("AI analysis input exceeds its total budget.");
  }

  return Object.freeze({
    payload,
    inputChars,
  });
}

export function buildBoundedReplySuggestionContext(input) {
  const context = {
    contactId: normalizeText(input?.contactId, 160),
    displayName:
      normalizeText(input?.displayName, TEXT_LIMITS.displayName) || "Kontakt",
    handle: normalizeNullableText(input?.handle, TEXT_LIMITS.handle),
    sourcePlatform: normalizeNullableText(
      input?.sourcePlatform,
      TEXT_LIMITS.sourcePlatform,
    ),
    language: normalizeText(input?.language, TEXT_LIMITS.language) || "de",
    status: normalizeNullableText(input?.status, TEXT_LIMITS.status),
    tags: normalizeTags(input?.tags),
    summary: normalizeNullableText(input?.summary, TEXT_LIMITS.summary),
    conversationContext: normalizeText(
      input?.conversationContext,
      scaledContextCharLimit(
        AI_REPLY_CONVERSATION_CONTEXT_CHAR_LIMIT_PER_50_MESSAGES,
        input?.messageLimit,
      ),
    ),
    incomingMessage:
      typeof input?.incomingMessage === "string" ? input.incomingMessage : "",
    responseMode:
      normalizeText(input?.responseMode, AI_REPLY_RESPONSE_MODE_CHAR_LIMIT) ||
      "Freundlich",
    responseInstruction:
      normalizeNullableText(input?.responseInstruction, 1_000),
    companyPrompt:
      normalizeNullableText(
        input?.companyPrompt,
        AI_REPLY_COMPANY_PROMPT_CHAR_LIMIT,
      ),
    promptProfileName:
      normalizeNullableText(
        input?.promptProfileName,
        AI_REPLY_PROMPT_PROFILE_NAME_CHAR_LIMIT,
      ),
    promptProfilePrompt:
      normalizeNullableText(
        input?.promptProfilePrompt,
        AI_REPLY_PROMPT_PROFILE_CHAR_LIMIT,
      ),
    analysisReport:
      normalizeNullableText(
        input?.analysisReport,
        AI_REPLY_ANALYSIS_REPORT_CHAR_LIMIT,
      ),
  };
  if (input?.creatorContext !== undefined && input?.creatorContext !== null) {
    if (typeof input.creatorContext !== "object" || Array.isArray(input.creatorContext) || serializedChars(input.creatorContext) > 18000) {
      throw new RangeError("Creator context exceeds its bounded budget.");
    }
    context.creatorContext = input.creatorContext;
    context.fanMemory = normalizeText(input?.fanMemory, 7000);
    context.conversationSummary = normalizeText(input?.conversationSummary, 4000);
  }
  const inputChars = serializedChars(context);

  if (inputChars > AI_REPLY_INPUT_CHAR_LIMIT) {
    throw new RangeError("AI reply input exceeds its total budget.");
  }

  return Object.freeze({
    context,
    inputChars,
  });
}
