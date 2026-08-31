import test from "node:test";
import assert from "node:assert/strict";

import { assertSyntheticWriteTarget } from "../scripts/operations/validate-data-environment-boundary.mjs";

test("synthetic writes are allowed only on explicit non-Production targets", () => {
  assert.equal(
    assertSyntheticWriteTarget({
      runtimeEnvironment: "staging",
      targetRef: "staging-ref",
      productionRef: "production-ref",
      syntheticMarker: "fanmind-synthetic:push-acceptance",
    }),
    true,
  );
});

test("Production runtime is rejected", () => {
  assert.throws(() =>
    assertSyntheticWriteTarget({
      runtimeEnvironment: "production",
      targetRef: "staging-ref",
      productionRef: "production-ref",
      syntheticMarker: "fanmind-synthetic:test",
    }),
  );
});

test("matching Production target is rejected even in staging runtime", () => {
  assert.throws(() =>
    assertSyntheticWriteTarget({
      runtimeEnvironment: "staging",
      targetRef: "production-ref",
      productionRef: "production-ref",
      syntheticMarker: "fanmind-synthetic:test",
    }),
  );
});

test("unmarked synthetic writes are rejected", () => {
  assert.throws(() =>
    assertSyntheticWriteTarget({
      runtimeEnvironment: "staging",
      targetRef: "staging-ref",
      productionRef: "production-ref",
      syntheticMarker: "qa-row",
    }),
  );
});
