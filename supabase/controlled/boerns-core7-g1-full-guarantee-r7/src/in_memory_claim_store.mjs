import { randomUUID } from "node:crypto";
import {
  ClaimError,
  CLAIM_STATUS_UNKNOWN,
  IDEMPOTENCY_KEY_REUSE,
  STALE_FENCE,
} from "./errors.mjs";

const EXECUTION_FIELDS = [
  "claimKey",
  "payloadDigest",
  "agentId",
  "agentVersion",
  "principalId",
  "runId",
];

function sameExecution(left, right) {
  return EXECUTION_FIELDS.every((field) => left[field] === right[field]);
}

export class InMemoryClaimStore {
  #claims = new Map();
  #receipts = new Map();
  #locked = Promise.resolve();

  constructor({ now = () => Date.now(), epoch = randomUUID() } = {}) {
    this.now = now;
    this.epoch = epoch;
    this.available = true;
  }

  async #atomic(fn) {
    const previous = this.#locked;
    let release;
    this.#locked = new Promise((resolve) => { release = resolve; });
    await previous;
    try {
      if (!this.available) throw new ClaimError(CLAIM_STATUS_UNKNOWN);
      return await fn();
    } finally {
      release();
    }
  }

  async acquire(binding, leaseMs) {
    return this.#atomic(() => {
      const existing = this.#claims.get(binding.claimKey);
      if (!existing) {
        const claim = {
          ...binding,
          claimId: randomUUID(),
          epoch: this.epoch,
          fence: 1,
          leaseUntil: this.now() + leaseMs,
          status: "CLAIMED",
          result: null,
        };
        this.#claims.set(binding.claimKey, claim);
        return { operation: "ACQUIRED", ...structuredClone(claim) };
      }

      const samePayload = existing.payloadDigest === binding.payloadDigest;
      const identicalExecution = sameExecution(existing, binding);
      if (!samePayload) return { operation: "PAYLOAD_CONFLICT" };
      if (existing.status === "COMPLETED") {
        return identicalExecution
          ? { operation: "REPLAYED", result: structuredClone(existing.result) }
          : { operation: "EXECUTION_CONFLICT" };
      }
      if (existing.leaseUntil > this.now()) {
        return { operation: identicalExecution ? "OBSERVED" : "EXECUTION_CONFLICT" };
      }

      Object.assign(existing, binding, {
        fence: existing.fence + 1,
        leaseUntil: this.now() + leaseMs,
      });
      return { operation: "RECOVERED", ...structuredClone(existing) };
    });
  }

  async assertCurrentFence(binding) {
    return this.#atomic(() => {
      const claim = this.#claims.get(binding.claimKey);
      const current = claim
        && claim.status === "CLAIMED"
        && claim.leaseUntil > this.now()
        && claim.epoch === binding.epoch
        && claim.fence === binding.fence
        && sameExecution(claim, binding);
      if (!current) throw new ClaimError(STALE_FENCE);
      return true;
    });
  }

  async writeOnce(binding, effect, write) {
    return this.#atomic(async () => {
      const claim = this.#claims.get(binding.claimKey);
      const current = claim
        && claim.status === "CLAIMED"
        && claim.leaseUntil > this.now()
        && claim.epoch === binding.epoch
        && claim.fence === binding.fence
        && sameExecution(claim, binding);
      if (!current) throw new ClaimError(STALE_FENCE);

      let claimReceipts = this.#receipts.get(binding.claimKey);
      if (!claimReceipts) {
        claimReceipts = new Map();
        this.#receipts.set(binding.claimKey, claimReceipts);
      }
      let adapterReceipts = claimReceipts.get(effect.adapterName);
      if (!adapterReceipts) {
        adapterReceipts = new Map();
        claimReceipts.set(effect.adapterName, adapterReceipts);
      }
      const receipt = adapterReceipts.get(effect.sideEffectKey);
      if (receipt) {
        if (receipt.requestDigest !== effect.requestDigest) {
          throw new ClaimError(IDEMPOTENCY_KEY_REUSE);
        }
        return structuredClone(receipt.result);
      }
      const result = await write();
      adapterReceipts.set(effect.sideEffectKey, {
        requestDigest: effect.requestDigest,
        result: structuredClone(result),
      });
      return result;
    });
  }

  async complete(binding, result) {
    return this.#atomic(() => {
      const claim = this.#claims.get(binding.claimKey);
      const current = claim
        && claim.status === "CLAIMED"
        && claim.leaseUntil > this.now()
        && claim.epoch === binding.epoch
        && claim.fence === binding.fence
        && sameExecution(claim, binding);
      if (!current) throw new ClaimError(STALE_FENCE);
      claim.status = "COMPLETED";
      claim.result = structuredClone(result);
      return structuredClone(result);
    });
  }
}
