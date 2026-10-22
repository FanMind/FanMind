import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { verifyConnectionAfterRepair } from "./supportRepairPostcheck";

describe("repair post-action verification", () => {
  it("verifies a single connected matching channel", () => {
    assert.deepEqual(verifyConnectionAfterRepair([{ platform: "instagram", status: "connected" }], "instagram"), { verified: true, status: "connected" });
  });
  it("rejects missing diagnostic data", () => {
    assert.deepEqual(verifyConnectionAfterRepair(null, "facebook"), { verified: false, status: "diagnostics_unavailable" });
  });
  it("rejects absent channel", () => {
    assert.deepEqual(verifyConnectionAfterRepair([{ platform: "facebook", status: "connected" }], "instagram"), { verified: false, status: "not_configured" });
  });
  it("rejects partial recovery of multiple matching connections", () => {
    assert.deepEqual(verifyConnectionAfterRepair([{ platform: "whatsapp", status: "connected" }, { platform: "whatsapp", status: "expired" }], "whatsapp"), { verified: false, status: "attention_required" });
  });
  it("rejects disconnected connection", () => {
    assert.deepEqual(verifyConnectionAfterRepair([{ platform: "instagram", status: "disconnected" }], "instagram"), { verified: false, status: "attention_required" });
  });
});
