export const EXPO_PUSH_SEND_ENDPOINT: "https://exp.host/--/api/v2/push/send";
export const EXPO_PUSH_RECEIPTS_ENDPOINT: "https://exp.host/--/api/v2/push/getReceipts";
export const MOBILE_PUSH_PROVIDER_RESPONSE_MAX_BYTES: 16384;

export class MobilePushDeliveryError extends Error {
  readonly code: string;
  constructor(code: string);
}

export type MobilePushDeliveryResult = Readonly<{
  ok: boolean;
  status: string;
  code: string;
  retryable: boolean;
}>;

export type MobilePushDeliveryTargetBinding = Readonly<{
  supabaseUrl: string;
  supabaseProjectRef: string;
  serviceRoleKey: string;
}>;

export type MobilePushDeliveryLedger = {
  reserve(
    input: Record<string, unknown>,
    targetBinding: MobilePushDeliveryTargetBinding,
  ): Promise<unknown>;
  markTicket(input: Record<string, unknown>): Promise<unknown>;
  markRetry(input: Record<string, unknown>): Promise<unknown>;
  markIndeterminate(input: Record<string, unknown>): Promise<unknown>;
  markTerminal(input: Record<string, unknown>): Promise<unknown>;
  reserveReceiptCheck(input: Record<string, unknown>): Promise<unknown>;
  markReceiptAccepted(input: Record<string, unknown>): Promise<unknown>;
  markReceiptPending(input: Record<string, unknown>): Promise<unknown>;
  markDeviceNotRegistered(input: Record<string, unknown>): Promise<unknown>;
};

export function createMobilePushDeliveryService(
  dependencies: {
    reviewedProjectId: string;
    reviewedAppHostname: string;
    reviewedTargetSupabaseProjectRef: string;
    reviewedProductionSupabaseProjectRef: string;
    loadTarget(input: {
      workspaceId: string;
      userId: string;
      followupId: string;
      targetBinding: MobilePushDeliveryTargetBinding;
    }): Promise<unknown>;
    ledger: MobilePushDeliveryLedger;
    fetchImpl?: typeof fetch;
    now?: () => Date;
  },
  environment?: Record<string, unknown>,
): {
  deliver(input: unknown): Promise<MobilePushDeliveryResult>;
  checkReceipt(input: unknown): Promise<MobilePushDeliveryResult>;
};
