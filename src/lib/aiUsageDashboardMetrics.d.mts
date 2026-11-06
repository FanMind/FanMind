export const ADMIN_AI_USAGE_DAY_RANGES: readonly [1, 7, 30, 90];

export type AiUsageModelEvent = {
  model?: string | null;
  estimated_cost_cents?: number | null;
  estimated_input_tokens?: number | null;
  estimated_output_tokens?: number | null;
  status?: string | null;
};

export type AiUsageModelSummary = {
  model: string;
  requests: number;
  estimatedCostCents: number;
  inputTokens: number;
  outputTokens: number;
  errorRequests: number;
};

export type AiUsageTokenDistributionEvent = {
  feature?: string | null;
  estimated_input_tokens?: number | null;
  estimated_output_tokens?: number | null;
  estimated_total_tokens?: number | null;
  status?: string | null;
};

export type AiUsageTokenPercentile = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type AiUsageTokenDistributionSummary = {
  feature: string;
  sampleCount: number;
  p50: AiUsageTokenPercentile;
  p90: AiUsageTokenPercentile;
  p95: AiUsageTokenPercentile;
};

export type AiBudgetIndicator = {
  configured: boolean;
  level:
    | "unconfigured"
    | "incomplete"
    | "normal"
    | "observe"
    | "warning"
    | "attention";
  currentCostCents: number;
  budgetCents: number | null;
  usageRatio: number | null;
  usagePercent: number | null;
  blocking: false;
};

export type AiUsageSpikeIndicator = {
  level: "incomplete" | "insufficient_basis" | "normal" | "warning";
  currentRequests: number;
  previousRequests: number;
  currentCostCents: number;
  previousCostCents: number;
  requestRatio: number | null;
  costRatio: number | null;
  ratioThreshold: number;
  triggeredBy: Array<"requests" | "cost">;
  blocking: false;
};

export function normalizeAdminAiUsageDays(value: unknown): number;
export function aggregateAiUsageByModel(
  events: AiUsageModelEvent[],
): AiUsageModelSummary[];
export function aggregateAiUsageTokenDistributionByFeature(
  events: AiUsageTokenDistributionEvent[],
): AiUsageTokenDistributionSummary[];
export function calculateAiBudgetIndicator(input: {
  currentCostCents?: number | null;
  budgetCents?: number | null;
  truncated?: boolean;
}): AiBudgetIndicator;
export function calculateAiUsageSpikeIndicator(input: {
  currentRequests?: number | null;
  previousRequests?: number | null;
  currentCostCents?: number | null;
  previousCostCents?: number | null;
  ratioThreshold?: number | null;
  minRequests?: number | null;
  minCostCents?: number | null;
  currentTruncated?: boolean;
  previousTruncated?: boolean;
}): AiUsageSpikeIndicator;
