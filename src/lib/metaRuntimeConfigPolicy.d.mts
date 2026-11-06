export function normalizeMetaRuntimeValue(value: unknown): string | null;
export function isUsableMetaRuntimeValue(value: unknown): boolean;
export function isUsableMetaAppId(value: unknown): boolean;
export function isUsableMetaAppSecret(value: unknown): boolean;
export function normalizeMetaCallbackUrl(value: unknown, expectedPath: string): string | null;
export function isUsableMetaCallbackUrl(value: unknown, expectedPath: string): boolean;
