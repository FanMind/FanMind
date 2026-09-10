export type BoundedFanAnalysisPayload = {
  language: "de" | "en";
  analysisMode: "short" | "standard" | "detailed";
  additionalInstruction: string | null;
  contact: {
    displayName: string | null;
    handle: string | null;
    sourcePlatform: string | null;
    contactLanguage: string | null;
    status: string | null;
    tags: string[];
    summary: string | null;
    internalNotes: string;
  };
  contactKnowledge: Array<{
    type: string;
    content: string;
    importance: string;
    createdAt: string | null;
  }>;
  messages: Array<{
    direction: string;
    channel: string;
    origin: string;
    author: string | null;
    text: string;
    mediaPresent: boolean;
    createdAt: string | null;
  }>;
};

export const AI_ANALYSIS_RATE_LIMIT_MAX: 10;
export const AI_ANALYSIS_RATE_LIMIT_WINDOW_MS: 600000;
export const AI_ANALYSIS_INPUT_CHAR_LIMIT: 100000;
export const AI_ANALYSIS_OUTPUT_TOKEN_LIMIT: 2048;
export const AI_ANALYSIS_MESSAGE_ROW_LIMIT: 50;
export const AI_ANALYSIS_MAX_MESSAGE_ROW_LIMIT: 150;
export const AI_ANALYSIS_MEMORY_ROW_LIMIT: 20;
export const AI_REPLY_ANALYSIS_REPORT_CHAR_LIMIT: 12000;
export const AI_REPLY_INPUT_CHAR_LIMIT: 80000;
export const AI_REPLY_OUTPUT_TOKEN_LIMIT: 2048;
export const AI_REPLY_RESPONSE_MODE_CHAR_LIMIT: 80;
export const AI_REPLY_COMPANY_PROMPT_CHAR_LIMIT: 3000;
export const AI_REPLY_PROMPT_PROFILE_NAME_CHAR_LIMIT: 80;
export const AI_REPLY_PROMPT_PROFILE_CHAR_LIMIT: 1500;

export function buildBoundedFanAnalysisPayload(input: {
  language?: unknown;
  analysisMode?: unknown;
  additionalInstruction?: unknown;
  contact?: Record<string, unknown> | null;
  contactKnowledge?: readonly Record<string, unknown>[] | null;
  messages?: readonly Record<string, unknown>[] | null;
  messageLimit?: unknown;
}): Readonly<{
  payload: BoundedFanAnalysisPayload;
  inputChars: number;
}>;

export type BoundedReplySuggestionContext = {
  creatorContext?: import("./creatorIntelligencePolicy.mjs").CreatorContext;
  fanMemory?: string;
  conversationSummary?: string;
  contactId: string;
  displayName: string;
  handle: string | null;
  sourcePlatform: string | null;
  language: string;
  status: string | null;
  tags: string[];
  summary: string | null;
  conversationContext: string;
  incomingMessage: string;
  responseMode: string;
  responseInstruction: string | null;
  companyPrompt: string | null;
  promptProfileName: string | null;
  promptProfilePrompt: string | null;
  analysisReport: string | null;
};

export function buildBoundedReplySuggestionContext(
  input: Record<string, unknown> & { messageLimit?: unknown },
): Readonly<{
  context: BoundedReplySuggestionContext;
  inputChars: number;
}>;
