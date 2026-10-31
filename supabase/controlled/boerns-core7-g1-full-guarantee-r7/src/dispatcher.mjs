import { claimKey, payloadDigest } from "./canonical.mjs";
import { ClaimError } from "./errors.mjs";
import { FencedGateway } from "./fenced_gateway.mjs";

const PASSIVE = new Set(["OBSERVED", "EXECUTION_CONFLICT"]);
const EXECUTABLE = new Set(["ACQUIRED", "RECOVERED"]);
const EXECUTION_IDENTITY_FIELDS = ["agentId", "agentVersion", "principalId", "runId"];

function hasCompleteExecutionIdentity(execution) {
  return execution !== null
    && typeof execution === "object"
    && EXECUTION_IDENTITY_FIELDS.every((field) => (
      Object.hasOwn(execution, field)
      && typeof execution[field] === "string"
      && execution[field].length > 0
    ));
}

export class ClaimAwareDispatcher {
  #store;
  #adapters;
  #leaseMs;

  constructor({ store, adapters = {}, leaseMs = 120_000 }) {
    this.#store = store;
    this.#adapters = Object.freeze({ ...adapters });
    this.#leaseMs = leaseMs;
  }

  async dispatch({ task, payload, execution }, work) {
    let acquired;
    let workStarted = false;
    try {
      if (!hasCompleteExecutionIdentity(execution)) {
        throw new TypeError("complete execution identity is required");
      }
      const binding = {
        claimKey: claimKey(task),
        payloadDigest: payloadDigest(payload),
        agentId: execution.agentId,
        agentVersion: execution.agentVersion,
        principalId: execution.principalId,
        runId: execution.runId,
      };
      acquired = await this.#store.acquire(binding, this.#leaseMs);

      if (acquired.operation === "REPLAYED") {
        return { status: "REPLAYED", workPerformed: 0, result: acquired.result };
      }
      if (acquired.operation === "PAYLOAD_CONFLICT") {
        return { status: "PAYLOAD_CONFLICT", workPerformed: 0 };
      }
      if (PASSIVE.has(acquired.operation)) {
        return { status: acquired.operation, workPerformed: 0 };
      }
      if (!EXECUTABLE.has(acquired.operation)) {
        return { status: "BLOCKED_CLAIM_STATUS_UNKNOWN", workPerformed: 0 };
      }

      const fenceBinding = {
        ...binding,
        epoch: acquired.epoch,
        fence: acquired.fence,
      };
      const gateway = new FencedGateway({
        store: this.#store,
        binding: fenceBinding,
        adapters: this.#adapters,
      });
      workStarted = true;
      const result = await work(Object.freeze({ gateway, execution: { ...execution } }));
      await this.#store.complete(fenceBinding, result);
      return { status: acquired.operation, workPerformed: 1, result };
    } catch (error) {
      return {
        status: error instanceof ClaimError ? error.code : "BLOCKED_CLAIM_STATUS_UNKNOWN",
        workPerformed: workStarted ? "UNKNOWN" : 0,
      };
    }
  }
}
