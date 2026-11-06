export const LEGACY_SECURE_STORAGE_MAX_CHUNKS: number;
export const LEGACY_SECURE_STORAGE_MAX_KEYS: number;
export const LEGACY_SECURE_STORAGE_PURGE_MAX_CHUNKS: number;
export const LEGACY_SECURE_STORAGE_REGISTRY_KEY: string;
export function legacySecureStoreChunkKey(
  key: string,
  index: number,
): string;
export function legacySecureStoreCountKey(key: string): string;
export function parseLegacySecureStoreChunkCount(value: unknown): number;
export function parseLegacySecureStorePurgeChunkCount(value: unknown): number;
export function parseLegacySecureStorageRegistry(raw: unknown): {
  present: boolean;
  valid: boolean;
  keys: string[];
};
export function createSecureStoragePurgePlan(
  currentKeys: string[],
  legacyRegistry: {
    present: boolean;
    valid: boolean;
    keys: string[];
  },
): {
  keys: string[];
  legacyRegistryPresent: boolean;
  legacyRegistryValid: boolean;
  trustedLegacyKeys: string[];
};
