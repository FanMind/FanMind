import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  calculateAiCostPerContactMetrics,
  parsePostgrestExactCount,
} from "../src/lib/aiUsageCostMetrics.mjs";

test("PostgREST exact counts accept bounded totals and reject unknown totals", () => {
  assert.equal(parsePostgrestExactCount("0-0/1250"), 1_250);
  assert.equal(parsePostgrestExactCount("*/0"), 0);
  assert.equal(parsePostgrestExactCount(" 0-0/7 "), 7);
  assert.equal(parsePostgrestExactCount("0-0/*"), null);
  assert.equal(parsePostgrestExactCount("invalid"), null);
  assert.equal(parsePostgrestExactCount(null), null);
});

test("AI costs per fan remain deterministic without inventing zero-contact values", () => {
  assert.deepEqual(calculateAiCostPerContactMetrics(250, 50), {
    perFanCents: 5,
    perHundredFansCents: 500,
    perThousandFansCents: 5_000,
  });
  assert.deepEqual(calculateAiCostPerContactMetrics(250, 0), {
    perFanCents: null,
    perHundredFansCents: null,
    perThousandFansCents: null,
  });
  assert.deepEqual(calculateAiCostPerContactMetrics(0, 50), {
    perFanCents: 0,
    perHundredFansCents: 0,
    perThousandFansCents: 0,
  });
  assert.throws(
    () => calculateAiCostPerContactMetrics(-1, 50),
    /estimatedCostCents/u,
  );
});

test("admin AI usage loads exact contact counts and exposes all fan cost ratios", async () => {
  const [source, page, monitoring] = await Promise.all([
    readFile("src/lib/adminAiUsage.ts", "utf8"),
    readFile("src/app/admin/ai-usage/page.tsx", "utf8"),
    readFile("docs/AI_COST_MONITORING.md", "utf8"),
  ]);

  assert.match(source, /loadWorkspaceContactCounts/u);
  assert.match(source, /Range: "0-0"/u);
  assert.match(source, /Prefer: "count=exact"/u);
  assert.match(source, /calculateAiCostPerContactMetrics/u);
  assert.match(page, /Kosten\/Fan/u);
  assert.match(page, /\/100 Fans/u);
  assert.match(page, /\/1\.000 Fans/u);
  assert.match(monitoring, /\[x\] Admin sieht Kosten pro Fan und pro 100\/1\.000 Fans/u);
});
