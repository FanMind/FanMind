import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const policyPath = "src/lib/phase7ChannelReadiness.ts";
const docsPath = "docs/integrations/PHASE7_CHANNEL_READINESS.md";

test("phase 7 preparation is limited to its four canonical channel subjects", async () => {
  const source = await readFile(policyPath, "utf8");
  const keys = source.match(/PHASE_7_CHANNEL_KEYS = \[([\s\S]*?)\] as const/u)?.[1] ?? "";

  assert.match(keys, /"tiktok"/u);
  assert.match(keys, /"x_twitter"/u);
  assert.match(keys, /"discord"/u);
  assert.match(keys, /"onlyfans_evaluation"/u);
  assert.doesNotMatch(keys, /linkedin|youtube|threads|reddit|snapchat/iu);
});

test("every phase 7 policy keeps ingestion, sending, scraping and production disabled", async () => {
  const source = await readFile(policyPath, "utf8");

  assert.match(source, /inboundEnabled: false/u);
  assert.match(source, /outboundEnabled: false/u);
  assert.match(source, /automaticSendingEnabled: false/u);
  assert.match(source, /scrapingEnabled: false/u);
  assert.match(source, /productionEnabled: false/u);
  assert.doesNotMatch(source, /fetch\s*\(|axios|webhook|client_secret|access_token/iu);
});

test("OnlyFans stays evaluation-only and readiness never activates a channel", async () => {
  const [source, docs] = await Promise.all([
    readFile(policyPath, "utf8"),
    readFile(docsPath, "utf8"),
  ]);

  assert.match(source, /onlyfans_evaluation: phase7Policy\("evaluation_only"\)/u);
  assert.match(source, /return \{ ready: false, blockers: \["evaluation_only"\] \}/u);
  assert.doesNotMatch(source, /ready: true/u);
  assert.match(docs, /keine\s+zugesagte Integration/iu);
  assert.match(docs, /keine Zugangsdaten/iu);
});

test("readiness contract distinguishes code, staging, external and production gates", async () => {
  const source = await readFile(policyPath, "utf8");

  for (const blocker of [
    "implementation_incomplete",
    "staging_acceptance_missing",
    "external_approval_missing",
    "production_activation_missing",
  ]) {
    assert.match(source, new RegExp(`"${blocker}"`, "u"));
  }
});
