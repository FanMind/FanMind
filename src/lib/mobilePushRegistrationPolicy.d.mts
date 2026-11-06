export const MOBILE_PUSH_ACTIONS: Readonly<{
  status: "status";
  register: "register";
  unregister: "unregister";
}>;
export const MOBILE_PUSH_REGISTRATION_DAYS: 30;
export const MOBILE_PUSH_CLIENT_HEADER: "mobile";
export const MOBILE_PUSH_MAX_REQUEST_BYTES: 4096;
export const MOBILE_PUSH_EAS_PROJECT_ID_ENV:
  "FANMIND_MOBILE_PUSH_EAS_PROJECT_ID";

export class MobilePushRegistrationPolicyError extends Error {
  readonly code: string;
  constructor(code: string);
}

export type MobilePushAction =
  | { action: "status" }
  | { action: "unregister" }
  | {
      action: "register";
      token: string;
      projectId: string;
      platform: "android" | "ios";
    };

export function validateMobilePushAction(value: unknown): MobilePushAction;
export function validateExpectedMobilePushProjectId(
  projectId: string,
  environment?: Record<string, unknown>,
): string;
export function readBoundedMobilePushJson(request: Request): Promise<unknown>;
export function publicMobilePushStatus(
  row:
    | {
        status?: unknown;
        platform?: unknown;
        expires_at?: unknown;
      }
    | null
    | undefined,
  now?: Date,
): {
  enabled: boolean;
  platform: "android" | "ios" | null;
  expiresAt: string | null;
  deliveryEnabled: false;
};
