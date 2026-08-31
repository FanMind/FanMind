import test from "node:test";
import assert from "node:assert/strict";

import { assertSyntheticWriteTarget } from "../scripts/operations/validate-data-environment-boundary.mjs";

const stagingTarget = "staging-ref";
const productionTarget = "production-ref";

function validInput(overrides = {}) {
  return {
    runtimeEnvironment: "staging",
    targetRef: stagingTarget,
    expectedTargetRef: stagingTarget,
    productionRef: productionTarget,
    syntheticMarker: "fanmind-synthetic:push-acceptance",
    ...overrides,
  };
}

test("synthetic writes are allowed only on the independently expected non-Production target", () => {
  assert.equal(assertSyntheticWriteTarget(validInput()), true);
});

test("Production runtime is rejected", () => {
  assert.throws(() =>
    assertSyntheticWriteTarget(validInput({ runtimeEnvironment: "production" })),
  );
});

test("matching Production target is rejected even in staging runtime", () => {
  assert.throws(() =>
    assertSyntheticWriteTarget(
      validInput({
        targetRef: productionTarget,
        expectedTargetRef: productionTarget,
      }),
    ),
  );
});

test("formatted variants of the Production ref are rejected", () => {
  assert.throws(() =>
    assertSyntheticWriteTarget(
      validInput({
        targetRef: "  PRODUCTION-REF  ",
        expectedTargetRef: "production-ref",
      }),
    ),
  );
});

test("unexpected non-Production targets are rejected", () => {
  assert.throws(() =>
    assertSyntheticWriteTarget(
      validInput({
        targetRef: "other-staging-ref",
        expectedTargetRef: stagingTarget,
      }),
    ),
  );
});

test("formatted variants of the expected target are normalized before matching", () => {
  assert.equal(
    assertSyntheticWriteTarget(
      validInput({
        targetRef: "  STAGING-REF  ",
        expectedTargetRef: "staging-ref",
      }),
    ),
    true,
  );
});

test("missing expected target fails closed", () => {
  assert.throws(() =>
    assertSyntheticWriteTarget(validInput({ expectedTargetRef: "" })),
  );
});

test("project refs with embedded whitespace are rejected", () => {
  assert.throws(() =>
    assertSyntheticWriteTarget(validInput({ targetRef: "staging ref" })),
  );
});

test("unmarked synthetic writes are rejected", () => {
  assert.throws(() =>
    assertSyntheticWriteTarget(validInput({ syntheticMarker: "qa-row" })),
  );
});
