export const CONTENT_METRIC_FIELDS = Object.freeze([
  "reach",
  "impressions",
  "views",
  "plays",
  "likes",
  "comments",
  "shares",
  "saves",
  "link_clicks",
  "profile_visits",
  "follows",
  "direct_messages",
  "new_contacts",
  "paid_reach",
  "paid_impressions",
]);

function normalizedCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.trunc(number);
}

function ratio(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator <= 0) return null;
  return numerator / denominator;
}

export function normalizeContentMetricSnapshot(input) {
  const normalized = {};
  for (const field of CONTENT_METRIC_FIELDS) {
    const value = normalizedCount(input?.[field]);
    if (value !== null) normalized[field] = value;
  }
  return normalized;
}

export function calculateContentPerformance(input) {
  const metrics = normalizeContentMetricSnapshot(input);
  const interactions =
    (metrics.likes ?? 0) +
    (metrics.comments ?? 0) +
    (metrics.shares ?? 0) +
    (metrics.saves ?? 0);
  const organicReach = Math.max(
    0,
    (metrics.reach ?? 0) - (metrics.paid_reach ?? 0),
  );
  const organicImpressions = Math.max(
    0,
    (metrics.impressions ?? 0) - (metrics.paid_impressions ?? 0),
  );

  return {
    metrics,
    interactions,
    organicReach,
    organicImpressions,
    engagementRateByReach: ratio(interactions, metrics.reach ?? 0),
    engagementRateByImpressions: ratio(
      interactions,
      metrics.impressions ?? 0,
    ),
    saveRateByReach: ratio(metrics.saves ?? 0, metrics.reach ?? 0),
    shareRateByReach: ratio(metrics.shares ?? 0, metrics.reach ?? 0),
    messageRateByReach: ratio(
      metrics.direct_messages ?? 0,
      metrics.reach ?? 0,
    ),
    contactConversionRateByReach: ratio(
      metrics.new_contacts ?? 0,
      metrics.reach ?? 0,
    ),
  };
}

export function assessContentSampleConfidence(input) {
  const postCount = normalizedCount(input?.postCount) ?? 0;
  const totalReach = normalizedCount(input?.totalReach) ?? 0;
  if (postCount >= 20 && totalReach >= 10_000) return "high";
  if (postCount >= 5 && totalReach >= 1_000) return "medium";
  return "low";
}

export function median(values) {
  const numbers = values
    .map(Number)
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  if (!numbers.length) return null;
  const middle = Math.floor(numbers.length / 2);
  return numbers.length % 2
    ? numbers[middle]
    : (numbers[middle - 1] + numbers[middle]) / 2;
}

export function compareMetricToMedian(value, historicalValues) {
  const current = Number(value);
  const baseline = median(historicalValues ?? []);
  if (!Number.isFinite(current) || baseline === null || baseline <= 0) {
    return { baseline, changeRatio: null, direction: "insufficient_data" };
  }
  const changeRatio = (current - baseline) / baseline;
  return {
    baseline,
    changeRatio,
    direction:
      changeRatio > 0.05
        ? "above"
        : changeRatio < -0.05
          ? "below"
          : "similar",
  };
}
