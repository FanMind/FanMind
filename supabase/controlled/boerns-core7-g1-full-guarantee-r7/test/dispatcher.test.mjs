import test from "node:test";
import assert from "node:assert/strict";
import { claimKey } from "../src/canonical.mjs";
import { ClaimAwareDispatcher } from "../src/dispatcher.mjs";
import { InMemoryClaimStore } from "../src/in_memory_claim_store.mjs";

const task = { taskId: "TASK-1", stepId: "STEP-1", revision: "7" };
const execution = {
  agentId: "BT-006",
  agentVersion: "published-v1",
  principalId: "principal-1",
  runId: "run-1",
};

test("parallel delivery performs work exactly once", async () => {
  const store = new InMemoryClaimStore();
  let executions = 0;
  const dispatcher = new ClaimAwareDispatcher({ store });
  const work = async () => ({ value: ++executions });

  const results = await Promise.all(
    Array.from({ length: 8 }, () => dispatcher.dispatch({ task, payload: { a: 1 }, execution }, work)),
  );
  assert.equal(executions, 1);
  assert.equal(results.filter((result) => result.workPerformed === 1).length, 1);
  assert.equal(
    results.filter((result) => ["OBSERVED", "REPLAYED"].includes(result.status)).length,
    7,
  );
});

test("completed retry replays result and changed payload conflicts", async () => {
  const store = new InMemoryClaimStore();
  const dispatcher = new ClaimAwareDispatcher({ store });
  const first = await dispatcher.dispatch(
    { task, payload: { a: 1, b: 2 }, execution },
    async () => ({ ok: true }),
  );
  const replay = await dispatcher.dispatch(
    { task, payload: { b: 2, a: 1 }, execution },
    async () => assert.fail("retry must not execute"),
  );
  const conflict = await dispatcher.dispatch(
    { task, payload: { a: 2 }, execution },
    async () => assert.fail("conflict must not execute"),
  );
  assert.equal(first.status, "ACQUIRED");
  assert.deepEqual(replay, { status: "REPLAYED", workPerformed: 0, result: { ok: true } });
  assert.deepEqual(conflict, { status: "PAYLOAD_CONFLICT", workPerformed: 0 });
});

test("an active claim rejects a competing run binding", async () => {
  const store = new InMemoryClaimStore();
  const dispatcher = new ClaimAwareDispatcher({ store });
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  const first = dispatcher.dispatch({ task, payload: {}, execution }, async () => {
    await held;
    return { ok: true };
  });
  await new Promise((resolve) => setImmediate(resolve));
  const competing = await dispatcher.dispatch(
    { task, payload: {}, execution: { ...execution, runId: "run-2" } },
    async () => assert.fail("competing run must not execute"),
  );
  release();
  await first;
  assert.deepEqual(competing, { status: "EXECUTION_CONFLICT", workPerformed: 0 });
});

test("expired holder is fenced off after recovery", async () => {
  let now = 1_000;
  const store = new InMemoryClaimStore({ now: () => now, epoch: "epoch-1" });
  const binding = {
    claimKey: "TASK-1:STEP-1:7",
    payloadDigest: "digest",
    agentId: "BT-006",
    agentVersion: "published-v1",
    principalId: "principal-1",
    runId: "run-old",
  };
  const old = await store.acquire(binding, 10);
  now += 11;
  const recovered = await store.acquire({ ...binding, runId: "run-new" }, 10);
  assert.equal(recovered.operation, "RECOVERED");
  assert.ok(recovered.fence > old.fence);
  await assert.rejects(
    store.writeOnce({ ...binding, epoch: old.epoch, fence: old.fence }, "slack:1", async () => true),
    { code: "STALE_FENCE" },
  );
});

test("side effects require a live fence and are idempotent", async () => {
  const store = new InMemoryClaimStore();
  let writes = 0;
  const dispatcher = new ClaimAwareDispatcher({
    store,
    adapters: {
      synthetic: {
        writeFenced: async (request) => ({ ...request, write: ++writes }),
      },
    },
  });
  const result = await dispatcher.dispatch({ task, payload: {}, execution }, async ({ gateway }) => {
    const first = await gateway.write("synthetic", "effect-1", { ok: true });
    const replay = await gateway.write("synthetic", "effect-1", { ok: true });
    return { first, replay };
  });
  assert.equal(writes, 1);
  assert.deepEqual(result.result.first, result.result.replay);
});

