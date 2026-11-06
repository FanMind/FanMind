export type SocialSyncResult = {
  ok: boolean;
  checkedConversations: number;
  checkedMessages: number;
  importedInbound: number;
  importedOutbound: number;
  importedMedia: number;
  skippedDuplicates: number;
  errors: string[];
  syncLimit: number;
  lastSyncAt: string;
};

export function createEmptySocialSyncResult(input: {
  ok?: boolean;
  lastSyncAt: string;
  syncLimit: number;
  error?: string | null;
}): SocialSyncResult {
  return {
    ok: input.ok ?? !input.error,
    checkedConversations: 0,
    checkedMessages: 0,
    importedInbound: 0,
    importedOutbound: 0,
    importedMedia: 0,
    skippedDuplicates: 0,
    errors: input.error ? [input.error] : [],
    syncLimit: input.syncLimit,
    lastSyncAt: input.lastSyncAt,
  };
}
