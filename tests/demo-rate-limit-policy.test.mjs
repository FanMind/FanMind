import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const protectionPath = "src/lib/demoProtection.ts";
const clientIpPolicyPath = "src/lib/clientIpPolicy.mjs";
const runbookPath = "docs/operations/public-demo-protection-runbook.md";
const envExamplePath = ".env.example";

async function read(path) {
  return readFile(path, "utf8");
}

test("public demo restart limits preserve short-term and capacity protection", async () => {
  const protection = await read(protectionPath);

  assert.match(
    protection,
    /FANMIND_DEMO_MAX_PER_IP_10_MIN",\s*1,\s*20/u,
  );
  assert.match(
    protection,
    /FANMIND_DEMO_MAX_PER_IP_DAY",\s*10,\s*100/u,
  );
  assert.match(
    protection,
    /FANMIND_DEMO_MAX_PER_BROWSER_DAY",\s*5,\s*30/u,
  );
  assert.match(
    protection,
    /FANMIND_DEMO_MAX_ACTIVE",\s*50,\s*2000/u,
  );
});

test("public demo and endpoint rate limits share the canonical client IP policy", async () => {
  const [protection, clientIpPolicy] = await Promise.all([
    read(protectionPath),
    read(clientIpPolicyPath),
  ]);

  assert.match(
    protection,
    /getTrustedClientIpValue\(request\.headers, "unknown"\)/u,
  );
  assert.doesNotMatch(protection, /headers\.get\("cf-connecting-ip"\)/u);
  assert.doesNotMatch(
    protection,
    /headers\.get\("x-forwarded-for"\).*split\(","\)\[0\]/su,
  );
  assert.match(clientIpPolicy, /headerValue\(headers, "x-real-ip"\)/u);
  assert.match(clientIpPolicy, /getLastForwardedForIp/u);
  assert.match(clientIpPolicy, /return normalized\.at\(-1\)/u);
  assert.doesNotMatch(
    clientIpPolicy,
    /headerValue\(headers, "cf-connecting-ip"\)/u,
  );
});

test("production demo runbook matches the controlled restart policy", async () => {
  const runbook = await read(runbookPath);
  const envExample = await read(envExamplePath);

  assert.match(runbook, /FANMIND_DEMO_MAX_PER_IP_10_MIN=1/u);
  assert.match(runbook, /FANMIND_DEMO_MAX_PER_IP_DAY=10/u);
  assert.match(runbook, /FANMIND_DEMO_MAX_PER_BROWSER_DAY=5/u);
  assert.match(runbook, /FANMIND_DEMO_MAX_ACTIVE=50/u);
  assert.match(runbook, /legitime Neustarts/u);
  assert.match(runbook, /Keine Roh-IP-Adresse wird gespeichert/u);
  assert.match(envExample, /FANMIND_DEMO_MAX_PER_IP_10_MIN=1/u);
  assert.match(envExample, /FANMIND_DEMO_MAX_PER_IP_DAY=10/u);
  assert.match(envExample, /FANMIND_DEMO_MAX_PER_BROWSER_DAY=5/u);
  assert.match(envExample, /FANMIND_DEMO_MAX_ACTIVE=50/u);
  assert.doesNotMatch(envExample, /FANMIND_DEMO_MAX_PER_IP_DAY=5(?:\s|$)/u);
  assert.doesNotMatch(envExample, /FANMIND_DEMO_MAX_PER_BROWSER_DAY=2(?:\s|$)/u);
});
