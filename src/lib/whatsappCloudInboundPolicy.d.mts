export const WHATSAPP_CLOUD_MAX_BODY_BYTES: number;
export const WHATSAPP_CLOUD_MAX_ENTRIES: number;
export const WHATSAPP_CLOUD_MAX_CHANGES_PER_ENTRY: number;
export const WHATSAPP_CLOUD_MAX_MESSAGES: number;
export const WHATSAPP_CLOUD_MAX_CONTACTS_PER_CHANGE: number;
export const WHATSAPP_CLOUD_MAX_DISTINCT_PHONE_NUMBER_IDS: number;
export const WHATSAPP_CLOUD_MAX_TEXT_LENGTH: number;

export type WhatsAppCloudInboundRuntimeDecision = {
  enabled: boolean;
  reason:
    | "production_forbidden"
    | "runtime_unknown"
    | "feature_disabled"
    | "enabled_non_production";
};

export type WhatsAppCloudInboundEvent = {
  readonly sourcePlatform: "whatsapp";
  readonly sourceType: "whatsapp_messages";
  readonly messageType: "dm";
  readonly messageKind: "text";
  readonly direction: "inbound";
  readonly content: string;
  readonly externalMessageId: string;
  readonly externalThreadId: string;
  readonly authorLabel: string;
  readonly phoneNumberId: string;
  readonly senderId: string;
  readonly receivedAt: string;
  readonly payloadFingerprint: string;
};

export type WhatsAppCloudParseResult =
  | {
      readonly ok: true;
      readonly errorCode: null;
      readonly events: readonly WhatsAppCloudInboundEvent[];
      readonly duplicateCount: number;
      readonly unsupportedCount: number;
    }
  | {
      readonly ok: false;
      readonly errorCode: "invalid_payload";
      readonly reason: string;
      readonly events: readonly [];
      readonly duplicateCount: 0;
      readonly unsupportedCount: 0;
    };

export function evaluateWhatsAppCloudInboundRuntime(
  environment?: Record<string, string | undefined>,
): WhatsAppCloudInboundRuntimeDecision;

export function validateWhatsAppCloudVerifyToken(input: {
  configuredToken?: string | null;
  receivedToken?: string | null;
}): {
  ok: boolean;
  errorCode:
    | null
    | "verify_token_not_configured"
    | "invalid_verify_token";
};

export function validateWhatsAppCloudSignature(input: {
  rawBody: Buffer;
  signatureHeader?: string | null;
  configuredAppSecret?: string | null;
}): {
  ok: boolean;
  errorCode:
    | null
    | "app_secret_not_configured"
    | "invalid_signature";
};

export function readBoundedWhatsAppCloudBody(
  request: Request,
  maximumBytes?: number,
): Promise<
  | { ok: true; errorCode: null; body: Buffer }
  | {
      ok: false;
      errorCode:
        | "invalid_content_length"
        | "payload_too_large"
        | "invalid_body";
      body: null;
    }
>;

export function parseWhatsAppCloudInboundPayload(
  payload: unknown,
  options?: { now?: number | Date },
): WhatsAppCloudParseResult;

export function fingerprintWhatsAppCloudInboundEvent(
  event: Omit<WhatsAppCloudInboundEvent, "payloadFingerprint">,
): string;

export function buildWhatsAppCloudDiagnostic(input?: {
  eventCount?: number;
  savedCount?: number;
  duplicateCount?: number;
  unsupportedCount?: number;
  processingBlocked?: boolean;
  schemaReady?: boolean;
}): Readonly<{
  schema_version: 1;
  connector_whatsapp_cloud: true;
  event_count: number;
  saved_count: number;
  duplicate_count: number;
  unsupported_count: number;
  processing_blocked: boolean;
  schema_ready: boolean;
}>;
