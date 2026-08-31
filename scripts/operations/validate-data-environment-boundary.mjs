import assert from "node:assert/strict";

function normalizeProjectRef(value) {
  assert.ok(typeof value === "string", "project ref must be a string");
  const normalized = value.trim().toLowerCase();
  assert.ok(normalized !== "", "project ref required");
  assert.ok(!/\s/u.test(normalized), "project ref must not contain whitespace");
  return normalized;
}

export function assertSyntheticWriteTarget({
  runtimeEnvironment,
  targetRef,
  expectedTargetRef,
  productionRef,
  syntheticMarker,
}) {
  assert.ok(
    ["development", "test", "staging"].includes(runtimeEnvironment),
    "synthetic writes require development/test/staging",
  );
  const normalizedTargetRef = normalizeProjectRef(targetRef);
  const normalizedExpectedTargetRef = normalizeProjectRef(expectedTargetRef);
  const normalizedProductionRef = normalizeProjectRef(productionRef);
  assert.equal(
    normalizedTargetRef,
    normalizedExpectedTargetRef,
    "synthetic writes require the independently expected non-Production target",
  );
  assert.notEqual(
    normalizedTargetRef,
    normalizedProductionRef,
    "synthetic writes must never target Production",
  );
  assert.ok(
    typeof syntheticMarker === "string" &&
      /^fanmind-synthetic[-_:]/u.test(syntheticMarker),
    "synthetic marker required",
  );
  return true;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [
    runtimeEnvironment,
    targetRef,
    expectedTargetRef,
    productionRef,
    syntheticMarker,
  ] = process.argv.slice(2);
  try {
    assertSyntheticWriteTarget({
      runtimeEnvironment,
      targetRef,
      expectedTargetRef,
      productionRef,
      syntheticMarker,
    });
    process.stdout.write("DATA_ENVIRONMENT_BOUNDARY=PASS\n");
  } catch {
    process.stderr.write("DATA_ENVIRONMENT_BOUNDARY=BLOCK\n");
    process.exitCode = 1;
  }
}
