export const META_SYNC_MODE: "incremental_cache";
export const META_INITIAL_CHAT_BACKFILL_LIMIT: 150;
export const META_INCREMENTAL_CHAT_FETCH_LIMIT: 50;
export const META_PERSONAL_CONTENT_RETENTION_DAYS: 0;
export const CACHED_META_DATA_CLASSES: readonly string[];
export const TRANSIENT_META_DATA_CLASSES: readonly string[];
export const PERSISTED_META_DATA_CLASSES: readonly string[];

export function evaluateMetaDataUse(input: {
  dataClass?: unknown;
  userRequested?: unknown;
  persist?: unknown;
  workspaceBound?: unknown;
  authorizedConnection?: unknown;
}): { allowed: boolean; reason: string };

export function buildMinimalFanProfile(input: Record<string, unknown>): Record<
  string,
  unknown
> & {
  source_message_count: number;
  confidence_score: number;
  source_from_at: string | null;
  source_to_at: string | null;
  raw_source_retained: false;
};
