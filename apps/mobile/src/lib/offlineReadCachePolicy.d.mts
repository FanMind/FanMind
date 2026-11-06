import type { ContactListItem } from "../types";

export const OFFLINE_READ_CACHE_KEY: string;
export const OFFLINE_READ_CACHE_MAX_AGE_MS: number;
export const OFFLINE_READ_CACHE_MAX_CONTACTS: number;
export const OFFLINE_READ_CACHE_MAX_SERIALIZED_LENGTH: number;
export const OFFLINE_READ_CACHE_VERSION: number;

export type OfflineReadCache = {
  version: number;
  cachedAt: number;
  cacheValidUntil: number;
  userId: string;
  workspaceId: string;
  workspaceName: string;
  contacts: ContactListItem[];
};

export function createOfflineReadCache(input: {
  userId: string;
  workspaceId: string;
  workspaceName: string;
  contacts: ContactListItem[];
  cachedAt?: number;
  accessExpiresAt?: string | null;
}): OfflineReadCache;
export function normalizeOfflineReadCache(
  raw: unknown,
  input: { userId: string; workspaceId?: string | null; now?: number },
): OfflineReadCache | null;
export function filterOfflineContacts(
  contacts: ContactListItem[],
  search?: string,
): ContactListItem[];
export function isOfflineEligibleStatus(status: unknown): boolean;
