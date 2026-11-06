import {
  claimWhatsAppCloudInboundMessage,
  createMetaWebhookDebugEvent,
  findWhatsAppCloudConnectionByPhoneNumberId,
  storeWhatsAppCloudInboundMessage,
  type SocialConnectionRow,
} from "@/lib/supabase/server";
import {
  buildWhatsAppCloudDiagnostic,
  parseWhatsAppCloudInboundPayload,
  type WhatsAppCloudInboundEvent,
} from "@/lib/whatsappCloudInboundPolicy.mjs";

export type WhatsAppWebhookEvent = WhatsAppCloudInboundEvent;

export type WhatsAppCloudWebhookProcessResult = {
  received: true;
  saved: boolean;
  skipped: boolean;
  eventCount: number;
  savedCount: number;
  duplicateCount: number;
  unsupportedCount: number;
  errorCode?:
    | "schema_not_ready"
    | "connection_lookup_failed"
    | "connection_ambiguous"
    | "idempotency_claim_failed"
    | "idempotency_conflict"
    | "idempotency_in_progress"
    | "idempotency_exhausted"
    | "stale_lease"
    | "message_persist_failed"
    | "diagnostic_persist_failed";
};

export function extractWhatsAppWebhookEvents(
  payload: unknown,
): WhatsAppWebhookEvent[] {
  const parsed = parseWhatsAppCloudInboundPayload(payload);
  return parsed.ok ? [...parsed.events] : [];
}

