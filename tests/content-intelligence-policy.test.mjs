import assert from "node:assert/strict";
import test from "node:test";

import {
  assessContentSampleConfidence,
  calculateContentPerformance,
  compareMetricToMedian,
  median,
  normalizeContentMetricSnapshot,
} from "../src/lib/contentIntelligencePolicy.mjs";

test("metric snapshots accept only bounded non-negative numeric fields", () => {
  assert.deepEqual(
    normalizeContentMetricSnapshot({
      reach: "1000",
      likes: 12.9,
      comments: -1,
      secret_follower_profile: 99,
      views: Number.NaN,
    }),
    { reach: 1000, likes: 12 },
  );
});

test("performance separates paid and organic values and computes explicit rates", () => {
  const performance = calculateContentPerformance({
    reach: 1000,
    impressions: 1500,
    paid_reach: 200,
    paid_impressions: 300,
    likes: 50,
    comments: 20,
    shares: 10,
    saves: 20,
    direct_messages: 5,
    new_contacts: 2,
  });

  assert.equal(performance.interactions, 100);
  assert.equal(performance.organicReach, 800);
  assert.equal(performance.organicImpressions, 1200);
  assert.equal(performance.engagementRateByReach, 0.1);
  assert.equal(performance.saveRateByReach, 0.02);
  assert.equal(performance.shareRateByReach, 0.01);
  assert.equal(performance.messageRateByReach, 0.005);
  assert.equal(performance.contactConversionRateByReach, 0.002);
});

test("zero denominators never create misleading rates", () => {
  const performance = calculateContentPerformance({ likes: 10, reach: 0 });
  assert.equal(performance.engagementRateByReach, null);
  assert.equal(performance.saveRateByReach, null);
});

test("post performance compares against a robust historical median", () => {
  assert.equal(median([10, 2, 8, 4]), 6);
  assert.equal(median([]), null);
  assert.deepEqual(compareMetricToMedian(120, [80, 100, 100, 110]), {
    baseline: 100,
    changeRatio: 0.2,
    direction: "above",
  });
  assert.equal(compareMetricToMedian(1, []).direction, "insufficient_data");
});

test("small samples are explicitly labelled low confidence", () => {
  assert.equal(
    assessContentSampleConfidence({ postCount: 2, totalReach: 900 }),
    "low",
  );
  assert.equal(
    assessContentSampleConfidence({ postCount: 5, totalReach: 1000 }),
    "medium",
  );
  assert.equal(
    assessContentSampleConfidence({ postCount: 20, totalReach: 10000 }),
    "high",
  );
});
