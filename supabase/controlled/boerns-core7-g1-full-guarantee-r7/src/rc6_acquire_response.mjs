const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLAIM_KEY = /^[A-Za-z0-9._-]{1,128}:[A-Za-z0-9._-]{1,128}:[0-9]+$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const ACQUIRE_STATUSES = new Set([
  "ACQUIRED",
  "RECOVERED",
  "ALREADY_CLAIMED",
  "ALREADY_COMPLETED",
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isTimestamp(value) {
  return typeof value === "string"
    && TIMESTAMP.test(value)
    && Number.isFinite(Date.parse(value));
}

function blocked(reason, rc6) {
  const result = {
    classification: "BLOCKED_CLAIM_STATUS_UNKNOWN",
    workAuthorized: false,
    reason,
  };
  if (rc6) result.rc6 = rc6;
  return Object.freeze(result);
}

function validate(response) {
  if (!isRecord(response)) return "MALFORMED_RC6_RESPONSE";
  if (typeof response.operation_status === "string"
      && !ACQUIRE_STATUSES.has(response.operation_status)) {
    return "UNKNOWN_OPERATION_STATUS";
  }
  const valid = UUID.test(response.request_id)
    && UUID.test(response.claim_id)
    && CLAIM_KEY.test(response.claim_key)
    && ACQUIRE_STATUSES.has(response.operation_status)
    && ["CLAIMED", "COMPLETED"].includes(response.state)
    && typeof response.holder_agent_id === "string"
    && response.holder_agent_id.length > 0
    && UUID.test(response.fence_epoch)
    && Number.isSafeInteger(response.fence_token)
    && response.fence_token > 0
    && typeof response.replayed === "boolean";
  if (!valid) return "MALFORMED_RC6_RESPONSE";
  const expectedState = response.operation_status === "ALREADY_COMPLETED"
    ? "COMPLETED"
    : "CLAIMED";
  if (response.state !== expectedState) return "INCONSISTENT_RC6_RESPONSE";
  const validLease = expectedState === "COMPLETED"
    ? response.lease_expires_at === null
    : isTimestamp(response.lease_expires_at);
  return validLease ? null : "MALFORMED_RC6_RESPONSE";
}

function preserveRc6(response) {
  return Object.freeze({
    requestId: response.request_id,
    claimId: response.claim_id,
    claimKey: response.claim_key,
    operationStatus: response.operation_status,
    replayed: response.replayed,
    state: response.state,
    holderAgentId: response.holder_agent_id,
    fencing: Object.freeze({
      leaseExpiresAt: response.lease_expires_at,
      epoch: response.fence_epoch,
      token: response.fence_token,
    }),
  });
}

export function classifyRc6AcquireResponse(response) {
  const validationFailure = validate(response);
  if (validationFailure) return blocked(validationFailure);

  const rc6 = preserveRc6(response);
  if (response.replayed && ["ACQUIRED", "RECOVERED"].includes(response.operation_status)) {
    return blocked("REPLAYED_ACQUIRE_HAS_NO_NEW_WORK_AUTHORIZATION", rc6);
  }
  if (response.operation_status === "ALREADY_COMPLETED") {
    return blocked("COMPLETED_CLAIM_HAS_NO_G1_RESULT_BINDING", rc6);
  }
  if (response.operation_status === "ALREADY_CLAIMED") {
    return Object.freeze({
      classification: "VALID_PASSIVE_OBSERVATION",
      workAuthorized: false,
      rc6,
    });
  }
  return Object.freeze({
    classification: response.operation_status === "ACQUIRED"
      ? "VALID_FRESH_ACQUIRE"
      : "VALID_FRESH_RECOVERY",
    workAuthorized: false,
    rc6,
  });
}
