export const MAX_SECURE_STORE_KEY_LENGTH: number;
export const MAX_SECURE_STORAGE_LOGICAL_KEY_LENGTH: number;
export const SECURE_STORAGE_REGISTRY_KEY: string;
export const SECURE_STORE_KEY_PATTERN: RegExp;
export function assertSecureStoreKey(key: unknown): string;
export function assertSecureStorageLogicalKey(key: unknown): string;
export function secureStoreCountKey(key: string): string;
export function secureStoreChunkKey(key: string, index: number): string;
