import {
  OFFLINE_READ_CACHE_KEY,
  createOfflineReadCache,
  normalizeOfflineReadCache,
  type OfflineReadCache,
} from "@/lib/offlineReadCachePolicy.mjs";
import { createOfflineReadCacheAccessGate } from "@/lib/offlineReadCacheAccessPolicy.mjs";
import { secureSessionStorage } from "@/lib/secureStorage";
import { createSerialOperationQueue } from "@/lib/serialOperationQueue.mjs";
import type { ContactListItem } from "@/types";

const cacheAccess = createOfflineReadCacheAccessGate();
const cacheOperations = createSerialOperationQueue();

function ownerCanUseCache(userId: string): boolean {
  return cacheAccess.canUse(userId);
}

export function activateOfflineReadCacheOwner(userId: string | null): void {
  cacheAccess.activate(userId);
}

export function resumeOfflineReadCacheOwner(userId: string | null): void {
  cacheAccess.resume(userId);
}

export async function disableOfflineReadCacheWrites(): Promise<void> {
  cacheAccess.suspend();
  await cacheOperations.drain();
}

export async function readOfflineReadCache(
  userId: string,
  workspaceId?: string | null,
): Promise<OfflineReadCache | null> {
  if (!ownerCanUseCache(userId)) return null;
  return cacheOperations.run(async () => {
    if (!ownerCanUseCache(userId)) return null;
    try {
      const raw = await secureSessionStorage.getItem(OFFLINE_READ_CACHE_KEY);
      if (!raw || !ownerCanUseCache(userId)) return null;
      const cache = normalizeOfflineReadCache(raw, { userId, workspaceId });
      if (!cache) {
        await secureSessionStorage.removeItem(OFFLINE_READ_CACHE_KEY);
        return null;
      }
      return cache;
    } catch {
      return null;
    }
  });
}

export function writeOfflineReadCache(input: {
  userId: string;
  workspaceId: string;
  workspaceName: string;
  contacts: ContactListItem[];
  accessExpiresAt?: string | null;
}): Promise<boolean> {
  if (!ownerCanUseCache(input.userId)) return Promise.resolve(false);
  return cacheOperations.run(async () => {
    if (!ownerCanUseCache(input.userId)) return false;
    try {
      const cache = createOfflineReadCache(input);
      if (!ownerCanUseCache(input.userId)) return false;
      await secureSessionStorage.setItem(
        OFFLINE_READ_CACHE_KEY,
        JSON.stringify(cache),
      );
      return ownerCanUseCache(input.userId);
    } catch {
      return false;
    }
  });
}

export function removeOfflineReadCache(userId: string): Promise<boolean> {
  if (!ownerCanUseCache(userId)) return Promise.resolve(false);
  return cacheOperations.run(async () => {
    if (!ownerCanUseCache(userId)) return false;
    try {
      await secureSessionStorage.removeItem(OFFLINE_READ_CACHE_KEY);
      return true;
    } catch {
      return false;
    }
  });
}
