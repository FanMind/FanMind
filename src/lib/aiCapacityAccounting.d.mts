export type AiCapacityFxSnapshot = {
  eurPerUsdNanos: number;
  version: string;
};

export type NormalizedOpenAiUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
};

export type AiCapacityCostResult = Readonly<{
  providerUsdMicros: number;
  actualEurMicrocents: number;
  pricingVersion: string;
  fxVersion: string;
  price: Readonly<Record<string, unknown>>;
  usage: NormalizedOpenAiUsage;
}>;

export type AiCapacityReservationEstimate = Readonly<{
  providerUsdMicros: number;
  reservedEurMicrocents: number;
  pricingVersion: string;
  fxVersion: string;
  price: Readonly<Record<string, unknown>>;
}>;

export function convertUsdMicrosToEurMicrocents(input: {
  usdMicros: number;
  eurPerUsdNanos: number;
}): number;

export function estimateOpenAiReservationCost(input: {
  model: string;
  serviceTier?: string;
  occurredAt: string;
  estimatedInputTokens: number;
  maxOutputTokens: number;
  eurPerUsdNanos: number;
  fxVersion: string;
}): AiCapacityReservationEstimate;

export function calculateOpenAiSettlementCost(input: {
  model: string;
  serviceTier?: string;
  occurredAt: string;
  providerUsage: unknown;
  eurPerUsdNanos: number;
  fxVersion: string;
}): AiCapacityCostResult;
