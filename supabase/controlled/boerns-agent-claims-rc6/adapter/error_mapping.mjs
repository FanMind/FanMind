const SQLSTATE_MAP = new Map([
  ["BC001", [400, "INVALID_REQUEST"]],
  ["BC002", [401, "INVALID_IDENTITY"]],
  ["BC003", [404, "CLAIM_NOT_FOUND"]],
  ["BC004", [409, "IDEMPOTENCY_KEY_REUSE"]],
  ["BC005", [412, "STALE_FENCE"]],
  ["BC006", [503, "CLAIM_STATUS_UNKNOWN"]],
  ["BC007", [409, "CLAIM_CONFLICT"]],
  ["BC008", [403, "FORBIDDEN"]],
]);

const UNKNOWN = Object.freeze({
  status: 503,
  body: Object.freeze({ code: "CLAIM_STATUS_UNKNOWN" }),
});

export function mapDatabaseError(error) {
  const mapped = SQLSTATE_MAP.get(error?.code);
  if (!mapped) return UNKNOWN;
  return Object.freeze({
    status: mapped[0],
    body: Object.freeze({ code: mapped[1] }),
  });
}

export function mapTransportError() {
  return UNKNOWN;
}
