export const MAX_SECURE_STORAGE_KEYS: number;
export const MAX_SECURE_STORAGE_KEY_LENGTH: number;
export function normalizeSecureStorageRegistry(raw: unknown): string[];
export function addSecureStorageRegistryKey(
  keys: readonly string[] | undefined,
  key: string,
): string[];
export function removeSecureStorageRegistryKey(
  keys: readonly string[] | undefined,
  key: string,
): string[];
