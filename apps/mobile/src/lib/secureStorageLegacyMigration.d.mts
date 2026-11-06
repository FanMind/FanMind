type LegacyStorageIo = {
  key: string;
  readValue: (physicalKey: string) => Promise<string | null>;
  deleteValue: (physicalKey: string) => Promise<void>;
};

export function inspectLegacySecureStorageValue(
  input: LegacyStorageIo,
): Promise<{
  status: "absent" | "corrupt" | "complete";
  value: string | null;
}>;
export function migrateLegacySecureStorageValue(
  input: LegacyStorageIo & {
    writeCurrentValue: (value: string) => Promise<void>;
    returnValueWhenCleanupFails?: boolean;
  },
): Promise<string | null>;
export function purgeLegacySecureStorageValue(
  input: Pick<LegacyStorageIo, "key" | "deleteValue"> & {
    chunkCount?: number;
  },
): Promise<void>;
export function purgeLegacySecureStorageValueIfPresent(
  input: LegacyStorageIo,
): Promise<void>;