test("unknown store state fails closed before work", async () => {
  const store = new InMemoryClaimStore();
  store.available = false;
  let executions = 0;
  const result = await new ClaimAwareDispatcher({ store }).dispatch(
    { task, payload: {}, execution },
    async () => { executions += 1; },
  );
  assert.equal(executions, 0);
  assert.deepEqual(result, { status: "CLAIM_STATUS_UNKNOWN", workPerformed: 0 });
});

test("required task and execution fields fail closed before acquire or work", async () => {
  let acquireCalls = 0;
  let workCalls = 0;
  const store = {
    acquire: async () => {
      acquireCalls += 1;
      return { operation: "ACQUIRED" };
    },
  };
  const dispatcher = new ClaimAwareDispatcher({ store });
  const expected = { status: "BLOCKED_CLAIM_STATUS_UNKNOWN", workPerformed: 0 };
  const work = async () => {
    workCalls += 1;
  };

  const invalidExecutions = [{}];
  for (const field of ["agentId", "agentVersion", "principalId", "runId"]) {
    const missing = { ...execution };
    delete missing[field];
    invalidExecutions.push(
      missing,
      { ...execution, [field]: null },
      { ...execution, [field]: "" },
      { ...execution, [field]: 7 },
    );
  }
  for (const invalidExecution of invalidExecutions) {
    const result = await dispatcher.dispatch(
      { task, payload: {}, execution: invalidExecution },
      work,
    );
    assert.deepEqual(result, expected);
  }

  for (const field of ["taskId", "stepId", "revision"]) {
    const missing = { ...task };
    delete missing[field];
    for (const invalidTask of [missing, { ...task, [field]: null }]) {
      const result = await dispatcher.dispatch(
        { task: invalidTask, payload: {}, execution },
        work,
      );
      assert.deepEqual(result, expected);
    }
  }

  assert.equal(claimKey({ ...task, revision: 7 }), "TASK-1:STEP-1:7");
  assert.equal(claimKey({ ...task, revision: "7" }), "TASK-1:STEP-1:7");
  assert.equal(acquireCalls, 0);
  assert.equal(workCalls, 0);
});

test("a post-acquire failure does not claim that no work occurred", async () => {
  const store = new InMemoryClaimStore();
  const result = await new ClaimAwareDispatcher({ store }).dispatch(
    { task, payload: {}, execution },
    async () => { throw new Error("synthetic failure"); },
  );
  assert.deepEqual(result, {
    status: "BLOCKED_CLAIM_STATUS_UNKNOWN",
    workPerformed: "UNKNOWN",
  });
});

test("BUG-001 unknown claim operation fails closed before work", async () => {
  let executions = 0;
  const store = {
    acquire: async () => ({ operation: "UNEXPECTED_STATE" }),
  };
  const result = await new ClaimAwareDispatcher({ store }).dispatch(
    { task, payload: {}, execution },
    async () => { executions += 1; },
  );
  assert.equal(executions, 0);
  assert.deepEqual(result, {
    status: "BLOCKED_CLAIM_STATUS_UNKNOWN",
    workPerformed: 0,
  });
});

