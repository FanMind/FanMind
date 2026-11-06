export type NormalizedOpenAiResponseUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
};

export function normalizeOpenAiResponseUsage(
  value: unknown,
): NormalizedOpenAiResponseUsage | null;
