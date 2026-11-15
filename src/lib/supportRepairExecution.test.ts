import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { executeSafeSupportRepair } from "./supportRepairExecution";

describe("safe support repair executor", () => {
  it("reports connected without mutating providers", async () => {
    assert.deepEqual(await executeSafeSupportRepair("check_connection", "instagram", async () => [{ platform: "instagram", status: "connected" }]), { status: "connected", verified: true, changed: false });
  });
  it("blocks authorization changes without reading", async () => {
    let called = false;
    const result = await executeSafeSupportRepair("renew_authorization", "facebook", async () => { called = true; return []; });
    assert.deepEqual(result, { status: "manual_action_required", verified: false, changed: false });
    assert.equal(called, false);
  });
  it("fails closed when diagnostics throw", async () => {
    assert.deepEqual(await executeSafeSupportRepair("retry_safe_status_probe", "whatsapp", async () => { throw new Error("unavailable"); }), { status: "diagnostics_unavailable", verified: false, changed: false });
  });
});
