import assert from "node:assert/strict";
import test from "node:test";

import { resolveDemoTurnstilePolicy } from "../src/lib/demoTurnstilePolicy.mjs";

test("Turnstile stays optional when both keys and the required flag are absent", () => {
  assert.deepEqual(resolveDemoTurnstilePolicy(), {
    mode: "disabled",
    required: false,
    tokenRequired: false,
    configured: false,
    errorCode: null,
  });
});

test("Turnstile fails closed when only the public site key is configured", () => {
  const policy = resolveDemoTurnstilePolicy({
    siteKey: "site-key",
    secretKey: "",
  });

  assert.equal(policy.mode, "misconfigured");
  assert.equal(policy.tokenRequired, true);
  assert.equal(policy.errorCode, "turnstile_configuration_incomplete");
});

test("Turnstile fails closed when only the server secret is configured", () => {
  const policy = resolveDemoTurnstilePolicy({
    siteKey: "",
    secretKey: "secret-key",
  });

  assert.equal(policy.mode, "misconfigured");
  assert.equal(policy.tokenRequired, true);
  assert.equal(policy.errorCode, "turnstile_configuration_incomplete");
});

test("Turnstile required mode fails closed before both keys are configured", () => {
  const policy = resolveDemoTurnstilePolicy({ required: true });

  assert.equal(policy.mode, "misconfigured");
  assert.equal(policy.required, true);
  assert.equal(policy.configured, false);
});

test("Turnstile enabled mode requires a one-time browser token", () => {
  const policy = resolveDemoTurnstilePolicy({
    required: true,
    siteKey: "site-key",
    secretKey: "secret-key",
  });

  assert.deepEqual(policy, {
    mode: "enabled",
    required: true,
    tokenRequired: true,
    configured: true,
    errorCode: null,
  });
});
