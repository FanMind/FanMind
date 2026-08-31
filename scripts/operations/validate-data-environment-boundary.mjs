import assert from "node:assert/strict";

export function assertSyntheticWriteTarget({ runtimeEnvironment, targetRef, productionRef, syntheticMarker }) {
  assert.ok(["development", "test", "staging"].includes(runtimeEnvironment), "synthetic writes require development/test/staging");
  assert.ok(typeof targetRef === "string" && targetRef.trim() !== "", "targetRef required");
  assert.ok(typeof productionRef === "string" && productionRef.trim() !== "", "productionRef required");
  assert.notEqual(targetRef, productionRef, "synthetic writes must never target Production");
  assert.ok(typeof syntheticMarker === "string" && /^fanmind-synthetic[-_:]/u.test(syntheticMarker), "synthetic marker required");
  return true;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [runtimeEnvironment, targetRef, productionRef, syntheticMarker] = process.argv.slice(2);
  try {
    assertSyntheticWriteTarget({ runtimeEnvironment, targetRef, productionRef, syntheticMarker });
    process.stdout.write("DATA_ENVIRONMENT_BOUNDARY=PASS\n");
  } catch {
    process.stderr.write("DATA_ENVIRONMENT_BOUNDARY=BLOCK\n");
    process.exitCode = 1;
  }
}
