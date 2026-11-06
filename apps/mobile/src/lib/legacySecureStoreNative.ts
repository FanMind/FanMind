import ExpoSecureStoreNative from "expo-secure-store/build/ExpoSecureStore";

import {
  LEGACY_SECURE_STORAGE_REGISTRY_KEY,
  legacySecureStoreChunkKey,
  legacySecureStoreCountKey,
} from "@/lib/secureStorageLegacyPolicy.mjs";

type LegacySecureStoreNativeModule = {
  getValueWithKeyAsync(
    key: string,
    options: Record<string, never>,
  ): Promise<string | null>;
  deleteValueWithKeyAsync(
    key: string,
    options: Record<string, never>,
  ): Promise<void>;
};

const legacySecureStoreNative =
  ExpoSecureStoreNative as LegacySecureStoreNativeModule;
const NO_OPTIONS = {};

function assertLegacyPhysicalKey(key: string): string {
  if (key === LEGACY_SECURE_STORAGE_REGISTRY_KEY) return key;

  const countMatch = /^([A-Za-z0-9._-]+):count$/u.exec(key);
  const countLogicalKey = countMatch?.[1];
  if (
    countLogicalKey &&
    legacySecureStoreCountKey(countLogicalKey) === key
  ) {
    return key;
  }

  const chunkMatch = /^([A-Za-z0-9._-]+):chunk:(\d{1,3})$/u.exec(key);
  const chunkLogicalKey = chunkMatch?.[1];
  const chunkIndex = chunkMatch?.[2];
  if (
    chunkLogicalKey &&
    chunkIndex &&
    legacySecureStoreChunkKey(chunkLogicalKey, Number(chunkIndex)) === key
  ) {
    return key;
  }

  throw new Error("Unzulässiger alter FanMind-Speicherschlüssel.");
}

export function readLegacySecureStoreValue(
  key: string,
): Promise<string | null> {
  return legacySecureStoreNative.getValueWithKeyAsync(
    assertLegacyPhysicalKey(key),
    NO_OPTIONS,
  );
}

export function deleteLegacySecureStoreValue(key: string): Promise<void> {
  return legacySecureStoreNative.deleteValueWithKeyAsync(
    assertLegacyPhysicalKey(key),
    NO_OPTIONS,
  );
}
