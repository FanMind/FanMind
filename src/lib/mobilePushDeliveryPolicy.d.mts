export const MOBILE_PUSH_DELIVERY_CONFIRMATION: "deliver-mobile-followup-reminder-staging";
export const MOBILE_PUSH_DELIVERY_ENABLED_ENV: "FANMIND_MOBILE_PUSH_DELIVERY_ENABLED";
export const MOBILE_PUSH_EXPO_ACCESS_TOKEN_ENV: "FANMIND_MOBILE_PUSH_EXPO_ACCESS_TOKEN";
export const MOBILE_PUSH_ATOMIC_REVALIDATION_CONTRACT: "mobile-push-target-revalidation-v1";
export const MOBILE_PUSH_STAGING_APP_HOSTNAME: "staging.fanmind.ch";
export const MOBILE_PUSH_PRODUCTION_DELIVERY_SUPPORTED: false;
export const MOBILE_PUSH_MAX_ATTEMPTS: 3;
export const MOBILE_PUSH_MAX_RECEIPT_CHECKS: 4;
export const MOBILE_PUSH_REVALIDATION_MAX_CLOCK_SKEW_MS: number;
export const MOBILE_PUSH_REGISTRATION_MAX_FUTURE_MS: number;
export const MOBILE_PUSH_RECEIPT_CHECK_DELAY_MS: number;
export const MOBILE_PUSH_RECEIPT_EXPIRY_MS: number;
export const MOBILE_PUSH_REMINDER_TTL_SECONDS: 3600;
export const MOBILE_PUSH_RECEIPT_RETRY_DELAYS_MS: readonly number[];
export const MOBILE_PUSH_RETRY_DELAYS_MS: readonly number[];
export const MOBILE_PUSH_REMINDER_COPY: Readonly<{
  title: "FanMind";
  body: "Ein Follow-up ist fällig.";
  type: "followup_reminder";
  channelId: "followup-reminders";
}>;

export class MobilePushDeliveryPolicyError extends Error {
  readonly code: string;
  constructor(code: string);
}

export function canonicalizeMobilePushDatabaseTimestamp(
  value: unknown,
): string | null;
export function validateMobilePushDeliveryTargetBinding(value: unknown): Readonly<{
  supabaseUrl: string;
  supabaseProjectRef: string;
  serviceRoleKey: string;
}>;

export type MobilePushDeliveryTrigger = {
  confirmation: "deliver-mobile-followup-reminder-staging";
  dueDateCutoff: string;
  followupId: string;
  userId: string;
  workspaceId: string;
};

export function evaluateMobilePushDeliveryEnvironment(
  environment?: Record<string, unknown>,
  options?: {
    confirmation?: string;
    expectedProjectId?: string;
    reviewedAppHostname?: string;
    reviewedTargetSupabaseProjectRef?: string;
    reviewedProductionSupabaseProjectRef?: string;
  },
): {
  ok: boolean;
  mode: "staging-explicit-single-reminder";
  runtime: string;
  projectBound: boolean;
  appTargetBound: boolean;
  supabaseTargetBound: boolean;
  productionSupported: false;
  errors: string[];
};
export function validateMobilePushDeliveryTrigger(
  value: unknown,
): MobilePushDeliveryTrigger;
export function validateEligibleMobilePushTarget(
  target: unknown,
  trigger: MobilePushDeliveryTrigger,
  options?: { now?: Date; expectedProjectId?: string },
): {
  workspaceId: string;
  userId: string;
  followupId: string;
  contactId: string;
  registrationId: string;
  projectId: string;
  platform: "android" | "ios";
  token: string;
  registrationTokenFingerprint: string;
  dueDate: string;
};
export function createMobilePushDeliveryIdempotencyKey(
  target: Record<string, string>,
): string;
export function buildMinimalFollowupPushPayload(target: {
  token: string;
  followupId: string;
  platform: "android" | "ios";
}): Record<string, unknown>;
export function mobilePushRetryDelayMs(attemptNumber: number): number;
export function mobilePushReceiptRetryDelayMs(
  receiptCheckNumber: number,
): number;
