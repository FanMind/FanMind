export const CONTENT_METRIC_FIELDS: readonly string[];
export function normalizeContentMetricSnapshot(
  input: Record<string, unknown> | null | undefined,
): Record<string, number>;
export function calculateContentPerformance(
  input: Record<string, unknown> | null | undefined,
): {
  metrics: Record<string, number>;
  interactions: number;
  organicReach: number;
  organicImpressions: number;
  engagementRateByReach: number | null;
  engagementRateByImpressions: number | null;
  saveRateByReach: number | null;
  shareRateByReach: number | null;
  messageRateByReach: number | null;
  contactConversionRateByReach: number | null;
};
export function assessContentSampleConfidence(input: {
  postCount?: unknown;
  totalReach?: unknown;
}): "low" | "medium" | "high";
export function median(values: unknown[]): number | null;
export function compareMetricToMedian(
  value: unknown,
  historicalValues: unknown[],
): {
  baseline: number | null;
  changeRatio: number | null;
  direction: "above" | "below" | "similar" | "insufficient_data";
};
