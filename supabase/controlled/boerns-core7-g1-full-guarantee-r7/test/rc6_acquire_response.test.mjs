import test from "node:test";
import assert from "node:assert/strict";
import { classifyRc6AcquireResponse } from "../src/rc6_acquire_response.mjs";

const base = Object.freeze({
  request_id: "11111111-1111-4111-8111-111111111111",
  claim_id: "22222222-2222-4222-8222-222222222222",
  claim_key: "TASK-1:STEP-1:7",
  operation_status: "ACQUIRED",
  state: "CLAIMED",
  holder_agent_id: "BT-006",
  lease_expires_at: "2026-10-31T14:35:00.000Z",
  fence_epoch: "33333333-3333-4333-8333-333333333333",
  fence_token: 42,
  replayed: false,
});

const cases = [
  ["fresh acquire is classified without authorizing work", {}, "VALID_FRESH_ACQUIRE"],
  [
    "fresh recovery is classified without authorizing work",
    { operation_status: "RECOVERED" },
    "VALID_FRESH_RECOVERY",
  ],
  [
    "acquire receipt replay fails closed",
    { replayed: true },
    "BLOCKED_CLAIM_STATUS_UNKNOWN",
  ],
  [
    "recovery receipt replay fails closed",
    { operation_status: "RECOVERED", replayed: true },
    "BLOCKED_CLAIM_STATUS_UNKNOWN",
  ],
  [
    "active claim is observed",
    { operation_status: "ALREADY_CLAIMED" },
    "VALID_PASSIVE_OBSERVATION",
  ],
  [
    "completed claim is not a G1 result replay",
    { operation_status: "ALREADY_COMPLETED", state: "COMPLETED", lease_expires_at: null },
    "BLOCKED_CLAIM_STATUS_UNKNOWN",
    "COMPLETED_CLAIM_HAS_NO_G1_RESULT_BINDING",
  ],
];

for (const [name, overrides, classification, reason] of cases) {
  test(name, () => {
    const response = { ...base, ...overrides };
    const result = classifyRc6AcquireResponse(response);
    assert.equal(result.classification, classification);
    assert.equal(result.workAuthorized, false);
    assert.equal("operation" in result, false);
    if (reason) assert.equal(result.reason, reason);
    assert.equal(result.rc6.operationStatus, overrides.operation_status ?? "ACQUIRED");
    assert.equal(result.rc6.replayed, overrides.replayed ?? false);
    assert.equal(result.rc6.state, overrides.state ?? "CLAIMED");
    assert.deepEqual(result.rc6.fencing, {
      leaseExpiresAt: response.lease_expires_at,
      epoch: base.fence_epoch,
      token: base.fence_token,
    });
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.rc6), true);
    assert.equal(Object.isFrozen(result.rc6.fencing), true);
    for (const forbidden of ["payloadDigest", "agentVersion", "principalId", "runId", "result"]) {
      assert.equal(forbidden in result, false);
      assert.equal(forbidden in result.rc6, false);
    }
  });
}

test("malformed and inconsistent responses fail closed without echoing fields", () => {
  const malformed = [
    null,
    {},
    { ...base, fence_token: 0 },
    { ...base, fence_epoch: "not-a-uuid" },
    { ...base, lease_expires_at: "1" },
    { ...base, lease_expires_at: null },
    { ...base, operation_status: "ALREADY_COMPLETED", state: "COMPLETED" },
    { ...base, operation_status: "ACQUIRED", state: "COMPLETED" },
  ];
  for (const response of malformed) {
    const result = classifyRc6AcquireResponse(response);
    assert.equal(result.classification, "BLOCKED_CLAIM_STATUS_UNKNOWN");
    assert.equal(result.workAuthorized, false);
    assert.equal("rc6" in result, false);
  }
});

test("unknown operation fails closed", () => {
  const result = classifyRc6AcquireResponse({ ...base, operation_status: "UNEXPECTED" });
  assert.deepEqual(result, {
    classification: "BLOCKED_CLAIM_STATUS_UNKNOWN",
    workAuthorized: false,
    reason: "UNKNOWN_OPERATION_STATUS",
  });
});
