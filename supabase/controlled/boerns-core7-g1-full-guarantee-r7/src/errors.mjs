export class ClaimError extends Error {
  constructor(code) {
    super(code);
    this.name = "ClaimError";
    this.code = code;
  }
}

export const STALE_FENCE = "STALE_FENCE";
export const CLAIM_STATUS_UNKNOWN = "CLAIM_STATUS_UNKNOWN";
export const IDEMPOTENCY_KEY_REUSE = "IDEMPOTENCY_KEY_REUSE";
