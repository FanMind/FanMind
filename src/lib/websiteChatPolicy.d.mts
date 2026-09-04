export class WebsiteChatPolicyError extends Error {
  code: string;
}
export const MAX_BODY_BYTES: number;
export const MAX_EMAIL_LENGTH: number;
export const MAX_MESSAGE_LENGTH: number;
export const MAX_SESSION_TTL_MINUTES: number;
export const MIN_SESSION_TTL_MINUTES: number;
export const PUBLIC_INSTALLATION_ID_PATTERN: RegExp;
export const SESSION_TOKEN_PATTERN: RegExp;
export const SUBJECT_HASH_PATTERN: RegExp;
export const WEBSITE_CHAT_EMAIL_PATTERN: RegExp;
export const CLIENT_MESSAGE_ID_PATTERN: RegExp;
export const WEBSITE_CHAT_INSTALLATION_HEADER: string;
export const WEBSITE_CHAT_INSTALLATION_QUERY: string;
export function normalizeWebsiteChatOrigin(value: unknown): string;
export function requireAllowedWebsiteChatOrigin(value: unknown, allowedOrigins: unknown): string;
export function requirePublicInstallationId(value: unknown): string;
export function createWebsiteChatSessionToken(randomBytes?: (size: number) => Buffer): string;
export function hashWebsiteChatSessionToken(input: { token: unknown; secret: unknown }): string;
export function normalizeWebsiteChatMessage(value: unknown): string;
export function normalizeWebsiteChatEmail(value: unknown): string;
export function requireWebsiteChatClientMessageId(value: unknown): string;
export function requireConsent(input: unknown, expectedVersion: string): string;
export function requireWebsiteChatHandoffConsent(input: unknown, expectedVersion: string): string;
export function normalizeSessionTtlMinutes(value: unknown): number;
export function requireWebsiteChatPreflight(
  input: { method: unknown; requestedHeaders: unknown },
  allowedHeaders: unknown,
): string[];
