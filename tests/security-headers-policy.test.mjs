import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const nextConfigPath = "next.config.ts";

async function source() {
  return readFile(nextConfigPath, "utf8");
}

test("FanMind enforces the low-risk CSP baseline on every route", async () => {
  const config = await source();

  assert.match(config, /key:\s*"Content-Security-Policy"/u);
  assert.match(config, /frame-ancestors 'none'/u);
  assert.match(config, /base-uri 'self'/u);
  assert.match(config, /object-src 'none'/u);
  assert.match(config, /form-action 'self'/u);
  assert.doesNotMatch(config, /Content-Security-Policy-Report-Only/u);
});

test("existing browser and transport security headers remain configured", async () => {
  const config = await source();

  assert.match(config, /X-Content-Type-Options[^\n]*nosniff/u);
  assert.match(config, /Referrer-Policy[^\n]*strict-origin-when-cross-origin/u);
  assert.match(config, /X-Frame-Options[^\n]*DENY/u);
  assert.match(config, /Permissions-Policy[^\n]*camera=\(\), microphone=\(\), geolocation=\(\)/u);
  assert.match(config, /Cross-Origin-Opener-Policy[^\n]*same-origin/u);
  assert.match(config, /Strict-Transport-Security[^\n]*max-age=31536000; includeSubDomains/u);
  assert.match(config, /source:\s*"\/:path\*"/u);
});
