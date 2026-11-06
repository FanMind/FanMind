import type { FanMindAiQualityProfile } from "../config/openAiPriceCatalog.mjs";
export function getChatAdminModelProfile(): FanMindAiQualityProfile;
export const CHAT_ADMIN_MODEL_TIMEOUT_MS: number;
export function buildChatAdminModelRequest(context: string): { model: string; service_tier: string; reasoning: { effort: string }; input: Array<{ role: string; content: string }>; text: object; max_output_tokens: number; store: false };
export function verifyChatAdminModelProvider(input: { apiKey: string | undefined; fetchImpl?: typeof fetch }): Promise<true>;
