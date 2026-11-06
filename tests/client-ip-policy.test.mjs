import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_FORWARDED_FOR_HEADER_LENGTH,
  MAX_FORWARDED_FOR_HOPS,
  getLastForwardedForIp,
  getTrustedClientIpValue,
  normalizeClientIp,
  resolveTrustedClientIp,
} from "../src/lib/clientIpPolicy.mjs";

function headers(values = {}) {
  const normalized = new Map(
    Object.entries(values).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return {
    get(name) {
      return normalized.get(String(name).toLowerCase()) ?? null;
    },
  };
}

test("single IP normalization accepts IPv4, IPv6 and mapped IPv4 only", () => {
  assert.equal(normalizeClientIp("203.0.113.42"), "203.0.113.42");
  assert.equal(normalizeClientIp("2001:DB8::A"), "2001:db8::a");
  assert.equal(normalizeClientIp("[2001:db8::1]:443"), "2001:db8::1");
  assert.equal(normalizeClientIp("::ffff:192.0.2.9"), "192.0.2.9");
  assert.equal(normalizeClientIp("client.example"), null);
  assert.equal(normalizeClientIp("198.51.100.1, 203.0.113.9"), null);
  assert.equal(normalizeClientIp("198.51.100.1:1234"), null);
});

test("canonical X-Real-IP wins over spoofed forwarding and Cloudflare headers", () => {
  const result = resolveTrustedClientIp(
    headers({
      "x-real-ip": "203.0.113.77",
      "x-forwarded-for": "198.51.100.23, 203.0.113.77",
      "cf-connecting-ip": "192.0.2.66",
    }),
  );

  assert.deepEqual(result, { ip: "203.0.113.77", source: "x-real-ip" });
});

test("X-Forwarded-For fallback uses only the final valid nginx-appended hop", () => {
  assert.equal(
    getLastForwardedForIp("198.51.100.10, 192.0.2.20, 203.0.113.30"),
    "203.0.113.30",
  );

  const result = resolveTrustedClientIp(
    headers({
      "x-real-ip": "invalid",
      "x-forwarded-for": "198.51.100.10, 203.0.113.30",
    }),
  );
  assert.deepEqual(result, {
    ip: "203.0.113.30",
    source: "x-forwarded-for-last",
  });
});

test("CF-Connecting-IP is ignored when nginx does not establish Cloudflare trust", () => {
  const result = resolveTrustedClientIp(
    headers({ "cf-connecting-ip": "203.0.113.88" }),
  );
  assert.deepEqual(result, { ip: null, source: "none" });
  assert.equal(getTrustedClientIpValue(headers({ "cf-connecting-ip": "203.0.113.88" })), "anonymous");
});

test("invalid, ambiguous and overlong forwarding chains fail closed", () => {
  assert.equal(getLastForwardedForIp("198.51.100.1, not-an-ip, 203.0.113.2"), null);
  assert.equal(getLastForwardedForIp("198.51.100.1, , 203.0.113.2"), null);
  assert.equal(
    getLastForwardedForIp(Array(MAX_FORWARDED_FOR_HOPS + 1).fill("203.0.113.1").join(",")),
    null,
  );
  assert.equal(
    getLastForwardedForIp("1".repeat(MAX_FORWARDED_FOR_HEADER_LENGTH + 1)),
    null,
  );

  const result = resolveTrustedClientIp(
    headers({
      "x-real-ip": "203.0.113.1, 198.51.100.1",
      "x-forwarded-for": "malformed",
      "cf-connecting-ip": "203.0.113.9",
    }),
  );
  assert.deepEqual(result, { ip: null, source: "none" });
});
