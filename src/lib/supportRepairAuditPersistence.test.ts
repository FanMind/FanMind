import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { persistRepairAuditEvent } from "./supportRepairAuditPersistence";

const valid = {
  workspace_id: "11111111-1111-4111-8111-111111111111",
  actor_user_id: "22222222-2222-4222-8222-222222222222",
  request_id: "33333333-3333-4333-8333-333333333333",
  platform: "instagram" as const,
  action: "request_reconnect",
  consent_required: true,
  consent_given: true,
  status: "manual_action_required" as const,
  completed_at: "2026-10-22T08:00:00.000Z",
};

describe("repair audit persistence", () => {
  it("persists only the approved fields", async () => {
    let saved: unknown;
    const event = await persistRepairAuditEvent(
      { ...valid, access_token: "secret" } as typeof valid,
      async (record) => { saved = record; },
    );
    assert.deepEqual(saved, event);
    assert.equal("access_token" in event, false);
  });

  it("rejects missing consent before writing", async () => {
    let writes = 0;
    await assert.rejects(
      persistRepairAuditEvent(
        { ...valid, consent_given: false },
        async () => { writes += 1; },
      ),
      /repair_consent_missing/,
    );
    assert.equal(writes, 0);
  });

  it("fails closed when database writer rejects", async () => {
    await assert.rejects(
      persistRepairAuditEvent(valid, async () => {
        throw new Error("database_unavailable");
      }),
      /database_unavailable/,
    );
  });

  it("rejects terminal events without completion timestamp", async () => {
    await assert.rejects(
      persistRepairAuditEvent(
        { ...valid, completed_at: null },
        async () => { throw new Error("must_not_write"); },
      ),
      /repair_completion_timestamp_missing/,
    );
  });
});