test("BUG-002 same effect is serialized and recovery waits for in-flight write", async () => {
  let now = 1_000;
  const store = new InMemoryClaimStore({ now: () => now, epoch: "epoch-1" });
  const binding = {
    claimKey: "TASK-1:STEP-1:7",
    payloadDigest: "digest",
    agentId: "BT-006",
    agentVersion: "published-v1",
    principalId: "principal-1",
    runId: "run-old",
  };
  const old = await store.acquire(binding, 10);
  const fenced = { ...binding, epoch: old.epoch, fence: old.fence };
  const effect = { adapterName: "synthetic", sideEffectKey: "one", requestDigest: "request" };
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  let writes = 0;
  const firstWrite = store.writeOnce(fenced, effect, async () => {
    writes += 1;
    await held;
    return { ok: true };
  });
  await new Promise((resolve) => setImmediate(resolve));
  const replayWrite = store.writeOnce(fenced, effect, async () => {
    writes += 1;
    return { ok: false };
  });
  release();
  assert.deepEqual(await firstWrite, { ok: true });
  assert.deepEqual(await replayWrite, { ok: true });
  assert.equal(writes, 1);

  let releaseInFlight;
  const inFlightHeld = new Promise((resolve) => { releaseInFlight = resolve; });
  const inFlight = store.writeOnce(
    fenced,
    { ...effect, sideEffectKey: "two" },
    async () => {
      writes += 1;
      await inFlightHeld;
      return { second: true };
    },
  );
  await new Promise((resolve) => setImmediate(resolve));
  now += 11;
  let recovered = false;
  const recovery = store.acquire({ ...binding, runId: "run-new" }, 10).then((value) => {
    recovered = true;
    return value;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(recovered, false);
  releaseInFlight();
  assert.deepEqual(await inFlight, { second: true });
  const next = await recovery;
  assert.equal(writes, 2);
  assert.equal(next.operation, "RECOVERED");
  assert.ok(next.fence > old.fence);
  await assert.rejects(
    store.writeOnce(fenced, { ...effect, sideEffectKey: "three" }, async () => {
      writes += 1;
    }),
    { code: "STALE_FENCE" },
  );
  assert.equal(writes, 2);
});

test("BUG-003 dispatcher does not expose adapters or store for bypass", () => {
  const dispatcher = new ClaimAwareDispatcher({
    store: new InMemoryClaimStore(),
    adapters: { synthetic: { writeFenced: async () => true } },
  });
  assert.equal("adapters" in dispatcher, false);
  assert.equal("store" in dispatcher, false);
  assert.deepEqual(Object.keys(dispatcher), []);
});

test("BUG-004 replay and fence checks require complete execution identity", async () => {
  const store = new InMemoryClaimStore();
  const dispatcher = new ClaimAwareDispatcher({ store });
  await dispatcher.dispatch(
    { task, payload: {}, execution },
    async () => ({ secret: "result" }),
  );
  const replay = await dispatcher.dispatch(
    { task, payload: {}, execution: { ...execution, principalId: "principal-2", runId: "run-2" } },
    async () => assert.fail("different execution must not replay"),
  );
  assert.deepEqual(replay, { status: "EXECUTION_CONFLICT", workPerformed: 0 });

  const claim = await store.acquire(
    {
      claimKey: "TASK-2:STEP-1:7",
      payloadDigest: "digest",
      ...execution,
    },
    1_000,
  );
  await assert.rejects(
    store.assertCurrentFence({
      claimKey: "TASK-2:STEP-1:7",
      payloadDigest: "digest",
      ...execution,
      agentVersion: "other-version",
      epoch: claim.epoch,
      fence: claim.fence,
    }),
    { code: "STALE_FENCE" },
  );
});

test("BUG-005 effect receipts reject changed requests and delimiter collisions", async () => {
  const store = new InMemoryClaimStore();
  let writes = 0;
  const contexts = [];
  const dispatcher = new ClaimAwareDispatcher({
    store,
    adapters: {
      "a:b": {
        writeFenced: async (request, context) => {
          writes += 1;
          contexts.push(context);
          return request;
        },
      },
      a: {
        writeFenced: async (request, context) => {
          writes += 1;
          contexts.push(context);
          return request;
        },
      },
    },
  });
  const result = await dispatcher.dispatch({ task, payload: {}, execution }, async ({ gateway }) => {
    await gateway.write("a:b", "c", { value: 1 });
    await gateway.write("a", "b:c", { value: 1 });
    await assert.rejects(
      gateway.write("a:b", "c", { value: 2 }),
      { code: "IDEMPOTENCY_KEY_REUSE" },
    );
    return { ok: true };
  });
  assert.equal(result.status, "ACQUIRED");
  assert.equal(writes, 2);
  assert.equal(contexts.every(({ claim, effect }) => (
    claim.agentVersion === execution.agentVersion
      && claim.principalId === execution.principalId
      && effect.requestDigest.length === 64
  )), true);
});