export async function processWhatsAppCloudInboundEvents(input: {
  events: readonly WhatsAppCloudInboundEvent[];
  duplicateCount?: number;
  unsupportedCount?: number;
}): Promise<WhatsAppCloudWebhookProcessResult> {
  let savedCount = 0;
  let duplicateCount = input.duplicateCount ?? 0;
  let skippedCount = input.unsupportedCount ?? 0;
  let firstErrorCode: WhatsAppCloudWebhookProcessResult["errorCode"];

  if ((input.unsupportedCount ?? 0) > 0) {
    const diagnostic = await recordWhatsAppCloudDiagnostic({
      connection: null,
      eventCount: 0,
      savedCount: 0,
      duplicateCount: 0,
      unsupportedCount: input.unsupportedCount ?? 0,
      status: "ignored_unsupported",
      errorReason: null,
      schemaReady: true,
    });
    if (!diagnostic) firstErrorCode ??= "diagnostic_persist_failed";
  }

  const groups = groupEventsByPhoneNumberId(input.events);
  for (const group of groups) {
    const lookup = await findWhatsAppCloudConnectionByPhoneNumberId(
      group.phoneNumberId,
    );

    if (lookup.lookupStatus === "schema_not_ready") {
      firstErrorCode ??= "schema_not_ready";
      skippedCount += group.events.length;
      await recordWhatsAppCloudDiagnostic({
        connection: null,
        eventCount: group.events.length,
        savedCount: 0,
        duplicateCount: 0,
        unsupportedCount: 0,
        status: "schema_not_ready",
        errorReason: "schema_not_ready",
        schemaReady: false,
      });
      continue;
    }

    if (lookup.lookupStatus === "ambiguous") {
      firstErrorCode ??= "connection_ambiguous";
      skippedCount += group.events.length;
      const diagnostic = await recordWhatsAppCloudDiagnostic({
        connection: null,
        eventCount: group.events.length,
        savedCount: 0,
        duplicateCount: 0,
        unsupportedCount: 0,
        status: "connection_ambiguous",
        errorReason: "connection_ambiguous",
        schemaReady: true,
      });
      if (!diagnostic) firstErrorCode ??= "diagnostic_persist_failed";
      continue;
    }

    if (lookup.lookupStatus === "lookup_failed" || lookup.error) {
      firstErrorCode ??= "connection_lookup_failed";
      skippedCount += group.events.length;
      const diagnostic = await recordWhatsAppCloudDiagnostic({
        connection: null,
        eventCount: group.events.length,
        savedCount: 0,
        duplicateCount: 0,
        unsupportedCount: 0,
        status: "connection_lookup_failed",
        errorReason: "connection_lookup_failed",
        schemaReady: lookup.schemaReady,
      });
      if (!diagnostic) firstErrorCode ??= "diagnostic_persist_failed";
      continue;
    }

    if (lookup.lookupStatus === "unmapped") {
      skippedCount += group.events.length;
      const diagnostic = await recordWhatsAppCloudDiagnostic({
        connection: null,
        eventCount: group.events.length,
        savedCount: 0,
        duplicateCount: 0,
        unsupportedCount: 0,
        status: "ignored_unmapped_phone",
        errorReason: "unmapped_phone_number",
        schemaReady: true,
      });
      if (!diagnostic) firstErrorCode ??= "diagnostic_persist_failed";
      continue;
    }

    if (lookup.lookupStatus === "processing_blocked") {
      skippedCount += group.events.length;
      const diagnostic = await recordWhatsAppCloudDiagnostic({
        connection: lookup.connection,
        eventCount: group.events.length,
        savedCount: 0,
        duplicateCount: 0,
        unsupportedCount: 0,
        status: "processing_blocked",
        errorReason: "processing_blocked",
        processingBlocked: true,
        schemaReady: true,
      });
      if (!diagnostic) firstErrorCode ??= "diagnostic_persist_failed";
      continue;
    }

    const connection = lookup.connection;
    if (!connection) {
      firstErrorCode ??= "connection_lookup_failed";
      skippedCount += group.events.length;
      continue;
    }

    let groupSaved = 0;
    let groupDuplicates = 0;
    let groupProcessingBlocked = false;
    let groupConnectionUnavailable = false;
    let groupErrorCode: WhatsAppCloudWebhookProcessResult["errorCode"];
    for (const event of group.events) {
      const claim = await claimWhatsAppCloudInboundMessage({
        workspaceId: connection.workspace_id,
        socialConnectionId: connection.id,
        phoneNumberId: event.phoneNumberId,
        externalMessageId: event.externalMessageId,
        payloadFingerprint: event.payloadFingerprint,
      });

      if (claim.outcome === "duplicate" || claim.outcome === "cancelled") {
        duplicateCount += 1;
        groupDuplicates += 1;
        skippedCount += 1;
        continue;
      }
      if (claim.outcome === "in_progress") {
        firstErrorCode ??= "idempotency_in_progress";
        groupErrorCode ??= "idempotency_in_progress";
        skippedCount += 1;
        continue;
      }
      if (claim.outcome === "exhausted") {
        firstErrorCode ??= "idempotency_exhausted";
        groupErrorCode ??= "idempotency_exhausted";
        skippedCount += 1;
        continue;
      }
      if (claim.outcome === "conflict") {
        firstErrorCode ??= "idempotency_conflict";
        groupErrorCode ??= "idempotency_conflict";
        skippedCount += 1;
        continue;
      }
      if (
        claim.outcome !== "claimed" ||
        !claim.receiptId ||
        !claim.leaseToken ||
        claim.error
      ) {
        firstErrorCode ??= "idempotency_claim_failed";
        groupErrorCode ??= "idempotency_claim_failed";
        skippedCount += 1;
        continue;
      }

      const stored = await storeWhatsAppCloudInboundMessage({
        workspaceId: connection.workspace_id,
        socialConnectionId: connection.id,
        receiptId: claim.receiptId,
        leaseToken: claim.leaseToken,
        phoneNumberId: event.phoneNumberId,
        senderId: event.senderId,
        externalMessageId: event.externalMessageId,
        externalThreadId: event.externalThreadId,
        authorLabel: event.authorLabel,
        content: event.content,
        receivedAt: event.receivedAt,
        payloadFingerprint: event.payloadFingerprint,
      });

      if (stored.outcome === "stored") {
        savedCount += 1;
        groupSaved += 1;
      } else if (stored.outcome === "duplicate") {
        duplicateCount += 1;
        groupDuplicates += 1;
        skippedCount += 1;
      } else if (stored.outcome === "conflict") {
        firstErrorCode ??= "idempotency_conflict";
        groupErrorCode ??= "idempotency_conflict";
        skippedCount += 1;
      } else if (
        stored.outcome === "processing_blocked" ||
        stored.outcome === "connection_unavailable"
      ) {
        groupProcessingBlocked ||= stored.outcome === "processing_blocked";
        groupConnectionUnavailable ||=
          stored.outcome === "connection_unavailable";
        skippedCount += 1;
      } else if (stored.outcome === "stale_lease") {
        firstErrorCode ??= "stale_lease";
        groupErrorCode ??= "stale_lease";
        skippedCount += 1;
      } else {
        firstErrorCode ??= "message_persist_failed";
        groupErrorCode ??= "message_persist_failed";
        skippedCount += 1;
      }
    }

    const groupStatus = groupErrorCode
      ? "processing_failed"
      : groupProcessingBlocked
        ? "processing_blocked"
        : groupConnectionUnavailable
          ? "connection_unavailable"
          : "processed";
    const groupDiagnosticReason =
      groupErrorCode ??
      (groupProcessingBlocked
        ? "processing_blocked"
        : groupConnectionUnavailable
          ? "connection_unavailable"
          : null);
    const diagnostic = await recordWhatsAppCloudDiagnostic({
      connection,
      eventCount: group.events.length,
      savedCount: groupSaved,
      duplicateCount: groupDuplicates,
      unsupportedCount: 0,
      status: groupStatus,
      errorReason: groupDiagnosticReason,
      processingBlocked: groupProcessingBlocked,
      schemaReady: true,
    });
    if (!diagnostic) firstErrorCode ??= "diagnostic_persist_failed";
  }

  return {
    received: true,
    saved: savedCount > 0,
    skipped: skippedCount > 0 || duplicateCount > 0,
    eventCount: input.events.length,
    savedCount,
    duplicateCount,
    unsupportedCount: input.unsupportedCount ?? 0,
    ...(firstErrorCode ? { errorCode: firstErrorCode } : {}),
  };
}

