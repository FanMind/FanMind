import assert from "node:assert/strict";
import test from "node:test";

import {
  createWebsiteChatSessionToken,
  hashWebsiteChatSessionToken,
  normalizeSessionTtlMinutes,
  normalizeWebsiteChatEmail,
  normalizeWebsiteChatMessage,
  normalizeWebsiteChatOrigin,
  requireAllowedWebsiteChatOrigin,
  requireConsent,
  requirePublicInstallationId,
  requireWebsiteChatClientMessageId,
  requireWebsiteChatHandoffConsent,
  requireWebsiteChatPreflight,
  SESSION_TOKEN_PATTERN,
  WebsiteChatPolicyError,
} from "../src/lib/websiteChatPolicy.mjs";

const expectCode = (fn, code) =>
  assert.throws(fn, (error) => error instanceof WebsiteChatPolicyError && error.code === code);

test("website chat accepts only normalized exact HTTPS origins", () => {
  assert.equal(normalizeWebsiteChatOrigin("https://Example.COM"), "https://example.com");
  assert.equal(
    requireAllowedWebsiteChatOrigin("https://shop.example.com", ["https://shop.example.com"]),
    "https://shop.example.com",
  );
  expectCode(() => requireAllowedWebsiteChatOrigin("https://evil-example.com", ["https://example.com"]), "origin_forbidden");
  expectCode(() => requireAllowedWebsiteChatOrigin("https://sub.example.com", ["https://example.com"]), "origin_forbidden");
  for (const invalid of [null, "null", "http://example.com", "https://example.com/path", "https://example.com?q=1", "*.example.com"]) {
    expectCode(() => normalizeWebsiteChatOrigin(invalid), invalid === null ? "origin_required" : "origin_invalid");
  }
});

test("CORS preflights accept only POST and the route-specific header allowlist", () => {
  assert.deepEqual(
    requireWebsiteChatPreflight(
      { method: "POST", requestedHeaders: "Content-Type, X-FanMind-Installation" },
      ["content-type", "x-fanmind-installation"],
    ),
    ["content-type", "x-fanmind-installation"],
  );
  expectCode(
    () => requireWebsiteChatPreflight(
      { method: "GET", requestedHeaders: "content-type" },
      ["content-type"],
    ),
    "preflight_method_forbidden",
  );
  expectCode(
    () => requireWebsiteChatPreflight(
      { method: "POST", requestedHeaders: "content-type,x-unknown" },
      ["content-type"],
    ),
    "preflight_headers_forbidden",
  );
});

test("installation IDs and session tokens are bounded", () => {
  assert.equal(
    requirePublicInstallationId("123e4567-e89b-42d3-a456-426614174000"),
    "123e4567-e89b-42d3-a456-426614174000",
  );
  expectCode(() => requirePublicInstallationId("public-secret"), "installation_invalid");
  const token = createWebsiteChatSessionToken(() => Buffer.alloc(32, 7));
  assert.match(token, SESSION_TOKEN_PATTERN);
  const hash = hashWebsiteChatSessionToken({ token, secret: "s".repeat(32) });
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.notEqual(hash, token);
  expectCode(() => hashWebsiteChatSessionToken({ token: "short", secret: "s".repeat(32) }), "session_invalid");
  expectCode(() => hashWebsiteChatSessionToken({ token, secret: "short" }), "session_secret_unavailable");
});

test("client message IDs are canonical UUIDs", () => {
  assert.equal(
    requireWebsiteChatClientMessageId("123E4567-E89B-42D3-A456-426614174000"),
    "123e4567-e89b-42d3-a456-426614174000",
  );
  expectCode(() => requireWebsiteChatClientMessageId("retry-1"), "client_message_id_invalid");
});

test("handoff email and purpose-specific consent fail closed", () => {
  assert.equal(normalizeWebsiteChatEmail(" Visitor@Example.COM "), "visitor@example.com");
  for (const invalid of [null, "visitor", "a@b", "a@@example.com", "a b@example.com", `${"a".repeat(245)}@example.com`]) {
    expectCode(() => normalizeWebsiteChatEmail(invalid), "email_invalid");
  }
  assert.equal(
    requireWebsiteChatHandoffConsent(
      { granted: true, version: "privacy-v1", purpose: "human_reply_by_email" },
      "privacy-v1",
    ),
    "privacy-v1",
  );
  for (const invalid of [
    { granted: false, version: "privacy-v1", purpose: "human_reply_by_email" },
    { granted: true, version: "old", purpose: "human_reply_by_email" },
    { granted: true, version: "privacy-v1", purpose: "marketing" },
  ]) {
    expectCode(
      () => requireWebsiteChatHandoffConsent(invalid, "privacy-v1"),
      "handoff_consent_required",
    );
  }
});

test("consent, message and session TTL fail closed", () => {
  assert.equal(requireConsent({ granted: true, version: "privacy-v1" }, "privacy-v1"), "privacy-v1");
  expectCode(() => requireConsent({ granted: false, version: "privacy-v1" }, "privacy-v1"), "consent_required");
  expectCode(() => requireConsent({ granted: true, version: "old" }, "privacy-v1"), "consent_required");
  assert.equal(normalizeWebsiteChatMessage(" hello\r\nworld "), "hello\nworld");
  expectCode(() => normalizeWebsiteChatMessage(""), "message_invalid");
  expectCode(() => normalizeWebsiteChatMessage("x".repeat(4001)), "message_invalid");
  assert.equal(normalizeSessionTtlMinutes(60), 60);
  expectCode(() => normalizeSessionTtlMinutes(4), "session_ttl_invalid");
  expectCode(() => normalizeSessionTtlMinutes(1441), "session_ttl_invalid");
});
