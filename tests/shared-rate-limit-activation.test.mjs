import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const aiRoutePath = "src/app/api/ai/reply-suggestions/route.ts";
const inquiryRoutePath = "src/app/api/inquiries/route.ts";
const rateLimitPath = "src/lib/rateLimit.ts";
const sharedRateLimitPath = "src/lib/sharedRateLimit.ts";
const operationsPath = "src/lib/operations.ts";
const publicHealthPolicyPath = "scripts/public-health-policy.mjs";

async function read(path) {
  return readFile(path, "utf8");
}

test("AI replies use the shared atomic limiter before any OpenAI request", async () => {
  const source = await read(aiRoutePath);

  assert.match(source, /import \{ consumeSharedRateLimit \} from "@\/lib\/sharedRateLimit"/u);
  assert.match(source, /await consumeSharedRateLimit\(\{[\s\S]*scope: "ai_reply_user_ip"/u);
  assert.match(source, /subject: `\$\{authorizationContext\.user\.id\}:\$\{getClientIp\(request\)\}`/u);
  assert.match(source, /const AI_RATE_LIMIT_MAX = 20/u);
  assert.match(source, /const AI_RATE_LIMIT_WINDOW_MS = 10 \* 60 \* 1000/u);
  assert.match(
    source,
    /catch \{[\s\S]*"Antwortvorschläge konnten gerade nicht erzeugt werden\."[\s\S]*503/u,
  );
  assert.match(source, /"Zu viele KI-Anfragen\. Bitte versuche es später erneut\."[\s\S]*429/u);
  assert.ok(
    source.indexOf("await consumeSharedRateLimit") < source.indexOf("fetch(OPENAI_RESPONSES_URL"),
  );
  assert.doesNotMatch(source, /\bcheckRateLimit\b/u);
});

test("public inquiries use the shared limiter before persistence and fail closed", async () => {
  const source = await read(inquiryRoutePath);

  assert.match(source, /import \{ consumeSharedRateLimit \} from "@\/lib\/sharedRateLimit"/u);
  assert.match(source, /await consumeSharedRateLimit\(\{[\s\S]*scope: "inquiry_ip"/u);
  assert.match(source, /subject: getClientIp\(request\)/u);
  assert.match(source, /const MAX_REQUESTS_PER_WINDOW = 5/u);
  assert.match(source, /const WINDOW_MS = 10 \* 60 \* 1000/u);
  assert.match(source, /\{ error: "SERVICE_UNAVAILABLE" \}, \{ status: 503 \}/u);
  assert.match(source, /\{ error: "RATE_LIMITED" \}, \{ status: 429 \}/u);
  assert.ok(
    source.indexOf("await consumeSharedRateLimit")
      < source.indexOf("const { inquiry, error } = await createPilotInquiry"),
  );
  assert.doesNotMatch(source, /\bcheckRateLimit\b/u);
});

test("no process-local rate limit bucket remains", async () => {
  const source = await read(rateLimitPath);

  assert.match(source, /getTrustedClientIpValue/u);
  assert.doesNotMatch(source, /new Map/u);
  assert.doesNotMatch(source, /\bcheckRateLimit\b/u);
  assert.doesNotMatch(source, /request_count|resetAt|buckets/u);
});

test("shared adapter remains server-only, bounded and redacted", async () => {
  const source = await read(sharedRateLimitPath);

  assert.match(source, /FANMIND_SHARED_RATE_LIMIT_SECRET/u);
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/u);
  assert.match(source, /rpc\/consume_shared_rate_limit/u);
  assert.match(source, /AbortSignal\.timeout\(5000\)/u);
  assert.doesNotMatch(source, /console\.(?:log|warn|error)/u);
  assert.doesNotMatch(source, /NEXT_PUBLIC_SHARED_RATE_LIMIT/u);
});

test("shared limiter configuration is a blocking public health component", async () => {
  const [operations, healthPolicy] = await Promise.all([
    read(operationsPath),
    read(publicHealthPolicyPath),
  ]);

  assert.match(operations, /FANMIND_SHARED_RATE_LIMIT_SECRET/u);
  assert.match(operations, /shared_rate_limit_config/u);
  assert.match(operations, />= 32/u);
  assert.match(
    healthPolicy,
    /REQUIRED_PUBLIC_HEALTH_COMPONENTS[\s\S]*"shared_rate_limit_config"/u,
  );
  assert.doesNotMatch(
    healthPolicy,
    /OPTIONAL_PUBLIC_HEALTH_COMPONENTS[\s\S]*"shared_rate_limit_config"/u,
  );
});
