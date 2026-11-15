export const CHAT_ADMIN_USAGE_HEADER: "x-fanmind-chatadmin-usage";
export const CHAT_ADMIN_MANUAL_GENERATIONS: 10;
export type ChatAdminUsageAttempt = {id: string; status: "ok" | "error"};
export type ChatAdminUsageWitness = {generationId: string; attempts: ChatAdminUsageAttempt[]}[];
export function parseChatAdminUsageHeader(header: unknown): ChatAdminUsageAttempt[];
export function validateChatAdminUsageWitness(witness: unknown, complete?: boolean): ChatAdminUsageAttempt[];
