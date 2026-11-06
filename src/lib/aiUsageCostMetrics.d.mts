export type AiCostPerContactMetrics = Readonly<{
  perFanCents: number | null;
  perHundredFansCents: number | null;
  perThousandFansCents: number | null;
}>;

export function parsePostgrestExactCount(
  contentRange: string | null | undefined,
): number | null;

export function calculateAiCostPerContactMetrics(
  estimatedCostCents: number,
  contactCount: number | null,
): AiCostPerContactMetrics;
