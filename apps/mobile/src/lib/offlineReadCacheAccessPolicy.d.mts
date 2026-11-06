export type OfflineReadCacheAccessGate = {
  activate(userId: string | null): boolean;
  resume(userId: string | null): boolean;
  suspend(): void;
  canUse(userId: string): boolean;
};

export function createOfflineReadCacheAccessGate(): OfflineReadCacheAccessGate;
