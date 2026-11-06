export const MOBILE_PASSWORD_RECOVERY_REDIRECT: "fanmind://reset-password";
export const MOBILE_PASSWORD_RECOVERY_ROUTE: "reset-password";
export const MIN_PASSWORD_LENGTH: 12;
export const MAX_PASSWORD_LENGTH: 128;

export class MobileAuthRecoveryPolicyError extends Error {
  code: string;
  constructor(code: string);
}

export type MobileAuthRecoveryResult =
  | {
      mode: "pkce";
      recovery: true;
      code: string;
      accessToken: null;
      refreshToken: null;
    }
  | {
      mode: "tokens";
      recovery: true;
      code: null;
      accessToken: string;
      refreshToken: string;
    };

export function parseMobileAuthRecoveryUrl(
  rawUrl: string,
): MobileAuthRecoveryResult;
export function normalizeRecoveryEmail(value: unknown): string;
export function validateNewPassword(
  password: unknown,
  confirmation: unknown,
): {
  ok: boolean;
  password: string | null;
  errors: string[];
};
export function isPasswordRecoverySegments(
  segments: readonly string[] | undefined,
): boolean;
