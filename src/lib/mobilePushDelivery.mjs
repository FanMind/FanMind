import {
  buildMinimalFollowupPushPayload,
  canonicalizeMobilePushDatabaseTimestamp,
  createMobilePushDeliveryIdempotencyKey,
  evaluateMobilePushDeliveryEnvironment,
  MOBILE_PUSH_ATOMIC_REVALIDATION_CONTRACT,
  MOBILE_PUSH_EXPO_ACCESS_TOKEN_ENV,
  MOBILE_PUSH_MAX_ATTEMPTS,
  MOBILE_PUSH_MAX_RECEIPT_CHECKS,
  MOBILE_PUSH_RECEIPT_CHECK_DELAY_MS,
  MOBILE_PUSH_RECEIPT_EXPIRY_MS,
  MOBILE_PUSH_REVALIDATION_MAX_CLOCK_SKEW_MS,
  MobilePushDeliveryPolicyError,
  mobilePushReceiptRetryDelayMs,
  mobilePushRetryDelayMs,
  validateEligibleMobilePushTarget,
  validateMobilePushDeliveryTargetBinding,
  validateMobilePushDeliveryTrigger,
} from "./mobilePushDeliveryPolicy.mjs";

export const EXPO_PUSH_SEND_ENDPOINT =
  "https://exp.host/--/api/v2/push/send";
export const EXPO_PUSH_RECEIPTS_ENDPOINT =
  "https://exp.host/--/api/v2/push/getReceipts";
export const MOBILE_PUSH_PROVIDER_RESPONSE_MAX_BYTES = 16_384;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RECEIPT_ID_PATTERN = /^[A-Za-z0-9_-]{1,256}$/u;
const TOKEN_FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/u;
const REQUIRED_LEDGER_METHODS = Object.freeze([
  "reserve",
  "markTicket",
  "markRetry",
  "markIndeterminate",
  "markTerminal",
  "reserveReceiptCheck",
  "markReceiptAccepted",
  "markReceiptPending",
  "markDeviceNotRegistered",
]);

export class MobilePushDeliveryError extends Error {
  constructor(code) {
    super(code);
    this.name = "MobilePushDeliveryError";
    this.code = code;
  }
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function fixedResult(status, code, retryable = false) {
  return Object.freeze({
    ok: status === "queued" || status === "accepted",
    status,
    code,
    retryable,
  });
}

function validDate(value) {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function assertDependencies(dependencies) {
  if (
    !dependencies ||
    typeof dependencies !== "object" ||
    typeof dependencies.loadTarget !== "function" ||
    !dependencies.ledger ||
    REQUIRED_LEDGER_METHODS.some(
      (method) => typeof dependencies.ledger[method] !== "function",
    )
  ) {
    throw new MobilePushDeliveryError("delivery_ledger_not_configured");
  }
}

function resolveFetch(dependencies, environment) {
  if (dependencies.fetchImpl !== undefined) {
    if (
      clean(environment.NODE_ENV).toLowerCase() !== "test" ||
      typeof dependencies.fetchImpl !== "function"
    ) {
      throw new MobilePushDeliveryError("provider_fetch_override_forbidden");
    }
    return dependencies.fetchImpl;
  }
  if (typeof globalThis.fetch !== "function") {
    throw new MobilePushDeliveryError("provider_unavailable");
  }
  return globalThis.fetch.bind(globalThis);
}

function runtimeConfig(environment, confirmation, dependencies) {
  const evaluation = evaluateMobilePushDeliveryEnvironment(environment, {
    confirmation,
    expectedProjectId: dependencies.reviewedProjectId,
    reviewedAppHostname: dependencies.reviewedAppHostname,
    reviewedTargetSupabaseProjectRef:
      dependencies.reviewedTargetSupabaseProjectRef,
    reviewedProductionSupabaseProjectRef:
      dependencies.reviewedProductionSupabaseProjectRef,
  });
  if (!evaluation.ok) {
    throw new MobilePushDeliveryError(evaluation.errors[0]);
  }
  const serviceRoleKey = clean(environment.SUPABASE_SERVICE_ROLE_KEY);
  if (!serviceRoleKey) {
    throw new MobilePushDeliveryError("service_role_not_configured");
  }
  let targetBinding;
  try {
    targetBinding = validateMobilePushDeliveryTargetBinding({
      supabaseUrl: environment.NEXT_PUBLIC_SUPABASE_URL,
      supabaseProjectRef: dependencies.reviewedTargetSupabaseProjectRef,
      serviceRoleKey,
    });
  } catch {
    throw new MobilePushDeliveryError("target_binding_invalid");
  }
  return {
    projectId: clean(environment.FANMIND_MOBILE_PUSH_EAS_PROJECT_ID).toLowerCase(),
    accessToken: clean(environment[MOBILE_PUSH_EXPO_ACCESS_TOKEN_ENV]),
    targetBinding,
  };
}

async function readBoundedJson(response) {
  if (!response?.body || typeof response.body.getReader !== "function") {
    throw new MobilePushDeliveryError("provider_response_invalid");
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) {
        throw new MobilePushDeliveryError("provider_response_invalid");
      }
      size += value.byteLength;
      if (size > MOBILE_PUSH_PROVIDER_RESPONSE_MAX_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new MobilePushDeliveryError("provider_response_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (size === 0) {
    throw new MobilePushDeliveryError("provider_response_invalid");
  }
  const payload = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    payload.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(payload));
  } catch {
    throw new MobilePushDeliveryError("provider_response_invalid");
  }
}

function ticketFromPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const data = Array.isArray(payload.data)
    ? payload.data.length === 1
      ? payload.data[0]
      : null
    : payload.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  if (data.status === "ok" && RECEIPT_ID_PATTERN.test(clean(data.id))) {
    return { status: "ok", receiptId: clean(data.id) };
  }
  if (data.status === "error") {
    return {
      status: "error",
      errorCode: clean(data.details?.error) || "ProviderRejected",
    };
  }
  return null;
}