export async function processWhatsAppWebhookPayload(
  payload: unknown,
): Promise<
  | WhatsAppCloudWebhookProcessResult
  | { received: false; errorCode: "invalid_payload" }
> {
  const parsed = parseWhatsAppCloudInboundPayload(payload);
  if (!parsed.ok) return { received: false, errorCode: "invalid_payload" };
  return processWhatsAppCloudInboundEvents({
    events: parsed.events,
    duplicateCount: parsed.duplicateCount,
    unsupportedCount: parsed.unsupportedCount,
  });
}

function groupEventsByPhoneNumberId(
  events: readonly WhatsAppCloudInboundEvent[],
): Array<{ phoneNumberId: string; events: WhatsAppCloudInboundEvent[] }> {
  const groups = new Map<string, WhatsAppCloudInboundEvent[]>();
  for (const event of events) {
    const group = groups.get(event.phoneNumberId) ?? [];
    group.push(event);
    groups.set(event.phoneNumberId, group);
  }
  return [...groups].map(([phoneNumberId, groupedEvents]) => ({
    phoneNumberId,
    events: groupedEvents,
  }));
}

async function recordWhatsAppCloudDiagnostic(input: {
  connection: SocialConnectionRow | null;
  eventCount: number;
  savedCount: number;
  duplicateCount: number;
  unsupportedCount: number;
  status: string;
  errorReason: string | null;
  processingBlocked?: boolean;
  schemaReady: boolean;
}): Promise<boolean> {
  const result = await createMetaWebhookDebugEvent({
    workspaceId: input.connection?.workspace_id ?? null,
    socialConnectionId: input.connection?.id ?? null,
    platform: "whatsapp",
    eventType: "messages",
    rawPayload: buildWhatsAppCloudDiagnostic(input),
    status: input.status,
    errorReason: input.errorReason,
  });
  return !result.error;
}
