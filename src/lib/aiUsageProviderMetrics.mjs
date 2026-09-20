function exactNonNegativeInteger(value) {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : null;
}

export function normalizeOpenAiResponseUsage(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const inputTokens = exactNonNegativeInteger(value.input_tokens);
  const outputTokens = exactNonNegativeInteger(value.output_tokens);
  const totalTokens = exactNonNegativeInteger(value.total_tokens);
  const inputDetails = value.input_tokens_details;
  const outputDetails = value.output_tokens_details;
  const cachedInputTokens = exactNonNegativeInteger(inputDetails?.cached_tokens) ?? 0;
  const cacheWriteTokens =
    exactNonNegativeInteger(inputDetails?.cache_write_tokens) ??
    exactNonNegativeInteger(inputDetails?.cache_creation_tokens) ??
    0;
  const reasoningOutputTokens = exactNonNegativeInteger(outputDetails?.reasoning_tokens) ?? 0;

  if (
    inputTokens === null ||
    outputTokens === null ||
    totalTokens === null ||
    totalTokens !== inputTokens + outputTokens ||
    cachedInputTokens > inputTokens ||
    cacheWriteTokens > inputTokens ||
    reasoningOutputTokens > outputTokens
  ) {
    return null;
  }

  return {
    inputTokens,
    cachedInputTokens,
    cacheWriteTokens,
    outputTokens,
    reasoningOutputTokens,
    totalTokens,
  };
}
