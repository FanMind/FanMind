import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const dynamicAppConfig = require(
  fileURLToPath(new URL("../apps/mobile/app.config.js", import.meta.url)),
);

const approvedProjectId = "df30aeb2-79d3-42bc-9fc1-e2d3f7e5666f";

test("runtime Expo config always exposes the approved EAS project id", () => {
  const config = dynamicAppConfig({
    config: { extra: { product: "FanMind Mobile" } },
    environment: {},
  });

  assert.equal(config.extra.eas.projectId, approvedProjectId);
  assert.equal(config.owner, undefined);
});

test("protected release binding can still provide the reviewed owner and project id", () => {
  const config = dynamicAppConfig({
    config: { extra: { product: "FanMind Mobile" } },
    environment: {
      FANMIND_MOBILE_EXPECTED_EAS_OWNER: "bernds-tech",
      FANMIND_MOBILE_EXPECTED_EAS_PROJECT_ID: approvedProjectId,
    },
  });

  assert.equal(config.owner, "bernds-tech");
  assert.equal(config.extra.eas.projectId, approvedProjectId);
});