function receiptFromPayload(payload, receiptId) {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    !payload.data ||
    typeof payload.data !== "object" ||
    Array.isArray(payload.data)
  ) {
    return null;
  }
  if (!Object.prototype.hasOwnProperty.call(payload.data, receiptId)) {
    return { status: "missing" };
  }
  const receipt = payload.data[receiptId];
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    return null;
  }
  if (receipt.status === "ok") return { status: "ok" };
  if (receipt.status === "error") {
    return {
      status: "error",
      errorCode: clean(receipt.details?.error) || "ProviderRejected",
    };
  }
  return null;
}

function providerHeaders(accessToken) {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

function retryAt(now, attemptNumber) {
  return new Date(now.getTime() + mobilePushRetryDelayMs(attemptNumber));
}

function receiptNextCheckAt(now, receiptCheckNumber) {
  return new Date(
    now.getTime() + mobilePushReceiptRetryDelayMs(receiptCheckNumber),
  );
}

function validateReservation(
  value,
  expectedTargetHash,
  expectedRegistrationTokenFingerprint,
  expectedSupabaseProjectRef,
  now,
) {
  if (value?.status === "duplicate" || value?.status === "inflight") {
    return { status: value.status };
  }
  const revalidatedAt = canonicalizeMobilePushDatabaseTimestamp(
    value?.revalidatedAt,
  );
  const revalidationAgeMs = revalidatedAt
    ? now.getTime() - Date.parse(revalidatedAt)
    : Number.NaN;
  if (
    value?.status !== "reserved" ||
    !UUID_PATTERN.test(clean(value.attemptId)) ||
    !Number.isInteger(value.attemptNumber) ||
    value.attemptNumber < 1 ||
    value.attemptNumber > MOBILE_PUSH_MAX_ATTEMPTS ||
    typeof value.leaseToken !== "string" ||
    value.leaseToken.length < 16 ||
    value.leaseToken.length > 256 ||
    value.revalidationContract !==
      MOBILE_PUSH_ATOMIC_REVALIDATION_CONTRACT ||
    clean(value.revalidatedTargetHash) !== expectedTargetHash ||
    !TOKEN_FINGERPRINT_PATTERN.test(expectedRegistrationTokenFingerprint) ||
    value.revalidatedRegistrationTokenFingerprint !==
      expectedRegistrationTokenFingerprint ||
    value.revalidatedSupabaseProjectRef !== expectedSupabaseProjectRef ||
    revalidatedAt !== value.revalidatedAt ||
    !Number.isFinite(revalidationAgeMs) ||
    Math.abs(revalidationAgeMs) > MOBILE_PUSH_REVALIDATION_MAX_CLOCK_SKEW_MS
  ) {
    throw new MobilePushDeliveryError("delivery_ledger_invalid");
  }
  return {
    status: "reserved",
    attemptId: clean(value.attemptId).toLowerCase(),
    attemptNumber: value.attemptNumber,
    leaseToken: value.leaseToken,
  };
}

function validateReceiptReservation(value, attemptId, projectId, now) {
  if (
    value?.status === "not_due" ||
    value?.status === "inflight" ||
    value?.status === "terminal"
  ) {
    return { status: value.status };
  }
  if (
    !value ||
    value.status !== "reserved" ||
    clean(value.attemptId).toLowerCase() !== attemptId ||
    !RECEIPT_ID_PATTERN.test(clean(value.receiptId)) ||
    clean(value.projectId).toLowerCase() !== projectId ||
    !UUID_PATTERN.test(clean(value.registrationId)) ||
    !Number.isInteger(value.attemptNumber) ||
    value.attemptNumber < 1 ||
    value.attemptNumber > MOBILE_PUSH_MAX_ATTEMPTS ||
    !Number.isInteger(value.receiptCheckNumber) ||
    value.receiptCheckNumber < 1 ||
    value.receiptCheckNumber > MOBILE_PUSH_MAX_RECEIPT_CHECKS ||
    typeof value.receiptLeaseToken !== "string" ||
    value.receiptLeaseToken.length < 16 ||
    value.receiptLeaseToken.length > 256
  ) {
    throw new MobilePushDeliveryError("receipt_attempt_invalid");
  }
  const canonicalTicketCreatedAt = canonicalizeMobilePushDatabaseTimestamp(
    value.ticketCreatedAt,
  );
  const ticketAgeMs = canonicalTicketCreatedAt
    ? now.getTime() - Date.parse(canonicalTicketCreatedAt)
    : Number.NaN;
  if (
    canonicalTicketCreatedAt !== value.ticketCreatedAt ||
    !Number.isFinite(ticketAgeMs) ||
    ticketAgeMs < 0
  ) {
    throw new MobilePushDeliveryError("receipt_attempt_invalid");
  }
  return {
    status: "reserved",
    attemptId,
    receiptId: clean(value.receiptId),
    registrationId: clean(value.registrationId).toLowerCase(),
    attemptNumber: value.attemptNumber,
    receiptCheckNumber: value.receiptCheckNumber,
    receiptLeaseToken: value.receiptLeaseToken,
    ticketCreatedAt: new Date(canonicalTicketCreatedAt),
    ticketAgeMs,
  };
}

async function safelyMarkIndeterminate(ledger, reservation) {
  try {
    await ledger.markIndeterminate({
      attemptId: reservation.attemptId,
      leaseToken: reservation.leaseToken,
      errorCode: "provider_result_indeterminate",
    });
    return true;
  } catch {
    return false;
  }
}

async function safelyRecordLedger(action) {
  try {
    await action();
    return true;
  } catch {
    return false;
  }
}

async function discardProviderBody(response) {
  if (response?.body && typeof response.body.cancel === "function") {
    await response.body.cancel().catch(() => undefined);
  }
}

async function recordReceiptLookupFailure(ledger, attempt, now, errorCode) {
  if (attempt.receiptCheckNumber >= MOBILE_PUSH_MAX_RECEIPT_CHECKS) {
    const recorded = await safelyRecordLedger(() =>
      ledger.markTerminal({
        attemptId: attempt.attemptId,
        receiptLeaseToken: attempt.receiptLeaseToken,
        errorCode: "receipt_lookup_exhausted",
      }),
    );
    return recorded
      ? fixedResult("rejected", "receipt_lookup_exhausted", false)
      : fixedResult("indeterminate", "ledger_state_indeterminate", false);
  }

  const recorded = await safelyRecordLedger(() =>
    ledger.markReceiptPending({
      attemptId: attempt.attemptId,
      receiptLeaseToken: attempt.receiptLeaseToken,
      errorCode,
      nextCheckAt: receiptNextCheckAt(
        now,
        attempt.receiptCheckNumber,
      ).toISOString(),
    }),
  );
  return recorded
    ? fixedResult("pending", "receipt_lookup_retry_scheduled", true)
    : fixedResult("indeterminate", "ledger_state_indeterminate", false);
}

export function createMobilePushDeliveryService(
  dependencies,
  environment = process.env,
) {
  assertDependencies(dependencies);
  const fetchImpl = resolveFetch(dependencies, environment);
  const nowProvider =
    typeof dependencies.now === "function" ? dependencies.now : () => new Date();

  async function deliver(rawTrigger) {
    const trigger = validateMobilePushDeliveryTrigger(rawTrigger);
    const config = runtimeConfig(
      environment,
      trigger.confirmation,
      dependencies,
    );
    const now = nowProvider();
    if (!validDate(now)) throw new MobilePushDeliveryError("clock_invalid");

    let loaded;
    try {
      loaded = await dependencies.loadTarget({
        workspaceId: trigger.workspaceId,
        userId: trigger.userId,
        followupId: trigger.followupId,
        targetBinding: config.targetBinding,
      });
    } catch {
      throw new MobilePushDeliveryError("target_unavailable");
    }
    const target = validateEligibleMobilePushTarget(loaded, trigger, {
      now,
      expectedProjectId: config.projectId,
    });
    const idempotencyKey = createMobilePushDeliveryIdempotencyKey(target);

    let reservation;
    try {
      reservation = validateReservation(
        await dependencies.ledger.reserve(
          {
            idempotencyKey,
            workspaceId: target.workspaceId,
            userId: target.userId,
            contactId: target.contactId,
            followupId: target.followupId,
            registrationId: target.registrationId,
            projectId: target.projectId,
            dueDate: target.dueDate,
            dueDateCutoff: trigger.dueDateCutoff,
            revalidationContract: MOBILE_PUSH_ATOMIC_REVALIDATION_CONTRACT,
            expectedTargetHash: idempotencyKey,
            expectedRegistrationTokenFingerprint:
              target.registrationTokenFingerprint,
            expectedSupabaseProjectRef: config.targetBinding.supabaseProjectRef,
            reservedAt: now.toISOString(),
          },
          config.targetBinding,
        ),
        idempotencyKey,
        target.registrationTokenFingerprint,
        config.targetBinding.supabaseProjectRef,
        now,
      );
    } catch (error) {
      if (error instanceof MobilePushDeliveryError) throw error;
      throw new MobilePushDeliveryError("delivery_ledger_unavailable");
    }
    if (reservation.status !== "reserved") {
      return fixedResult("duplicate", "delivery_already_reserved", false);
    }

    let providerResponse;
    try {
      providerResponse = await fetchImpl(EXPO_PUSH_SEND_ENDPOINT, {
        method: "POST",
        headers: providerHeaders(config.accessToken),
        body: JSON.stringify(buildMinimalFollowupPushPayload(target)),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      const ledgerRecorded = await safelyMarkIndeterminate(
        dependencies.ledger,
        reservation,
      );
      return fixedResult(
        "indeterminate",
        ledgerRecorded
          ? "provider_result_indeterminate"
          : "ledger_state_indeterminate",
        false,
      );
    }

    if (!providerResponse || typeof providerResponse.status !== "number") {
      const ledgerRecorded = await safelyMarkIndeterminate(
        dependencies.ledger,
        reservation,
      );
      return fixedResult(
        "indeterminate",
        ledgerRecorded
          ? "provider_result_indeterminate"
          : "ledger_state_indeterminate",
        false,
      );
    }
    if (!providerResponse.ok) {
      await discardProviderBody(providerResponse);
      const retryable =
        providerResponse.status === 429 || providerResponse.status >= 500;
      if (retryable && reservation.attemptNumber < MOBILE_PUSH_MAX_ATTEMPTS) {
        const recorded = await safelyRecordLedger(() =>
          dependencies.ledger.markRetry({
            attemptId: reservation.attemptId,
            leaseToken: reservation.leaseToken,
            errorCode: "provider_temporarily_unavailable",
            retryAt: retryAt(now, reservation.attemptNumber).toISOString(),
          }),
        );
        if (!recorded) {
          return fixedResult(
            "indeterminate",
            "ledger_state_indeterminate",
            false,
          );
        }
        return fixedResult("retry_scheduled", "provider_retry_scheduled", true);
      }
      const recorded = await safelyRecordLedger(() =>
        dependencies.ledger.markTerminal({
          attemptId: reservation.attemptId,
          leaseToken: reservation.leaseToken,
          errorCode: retryable
            ? "provider_retry_exhausted"
            : "provider_request_rejected",
        }),
      );
      if (!recorded) {
        return fixedResult(
          "indeterminate",
          "ledger_state_indeterminate",
          false,
        );
      }
      return fixedResult(
        "rejected",
        retryable ? "provider_retry_exhausted" : "provider_request_rejected",
        false,
      );
    }

    let ticket;
    try {
      ticket = ticketFromPayload(await readBoundedJson(providerResponse));
    } catch {
      ticket = null;
    }
    if (!ticket) {
      const ledgerRecorded = await safelyMarkIndeterminate(
        dependencies.ledger,
        reservation,
      );
      return fixedResult(
        "indeterminate",
        ledgerRecorded
          ? "provider_result_indeterminate"
          : "ledger_state_indeterminate",
        false,
      );
    }
    if (ticket.status === "error") {
      if (ticket.errorCode === "DeviceNotRegistered") {
        const recorded = await safelyRecordLedger(() =>
          dependencies.ledger.markDeviceNotRegistered({
            attemptId: reservation.attemptId,
            leaseToken: reservation.leaseToken,
            registrationId: target.registrationId,
            reason: "device_not_registered",
          }),
        );
        return recorded
          ? fixedResult("rejected", "device_not_registered", false)
          : fixedResult("indeterminate", "ledger_state_indeterminate", false);
      }
      if (
        ticket.errorCode === "MessageRateExceeded" &&
        reservation.attemptNumber < MOBILE_PUSH_MAX_ATTEMPTS
      ) {
        const recorded = await safelyRecordLedger(() =>
          dependencies.ledger.markRetry({
            attemptId: reservation.attemptId,
            leaseToken: reservation.leaseToken,
            errorCode: "provider_device_rate_exceeded",
            retryAt: retryAt(now, reservation.attemptNumber).toISOString(),
          }),
        );
        if (!recorded) {
          return fixedResult(
            "indeterminate",
            "ledger_state_indeterminate",
            false,
          );
        }
        return fixedResult("retry_scheduled", "provider_retry_scheduled", true);
      }
      const terminalRecorded = await safelyRecordLedger(() =>
        dependencies.ledger.markTerminal({
          attemptId: reservation.attemptId,
          leaseToken: reservation.leaseToken,
          errorCode: "provider_ticket_rejected",
        }),
      );
      if (!terminalRecorded) {
        return fixedResult(
          "indeterminate",
          "ledger_state_indeterminate",
          false,
        );
      }
      return fixedResult("rejected", "provider_ticket_rejected", false);
    }

    try {
      await dependencies.ledger.markTicket({
        attemptId: reservation.attemptId,
        leaseToken: reservation.leaseToken,
        receiptId: ticket.receiptId,
        ticketCreatedAt: now.toISOString(),
        checkAfter: new Date(
          now.getTime() + MOBILE_PUSH_RECEIPT_CHECK_DELAY_MS,
        ).toISOString(),
        expiresAt: new Date(
          now.getTime() + MOBILE_PUSH_RECEIPT_EXPIRY_MS,
        ).toISOString(),
      });
    } catch {
      const ledgerRecorded = await safelyMarkIndeterminate(
        dependencies.ledger,
        reservation,
      );
      return fixedResult(
        "indeterminate",
        ledgerRecorded
          ? "ticket_persistence_indeterminate"
          : "ledger_state_indeterminate",
        false,
      );
    }
    return fixedResult("queued", "push_ticket_recorded", false);
  }

  async function checkReceipt(rawInput) {
    if (
      !rawInput ||
      typeof rawInput !== "object" ||
      Array.isArray(rawInput) ||
      Object.keys(rawInput).sort().join(",") !== "attemptId,confirmation" ||
      !UUID_PATTERN.test(clean(rawInput.attemptId))
    ) {
      throw new MobilePushDeliveryError("receipt_request_invalid");
    }
    const attemptId = clean(rawInput.attemptId).toLowerCase();
    const config = runtimeConfig(
      environment,
      clean(rawInput.confirmation),
      dependencies,
    );
    const now = nowProvider();
    if (!validDate(now)) throw new MobilePushDeliveryError("clock_invalid");

    let rawReservation;
    try {
      rawReservation = await dependencies.ledger.reserveReceiptCheck({
        attemptId,
        requestedAt: now.toISOString(),
      });
    } catch {
      throw new MobilePushDeliveryError("delivery_ledger_unavailable");
    }
    const attempt = validateReceiptReservation(
      rawReservation,
      attemptId,
      config.projectId,
      now,
    );
    if (attempt.status === "not_due") {
      return fixedResult("pending", "receipt_check_not_due", true);
    }
    if (attempt.status !== "reserved") {
      return fixedResult("duplicate", "receipt_check_already_reserved", false);
    }
    const ageMs = attempt.ticketAgeMs;
    if (ageMs < MOBILE_PUSH_RECEIPT_CHECK_DELAY_MS) {
      throw new MobilePushDeliveryError("receipt_attempt_invalid");
    }
    if (ageMs >= MOBILE_PUSH_RECEIPT_EXPIRY_MS) {
      const recorded = await safelyRecordLedger(() =>
        dependencies.ledger.markTerminal({
          attemptId,
          receiptLeaseToken: attempt.receiptLeaseToken,
          errorCode: "receipt_expired",
        }),
      );
      if (!recorded) {
        return fixedResult(
          "indeterminate",
          "ledger_state_indeterminate",
          false,
        );
      }
      return fixedResult("rejected", "receipt_expired", false);
    }

    let providerResponse;
    try {
      providerResponse = await fetchImpl(EXPO_PUSH_RECEIPTS_ENDPOINT, {
        method: "POST",
        headers: providerHeaders(config.accessToken),
        body: JSON.stringify({ ids: [attempt.receiptId] }),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return recordReceiptLookupFailure(
        dependencies.ledger,
        attempt,
        now,
        "receipt_lookup_unavailable",
      );
    }
    if (
      !providerResponse?.ok ||
      typeof providerResponse.status !== "number"
    ) {
      await discardProviderBody(providerResponse);
      const retryable =
        typeof providerResponse?.status !== "number" ||
        providerResponse.status === 429 ||
        providerResponse.status >= 500;
      if (retryable) {
        return recordReceiptLookupFailure(
          dependencies.ledger,
          attempt,
          now,
          "receipt_lookup_unavailable",
        );
      }
      const recorded = await safelyRecordLedger(() =>
        dependencies.ledger.markTerminal({
          attemptId,
          receiptLeaseToken: attempt.receiptLeaseToken,
          errorCode: "receipt_request_rejected",
        }),
      );
      if (!recorded) {
        return fixedResult(
          "indeterminate",
          "ledger_state_indeterminate",
          false,
        );
      }
      return fixedResult("rejected", "receipt_request_rejected", false);
    }

    let receipt;
    try {
      receipt = receiptFromPayload(
        await readBoundedJson(providerResponse),
        attempt.receiptId,
      );
    } catch {
      receipt = null;
    }
    if (!receipt || receipt.status === "missing") {
      return recordReceiptLookupFailure(
        dependencies.ledger,
        attempt,
        now,
        receipt ? "receipt_not_ready" : "receipt_response_invalid",
      );
    }
    if (receipt.status === "ok") {
      const recorded = await safelyRecordLedger(() =>
        dependencies.ledger.markReceiptAccepted({
          attemptId,
          receiptLeaseToken: attempt.receiptLeaseToken,
          acceptedAt: now.toISOString(),
        }),
      );
      if (!recorded) {
        return fixedResult(
          "indeterminate",
          "ledger_state_indeterminate",
          false,
        );
      }
      return fixedResult("accepted", "provider_receipt_ok", false);
    }

    if (receipt.errorCode === "DeviceNotRegistered") {
      const recorded = await safelyRecordLedger(() =>
        dependencies.ledger.markDeviceNotRegistered({
          attemptId,
          receiptLeaseToken: attempt.receiptLeaseToken,
          registrationId: attempt.registrationId,
          reason: "device_not_registered",
        }),
      );
      return recorded
        ? fixedResult("rejected", "device_not_registered", false)
        : fixedResult("indeterminate", "ledger_state_indeterminate", false);
    }
    if (
      receipt.errorCode === "MessageRateExceeded" &&
      attempt.attemptNumber < MOBILE_PUSH_MAX_ATTEMPTS
    ) {
      const recorded = await safelyRecordLedger(() =>
        dependencies.ledger.markRetry({
          attemptId,
          receiptLeaseToken: attempt.receiptLeaseToken,
          errorCode: "provider_device_rate_exceeded",
          retryAt: retryAt(now, attempt.attemptNumber).toISOString(),
        }),
      );
      if (!recorded) {
        return fixedResult(
          "indeterminate",
          "ledger_state_indeterminate",
          false,
        );
      }
      return fixedResult("retry_scheduled", "provider_retry_scheduled", true);
    }
    const terminalRecorded = await safelyRecordLedger(() =>
      dependencies.ledger.markTerminal({
        attemptId,
        receiptLeaseToken: attempt.receiptLeaseToken,
        errorCode: "provider_receipt_rejected",
      }),
    );
    if (!terminalRecorded) {
      return fixedResult(
        "indeterminate",
        "ledger_state_indeterminate",
        false,
      );
    }
    return fixedResult("rejected", "provider_receipt_rejected", false);
  }

  return Object.freeze({ deliver, checkReceipt });
}

export { MobilePushDeliveryPolicyError };
