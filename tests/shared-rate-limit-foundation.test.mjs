import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  SharedRateLimitPolicyError,
  buildSharedRateLimitRequest,
  hashSharedRateLimitSubject,
  parseSharedRateLimitResponse,
} from "../src/lib/sharedRateLimitPolicy.mjs";

const migrationPath =
  "supabase/migrations/20260723102000_shared_rate_limits.sql";
const serverAdapterPath = "src/lib/sharedRateLimit.ts";

const secret = "shared-rate-limit-test-secret-0123456789";

test("purpose-scoped HMAC hashes are deterministic and do not expose the subject", () => {
  const first = hashSharedRateLimitSubject({
    scope: "inquiry_ip",
    subject: "203.0.113.7",
    secret,
  });
  const same = hashSharedRateLimitSubject({
    scope: "inquiry_ip",
    subject: "203.0.113.7",
    secret,
  });
  const otherScope = hashSharedRateLimitSubject({
    scope: "ai_reply_user_ip",
    subject: "203.0.113.7",
    secret,
  });

  assert.equal(first, same);
  assert.notEqual(first, otherScope);
  assert.match(first, /^[0-9a-f]{64}$/u);
  assert.doesNotMatch(first, /203\.0\.113\.7/u);
});

test("RPC request contains only the scope, HMAC hash and bounded policy values", () => {
  const body = buildSharedRateLimitRequest({
    scope: "ai_reply_user_ip",
    subject: "user-id:2001:db8::1",
    secret,
    maxRequests: 20,
    windowMs: 10 * 60 * 1000,
  });

  assert.equal(body.p_scope, "ai_reply_user_ip");
  assert.match(body.p_subject_hash, /^[0-9a-f]{64}$/u);
  assert.equal(body.p_window_seconds, 600);
  assert.equal(body.p_max_requests, 20);
  assert.doesNotMatch(JSON.stringify(body), /user-id|2001:db8/u);
});

test("policy rejects unsafe scopes, subjects, secrets and bounds", () => {
  assert.throws(
    () =>
      buildSharedRateLimitRequest({
        scope: "AI Reply",
        subject: "subject",
        secret,
        maxRequests: 20,
        windowMs: 600_000,
      }),
    SharedRateLimitPolicyError,
  );
  assert.throws(
    () =>
      buildSharedRateLimitRequest({
        scope: "ai_reply",
        subject: "",
        secret,
        maxRequests: 20,
        windowMs: 600_000,
      }),
    SharedRateLimitPolicyError,
  );
  assert.throws(
    () =>
      buildSharedRateLimitRequest({
        scope: "ai_reply",
        subject: "subject",
        secret: "too-short",
        maxRequests: 20,
        windowMs: 600_000,
      }),
    SharedRateLimitPolicyError,
  );
  assert.throws(
    () =>
      buildSharedRateLimitRequest({
        scope: "ai_reply",
        subject: "subject",
        secret,
        maxRequests: 0,
        windowMs: 600_000,
      }),
    SharedRateLimitPolicyError,
  );
});

test("RPC response parser validates all atomic counter fields", () => {
  const result = parseSharedRateLimitResponse([
    {
      allowed: true,
      remaining: 4,
      reset_at: "2026-07-23T10:30:00.000Z",
      current_count: 1,
    },
  ]);

  assert.deepEqual(result, {
    allowed: true,
    remaining: 4,
    resetAt: Date.parse("2026-07-23T10:30:00.000Z"),
    currentCount: 1,
  });

  assert.throws(
    () =>
      parseSharedRateLimitResponse({
        allowed: "yes",
        remaining: -1,
        reset_at: "invalid",
        current_count: 0,
      }),
    SharedRateLimitPolicyError,
  );
});

test("migration uses one atomic upsert, bounded cleanup and service-role-only privileges", async () => {
  const migration = await readFile(migrationPath, "utf8");

  assert.match(migration, /create table if not exists public\.shared_rate_limit_buckets/u);
  assert.match(
    migration,
    /primary key \(scope, subject_hash, window_start, window_seconds\)/u,
  );
  assert.match(
    migration,
    /on conflict \(scope, subject_hash, window_start, window_seconds\)[\s\S]*request_count = bucket\.request_count \+ 1/u,
  );
  assert.match(migration, /security definer/u);
  assert.match(migration, /set search_path = public, pg_temp/u);
  assert.match(migration, /limit 100/u);
  assert.match(migration, /cleanup_shared_rate_limit_buckets/u);
  assert.match(
    migration,
    /revoke all on table public\.shared_rate_limit_buckets[\s\S]*from public, anon, authenticated/u,
  );
  assert.match(
    migration,
    /grant execute on function public\.consume_shared_rate_limit\(text, text, integer, integer\)[\s\S]*to service_role/u,
  );
  assert.doesNotMatch(migration, /\bip_address\b|\braw_ip\b|\buser_id\b/u);
});

test("server adapter requires the dedicated server-only secret and never logs identifiers", async () => {
  const source = await readFile(serverAdapterPath, "utf8");

  assert.match(source, /FANMIND_SHARED_RATE_LIMIT_SECRET/u);
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/u);
  assert.match(source, /rpc\/consume_shared_rate_limit/u);
  assert.match(source, /AbortSignal\.timeout\(5000\)/u);
  assert.doesNotMatch(source, /console\.(?:log|error|warn)/u);
  assert.doesNotMatch(source, /FANMIND_DEMO_RATE_LIMIT_SECRET/u);
});
