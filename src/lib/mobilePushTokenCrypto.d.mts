export class MobilePushTokenCryptoError extends Error {
  readonly code: string;
  constructor(code: string);
}

export function hashMobilePushToken(token: string): string;
export function encryptMobilePushToken(token: string): string;
export function decryptMobilePushToken(value: string): string;
